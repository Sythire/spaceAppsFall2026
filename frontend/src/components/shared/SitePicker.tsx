import {siteService} from '../../services/siteService';
import {useAsync} from '../../hooks/useAsync';
import {useAppState} from '../../context/AppContext';
import {AsyncState} from './AsyncState';
export function SitePicker(){const state=useAppState();const resource=useAsync(siteService.getSites);return <><AsyncState {...resource} empty={resource.data?.length===0}/><div className="site-grid">{resource.data?.map(site=><article className="panel" key={site.id}><span className="tag">SIMULATED CANDIDATE</span><h3>{site.name}</h3><p>{site.latitudeDeg}° N · {site.longitudeDeg}° E</p><div className="button-row"><button className={state.location?.id===site.id?'active':''} onClick={()=>state.setLocation(site)}>{state.location?.id===site.id?'Selected':'Select site'}</button><button aria-pressed={state.selectedSites.some(s=>s.id===site.id)} disabled={state.selectedSites.length===3&&!state.selectedSites.some(s=>s.id===site.id)} onClick={()=>state.toggleSite(site)}>{state.selectedSites.some(s=>s.id===site.id)?'Remove comparison':'Compare +'}</button></div></article>)}</div></>;}

