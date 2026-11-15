import type { CoverageKind, CoverageMode } from '../types';

/** Colour scales for the terrain-aware coverage maps. Stops are [fraction 0..1, '#rrggbb']. */
export type Stops = [number, string][];
export const POWER_STOPS: Stops = [[0, '#160b3a'], [0.2, '#4b1d8a'], [0.45, '#b0306f'], [0.7, '#f07a2c'], [1, '#fff3a6']];
export const PERCENT_STOPS: Stops = [[0, '#b3261e'], [0.5, '#f2c14e'], [1, '#2fbf71']];
export const MARGIN_STOPS: Stops = [[0, '#f2c14e'], [1, '#2fbf71']];
export const BLOCKED_COLOR = '#b3261e';
/** Instant margins above this many degrees all show as full green. */
export const MARGIN_FULL_DEG = 30;

export interface ScaleSpec { stops: Stops; min: number; max: number; unit: string; blockedBelowZero: boolean; }

/** Value range and colours for a map. Power (electrical, W/m² of panel) uses the panel's physical range now
 *  (~1400 W/m² sunlight × efficiency) so maps are comparable; monthly uses the data's range. */
export function scaleFor(kind: CoverageKind, mode: CoverageMode, dataMax: number | null, panelEfficiencyPct = 100): ScaleSpec {
 if (kind === 'power') return { stops: POWER_STOPS, min: 0, max: mode === 'instant' ? Math.max(10, Math.round(1400 * panelEfficiencyPct / 100 / 10) * 10) : Math.max(10, Math.ceil((dataMax ?? 0) / 10) * 10), unit: 'W/m²', blockedBelowZero: false };
 if (kind === 'comms' && mode === 'instant') return { stops: MARGIN_STOPS, min: 0, max: MARGIN_FULL_DEG, unit: '° margin', blockedBelowZero: true };
 return { stops: PERCENT_STOPS, min: 0, max: 100, unit: '%', blockedBelowZero: false };
}

const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

export function colorAt(stops: Stops, f: number): [number, number, number] {
 const x = Math.min(1, Math.max(0, f));
 for (let i = 1; i < stops.length; i++) {
  if (x <= stops[i][0]) {
   const [f0, c0] = stops[i - 1], [f1, c1] = stops[i];
   const t = f1 === f0 ? 0 : (x - f0) / (f1 - f0);
   const a = hex(c0), b = hex(c1);
   return [0, 1, 2].map(k => Math.round(a[k] + (b[k] - a[k]) * t)) as [number, number, number];
  }
 }
 return hex(stops[stops.length - 1][1]);
}

/** RGBA pixels for a value grid; NaN cells are fully transparent. */
export function colorize(values: Float32Array, spec: ScaleSpec, alpha = 190): Uint8Array {
 const out = new Uint8Array(values.length * 4);
 const blocked = hex(BLOCKED_COLOR);
 for (let i = 0; i < values.length; i++) {
  const v = values[i];
  if (!Number.isFinite(v)) continue;
  const c = spec.blockedBelowZero && v <= 0 ? blocked : colorAt(spec.stops, (v - spec.min) / (spec.max - spec.min));
  out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = alpha;
 }
 return out;
}

/** CSS gradient for a legend bar. */
export function cssGradient(stops: Stops): string {
 return `linear-gradient(90deg, ${stops.map(([f, c]) => `${c} ${(f * 100).toFixed(0)}%`).join(', ')})`;
}

export function decodeF32(b64: string): Float32Array {
 const bin = atob(b64);
 const bytes = new Uint8Array(bin.length);
 for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
 return new Float32Array(bytes.buffer);
}

/** Diviner surface temperature (K): cold traps deep blue through daytime highlands red. */
export const THERMAL_MIN_K = 20;
export const THERMAL_MAX_K = 400;
export const THERMAL_STOPS: Stops = [[0, '#0b0d3a'], [0.08, '#2b2f9e'], [0.21, '#2f86c4'], [0.34, '#4fb7a5'], [0.6, '#f0d55c'], [0.82, '#e8913b'], [1, '#c8553d']];
export const thermalSpec = (): ScaleSpec => ({ stops: THERMAL_STOPS, min: THERMAL_MIN_K, max: THERMAL_MAX_K, unit: 'K', blockedBelowZero: false });

/** Permanent shadow: fraction of each cell shadowed → highlight colour with opacity proportional to the fraction. */
export const PSR_COLOR = '#b36bff';
export function psrRgba(fraction: Float32Array, maxAlpha = 235): Uint8Array {
 const out = new Uint8Array(fraction.length * 4);
 const [r, g, b] = [0xb3, 0x6b, 0xff];
 for (let i = 0; i < fraction.length; i++) {
  const f = fraction[i];
  if (!Number.isFinite(f) || f <= 0) continue;
  out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b;
  out[i * 4 + 3] = Math.round(maxAlpha * Math.min(1, 0.35 + 0.65 * f)); // even partly shadowed cells stay visible
 }
 return out;
}
