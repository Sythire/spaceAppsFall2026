import {ResponsiveContainer,LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,ReferenceLine} from 'recharts';
import type {TimelinePoint} from '../../types';
type Metric = 'sunlightPercent' | 'earthVisibilityPercent' | 'sunElevationDeg' | 'earthElevationDeg';
const labels: Record<Metric,string> = {sunlightPercent:'Sun above horizon',earthVisibilityPercent:'Earth above horizon',sunElevationDeg:'Sun elevation',earthElevationDeg:'Earth elevation'};
export function TimelineChart({data,metric,simulated=false}:{data:TimelinePoint[];metric:Metric;simulated?:boolean}){
 const angle=metric==='sunElevationDeg'||metric==='earthElevationDeg';
 const points=data.map(p=>({...p,value:metric==='sunElevationDeg'?p.sun?.elevationDeg:metric==='earthElevationDeg'?p.earth?.elevationDeg:p[metric]}));
 const unit=angle?'°':'%';
 return <div className="chart"><div role="img" aria-label={`${simulated?'Simulated':'SPICE modeled'} ${labels[metric]} timeline`}>
  <ResponsiveContainer width="100%" height={230}><LineChart data={points}>
   <CartesianGrid stroke="var(--fg-line)" strokeDasharray="3 3"/><XAxis dataKey="hour" type="number" domain={['dataMin','dataMax']} stroke="var(--fg-muted)" unit="h"/><YAxis domain={angle?['auto','auto']:[0,100]} stroke="var(--fg-muted)" unit={unit}/>
   {angle&&<ReferenceLine y={0} stroke="var(--fg-muted)" strokeDasharray="4 4" ifOverflow="extendDomain"/>}
   <Tooltip contentStyle={{background:'var(--fg-surface)',borderColor:'var(--fg-line)',color:'var(--fg-ink)'}} labelFormatter={hour=>`${hour} hours from start`} formatter={value=>[typeof value==='number'?value.toFixed(2)+unit:String(value),labels[metric]]}/>
   <Line isAnimationActive={false} type={angle?'linear':'stepAfter'} dataKey="value" stroke={metric.startsWith('sun')?'var(--fg-sun)':'var(--fg-earth)'} dot={false} strokeWidth={2}/>
  </LineChart></ResponsiveContainer></div>
  <details><summary>View {simulated?'simulated ':''}chart values</summary><div className="table-scroll"><table><thead><tr><th>Hour from start</th><th>{labels[metric]}</th></tr></thead><tbody>{points.map(p=><tr key={p.hour}><td>{p.hour}</td><td>{p.value?.toFixed(2)}{unit}</td></tr>)}</tbody></table></div></details>
 </div>;
}

