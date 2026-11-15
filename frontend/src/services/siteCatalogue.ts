import type {LunarLocation} from '../types';
import {referenceSites} from '../constants/referenceSites';

/** Site metadata remains usable while the computation service starts or reconnects. */
export async function loadSiteCatalogue(fetchLive:()=>Promise<LunarLocation[]>,waitMs=1500):Promise<LunarLocation[]>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try {
  return await Promise.race([
   fetchLive().then(sites=>{
    if(!Array.isArray(sites)||sites.length===0)throw new Error('Site catalogue unavailable');
    return sites;
   }),
   new Promise<LunarLocation[]>(resolve=>{timer=setTimeout(()=>resolve(referenceSites),waitMs);}),
  ]);
 } catch { return referenceSites; }
 finally { if(timer!==undefined)clearTimeout(timer); }
}
