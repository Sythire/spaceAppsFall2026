import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { ModelManifest, SceneSample, SpiceQuat, Vec3 } from '../../../types';

/**
 * Sun-centric three.js scene focused on the Moon.
 *
 * Coordinates are heliocentric ECLIPJ2000 (Sun at the origin, ecliptic plane horizontal). To keep the
 * Moon precise and the camera locked on it, rendering uses a floating origin: the Moon's center is drawn
 * at the world origin and the whole heliocentric system (Sun, planets, orbits) is translated by minus the
 * Moon's position. That is a pure translation, so every direction and orbit is exactly as in the Sun frame.
 *
 * The Moon group is rotated by SPICE's MOON_ME -> ECLIPJ2000 attitude, so lunar lat/lon, sites and the
 * texture turn with the real Moon. SPICE Z-up axes map to three.js Y-up as (X, Y, Z) -> (X, Z, -Y).
 * One scene unit is one mean lunar radius.
 */
export const MOON_RADIUS_KM = 1737.4;
const AU_KM = 149597870.7;
export type ScaleMode = 'compact' | 'true';
type BodyKey = 'sun' | 'earth' | 'mars';

const RADIUS_KM: Record<BodyKey, number> = { sun: 695700, earth: 6371.0, mars: 3389.5 };
/** Compact mode: 1 AU = 60 units, Moon drawn 7 units from Earth along its true direction, bodies enlarged. */
const COMPACT = { auUnits: 60, moonOffset: 7, radius: { sun: 5, earth: 1.4, mars: 0.8 } as Record<BodyKey, number> };
const FALLBACK_COLOR: Record<BodyKey | 'moon', number> = { moon: 0x8a8a8a, earth: 0x2f6fb5, mars: 0xb5532f, sun: 0xffd27a };
const SPICE_TO_THREE = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const THREE_TO_SPICE = SPICE_TO_THREE.clone().invert();

/** SPICE (X, Y, Z-up) vector to three.js (Y-up). Used for both MOON_ME and ECLIPJ2000 vectors. */
export function moonMeToThree(v: Vec3): THREE.Vector3 { return new THREE.Vector3(v[0], v[2], -v[1]); }
export function latLonToThree(latDeg: number, lonDeg: number, r = 1): THREE.Vector3 {
 const lat = THREE.MathUtils.degToRad(latDeg), lon = THREE.MathUtils.degToRad(lonDeg);
 return moonMeToThree([r * Math.cos(lat) * Math.cos(lon), r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat)]);
}
export function threeToLatLon(p: THREE.Vector3): { latitudeDeg: number; longitudeDeg: number } {
 const X = p.x, Y = -p.z, Z = p.y, r = p.length();
 return { latitudeDeg: THREE.MathUtils.radToDeg(Math.asin(Z / r)), longitudeDeg: THREE.MathUtils.radToDeg(Math.atan2(Y, X)) };
}
/** SPICE frame rotation quaternion (w, x, y, z) expressed in three.js axes. */
function spiceQuatToThree(q: SpiceQuat): THREE.Quaternion {
 const [w, x, y, z] = q;
 return SPICE_TO_THREE.clone().multiply(new THREE.Quaternion(x, y, z, w)).multiply(THREE_TO_SPICE);
}

export interface SceneMarker { id: string; name: string; latitudeDeg: number; longitudeDeg: number; }
export interface SceneOptions { grid: boolean; paths: boolean; labels: boolean; scale: ScaleMode; }
export type ModelStatus = Record<BodyKey | 'moon', 'loading' | 'model' | 'fallback'>;

