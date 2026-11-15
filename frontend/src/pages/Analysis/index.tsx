import {useCallback,useEffect,useState} from 'react';
import {Link} from 'react-router';
import {useAppState} from '../../context/AppContext';
import {useAsync} from '../../hooks/useAsync';
import {analysisService} from '../../services/analysisService';
import {Panel,Metric} from '../../components/ui/Panel';
import {MockNotice,AsyncState} from '../../components/shared/AsyncState';
import {LocationSelect} from '../../components/shared/LocationSelect';
import {ScenarioControls} from '../../components/shared/ScenarioControls';
import {TimelineChart} from '../../components/shared/TimelineChart';
import {VisibilityWindows} from '../../components/shared/VisibilityWindows';

export default function Analysis(){
 const [methodsOpen,setMethodsOpen]=useState(false);
 const {location,utc,durationHours,stepHours,setAnalysis,selectedSites,toggleSite}=useAppState();
 const load=useCallback(()=>location?analysisService.analyze({location,utc,durationHours,stepHours}):Promise.resolve(null),[location,utc,durationHours,stepHours]);
 const resource=useAsync(load);
 useEffect(()=>{setAnalysis(resource.data??null);},[resource.data,setAnalysis]);
 const result=resource.data;
 const simulated=result?.mode==='simulated';
 const comparing=location&&selectedSites.some(s=>s.id===location.id);
 return <div className="analysis-page">
  <div className="page-heading"><span className="eyebrow">Site analysis</span><h1>Read the light.</h1><p>Daylight, darkness, and the view of Earth. A closer look at your chosen site.</p></div>
  <section className="panel scenario-setup" aria-label="Analysis scenario">
   <LocationSelect/><ScenarioControls/>
   <p className="muted">Results update automatically. <Link to="/explorer">Choose custom coordinates in the explorer →</Link></p>
  </section>
  <MockNotice/>
  <AsyncState {...resource}/>
  {!location&&<div className="empty-state"><h2>Choose a location to see its conditions.</h2><p>Start with a historical landing, a planned region, or the hypothetical south-pole test point.</p></div>}
  {result&&<>
   <div className="section-heading"><div><span className="eyebrow">ACROSS THE FULL INTERVAL</span><h2>{durationHours/24} days at {location?.name}</h2></div></div>
   {result.interval&&<p className="interval-caption">{result.interval.startUtc.replace('T',' ').replace('.000Z',' UTC').replace(/Z$/,' UTC')} → {result.interval.endUtc.replace('T',' ').replace('.000Z',' UTC').replace(/Z$/,' UTC')}</p>}
   <p className="science-note">A smooth-horizon estimate. Local terrain may change these conditions. <a href="#analysis-methods" onClick={()=>setMethodsOpen(true)}>How this is calculated ↗</a></p>
   <div className="metrics-grid interval-metrics">
    <Metric label="Daylight" value={result.illumination.daylightHours===undefined?'Unavailable':result.illumination.daylightHours.toFixed(1)+' h'} note={result.illumination.sunlightPercent.toFixed(1)+'% of interval · Sun center above horizon'}/>
    <Metric label="Darkness" value={result.illumination.darknessHours===undefined?'Unavailable':result.illumination.darknessHours.toFixed(1)+' h'} note="Sun center below the smooth horizon"/>
    <Metric label="Earth visibility" value={result.earthVisibility?.aboveHorizonHours===undefined?result.earthVisibilityPercent.toFixed(1)+'%':result.earthVisibility.aboveHorizonHours.toFixed(1)+' h'} note={result.earthVisibilityPercent.toFixed(1)+'% of interval · geometry only'}/>
   </div>
   <section className="instant-section"><div><span className="eyebrow">AT THE STARTING INSTANT</span><h2>Where are the Sun and Earth?</h2><p className="muted">Elevation is the angle above the horizon. A negative angle means below it.</p></div><div className="metrics-grid instant-metrics">
    <Metric label="Sun elevation at start" value={result.sun.elevationDeg.toFixed(2)+'°'} note={'Azimuth '+result.sun.azimuthDeg.toFixed(2)+'° clockwise from north'}/>
    <Metric label="Earth elevation at start" value={result.earth.elevationDeg.toFixed(2)+'°'} note={'Azimuth '+result.earth.azimuthDeg.toFixed(2)+'° clockwise from north'}/>
   </div></section>
   <div className="two-column">
    <Panel title={simulated?'Sunlight · simulated':'When is the Sun above the horizon?'}><p className="muted">Sun elevation (°) by hours from start. The dashed line marks 0°.</p><TimelineChart data={result.illumination.timeline} metric={simulated?'sunlightPercent':'sunElevationDeg'} simulated={simulated}/></Panel>
    <Panel title={simulated?'Earth visibility · simulated':'When is Earth above the horizon?'}><p className="muted">Earth elevation (°) by hours from start. Visibility is not a radio-link prediction.</p><TimelineChart data={result.illumination.timeline} metric={simulated?'earthVisibilityPercent':'earthElevationDeg'} simulated={simulated}/></Panel>
   </div>
   <details className="disclosure"><summary>Daylight & Earth visibility windows</summary>
    {result.illumination.visibleWindows&&<Panel title="Daylight windows"><VisibilityWindows windows={result.illumination.visibleWindows} label="Daylight windows"/></Panel>}
    {result.earthVisibility&&<Panel title="Direct-to-Earth visibility windows"><VisibilityWindows windows={result.earthVisibility.visibleWindows} label="Earth visibility windows"/></Panel>}
   </details>
   <details id="analysis-methods" className="disclosure" open={methodsOpen} onToggle={e=>setMethodsOpen(e.currentTarget.open)}><summary>Sources, methods & limitations</summary><p>{result.source}</p>
    <p>These totals exclude terrain shadows and eclipses. Earth visibility describes line of sight, not a radio-link budget. Terrain-aware detail is available in the explorer.</p>
    {result.interval&&<p>{result.interval.sampleCount} chart samples. Sampled curves can miss brief horizon crossings.</p>}
    {result.metadata&&<><p>{result.metadata.horizonMethod}</p><ul>{result.metadata.limitations.map(note=><li key={note}>{note}</li>)}</ul><p>Frame: {result.metadata.provenance.frameRealization}</p><ul>{result.metadata.provenance.kernels.map(k=><li key={k.file}><a href={k.url}>{k.file}</a></li>)}</ul></>}
   </details>
  </>}
  {location&&<section className="next-step"><div><h2>How does another site compare?</h2><p className="muted">Compare up to three locations using this same date and duration.</p></div><div className="button-row">
   <button type="button" aria-pressed={!!comparing} disabled={selectedSites.length===3&&!comparing} onClick={()=>toggleSite(location)}>{comparing?'Remove from comparison':'Add this site to comparison'}</button>
   <Link className="primary-action" to="/comparison">Compare sites ({selectedSites.length}/3) →</Link>
  </div></section>}
 </div>;
}
