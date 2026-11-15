import {useEffect,useState,type FormEvent} from 'react';
import {Link} from 'react-router';
import {useAppState} from '../../context/AppContext';
import {useAsync} from '../../hooks/useAsync';
import {mapService} from '../../services/mapService';
import {siteService} from '../../services/siteService';
import {MapViewport} from './MapViewport';
import {AsyncState} from '../../components/shared/AsyncState';
import {LocationSelect} from '../../components/shared/LocationSelect';
import {ScenarioControls} from '../../components/shared/ScenarioControls';
import type {CoverageMode,Equipment,LunarLocation} from '../../types';
import {DEFAULT_EQUIPMENT,EquipmentPanel} from './EquipmentPanel';

const EQUIPMENT_KEY='lunarsite.explorer.equipment.v1';
function loadEquipment():{equipment:Equipment;mode:CoverageMode}{try{const v=JSON.parse(localStorage.getItem(EQUIPMENT_KEY)??'null') as {equipment?:Equipment;mode?:CoverageMode}|null;return {equipment:{...DEFAULT_EQUIPMENT,...(v?.equipment??{})},mode:v?.mode==='monthly'?'monthly':'instant'};}catch{return {equipment:DEFAULT_EQUIPMENT,mode:'instant'};}}
const NO_SITES:LunarLocation[]=[];
export default function LunarMap(){
 const state=useAppState();
 const [planning,setPlanning]=useState(loadEquipment);
 useEffect(()=>{try{localStorage.setItem(EQUIPMENT_KEY,JSON.stringify(planning));}catch{/* storage unavailable */}},[planning]);
 const resource=useAsync(mapService.getLayers);
 const sites=useAsync(siteService.getSites);
 const [error,setError]=useState('');
 const [form,setForm]=useState({lat:String(state.location?.latitudeDeg??-89.5),lon:String(state.location?.longitudeDeg??32)});
 useEffect(()=>{if(state.location)setForm({lat:state.location.latitudeDeg.toFixed(4),lon:state.location.longitudeDeg.toFixed(4)});},[state.location]);
 function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();const lat=Number(form.lat),lon=Number(form.lon);
  if(!form.lat.trim()||!form.lon.trim()||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180){setError('Latitude must be −90 to 90; longitude −180 to 180.');return;}
  state.setLocation({id:'custom',name:'Custom location',latitudeDeg:lat,longitudeDeg:lon,frame:'MOON_ME'});setError('');
 }
 return <>
  <div className="page-heading"><span className="eyebrow">Lunar explorer</span><h1>Find your perspective.</h1><p>A location. A moment in time. The Moon, seen from a little closer.</p></div>
  <div className="map-layout">
   <aside className="map-controls panel" aria-label="Scenario setup">
    <h2>Location & time</h2>
    <LocationSelect/>
    <details className="disclosure"><summary>Enter custom coordinates</summary><form onSubmit={submit}>
     <label>Latitude · °N<input name="lat" type="number" step="any" min="-90" max="90" required value={form.lat} onChange={e=>setForm(f=>({...f,lat:e.target.value}))}/></label>
     <label>Longitude · °E<input name="lon" type="number" step="any" min="-180" max="180" required value={form.lon} onChange={e=>setForm(f=>({...f,lon:e.target.value}))}/></label>
     <button type="submit">Select coordinates</button>{error&&<p role="alert">{error}</p>}
    </form></details>
    <ScenarioControls/>
    <p className="muted">All times are UTC. Duration applies to analysis; globe playback previews 30 days.</p>
    {state.location?<Link className="primary-action" to="/analysis">Analyze this location →</Link>:<p className="empty-hint">Choose a location to begin your analysis.</p>}
    <a className="mobile-view-link" href="#lunar-view">View the Moon ↓</a>
    <details className="disclosure"><summary>Map layers <span className="detail-count">{state.layers.length} active</span></summary>
     <AsyncState {...resource} empty={resource.data?.length===0}/>
     {resource.data?.map(layer=><label className="checkbox" key={layer.id}><input type="checkbox" checked={state.layers.includes(layer.id)} onChange={()=>state.toggleLayer(layer.id)}/>{layer.name}{!layer.available&&<small>Pending</small>}</label>)}
     <p className="muted">Layers stack. Power and communication layers use LOLA terrain and your advanced equipment settings.</p>
    </details>
   </aside>
   <MapViewport location={state.location} layers={state.layers} onSelect={state.setLocation} utc={state.utc} onUtcChange={state.setUtc} markers={sites.data??NO_SITES} equipment={planning.equipment} coverageMode={planning.mode} equipmentBar={<EquipmentPanel layout="bar" equipment={planning.equipment} mode={planning.mode} onApply={equipment=>setPlanning(p=>({...p,equipment}))} onModeChange={mode=>setPlanning(p=>({...p,mode}))}/>}/>
  </div>
 </>;
}
