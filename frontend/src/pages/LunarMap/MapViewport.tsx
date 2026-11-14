import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Moon, Sun, Crosshair, CalendarCheck } from 'lucide-react';
import type { LunarLocation, MapLayer, SceneSeries, SiteGeometry, TerrainGrid, Vec3 } from '../../types';
import { modelUrl, sceneService } from '../../services/sceneService';
import { ELEVATION_STOPS, MoonScene, type ModelStatus, type ScaleMode } from './scene/MoonScene';
import { formatCountdown, formatUtc, sampleAt } from '../../utils/sceneTime';

export interface MapViewportProps {
 location: LunarLocation | null;
 layers: MapLayer[];
 onSelect: (location: LunarLocation) => void;
 /** Scenario time (ISO UTC). The playback window starts here. */
 utc: string;
 onUtcChange: (utc: string) => void;
 markers: LunarLocation[];
}

const WINDOW_HOURS = 720; // 30 days ≈ one synodic month
const STEP_HOURS = 1;
const ORBIT_HOURS = 24 * 700; // covers Mars's 687-day orbit
const ORBIT_STEP_HOURS = 72;
const SPEEDS = [{ label: '1 h/s', value: 1 }, { label: '6 h/s', value: 6 }, { label: '1 day/s', value: 24 }, { label: '3 days/s', value: 72 }];

const subPoint = (v: Vec3) => {
 const r = Math.hypot(...v);
 return { lat: (Math.asin(v[2] / r) * 180) / Math.PI, lon: (Math.atan2(v[1], v[0]) * 180) / Math.PI };
};
const fmtLatLon = (lat: number, lon: number) => `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`;
const deg = (v: number) => v.toFixed(2) + '°';

/** View settings remembered across reloads in this browser (falls back to defaults if storage is blocked). */
const PREFS_KEY = 'lunarsite.explorer.prefs.v1';
interface ViewPrefs { scale: ScaleMode; grid: boolean; paths: boolean; labels: boolean; speed: number; exaggeration: number; }
const DEFAULT_PREFS: ViewPrefs = { scale: 'compact', grid: false, paths: true, labels: true, speed: 6, exaggeration: 5 };
const EXAGGERATIONS = [1, 2, 5, 10, 20];
function loadPrefs(): ViewPrefs {
 try { return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<ViewPrefs>) }; }
 catch { return DEFAULT_PREFS; }
}
const initialPrefs = loadPrefs();

