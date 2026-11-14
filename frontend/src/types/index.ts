export interface LunarLocation { id: string; name: string; latitudeDeg: number; longitudeDeg: number; frame: 'MOON_ME'; kind?: 'historical' | 'exploratory' | 'clps-landed' | 'clps-planned'; source?: string | null; coordinateFrame?: string; coordinateNote?: string; status?: string; program?: string; }
export interface AnalysisRequest { location: LunarLocation; utc: string; durationHours?: number; stepHours?: number; }
export interface SunPosition { elevationDeg: number; azimuthDeg: number; }
export interface EarthPosition { elevationDeg: number; azimuthDeg: number; }
export interface IlluminationData extends Partial<VisibilitySummary> { sunlightPercent: number; timeline: TimelinePoint[]; daylightHours?: number; darknessHours?: number; }
export interface TerrainData { slopeDeg: number | null; temperatureK: number | null; permanentlyShadowed: boolean | null; }
export interface TimelinePoint { hour: number; sunlightPercent: number; earthVisibilityPercent: number; utc?: string; sun?: HorizonSample; earth?: HorizonSample; solarFluxWm2?: number; horizontalIrradianceWm2?: number; }
export interface AnalysisResult { request: AnalysisRequest; mode: 'simulated' | 'modeled' | 'verified'; source: string; sun: SunPosition; earth: EarthPosition; illumination: IlluminationData; earthVisibilityPercent: number; terrain: TerrainData; suitability: string | null; earthVisibility?: VisibilitySummary; interval?: AnalysisInterval; metadata?: AnalysisMetadata; }
export interface LandingSiteComparison { results: AnalysisResult[]; }
export type MapLayer = 'illumination' | 'earth-visibility' | 'elevation' | 'power' | 'psr' | 'thermal';
export interface MapLayerDefinition { id: MapLayer; name: string; available: boolean; }
export interface Recommendation { location: LunarLocation; reason: string; mode: 'simulated' | 'verified'; }


/** Moon-anchored scene geometry from the SPICE service. Vectors are MOON_ME, Moon-centered, km. */
export type Vec3 = [number, number, number];
/** SPICE quaternion order: w, x, y, z. */
export type SpiceQuat = [number, number, number, number];
export interface HorizonAngles { elevationDeg: number; azimuthDeg: number; }
/** Sun-centered positions (ECLIPJ2000 axes, km, geometric). The Sun is the origin. */
export interface HelioPositions { moon: Vec3; earth: Vec3; mars: Vec3; }
/**
 * sun/earth/mars: Moon-centered MOON_ME vectors (km, LT+S), used for site geometry and sub-points.
 * helio: Sun-centered display positions. moonRotationQuat: MOON_ME -> ECLIPJ2000.
 * earthRotationQuat: IAU_EARTH -> ECLIPJ2000.
 */
export interface SceneSample { utc: string; sun: Vec3; earth: Vec3; mars: Vec3; helio: HelioPositions; moonRotationQuat: SpiceQuat; earthRotationQuat: SpiceQuat; site?: { sun: HorizonAngles; earth: HorizonAngles }; }
export interface SceneSeries { frame: 'MOON_ME'; helioFrame: 'ECLIPJ2000'; units: 'km'; stepHours: number; source: string; horizonMethod: string | null; samples: SceneSample[]; }
export interface BodyEvents extends HorizonAngles { distanceKm: number; aboveHorizon: boolean; nextSet: string | null; nextRise: string | null; }
export interface SiteGeometry {
 utc: string; location: { latitudeDeg: number; longitudeDeg: number; frame: 'MOON_ME' };
 source: string; horizonMethod: string; searchWindowDays: number; azimuthConvention: string;
 sun: BodyEvents; earth: BodyEvents;
 power: { solarFluxWm2: number; horizontalPanelWm2: number; assumptions: string };
 terrain: SiteTerrain | null;
 thermal?: SiteThermal | null;
}
/** LOLA DEM values at a site; null when the DEM file is not present. */
export interface SiteTerrain { elevationM: number; regionalSlopeDeg: number; baselineKm: number; source: string; note: string; permanentlyShadowed?: boolean | null; psrSource?: string | null; }
/** LRO Diviner measured temperatures at a site (2010 cycle averages). */
export interface SiteThermal { dayMaxK: number | null; nightMinK: number | null; source: string; note: string; }
/** Downsampled LOLA height grid: metres above the 1737.4 km sphere; row 0 = 90°N, column 0 = 180°W. */
export interface TerrainGrid { width: number; height: number; heightsM: Int16Array; }

