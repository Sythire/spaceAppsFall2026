export function AsyncState({loading,error,empty,retry}:{loading:boolean;error:string;empty?:boolean;retry:()=>void}){return loading?<p role="status">Loading workspace data…</p>:error?<div role="alert"><p>{error}</p><button onClick={retry}>Retry</button></div>:empty?<p>No data available for this selection.</p>:null;}
import {isMockMode} from '../../services/apiClient';
export function MockNotice(){return <p className="mock-notice">{isMockMode
 ? 'DEMO MODE · Analysis and Comparison use fixed UI fixtures. The 3D explorer uses live SPICE geometry.'
 : 'NASA SPICE MODEL · Results recompute for your site and date. Summary tables use a smooth lunar horizon; terrain-aware sections use LOLA horizons. Eclipses and radio link budgets are not included.'}</p>;}

