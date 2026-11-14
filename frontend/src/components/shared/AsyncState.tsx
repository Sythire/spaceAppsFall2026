export function AsyncState({loading,error,empty,retry}:{loading:boolean;error:string;empty?:boolean;retry:()=>void}){return loading?<p role="status">Loading workspace data…</p>:error?<div role="alert"><p>{error}</p><button onClick={retry}>Retry</button></div>:empty?<p>No data available for this selection.</p>:null;}
export function MockNotice(){return <p className="mock-notice">SIMULATED WORKSPACE · All candidate sites, metrics and charts are UI fixtures, not NASA measurements. Changing dates does not recompute science.</p>;}

