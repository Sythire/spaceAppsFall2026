import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ELEVATION_STOPS, elevationColor, latLonToThree, moonMeToThree, spiceQuatToThree, threeToLatLon } from '../src/pages/LunarMap/scene/MoonScene.ts';
import { formatCountdown, formatUtc, sampleAt } from '../src/utils/sceneTime.ts';
import { mapLayers } from '../src/constants/mockData.ts';
import type { SceneSample, SpiceQuat } from '../src/types/index.ts';

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const closeVec = (a: THREE.Vector3, b: THREE.Vector3, eps = 1e-9) => { close(a.x, b.x, eps); close(a.y, b.y, eps); close(a.z, b.z, eps); };

// ---------- coordinate conversions ----------
test('SPICE Z-up vectors map to three.js Y-up as (X, Z, -Y)', () => {
 closeVec(moonMeToThree([1, 2, 3]), new THREE.Vector3(1, 3, -2));
});

test('lat/lon conversion preserves radius and handles the poles and dateline', () => {
 for (const [lat, lon, r] of [[90, 0, 1], [-90, 0, 2], [0, 180, 1], [0, -179.999, 1.5], [33.3, -16, 1.01]]) {
  const v = latLonToThree(lat, lon, r);
  close(v.length(), r, 1e-12);
  const ll = threeToLatLon(v);
  close(ll.latitudeDeg, lat, 1e-9);
  if (Math.abs(lat) < 90) close(((ll.longitudeDeg - lon + 540) % 360) - 180, 0, 1e-9); // 180 == -180
 }
});

test('identity SPICE quaternion is the identity rotation', () => {
 const q = spiceQuatToThree([1, 0, 0, 0]);
 closeVec(new THREE.Vector3(0.3, -0.2, 0.9).applyQuaternion(q), new THREE.Vector3(0.3, -0.2, 0.9));
});

test('SPICE quaternions keep their meaning after conversion to three.js axes', () => {
 // +90° about SPICE Z rotates SPICE X onto SPICE Y; the same must hold after both are mapped to three.js.
 const s = Math.SQRT1_2;
 const q: SpiceQuat = [s, 0, 0, s];
 const rotated = moonMeToThree([1, 0, 0]).applyQuaternion(spiceQuatToThree(q));
 closeVec(rotated, moonMeToThree([0, 1, 0]), 1e-12);
 // and SPICE Z (north) is unchanged
 closeVec(moonMeToThree([0, 0, 1]).applyQuaternion(spiceQuatToThree(q)), moonMeToThree([0, 0, 1]), 1e-12);
});

// ---------- elevation colour scale ----------
test('elevation colour stops ascend and cover the Moon\'s height range', () => {
 for (let i = 1; i < ELEVATION_STOPS.length; i++) assert.ok(ELEVATION_STOPS[i][0] > ELEVATION_STOPS[i - 1][0]);
 assert.ok(ELEVATION_STOPS[0][0] <= -8900, 'covers Antoniadi (-8.98 km)');
 assert.ok(ELEVATION_STOPS[ELEVATION_STOPS.length - 1][0] >= 10680, 'covers Selenean summit (+10.69 km)');
});

test('elevationColor clamps outside the range and interpolates inside it', () => {
 const c = new THREE.Color();
 assert.equal(elevationColor(-20000, c).getHexString(), new THREE.Color(ELEVATION_STOPS[0][1]).getHexString());
 assert.equal(elevationColor(20000, c).getHexString(), 'ffffff');
 const [h0, c0] = ELEVATION_STOPS[2], [h1, c1] = ELEVATION_STOPS[3];
 const mid = elevationColor((h0 + h1) / 2, new THREE.Color());
 const expected = new THREE.Color(c0).lerp(new THREE.Color(c1), 0.5);
 close(mid.r, expected.r, 1e-6); close(mid.g, expected.g, 1e-6); close(mid.b, expected.b, 1e-6);
});

// ---------- time interpolation ----------
const mk = (utc: string, x: number, q: SpiceQuat = [1, 0, 0, 0]): SceneSample => ({
 utc, sun: [x, 0, 0], earth: [0, x, 0], mars: [0, 0, x],
 helio: { moon: [x, x, 0], earth: [x, 0, 0], mars: [0, x, 0] }, moonRotationQuat: q, earthRotationQuat: q,
 site: { sun: { elevationDeg: x, azimuthDeg: 0 }, earth: { elevationDeg: -x, azimuthDeg: 0 } },
});
const samples = [mk('2026-11-14T00:00:00.000Z', 0), mk('2026-11-14T01:00:00.000Z', 10), mk('2026-11-14T02:00:00.000Z', 20)];

