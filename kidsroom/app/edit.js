import * as THREE from 'three';
import { fmtFtIn, FT, IN } from './state.js';

const SNAP = 0.08;          // snap flush to a wall within 8 cm
const TIGHT = 0.46;         // under 18 in reads as a tight squeeze
// Pieces with a flat top that smaller things can sit on (a lamp on the nightstand, a plant on the dresser).
const SURFACE_FURNITURE = new Set(['dresser', 'bookshelf', 'storage_cube']);
const SURFACE_CATALOG = new Set(['nightstand', 'toy_bench', 'cube_shelf_3x2', 'round_pouf']);

/** Corners of a w x d rectangle centered at (x, z) turned by yaw degrees (three.js rotation.y). */
function rectCorners(x, z, yawDeg, w, d) {
  const a = THREE.MathUtils.degToRad(yawDeg);
  const ux = [Math.cos(a), -Math.sin(a)], uz = [Math.sin(a), Math.cos(a)];
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [
    x + sx * w / 2 * ux[0] + sz * d / 2 * uz[0],
    z + sx * w / 2 * ux[1] + sz * d / 2 * uz[1],
  ]);
}
/** Separating-axis test on two convex quads. Returns true when they overlap by more than eps. */
function quadsOverlap(A, B, eps = 0.003) {
  for (const P of [A, B]) {
    for (let i = 0; i < 4; i++) {
      const p = P[i], q = P[(i + 1) % 4];
      const n = [-(q[1] - p[1]), q[0] - p[0]];
      const len = Math.hypot(n[0], n[1]) || 1;
      const proj = Q => Q.map(c => (c[0] * n[0] + c[1] * n[1]) / len);
      const a = proj(A), b = proj(B);
      if (Math.max(...a) - eps <= Math.min(...b) || Math.max(...b) - eps <= Math.min(...a)) return false;
    }
  }
  return true;
}
/** (x, z) in the local frame of a rectangle centered at (cx, cz) turned by yaw degrees. */
function toLocal(x, z, cx, cz, yawDeg) {
  const a = THREE.MathUtils.degToRad(yawDeg), dx = x - cx, dz = z - cz;
  return { lx: dx * Math.cos(a) - dz * Math.sin(a), lz: dx * Math.sin(a) + dz * Math.cos(a) };
}
function fromLocal(lx, lz, cx, cz, yawDeg) {
  const a = THREE.MathUtils.degToRad(yawDeg);
  return { x: cx + lx * Math.cos(a) + lz * Math.sin(a), z: cz - lx * Math.sin(a) + lz * Math.cos(a) };
}
function halfExtents(yawDeg, w, d) {
  const a = THREE.MathUtils.degToRad(yawDeg);
  const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  return { hx: (w / 2) * c + (d / 2) * s, hz: (w / 2) * s + (d / 2) * c };
}

export class Editor {
  constructor(app) {
    this.app = app;
    this.selectedUid = null;     // item uid, or 'wall:north', 'curtains', 'fan'
    this.drag = null;
    this.pointers = new Set();
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.labelsEl = document.getElementById('labels');
    this.labelPool = [];

    // Highlight: outline + translucent fill, drawn on top
    const lineMat = new THREE.LineBasicMaterial({ color: 0x8b5cc6, transparent: true, opacity: 0.95, depthWrite: false });
    this.outline = new THREE.LineLoop(new THREE.BufferGeometry(), lineMat);
    this.outline.renderOrder = 20;
    const fillMat = new THREE.MeshBasicMaterial({ color: 0x8b5cc6, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.fill = new THREE.Mesh(new THREE.BufferGeometry(), fillMat);
    this.fill.renderOrder = 19;
    this.dimLines = new THREE.LineSegments(new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x3b3346, depthTest: false, transparent: true, opacity: 0.75 }));
    this.dimLines.renderOrder = 21;
    app.overlay.add(this.outline, this.fill, this.dimLines);
    this.outline.visible = this.fill.visible = this.dimLines.visible = false;

    const el = app.renderer.domElement;
    el.addEventListener('pointerdown', e => this.onDown(e), { capture: true });
    el.addEventListener('pointermove', e => this.onMove(e));
    el.addEventListener('pointerup', e => this.onUp(e));
    el.addEventListener('pointercancel', e => this.onUp(e, true));
    window.addEventListener('keydown', e => this.onKey(e));
  }

  // ------------------------------------------------------------ geometry helpers
  item(uid = this.selectedUid) { return this.app.state.items.find(i => i.uid === uid) || null; }

