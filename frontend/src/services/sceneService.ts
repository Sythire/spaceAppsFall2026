import type { ModelManifest, SceneSeries, SiteGeometry } from '../types';
import { apiClient } from './apiClient';

/** Live SPICE geometry. There is no simulated fallback: failures surface as errors. */
const query = (params: Record<string, string | number | undefined>) =>
 '?' + Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => k + '=' + encodeURIComponent(String(v))).join('&');

export const sceneService = {
 series: (start: string, hours: number, stepHours: number, lat?: number, lon?: number): Promise<SceneSeries> =>
  apiClient('/scene/series' + query({ start, hours, stepHours, lat, lon })),
 site: (lat: number, lon: number, utc: string): Promise<SiteGeometry> => apiClient('/site' + query({ lat, lon, utc })),
 models: (): Promise<ModelManifest> => apiClient('/models'),
};

/** Model files are served by the same service, outside the /api/v1 prefix. */
export function modelUrl(path: string): string {
 const base = import.meta.env.VITE_API_BASE_URL;
 return base ? new URL(path, base).toString() : path;
}
