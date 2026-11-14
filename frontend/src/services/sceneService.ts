import type { CoverageGrid, CoverageKind, CoverageMap, CoverageMode, Equipment, ModelManifest, PsrMap, SceneSeries, SiteCoverage, SiteGeometry, TerrainEvents, TerrainGrid, ThermalMap, ThermalProduct } from '../types';
import { apiClient } from './apiClient';

/** Live SPICE geometry. There is no simulated fallback: failures surface as errors. */
const query = (params: Record<string, string | number | undefined>) =>
 '?' + Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => k + '=' + encodeURIComponent(String(v))).join('&');

export const sceneService = {
 series: (start: string, hours: number, stepHours: number, lat?: number, lon?: number): Promise<SceneSeries> =>
  apiClient('/scene/series' + query({ start, hours, stepHours, lat, lon })),
 site: (lat: number, lon: number, utc: string): Promise<SiteGeometry> => apiClient('/site' + query({ lat, lon, utc })),
 models: (): Promise<ModelManifest> => apiClient('/models'),
 /** Binary int16 height grid (width x width/2) from the LOLA DEM. */
 elevation: async (width = 1440): Promise<TerrainGrid> => {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '');
  if (!base) throw new Error('Set VITE_API_BASE_URL to load terrain.');
  const response = await fetch(base + '/terrain/elevation.bin?width=' + width, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error('Terrain service returned HTTP ' + response.status);
  return { width, height: width / 2, heightsM: new Int16Array(await response.arrayBuffer()) };
 },
};

/** Model files are served by the same service, outside the /api/v1 prefix. */
export function modelUrl(path: string): string {
 const base = import.meta.env.VITE_API_BASE_URL;
 return base ? new URL(path, base).toString() : path;
}

/** Terrain-aware analyses can take a while (the first request may build the horizon cache), so they get a long timeout. */
async function slowGet<T>(path: string): Promise<T> {
 const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '');
 if (!base) throw new Error('Set VITE_API_BASE_URL to load terrain-aware analyses.');
 const response = await fetch(base + path, { signal: AbortSignal.timeout(600000) });
 if (!response.ok) {
  const detail = await response.json().then((b: { detail?: unknown }) => b.detail).catch(() => null);
  throw new Error(typeof detail === 'string' ? detail : 'Analysis service returned HTTP ' + response.status);
 }
 return response.json() as Promise<T>;
}

const equipmentQuery = (e: Equipment) => ({ panelTilt: e.panelTiltDeg, panelHeight: e.panelHeightM, commMask: e.commMaskDeg, commHeight: e.commHeightM });

export const coverageService = {
 map: (grid: CoverageGrid, kind: CoverageKind, mode: CoverageMode, utc: string, e: Equipment): Promise<CoverageMap> =>
  slowGet('/coverage/map' + query({ grid, kind, mode, utc, ...equipmentQuery(e) })),
 site: (lat: number, lon: number, utc: string, e: Equipment, days = 30): Promise<SiteCoverage> =>
  slowGet('/coverage/site' + query({ lat, lon, utc, days, stepHours: 1, ...equipmentQuery(e) })),
 events: (lat: number, lon: number, utc: string, e: Equipment): Promise<TerrainEvents> =>
  slowGet('/coverage/events' + query({ lat, lon, utc, ...equipmentQuery(e) })),
 psr: (): Promise<PsrMap> => slowGet('/products/psr'),
 thermal: (product: ThermalProduct): Promise<ThermalMap> => slowGet('/products/thermal' + query({ product })),
};

