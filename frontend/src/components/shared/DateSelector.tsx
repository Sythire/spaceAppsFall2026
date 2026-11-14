import {useAppState} from '../../context/AppContext';
export function DateSelector(){const {utc,setUtc}=useAppState();return <label className="date-label">Scenario time · UTC<input aria-label="Scenario date and time UTC" type="datetime-local" value={utc.slice(0,16)} onInput={e=>{const value=e.currentTarget.value;if(value){const date=new Date(value.length===16?value+':00Z':value+'Z');if(Number.isFinite(date.getTime()))setUtc(date.toISOString());}}}/></label>;}