test('sampleAt clamps before the first and after the last sample', () => {
 assert.equal(sampleAt(samples, -3).utc, samples[0].utc);
 assert.equal(sampleAt(samples, 99).utc, samples[2].utc);
 assert.deepEqual(sampleAt(samples, 99).sun, [20, 0, 0]);
});

test('sampleAt takes site angles from the nearest sample (they are not interpolated)', () => {
 assert.equal(sampleAt(samples, 0.4).site?.sun.elevationDeg, 0);
 assert.equal(sampleAt(samples, 0.6).site?.sun.elevationDeg, 10);
});

test('sampleAt interpolates heliocentric positions', () => {
 assert.deepEqual(sampleAt(samples, 1.5).helio.moon, [15, 15, 0]);
});

test('quaternion slerp takes the short way when signs flip and stays unit length', () => {
 const a: SpiceQuat = [1, 0, 0, 0];
 const b: SpiceQuat = [-Math.cos(0.1), 0, 0, -Math.sin(0.1)]; // same rotation family as +0.2 rad, opposite sign
 const s = sampleAt([mk('2026-11-14T00:00:00Z', 0, a), mk('2026-11-14T01:00:00Z', 0, b)], 0.5);
 const q = s.moonRotationQuat;
 close(Math.hypot(...q), 1, 1e-9);
 assert.ok(q[0] > 0.99, 'stays near identity instead of swinging through 180°');
});

test('formatCountdown handles zero, minutes, hours and days', () => {
 assert.equal(formatCountdown('2026-11-14T12:00:00Z', '2026-11-14T12:00:00Z'), '0 min');
 assert.equal(formatCountdown('2026-11-14T12:00:00Z', '2026-11-14T12:45:00Z'), '45 min');
 assert.equal(formatCountdown('2026-11-14T12:00:00Z', '2026-11-15T13:00:00Z'), '1 d 1 h');
});

test('formatUtc trims to minutes and labels UTC', () => {
 assert.equal(formatUtc('2026-11-14T12:34:56.789Z'), '2026-11-14 12:34 UTC');
});

// ---------- layer catalogue ----------
test('all four map layers are available', () => {
 const byId = Object.fromEntries(mapLayers.map(l => [l.id, l.available]));
 assert.deepEqual(byId, { illumination: true, elevation: true, power: true, 'earth-visibility': true });
});

// ---------- compact scale ----------
test('compact scale keeps true Moon/Earth/Mars size ratios and only compresses distance', async () => {
 const { COMPACT_SCALE, MOON_RADIUS_KM } = await import('../src/pages/LunarMap/scene/MoonScene.ts');
 close(COMPACT_SCALE.radius.earth, 6371.0 / MOON_RADIUS_KM, 1e-9); // ~3.67
 close(COMPACT_SCALE.radius.mars, 3389.5 / MOON_RADIUS_KM, 1e-9);  // ~1.95
 // The Moon (radius 1) never touches the Earth, and the capped Sun stays well inside Earth's orbit.
 assert.ok(COMPACT_SCALE.moonOffset > COMPACT_SCALE.radius.earth + 1 + 5);
 assert.ok(COMPACT_SCALE.radius.sun < COMPACT_SCALE.auUnits / 4);
});

// ---------- star sphere orientation ----------
test('J2000 -> ecliptic rotation puts the celestial north pole at ecliptic lat 66.56°, lon 90°', async () => {
 const { j2000ToEclipticQuat, OBLIQUITY_J2000_DEG } = await import('../src/pages/LunarMap/scene/MoonScene.ts');
 const e = THREE.MathUtils.degToRad(OBLIQUITY_J2000_DEG);
 const ncp = moonMeToThree([0, 0, 1]).applyQuaternion(j2000ToEclipticQuat());
 closeVec(ncp, moonMeToThree([0, Math.sin(e), Math.cos(e)]), 1e-12);
});

test('Galactic centre (RA 266.405°, Dec -28.936°) lands at ecliptic lon ~266.84°, lat ~-5.54°', async () => {
 const { j2000ToEclipticQuat } = await import('../src/pages/LunarMap/scene/MoonScene.ts');
 const ra = THREE.MathUtils.degToRad(266.405), dec = THREE.MathUtils.degToRad(-28.936);
 const v = moonMeToThree([Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)]).applyQuaternion(j2000ToEclipticQuat());
 const ll = threeToLatLon(v); // same lat/lon maths, here ecliptic latitude/longitude
 close(ll.latitudeDeg, -5.54, 0.02);
 close((ll.longitudeDeg + 360) % 360, 266.84, 0.02);
});
