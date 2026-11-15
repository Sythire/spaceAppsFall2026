import {useMemo} from 'react';
import {ResponsiveContainer,LineChart,Line,BarChart,Bar,XAxis,YAxis,CartesianGrid,Tooltip,ReferenceLine,Legend} from 'recharts';
import {Panel} from '../ui/Panel';
import {SITE_SERIES_COLORS as SERIES} from '../../constants/siteColors';
import type {AnalysisResult} from '../../types';

const GRID='#cdd3e0',AXIS='#8a93a8';

/** Linear blend of two #rrggbb colours (t in 0..1). */
function mix(a:string,b:string,t:number){
 const pa=[1,3,5].map(i=>parseInt(a.slice(i,i+2),16));
 const pb=[1,3,5].map(i=>parseInt(b.slice(i,i+2),16));
 const c=pa.map((v,i)=>Math.round(v+(pb[i]-v)*Math.max(0,Math.min(1,t))));
 return '#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');
}
/** Sun-elevation -> colour. Below the horizon: cool/dark (night). Above: warm/bright (day). Sharp split at 0° marks the terminator. */
function elevationColor(e:number){
 if(e<0)return mix('#2b3c66','#0a0e1f',Math.min(1,-e/90)); // dusk blue -> deep night
 return mix('#fff0c0','#dc4a24',Math.min(1,e/90));          // pale warm -> strong orange
}
/** Percent (0..100) -> warm scale, used when elevation is unavailable (simulated fixtures). */
const percentColor=(p:number)=>mix('#13214a','#ffcf4a',Math.max(0,Math.min(1,p/100)));

type Series={id:string;name:string;color:string};

export function ComparisonVisuals({results,order}:{results:AnalysisResult[];order?:string[]}){
 // Colour each module by its identity (its slot in the selected order), so a module keeps the same colour
 // in the comparison chips and in every chart/heatmap row even if the results come back in another order.
 const colorFor=(id:string)=>{const i=order?order.indexOf(id):-1;return SERIES[(i>=0?i:results.findIndex(r=>r.request.location.id===id))%SERIES.length];};
 const series:Series[]=results.map(r=>({id:r.request.location.id,name:r.request.location.name,color:colorFor(r.request.location.id)}));
 // Each compared site shares the same start, duration and step, so their timelines line up by `hour`.
 const hasElev=results.every(r=>r.illumination.timeline.some(p=>p.sun?.elevationDeg!=null));
 const metricLabel=hasElev?'Sun elevation':'Sunlight';
 const unit=hasElev?'°':'%';
 const valueAt=(r:AnalysisResult,i:number)=>{const p=r.illumination.timeline[i];return hasElev?(p?.sun?.elevationDeg??null):(p?.sunlightPercent??null);};

 // Longest timeline drives the shared hour axis; sites normally match exactly.
 const base=results.reduce((a,b)=>b.illumination.timeline.length>a.illumination.timeline.length?b:a).illumination.timeline;
 const lineData=useMemo(()=>base.map((p,i)=>{
  const row:Record<string,number|null>={hour:p.hour};
  results.forEach((r,s)=>{row[series[s].id]=valueAt(r,i);});
  return row;
 }),[results]);

 const barData=[
  {metric:'Sunlight %',...Object.fromEntries(results.map((r,s)=>[series[s].id,+r.illumination.sunlightPercent.toFixed(1)]))},
  {metric:'Earth view %',...Object.fromEntries(results.map((r,s)=>[series[s].id,+r.earthVisibilityPercent.toFixed(1)]))},
 ];

 const tipStyle={background:'#15213a',border:'1px solid #36485e',borderRadius:8,color:'#eef2f8',fontSize:12};
 const nameOf=(id:string)=>series.find(s=>s.id===id)?.name??id;

 return <div className="comparison-visuals">
  <Panel title={`${metricLabel} over time · all sites`}>
   <div className="chart" role="img" aria-label={`${metricLabel} over time for each compared site`}>
    <ResponsiveContainer width="100%" height={260}>
     <LineChart data={lineData} margin={{top:6,right:12,bottom:4,left:-8}}>
      <CartesianGrid stroke={GRID} strokeDasharray="3 3"/>
      <XAxis dataKey="hour" type="number" domain={['dataMin','dataMax']} stroke={AXIS} unit="h" tick={{fontSize:11}}/>
      <YAxis stroke={AXIS} unit={unit} tick={{fontSize:11}} domain={hasElev?['auto','auto']:[0,100]}/>
      {hasElev&&<ReferenceLine y={0} stroke={AXIS} strokeDasharray="4 4" label={{value:'horizon',position:'insideTopRight',fontSize:10,fill:AXIS}}/>}
      <Tooltip contentStyle={tipStyle} labelFormatter={h=>`${h} h from start`} formatter={(v,id)=>[typeof v==='number'?v.toFixed(1)+unit:'—',nameOf(String(id))]}/>
      <Legend wrapperStyle={{fontSize:11}} formatter={(id:string)=>nameOf(id)}/>
      {series.map(s=><Line key={s.id} isAnimationActive={false} type={hasElev?'monotone':'stepAfter'} dataKey={s.id} name={s.name} stroke={s.color} dot={false} strokeWidth={2} connectNulls/>)}
     </LineChart>
    </ResponsiveContainer>
   </div>
  </Panel>

  <Panel title="Key metrics · side by side">
   <div className="chart" role="img" aria-label="Sunlight and Earth-visibility percentages per site">
    <ResponsiveContainer width="100%" height={240}>
     <BarChart data={barData} margin={{top:6,right:12,bottom:4,left:-8}} barGap={4} barCategoryGap="28%">
      <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false}/>
      <XAxis dataKey="metric" stroke={AXIS} tick={{fontSize:11}}/>
      <YAxis stroke={AXIS} unit="%" domain={[0,100]} tick={{fontSize:11}}/>
      <Tooltip cursor={{fill:'#8a93a815'}} contentStyle={tipStyle} formatter={(v,id)=>[`${v}%`,nameOf(String(id))]}/>
      <Legend wrapperStyle={{fontSize:11}} formatter={(id:string)=>nameOf(id)}/>
      {series.map(s=><Bar key={s.id} isAnimationActive={false} dataKey={s.id} name={s.name} fill={s.color} radius={[4,4,0,0]} maxBarSize={46}/>)}
     </BarChart>
    </ResponsiveContainer>
   </div>
  </Panel>

  <Panel title={`${metricLabel} heatmap · time × site`}>
   <Heatmap results={results} series={series} base={base} valueAt={valueAt} hasElev={hasElev} unit={unit}/>
  </Panel>
 </div>;
}

