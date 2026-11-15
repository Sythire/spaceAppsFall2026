import {useCallback,useState} from 'react';
import {Link} from 'react-router';
import {useAppState} from '../../context/AppContext';
import {useAsync} from '../../hooks/useAsync';
import {analysisService} from '../../services/analysisService';
import {MockNotice,AsyncState} from '../../components/shared/AsyncState';
import {SitePicker} from '../../components/shared/SitePicker';
import {ScenarioControls} from '../../components/shared/ScenarioControls';
import {siteKind} from '../../components/shared/LocationSelect';
import type {AnalysisResult} from '../../types';
import {TerrainComparison} from '../../components/shared/TerrainComparison';

const rows: {label:string;value:(r:AnalysisResult)=>string}[] = [
 {label:'Daylight · full interval',value:r=>r.illumination.daylightHours===undefined?'Unavailable':r.illumination.daylightHours.toFixed(1)+' h'},
 {label:'Darkness · full interval',value:r=>r.illumination.darknessHours===undefined?'Unavailable':r.illumination.darknessHours.toFixed(1)+' h'},
 {label:'Sunlight · % of interval',value:r=>r.illumination.sunlightPercent.toFixed(1)+'%'},
 {label:'Earth visible · % of interval',value:r=>r.earthVisibilityPercent.toFixed(1)+'%'},
 {label:'Sun elevation · start',value:r=>r.sun.elevationDeg.toFixed(2)+'°'},
 {label:'Earth elevation · start',value:r=>r.earth.elevationDeg.toFixed(2)+'°'},
];
export default function Comparison({embedded=false}:{embedded?:boolean}){
 const [terrainOpen,setTerrainOpen]=useState(false);
 const {selectedSites,utc,durationHours,stepHours,toggleSite,location,setLocation}=useAppState();
 const load=useCallback(()=>selectedSites.length>=2?analysisService.compare(selectedSites.map(location=>({location,utc,durationHours,stepHours}))):Promise.resolve(null),[selectedSites,utc,durationHours,stepHours]);
 const resource=useAsync(load);
 return <div className="comparison-page">
  {!embedded&&<div className="page-heading"><h2>Put your options side by side.</h2><p>Choose two or three sites. Every column uses the same UTC start and duration.</p></div>}
  <section className="panel">
   <div className="section-heading"><h2>Your comparison · {selectedSites.length} of 3 sites</h2><Link to="/analysis">Back to analysis →</Link></div>
   <div className="comparison-slots">{selectedSites.map(site=><article className="comparison-slot" key={site.id}><span className="site-kind">{siteKind(site)}</span><h3>{site.name}</h3><button className="text-action" onClick={()=>toggleSite(site)} aria-label={`Remove ${site.name} from comparison`}>Remove ×</button></article>)}
    {selectedSites.length<3&&<a className="empty-slot" href="#comparison-catalog">+ Add a location</a>}
   </div>
   {location&&!selectedSites.some(s=>s.id===location.id)&&selectedSites.length<3&&<button onClick={()=>toggleSite(location)}>Add current location: {location.name}</button>}
   {!embedded&&<ScenarioControls/>}
   {selectedSites.length<2&&<p className="empty-hint">Add {2-selectedSites.length} more {selectedSites.length===0?'locations':'location'} below to calculate a comparison.</p>}
  </section>
  {!embedded&&<MockNotice/>}
  <AsyncState {...resource}/>
  {resource.data&&<>
   <section className="panel"><h2>Lighting & visibility · {durationHours/24}-day interval</h2><p className="muted">Starting {utc.replace('T',' ').replace(/Z$/,' UTC')} · {resource.data.results[0].mode} results</p>
    <div className="table-scroll" role="region" aria-label="Scenario comparison results" tabIndex={0}><table className="comparison-table"><caption className="sr-only">Lighting and Earth visibility for the same interval at each selected site</caption>
     <thead><tr><th scope="col">Conditions</th>{resource.data.results.map(r=><th scope="col" key={r.request.location.id}>{r.request.location.name}<small>{siteKind(r.request.location)}</small><Link to="/analysis" onClick={()=>setLocation(r.request.location)}>View analysis →</Link></th>)}</tr></thead>
     <tbody>{rows.map(row=><tr key={row.label}><th scope="row">{row.label}</th>{resource.data!.results.map(r=><td key={r.request.location.id}>{row.value(r)}</td>)}</tr>)}</tbody>
    </table></div>
    <p className="science-note">Smooth lunar horizon; terrain shadows and eclipses are not included. Earth visibility does not guarantee ground-station contact or a usable radio link.</p>
   </section>
   <details className="disclosure" onToggle={e=>setTerrainOpen(e.currentTarget.open)}><summary>Terrain-aware comparison & additional metrics</summary>
    <div className="table-scroll" tabIndex={0} role="region" aria-label="Additional site metrics"><table><thead><tr><th>Metric</th>{resource.data.results.map(r=><th key={r.request.location.id}>{r.request.location.name}</th>)}</tr></thead><tbody>
     <tr><th>Terrain slope</th>{resource.data.results.map(r=><td key={r.request.location.id}>{r.terrain.slopeDeg===null?'Unknown':r.terrain.slopeDeg.toFixed(1)+'°'}</td>)}</tr>
     <tr><th>Suitability</th>{resource.data.results.map(r=><td key={r.request.location.id}>{r.suitability??'Not evaluated'}</td>)}</tr>
    </tbody></table></div>
    {terrainOpen&&<TerrainComparison sites={selectedSites} utc={utc} days={durationHours/24}/>}
   </details>
  </>}
  <section id="comparison-catalog" className="catalog-section"><h2>Add a location</h2><p className="muted">Historical landings, planned regions and hypothetical points are labeled separately.</p><SitePicker comparisonOnly/></section>
 </div>;
}
