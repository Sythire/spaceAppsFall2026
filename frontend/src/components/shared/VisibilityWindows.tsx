import type {VisibilityWindow} from '../../types';
export function VisibilityWindows({windows,label}:{windows:VisibilityWindow[];label:string}){
 return windows.length===0?<p className="muted">No {label.toLowerCase()} found in this interval.</p>:<div className="table-scroll"><table>
  <thead><tr><th>Start · UTC</th><th>End · UTC</th><th>Hours</th></tr></thead>
  <tbody>{windows.map(w=><tr key={w.startUtc}><td>{w.startUtc.replace('T',' ').replace('.000Z','Z')}{w.clippedAtStart?' *':''}</td><td>{w.endUtc.replace('T',' ').replace('.000Z','Z')}{w.clippedAtEnd?' *':''}</td><td>{w.durationHours.toFixed(2)}</td></tr>)}</tbody>
 </table><p className="muted">* Window extends to an analysis boundary; the actual rise or set may lie outside this interval.</p></div>;
}
