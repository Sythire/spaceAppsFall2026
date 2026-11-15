import {useState} from 'react';
import {siteService} from '../../services/siteService';
import {useAsync} from '../../hooks/useAsync';
import {useAppState} from '../../context/AppContext';
import {AsyncState} from './AsyncState';
import {isMockMode} from '../../services/apiClient';
import {coordinates,siteKind} from './LocationSelect';

export function SitePicker({comparisonOnly=false}:{comparisonOnly?:boolean}){
 const state=useAppState();const resource=useAsync(siteService.getSites);const [query,setQuery]=useState('');
 const sites=resource.data?.filter(site=>(site.name+' '+siteKind(site)).toLowerCase().includes(query.trim().toLowerCase()));
 return <div className="site-catalog"><label className="catalog-search">Find a location<input type="search" placeholder="Search by name or site type" value={query} onChange={e=>setQuery(e.target.value)}/></label>
  <AsyncState {...resource} empty={resource.data?.length===0}/>
  {resource.data&&sites?.length===0&&<p role="status">No locations match “{query}”. Try a mission name or clear the search.</p>}
  <div className="site-grid">{sites?.map(site=>{
   const active=state.location?.id===site.id;const comparing=state.selectedSites.some(s=>s.id===site.id);
   return <article className={`site-card${active?' is-selected':''}`} key={site.id}>
    <div className="site-card-copy"><span className="site-kind">{isMockMode?'Simulated candidate':siteKind(site)}</span><h3>{site.name}</h3><p className="site-coordinates">{coordinates(site)}</p>
     <details className="inline-details"><summary>Site details & source</summary>{site.status&&<p>{site.status}</p>}{site.kind==='clps-planned'&&<p>Target region, not an exact landing point.</p>}{site.coordinateNote&&<p>{site.coordinateNote}</p>}{site.source?<a href={site.source} target="_blank" rel="noreferrer">Coordinate source ↗</a>:<p>Hypothetical test coordinates, not a documented landing site.</p>}</details>
    </div>
    <div className="button-row">{!comparisonOnly&&<button className={active?'active':''} aria-pressed={active} onClick={()=>state.setLocation(site)}>{active?'Selected':'Use for analysis'}</button>}
     <button aria-label={`${comparing?'Remove':'Add'} ${site.name} ${comparing?'from':'to'} comparison`} aria-pressed={comparing} disabled={state.selectedSites.length===3&&!comparing} onClick={()=>state.toggleSite(site)}>{comparing?'Remove ×':'Compare +'}</button>
    </div>
   </article>;
  })}</div>
  {state.selectedSites.length===3&&<p className="muted">Three sites selected. Remove one to compare a different location.</p>}
 </div>;
}