/** sky: NASA Deep Star Map (J2000 celestial, equirectangular), if present. */
export interface ModelManifest { moon: string | null; earth: string | null; sun: string | null; mars: string | null; sky?: string | null; }


export interface HorizonSample extends HorizonAngles { distanceKm: number; aboveHorizon: boolean; }
export interface VisibilityWindow { startUtc: string; endUtc: string; durationHours: number; clippedAtStart: boolean; clippedAtEnd: boolean; }
export interface VisibilitySummary { aboveHorizonHours: number; belowHorizonHours: number; aboveHorizonPercent: number; visibleWindows: VisibilityWindow[]; hiddenWindows: VisibilityWindow[]; events: {utc: string; type: 'rise' | 'set'}[]; nextRise: string | null; nextSet: string | null; }
export interface AnalysisInterval { startUtc: string; endUtc: string; durationHours: number; elapsedHours: number; stepHours: number; sampleCount: number; }
export interface KernelProvenance { provider: string; kernels: {file: string; url: string; sha256: string; bytes: number}[]; frame: 'MOON_ME'; frameRealization: string; aberrationCorrection: string; toolkitVersion: string; spiceypyVersion: string; coverage: {startUtc: string; endUtc: string}[]; coverageNote: string; retrievedAtUtc: string | null; retrievalNote: string; }
export interface AnalysisMetadata { generatedAtUtc: string; provenance: KernelProvenance; horizonMethod: string; azimuthConvention: string; angleUnits: string; distanceUnits: string; timeScale: string; eventScanStepHours: number; eventRefinementSeconds: number; uncertaintyDeg: number | null; limitations: string[]; }

/** Equipment assumptions for terrain-aware power and communication maps. */
export interface Equipment { panelTiltDeg: number; panelHeightM: number; commMaskDeg: number; commHeightM: number; }
export type CoverageKind = 'power' | 'sunlit' | 'comms';
export type CoverageMode = 'instant' | 'monthly';
export type CoverageGrid = 'global' | 'southpole';
/** valuesF32: base64 little-endian float32, row-major (row 0 = north edge for global, y = -ρmax for southpole). NaN = no data. */
export interface CoverageMap {
 grid: CoverageGrid; kind: CoverageKind; mode: CoverageMode; units: string; label: string;
 width: number; height: number; layout: string; cellKm: number; polarCapLat: number; polarRhoMaxM: number;
 start: string; end: string; samples: number; min: number | null; max: number | null; valuesF32: string; method: string;
}
export interface SiteCoverage {
 location: { latitudeDeg: number; longitudeDeg: number; frame: 'MOON_ME' };
 stepHours: number; method: string; slopeDeg: number;
 horizonProfile: { azimuthDeg: number[]; panelDeg: number[]; commDeg: number[] };
 series: { utc: string[]; sunElevationDeg: number[]; sunHorizonDeg: number[]; powerWm2: number[]; earthElevationDeg: number[]; earthLimitDeg: number[]; earthVisible: boolean[]; sunlit: boolean[] };
 summary: { sunlitPct: number; meanPowerWm2: number; peakPowerWm2: number; energyKWhPerM2: number; longestDarkHours: number; earthVisiblePct: number; longestCommOutageHours: number };
}

/** Terrain-aware rise/set events (real skyline + receiver mask). */
export interface TerrainEvent { up: boolean; nextSet: string | null; nextRise: string | null; }
export interface TerrainEvents { utc: string; searchWindowDays: number; sun: TerrainEvent; earth: TerrainEvent; method: string; }
/** Measured map products. psr: polar grid (fraction shadowed); thermal: global grid (K). */
export interface PsrMap { width: number; height: number; rhoMaxM: number; capLat: number; valuesF32: string; units: string; cellKm: number; source: string; layout: string; }
export type ThermalProduct = 'daymax' | 'nightmin';
export interface ThermalMap { width: number; height: number; units: 'K'; product: ThermalProduct; label: string; min: number; max: number; cycles: { day: number; night: number }; period: string; valuesF32: string; source: string; cellKm: number; layout: string; }
