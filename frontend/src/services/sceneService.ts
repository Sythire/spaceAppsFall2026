import type { ModelManifest, SceneSeries, SiteGeometry, TerrainGrid } from '../types';
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
