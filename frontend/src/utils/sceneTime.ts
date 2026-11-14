import type { SceneSample, SpiceQuat, Vec3 } from '../types';

/** Linear blend between SPICE samples for smooth playback. Sample cadence is hourly, so this is display-only. */
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function slerp(a: SpiceQuat, b: SpiceQuat, t: number): SpiceQuat {
 let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
 const bb: SpiceQuat = dot < 0 ? [-b[0], -b[1], -b[2], -b[3]] : b;
 dot = Math.abs(dot);
 if (dot > 0.9995) {
  const q = a.map((v, i) => v + (bb[i] - v) * t) as SpiceQuat;
  const n = Math.hypot(...q);
  return q.map(v => v / n) as SpiceQuat;
 }
 const theta = Math.acos(dot), s = Math.sin(theta);
 const wa = Math.sin((1 - t) * theta) / s, wb = Math.sin(t * theta) / s;
 return a.map((v, i) => v * wa + bb[i] * wb) as SpiceQuat;
}

/** Blend vectors at a fractional sample index; site angles come from the nearest sample. */
export function sampleAt(samples: SceneSample[], index: number): SceneSample {
 const i = Math.max(0, Math.min(samples.length - 1, Math.floor(index)));
 const j = Math.min(samples.length - 1, i + 1);
 const t = Math.max(0, Math.min(1, index - i));
 const a = samples[i], b = samples[j];
 const nearest = t < 0.5 ? a : b;
 const utc = new Date(Date.parse(a.utc) + (Date.parse(b.utc) - Date.parse(a.utc)) * t).toISOString();
 return { utc, sun: lerp3(a.sun, b.sun, t), earth: lerp3(a.earth, b.earth, t), mars: lerp3(a.mars, b.mars, t),
  helio: { moon: lerp3(a.helio.moon, b.helio.moon, t), earth: lerp3(a.helio.earth, b.helio.earth, t), mars: lerp3(a.helio.mars, b.helio.mars, t) },
  moonRotationQuat: slerp(a.moonRotationQuat, b.moonRotationQuat, t),
  earthRotationQuat: slerp(a.earthRotationQuat, b.earthRotationQuat, t), site: nearest.site };
}

/** "3 d 4 h" style countdown from one UTC instant to another; null when there is no event. */
export function formatCountdown(fromUtc: string, toUtc: string | null): string | null {
 if (!toUtc) return null;
 let minutes = Math.round((Date.parse(toUtc) - Date.parse(fromUtc)) / 60000);
 if (minutes < 0) return null;
 const d = Math.floor(minutes / 1440); minutes -= d * 1440;
 const h = Math.floor(minutes / 60); const m = minutes - h * 60;
 return d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${m} min` : `${m} min`;
}

export const formatUtc = (iso: string) => iso.slice(0, 16).replace('T', ' ') + ' UTC';