export class MoonScene {
 private renderer: THREE.WebGLRenderer;
 private labelRenderer: CSS2DRenderer;
 private scene = new THREE.Scene();
 private camera: THREE.PerspectiveCamera;
 private controls: OrbitControls;
 private sunLight = new THREE.DirectionalLight(0xffffff, 3.2);
 /** Moon-fixed (MOON_ME) content, rotated into the Sun frame, always at the world origin. */
 private moonFrame = new THREE.Group();
 private moon = new THREE.Group();
 /** Heliocentric content: Sun at this group's origin; translated so the Moon sits at the world origin. */
 private helio = new THREE.Group();
 private bodies: Record<BodyKey, THREE.Group> = { sun: new THREE.Group(), earth: new THREE.Group(), mars: new THREE.Group() };
 private earthSpin = new THREE.Group();
 private labels: CSS2DObject[] = [];
 /** Labels on the lunar surface; hidden when on the far side or when their layer is off. */
 private surfaceLabels: { label: CSS2DObject; grid: boolean }[] = [];
 private grid = new THREE.Group();
 private paths = new THREE.Group();
 private markers = new THREE.Group();
 private site = new THREE.Group();
 private siteArrows: { sun: THREE.ArrowHelper; earth: THREE.ArrowHelper };
 private raycaster = new THREE.Raycaster();
 private frame = 0;
 private flight: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null;
 private lastFrame = performance.now();
 private options: SceneOptions = { grid: false, paths: true, labels: true, scale: 'compact' };
 private sample: SceneSample | null = null;
 private pathSamples: SceneSample[] = [];
 private orbitSamples: SceneSample[] = [];
 private pointerDown: { x: number; y: number } | null = null;
 private resizeObserver: ResizeObserver;
 private disposed = false;
 private framed = false;
 private moonLabel!: CSS2DObject;