export function MapViewport({ location, layers, onSelect, utc, onUtcChange, markers }: MapViewportProps) {
 const containerRef = useRef<HTMLDivElement>(null);
 const engineRef = useRef<MoonScene | null>(null);
 const markersRef = useRef(markers);
 markersRef.current = markers;
 const onSelectRef = useRef(onSelect);
 onSelectRef.current = onSelect;
 const [series, setSeries] = useState<SceneSeries | null>(null);
 const [seriesError, setSeriesError] = useState('');
 const [attempt, setAttempt] = useState(0);
 const [playhead, setPlayhead] = useState(0);
 const [playing, setPlaying] = useState(false);
 const [speed, setSpeed] = useState(initialPrefs.speed);
 const [scale, setScale] = useState<ScaleMode>(initialPrefs.scale);
 const [grid, setGrid] = useState(initialPrefs.grid);
 const [paths, setPaths] = useState(initialPrefs.paths);
 const [labels, setLabels] = useState(initialPrefs.labels);
 const [exaggeration, setExaggeration] = useState(initialPrefs.exaggeration);
 const [terrain, setTerrain] = useState<TerrainGrid | null>(null);
 const [terrainState, setTerrainState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
 const elevationOn = layers.includes('elevation');
 const illuminationOn = layers.includes('illumination');
 const [models, setModels] = useState<ModelStatus | null>(null);
 const [siteGeo, setSiteGeo] = useState<SiteGeometry | null>(null);
 const [siteError, setSiteError] = useState('');

 // Engine lifecycle.
 useEffect(() => {
  const el = containerRef.current;
  if (!el) return;
  const engine = new MoonScene(el,
   (lat, lon) => onSelectRef.current({ id: 'custom', name: 'Custom location', latitudeDeg: lat, longitudeDeg: lon, frame: 'MOON_ME' }),
   id => { const m = markersRef.current.find(s => s.id === id); if (m) onSelectRef.current(m); },
   setModels);
  engineRef.current = engine;
  sceneService.models().then(manifest => engine.loadModels(manifest, modelUrl)).catch(() => setModels({ moon: 'fallback', earth: 'fallback', sun: 'fallback', mars: 'fallback' }));
  return () => { engine.dispose(); engineRef.current = null; };
 }, []);

 // Ephemeris window for the scenario time and site.
 const lat = location?.latitudeDeg, lon = location?.longitudeDeg;
 useEffect(() => {
  let current = true;
  setSeriesError('');
  sceneService.series(utc, WINDOW_HOURS, STEP_HOURS, lat, lon)
   .then(s => { if (current) { setSeries(s); setPlayhead(0); engineRef.current?.setPathSamples(s.samples); } })
   .catch((e: unknown) => { if (current) setSeriesError(e instanceof Error ? e.message : 'Unable to load ephemeris'); });
  return () => { current = false; };
 }, [utc, lat, lon, attempt]);

 // Coarse two-year window for drawing Earth and Mars orbits around the Sun.
 useEffect(() => {
  let current = true;
  sceneService.series(utc, ORBIT_HOURS, ORBIT_STEP_HOURS)
   .then(s => { if (current) engineRef.current?.setOrbitSamples(s.samples); })
   .catch(() => { /* orbits are decorative; the main series reports errors */ });
  return () => { current = false; };
 }, [utc, attempt]);

 const sample = useMemo(() => series ? sampleAt(series.samples, playhead / series.stepHours) : null, [series, playhead]);
 const viewingUtc = sample?.utc ?? utc;

 useEffect(() => { if (sample) engineRef.current?.setSample(sample); }, [sample]);
 useEffect(() => { engineRef.current?.setOptions({ scale, grid, paths, labels }); }, [scale, grid, paths, labels]);
 useEffect(() => {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ scale, grid, paths, labels, speed, exaggeration })); } catch { /* storage unavailable */ }
 }, [scale, grid, paths, labels, speed, exaggeration]);

 // Data layers. The LOLA grid is fetched once, the first time Elevation is switched on.
 useEffect(() => {
  if (!elevationOn || terrain || terrainState === 'loading') return;
  setTerrainState('loading');
  sceneService.elevation(1440)
   .then(g => { setTerrain(g); setTerrainState('ready'); })
   .catch(() => setTerrainState('error'));
 }, [elevationOn, terrain, terrainState]);
 useEffect(() => { if (terrain) engineRef.current?.setTerrain(terrain); }, [terrain]);
 useEffect(() => { engineRef.current?.setExaggeration(exaggeration); }, [exaggeration]);
 useEffect(() => { engineRef.current?.setLayers(layers); }, [layers]);
 useEffect(() => { engineRef.current?.setMarkers(markers, location?.id ?? null); }, [markers, location?.id]);
 useEffect(() => {
  engineRef.current?.setSite(lat ?? null, lon ?? null);
  if (lat !== undefined && lon !== undefined) engineRef.current?.flyTo(lat, lon);
 }, [lat, lon]);

 // Playback clock.
 useEffect(() => {
  if (!playing) return;
  let last = performance.now(), frame = 0;
  const tick = (now: number) => {
   const dt = (now - last) / 1000; last = now;
   setPlayhead(p => { const next = p + dt * speed; if (next >= WINDOW_HOURS) { setPlaying(false); return WINDOW_HOURS; } return next; });
   frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
 }, [playing, speed]);

 // Precise site geometry and rise/set events, fetched when the view settles.
 useEffect(() => {
  if (lat === undefined || lon === undefined) { setSiteGeo(null); return; }
  if (playing) return;
  let current = true;
  const id = setTimeout(() => {
   sceneService.site(lat, lon, viewingUtc)
    .then(g => { if (current) { setSiteGeo(g); setSiteError(''); } })
    .catch((e: unknown) => { if (current) setSiteError(e instanceof Error ? e.message : 'Unable to load site geometry'); });
  }, 250);
  return () => { current = false; clearTimeout(id); };
 }, [lat, lon, viewingUtc, playing]);

 const togglePlay = useCallback(() => {
  if (!playing && playhead >= WINDOW_HOURS) setPlayhead(0);
  setPlaying(p => !p);
 }, [playing, playhead]);

 const sunAngles = playing || !siteGeo ? sample?.site?.sun : siteGeo.sun;
 const earthAngles = playing || !siteGeo ? sample?.site?.earth : siteGeo.earth;
 const subSolar = sample ? subPoint(sample.sun) : null;
 const subEarth = sample ? subPoint(sample.earth) : null;

 const event = (body: 'sun' | 'earth', name: [string, string]) => {
  if (!siteGeo || !sunAngles || !earthAngles) return '—';
  const angles = body === 'sun' ? sunAngles : earthAngles;
  const g = siteGeo[body];
  const up = angles.elevationDeg > 0;
  const when = up ? g.nextSet : g.nextRise;
  const countdown = formatCountdown(viewingUtc, when);
  if (!when) return `${up ? 'Above' : 'Below'} horizon · no ${up ? name[0] : name[1]} within ${siteGeo.searchWindowDays} days`;
  if (!countdown) return `${up ? 'Above' : 'Below'} horizon · pause to refresh`;
  return `${up ? 'Above' : 'Below'} horizon · ${up ? name[0] : name[1]} in ${countdown} (${formatUtc(when)})`;
 };

 const modelNote = models && Object.entries(models).filter(([, s]) => s !== 'model')
  .map(([k, s]) => `${k}: ${s === 'loading' ? 'loading model…' : 'reference sphere (GLB not found)'}`).join(' · ');

 return <div className="scene-wrap">
  <div className="map-viewport scene-viewport" ref={containerRef} role="application"
   aria-label="3D Sun-centered view focused on the Moon. Drag to orbit the Moon, scroll to zoom, click the Moon to select a location. Coordinates can also be entered in the form.">
   <div className="scene-toggles">
    <label>Scale<select value={scale} onChange={e => setScale(e.target.value as ScaleMode)}>
     <option value="compact">Compact distances</option><option value="true">True scale</option></select></label>
    <label className="checkbox"><input type="checkbox" checked={grid} onChange={e => setGrid(e.target.checked)} />Lat/lon grid</label>
    <label className="checkbox"><input type="checkbox" checked={paths} onChange={e => setPaths(e.target.checked)} />Orbits & Moon path</label>
    <label className="checkbox"><input type="checkbox" checked={labels} onChange={e => setLabels(e.target.checked)} />Labels</label>
    <div className="button-row">
     <button type="button" onClick={() => engineRef.current?.resetView()}><Moon size={12} aria-hidden /> Moon</button>
     <button type="button" onClick={() => engineRef.current?.systemView()}><Sun size={12} aria-hidden /> Solar system</button>
     {location && <button type="button" onClick={() => engineRef.current?.flyTo(location.latitudeDeg, location.longitudeDeg)}><Crosshair size={12} aria-hidden /> Site</button>}
    </div>
   </div>
   {(elevationOn || illuminationOn) && <div className="layer-legends">
    {elevationOn && <div className="layer-legend">
     <strong>Elevation (LOLA)</strong>
     {terrainState === 'loading' && <span>Loading LOLA heights…</span>}
     {terrainState === 'error' && <span role="alert">Elevation data unavailable (is ldem_16_uint.tif in modelResources?)</span>}
     {terrainState === 'ready' && <>
      <div className="legend-bar" style={{ background: `linear-gradient(90deg, ${ELEVATION_STOPS.map(([h, c]) => `${c} ${((h + 9000) / 19700) * 100}%`).join(', ')})` }} />
      <div className="legend-scale positioned"><span style={{ left: '0%' }}>−9 km</span><span style={{ left: '45.7%' }}>0</span><span style={{ left: '100%' }}>+10.7 km</span></div>
      <label>Relief exaggeration<select value={exaggeration} onChange={e => setExaggeration(Number(e.target.value))}>
       {EXAGGERATIONS.map(x => <option key={x} value={x}>×{x}{x === 1 ? ' (true scale)' : ''}</option>)}</select></label>
      <small>Heights relative to the 1737.4 km mean sphere · 16 px/deg (~1.9 km)</small>
     </>}
    </div>}
    {illuminationOn && <div className="layer-legend">
     <strong>Illumination · solar elevation</strong>
     <div className="legend-bar" style={{ background: 'linear-gradient(90deg, #0f1f6b 0%, #0f1f6b 12%, #fff1a0 12%, #fff1a0 14%, #f25914 14%, #ffc733 40%, #fffad9 100%)' }} />
     <div className="legend-scale positioned"><span style={{ left: '0%' }}>Night</span><span style={{ left: '13%' }}>0°</span><span style={{ left: '40%' }}>20°</span><span style={{ left: '100%' }}>90°</span></div>
     <small>Live for the viewed time · white lines every 10° · mean-sphere horizon, no terrain shadows</small>
    </div>}
   </div>}
   <div className="scene-legend" aria-hidden>
    <span><i className="orbit" />Earth / Mars orbits · Moon path</span><span><i className="sun" />Sun direction</span><span><i className="earth" />Earth direction</span><span><i className="horizon" />Local horizon</span>
   </div>
   {seriesError && <div className="scene-error" role="alert">
    <strong>Ephemeris service unavailable</strong><p>{seriesError}</p>
    <p className="muted">Start it from <code>backend/</code>: <code>python -m uvicorn api.main:app --port 8000</code></p>
    <button type="button" onClick={() => setAttempt(n => n + 1)}>Retry</button>
   </div>}
   {!series && !seriesError && <div className="scene-loading">Loading SPICE geometry…</div>}
  </div>

  <section className="scene-timeline panel" aria-label="Time playback">
   <button type="button" onClick={togglePlay} disabled={!series} aria-label={playing ? 'Pause playback' : 'Play playback'}>
    {playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}</button>
   <label className="sr-only" htmlFor="scene-speed">Playback speed</label>
   <select id="scene-speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}>
    {SPEEDS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
   <label className="scene-slider">
    <span>Viewing <strong>{formatUtc(viewingUtc)}</strong> · +{(playhead / 24).toFixed(1)} of 30 days from scenario time</span>
    <input type="range" min={0} max={WINDOW_HOURS} step={0.25} value={playhead} disabled={!series}
     aria-label="Hours after scenario time" onChange={e => { setPlaying(false); setPlayhead(Number(e.target.value)); }} />
   </label>
   <button type="button" disabled={playhead === 0} onClick={() => { setPlaying(false); setPlayhead(0); }}>Back to scenario time</button>
   <button type="button" disabled={playhead === 0} onClick={() => { setPlaying(false); onUtcChange(new Date(viewingUtc).toISOString()); }}>
    <CalendarCheck size={12} aria-hidden /> Set as scenario time</button>
  </section>

  <section className="panel scene-readout" aria-live="polite">
   <div className="scene-readout-head">
    <h2>{location ? location.name : 'No site selected'}</h2>
    <span className="muted">{location ? fmtLatLon(location.latitudeDeg, location.longitudeDeg) + ' · MOON_ME' : 'Click the Moon, a site ping, or enter coordinates.'}</span>
   </div>
   <div className="readout-grid">
    <article className="metric metric-sun"><span>Solar elevation</span>
     <strong>{sunAngles ? deg(sunAngles.elevationDeg) : '—'}</strong>
     <small>{sunAngles ? 'Azimuth ' + deg(sunAngles.azimuthDeg) + ' · ' : ''}{location ? event('sun', ['sunset', 'sunrise']) : 'Select a site'}</small></article>
    <article className="metric metric-earth"><span>Earth elevation</span>
     <strong>{earthAngles ? deg(earthAngles.elevationDeg) : '—'}</strong>
     <small>{earthAngles ? 'Azimuth ' + deg(earthAngles.azimuthDeg) + ' · ' : ''}{location ? event('earth', ['Earthset', 'Earthrise']) : 'Select a site'}</small></article>
    <article className="metric"><span>Ideal horizontal panel</span>
     <strong>{siteGeo && !playing ? siteGeo.power.horizontalPanelWm2.toFixed(0) + ' W/m²' : '—'}</strong>
     <small>{siteGeo ? `Solar flux ${siteGeo.power.solarFluxWm2.toFixed(0)} W/m² · ${siteGeo.power.assumptions}` : 'Needs a selected site'}</small></article>
    <article className="metric"><span>Sub-solar · sub-Earth point</span>
     <strong className="small-strong">{subSolar ? fmtLatLon(subSolar.lat, subSolar.lon) : '—'}</strong>
     <small>Sub-Earth {subEarth ? fmtLatLon(subEarth.lat, subEarth.lon) : '—'} · offset from 0°,0° is libration</small></article>
    <article className={'metric' + (siteGeo?.terrain ? '' : ' metric-unavailable')}><span>Terrain · LOLA</span>
     <strong className="small-strong">{siteGeo?.terrain ? `Slope ${siteGeo.terrain.regionalSlopeDeg.toFixed(1)}°` : location ? 'Not available' : '—'}</strong>
     <small>{siteGeo?.terrain
      ? `Elevation ${(siteGeo.terrain.elevationM / 1000).toFixed(2)} km · slope over ~${siteGeo.terrain.baselineKm.toFixed(1)} km (lander-scale slopes can be steeper) · Temperature & PSR: not available (no Diviner/PSR product)`
      : 'Elevation and regional slope need the LOLA DEM. Temperature & PSR: not available.'}</small></article>
   </div>
   {siteError && <p role="alert">{siteError}</p>}
   <p className="scene-source">
    {series ? series.source : 'Source pending'} · Horizon: {siteGeo?.horizonMethod ?? 'mean lunar sphere, no terrain'} · Azimuth clockwise from north
    {' · View: Sun-centered ECLIPJ2000, camera locked on the Moon'}
    {scale === 'compact' ? ' · Compact scale: 1 AU = 60 units, Moon–Earth distance and body sizes enlarged' : ' · True scale: real distances and radii'}
    {modelNote ? ' · ' + modelNote : ''}
   </p>
  </section>
 </div>;
}
