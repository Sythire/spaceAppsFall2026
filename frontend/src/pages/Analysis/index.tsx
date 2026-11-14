import {useCallback,useEffect} from 'react';
import {Link} from 'react-router';
import {useAppState} from '../../context/AppContext';
import {useAsync} from '../../hooks/useAsync';
import {analysisService} from '../../services/analysisService';
import {Panel,Metric} from '../../components/ui/Panel';
import {MockNotice,AsyncState} from '../../components/shared/AsyncState';
import {SitePicker} from '../../components/shared/SitePicker';
import {ScenarioControls} from '../../components/shared/ScenarioControls';
import {TimelineChart} from '../../components/shared/TimelineChart';
import {VisibilityWindows} from '../../components/shared/VisibilityWindows';
import Comparison from '../Comparison';

export default function Analysis(){
 const {location,utc,durationHours,stepHours,setAnalysis,selectedSites,toggleSite}=useAppState();
 const load=useCallback(()=>location?analysisService.analyze({location,utc,durationHours,stepHours}):Promise.resolve(null),[location,utc,durationHours,stepHours]);
 const resource=useAsync(load);
 useEffect(()=>{setAnalysis(resource.data??null);},[resource.data,setAnalysis]);
 const result=resource.data;
 const simulated=result?.mode==='simulated';
 return <>
  <MockNotice/>
  <div className="page-heading"><span className="eyebrow">SITE RESEARCH · DECISION WORKSPACE</span><h2>Compare the conditions at each site.</h2><p>Choose a site, UTC start and duration to evaluate lighting and Earth visibility.</p></div>
  <Panel title="Choose a location"><SitePicker/><p className="muted">For custom coordinates, select a point in the <Link to="/explorer">Lunar Explorer</Link>, then return here.</p></Panel>
  <Panel title={location?`Scenario · ${location.name}`:'Scenario'}>
   <ScenarioControls/>
   {location&&<p className="muted">{location.latitudeDeg}° N / {location.longitudeDeg}° E · MOON_ME</p>}
   {location&&<div className="button-row"><button type="button" aria-pressed={selectedSites.some(s=>s.id===location.id)} disabled={selectedSites.length===3&&!selectedSites.some(s=>s.id===location.id)} onClick={()=>toggleSite(location)}>{selectedSites.some(s=>s.id===location.id)?'Remove from comparison':'Add selected location to comparison'}</button><Link to="/comparison">Compare sites →</Link></div>}
   <AsyncState {...resource}/>
   {!location&&<p className="muted">Select a site above to calculate results.</p>}
   {result&&<>
    <p className="muted">{result.source}</p>
    {result.interval&&<p className="muted">{result.interval.startUtc} → {result.interval.endUtc} · {result.interval.sampleCount} chart samples</p>}
    <div className="metrics-grid">
     <Metric label="Sun elevation at start" value={result.sun.elevationDeg.toFixed(2)+'°'} note={'Azimuth '+result.sun.azimuthDeg.toFixed(2)+'° clockwise from north'}/>
     <Metric label="Earth elevation at start" value={result.earth.elevationDeg.toFixed(2)+'°'} note={'Azimuth '+result.earth.azimuthDeg.toFixed(2)+'° clockwise from north'}/>
     <Metric label="Sunlight availability" value={result.illumination.sunlightPercent.toFixed(1)+'%'} note={simulated?'Simulated fixture':'Fraction of interval above smooth horizon'}/>
     <Metric label="Daylight" value={result.illumination.daylightHours===undefined?'Unavailable':result.illumination.daylightHours.toFixed(1)+' h'} note="Sun center above horizon"/>
     <Metric label="Darkness" value={result.illumination.darknessHours===undefined?'Unavailable':result.illumination.darknessHours.toFixed(1)+' h'} note="Sun center below horizon"/>
     <Metric label="Earth visibility" value={result.earthVisibility?.aboveHorizonHours===undefined?result.earthVisibilityPercent.toFixed(1)+'%':result.earthVisibility.aboveHorizonHours.toFixed(1)+' h'} note={simulated?'Simulated fixture':result.earthVisibilityPercent.toFixed(1)+'% of interval · geometry only'}/>
    </div>
    <p className="muted">{simulated?'Chart values are fixed demo fixtures.':'Elevation above 0° is above the smooth horizon. Sampled curves may miss brief crossings; terrain shadowing and eclipses are not modeled.'}</p>
    <div className="two-column">
     <Panel title={simulated?'Sunlight · simulated':'Sun elevation over time'}><TimelineChart data={result.illumination.timeline} metric={simulated?'sunlightPercent':'sunElevationDeg'} simulated={simulated}/></Panel>
     <Panel title={simulated?'Earth visibility · simulated':'Earth elevation over time'}><TimelineChart data={result.illumination.timeline} metric={simulated?'earthVisibilityPercent':'earthElevationDeg'} simulated={simulated}/></Panel>
    </div>
    {result.illumination.visibleWindows&&<Panel title="Daylight windows"><VisibilityWindows windows={result.illumination.visibleWindows} label="Daylight windows"/></Panel>}
    {result.earthVisibility&&<Panel title="Direct-to-Earth visibility windows"><VisibilityWindows windows={result.earthVisibility.visibleWindows} label="Earth visibility windows"/><p className="muted">Earth-center visibility does not guarantee contact with a ground station or a usable radio link.</p></Panel>}
    {result.metadata&&<details><summary>Sources, methods and limitations</summary><p className="muted">{result.metadata.horizonMethod}</p><ul>{result.metadata.limitations.map(note=><li key={note}>{note}</li>)}</ul><p className="muted">Frame: {result.metadata.provenance.frameRealization}</p><ul>{result.metadata.provenance.kernels.map(k=><li key={k.file}><a href={k.url}>{k.file}</a></li>)}</ul></details>}
   </>}
  </Panel>
  <section className="research-step"><div className="section-heading"><div><span className="eyebrow">WEIGH OPTIONS</span><h2>Compare landing sites</h2></div></div><Comparison embedded/></section>
 </>;
}
