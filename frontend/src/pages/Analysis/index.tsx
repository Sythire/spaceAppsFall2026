import {useCallback,useEffect} from 'react';
import {useAppState} from '../../context/AppContext';
import {useAsync} from '../../hooks/useAsync';
import {analysisService} from '../../services/analysisService';
import {Panel,Metric} from '../../components/ui/Panel';
import {MockNotice,AsyncState} from '../../components/shared/AsyncState';
import {SitePicker} from '../../components/shared/SitePicker';
import {TimelineChart} from '../../components/shared/TimelineChart';

export default function Analysis(){
 const {location,selectedSites,utc,setAnalysis}=useAppState();
 const load=useCallback(()=>location?analysisService.analyze({location,utc}):Promise.resolve(null),[location,utc]);
 const resource=useAsync(load);
 const loadComparison=useCallback(()=>selectedSites.length>=2?analysisService.compare(selectedSites.map(site=>({location:site,utc}))):Promise.resolve(null),[selectedSites,utc]);
 const comparison=useAsync(loadComparison);
 useEffect(()=>{setAnalysis(resource.data??null);},[resource.data,setAnalysis]);
 return <><MockNotice/><div className="page-heading"><span className="eyebrow">SITE RESEARCH · DECISION WORKSPACE</span><h2>Compare the conditions at each site.</h2><p>Choose a candidate, inspect the scenario, then compare up to three locations. Simulated outputs are clearly labeled.</p></div>
  <section className="research-step"><div className="section-heading"><div><span className="eyebrow">01 · CHOOSE A LOCATION</span><h2>Candidate landing sites</h2></div><span className="research-hint">Use the UTC scenario time in the header</span></div><SitePicker/></section>
  <section className="research-step"><div className="section-heading"><div><span className="eyebrow">02 · REVIEW CONDITIONS</span><h2>{location?location.name:'Landing site analysis'}</h2></div>{location&&<span className="research-hint">{Math.abs(location.latitudeDeg).toFixed(2)}° {location.latitudeDeg<0?'S':'N'} · {Math.abs(location.longitudeDeg).toFixed(2)}° {location.longitudeDeg<0?'W':'E'}</span>}</div>
   <Panel title="Scenario readout"><AsyncState {...resource}/>{!location&&<p className="empty-state">Select a candidate above or enter coordinates in Lunar Explorer to prepare a scenario.</p>}{resource.data&&<><p className="muted source-label">{resource.data.source} · {resource.data.request.utc}</p><div className="metrics-grid"><Metric label="Sun elevation" value={resource.data.sun.elevationDeg+'°'} note={resource.data.mode}/><Metric label="Earth elevation" value={resource.data.earth.elevationDeg+'°'} note={resource.data.mode}/><Metric label="PSR / temperature" value="Unknown" note="Products not loaded"/></div><div className="two-column"><Panel title="Sunlight availability · simulated"><TimelineChart data={resource.data.illumination.timeline} metric="sunlightPercent"/></Panel><Panel title="Earth visibility · simulated"><TimelineChart data={resource.data.illumination.timeline} metric="earthVisibilityPercent"/></Panel></div></>}</Panel>
  </section>
  <section className="research-step"><div className="section-heading"><div><span className="eyebrow">03 · WEIGH OPTIONS</span><h2>Compare landing sites</h2></div><span className="compare-count">{selectedSites.length} <i>/</i> 3 selected</span></div><Panel title="Side-by-side comparison"><p className="muted">Choose two or three sites above. The displayed comparison values are simulated.</p><AsyncState {...comparison}/>{selectedSites.length<2&&<p className="empty-state">Add at least two candidates using “Compare +” to build your comparison.</p>}{comparison.data&&<div className="table-scroll"><table><thead><tr><th>Metric</th>{comparison.data.results.map(r=><th key={r.request.location.id}>{r.request.location.name}</th>)}</tr></thead><tbody>{['Sunlight availability','Earth visibility','Terrain slope','Overall suitability'].map((label,i)=><tr key={label}><th>{label}</th>{comparison.data!.results.map(r=><td key={r.request.location.id}>{[r.illumination.sunlightPercent+'%',r.earthVisibilityPercent+'%',r.terrain.slopeDeg===null?'Unknown':r.terrain.slopeDeg+'°',r.suitability??'Not evaluated'][i]}</td>)}</tr>)}</tbody></table></div>}</Panel>
  </section>
 </>;
}
