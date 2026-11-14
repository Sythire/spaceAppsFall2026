import type { AnalysisRequest, AnalysisResult, LunarLocation, MapLayerDefinition } from '../types';
export const candidateSites: LunarLocation[] = [
{id:'demo-a',name:'Polar candidate A',latitudeDeg:-89.5,longitudeDeg:32,frame:'MOON_ME'},
{id:'demo-b',name:'Polar candidate B',latitudeDeg:-88.8,longitudeDeg:-45,frame:'MOON_ME'},
{id:'demo-c',name:'Polar candidate C',latitudeDeg:-87.9,longitudeDeg:110,frame:'MOON_ME'}];
export const mapLayers: MapLayerDefinition[] = [
{id:'illumination',name:'Illumination',available:true},
{id:'earth-visibility',name:'Earth visibility',available:false},
{id:'elevation',name:'Elevation',available:true}];
const fixtures = [
{sun:8.4,earth:4.1,light:72,visibility:61,slope:7.2},
{sun:5.2,earth:2.8,light:61,visibility:53,slope:11.8},
{sun:10.1,earth:-1.2,light:80,visibility:34,slope:9.3}];
export function mockAnalysis(request: AnalysisRequest): AnalysisResult {
 const index = candidateSites.findIndex(s=>s.id===request.location.id);
 const f = fixtures[index < 0 ? 0 : index];
 return {request,mode:'simulated',source:'UI fixture only — not NASA data; values do not depend on time or coordinates',sun:{elevationDeg:f.sun,azimuthDeg:130},earth:{elevationDeg:f.earth,azimuthDeg:15},illumination:{sunlightPercent:f.light,timeline:Array.from({length:9},(_,i)=>({hour:i*3,sunlightPercent:[20,32,56,78,84,72,50,28,12][i],earthVisibilityPercent:[66,68,64,58,52,46,49,55,62][i]}))},earthVisibilityPercent:f.visibility,terrain:{slopeDeg:f.slope,temperatureK:null,permanentlyShadowed:null},suitability:null};
}

