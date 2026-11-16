import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pause, Play, Moon, Sun, Crosshair, CalendarCheck } from 'lucide-react';
import type { CoverageMap, CoverageMode, Equipment, LunarLocation, MapLayer, PsrMap, SceneSeries, SiteCoverage, SiteGeometry, TerrainEvents, TerrainGrid, ThermalMap, ThermalProduct, Vec3 } from '../../types';
import { coverageService, modelUrl, sceneService } from '../../services/sceneService';
import { ELEVATION_STOPS, MARKER_COLORS, MoonScene, type ModelStatus, type ScaleMode } from './scene/MoonScene';
import { colorize, cssGradient, decodeF32, psrRgba, scaleFor, thermalSpec, BLOCKED_COLOR, PSR_COLOR, THERMAL_MAX_K, THERMAL_MIN_K } from '../../utils/coverageColors';
import { SiteCoveragePanel } from './SiteCoveragePanel';
import { GradeBadge, MissionBar, profileById } from './MissionBar';
import { gradeClass, gradeMetric } from '../../utils/missionProfiles';
import { formatCountdown, formatUtc, sampleAt } from '../../utils/sceneTime';

export interface MapViewportProps {
 location: LunarLocation | null;
 layers: MapLayer[];
 onSelect: (location: LunarLocation) => void;
 /** Scenario time (ISO UTC). The playback window starts here. */
 utc: string;
 onUtcChange: (utc: string) => void;
 markers: LunarLocation[];
 /** Equipment assumptions for the terrain-aware power / communication layers and site statistics. */
 equipment: Equipment;
 coverageMode: CoverageMode;
 /** Equipment inputs, shown as a bar directly under the 3D view. */
 equipmentBar?: ReactNode;
}

type TerrainLayer = 'power' | 'earth-visibility';
const COVERAGE_KIND: Record<TerrainLayer, 'power' | 'comms'> = { power: 'power', 'earth-visibility': 'comms' };
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
interface CoverageState { status: 'idle' | 'loading' | 'ready' | 'error'; error: string; meta: CoverageMap | null; }
const IDLE: CoverageState = { status: 'idle', error: '', meta: null };

const WINDOW_HOURS = 720; // 30 days ≈ one synodic month
const STEP_HOURS = 1;
const ORBIT_HOURS = 24 * 700; // covers Mars's 687-day orbit
const ORBIT_STEP_HOURS = 24; // ~88 points around Mercury's 88-day orbit
const SPEEDS = [{ label: '1 h/s', value: 1 }, { label: '6 h/s', value: 6 }, { label: '1 day/s', value: 24 }, { label: '3 days/s', value: 72 }];

const subPoint = (v: Vec3) => {
 const r = Math.hypot(...v);
 return { lat: (Math.asin(v[2] / r) * 180) / Math.PI, lon: (Math.atan2(v[1], v[0]) * 180) / Math.PI };
};
const fmtLatLon = (lat: number, lon: number) => `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`;
const deg = (v: number) => v.toFixed(2) + '°';

/** View settings remembered across reloads in this browser (falls back to defaults if storage is blocked). */
// v2: the default scale became 'true'; the new key lets browsers that saved v1 prefs pick up the new default once.
const PREFS_KEY = 'lunarsite.explorer.prefs.v2';
interface ViewPrefs { scale: ScaleMode; grid: boolean; paths: boolean; labels: boolean; stars: boolean; speed: number; exaggeration: number; mission: string; }
const DEFAULT_PREFS: ViewPrefs = { scale: 'true', grid: false, paths: true, labels: true, stars: true, speed: 6, exaggeration: 5, mission: '' };
const EXAGGERATIONS = [1, 2, 5, 10, 20];
function loadPrefs(): ViewPrefs {
 try { return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<ViewPrefs>) }; }
 catch { return DEFAULT_PREFS; }
}
const initialPrefs = loadPrefs();