/** Rows = sites, columns = time samples, cell colour = sun elevation (or sunlight %). Pure SVG so it scales to any width. */
function Heatmap({results,series,base,valueAt,hasElev,unit}:{
 results:AnalysisResult[];series:Series[];base:AnalysisResult['illumination']['timeline'];
 valueAt:(r:AnalysisResult,i:number)=>number|null;hasElev:boolean;unit:string;
}){
 const cols=base.length;
 const rowH=34,labelW=132,legendH=34,W=1000;
 const gridW=W-labelW;
 const cellW=gridW/Math.max(1,cols);
 const color=(v:number|null)=>v==null?'#9aa0b0':hasElev?elevationColor(v):percentColor(v);
 const hours=base.map(p=>p.hour);
 const lastHour=hours[hours.length-1]??0;
 // ~8 evenly spaced hour ticks along the bottom.
 const tickEvery=Math.max(1,Math.round(cols/8));
 const H=results.length*rowH+legendH+18;
 const legend=hasElev
  ? [{e:-90,l:'−90°'},{e:-45,l:'−45°'},{e:0,l:'0° horizon'},{e:30,l:'30°'},{e:60,l:'60°'},{e:90,l:'90°'}]
  : [{e:0,l:'0%'},{e:25,l:''},{e:50,l:'50%'},{e:75,l:''},{e:100,l:'100%'}];
 return <div className="heatmap" role="img" aria-label={`${hasElev?'Sun elevation':'Sunlight'} heatmap: one row per site across the analysis interval`}>
  <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
   {results.map((r,row)=>{
    const y=row*rowH;
    return <g key={series[row].id}>
     <rect x="0" y={y} width={labelW-8} height={rowH-4} fill="transparent"/>
     <text x="0" y={y+rowH/2} dominantBaseline="middle" fontSize="12" fontWeight="600" fill="currentColor" className="heatmap-rowlabel">{series[row].name.length>20?series[row].name.slice(0,19)+'…':series[row].name}</text>
     {base.map((p,i)=>{
      const v=valueAt(r,i);
      return <rect key={i} x={labelW+i*cellW} y={y} width={Math.ceil(cellW)+0.5} height={rowH-4} fill={color(v)}>
       <title>{series[row].name} · {p.hour} h · {v==null?'n/a':v.toFixed(1)+unit}</title>
      </rect>;
     })}
    </g>;
   })}
   {/* hour axis */}
   {base.map((p,i)=>i%tickEvery===0||i===cols-1?
    <text key={i} x={labelW+i*cellW} y={results.length*rowH+14} fontSize="11" fill="currentColor" className="heatmap-axis">{p.hour}h</text>:null)}
   {/* colour legend */}
   {legend.map((s,i)=><g key={i}>
    <rect x={labelW+i*74} y={H-legendH+8} width="22" height="12" rx="2" fill={hasElev?elevationColor(s.e):percentColor(s.e)}/>
    <text x={labelW+i*74+26} y={H-legendH+18} fontSize="10.5" fill="currentColor" className="heatmap-axis">{s.l}</text>
   </g>)}
  </svg>
  <p className="muted">{hasElev
   ? 'Each column is one time sample; warmer = Sun higher, blue = below the horizon (night). Read across a row to see a site’s day/night cycle; compare rows for more vs. less daylight.'
   : 'Simulated fixtures: colour shows the sunlight percentage; real Sun-elevation detail needs the live SPICE service.'}</p>
 </div>;
}
