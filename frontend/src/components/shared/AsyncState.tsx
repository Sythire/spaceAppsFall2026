export function AsyncState({loading,error,empty,retry}:{loading:boolean;error:string;empty?:boolean;retry:()=>void}){return loading?<p role="status">Loading data…</p>:error?<div role="alert"><p>{error}</p><button onClick={retry}>Retry</button></div>:empty?<p>No data available for this selection.</p>:null;}
import {isMockMode} from '../../services/apiClient';
export function MockNotice(){return <p className="mock-notice">{isMockMode
 ? 'DEMO DATA · Analysis and comparison use example results. The 3D explorer uses live SPICE geometry.'
 : 'MODELED CONDITIONS · SPICE positions for your site and time. Smooth-horizon summaries; LOLA terrain sections. Excludes eclipses and radio link budgets.'}</p>;}

