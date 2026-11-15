import {useAppState} from '../../context/AppContext';
import {useAsync} from '../../hooks/useAsync';
import {siteService} from '../../services/siteService';
import {AsyncState} from './AsyncState';
import type {LunarLocation} from '../../types';

export function siteKind(site:LunarLocation){
 if(site.id==='custom')return 'Custom coordinates';
 return site.kind==='historical'?'Historical landing site':site.kind==='clps-landed'?'CLPS · landed':site.kind==='clps-planned'?'Planned target region':'Hypothetical test location';
}
export function coordinates(site:LunarLocation){
 return `${Math.abs(site.latitudeDeg).toFixed(2)}° ${site.latitudeDeg<0?'S':'N'} · ${Math.abs(site.longitudeDeg).toFixed(2)}° ${site.longitudeDeg<0?'W':'E'}`;
}
export function LocationSelect(){
 const {location,setLocation}=useAppState();
 const resource=useAsync(siteService.getSites);
 const sites=resource.data??[];
 return <div className="location-select">
  <label>Location<select aria-label="Location" value={location?.id??''} onChange={e=>{const site=sites.find(s=>s.id===e.target.value);if(site)setLocation(site);}}>
   <option value="" disabled>Choose a lunar location</option>
   {location&&!sites.some(s=>s.id===location.id)&&<option value={location.id}>{location.name}</option>}
   {['historical','clps-landed','clps-planned','exploratory'].map(kind=><optgroup key={kind} label={kind==='historical'?'Historical landings':kind==='clps-landed'?'CLPS landings':kind==='clps-planned'?'Planned regions':'Test locations'}>
    {sites.filter(s=>(s.kind??'exploratory')===kind).map(site=><option key={site.id} value={site.id}>{site.name}</option>)}
   </optgroup>)}
  </select></label>
  <AsyncState {...resource} empty={sites.length===0}/>
  {location&&<div className="location-caption"><span className="site-kind">{siteKind(location)}</span><p>{coordinates(location)} · MOON_ME</p>
   {location.kind==='clps-planned'&&<p>Regional coordinates, not an exact landing point.</p>}
   <details className="inline-details"><summary>About this location</summary>
    {location.status&&<p>{location.status}</p>}
    {location.coordinateNote&&<p>{location.coordinateNote}</p>}
    {location.source?<a href={location.source} target="_blank" rel="noreferrer">Coordinate source ↗</a>:<p>User-selected or hypothetical coordinates; not a documented landing site.</p>}
   </details>
  </div>}
 </div>;
}