export function MapViewport({ location, layers, onSelect, utc, onUtcChange, markers, equipment, coverageMode, equipmentBar }: MapViewportProps) {
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
 const [stars, setStars] = useState(initialPrefs.stars);
 const [skyState, setSkyState] = useState<'none' | 'loading' | 'ready' | 'error'>('none');
 const [exaggeration, setExaggeration] = useState(initialPrefs.exaggeration);
 const [mission, setMission] = useState(initialPrefs.mission);
 const profile = profileById(mission);
 const [terrain, setTerrain] = useState<TerrainGrid | null>(null);
 const [terrainState, setTerrainState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
 const [terrainAttempt, retryTerrain] = useState(0);
 const [psrAttempt, retryPsr] = useState(0);
 const [thermalAttempt, retryThermal] = useState(0);
 const [coverageAttempt, retryCoverage] = useState(0);
 const elevationOn = layers.includes('elevation');
 const illuminationOn = layers.includes('illumination');
 const [models, setModels] = useState<ModelStatus | null>(null);
 const [siteGeo, setSiteGeo] = useState<SiteGeometry | null>(null);
 const [siteError, setSiteError] = useState('');
 const [coverage, setCoverage] = useState<Record<TerrainLayer, CoverageState>>({ power: IDLE, 'earth-visibility': IDLE });
 const [psr, setPsr] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; meta: PsrMap | null; error: string }>({ status: 'idle', meta: null, error: '' });
 const [thermalProduct, setThermalProduct] = useState<ThermalProduct>('daymax');
 const [thermal, setThermal] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; meta: ThermalMap | null; error: string }>({ status: 'idle', meta: null, error: '' });
 const [events, setEvents] = useState<TerrainEvents | null>(null);
 const psrOn = layers.includes('psr'), thermalOn = layers.includes('thermal');
 const [siteCoverage, setSiteCoverage] = useState<{ data: SiteCoverage | null; loading: boolean; error: string }>({ data: null, loading: false, error: '' });

 // Engine lifecycle.
 useEffect(() => {
  const el = containerRef.current;
  if (!el) return;
  const engine = new MoonScene(el,
   (lat, lon) => onSelectRef.current({ id: 'custom', name: 'Custom location', latitudeDeg: lat, longitudeDeg: lon, frame: 'MOON_ME' }),
   id => { const m = markersRef.current.find(s => s.id === id); if (m) onSelectRef.current(m); },
   setModels);
  engineRef.current = engine;
  sceneService.models().then(manifest => {
   if (engineRef.current !== engine) return; // this engine was already disposed (React dev double-mount)
   if (manifest.sky) {
    setSkyState('loading');
    engine.loadSky(modelUrl(manifest.sky)).then(ok => { if (engineRef.current === engine) setSkyState(ok ? 'ready' : 'error'); });
   }
   return engine.loadModels(manifest, modelUrl);
  }).catch(() => setModels({ moon: 'fallback', earth: 'fallback', sun: 'fallback', mars: 'fallback', mercury: 'fallback', venus: 'fallback' }));
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
 useEffect(() => { engineRef.current?.setOptions({ scale, grid, paths, labels, stars }); }, [scale, grid, paths, labels, stars]);
 useEffect(() => {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ scale, grid, paths, labels, stars, speed, exaggeration, mission })); } catch { /* storage unavailable */ }
 }, [scale, grid, paths, labels, stars, speed, exaggeration, mission]);

 // Data layers. The LOLA grid is fetched once, the first time Elevation is switched on.
 useEffect(() => {
  if (!elevationOn || terrain) return;
  let current = true;
  setTerrainState('loading');
  sceneService.elevation(1440)
   .then(g => { if (current) { setTerrain(g); setTerrainState('ready'); } })
   .catch(() => { if (current) setTerrainState('error'); });
  return () => { current = false; };
 }, [elevationOn, terrain, terrainAttempt]);
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

 // Terrain-aware coverage maps. "Now" follows the viewed time (refreshed when paused); monthly uses the scenario time.
 const coverageTime = coverageMode === 'instant' ? viewingUtc : utc;
 const activeCoverage = (['power', 'earth-visibility'] as TerrainLayer[]).filter(l => layers.includes(l));
 const coverageKey = activeCoverage.join(',');
 useEffect(() => {
  if (!activeCoverage.length || (playing && coverageMode === 'instant')) return;
  let current = true;
  const id = setTimeout(() => {
   for (const layer of activeCoverage) {
    const kind = COVERAGE_KIND[layer];
    engineRef.current?.setCoverage(layer, null);
    setCoverage(c => ({ ...c, [layer]: { status: 'loading', error: '', meta: null } }));
    Promise.all([
     coverageService.map('global', kind, coverageMode, coverageTime, equipment),
     coverageService.map('southpole', kind, coverageMode, coverageTime, equipment),
    ]).then(([g, p]) => {
     if (!current) return;
     const spec = scaleFor(kind, coverageMode, Math.max(g.max ?? 0, p.max ?? 0), equipment.panelEfficiencyPct);
     engineRef.current?.setCoverage(layer, {
      global: { width: g.width, height: g.height, rgba: colorize(decodeF32(g.valuesF32), spec) },
      polar: { width: p.width, height: p.height, rgba: colorize(decodeF32(p.valuesF32), spec), capLatDeg: p.polarCapLat, rhoMaxM: p.polarRhoMaxM },
     });
     setCoverage(c => ({ ...c, [layer]: { status: 'ready', error: '', meta: { ...g, max: Math.max(g.max ?? 0, p.max ?? 0) } } }));
    }).catch((e: unknown) => {
     if (current) setCoverage(c => ({ ...c, [layer]: { ...c[layer], status: 'error', error: e instanceof Error ? e.message : 'Unable to compute map' } }));
    });
   }
  }, 400);
  return () => { current = false; clearTimeout(id); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [coverageKey, coverageMode, coverageTime, equipment, playing, coverageAttempt]);

 // Measured products: LOLA permanent shadow (fetched once) and Diviner temperature (per product).
 useEffect(() => {
  if (!psrOn || psr.meta) return;
  let current = true;
  setPsr({ status: 'loading', meta: null, error: '' });
  coverageService.psr().then(m => {
   if (!current) return;
   engineRef.current?.setCoverage('psr', { global: null, polar: { width: m.width, height: m.height, rgba: psrRgba(decodeF32(m.valuesF32)), capLatDeg: m.capLat, rhoMaxM: m.rhoMaxM } });
   setPsr({ status: 'ready', meta: m, error: '' });
  }).catch((e: unknown) => { if (current) setPsr({ status: 'error', meta: null, error: e instanceof Error ? e.message : 'Unable to load shadow map' }); });
  return () => { current = false; };
 }, [psrOn, psr.meta, psrAttempt]);
 useEffect(() => {
  if (!thermalOn) return;
  let current = true;
  engineRef.current?.setCoverage('thermal', null);
  setThermal({ meta: null, status: 'loading', error: '' });
  coverageService.thermal(thermalProduct).then(m => {
   if (!current) return;
   engineRef.current?.setCoverage('thermal', { global: { width: m.width, height: m.height, rgba: colorize(decodeF32(m.valuesF32), thermalSpec(), 200) }, polar: null });
   setThermal({ status: 'ready', meta: m, error: '' });
  }).catch((e: unknown) => { if (current) setThermal({ status: 'error', meta: null, error: e instanceof Error ? e.message : 'Unable to load Diviner map' }); });
  return () => { current = false; };
 }, [thermalOn, thermalProduct, thermalAttempt]);

 // Terrain-aware rise/set times for the viewed time (refreshed when paused).
 useEffect(() => {
  if (lat === undefined || lon === undefined) { setEvents(null); return; }
  if (playing) return;
  let current = true;
  const id = setTimeout(() => {
   coverageService.events(lat, lon, viewingUtc, equipment).then(e => { if (current) setEvents(e); }).catch(() => { if (current) setEvents(null); });
  }, 450);
  return () => { current = false; clearTimeout(id); };
 }, [lat, lon, viewingUtc, equipment, playing]);

 // Site statistics: 30 days from the scenario time with the current equipment.
 useEffect(() => {
  if (lat === undefined || lon === undefined) { setSiteCoverage({ data: null, loading: false, error: '' }); return; }
  let current = true;
  setSiteCoverage(s => ({ ...s, loading: true, error: '' }));
  const id = setTimeout(() => {
   coverageService.site(lat, lon, utc, equipment)
    .then(d => { if (current) setSiteCoverage({ data: d, loading: false, error: '' }); })
    .catch((e: unknown) => { if (current) setSiteCoverage({ data: null, loading: false, error: e instanceof Error ? e.message : 'Unable to compute site statistics' }); });
  }, 300);
  return () => { current = false; clearTimeout(id); };
 }, [lat, lon, utc, equipment]);

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

 const terrainEvent = (body: 'sun' | 'earth', name: [string, string]) => {
  const e = events?.[body];
  if (!e || playing) return null;
  const when = e.up ? e.nextSet : e.nextRise;
  const countdown = formatCountdown(viewingUtc, when);
  const what = e.up ? name[0] : name[1];
  return `With terrain${body === 'earth' && equipment.commMaskDeg ? ` & ${equipment.commMaskDeg}° mask` : ''}: ${e.up ? 'in view' : 'blocked'} · ${when && countdown ? `${what} in ${countdown}` : `no ${what} within ${events!.searchWindowDays} days`}`;
 };


 return <div className="scene-wrap">
  <div className="map-viewport scene-viewport" ref={containerRef} role="application"
   aria-label="3D Sun-centered view focused on the Moon. Drag to orbit the Moon, scroll to zoom, click the Moon to select a location. Coordinates can also be entered in the form.">
   <div className="scene-toggles">
    <label>Scale<select value={scale} onChange={e => setScale(e.target.value as ScaleMode)}>
     <option value="compact">Compact distances</option><option value="true">True scale</option></select></label>
    <label className="checkbox"><input type="checkbox" checked={grid} onChange={e => setGrid(e.target.checked)} />Lat/lon grid</label>
    <label className="checkbox"><input type="checkbox" checked={paths} onChange={e => setPaths(e.target.checked)} />Orbits & Moon path</label>
    <label className="checkbox"><input type="checkbox" checked={labels} onChange={e => setLabels(e.target.checked)} />Labels</label>
    <label className="checkbox" title={skyState === 'none' ? 'No star map in modelResources' : undefined}><input type="checkbox" checked={stars} disabled={skyState !== 'ready'} onChange={e => setStars(e.target.checked)} />Stars{skyState === 'loading' ? ' (loading…)' : skyState === 'none' ? ' (no map)' : skyState === 'error' ? ' (failed)' : ''}</label>
    <div className="button-row">
     <button type="button" onClick={() => engineRef.current?.resetView()}><Moon size={12} aria-hidden /> Moon</button>
     <button type="button" onClick={() => engineRef.current?.systemView()}><Sun size={12} aria-hidden /> Solar system</button>
     {location && <button type="button" onClick={() => engineRef.current?.flyTo(location.latitudeDeg, location.longitudeDeg)}><Crosshair size={12} aria-hidden /> Site</button>}
    </div>
   </div>
   {(elevationOn || illuminationOn || activeCoverage.length > 0 || psrOn || thermalOn) && <div className="layer-legends">
    {elevationOn && <div className="layer-legend">
     <strong>Terrain elevation</strong>
     {terrainState === 'loading' && <span>Loading terrain…</span>}
     {terrainState === 'error' && <><span role="alert">Terrain map unavailable.</span><button type="button" onClick={() => retryTerrain(n => n + 1)}>Retry terrain</button></>}
     {terrainState === 'ready' && <>
      <div className="legend-bar" style={{ background: `linear-gradient(90deg, ${ELEVATION_STOPS.map(([h, c]) => `${c} ${((h + 9000) / 19700) * 100}%`).join(', ')})` }} />
      <div className="legend-scale positioned"><span style={{ left: '0%' }}>−9 km</span><span style={{ left: '45.7%' }}>0</span><span style={{ left: '100%' }}>+10.7 km</span></div>
      <label>Relief exaggeration<select value={exaggeration} onChange={e => setExaggeration(Number(e.target.value))}>
       {EXAGGERATIONS.map(x => <option key={x} value={x}>×{x}{x === 1 ? ' (true scale)' : ''}</option>)}</select></label>
      <small>Heights relative to the 1737.4 km mean sphere · 16 px/deg (~1.9 km)</small>
     </>}
    </div>}
    {activeCoverage.map(layer => {
     const st = coverage[layer], kind = COVERAGE_KIND[layer];
     const spec = scaleFor(kind, coverageMode, st.meta?.max ?? null, equipment.panelEfficiencyPct);
     const title = layer === 'power' ? `Solar power · electrical at ${equipment.panelEfficiencyPct}% efficiency` : 'Earth communication (terrain-aware)';
     return <div className="layer-legend" key={layer}>
      <strong>{title} · {coverageMode === 'instant' ? 'now' : 'monthly average'}</strong>
      {st.status === 'loading' && <span>Computing… (the very first run builds the terrain-horizon cache and can take several minutes)</span>}
      {st.status === 'error' && <><span role="alert">{st.error}</span><button type="button" onClick={() => retryCoverage(n => n + 1)}>Retry map</button></>}
      {st.meta && <>
       <div className="legend-bar" style={{ background: spec.blockedBelowZero ? `linear-gradient(90deg, ${BLOCKED_COLOR} 0%, ${BLOCKED_COLOR} 18%, transparent 18%), ${cssGradient(spec.stops)}` : cssGradient(spec.stops) }} />
       <div className="legend-scale">{spec.blockedBelowZero ? <><span>Blocked</span><span>0°</span><span>≥{spec.max}°</span></> : <><span>{spec.min} {spec.unit}</span><span>{spec.max} {spec.unit}</span></>}</div>
       <small>{st.meta.label}. {coverageMode === 'monthly' ? `${st.meta.samples} samples, every ${Math.round((Date.parse(st.meta.end) - Date.parse(st.meta.start)) / 3600000 / Math.max(1, st.meta.samples - 1))} h. ` : ''}Global {st.meta.cellKm.toFixed(0)} km cells; 1.9 km south of 80°S.{playing && coverageMode === 'instant' ? ' Updates when paused.' : ''}</small>
      </>}
     </div>;
    })}
    {thermalOn && <div className="layer-legend">
     <strong>Surface temperature · measured</strong>
     <label>Show<select value={thermalProduct} onChange={e => setThermalProduct(e.target.value as ThermalProduct)}>
      <option value="daymax">Daytime maximum</option><option value="nightmin">Night-time minimum</option></select></label>
     {thermal.status === 'loading' && <span>Loading temperature…</span>}
     {thermal.status === 'error' && <><span role="alert">{thermal.error}</span><button type="button" onClick={() => retryThermal(n => n + 1)}>Retry temperature</button></>}
     <div className="legend-bar" style={{ background: cssGradient(thermalSpec().stops) }} />
     <div className="legend-scale"><span>{THERMAL_MIN_K} K</span><span>{(THERMAL_MIN_K + THERMAL_MAX_K) / 2} K</span><span>{THERMAL_MAX_K} K</span></div>
     {thermal.meta && <small>Measured cycle averages · {thermal.meta.cellKm} km resolution</small>}
    </div>}
    {psrOn && <div className="layer-legend">
     <strong>Permanent shadow</strong>
     {psr.status === 'loading' && <span>Loading PSR map…</span>}
     {psr.status === 'error' && <><span role="alert">{psr.error}</span><button type="button" onClick={() => retryPsr(n => n + 1)}>Retry shadow map</button></>}
     <div className="legend-bar" style={{ background: `linear-gradient(90deg, transparent 0%, ${PSR_COLOR}88 30%, ${PSR_COLOR} 100%)` }} />
     <div className="legend-scale"><span>Sunlit at times</span><span>Permanently shadowed</span></div>
     {psr.meta && <small>South of 75°S · opacity shows shadowed area</small>}
    </div>}
    {illuminationOn && <div className="layer-legend">
     <strong>Illumination · solar elevation</strong>
     <div className="legend-bar" style={{ background: 'linear-gradient(90deg, #0f1f6b 0%, #0f1f6b 12%, #fff1a0 12%, #fff1a0 14%, #f25914 14%, #ffc733 40%, #fffad9 100%)' }} />
     <div className="legend-scale positioned"><span style={{ left: '0%' }}>Night</span><span style={{ left: '13%' }}>0°</span><span style={{ left: '40%' }}>20°</span><span style={{ left: '100%' }}>90°</span></div>
     <small>Live for the viewed time · white lines every 10° · mean-sphere horizon, no terrain shadows</small>
    </div>}
   </div>}
   <div className="scene-legend" aria-hidden>
    <span><i className="ping" style={{ background: hex(MARKER_COLORS.historical) }} />Apollo</span><span><i className="ping" style={{ background: hex(MARKER_COLORS['clps-landed']) }} />CLPS landed</span><span><i className="ping" style={{ background: hex(MARKER_COLORS['clps-planned']) }} />CLPS planned (target region)</span>
    <span><i className="orbit" />Mercury / Venus / Earth / Mars orbits · Moon path</span><span><i className="sun" />Sun direction</span><span><i className="earth" />Earth direction</span><span><i className="horizon" />Local horizon</span>
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

  {equipmentBar}

  <MissionBar value={mission} onChange={setMission} />

  <section className="panel scene-readout" aria-live="polite">
   <div className="scene-readout-head">
    <h2>{location ? location.name : 'No site selected'}</h2>
    <span className="muted">{location ? fmtLatLon(location.latitudeDeg, location.longitudeDeg) : 'Click the Moon, a site ping, or enter coordinates.'}</span>
   </div>
   <div className="readout-grid">
    <article className={'metric metric-sun' + gradeClass(profile)}><span>Solar elevation</span>
     <strong>{sunAngles ? deg(sunAngles.elevationDeg) : '—'}</strong>
     <small>{sunAngles ? 'Azimuth ' + deg(sunAngles.azimuthDeg) + ' · ' : ''}{location ? event('sun', ['sunset', 'sunrise']) : 'Select a site'}</small>
     {location && terrainEvent('sun', ['sunset', 'sunrise']) && <small className="terrain-event">{terrainEvent('sun', ['sunset', 'sunrise'])}</small>}</article>
    <article className={'metric metric-earth' + gradeClass(profile)}><span>Earth elevation</span>
     <strong>{earthAngles ? deg(earthAngles.elevationDeg) : '—'}</strong>
     <small>{earthAngles ? 'Azimuth ' + deg(earthAngles.azimuthDeg) + ' · ' : ''}{location ? event('earth', ['Earthset', 'Earthrise']) : 'Select a site'}</small>
     {location && terrainEvent('earth', ['Earthset', 'Earthrise']) && <small className="terrain-event">{terrainEvent('earth', ['Earthset', 'Earthrise'])}</small>}</article>
    <article className={'metric' + gradeClass(profile)}><span>Ideal horizontal panel</span>
     <strong>{siteGeo && !playing ? siteGeo.power.horizontalPanelWm2.toFixed(0) + ' W/m²' : '—'}</strong>
     <small>{siteGeo ? `Solar flux ${siteGeo.power.solarFluxWm2.toFixed(0)} W/m²` : 'Needs a selected site'}</small></article>
    <article className={'metric' + gradeClass(profile)}><span>Sub-solar · sub-Earth point</span>
     <strong className="small-strong">{subSolar ? fmtLatLon(subSolar.lat, subSolar.lon) : '—'}</strong>
     <small>Sub-Earth {subEarth ? fmtLatLon(subEarth.lat, subEarth.lon) : '—'}</small></article>
    <article className={'metric' + gradeClass(profile, gradeMetric(profile, 'slope', siteGeo?.terrain?.regionalSlopeDeg).grade) + (siteGeo?.terrain ? '' : ' metric-unavailable')}><span>Terrain</span>
     <strong className="small-strong">{siteGeo?.terrain ? `Slope ${siteGeo.terrain.regionalSlopeDeg.toFixed(1)}°` : location ? 'Not available' : '—'}</strong>
     <small>{siteGeo?.terrain
      ? `Elevation ${(siteGeo.terrain.elevationM / 1000).toFixed(2)} km · slope over ~${siteGeo.terrain.baselineKm.toFixed(1)} km (lander-scale slopes can be steeper)`
      : 'Select a site to view terrain.'}</small><GradeBadge result={gradeMetric(profile, 'slope', siteGeo?.terrain?.regionalSlopeDeg)} /></article>
    <article className={'metric' + gradeClass(profile, gradeMetric(profile, 'dayMaxTemp', siteGeo?.thermal?.dayMaxK).grade)}><span>Temperature</span>
     <strong className="small-strong">{siteGeo?.thermal?.dayMaxK != null ? `${siteGeo.thermal.dayMaxK.toFixed(0)} K / ${siteGeo.thermal.nightMinK?.toFixed(0) ?? '—'} K` : location ? 'Not available' : '—'}</strong>
     <small>{siteGeo?.thermal ? 'Day maximum / night minimum · measured averages, not a forecast' : 'Select a site to view temperature.'}</small><GradeBadge result={gradeMetric(profile, 'dayMaxTemp', siteGeo?.thermal?.dayMaxK)} /></article>
    <article className={'metric' + (siteGeo?.terrain?.permanentlyShadowed ? ' metric-psr' : '') + gradeClass(profile)}><span>Permanent shadow</span>
     <strong className="small-strong">{siteGeo?.terrain?.permanentlyShadowed === true ? 'Yes · PSR' : siteGeo?.terrain?.permanentlyShadowed === false ? 'No' : location ? 'Outside map' : '—'}</strong>
     <small>{siteGeo?.terrain?.permanentlyShadowed == null ? 'Coverage: south of 75°S; unknown elsewhere' : 'Permanently shadowed terrain · 120 m resolution'}</small></article>
   </div>
   {siteError && <p role="alert">{siteError}</p>}
  </section>
  {location && <SiteCoveragePanel data={siteCoverage.data} loading={siteCoverage.loading} error={siteCoverage.error} equipment={equipment} missionProfile={profile} />}
 </div>;
}
