import {useCallback} from 'react';
import {useAppState} from '../../context/AppContext';
import {useAsync} from '../../hooks/useAsync';
import {analysisService} from '../../services/analysisService';
import {Panel,Metric} from '../../components/ui/Panel';
import {MockNotice,AsyncState} from '../../components/shared/AsyncState';
import {SitePicker} from '../../components/shared/SitePicker';
import {DateSelector} from '../../components/shared/DateSelector';
import {TimelineChart} from '../../components/shared/TimelineChart';
import {useEffect} from 'react';
export default function Analysis(){const {location,utc,setAnalysis}=useAppState();const load=useCallback(()=>location?analysisService.analyze({location,utc}):Promise.resolve(null),[location,utc]);const resource=useAsync(load);useEffect(()=>{setAnalysis(resource.data??null);},[resource.data,setAnalysis]);return <><MockNotice/><div className="page-heading"><h2>Site Analysis</h2><p>{location?location.name+' · '+location.latitudeDeg+'° N / '+location.longitudeDeg+'° E':'Choose a candidate to begin.'}</p></div><SitePicker/><Panel title="Scenario"><DateSelector/><AsyncState {...resource}/>{!location&&<p className="muted">No selected location. Select a candidate or enter coordinates in Lunar Explorer.</p>}{resource.data&&<><p className="muted">{resource.data.source} · {resource.data.request.utc}</p><div className="metrics-grid"><Metric label="Sun elevation" value={resource.data.sun.elevationDeg+'°'} note={resource.data.mode}/><Metric label="Earth elevation" value={resource.data.earth.elevationDeg+'°'} note={resource.data.mode}/><Metric label="PSR / temperature" value="Unknown" note="Products not loaded"/></div><div className="two-column"><Panel title="Sunlight availability · simulated"><TimelineChart data={resource.data.illumination.timeline} metric="sunlightPercent"/></Panel><Panel title="Earth visibility · simulated"><TimelineChart data={resource.data.illumination.timeline} metric="earthVisibilityPercent"/></Panel></div></>}</Panel></>;}

