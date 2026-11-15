import type {AnalysisResult} from '../types';

export interface ComparisonSample { hour:number; values:Record<string,number|null>; }

/** Align sites by elapsed hour, leaving gaps for missing samples instead of shifting their curves. */
export function comparisonTimeline(results:AnalysisResult[]){
 const hasElevation=results.length>0&&results.every(r=>r.illumination.timeline.some(p=>Number.isFinite(p.sun?.elevationDeg)));
 const byHour=results.map(r=>new Map(r.illumination.timeline.map(p=>[p.hour,p])));
 const hours=[...new Set(results.flatMap(r=>r.illumination.timeline.map(p=>p.hour)))].sort((a,b)=>a-b);
 const samples:ComparisonSample[]=hours.map(hour=>({hour,values:Object.fromEntries(results.map((r,index)=>{
  const point=byHour[index].get(hour);
  const value=hasElevation?point?.sun?.elevationDeg:point?.sunlightPercent;
  return [r.request.location.id,typeof value==='number'&&Number.isFinite(value)?value:null];
 }))}));
 return {samples,hasElevation};
}
