import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildRoomShell } from './models/shell.js';
import { FURNITURE_BUILDERS } from './models/furniture.js';
import { buildTwinBed } from './models/bed.js';
import { buildRug } from './models/rugs.js';
import { buildFromParts, buildArt, PARTS_FORMAT_DOC, validateParts } from './models/parts.js';
import { openFindDialog } from './finds.js';
import { Store } from './store.js';
import * as S from './state.js';
import { Editor } from './edit.js';
import { UI } from './ui.js';

const PLAN_FOV = 18;      // degrees, for the near-orthographic plan view

// ---------------------------------------------------------------- helpers
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
function kelvinToColor(k) {
  // Tanner Helland's approximation, good enough for 2200-6500 K lamps
  const t = k / 100;
  let r, g, b;
  if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04; }
  else { r = 329.7 * Math.pow(t - 60, -0.1332); g = 288.12 * Math.pow(t - 60, -0.0755); b = 255; }
  const c = v => Math.min(255, Math.max(0, v)) / 255;
  return new THREE.Color(c(r), c(g), c(b));
}
// Cut-away walls must disappear for the camera but keep casting shadows, so sunlight still only
// comes in through the window. three.js filters shadow casters by the *main* camera's layers, so
// instead of layers we swap in an invisible material (no color, no depth) while hidden.
const GHOST = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
function setGhostDeep(obj, ghost) {
  obj.traverse(o => {
    if (!o.isMesh) return;
    if (ghost) {
      if (o.userData.ghost) return;
      o.userData._mat = o.material;
      o.material = Array.isArray(o.material) ? o.material.map(() => GHOST) : GHOST;
      o.userData.ghost = true;
    } else if (o.userData.ghost) {
      o.material = o.userData._mat;
      delete o.userData._mat;
      o.userData.ghost = false;
    }
  });
}
function disposeDeep(obj) {
  if (!obj) return;
  if (obj.userData?.dispose) { try { obj.userData.dispose(); } catch { /* ignore */ } return; }
  obj.traverse(o => {
    o.geometry?.dispose?.();
    const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(mm => mm.dispose?.());
  });
}

// Time-of-day keyframes: t = 0 (7am) … 1 (9pm, dark)
const DAY_KEYS = [
  { t: 0.00, label: '7 am',  sun: 1.4, sunCol: '#ffd3a3', elev: 10, az: 1.0,  hemi: 0.55, sky: '#ffe2c4' },
  { t: 0.25, label: '10 am', sun: 2.8, sunCol: '#fff0dc', elev: 34, az: 0.5,  hemi: 0.85, sky: '#ffffff' },
  { t: 0.50, label: '1 pm',  sun: 3.2, sunCol: '#fff7ec', elev: 52, az: 0.0,  hemi: 0.95, sky: '#ffffff' },
  { t: 0.75, label: '5 pm',  sun: 2.4, sunCol: '#ffe3c0', elev: 26, az: -0.6, hemi: 0.8,  sky: '#fff1e0' },
  { t: 0.88, label: '7 pm',  sun: 0.8, sunCol: '#ffae78', elev: 6,  az: -1.0, hemi: 0.42, sky: '#f7b48c' },
  { t: 1.00, label: '9 pm',  sun: 0.0, sunCol: '#000000', elev: 4,  az: -1.0, hemi: 0.10, sky: '#1b2142' },
];
function dayAt(t) {
  let i = 0;
  while (i < DAY_KEYS.length - 2 && t > DAY_KEYS[i + 1].t) i++;
  const a = DAY_KEYS[i], b = DAY_KEYS[i + 1];
  const k = smooth(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))));
  const col = (x, y) => new THREE.Color(x).lerp(new THREE.Color(y), k);
  return {
    sun: lerp(a.sun, b.sun, k), sunCol: col(a.sunCol, b.sunCol), elev: lerp(a.elev, b.elev, k),
    az: lerp(a.az, b.az, k), hemi: lerp(a.hemi, b.hemi, k), sky: col(a.sky, b.sky),
  };
}

// ---------------------------------------------------------------- app
class App {
  constructor() {
    this.objects = new Map();      // uid -> Object3D
    this.buildSeq = new Map();     // uid -> latest build token
    this.store = new Store();
    this.history = new S.History();
    this.view = 'dollhouse';
    this.tween = null;
    this.needsRender = true;
    this.wallHidden = { north: false, east: false, south: false, west: false };
    this.ceilingShown = true;
  }

