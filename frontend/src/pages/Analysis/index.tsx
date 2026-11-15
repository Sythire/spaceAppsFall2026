import {useCallback,useEffect} from 'react';
import {Link} from 'react-router';
import {useAppState} from '../../context/AppContext';
import {useAsync} from '../../hooks/useAsync';
import {analysisService} from '../../services/analysisService';
import {Panel,Metric} from '../../components/ui/Panel';
import {AsyncState} from '../../components/shared/AsyncState';
import {SitePicker} from '../../components/shared/SitePicker';
import {ScenarioControls} from '../../components/shared/ScenarioControls';
import {TimelineChart} from '../../components/shared/TimelineChart';
import {VisibilityWindows} from '../../components/shared/VisibilityWindows';
import Comparison from '../Comparison';

export default function Analysis(){
 const {location,utc,durationHours,stepHours,setAnalysis,selectedSites}=useAppState();
 const load=useCallback(()=>location?analysisService.analyze({location,utc,durationHours,stepHours}):Promise.resolve(null),[location,utc,durationHours,stepHours]);
 const resource=useAsync(load);
 useEffect(()=>{setAnalysis(resource.data??null);},[resource.data,setAnalysis]);
 const result=resource.data;
 const simulated=result?.mode==='simulated';
 return <>
  <div className="page-heading"><span className="eyebrow">LANDING-SITE CONDITIONS</span><h2>Understand your landing site.</h2><p>Choose a location and time to compare sunlight, terrain and Earth visibility.</p></div>
  <Panel title="Choose a location"><SitePicker layout="dropdown"/><p className="muted">For a custom site, choose a point in the <Link to="/explorer">Lunar Explorer</Link>, then return here.</p></Panel>
  <Panel title={location?`Scenario · ${location.name}`:'Scenario'}>
   <ScenarioControls/>
   {location&&<p className="muted">{location.latitudeDeg}° N / {location.longitudeDeg}° E</p>}
   {location&&<div className="button-row"><Link to="/comparison">Open full comparison →</Link>{selectedSites.length>=2&&<span className="muted">Comparing {selectedSites.length} sites below.</span>}</div>}
   <AsyncState {...resource}/>
   {!location&&<p className="muted">Choose a site to see its conditions.</p>}
   {result&&<>
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
   </>}
  </Panel>
  {selectedSites.length>=2&&<section className="research-step"><div className="section-heading"><div><span className="eyebrow">SIDE BY SIDE</span><h2>Compare landing sites</h2></div></div><Comparison embedded/></section>}
 </>;
}
