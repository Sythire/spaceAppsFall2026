import {useCallback} from 'react';
import {useAppState} from '../../context/AppContext';
import {useAsync} from '../../hooks/useAsync';
import {analysisService} from '../../services/analysisService';
import {Panel} from '../../components/ui/Panel';
import {MockNotice,AsyncState} from '../../components/shared/AsyncState';
import {SitePicker} from '../../components/shared/SitePicker';
export default function Comparison(){const {selectedSites,utc}=useAppState();const load=useCallback(()=>selectedSites.length>=2?analysisService.compare(selectedSites.map(location=>({location,utc}))):Promise.resolve(null),[selectedSites,utc]);const resource=useAsync(load);return <><MockNotice/><div className="page-heading"><h2>Compare landing scenarios</h2><p>Select two or three locations. All values below are simulated.</p></div><SitePicker/><Panel title={'Selected sites · '+selectedSites.length+' / 3'}><AsyncState {...resource}/>{selectedSites.length<2&&<p className="muted">Add at least two sites using “Compare +” above.</p>}{resource.data&&<div className="table-scroll"><table><thead><tr><th>Metric</th>{resource.data.results.map(r=><th key={r.request.location.id}>{r.request.location.name}</th>)}</tr></thead><tbody>{['Sunlight availability','Earth visibility','Terrain slope','Overall suitability'].map((label,i)=><tr key={label}><th>{label}</th>{resource.data!.results.map(r=><td key={r.request.location.id}>{[r.illumination.sunlightPercent+'%',r.earthVisibilityPercent+'%',r.terrain.slopeDeg===null?'Unknown':r.terrain.slopeDeg+'°',r.suitability??'Not evaluated'][i]}</td>)}</tr>)}</tbody></table></div>}</Panel></>;}