  dimsOf(item) {
    const app = this.app;
    const obj = app.objects.get(item.uid);
    if (item.type === 'rug') return { w: item.sizeFt[0] * FT, d: item.sizeFt[1] * FT, h: item.kind === 'navy_shag_current' ? 0.03 : 0.01 };
    if (item.type === 'bed') { const f = app.bedSpec(); return { w: f.w, d: f.d, h: f.h }; }
    if (obj?.userData.size) return { ...obj.userData.size };
    if (item.type === 'furniture') {
      const f = app.furnitureSpec(item.ref);
      return { w: f.w, d: f.d, h: f.h };
    }
    const e = app.catalogEntry(item.ref) || {};
    return { w: e.w || 0.5, d: e.d || 0.05, h: e.h || 0.5, ...(item.size || {}) };
  }

  isFloor(item) { return item && !this.app.isWallItem(item); }

  // ------------------------------------------------------------ stacking (things on top of furniture)
  /** Has a flat top that smaller things can sit on. */
  isSurface(it) {
    if (!it || it.removed || it.type === 'rug' || it.type === 'bed' || !this.isFloor(it)) return false;
    if (it.type === 'furniture') return SURFACE_FURNITURE.has(it.ref);
    const e = this.app.catalogEntry(it.ref);
    return SURFACE_CATALOG.has(it.ref) || e?.surface === true;
  }

  /** Small things (lamps, decor) can sit on a surface; furniture, surfaces and tall pieces stay on the floor. */
  canRest(item) {
    if (!item || item.type === 'rug' || item.type === 'bed' || item.type === 'furniture' || !this.isFloor(item)) return false;
    if (this.isSurface(item)) return false;
    return this.dimsOf(item).h <= 0.9;
  }

  /** A surface's usable top: height above its own base and the w x d area (centered) things can sit on. */
  surfaceTop(it) {
    const d = this.dimsOf(it);
    if (it.type === 'furniture' && it.ref === 'dresser') {
      // changing-table dresser: the top is below the rail, between the end posts (see buildDresser)
      const rail = Math.min(Math.max(d.h * 0.1, 0.06), 0.12), post = Math.min(0.09, d.w * 0.065);
      return { y: d.h - rail, w: d.w - 2 * post, d: d.d - 0.01 };
    }
    return { y: d.h, w: d.w, d: d.d };
  }

  /** Height of a surface's top above the floor. */
  topOf(it) { return (it.elev || 0) + this.surfaceTop(it).y; }

  /** Is (x, z) over sup's top (with a little slack)? */
  overTop(sup, x, z, slack = 0) {
    const t = this.surfaceTop(sup), { lx, lz } = toLocal(x, z, sup.x, sup.z, sup.yaw || 0);
    return Math.abs(lx) <= t.w / 2 + slack && Math.abs(lz) <= t.d / 2 + slack;
  }

  /** uid plus everything resting on it, all the way up. */
  stackOf(uid) {
    const out = new Set([uid]);
    for (let grew = true; grew;) {
      grew = false;
      for (const i of this.app.state.items) if (i.on && out.has(i.on) && !out.has(i.uid)) { out.add(i.uid); grew = true; }
    }
    return out;
  }

  /** Surfaces `item` is small enough to sit on (not itself, nor anything sitting on it). */
  surfacesFor(item) {
    if (!this.canRest(item)) return [];
    const d = this.dimsOf(item), mine = this.stackOf(item.uid);
    const ceiling = this.app.room.room.ceiling_height;
    return this.app.state.items.filter(c => {
      if (mine.has(c.uid) || !this.isSurface(c)) return false;
      const t = this.surfaceTop(c);
      if (this.topOf(c) + d.h > ceiling - 0.02) return false;   // no room under the ceiling
      return d.w * d.d <= 0.8 * t.w * t.d && Math.min(d.w, d.d) <= Math.max(t.w, t.d);
    });
  }

  /** Keep a resting item's footprint on its surface's top. */
  clampOnto(item, sup, x, z) {
    const d = this.dimsOf(item), sd = this.surfaceTop(sup);
    const { lx, lz } = toLocal(x, z, sup.x, sup.z, sup.yaw || 0);
    const { hx, hz } = halfExtents((item.yaw || 0) - (sup.yaw || 0), d.w, d.d);
    const mx = Math.max(0, sd.w / 2 - hx), mz = Math.max(0, sd.d / 2 - hz);
    return fromLocal(Math.min(Math.max(lx, -mx), mx), Math.min(Math.max(lz, -mz), mz), sup.x, sup.z, sup.yaw || 0);
  }

