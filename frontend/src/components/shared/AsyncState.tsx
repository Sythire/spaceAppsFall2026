export function AsyncState({loading,error,empty,retry}:{loading:boolean;error:string;empty?:boolean;retry:()=>void}){
 const message=/SPKINSUFFDATA|SPICE.*coverage/i.test(error)
  ? 'This date is outside the available SPICE data. Choose another starting date.'
  : /Failed to fetch|NetworkError|Load failed|fetch failed/i.test(error)
  ? 'Unable to reach the data service. Check that the backend is running, then try again.'
  : error;
 return loading?<p role="status">Loading data…</p>:error?<div role="alert"><p>{message}</p>{message!==error&&<details className="inline-details"><summary>Technical details</summary><p>{error}</p></details>}<button onClick={retry}>Retry</button></div>:empty?<p>No data available for this selection.</p>:null;
}
import {isMockMode} from '../../services/apiClient';
export function MockNotice(){return <p className="mock-notice">{isMockMode
 ? 'DEMO MODE · Analysis and Comparison use fixed UI fixtures. The 3D explorer uses live SPICE geometry.'
 : 'SPICE MODEL · Main totals use a smooth horizon; terrain details use LOLA. Eclipses and radio-link budgets are not modeled.'}</p>;}

