import {useCallback,useMemo} from 'react';
import {useAppState} from '../../context/AppContext';
import {useAsync} from '../../hooks/useAsync';
import {analysisService} from '../../services/analysisService';
import {Panel} from '../../components/ui/Panel';
import {MockNotice,AsyncState} from '../../components/shared/AsyncState';
import {SitePicker} from '../../components/shared/SitePicker';
import {ScenarioControls} from '../../components/shared/ScenarioControls';
import type {AnalysisResult} from '../../types';
import {TerrainComparison} from '../../components/shared/TerrainComparison';
import {ComparisonVisuals} from '../../components/shared/ComparisonVisuals';

const rows: {label:string;value:(r:AnalysisResult)=>string}[] = [
 {label:'Sun elevation at start',value:r=>r.sun.elevationDeg.toFixed(2)+'°'},
 {label:'Earth elevation at start',value:r=>r.earth.elevationDeg.toFixed(2)+'°'},
 {label:'Daylight',value:r=>r.illumination.daylightHours===undefined?'Unavailable':r.illumination.daylightHours.toFixed(1)+' h'},
 {label:'Darkness',value:r=>r.illumination.darknessHours===undefined?'Unavailable':r.illumination.darknessHours.toFixed(1)+' h'},
 {label:'Sunlight availability',value:r=>r.illumination.sunlightPercent.toFixed(1)+'%'},
 {label:'Earth visibility',value:r=>r.earthVisibilityPercent.toFixed(1)+'%'},
 {label:'Terrain slope',value:r=>r.terrain.slopeDeg===null?'Unknown':r.terrain.slopeDeg.toFixed(1)+'°'},
 {label:'Suitability',value:r=>r.suitability??'Not evaluated'},
];
export default function Comparison({embedded=false}:{embedded?:boolean}){
 const {selectedSites,location,utc,durationHours,stepHours,toggleSite}=useAppState();
 // Modules to show: the ones explicitly added with "+"; if none were added but a module is being
 // analysed, fall back to that single module so one selection still shows its data. Capped at 3.
 const compareSites=useMemo(()=>(selectedSites.length>0?selectedSites:location?[location]:[]).slice(0,3),[selectedSites,location]);
 const load=useCallback(()=>compareSites.length>=1?analysisService.compare(compareSites.map(loc=>({location:loc,utc,durationHours,stepHours}))):Promise.resolve(null),[compareSites,utc,durationHours,stepHours]);
 const resource=useAsync(load);
 return <>
  {!embedded&&<MockNotice/>}
  {!embedded&&<div className="page-heading"><h2>Compare landing scenarios</h2><p>Select up to three modules. One shows its own analysis; two or three are compared over the same UTC start and interval.</p></div>}
  {!embedded&&<Panel title="Choose comparison sites"><SitePicker layout="dropdown"/></Panel>}
  <Panel title={`Selected sites · ${compareSites.length} / 3`}>
   {!embedded&&<ScenarioControls/>}
   <div className="button-row">{selectedSites.map(site=><button key={site.id} onClick={()=>toggleSite(site)} aria-label={`Remove ${site.name} from comparison`}>{site.name} ×</button>)}</div>
   <AsyncState {...resource}/>
   {compareSites.length===0&&<p className="muted">Choose a module to analyse, or add sites with the + button above or from Site Research.</p>}
   {compareSites.length===1&&selectedSites.length<2&&<p className="muted">Showing a single module. Add another site with the + button to compare them side by side.</p>}
   {resource.data&&<><p className="muted">{resource.data.results[0].interval?.startUtc} · {durationHours/24} days · {resource.data.results[0].mode} results</p><div className="table-scroll"><table>
    <thead><tr><th>Metric</th>{resource.data.results.map(r=><th key={r.request.location.id}>{r.request.location.name}</th>)}</tr></thead>
    <tbody>{rows.map(row=><tr key={row.label}><th>{row.label}</th>{resource.data!.results.map(r=><td key={r.request.location.id}>{row.value(r)}</td>)}</tr>)}</tbody>
   </table></div><p className="muted">Percentages describe each full analysis interval. This table uses a smooth Moon; the terrain-aware table below includes shadows. Ground-station contacts and radio link budgets are not included.</p></>}
   {resource.data&&resource.data.results.length>=1&&<ComparisonVisuals results={resource.data.results} order={compareSites.map(s=>s.id)}/>}
   <TerrainComparison sites={compareSites} utc={utc} days={durationHours/24}/>
  </Panel>
 </>;
}
