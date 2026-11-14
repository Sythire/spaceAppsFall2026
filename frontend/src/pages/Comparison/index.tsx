import {useCallback} from 'react';
import {useAppState} from '../../context/AppContext';
import {useAsync} from '../../hooks/useAsync';
import {analysisService} from '../../services/analysisService';
import {Panel} from '../../components/ui/Panel';
import {MockNotice,AsyncState} from '../../components/shared/AsyncState';
import {SitePicker} from '../../components/shared/SitePicker';
import {ScenarioControls} from '../../components/shared/ScenarioControls';
import type {AnalysisResult} from '../../types';
import {TerrainComparison} from '../../components/shared/TerrainComparison';

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
 const {selectedSites,utc,durationHours,stepHours,toggleSite}=useAppState();
 const load=useCallback(()=>selectedSites.length>=2?analysisService.compare(selectedSites.map(location=>({location,utc,durationHours,stepHours}))):Promise.resolve(null),[selectedSites,utc,durationHours,stepHours]);
 const resource=useAsync(load);
 return <>
  {!embedded&&<MockNotice/>}
  {!embedded&&<div className="page-heading"><h2>Compare landing scenarios</h2><p>Select two or three locations to compare the same UTC start and analysis interval.</p></div>}
  {!embedded&&<Panel title="Choose comparison sites"><SitePicker/></Panel>}
  <Panel title={`Selected sites · ${selectedSites.length} / 3`}>
   {!embedded&&<ScenarioControls/>}
   <div className="button-row">{selectedSites.map(site=><button key={site.id} onClick={()=>toggleSite(site)} aria-label={`Remove ${site.name} from comparison`}>{site.name} ×</button>)}</div>
   <AsyncState {...resource}/>
   {selectedSites.length<2&&<p className="muted">Add at least two sites using “Compare +” above or from Site Analysis.</p>}
   {resource.data&&<><p className="muted">{resource.data.results[0].interval?.startUtc} · {durationHours/24} days · {resource.data.results[0].mode} results</p><div className="table-scroll"><table>
    <thead><tr><th>Metric</th>{resource.data.results.map(r=><th key={r.request.location.id}>{r.request.location.name}</th>)}</tr></thead>
    <tbody>{rows.map(row=><tr key={row.label}><th>{row.label}</th>{resource.data!.results.map(r=><td key={r.request.location.id}>{row.value(r)}</td>)}</tr>)}</tbody>
   </table></div><p className="muted">Percentages describe each full analysis interval. This table uses a smooth Moon; the terrain-aware table below includes shadows. Ground-station contacts and radio link budgets are not included.</p></>}
   <TerrainComparison sites={selectedSites} utc={utc} days={durationHours/24}/>
  </Panel>
 </>;
}
