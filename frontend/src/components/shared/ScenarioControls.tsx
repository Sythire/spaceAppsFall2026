import {useAppState} from '../../context/AppContext';
import {DateSelector} from './DateSelector';
import {isMockMode} from '../../services/apiClient';

export function ScenarioControls(){
 const {durationHours,setDurationHours,stepHours,setStepHours}=useAppState();
 return <div className="scenario-controls">
  <DateSelector/>
  <label>Analysis duration<select value={durationHours} disabled={isMockMode} onChange={e=>setDurationHours(Number(e.target.value))}>
   {[1,7,30,90].map(days=><option key={days} value={days*24}>{days} {days===1?'day':'days'}</option>)}
  </select></label>
  <label>Chart sampling<select value={stepHours} disabled={isMockMode} onChange={e=>setStepHours(Number(e.target.value))}>
   {[0.25,1,3,6,12].map(hours=><option key={hours} value={hours} disabled={durationHours/hours>4000}>{hours===0.25?'15 minutes':`${hours} ${hours===1?'hour':'hours'}`}</option>)}
  </select></label>
 </div>;
}