 constructor(private container: HTMLElement, private onPick: (lat: number, lon: number) => void,
  private onMarker: (id: string) => void, private onModelStatus: (status: ModelStatus) => void) {
  this.renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(this.renderer.domElement);
  this.labelRenderer = new CSS2DRenderer();
  this.labelRenderer.domElement.className = 'scene-labels';
  container.appendChild(this.labelRenderer.domElement);

  this.camera = new THREE.PerspectiveCamera(45, 1, 0.001, 5e6);
  this.camera.position.set(0, 3, 9);
  this.controls = new OrbitControls(this.camera, this.renderer.domElement);
  this.controls.enableDamping = true;
  this.controls.minDistance = 1.08;
  this.controls.maxDistance = 400;
  this.controls.rotateSpeed = 0.5;
  this.controls.zoomSpeed = 0.8;
  this.controls.target.set(0, 0, 0); // the Moon

  this.scene.background = new THREE.Color(0x02040a);
  // Faint fill so the night side is not pure black; the Sun's directional light sets the real terminator.
  this.scene.add(new THREE.AmbientLight(0xffffff, 0.06), this.sunLight, this.sunLight.target);
  this.moonFrame.add(this.moon, this.grid, this.markers, this.site);
  this.helio.add(this.paths, ...Object.values(this.bodies));
  this.scene.add(this.moonFrame, this.helio);
  this.bodies.earth.add(this.earthSpin);

  this.fallbackSphere(this.moon, 1, FALLBACK_COLOR.moon);
  this.fallbackSphere(this.earthSpin, 1, FALLBACK_COLOR.earth);
  this.fallbackSphere(this.bodies.mars, 1, FALLBACK_COLOR.mars);
  this.fallbackSphere(this.bodies.sun, 1, FALLBACK_COLOR.sun, true);
  this.addLabel(this.bodies.earth, 'Earth', 'earth');
  this.addLabel(this.bodies.sun, 'Sun', 'sun');
  this.addLabel(this.bodies.mars, 'Mars', 'mars');
  this.moonLabel = this.addLabel(this.moonFrame, 'Moon', 'moon');
  this.moonLabel.center.set(0.5, 3.2);
  this.buildGrid();
  this.siteArrows = {
   sun: new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 0.35, 0xffc857, 0.06, 0.035),
   earth: new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 0.35, 0x6fb7ff, 0.06, 0.035),
  };
  this.buildSite();

  const el = this.renderer.domElement;
  el.addEventListener('pointerdown', this.handleDown);
  el.addEventListener('pointerup', this.handleUp);
  this.resizeObserver = new ResizeObserver(() => this.resize());
  this.resizeObserver.observe(container);
  this.resize();
  this.applyScale();
  this.loop();
 }

 // ---------- models ----------
 private fallbackSphere(parent: THREE.Object3D, radius: number, color: number, emissive = false) {
  const material = emissive
   ? new THREE.MeshBasicMaterial({ color })
   : new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), material);
  mesh.name = 'fallback';
  parent.add(mesh);
 }

 async loadModels(manifest: ModelManifest, resolve: (path: string) => string) {
  const status: ModelStatus = { moon: 'fallback', earth: 'fallback', sun: 'fallback', mars: 'fallback' };
  const loader = new GLTFLoader();
  const targets: [keyof ModelManifest, THREE.Object3D][] = [
   ['moon', this.moon], ['earth', this.earthSpin], ['sun', this.bodies.sun], ['mars', this.bodies.mars],
  ];
  for (const [key] of targets) if (manifest[key]) status[key] = 'loading';
  this.onModelStatus({ ...status });
  await Promise.all(targets.map(async ([key, parent]) => {
   const path = manifest[key];
   if (!path) return;
   try {
    const gltf = await loader.loadAsync(resolve(path));
    if (this.disposed) return;
    const model = gltf.scene;
    // Normalize to unit radius around the origin so the export's units do not matter.
    const sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
    model.position.sub(sphere.center);
    const wrapper = new THREE.Group();
    wrapper.add(model);
    wrapper.scale.setScalar(1 / sphere.radius);
    if (key === 'moon') model.traverse(o => {
     const mesh = o as THREE.Mesh;
     if (mesh.isMesh) this.capTexture((mesh.material as THREE.MeshStandardMaterial).map);
    });
    if (key === 'sun') model.traverse(o => {
     const mesh = o as THREE.Mesh;
     if (mesh.isMesh) {
      const m = mesh.material as THREE.MeshStandardMaterial;
      // The Sun export carries its texture as emissive with a black base color; show it unlit.
      const tex = m.emissiveMap ?? m.map ?? null;
      mesh.material = new THREE.MeshBasicMaterial({ map: tex, color: tex ? 0xffffff : FALLBACK_COLOR.sun });
     }
    });
    parent.children.filter(c => c.name === 'fallback').forEach(c => parent.remove(c));
    parent.add(wrapper);
    status[key] = 'model';
   } catch {
    status[key] = 'fallback';
   }
   this.onModelStatus({ ...status });
  }));
 }

 /** Downscale very large textures in memory (the 15k Moon map is ~450 MB of GPU memory at full size). */
 private capTexture(tex: THREE.Texture | null | undefined, limit = 8192) {
  const img = tex?.image as (HTMLImageElement | ImageBitmap | undefined);
  if (!tex || !img || !img.width) return;
  const max = Math.min(limit, this.renderer.capabilities.maxTextureSize);
  if (img.width <= max && img.height <= max) return;
  const k = max / Math.max(img.width, img.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * k);
  canvas.height = Math.round(img.height * k);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  if ('close' in img) img.close();
  tex.image = canvas;
  tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
  tex.needsUpdate = true;
 }

 // ---------- static helpers ----------
 private addLabel(parent: THREE.Object3D, text: string, kind: string) {
  const div = document.createElement('div');
  div.className = 'scene-label scene-label-' + kind;
  div.textContent = text;
  const label = new CSS2DObject(div);
  label.center.set(0, 1.6);
  parent.add(label);
  this.labels.push(label);
  return label;
 }

 private buildGrid() {
  const mat = new THREE.LineBasicMaterial({ color: 0x5fa8b0, transparent: true, opacity: 0.28 });
  const prime = new THREE.LineBasicMaterial({ color: 0xe2bd7c, transparent: true, opacity: 0.6 });
  const r = 1.004;
  for (let lat = -60; lat <= 60; lat += 30) {
   const pts = Array.from({ length: 181 }, (_, i) => latLonToThree(lat, -180 + i * 2, r));
   this.grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lat === 0 ? prime : mat));
  }
  for (let lon = -180; lon < 180; lon += 30) {
   const pts = Array.from({ length: 91 }, (_, i) => latLonToThree(-90 + i * 2, lon, r));
   this.grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lon === 0 ? prime : mat));
  }
  const tag = (text: string, lat: number, lon: number) => {
   const div = document.createElement('div');
   div.className = 'scene-label scene-label-grid';
   div.textContent = text;
   const o = new CSS2DObject(div);
   o.position.copy(latLonToThree(lat, lon, 1.02));
   this.grid.add(o);
   this.surfaceLabels.push({ label: o, grid: true });
  };
  tag('N pole', 90, 0); tag('S pole', -90, 0); tag('0°E', 0, 0); tag('90°E', 0, 90); tag('180°', 0, 180); tag('90°W', 0, -90);
 }

 private buildSite() {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.045, 48),
   new THREE.MeshBasicMaterial({ color: 0xe2bd7c, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthTest: false }));
  ring.renderOrder = 3;
  ring.name = 'ring';
  // Local horizon plane: tangent disk at the site.
  const horizon = new THREE.Mesh(new THREE.CircleGeometry(0.18, 64),
   new THREE.MeshBasicMaterial({ color: 0xe2bd7c, side: THREE.DoubleSide, transparent: true, opacity: 0.12, depthWrite: false }));
  horizon.name = 'horizon';
  this.site.add(ring, horizon, this.siteArrows.sun, this.siteArrows.earth);
  this.site.visible = false;
 }

 // ---------- public API ----------
 setOptions(next: Partial<SceneOptions>) {
  const scaleChanged = next.scale && next.scale !== this.options.scale;
  this.options = { ...this.options, ...next };
  this.grid.visible = this.options.grid;
  this.paths.visible = this.options.paths;
  for (const l of this.labels) l.visible = this.options.labels;
  if (scaleChanged) { this.applyScale(); this.buildPaths(); this.applySample(); this.resetView(); }
  this.applySample();
 }

 /** Short window (the playback range): draws the Moon's path through the Sun frame. */
 setPathSamples(samples: SceneSample[]) { this.pathSamples = samples; this.buildPaths(); }
 /** Long, coarse window (~2 years): draws full Earth and Mars orbits around the Sun. */
 setOrbitSamples(samples: SceneSample[]) { this.orbitSamples = samples; this.buildPaths(); }

 setSample(sample: SceneSample) {
  this.sample = sample;
  this.applySample();
  if (!this.framed && !this.flight && !this.site.visible) { this.camera.position.copy(this.moonViewPosition()); this.framed = true; }
 }

 setMarkers(markers: SceneMarker[], selectedId: string | null) {
  this.markers.clear();
  this.surfaceLabels = this.surfaceLabels.filter(l => l.grid);
  for (const m of markers) {
   const p = latLonToThree(m.latitudeDeg, m.longitudeDeg, 1.003);
   const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12),
    new THREE.MeshBasicMaterial({ color: m.id === selectedId ? 0xe2bd7c : 0x7fe0d0 }));
   dot.position.copy(p);
   dot.userData.markerId = m.id;
   const glow = new THREE.Mesh(new THREE.RingGeometry(0.016, 0.03, 32),
    new THREE.MeshBasicMaterial({ color: 0x7fe0d0, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
   glow.position.copy(p);
   glow.lookAt(p.clone().multiplyScalar(2));
   glow.userData.pulse = Math.random() * Math.PI * 2;
   const div = document.createElement('div');
   div.className = 'scene-label scene-label-site';
   div.textContent = m.name;
   const label = new CSS2DObject(div);
   label.position.copy(p.clone().multiplyScalar(1.01));
   label.center.set(-0.08, 0.5);
   this.surfaceLabels.push({ label, grid: false });
   this.markers.add(dot, glow, label);
  }
 }

 setSite(lat: number | null, lon: number | null) {
  if (lat === null || lon === null) { this.site.visible = false; return; }
  const up = latLonToThree(lat, lon, 1);
  this.site.visible = true;
  this.site.position.copy(up.clone().multiplyScalar(1.002));
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
  this.site.getObjectByName('ring')!.quaternion.copy(q);
  this.site.getObjectByName('horizon')!.quaternion.copy(q);
  this.applySample();
 }

 /** Fly to look straight down on a lunar site; the site's direction follows the Moon's current attitude. */
 flyTo(lat: number, lon: number, distance = 1.9) {
  this.framed = true;
  const to = latLonToThree(lat, lon, distance).applyQuaternion(this.moonFrame.quaternion);
  this.flight = { from: this.camera.position.clone(), to, t: 0 };
 }

 /** Close Moon view from the sunlit side, tilted toward ecliptic north, with Earth roughly in frame. */
 private moonViewPosition(): THREE.Vector3 {
  const dist = this.options.scale === 'true' ? 6 : 12;
  const s = this.sample;
  if (!s) return new THREE.Vector3(0, 0.4, 1).normalize().multiplyScalar(dist);
  const toSun = moonMeToThree(s.helio.moon).negate().normalize();
  const toEarth = moonMeToThree([s.helio.earth[0] - s.helio.moon[0], s.helio.earth[1] - s.helio.moon[1], s.helio.earth[2] - s.helio.moon[2]]).normalize();
  return toSun.multiplyScalar(0.55).add(toEarth.multiplyScalar(-0.25)).add(new THREE.Vector3(0, 0.6, 0)).normalize().multiplyScalar(dist);
 }

 resetView() {
  this.flight = { from: this.camera.position.clone(), to: this.moonViewPosition(), t: 0 };
 }

 /** Pull back to see the Sun and orbits while still orbiting around the Moon. */
 systemView() {
  const dist = this.options.scale === 'true' ? 2.2e5 : 150;
  const s = this.sample;
  const toSun = s ? moonMeToThree(s.helio.moon).negate().normalize() : new THREE.Vector3(1, 0, 0);
  this.flight = { from: this.camera.position.clone(), to: toSun.multiplyScalar(0.35).add(new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(dist), t: 0 };
 }

 dispose() {
  this.disposed = true;
  cancelAnimationFrame(this.frame);
  this.resizeObserver.disconnect();
  this.renderer.domElement.removeEventListener('pointerdown', this.handleDown);
  this.renderer.domElement.removeEventListener('pointerup', this.handleUp);
  this.controls.dispose();
  this.scene.traverse(o => {
   const mesh = o as THREE.Mesh;
   if (mesh.geometry) mesh.geometry.dispose();
   const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
   (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach(m => {
    Object.values(m).forEach(v => { if (v instanceof THREE.Texture) v.dispose(); });
    m.dispose();
   });
  });
  this.renderer.dispose();
  this.renderer.domElement.remove();
  this.labelRenderer.domElement.remove();
 }

 // ---------- internals ----------
 /** Heliocentric display position (Sun at origin) for a heliocentric km vector. */
 private helioDisplay(km: Vec3): THREE.Vector3 {
  const v = moonMeToThree(km);
  if (this.options.scale === 'true') return v.multiplyScalar(1 / MOON_RADIUS_KM);
  const r = v.length();
  return r === 0 ? v : v.multiplyScalar((COMPACT.auUnits * (r / AU_KM)) / r);
 }

 /** The Moon's display position: true scale, or Earth's compact position plus an enlarged true offset. */
 private moonDisplay(s: SceneSample): THREE.Vector3 {
  if (this.options.scale === 'true') return this.helioDisplay(s.helio.moon);
  const offset = moonMeToThree([s.helio.moon[0] - s.helio.earth[0], s.helio.moon[1] - s.helio.earth[1], s.helio.moon[2] - s.helio.earth[2]]);
  return this.helioDisplay(s.helio.earth).add(offset.normalize().multiplyScalar(COMPACT.moonOffset));
 }

 private applyScale() {
  for (const key of Object.keys(this.bodies) as BodyKey[]) {
   const r = this.options.scale === 'true' ? RADIUS_KM[key] / MOON_RADIUS_KM : COMPACT.radius[key];
   const target = key === 'earth' ? this.earthSpin : this.bodies[key];
   target.scale.setScalar(r);
  }
  this.controls.maxDistance = this.options.scale === 'true' ? 3e5 : 400;
 }

 private buildPaths() {
  this.paths.clear();
  const line = (pts: THREE.Vector3[], color: number, opacity: number) => this.paths.add(new THREE.Line(
   new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity })));
  if (this.orbitSamples.length > 1) {
   line(this.orbitSamples.map(s => this.helioDisplay(s.helio.earth)), 0x6fb7ff, 0.35);
   line(this.orbitSamples.map(s => this.helioDisplay(s.helio.mars)), 0xd27a5a, 0.35);
  }
  if (this.pathSamples.length > 1) line(this.pathSamples.map(s => this.moonDisplay(s)), 0xe6e6e6, 0.6);
 }

 private applySample() {
  const s = this.sample;
  if (!s) return;
  // Heliocentric system, translated so the Moon is at the world origin.
  this.helio.position.copy(this.moonDisplay(s)).negate();
  this.bodies.sun.position.set(0, 0, 0);
  this.bodies.earth.position.copy(this.helioDisplay(s.helio.earth));
  this.bodies.mars.position.copy(this.helioDisplay(s.helio.mars));
  // The Moon's true attitude in the Sun frame (includes libration and its 27.3-day spin).
  this.moonFrame.quaternion.copy(spiceQuatToThree(s.moonRotationQuat));
  this.earthSpin.quaternion.copy(spiceQuatToThree(s.earthRotationQuat));
  // Sunlight arrives from the Sun's true direction as seen from the Moon.
  const toSun = moonMeToThree(s.helio.moon).negate().normalize();
  this.sunLight.position.copy(toSun.multiplyScalar(50));
  this.sunLight.target.position.set(0, 0, 0);
  if (this.site.visible) {
   // Site arrows live in the Moon-fixed group, so use the Moon-fixed (MOON_ME) vectors directly.
   const sitePos = this.site.position;
   for (const key of ['sun', 'earth'] as const) {
    const target = moonMeToThree(s[key]).multiplyScalar(1 / MOON_RADIUS_KM);
    this.siteArrows[key].setDirection(target.sub(sitePos).normalize());
   }
  }
 }

 private handleDown = (e: PointerEvent) => { this.pointerDown = { x: e.clientX, y: e.clientY }; };
 private handleUp = (e: PointerEvent) => {
  const d = this.pointerDown;
  this.pointerDown = null;
  if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return; // drag, not click
  const rect = this.renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  this.raycaster.setFromCamera(ndc, this.camera);
  const markerHit = this.raycaster.intersectObjects(this.markers.children.filter(c => c.userData.markerId), false)[0];
  if (markerHit) { this.onMarker(markerHit.object.userData.markerId as string); return; }
  const hit = this.raycaster.intersectObject(this.moon, true)[0];
  if (hit) {
   const ll = threeToLatLon(this.moonFrame.worldToLocal(hit.point.clone()));
   this.onPick(ll.latitudeDeg, ll.longitudeDeg);
  }
 };

 private resize() {
  const w = this.container.clientWidth, h = this.container.clientHeight;
  if (!w || !h) return;
  this.renderer.setSize(w, h);
  this.labelRenderer.setSize(w, h);
  this.camera.aspect = w / h;
  this.camera.updateProjectionMatrix();
 }

 private loop = () => {
  this.frame = requestAnimationFrame(this.loop);
  const now = performance.now(), dt = Math.min(1, (now - this.lastFrame) / 1000);
  this.lastFrame = now;
  if (this.flight) {
   this.flight.t = Math.min(1, this.flight.t + dt / 1.4); // 1.4 s flight, independent of frame rate
   const k = 1 - Math.pow(1 - this.flight.t, 3);
   // Arc around the Moon rather than cutting through it; distance eases geometrically for big zooms.
   const len = this.flight.from.length() * Math.pow(this.flight.to.length() / this.flight.from.length(), k);
   this.camera.position.copy(this.flight.from.clone().normalize().lerp(this.flight.to.clone().normalize(), k).normalize().multiplyScalar(len));
   if (this.flight.t >= 1) this.flight = null;
  }
  this.controls.target.set(0, 0, 0); // stay focused on the Moon
  const t = now / 1000;
  for (const c of this.markers.children) if (c.userData.pulse !== undefined) {
   const s = 1 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2.4 + c.userData.pulse));
   c.scale.setScalar(s);
  }
  this.scene.updateMatrixWorld();
  const cam = this.camera.position;
  // Keep the site marker and arrows a readable size regardless of zoom.
  const siteWorld = this.site.getWorldPosition(new THREE.Vector3());
  this.site.scale.setScalar(THREE.MathUtils.clamp(cam.distanceTo(siteWorld) / 1.6, 0.08, 1.4));
  this.controls.zoomSpeed = THREE.MathUtils.clamp(cam.length() / 4, 0.15, 1.2);
  // The Moon label only helps when zoomed out; up close it would cover the surface.
  this.moonLabel.visible = this.options.labels && cam.length() > 4;
  const p = new THREE.Vector3();
  for (const { label, grid } of this.surfaceLabels) {
   label.getWorldPosition(p);
   const facing = cam.clone().sub(p).dot(p) > 0;
   label.visible = this.options.labels && (!grid || this.options.grid) && facing;
  }
  this.controls.update();
  this.renderer.render(this.scene, this.camera);
  this.labelRenderer.render(this.scene, this.camera);
 };
}
