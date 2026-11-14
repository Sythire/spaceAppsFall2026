import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colorAt, colorize, decodeF32, MARGIN_FULL_DEG, PERCENT_STOPS, POWER_STOPS, scaleFor } from '../src/utils/coverageColors.ts';
import { DEFAULT_EQUIPMENT, validateEquipment } from '../src/pages/LunarMap/EquipmentPanel.tsx';
import { dailySummary } from '../src/pages/LunarMap/SiteCoveragePanel.tsx';
import type { SiteCoverage } from '../src/types/index.ts';

test('defaults are flat panel and 0° receiver mask, both 1 m off the ground', () => {
 assert.deepEqual(DEFAULT_EQUIPMENT, { panelTiltDeg: 0, panelHeightM: 1, commMaskDeg: 0, commHeightM: 1 });
});

test('equipment text inputs are parsed and range-checked', () => {
 assert.deepEqual(validateEquipment({ panelTiltDeg: '35', panelHeightM: '2.5', commMaskDeg: '5', commHeightM: '10' }).value,
  { panelTiltDeg: 35, panelHeightM: 2.5, commMaskDeg: 5, commHeightM: 10 });
 for (const bad of [{ panelTiltDeg: '91' }, { panelTiltDeg: '-1' }, { panelHeightM: 'abc' }, { commMaskDeg: '' }, { commHeightM: '1001' }, { commMaskDeg: '-6' }]) {
  const r = validateEquipment({ panelTiltDeg: '0', panelHeightM: '1', commMaskDeg: '0', commHeightM: '1', ...bad });
  assert.equal(r.value, null, JSON.stringify(bad));
  assert.match(r.error, /must be/);
 }
});

test('float32 grids survive the base64 round trip, including NaN', () => {
 const src = new Float32Array([0, 1.5, -2.25, NaN, 1400]);
 const b64 = Buffer.from(src.buffer).toString('base64');
 const out = decodeF32(b64);
 assert.equal(out.length, 5);
 assert.deepEqual([...out.slice(0, 3)], [0, 1.5, -2.25]);
 assert.ok(Number.isNaN(out[3]));
});

test('scales: power uses the physical range now and a data-driven range monthly; comms instant is a margin', () => {
 assert.equal(scaleFor('power', 'instant', 200).max, 1400);
 assert.equal(scaleFor('power', 'monthly', 612).max, 650);
 assert.equal(scaleFor('power', 'monthly', null).max, 50);
 const m = scaleFor('comms', 'instant', null);
 assert.ok(m.blockedBelowZero && m.max === MARGIN_FULL_DEG);
 assert.equal(scaleFor('comms', 'monthly', null).unit, '%');
 assert.equal(scaleFor('sunlit', 'monthly', null).max, 100);
});

test('colour stops interpolate and clamp', () => {
 assert.deepEqual(colorAt(PERCENT_STOPS, -1), [0xb3, 0x26, 0x1e]);
 assert.deepEqual(colorAt(PERCENT_STOPS, 2), [0x2f, 0xbf, 0x71]);
 assert.deepEqual(colorAt(POWER_STOPS, 1), [0xff, 0xf3, 0xa6]);
 const mid = colorAt([[0, '#000000'], [1, '#ffffff']], 0.5);
 assert.deepEqual(mid, [128, 128, 128]);
});

test('colorize: NaN is transparent, blocked comms are red, values get the layer alpha', () => {
 const rgba = colorize(new Float32Array([NaN, -3, 30]), scaleFor('comms', 'instant', null), 190);
 assert.deepEqual([...rgba.slice(0, 4)], [0, 0, 0, 0]);
 assert.deepEqual([...rgba.slice(4, 8)], [0xb3, 0x26, 0x1e, 190]);
 assert.deepEqual([...rgba.slice(8, 12)], [0x2f, 0xbf, 0x71, 190]);
});

test('daily summary rolls hourly samples into days', () => {
 const hours = 48;
 const d = {
  stepHours: 1,
  series: {
   utc: Array.from({ length: hours }, (_, i) => String(i)),
   sunlit: Array.from({ length: hours }, (_, i) => i < 30),
   powerWm2: Array.from({ length: hours }, (_, i) => (i < 30 ? 100 : 0)),
   earthVisible: Array.from({ length: hours }, () => true),
  },
 } as unknown as SiteCoverage;
 assert.deepEqual(dailySummary(d), [
  { day: 1, sunlitH: 24, energyWh: 2400, earthH: 24 },
  { day: 2, sunlitH: 6, energyWh: 600, earthH: 24 },
 ]);
});

test('PSR highlight: unshadowed and NaN cells are transparent, opacity rises with shadowed share', async () => {
 const { psrRgba } = await import('../src/utils/coverageColors.ts');
 const px = psrRgba(new Float32Array([0, NaN, 0.1, 1]));
 assert.equal(px[3], 0); assert.equal(px[7], 0);
 assert.ok(px[11] > 0 && px[11] < px[15]);
 assert.equal(px[15], 235);
});

test('Diviner temperature scale spans lunar cold traps to daytime highs', async () => {
 const { thermalSpec, colorAt } = await import('../src/utils/coverageColors.ts');
 const s = thermalSpec();
 assert.ok(s.min <= 20 && s.max >= 395 && s.unit === 'K');
 assert.notDeepEqual(colorAt(s.stops, (40 - s.min) / (s.max - s.min)), colorAt(s.stops, (390 - s.min) / (s.max - s.min)));
});

test('saved equipment falls back to defaults when nothing (or garbage) is stored', async () => {
 const { loadSavedEquipment } = await import('../src/pages/LunarMap/EquipmentPanel.tsx');
 const store = new Map<string, string>();
 (globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) } as Storage;
 assert.deepEqual(loadSavedEquipment(), DEFAULT_EQUIPMENT);
 store.set('lunarsite.explorer.equipment.v1', JSON.stringify({ equipment: { panelTiltDeg: 45, commMaskDeg: 500 } }));
 assert.deepEqual(loadSavedEquipment(), DEFAULT_EQUIPMENT); // out-of-range value rejects the whole set
 store.set('lunarsite.explorer.equipment.v1', JSON.stringify({ equipment: { panelTiltDeg: 45 } }));
 assert.equal(loadSavedEquipment().panelTiltDeg, 45);
});
