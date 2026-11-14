export interface LunarLocation { id: string; name: string; latitudeDeg: number; longitudeDeg: number; frame: 'MOON_ME'; }
export interface AnalysisRequest { location: LunarLocation; utc: string; }
export interface SunPosition { elevationDeg: number; azimuthDeg: number; }
export interface EarthPosition { elevationDeg: number; azimuthDeg: number; }
export interface IlluminationData { sunlightPercent: number; timeline: TimelinePoint[]; }
export interface TerrainData { slopeDeg: number | null; temperatureK: number | null; permanentlyShadowed: boolean | null; }
export interface TimelinePoint { hour: number; sunlightPercent: number; earthVisibilityPercent: number; }
export interface AnalysisResult { request: AnalysisRequest; mode: 'simulated' | 'verified'; source: string; sun: SunPosition; earth: EarthPosition; illumination: IlluminationData; earthVisibilityPercent: number; terrain: TerrainData; suitability: string | null; }
export interface LandingSiteComparison { results: AnalysisResult[]; }
export type MapLayer = 'illumination' | 'earth-visibility' | 'elevation';
export interface MapLayerDefinition { id: MapLayer; name: string; available: boolean; }
export interface Recommendation { location: LunarLocation; reason: string; mode: 'simulated' | 'verified'; }

