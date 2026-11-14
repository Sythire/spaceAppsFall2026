import {useAppState} from '../../context/AppContext';
export function DateSelector(){const {utc,setUtc}=useAppState();return <label className="date-label">Scenario time · UTC<input aria-label="Scenario date and time UTC" type="datetime-local" value={utc.slice(0,16)} onChange={e=>{if(e.target.value){const date=new Date(e.target.value+':00Z');if(Number.isFinite(date.getTime()))setUtc(date.toISOString());}}}/></label>;}

