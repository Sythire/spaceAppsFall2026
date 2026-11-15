import { createContext, useContext, useState, type ReactNode } from 'react';
import type { AnalysisResult, LunarLocation, MapLayer } from '../types';
interface AppState { location: LunarLocation | null; setLocation:(s:LunarLocation|null)=>void; utc:string; setUtc:(s:string)=>void; durationHours:number; setDurationHours:(hours:number)=>void; stepHours:number; setStepHours:(hours:number)=>void; layers:MapLayer[]; toggleLayer:(s:MapLayer)=>void; selectedSites:LunarLocation[]; toggleSite:(s:LunarLocation)=>void; analysis:AnalysisResult|null; setAnalysis:(r:AnalysisResult|null)=>void; }
const Context=createContext<AppState|null>(null);
export function AppProvider({children}:{children:ReactNode}) {
 const [location,setLocationState]=useState<LunarLocation|null>(null);
 const [utc,setUtcState]=useState(new Date().toISOString());
 const [layers,setLayers]=useState<MapLayer[]>([]);
 const [selectedSites,setSelectedSites]=useState<LunarLocation[]>([]);
 const [analysis,setAnalysis]=useState<AnalysisResult|null>(null);
 const [durationHours,setDurationState]=useState(720);
 const [stepHours,setStepState]=useState(1);
 const setDurationHours=(hours:number)=>{setDurationState(hours);if(hours/stepHours>4000)setStepState(1);setAnalysis(null);};
 const setStepHours=(hours:number)=>{setStepState(hours);setAnalysis(null);};
 const setLocation=(s:LunarLocation|null)=>{setLocationState(s);setAnalysis(null);};
 const setUtc=(s:string)=>{setUtcState(s);setAnalysis(null);};
 const toggleLayer=(layer:MapLayer)=>setLayers(prev=>prev.includes(layer)?prev.filter(x=>x!==layer):[...prev,layer]);
 const toggleSite=(site:LunarLocation)=>{
  if(selectedSites.length===1&&selectedSites[0].id===site.id&&location?.id===site.id)setLocation(null);
  setSelectedSites(prev=>prev.some(s=>s.id===site.id)?prev.filter(s=>s.id!==site.id):prev.length<3?[...prev,site]:prev);
 };
 return <Context.Provider value={{location,setLocation,utc,setUtc,durationHours,setDurationHours,stepHours,setStepHours,layers,toggleLayer,selectedSites,toggleSite,analysis,setAnalysis}}>{children}</Context.Provider>;
}
export function useAppState(){const state=useContext(Context);if(!state)throw new Error('AppProvider required');return state;}