  /**
   * The surface `item` would land on, with the point grabbed at height `gy` above its base kept
   * under the pointer (offset: item centre minus grabbed point). Uses the current pointer ray.
   */
  surfaceUnder(item, gy = 0, offset = { x: 0, z: 0 }) {
    let best = null;
    for (const c of this.surfacesFor(item)) {
      const top = this.topOf(c);
      const p = new THREE.Vector3();
      if (!this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -(top + gy)), p)) continue;
      const cx = p.x + offset.x, cz = p.z + offset.z;
      if (!this.overTop(c, cx, cz)) continue;
      const dist = p.distanceTo(this.ray.ray.origin);
      if (!best || dist < best.dist) best = { sup: c, top, x: cx, z: cz, dist };
    }
    return best;
  }

  /** A clear floor spot just beside `sup` for `item` (front, sides, then back). */
  floorSpotBeside(item, sup) {
    const d = this.dimsOf(item), sd = this.dimsOf(sup), r = this.app.room.room;
    const tries = [[0, 1], [1, 0], [-1, 0], [0, -1]].map(([sx, sz]) =>
      fromLocal(sx * (sd.w / 2 + d.w / 2 + 0.05), sz * (sd.d / 2 + d.d / 2 + 0.05), sup.x, sup.z, sup.yaw || 0))
      .map(p => this.clampFloor({ ...p, yaw: item.yaw || 0 }, d.w, d.d, false))
      .filter(p => p.x > r.x_west && p.x < r.x_east && p.z > r.z_south && p.z < r.z_north);
    return tries.find(p => !this.overlapsAny(p.x, p.z, item.yaw || 0, d.w, d.d, item.uid, 0, d.h)) || tries[0] || null;
  }

  /** Move `uid`'s resting items along when it moves: (x, z, yaw) -> new pose of the base. */
  carryStack(uid, from, to) {
    const da = (to.yaw ?? from.yaw ?? 0) - (from.yaw ?? 0);
    for (const k of this.stackOf(uid)) {
      if (k === uid) continue;
      const it = this.item(k);
      if (!it) continue;
      const { lx, lz } = toLocal(it.x, it.z, from.x, from.z, from.yaw || 0);
      const p = fromLocal(lx, lz, to.x, to.z, to.yaw ?? from.yaw ?? 0);
      it.x = p.x; it.z = p.z;
      if (da) { it.yaw = (((it.yaw || 0) + da) % 360 + 540) % 360 - 180; }
      const obj = this.app.objects.get(k);
      if (obj) this.app.placeObject(it, obj);
    }
  }

  /** After any change: resting items follow their surface's height, and fall to the floor when it's gone. */
  settleStacks(state = this.app.state) {
    const byUid = new Map(state.items.map(i => [i.uid, i]));
    for (let pass = 0; pass < 3; pass++) {
      for (const it of state.items) {
        if (it.removed) continue;   // keeps its link for when it's restored
        if (!it.on && it.was) {
          // its surface was taken away earlier; back on top if it's back and still underneath
          const back = byUid.get(it.was);
          if (back && !back.removed && this.isSurface(back) && this.overTop(back, it.x, it.z, 0.01)) { it.on = it.was; delete it.was; }
          else if (!back) delete it.was;
        }
        if (!it.on) { if (it.elev) delete it.elev; continue; }
        const sup = byUid.get(it.on);
        const ok = sup && !sup.removed && sup.on !== it.uid && this.isSurface(sup) && this.overTop(sup, it.x, it.z, 0.01);
        if (ok) it.elev = this.topOf(sup);
        else {
          if (sup?.removed) it.was = it.on;   // remember, in case the surface comes back
          delete it.on; delete it.elev;
        }
      }
    }
  }

  /** Take a resting item off its surface and set it on the floor just in front of it. */
  putOnFloor(uid) {
    const it0 = this.item(uid);
    if (!it0?.on) return;
    this.app.change(s => {
      const it = s.items.find(i => i.uid === uid), sup = s.items.find(i => i.uid === it.on);
      delete it.on; delete it.elev; delete it.was;
      const spot = sup && this.floorSpotBeside(it, sup);
      if (spot) { it.x = spot.x; it.z = spot.z; }
    }, { finishes: false });
  }

  floorItems(exceptUid) {
    return this.app.state.items.filter(i => !i.removed && i.uid !== exceptUid && i.type !== 'rug' && this.isFloor(i));
  }

  clampFloor(p, w, d, snap = true) {
    const r = this.app.room.room;
    const { hx, hz } = halfExtents(p.yaw || 0, w, d);
    let x = p.x, z = p.z;
    const minX = r.x_west + hx, maxX = r.x_east - hx, minZ = r.z_south + hz, maxZ = r.z_north - hz;
    x = minX > maxX ? 0 : Math.min(Math.max(x, minX), maxX);
    z = minZ > maxZ ? 0 : Math.min(Math.max(z, minZ), maxZ);
    if (snap) {
      if (x - minX < SNAP) x = minX; else if (maxX - x < SNAP) x = maxX;
      if (z - minZ < SNAP) z = minZ; else if (maxZ - z < SNAP) z = maxZ;
    }
    return { x, z };
  }

  /** y0..y1: the item's height range; things above or below it (a lamp on the nightstand) don't count. */
  overlapsAny(x, z, yaw, w, d, exceptUid, y0 = 0, y1 = Infinity) {
    const A = rectCorners(x, z, yaw, w, d);
    for (const it of this.floorItems(exceptUid)) {
      const dd = this.dimsOf(it), b0 = it.elev || 0;
      if (Math.min(y1, b0 + dd.h) - Math.max(y0, b0) < 0.01) continue;
      if (quadsOverlap(A, rectCorners(it.x, it.z, it.yaw || 0, dd.w, dd.d))) return it;
    }
    return null;
  }

  overlapOf(item) {
    if (!item || item.removed || item.type === 'rug' || !this.isFloor(item)) return null;
    const d = this.dimsOf(item), y0 = item.elev || 0;
    return this.overlapsAny(item.x, item.z, item.yaw || 0, d.w, d.d, item.uid, y0, y0 + d.h);
  }

  // ------------------------------------------------------------ picking
  pick(e) {
    this.app.scene.updateMatrixWorld();   // objects moved since the last frame are picked where they are now
    const rect = this.app.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.app.camera);
    const targets = [this.app.shell.group, ...this.app.objects.values()];
    const hits = this.ray.intersectObjects(targets, true);
    for (const h of hits) {
      let o = h.object;
      if (!o.visible || o.userData.ghost) continue;
      let hidden = false;
      for (let p = o; p; p = p.parent) if (!p.visible) { hidden = true; break; }
      if (hidden) continue;
      if (o.userData.itemUid) return { uid: o.userData.itemUid, point: h.point };
      for (let p = o; p; p = p.parent) {
        if (p.userData?.uid) return { uid: p.userData.uid, point: h.point };
        if (p === this.app.shell.fan) return { special: 'fan', point: h.point };
      }
      const pk = o.userData.pick;
      if (pk?.type === 'wall') return { special: `wall:${pk.wall}`, point: h.point };
      if (pk?.type === 'curtains') return { special: 'curtains', point: h.point };
      if (pk?.type === 'floor') return { special: 'floor', point: h.point };
    }
    return null;
  }

  /** Where the pointer ray meets the horizontal plane at height y (the floor by default). */
  floorPoint(e, y = 0) {
    const rect = this.app.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.app.camera);
    const p = new THREE.Vector3();
    return this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p) ? p : null;
  }

  wallPoint(e) {
    // Which visible wall is under the pointer, and where
    const rect = this.app.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.app.camera);
    let best = null;
    for (const id of ['north', 'east', 'south', 'west']) {
      if (this.app.wallHidden[id]) continue;
      const w = this.app.shell.walls[id];
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(w.outward.clone().negate(), w.center);
      const p = new THREE.Vector3();
      if (!this.ray.ray.intersectPlane(plane, p)) continue;
      const dist = p.distanceTo(this.ray.ray.origin);
      // facing the camera only
      if (this.ray.ray.direction.dot(w.outward) <= 0) continue;
      if (!best || dist < best.dist) best = { wall: id, point: p, dist };
    }
    return best;
  }

  // ------------------------------------------------------------ pointer handling
  onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.pointers.add(e.pointerId);
    if (this.pointers.size > 1) { this.cancelDrag(); return; }
    const hit = this.pick(e);
    this.down = { x: e.clientX, y: e.clientY, t: performance.now(), hit };
    const uid = hit?.uid;
    if (!uid) return;
    const item = this.item(uid);
    if (!item) return;
    const canDrag = e.pointerType === 'mouse' || uid === this.selectedUid;
    if (!canDrag) return;
    // Touch/pen: keep OrbitControls tracking this finger (for pinch) until the drag really starts.
    if (e.pointerType === 'mouse') this.app.controls.enabled = false;
    const wall = this.app.isWallItem(item);
    let offset;
    if (wall) {
      const wp = this.wallPoint(e);
      offset = wp ? { along: item.along - (wp.wall === 'north' || wp.wall === 'south' ? wp.point.x : wp.point.z), y: item.y - wp.point.y } : { along: 0, y: 0 };
    } else {
      // keep the grabbed point (say, the lamp shade) under the pointer, at its height above the item's base
      const d0 = this.dimsOf(item), base = item.elev || 0;
      const gy = item.type === 'rug' || !hit.point ? 0 : Math.min(Math.max(hit.point.y - base, 0), d0.h);
      const fp = this.floorPoint(e, base + gy);
      offset = fp ? { x: item.x - fp.x, z: item.z - fp.z, gy } : { x: 0, z: 0, gy: 0 };
    }
    this.drag = { uid, started: false, wall, offset, pointerId: e.pointerId };
    try { e.target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  onMove(e) {
    const dr = this.drag;
    if (!dr || e.pointerId !== dr.pointerId) return;
    if (!dr.started) {
      if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) < 5) return;
      dr.started = true;
      this.app.controls.enabled = false;
      const it0 = this.item(dr.uid);
      dr.snap = {};
      for (const k of ['x', 'z', 'yaw', 'wall', 'along', 'y', 'moved', 'on', 'elev', 'was']) if (it0 && k in it0) dr.snap[k] = it0[k];
      // whatever rests on it moves with it; remember where for a cancelled drag
      dr.kids = [...this.stackOf(dr.uid)].filter(k => k !== dr.uid).map(k => { const c = this.item(k); return c && { uid: k, x: c.x, z: c.z, yaw: c.yaw }; }).filter(Boolean);
      const h = this.app.history, last = h.past[h.past.length - 1];
      dr.future = [...h.future];
      h.push(this.app.state);
      dr.pushed = h.past[h.past.length - 1] !== last;
      if (this.selectedUid !== dr.uid) this.select(dr.uid);
      this.app.stage.style.cursor = 'grabbing';
    }
    const item = this.item(dr.uid);
    if (!item) return;
    const d = this.dimsOf(item);
    if (dr.wall) {
      const wp = this.wallPoint(e);
      if (!wp) return;
      const r = this.app.room.room;
      const ns = wp.wall === 'north' || wp.wall === 'south';
      let along = (ns ? wp.point.x : wp.point.z) + dr.offset.along;
      let y = wp.point.y + dr.offset.y;
      const lo = ns ? r.x_west : r.z_south, hi = ns ? r.x_east : r.z_north;
      along = Math.min(Math.max(along, lo + d.w / 2), hi - d.w / 2);
      y = Math.min(Math.max(y, d.h / 2 + 0.05), r.ceiling_height - d.h / 2 - 0.02);
      item.wall = wp.wall; item.along = along; item.y = y;
    } else {
      const from = { x: item.x, z: item.z, yaw: item.yaw || 0 };
      const gy = dr.offset.gy || 0;
      const fp = this.floorPoint(e, gy);
      if (!fp) return;
      const hit = this.surfaceUnder(item, gy, dr.offset);   // ray was just set by floorPoint
      delete item.was;
      if (hit) {
        const p = this.clampOnto(item, hit.sup, hit.x, hit.z);
        item.x = p.x; item.z = p.z; item.on = hit.sup.uid; item.elev = hit.top;
      } else {
        const p = this.clampFloor({ x: fp.x + dr.offset.x, z: fp.z + dr.offset.z, yaw: item.yaw || 0 }, d.w, d.d);
        item.x = p.x; item.z = p.z;
        delete item.on; delete item.elev;
      }
      if (item.type === 'rug') item.moved = true;
      this.carryStack(item.uid, from, { x: item.x, z: item.z, yaw: item.yaw || 0 });
    }
    const obj = this.app.objects.get(item.uid);
    if (obj) this.app.placeObject(item, obj);
    this.refresh(false);
    this.app.requestRender();
  }

  onUp(e, cancelled = false) {
    this.pointers.delete(e.pointerId);
    const dr = this.drag;
    if (dr && e.pointerId === dr.pointerId) {
      if (cancelled) { this.cancelDrag(); return; }
      this.drag = null;
      this.app.controls.enabled = true;
      this.app.stage.style.cursor = '';
      if (dr.started) {
        this.app.change(() => {}, { history: false, finishes: false });
        return;
      }
      this.select(dr.uid);
      return;
    }
    if (cancelled || !this.down) return;
    const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
    if (moved < 6 && performance.now() - this.down.t < 600) {
      const h = this.down.hit;
      if (h?.uid) this.select(h.uid);
      else if (h?.special && h.special !== 'floor') this.select(h.special);
      else this.select(null);
    }
    this.down = null;
  }

  /** Second finger or pointercancel: put a started drag back where it began, keep the selection. */
  cancelDrag() {
    const dr = this.drag;
    if (!dr) return;
    this.drag = null;
    this.app.controls.enabled = true;
    this.app.stage.style.cursor = '';
    if (!dr.started) return;
    const item = this.item(dr.uid);
    if (item) {
      delete item.on; delete item.elev; delete item.was;
      Object.assign(item, dr.snap);
      const obj = this.app.objects.get(item.uid);
      if (obj) this.app.placeObject(item, obj);
    }
    for (const k of dr.kids || []) {
      const c = this.item(k.uid);
      if (!c) continue;
      Object.assign(c, { x: k.x, z: k.z, yaw: k.yaw });
      const o = this.app.objects.get(c.uid);
      if (o) this.app.placeObject(c, o);
    }
    if (dr.pushed) { this.app.history.past.pop(); this.app.history.future = dr.future; }
    this.refresh();
    this.app.requestRender();
  }

  onKey(e) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (document.querySelector('.find-overlay')) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) this.app.redo(); else this.app.undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); this.app.redo(); return; }
    if (mod) return;
    const item = this.item();
    if (e.key === 'Escape') { this.select(null); return; }
    if (!item) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.remove(item.uid); return; }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); this.rotate(e.shiftKey ? 15 : 90); return; }
    const step = (e.shiftKey ? 6 : 1) * IN;
    const dirs = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (dirs[e.key]) { e.preventDefault(); this.nudge(...dirs[e.key], step, e.repeat); }
  }

  // ------------------------------------------------------------ actions
  select(uid) {
    this.selectedUid = uid;
    this.refresh();
    this.app.ui?.renderThings();
    this.app.requestRender();
  }

  /** Turn clockwise seen from above by `deg` (negative = counter-clockwise). */
  rotate(deg) {
    const item = this.item();
    if (!item || !this.isFloor(item)) return;
    this.app.change(s => {
      const it = s.items.find(i => i.uid === item.uid);
      const from = { x: it.x, z: it.z, yaw: it.yaw || 0 };
      it.yaw = (((it.yaw || 0) - deg) % 360 + 360) % 360;
      if (it.yaw > 180) it.yaw -= 360;
      const d = this.dimsOf(it);
      const sup = it.on && s.items.find(i => i.uid === it.on);
      const p = sup ? this.clampOnto(it, sup, it.x, it.z) : this.clampFloor(it, d.w, d.d, false);
      it.x = p.x; it.z = p.z;
      this.carryStack(it.uid, from, { x: it.x, z: it.z, yaw: it.yaw });
      if (it.type === 'rug') it.moved = true;
    }, { finishes: false });
  }

  /** repeat: a held key's auto-repeat, which shares the first press's undo step. */
  nudge(dx, dz, step, repeat = false) {
    const item = this.item();
    if (!item) return;
    // Arrow keys move relative to the camera: up = away from you.
    const f = new THREE.Vector3();
    this.app.camera.getWorldDirection(f);
    f.y = 0; f.normalize();
    const rgt = new THREE.Vector3(-f.z, 0, f.x);
    const mv = rgt.multiplyScalar(dx).add(f.multiplyScalar(dz)).multiplyScalar(step);
    this.app.change(s => {
      const it = s.items.find(i => i.uid === item.uid);
      const d = this.dimsOf(it);
      if (this.app.isWallItem(it)) {
        const r = this.app.room.room;
        const ns = it.wall === 'north' || it.wall === 'south';
        const lo = ns ? r.x_west : r.z_south, hi = ns ? r.x_east : r.z_north;
        it.along = Math.min(Math.max(it.along + (ns ? mv.x : mv.z), lo + d.w / 2), hi - d.w / 2);
      } else {
        const from = { x: it.x, z: it.z, yaw: it.yaw || 0 };
        const sup = it.on && s.items.find(i => i.uid === it.on);
        // a resting item slides along the top and stops at its edge
        const p = sup ? this.clampOnto(it, sup, it.x + mv.x, it.z + mv.z)
          : this.clampFloor({ x: it.x + mv.x, z: it.z + mv.z, yaw: it.yaw }, d.w, d.d, false);
        it.x = p.x; it.z = p.z;
        if (it.type === 'rug') it.moved = true;
        this.carryStack(it.uid, from, { x: it.x, z: it.z, yaw: it.yaw || 0 });
      }
    }, { finishes: false, history: !repeat });
  }

  remove(uid) {
    const it = this.item(uid);
    if (!it) return;
    const name = this.app.itemName(it);
    this.app.change(s => { s.items.find(i => i.uid === uid).removed = true; }, { finishes: false });
    if (this.selectedUid === uid) this.select(null);
    this.app.ui.toast(`Removed ${name}`, { action: 'Undo', onAction: () => this.app.undo() });
  }

  restore(uid) {
    this.app.change(s => { s.items.find(i => i.uid === uid).removed = false; }, { finishes: false });
    this.select(uid);
    const it = this.item(uid);
    const hit = this.overlapOf(it);
    if (hit) this.app.ui.toast(`${this.app.itemName(it)} overlaps the ${this.app.itemName(hit).toLowerCase()} — drag it somewhere`);
  }

  // Full card once the object exists (swatches, lamp toggle); a drag's end rebuilds it anyway.
  onObjectRebuilt(uid) { if (uid === this.selectedUid) this.refresh(!this.drag); }

  // ------------------------------------------------------------ highlight + measurements
  refresh(card = true) {
    const sel = this.selectedUid;
    const item = sel ? this.item(sel) : null;
    if (sel && !sel.includes(':') && sel !== 'curtains' && sel !== 'fan' && (!item || item.removed)) {
      this.selectedUid = null;
    }
    if (sel === 'curtains' && !this.app.state.curtains) this.selectedUid = null;
    this.updateHighlight();
    if (card) this.app.ui?.renderCard(this.selectionInfo());
    else this.app.ui?.updateCardLive?.(this.selectionInfo());
  }

  selectionInfo() {
    const sel = this.selectedUid;
    if (!sel) return null;
    if (sel.startsWith('wall:')) return { kind: 'wall', wall: sel.slice(5) };
    if (sel === 'curtains' || sel === 'fan') return { kind: sel };
    const item = this.item(sel);
    if (!item) return null;
    return { kind: 'item', item, dims: this.dimsOf(item), overlap: this.overlapOf(item), wall: this.app.isWallItem(item) };
  }

  updateHighlight() {
    const item = this.selectedUid ? this.item(this.selectedUid) : null;
    const show = !!item && !item.removed;
    this.outline.visible = this.fill.visible = show;
    if (!show) { this.dimLines.visible = false; this.hideLabels(); return; }
    const d = this.dimsOf(item);
    const bad = !!this.overlapOf(item);
    const col = bad ? 0xd03a4c : 0x8b5cc6;
    this.outline.material.color.setHex(col);
    this.fill.material.color.setHex(col);
    let pts;
    if (this.app.isWallItem(item)) {
      const w = this.app.shell.walls[item.wall];
      const u = this.app.alongToLocal(item.wall, item.along);
      pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) =>
        w.mount.localToWorld(new THREE.Vector3(u + sx * (d.w / 2 + 0.02), item.y + sy * (d.h / 2 + 0.02), 0.02)));
    } else {
      const y = item.type === 'rug' ? 0.04 : (item.elev || 0) + 0.012;
      pts = rectCorners(item.x, item.z, item.yaw || 0, d.w + 0.03, d.d + 0.03).map(([x, z]) => new THREE.Vector3(x, y, z));
    }
    // New geometries each time; setFromPoints on a reused one leaks its old GPU buffers.
    const outlineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    this.outline.geometry.dispose();
    this.outline.geometry = outlineGeo;
    const fillGeo = new THREE.BufferGeometry().setFromPoints([pts[0], pts[1], pts[2], pts[0], pts[2], pts[3]]);
    this.fill.geometry.dispose();
    this.fill.geometry = fillGeo;
    this.measure(item, d);
  }

  measure(item, d) {
    const segs = [], labels = [];
    const r = this.app.room.room;
    if (this.app.isWallItem(item)) {
      // Height of the bottom edge above the floor
      const w = this.app.shell.walls[item.wall];
      const u = this.app.alongToLocal(item.wall, item.along);
      const a = w.mount.localToWorld(new THREE.Vector3(u, item.y - d.h / 2, 0.03));
      const b = w.mount.localToWorld(new THREE.Vector3(u, 0, 0.03));
      segs.push(a, b);
      labels.push({ at: a.clone().lerp(b, 0.5), text: `${fmtFtIn(item.y - d.h / 2)} up` });
    } else if (item.on) {
      const sup = this.item(item.on);
      const at = new THREE.Vector3(item.x, (item.elev || 0) + d.h + 0.08, item.z);
      labels.push({ at, text: `On the ${sup ? this.app.itemName(sup).toLowerCase() : 'top'} · ${fmtFtIn(item.elev || 0)} up` });
    } else if (item.type !== 'rug') {
      const { hx, hz } = halfExtents(item.yaw || 0, d.w, d.d);
      const me = { x0: item.x - hx, x1: item.x + hx, z0: item.z - hz, z1: item.z + hz };
      const others = this.floorItems(item.uid).filter(it => !it.elev).map(it => {
        const dd = this.dimsOf(it), e = halfExtents(it.yaw || 0, dd.w, dd.d);
        return { x0: it.x - e.hx, x1: it.x + e.hx, z0: it.z - e.hz, z1: it.z + e.hz };
      });
      const y = 0.03;
      const dirs = [
        { axis: 'x', sign: 1, edge: me.x1, wall: r.x_east },
        { axis: 'x', sign: -1, edge: me.x0, wall: r.x_west },
        { axis: 'z', sign: 1, edge: me.z1, wall: r.z_north },
        { axis: 'z', sign: -1, edge: me.z0, wall: r.z_south },
      ];
      for (const dr of dirs) {
        let gap = (dr.wall - dr.edge) * dr.sign;
        let range = dr.axis === 'x' ? [me.z0, me.z1] : [me.x0, me.x1];
        let hitRange = range;
        for (const o of others) {
          const perp = dr.axis === 'x' ? [o.z0, o.z1] : [o.x0, o.x1];
          const lo = Math.max(range[0], perp[0]), hi = Math.min(range[1], perp[1]);
          if (hi - lo < 0.01) continue;
          const near = dr.axis === 'x' ? (dr.sign > 0 ? o.x0 : o.x1) : (dr.sign > 0 ? o.z0 : o.z1);
          const g = (near - dr.edge) * dr.sign;
          if (g >= -0.001 && g < gap) { gap = g; hitRange = [lo, hi]; }
        }
        if (gap < 0.004 || gap > 2.2) continue;
        const mid = (hitRange[0] + hitRange[1]) / 2;
        const a = dr.axis === 'x' ? new THREE.Vector3(dr.edge, y, mid) : new THREE.Vector3(mid, y, dr.edge);
        const b = a.clone();
        if (dr.axis === 'x') b.x += gap * dr.sign; else b.z += gap * dr.sign;
        segs.push(a, b);
        labels.push({ at: a.clone().lerp(b, 0.5), text: fmtFtIn(gap), cls: gap < TIGHT ? 'tight' : '' });
      }
    }
    this.dimLines.visible = segs.length > 0;
    if (segs.length) {
      this.dimLines.geometry.dispose();
      this.dimLines.geometry = new THREE.BufferGeometry().setFromPoints(segs);
    }
    this.labels = labels;
  }

  hideLabels() { this.labels = []; for (const el of this.labelPool) el.hidden = true; }

  /** Called before each render: keep HTML labels glued to their 3D points. */
  update() {
    const labels = this.labels || [];
    const cam = this.app.camera;
    const w = this.labelsEl.clientWidth, h = this.labelsEl.clientHeight;
    while (this.labelPool.length < labels.length) {
      const el = document.createElement('span');
      el.className = 'mlabel';
      this.labelsEl.appendChild(el);
      this.labelPool.push(el);
    }
    this.labelPool.forEach((el, i) => {
      const L = labels[i];
      if (!L) { el.hidden = true; return; }
      const p = L.at.clone().project(cam);
      if (p.z > 1 || p.z < -1) { el.hidden = true; return; }
      el.hidden = false;
      el.textContent = L.text;
      el.className = `mlabel ${L.cls || ''}`;
      el.style.left = `${(p.x * 0.5 + 0.5) * w}px`;
      el.style.top = `${(-p.y * 0.5 + 0.5) * h}px`;
    });
  }
}