  async boot() {
    const [room, catalog] = await Promise.all([
      fetch('data/room.json').then(r => r.json()),
      fetch('data/catalog.json').then(r => r.json()).catch(() => []),
    ]);
    this.room = room;
    this.builtinCatalog = Array.isArray(catalog) ? catalog : (catalog.items || []);
    this.quality = this.detectQuality();

    this.setupRenderer();
    this.setupScene();
    this.setupLights();

    this.shell = buildRoomShell(room, this.ctx);
    this.scene.add(this.shell.group);
    this.shell.group.traverse(o => { if (o.isMesh && o.userData.pick?.type === 'wall') o.castShadow = true; });
    this.shell.ceiling.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.wallMountFrames();

    // Every visit opens on the room as it is today (the "Today" preset, furniture where it was scanned).
    // Versions A/B and anything saved in the Saved tab are one tap away.
    this.state = S.makeDefaultState(room);
    S.applyLayout(room, this.state, 'as_scanned');
    S.applyPreset(room, this.state, 'Today');

    this.editor = new Editor(this);
    this.ui = new UI(this);
    this.applyAll();
    this.setView('dollhouse', false);

    this.store.addEventListener('versions', () => this.ui.renderSaved());
    this.store.addEventListener('catalog', () => { this.ui.renderLook(); this.ui.renderThings(); this.syncItems(); });
    this.store.addEventListener('caps', () => this.ui.renderCaps());
    this.store.init();
    // Don't lose the last 400 ms of edits when the tab is hidden or closed.
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.flushSave(); });
    window.addEventListener('pagehide', () => this.flushSave());

    document.getElementById('loading')?.remove();
    this.loop();
    this.maybeAutoRender();
  }

  detectQuality() {
    const touch = navigator.maxTouchPoints > 0;
    const small = Math.min(screen.width, screen.height) < 700;
    const mem = navigator.deviceMemory || 8;
    return (touch && small) || mem < 4 ? 'low' : 'high';
  }

  // ---------------------------------------------------------- renderer & scene
  setupRenderer() {
    const stage = document.getElementById('stage');
    this.stage = stage;
    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality === 'low' ? 1.5 : 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;     // keeps the pale pinks true (ACES greys them)
    r.toneMappingExposure = 1;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    stage.prepend(r.domElement);
    r.domElement.setAttribute('tabindex', '0');
    this.renderer = r;

    const loader = new THREE.TextureLoader();
    const aniso = Math.min(8, r.capabilities.getMaxAnisotropy());
    const apply = (tex, { srgb = true, repeat, wrap = 'repeat' } = {}) => {
      tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.anisotropy = aniso;
      const w = wrap === 'clamp' ? THREE.ClampToEdgeWrapping : wrap === 'mirror' ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
      tex.wrapS = tex.wrapT = w;
      if (repeat) tex.repeat.set(repeat[0], repeat[1]);
      return tex;
    };
    this.ctx = {
      makeCanvas: (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; },
      canvasTexture: (canvas, opts) => apply(new THREE.CanvasTexture(canvas), opts),
      loadTexture: (url, opts) => apply(loader.load(url, () => this.requestRender()), opts),
      anisotropy: aniso,
      quality: this.quality,
    };

    new ResizeObserver(() => this.resize()).observe(stage);
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.updateSceneBg();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', () => this.updateSceneBg());
    new MutationObserver(() => this.updateSceneBg()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.32;

    this.camera = new THREE.PerspectiveCamera(this.room.cameras.fov_deg || 50, 1, 0.05, 80);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.minDistance = 0.05;
    this.controls.maxDistance = 16;
    this.controls.screenSpacePanning = true;
    this.controls.addEventListener('change', () => this.requestRender());
    this.controls.addEventListener('start', () => { this.tween = null; document.getElementById('hint')?.remove(); });

    // Overlay group for selection outlines and measurement lines (never shadowed)
    this.overlay = new THREE.Group();
    this.overlay.renderOrder = 10;
    this.scene.add(this.overlay);
    this.resize();
  }

  updateSceneBg() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--scene-bg').trim() || '#e7e1e6';
    if (this.scene) { this.scene.background = new THREE.Color(v); this.requestRender(); }
  }

  setupLights() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(0xf3f6ff, 0xe6dfd6, 1.1);   // neutral, so paint colors stay true
    s.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.12);
    s.add(this.ambient);

    const sun = new THREE.DirectionalLight(0xfff1dc, 3);
    sun.castShadow = true;
    const sm = this.quality === 'low' ? 1024 : 2048;
    sun.shadow.mapSize.set(sm, sm);
    const cam = sun.shadow.camera;
    cam.left = -3.4; cam.right = 3.4; cam.top = 3.4; cam.bottom = -3.4; cam.near = 0.5; cam.far = 20;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.025;
    sun.shadow.radius = 4;
    sun.target.position.set(0, 0, -0.2);
    s.add(sun, sun.target);
    this.sun = sun;
  }

  resize() {
    if (!this.renderer) return;
    const w = this.stage.clientWidth || 1, h = this.stage.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  requestRender() { this.needsRender = true; }

  // ---------------------------------------------------------- walls
  wallMountFrames() {
    this.wallFrames = {};
    for (const id of S.WALL_IDS) {
      const w = this.shell.walls[id];
      w.mount.updateWorldMatrix(true, false);
      const origin = new THREE.Vector3().setFromMatrixPosition(w.mount.matrixWorld);
      const right = new THREE.Vector3(1, 0, 0).transformDirection(w.mount.matrixWorld);
      this.wallFrames[id] = { origin, right, length: w.length };
    }
  }
  /** World "along" coordinate (x for north/south walls, z for east/west) -> mount-local x. */
  alongToLocal(wall, along) {
    const f = this.wallFrames[wall];
    const p = (wall === 'north' || wall === 'south')
      ? new THREE.Vector3(along, 0, f.origin.z) : new THREE.Vector3(f.origin.x, 0, along);
    return p.sub(f.origin).dot(f.right);
  }
  localToAlong(wall, u) {
    const f = this.wallFrames[wall];
    const p = f.origin.clone().addScaledVector(f.right, u);
    return (wall === 'north' || wall === 'south') ? p.x : p.z;
  }

  // ---------------------------------------------------------- catalog
  allCatalog() { return [...this.builtinCatalog, ...this.store.catalog]; }
  catalogEntry(ref) { return this.allCatalog().find(e => e.id === ref) || null; }
  furnitureSpec(id) { return this.room.furniture.find(f => f.id === id); }

  /** The new bed's spec at the chosen size (twin or full), as the builder and editor need it. */
  bedSpec(size = this.state?.bedSize || 'twin') {
    const base = this.furnitureSpec('twin_bed');
    const o = base.size_options?.[size] || base.size_options?.twin;
    if (!o) return base;
    const spec = JSON.parse(JSON.stringify(base));
    spec.w = o.w;
    spec.geometry.mattress.w = o.mattress_w;
    spec.geometry.headboard_channels = o.headboard_channels;
    return spec;
  }

  /** Switch the new bed between twin and full, keeping the side that's against a wall in place. */
  setBedSize(size) {
    this.change(s => S.resizeBed(this.room, s, size), { finishes: false });
    const bed = this.state.items.find(i => i.uid === 'twin_bed');
    const hit = bed && !bed.removed && this.editor.overlapOf(bed);
    this.ui.toast(hit ? `A ${size} bed overlaps the ${this.itemName(hit).toLowerCase()} here — drag one of them` : `Bed is now ${size === 'full' ? 'a full (double)' : 'a twin'}`);
  }

  itemName(item) {
    if (!item) return '';
    if (item.type === 'furniture' || item.type === 'bed') {
      const short = { twin_bed: this.state?.bedSize === 'full' ? 'New full bed' : 'New twin bed', dresser: 'Dresser', bookshelf: 'Bookshelf', glider: 'Glider', step_stool: 'Step stool', toddler_bed: 'Toddler bed', storage_cube: 'Storage cube' };
      return short[item.ref] || this.furnitureSpec(item.ref)?.label || item.ref;
    }
    if (item.type === 'rug') return this.rugName(item);
    const e = this.catalogEntry(item.ref);
    return item.name || e?.name || 'Item';
  }

  rugName(item) {
    if (item.kind?.startsWith('custom:')) return this.catalogEntry(item.kind.slice(7))?.name || 'Rug';
    const o = this.room.new_items.rug_options.find(r => r.id === item.kind);
    return ({ beige_scalloped: 'Beige scalloped rug', woodland_unicorn: 'Woodland unicorn rug', navy_shag_current: 'Navy shag rug' })[item.kind] || o?.label || 'Rug';
  }

  // ---------------------------------------------------------- building items
  drapeFor(item, width) {
    // Tuck a long side of the bed that sits within 5 cm of a wall.
    const r = this.room.room;
    const yaw = THREE.MathUtils.degToRad(item.yaw);
    const sideOffset = (width ?? this.bedSpec().w) / 2;
    const near = sgn => {
      const nx = item.x + Math.cos(yaw) * sideOffset * sgn;
      const nz = item.z - Math.sin(yaw) * sideOffset * sgn;
      return nx < r.x_west + 0.05 || nx > r.x_east - 0.05 || nz < r.z_south + 0.05 || nz > r.z_north - 0.05;
    };
    return { left: !near(-1), right: !near(1) };
  }

  buildKey(item) {
    switch (item.type) {
      case 'bed': return JSON.stringify(['bed', this.state.bedding, this.state.bedSize || 'twin', this.drapeFor(item)]);
      case 'rug': return JSON.stringify(['rug', item.kind, item.sizeFt, !!this.catalogEntry(item.kind?.slice?.(7))]);
      default: return JSON.stringify([item.type, item.ref, !!this.catalogEntry(item.ref), item.size || null]);
    }
  }

  async buildObject(item) {
    const ctx = this.ctx, room = this.room;
    if (item.type === 'furniture') {
      const b = FURNITURE_BUILDERS[item.ref];
      return b ? b(this.furnitureSpec(item.ref), ctx) : null;
    }
    if (item.type === 'bed') {
      const spec = this.bedSpec();
      const bedding = this.state.bedding || 'lavender_pompom';
      const beddingSpec = room.new_items.bedding_options.find(b => b.id === bedding) || null;
      return buildTwinBed(spec, ctx, { bedding, beddingSpec, floralTextureUrl: 'textures/floral_comforter_tile_seamless.jpg', drape: this.drapeFor(item) });
    }
    if (item.type === 'rug') {
      if (item.kind?.startsWith('custom:')) {
        const e = this.catalogEntry(item.kind.slice(7));
        if (!e) return null;
        const url = await this.store.imageUrl(e.image);
        return buildRug({ kind: 'image', sizeFt: item.sizeFt, spec: null, image: url, binding: e.binding || null }, ctx);
      }
      const spec = room.new_items.rug_options.find(r => r.id === item.kind) || null;
      const image = item.kind === 'woodland_unicorn' ? 'textures/rug_woodland_unicorn_topdown.jpg' : null;
      return buildRug({ kind: item.kind, sizeFt: item.sizeFt, spec, image }, ctx);
    }
    const e = this.catalogEntry(item.ref);
    if (!e) return null;
    let entry = e;
    if (item.size) entry = { ...e, ...item.size };
    const image = e.image ? await this.store.imageUrl(e.image) : null;
    if (e.kind === 'art') return buildArt(entry, ctx, image ? { image } : {});
    if (e.category === 'rug') return null;
    return buildFromParts(validateParts(entry).fixed || entry, ctx, image ? { image } : {});
  }

  isWallItem(item) {
    if (item.type === 'wall') return true;
    // item.wall/mount also count while the catalog entry is still loading
    if (item.type === 'catalog') return item.mount === 'wall' || item.wall != null || this.catalogEntry(item.ref)?.mount === 'wall';
    return false;
  }

  /** True when the item's catalog entry isn't loaded (yet), so there's nothing to build. */
  entryMissing(item) {
    if (item.type === 'furniture' || item.type === 'bed') return false;
    if (item.type === 'rug') return !!item.kind?.startsWith?.('custom:') && !this.catalogEntry(item.kind.slice(7));
    return !this.catalogEntry(item.ref);
  }

  placeObject(item, obj) {
    if (this.isWallItem(item)) {
      const wall = this.shell.walls[item.wall] || this.shell.walls.north;
      if (obj.parent !== wall.mount) wall.mount.add(obj);
      obj.position.set(this.alongToLocal(item.wall, item.along), item.y, 0.004);
      obj.rotation.set(0, 0, 0);
      setGhostDeep(obj, !!this.wallHidden[item.wall]);
    } else {
      if (obj.parent !== this.scene) this.scene.add(obj);
      obj.position.set(item.x, item.type === 'rug' ? 0.0005 : (item.elev || 0), item.z);
      obj.rotation.set(0, THREE.MathUtils.degToRad(item.yaw || 0), 0);
    }
    obj.visible = !(this.isArt(item) && !this.state.artVisible);
  }

  isArt(item) { return item.type === 'wall' && this.catalogEntry(item.ref)?.kind === 'art'; }

  /** Bring the scene in line with state.items. Builds what's missing or changed. */
  syncItems() {
    this.editor?.settleStacks(this.state);   // things on top follow their surface, or drop when it's gone
    const live = new Set();
    for (const item of this.state.items) {
      if (item.removed) continue;
      live.add(item.uid);
      if (this.entryMissing(item)) continue;   // the 'catalog' event re-syncs once it loads
      const key = this.buildKey(item);
      const obj = this.objects.get(item.uid);
      if (obj && obj.userData.buildKey === key) {
        this.buildSeq.set(item.uid, (this.buildSeq.get(item.uid) || 0) + 1);   // drop any in-flight stale build
        this.placeObject(item, obj);
        this.applyItemColor(item, obj);
        continue;
      }
      const token = (this.buildSeq.get(item.uid) || 0) + 1;
      this.buildSeq.set(item.uid, token);
      Promise.resolve(this.buildObject(item)).then(newObj => {
        if (this.buildSeq.get(item.uid) !== token) { disposeDeep(newObj); return; }
        const cur = this.state.items.find(i => i.uid === item.uid);
        const old = this.objects.get(item.uid);
        if (!newObj || !cur || cur.removed) { if (newObj) disposeDeep(newObj); return; }
        if (old) { old.removeFromParent(); disposeDeep(old); }
        newObj.userData.buildKey = key;
        newObj.userData.uid = item.uid;
        newObj.traverse(o => { if (o.isMesh) { o.userData.itemUid = item.uid; if (o.castShadow === undefined) o.castShadow = true; } });
        this.objects.set(item.uid, newObj);
        this.placeObject(cur, newObj);
        this.applyItemColor(cur, newObj);
        this.applyLampState();
        this.editor.onObjectRebuilt(item.uid);
        this.requestRender();
      }).catch(err => {
        console.warn('Could not build', item.uid, err);
        this.ui?.toast(`Couldn’t draw ${this.itemName(item)}`);
      });
    }
    for (const [uid, obj] of this.objects) {
      // keep buildSeq so a restored item's tokens never repeat
      if (!live.has(uid)) { obj.removeFromParent(); disposeDeep(obj); this.objects.delete(uid); }
    }
    this.requestRender();
  }

  applyItemColor(item, obj) {
    // sheets / comforter are cheap material tints, so set them every sync
    obj.userData.setSheetColor?.(item.sheetColor || null);
    obj.userData.setComforterColor?.(item.comforterColor || null);
    const set = obj.userData.setColor;
    if (!set) return;
    const want = item.color || null;
    if (obj.userData.appliedColor === want) return;
    if (want) set(want);
    else if (obj.userData.appliedColor) {
      // back to the original: rebuild by invalidating the key
      obj.userData.buildKey = 'stale';
      queueMicrotask(() => this.syncItems());
    }
    obj.userData.appliedColor = want;
  }

  // ---------------------------------------------------------- finishes & lighting
  applyFinishes() {
    const s = this.state;
    for (const w of S.WALL_IDS) this.shell.setWallColor(w, s.wallColors[w]);
    this.shell.setDecals(!!s.decals);
    this.shell.setCurtains(!!s.curtains);
    this.shell.setCurtainColor(s.curtainColor || null);
    this.updateCeiling(true);
    this.requestRender();
  }

  applyLighting() {
    const L = this.state.lighting;
    const d = dayAt(L.time);
    const r = this.renderer;
    r.toneMappingExposure = L.exposure;
    this.hemi.intensity = d.hemi * 1.25;
    this.hemi.color.set(0xf3f6ff).lerp(new THREE.Color('#38406a'), 1 - Math.min(1, d.hemi / 0.8));
    this.ambient.intensity = 0.06 + 0.08 * d.hemi;
    this.sun.intensity = d.sun * 2.2;
    this.sun.color.copy(d.sunCol);
    this.sun.visible = d.sun > 0.01;
    // Sun sits outside the north window and shines in.
    const elev = THREE.MathUtils.degToRad(d.elev), dist = 9;
    this.sun.position.set(d.az * 3.2, Math.sin(elev) * dist + 0.4, 1.72 + Math.cos(elev) * dist);
    this.sun.target.position.set(d.az * 0.6, 0, -0.4);
    this.sun.target.updateMatrixWorld();
    // Window backdrop follows the sky
    this.tintSky(d.sky);
    const kc = kelvinToColor(L.warmth);
    this.shell.setFanLight(L.ceilingOn, L.ceilingLevel, '#' + kc.getHexString());
    this.shell.fanLight.intensity = L.ceilingOn ? L.ceilingLevel * 6 : 0;
    this.shell.fanLight.color.copy(kc);
    this.applyLampState();
    this.requestRender();
  }

  tintSky(color) {
    if (!this._skyMats) {
      this._skyMats = [];
      this.shell.walls.north.group.traverse(o => {
        const m = o.userData?._mat || o.material;
        if (o.isMesh && m?.isMeshBasicMaterial && m.map) {
          o.updateWorldMatrix(true, false);
          const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
          if (p.z > this.room.room.z_north + 0.3) this._skyMats.push(m);
        }
      });
    }
    for (const m of this._skyMats) m.color.copy(color);
  }

  applyLampState() {
    const L = this.state.lighting;
    for (const [uid, obj] of this.objects) {
      const set = obj.userData.setLight;
      if (!set) continue;
      const item = this.state.items.find(i => i.uid === uid);
      const on = L.lampsOn && item?.lampOn !== false;
      set(on, 0.8);
    }
  }

  applyAll() {
    this.applyFinishes();
    this.applyLighting();
    this.syncItems();
    this.ui.renderAll();
  }

  // ---------------------------------------------------------- state changes
  /** Every user change goes through here: snapshot for undo, mutate, re-sync, save. */
  change(mutate, { history = true, finishes = true, lighting = false, items = true } = {}) {
    const before = history ? JSON.stringify(this.state) : null;
    mutate(this.state);
    if (history && JSON.stringify(this.state) !== before) this.history.push(before);
    if (finishes) this.applyFinishes();
    if (lighting) this.applyLighting();
    if (items) this.syncItems();
    this.saveSoon();
    this.ui.renderAll();
    this.editor.refresh();
  }

  saveSoon() {
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => { this._saveT = null; this.store.saveWorking(this.state); }, 400);
  }

  flushSave() {
    if (!this._saveT) return;
    clearTimeout(this._saveT);
    this._saveT = null;
    this.store.saveWorking(this.state);
  }

  replaceState(next) {
    this.state = S.normalizeState(this.room, next);
    this.editor.select(null);
    this.applyAll();
    this.saveSoon();
  }

  undo() { const s = this.history.undo(this.state); if (s) this.replaceState(s); }
  redo() { const s = this.history.redo(this.state); if (s) this.replaceState(s); }

  applyPreset(key) {
    this.change(s => {
      if (key === 'Today' && !s.bedding) s.bedding = 'lavender_pompom';
      // Presets clear the dragged flag first so the rug goes to its default center.
      const rug = s.items.find(i => i.uid === 'rug');
      if (rug) rug.moved = false;
      if (key === 'Today') {
        // Today = the room as it really is: toddler bed back, furniture in its scanned spots and colors.
        S.applyLayout(this.room, s, 'as_scanned');
        for (const it of s.items) if (it.type === 'furniture' || it.type === 'bed') delete it.color;
      } else if (s.layout === 'as_scanned') {
        // Coming back from Today: the new bed returns.
        S.applyLayout(this.room, s, 'planned');
      }
      S.applyPreset(this.room, s, key);
    });
    this.ui.toast(key === 'Today' ? 'Showing the room as it is today' : `Showing Version ${key}`);
  }

  applyLayout(name) {
    this.change(s => S.applyLayout(this.room, s, name));
    if (name === 'as_scanned') this.change(s => S.applyPreset(this.room, s, 'Today'), { history: false });
    this.ui.toast(name === 'planned' ? 'Layout reset to the plan' : 'Showing the room as scanned');
  }

  // ---------------------------------------------------------- adding things
  addFromCatalog(entry) {
    const uid = S.newUid(entry.mount === 'wall' || entry.kind === 'art' ? 'wall' : 'cat');
    let item;
    if (entry.category === 'rug') {
      this.change(s => {
        const rug = s.items.find(i => i.uid === 'rug');
        rug.kind = `custom:${entry.id}`;
        delete rug.color;
        rug.sizeFt = entry.sizeFt || [5, 7];
        rug.removed = false;
        const c = S.clampRugCenter(this.room, rug.sizeFt, rug.x, rug.z, rug.yaw);
        rug.x = c.x; rug.z = c.z;
      });
      this.editor.select('rug');
      return;
    }
    if (entry.mount === 'wall' || entry.kind === 'art') {
      const wall = this.facingWall();
      item = { uid, type: entry.kind === 'art' ? 'wall' : 'catalog', ref: entry.id, mount: 'wall', wall, along: 0, y: entry.y || 1.5, removed: false };
    } else {
      const spot = this.freeFloorSpot(entry);
      item = { uid, type: 'catalog', ref: entry.id, x: spot.x, z: spot.z, yaw: spot.yaw, removed: false };
    }
    this.change(s => { s.items.push(item); });
    this.editor.select(uid);
    this.ui.toast(`Added ${entry.name} · drag it where you want it`);
  }

  /** The wall most directly in front of the camera (for new wall art). */
  facingWall() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    let best = 'north', bestDot = -Infinity;
    for (const id of S.WALL_IDS) {
      if (this.wallHidden[id]) continue;
      const out = this.shell.walls[id].outward;
      const d = dir.dot(out);
      if (d > bestDot) { bestDot = d; best = id; }
    }
    return best;
  }

  freeFloorSpot(entry) {
    const target = this.controls.target;
    const candidates = [[target.x, target.z], [0, 0.2], [-0.5, 0.6], [0.6, 0.4], [0, -0.3], [-0.6, -0.4]];
    for (const [x, z] of candidates) {
      const p = this.editor.clampFloor({ x, z, yaw: 0 }, entry.w || 0.5, entry.d || 0.5);
      if (!this.editor.overlapsAny(p.x, p.z, 0, entry.w || 0.5, entry.d || 0.5, null)) return { ...p, yaw: 0 };
    }
    return { x: 0, z: 0.2, yaw: 0 };
  }

  duplicate(uid) {
    const it = this.state.items.find(i => i.uid === uid);
    if (!it || it.type === 'rug' || it.type === 'bed' || it.type === 'furniture') return;
    const copy = JSON.parse(JSON.stringify(it));
    copy.uid = S.newUid(it.type);
    const d = this.editor.dimsOf(it);
    if (this.isWallItem(it)) {
      const r = this.room.room, ns = copy.wall === 'north' || copy.wall === 'south';
      const lo = ns ? r.x_west : r.z_south, hi = ns ? r.x_east : r.z_north;
      copy.along = Math.min(Math.max((copy.along || 0) + 0.3, lo + d.w / 2), hi - d.w / 2);
    } else {
      const sup = copy.on && this.state.items.find(i => i.uid === copy.on && !i.removed);
      delete copy.was;
      if (sup) {
        // beside the original on the same top if there's room, else on the floor next to it
        const p = this.editor.clampOnto(copy, sup, copy.x + 0.3, copy.z + 0.3);
        const y0 = copy.elev || 0, clear = !this.editor.overlapsAny(p.x, p.z, copy.yaw || 0, d.w, d.d, copy.uid, y0, y0 + d.h);
        if (clear) { copy.x = p.x; copy.z = p.z; }
        else {
          delete copy.on; delete copy.elev;
          const spot = this.editor.floorSpotBeside(copy, sup);
          if (spot) { copy.x = spot.x; copy.z = spot.z; }
        }
      } else {
        delete copy.on; delete copy.elev;
        const p = this.editor.clampFloor({ x: copy.x + 0.3, z: copy.z + 0.3, yaw: copy.yaw || 0 }, d.w, d.d, false);
        copy.x = p.x; copy.z = p.z;
      }
    }
    this.change(s => s.items.push(copy));
    this.editor.select(copy.uid);
  }

  async openFind() {
    const mount = document.getElementById('findmount');
    const entry = await openFindDialog({
      mount,
      sample: this.store.sample,
      canSendImages: this.store.canSendImages,
      partsDoc: PARTS_FORMAT_DOC,
      validateParts,
      saveImage: blob => this.store.saveImage(blob),
      addEntry: e => this.store.addCatalogEntry(e),
      wallIds: S.WALL_IDS,
    });
    if (entry) {
      this.ui.renderThings();
      this.ui.renderLook();
      this.addFromCatalog(entry);
    }
  }

  // ---------------------------------------------------------- cameras
  viewFor(name) {
    const c = this.room.cameras[name];
    const pos = new THREE.Vector3(...c.position), tgt = new THREE.Vector3(...c.target);
    if (name === 'dollhouse' || name === 'top_down') {
      // Back off on portrait screens so the room stays in frame.
      const aspect = this.camera.aspect;
      if (aspect < 1) {
        const k = Math.min(1.75, Math.max(1, 0.8 / aspect));
        pos.sub(tgt).multiplyScalar(k).add(tgt);
      }
    }
    if (name === 'top_down') {
      // Narrow lens from high up reads like a floor plan (walls don't splay out).
      pos.sub(tgt).multiplyScalar(this.room.cameras.fov_deg / PLAN_FOV).add(tgt);
    }
    if (name === 'from_door' || name === 'from_window') {
      // Eye-level views orbit around a point just in front of the eye = look around in place.
      const dir = tgt.clone().sub(pos).normalize();
      tgt.copy(pos).addScaledVector(dir, 0.35);
    }
    return { pos, tgt };
  }

  setView(name, animate = true) {
    this.view = name;
    const { pos, tgt } = this.viewFor(name);
    const eye = name === 'from_door' || name === 'from_window';
    this.controls.minDistance = eye ? 0.05 : 0.6;
    this.controls.enableZoom = true;
    this.controls.zoomSpeed = eye ? 0.4 : 1;
    const fov = name === 'top_down' ? PLAN_FOV : this.room.cameras.fov_deg;
    this.controls.maxDistance = name === 'top_down' ? 40 : 16;
    if (!animate) {
      this.camera.position.copy(pos); this.controls.target.copy(tgt);
      this.camera.fov = fov; this.camera.updateProjectionMatrix(); this.controls.update();
    } else {
      this.tween = { t: 0, p0: this.camera.position.clone(), t0: this.controls.target.clone(), p1: pos, t1: tgt, f0: this.camera.fov, f1: fov };
    }
    this.ui?.renderViewbar();
    this.requestRender();
  }

  // ---------------------------------------------------------- per-frame
  updateCutaway() {
    const cam = this.camera.position;
    const r = this.room.room;
    const inside = cam.x > r.x_west && cam.x < r.x_east && cam.z > r.z_south && cam.z < r.z_north && cam.y < r.ceiling_height;
    let changed = false;
    for (const id of S.WALL_IDS) {
      const w = this.shell.walls[id];
      const hide = !inside && cam.clone().sub(w.center).dot(w.outward) > 0.02;
      if (hide !== this.wallHidden[id]) {
        this.wallHidden[id] = hide;
        setGhostDeep(w.group, hide);
        changed = true;
      }
    }
    if (inside !== this.ceilingShown) { this.ceilingShown = inside; changed = true; this.updateCeiling(); }
    // Seen from above, the window backdrop and hallway are just clutter around the room.
    const above = cam.y > r.ceiling_height + 0.2;
    if (above !== this._above) {
      this._above = above;
      if (!this._outsideBits) {
        this._outsideBits = [];
        this.shell.group.traverse(o => { if (o.name === 'sky_backdrop' || o.name === 'window_stencil' || o.name === 'hallway') this._outsideBits.push(o); });
      }
      for (const o of this._outsideBits) o.visible = !above;
      changed = true;
    }
    if (changed) { this.editor.refresh(); this.requestRender(); }
  }

  updateCeiling() {
    const show = this.ceilingShown && this.view !== 'top_down';
    setGhostDeep(this.shell.ceiling, !show);
    this.shell.fan.visible = !!this.state?.fanVisible && show;
    // Even with the ceiling hidden, the fan's light keeps shining.
    this.shell.fanLight.visible = true;
    this.shell.fanLight.layers.enableAll();
  }

  loop() {
    const tick = () => {
      requestAnimationFrame(tick);
      if (this.tween) {
        const tw = this.tween;
        tw.t = Math.min(1, tw.t + 1 / 45);
        const k = smooth(tw.t);
        this.camera.position.lerpVectors(tw.p0, tw.p1, k);
        this.controls.target.lerpVectors(tw.t0, tw.t1, k);
        this.camera.fov = lerp(tw.f0, tw.f1, k);
        this.camera.updateProjectionMatrix();
        if (tw.t >= 1) this.tween = null;
        this.needsRender = true;
      }
      if (this.controls.update()) this.needsRender = true;
      if (!this.needsRender) return;
      this.needsRender = false;
      this.updateCutaway();
      this.editor.update();
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  // ---------------------------------------------------------- images & versions
  /** Render the current view and return a Blob. maxW downsizes (thumbnails). */
  async capture({ maxW = 0, type = 'image/png', quality = 0.9, hideOverlay = true } = {}) {
    const ov = this.overlay.visible, labels = document.getElementById('labels');
    if (hideOverlay) { this.overlay.visible = false; labels.style.visibility = 'hidden'; }
    this.updateCutaway();
    this.renderer.render(this.scene, this.camera);
    const src = this.renderer.domElement;
    let blob;
    if (maxW && src.width > maxW) {
      const c = document.createElement('canvas');
      c.width = maxW; c.height = Math.round(src.height * maxW / src.width);
      c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
      blob = await new Promise(r => c.toBlob(r, type, quality));
    } else {
      // toBlob copies the canvas bitmap synchronously, right after render()
      blob = await new Promise(r => src.toBlob(r, type, quality));
    }
    this.overlay.visible = ov; labels.style.visibility = '';
    this.requestRender();
    return blob;
  }

  async saveImage() {
    const sel = this.editor.selectedUid;
    this.editor.select(null);
    const blob = await this.capture();
    if (sel) this.editor.select(sel);
    if (!blob) { this.ui.toast('Couldn’t capture the view'); return; }
    const name = `alice-room-${(this.state.preset || 'view').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.png`;
    const res = await this.store.saveFile(name, blob);
    if (res === 'saved') this.ui.toast('Image saved');
    else if (res === 'declined') { /* viewer said no */ }
    else this.ui.showShot(blob, name);
  }

  async saveVersion(name) {
    const sel = this.editor.selectedUid;
    this.editor.select(null);
    const thumbBlob = await this.capture({ maxW: 480, type: 'image/jpeg', quality: 0.82 });
    if (sel) this.editor.select(sel);
    try {
      await this.store.saveVersion({ name, state: JSON.parse(JSON.stringify(this.state)), thumbBlob });
      this.ui.toast(this.store.mode === 'shared' ? `Saved “${name}” for both of you` : `Saved “${name}”`);
    } catch (e) {
      console.warn(e);
      this.ui.toast(e?.code === 'quota_exceeded' ? 'Storage is full: delete an old version first' : 'Couldn’t save that version');
    }
  }

  loadVersion(v) {
    this.history.push(this.state);
    this.replaceState(v.state);
    this.ui.toast(`Opened “${v.name}”`);
  }

  // ---------------------------------------------------------- render URLs (?render=A|B|today)
  async maybeAutoRender() {
    let mode = null;
    try { mode = new URLSearchParams(location.search).get('render'); } catch { /* sandboxed */ }
    if (!mode) return;
    const m = mode.toLowerCase();
    this.state = S.makeDefaultState(this.room);
    if (m === 'today') { S.applyLayout(this.room, this.state, 'as_scanned'); S.applyPreset(this.room, this.state, 'Today'); }
    else S.applyPreset(this.room, this.state, m === 'b' ? 'B' : 'A');
    this.applyAll();
    this.setView('dollhouse', false);
    // wait for async textures/builds
    await new Promise(r => setTimeout(r, 2500));
    this.requestRender();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const blob = await this.capture();
    window.__renderBlob = blob;
    window.__renderDone = true;
  }
}

const app = new App();
window.__app = app;
app.boot().catch(err => {
  console.error(err);
  const el = document.getElementById('loading');
  if (el) el.textContent = 'The room couldn’t load. Try reloading the page.';
});
