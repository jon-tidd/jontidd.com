// Procedural models of the furniture already in Alice's room.
// Contract: docs/CONTRACT.md. Each builder is (spec, ctx) -> THREE.Group with the
// origin at floor level in the centre of the footprint, +Z = front, and a bounding
// box of exactly spec.w x spec.h x spec.d.
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Deterministic RNG so the bookshelf looks the same every load.
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quality(ctx) {
  const hi = !ctx || ctx.quality !== 'low';
  return {
    hi,
    rs: hi ? 3 : 2,          // rounded-box corner segments
    curve: hi ? 14 : 7,      // shape curve segments
    bevel: hi ? 3 : 1,       // extrude bevel segments
    radial: hi ? 8 : 5,      // tube radial segments
    tex: hi ? 256 : 128,     // procedural texture size
  };
}

/**
 * Box with rounded edges and corners, centred on the origin.
 * Built from a subdivided unit box whose grid lines are pushed so that the outer
 * `s` rows on every side lie inside the r-wide edge band; vertices in the band are
 * then projected onto a sphere of radius r around the inner (w-2r, h-2r, d-2r) box.
 */
function roundedBoxGeometry(w, h, d, r, s = 2) {
  r = Math.max(0, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
  if (r < 5e-4) return new THREE.BoxGeometry(w, h, d);
  const n = 2 * s + 1;
  const g = new THREE.BoxGeometry(1, 1, 1, n, n, n);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const half = [w / 2, h / 2, d / 2];
  const remap = (t, hh) => {
    const i = Math.round((t + 0.5) * n); // grid index 0..n
    if (i <= s) return -hh + r * (i / s); // 0 -> -hh, s -> -hh + r
    return hh - r * ((n - i) / s); // s+1 -> hh - r, n -> hh
  };
  const p = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let k = 0; k < pos.count; k++) {
    p.set(remap(pos.getX(k), half[0]), remap(pos.getY(k), half[1]), remap(pos.getZ(k), half[2]));
    c.set(
      clamp(p.x, -half[0] + r, half[0] - r),
      clamp(p.y, -half[1] + r, half[1] - r),
      clamp(p.z, -half[2] + r, half[2] - r),
    );
    const dir = p.clone().sub(c);
    const len = dir.length();
    if (len > 1e-9) {
      dir.divideScalar(len);
      p.copy(c).addScaledVector(dir, r);
      nor.setXYZ(k, dir.x, dir.y, dir.z);
    }
    pos.setXYZ(k, p.x, p.y, p.z);
  }
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** Smooth normals across edges flatter than `deg` (ExtrudeGeometry is non-indexed and flat-shaded). */
function creaseNormals(geo, deg = 40) {
  if (geo.index) geo = geo.toNonIndexed();
  const pos = geo.attributes.position;
  const n = pos.count;
  const fn = new Float32Array(n * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    e1.subVectors(c, b); e2.subVectors(a, b); e1.cross(e2).normalize();
    for (let j = 0; j < 3; j++) fn.set([e1.x, e1.y, e1.z], (i + j) * 3);
  }
  const buckets = new Map();
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
    let list = buckets.get(key);
    if (!list) buckets.set(key, (list = []));
    list.push(i);
  }
  const cosT = Math.cos((deg * Math.PI) / 180);
  const out = new Float32Array(n * 3);
  for (const list of buckets.values()) {
    for (const i of list) {
      let x = 0, y = 0, z = 0;
      for (const j of list) {
        const dot = fn[i * 3] * fn[j * 3] + fn[i * 3 + 1] * fn[j * 3 + 1] + fn[i * 3 + 2] * fn[j * 3 + 2];
        if (dot > cosT) { x += fn[j * 3]; y += fn[j * 3 + 1]; z += fn[j * 3 + 2]; }
      }
      const l = Math.hypot(x, y, z) || 1;
      out[i * 3] = x / l; out[i * 3 + 1] = y / l; out[i * 3 + 2] = z / l;
    }
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  return geo;
}

/**
 * Extrude a 2D shape (drawn in the XY plane) to a total thickness `depth` along Z,
 * centred on z = 0, with a soft bevel. The bevel grows the outline by `bevel`, so
 * callers draw the outline already inset by `bevel` where the size matters.
 */
function extrude(shape, depth, bevel, q) {
  const core = Math.max(depth - 2 * bevel, 0.001);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: core,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: q.bevel,
    curveSegments: q.curve,
  });
  g.translate(0, 0, -core / 2);
  return creaseNormals(g, 40);
}

/** Re-orient an extrusion so the shape's (x, y) become world (z, y) and the extrusion runs along X. */
const alongX = (g) => g.rotateY(-Math.PI / 2);

function shapeFrom(points) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

function mesh(geo, mat, role, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = true;
  if (role) m.userData.role = role;
  return m;
}

/** Rounded box mesh centred at (x, y, z), added to parent. */
function rbox(parent, mat, role, w, h, d, r, x, y, z, s = 2) {
  const m = mesh(roundedBoxGeometry(w, h, d, r, s), mat, role);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/** Straight tube from a to b (geometry baked in place so bounding boxes stay tight). */
function tubeBetween(a, b, radius, radial) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(radius, radius, dir.length(), radial, 1, true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

/**
 * Closed piping cord following a rounded rectangle. (u, v) points of a rectangle of
 * half-size hu x hv with corner radius cr are mapped to 3D by `map(u, v)`.
 */
function pipingGeometry(hu, hv, cr, map, radius, q) {
  cr = Math.min(cr, hu, hv);
  const pts = [];
  const corners = [[hu - cr, hv - cr, 0], [-hu + cr, hv - cr, Math.PI / 2], [-hu + cr, -hv + cr, Math.PI], [hu - cr, -hv + cr, 1.5 * Math.PI]];
  for (const [cu, cv, a0] of corners) {
    for (let i = 0; i <= 4; i++) {
      const a = a0 + (i / 4) * (Math.PI / 2);
      pts.push(map(cu + cr * Math.cos(a), cv + cr * Math.sin(a)));
    }
    // a couple of points along the following straight edge keep the spline straight
    const a1 = a0 + Math.PI / 2;
    const next = corners[(corners.findIndex((c) => c[2] === a0) + 1) % 4];
    const su = cu + cr * Math.cos(a1), sv = cv + cr * Math.sin(a1);
    const eu = next[0] + cr * Math.cos(next[2]), ev = next[1] + cr * Math.sin(next[2]);
    for (const t of [0.33, 0.66]) pts.push(map(su + (eu - su) * t, sv + (ev - sv) * t));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  const segs = Math.round(clamp((hu + hv) * 4 * 90, 40, q.hi ? 160 : 80));
  return new THREE.TubeGeometry(curve, segs, radius, q.radial - 2, true);
}

// ---- materials -------------------------------------------------------------

/** Main-colour painted material. `shade` darkens it relative to the item colour (kept on setColor). */
function paintMat(shade = 1, roughness = 0.62) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness, metalness: 0 });
  m.userData.shade = shade;
  return m;
}

function fabricMat(map, shade = 1) {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map, roughness: 0.95, metalness: 0,
    sheen: 0.5, sheenRoughness: 0.75, sheenColor: new THREE.Color('#d9dce0'),
  });
  m.userData.shade = shade;
  return m;
}

/** Light, near-white woven noise used as a colour map (the item colour multiplies it). */
function fabricTexture(ctx, q, repeat) {
  if (!ctx || !ctx.makeCanvas) return null;
  const S = q.tex;
  const cv = ctx.makeCanvas(S, S);
  const g = cv.getContext('2d');
  const r = rng(7);
  g.fillStyle = '#f2f2f2';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < S; i++) {
    const a = 0.03 + r() * 0.06;
    g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${a})`;
    g.fillRect(0, i, S, 1);
    g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${a})`;
    g.fillRect(i, 0, 1, S);
  }
  return ctx.canvasTexture(cv, { srgb: true, repeat });
}

function weaveTexture(ctx, q) {
  if (!ctx || !ctx.makeCanvas) return null;
  const S = q.tex / 2;
  const cv = ctx.makeCanvas(S, S);
  const g = cv.getContext('2d');
  g.fillStyle = '#8f8678';
  g.fillRect(0, 0, S, S);
  const cell = S / 8;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const horiz = (x + y) % 2 === 0;
      g.fillStyle = horiz ? '#b3a996' : '#a39985';
      if (horiz) g.fillRect(x * cell, y * cell + cell * 0.18, cell, cell * 0.64);
      else g.fillRect(x * cell + cell * 0.18, y * cell, cell * 0.64, cell);
    }
  }
  return ctx.canvasTexture(cv, { srgb: true, repeat: [3, 2] });
}

// ---- common finishing -------------------------------------------------------

/**
 * Wrap the modelled content in the returned root group. The content is modelled to
 * the spec size already; this measures it and applies a tiny corrective scale/offset
 * (typically < 0.5 %) so the bounding box is exactly w x h x d with the origin at the
 * floor centre, as the contract requires.
 */
function finish(inner, spec, kind = 'furniture') {
  const root = new THREE.Group();
  root.name = spec.id;
  root.add(inner);
  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  const sx = spec.w / size.x, sy = spec.h / size.y, sz = spec.d / size.z;
  inner.scale.set(sx, sy, sz);
  inner.position.set(-((box.min.x + box.max.x) / 2) * sx, -box.min.y * sy, -((box.min.z + box.max.z) / 2) * sz);
  inner.userData.rawSize = { w: size.x, h: size.y, d: size.z }; // for tests / debugging

  root.userData = {
    kind,
    size: { w: spec.w, d: spec.d, h: spec.h },
    setColor(hex) {
      const seen = new Set();
      root.traverse((o) => {
        if (!o.isMesh || o.userData.role !== 'body') return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (seen.has(m)) continue;
          seen.add(m);
          m.color.set(hex).multiplyScalar(m.userData.shade ?? 1);
        }
      });
    },
    dispose() {
      const geos = new Set(), mats = new Set(), texs = new Set();
      root.traverse((o) => {
        if (o.geometry) geos.add(o.geometry);
        if (o.material) {
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            mats.add(m);
            for (const k of Object.keys(m)) if (m[k] && m[k].isTexture) texs.add(m[k]);
          }
        }
        if (o.isInstancedMesh && o.dispose) o.dispose();
      });
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      texs.forEach((t) => t.dispose());
    },
  };
  root.userData.setColor(spec.color);
  return root;
}

// ---------------------------------------------------------------------------
// Dresser: slate grey sleigh-style 6-drawer dresser with a changing-table gallery
// ---------------------------------------------------------------------------

export function buildDresser(spec, ctx) {
  const { w: W, d: D, h: H } = spec;
  const q = quality(ctx);
  const g = new THREE.Group();
  const body = paintMat(1, 0.6);
  const recess = paintMat(0.5, 0.7); // carcass seen through the drawer reveals
  const knobMat = new THREE.MeshStandardMaterial({ color: '#2b2826', roughness: 0.4, metalness: 0.6 });

  const galleryH = clamp(H * 0.1, 0.06, 0.12); // raised changing-table rail above the top
  const topY = H - galleryH;                    // top surface of the dresser
  const tTop = 0.03;
  const ew = Math.min(0.09, W * 0.065);         // end-post width seen from the front
  const bev = 0.006;
  const frontFace = D / 2 - 0.026;              // drawer faces sit back so knobs stay inside d
  const knobDepth = 0.024;

  // End posts/side panels: a front-view profile extruded through the full depth.
  // u = inset from the outer side face. The outer edge scrolls outward at the top,
  // pinches in through the middle and flares back out at the foot (sleigh style).
  for (const side of [-1, 1]) {
    const X = (u) => side * (W / 2 - u);
    const s = new THREE.Shape();
    s.moveTo(X(bev), bev);
    s.lineTo(X(ew - bev), bev);
    s.lineTo(X(ew - bev), topY - bev);
    s.lineTo(X(0.028), topY - bev);
    s.quadraticCurveTo(X(bev), topY - bev, X(bev), topY - 0.04);       // round over the scroll
    s.quadraticCurveTo(X(bev), topY - 0.1, X(0.03), topY - 0.15);      // curl back in
    s.lineTo(X(0.03), 0.2);
    s.quadraticCurveTo(X(0.03), 0.07, X(bev), bev);                     // flared foot
    const m = mesh(extrude(s, D, bev, q), body, 'body');
    g.add(m);
  }

  // Top board between (and overlapping) the end posts.
  rbox(g, body, 'body', W - 2 * ew + 0.02, tTop, D - 0.01, 0.007, 0, topY - tTop / 2, -0.005, q.rs);

  // Carcass behind the drawers (darker, reads as shadowed reveals).
  const carcass = mesh(new THREE.BoxGeometry(W - 2 * ew + 0.01, topY - tTop - 0.09, frontFace - 0.022 + D / 2 - 0.005), recess, 'body');
  carcass.position.set(0, 0.09 + (topY - tTop - 0.09) / 2, (-D / 2 + 0.005 + frontFace - 0.022) / 2);
  g.add(carcass);
  // Painted back panel so the dresser isn't black from behind (seen in the dollhouse cutaway).
  const backPanel = mesh(new THREE.BoxGeometry(W - 2 * ew + 0.012, topY - 0.06, 0.012), body, 'body');
  backPanel.position.set(0, 0.06 + (topY - 0.06) / 2, -D / 2 + 0.006);
  g.add(backPanel);

  // Drawers: 2 columns x 3 rows with small reveal gaps.
  const xL = -(W / 2 - ew) + 0.008, xR = -xL;
  const yb = 0.125, yt = topY - tTop - 0.01, gap = 0.007;
  const colW = (xR - xL - gap) / 2;
  const rowH = (yt - yb - 2 * gap) / 3;
  const knobPos = [];
  for (let c = 0; c < 2; c++) {
    for (let r = 0; r < 3; r++) {
      const cx = xL + colW / 2 + c * (colW + gap);
      const cy = yb + rowH / 2 + r * (rowH + gap);
      rbox(g, body, 'body', colW, rowH, 0.022, 0.007, cx, cy, frontFace - 0.011, 2);
      knobPos.push([cx - colW * 0.25, cy], [cx + colW * 0.25, cy]);
    }
  }

  // Shaped apron under the drawers; its lower edge arches up toward the centre.
  {
    const hw = W / 2 - ew + 0.005, top = yb - 0.004, lo = 0.035, hi = 0.075;
    const s = new THREE.Shape();
    s.moveTo(-hw, top);
    s.lineTo(-hw, lo);
    s.quadraticCurveTo(-hw * 0.45, lo, 0, hi);
    s.quadraticCurveTo(hw * 0.45, lo, hw, lo);
    s.lineTo(hw, top);
    s.closePath();
    const m = mesh(extrude(s, 0.022, 0.003, q), body, 'body');
    m.position.z = frontFace - 0.011;
    g.add(m);
  }

  // Dark mushroom knobs, instanced. Lathe profile around +Y, turned to face +Z.
  {
    const prof = [[0.0001, 0], [0.007, 0], [0.006, 0.008], [0.013, 0.012], [0.0165, 0.017], [0.014, 0.022], [0.007, knobDepth - 0.0005], [0.0001, knobDepth]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const kg = new THREE.LatheGeometry(prof, q.hi ? 16 : 10);
    kg.rotateX(Math.PI / 2); // +Y -> +Z
    const knobs = new THREE.InstancedMesh(kg, knobMat, knobPos.length);
    knobs.userData.role = 'knob';
    knobs.castShadow = true;
    const mtx = new THREE.Matrix4();
    knobPos.forEach(([x, y], i) => knobs.setMatrixAt(i, mtx.makeTranslation(x, y, frontFace)));
    g.add(knobs);
  }

  // Gallery: side rails sweep down from the tall back to a low front lip; arched back rail.
  for (const side of [-1, 1]) {
    const b = 0.004, zb = -D / 2 + b, zf = D / 2 - 0.035;
    const s = new THREE.Shape();
    s.moveTo(zb, topY - 0.005);
    s.lineTo(zf, topY - 0.005);
    s.lineTo(zf, topY + 0.022);
    s.quadraticCurveTo(-D / 2 + 0.16, topY + 0.03, -D / 2 + 0.07, H - 0.03);
    s.quadraticCurveTo(-D / 2 + 0.05, H - b, zb, H - b);
    s.closePath();
    const m = mesh(alongX(extrude(s, 0.022, b, q)), body, 'body');
    m.position.x = side * (W / 2 - ew / 2);
    g.add(m);
  }
  {
    const b = 0.004, hw = W / 2 - ew / 2, end = topY + galleryH * 0.78, apex = H - b;
    const s = new THREE.Shape();
    s.moveTo(-hw, topY - 0.005);
    s.lineTo(hw, topY - 0.005);
    s.lineTo(hw, end);
    s.quadraticCurveTo(hw * 0.5, apex, 0, apex);
    s.quadraticCurveTo(-hw * 0.5, apex, -hw, end);
    s.closePath();
    const m = mesh(extrude(s, 0.02, b, q), body, 'body');
    m.position.z = -D / 2 + 0.01;
    g.add(m);
  }

  return finish(g, spec);
}

// ---------------------------------------------------------------------------
// Bookshelf: tall grey bookcase with crown cornice, plinth, back panel, books
// ---------------------------------------------------------------------------

function frustumBox(wBot, wTop, h, zBack, zFrontBot, zFrontTop) {
  // Box whose front and sides flare outward toward the top (cove moulding); back stays flat.
  const g = new THREE.BoxGeometry(1, 1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const top = p.getY(i) > 0;
    const wv = top ? wTop : wBot, zf = top ? zFrontTop : zFrontBot;
    p.setXYZ(i, p.getX(i) * wv, p.getY(i) * h, zBack + (p.getZ(i) + 0.5) * (zf - zBack));
  }
  g.computeVertexNormals();
  return g;
}

const BOOK_COLORS = [
  '#b8423a', '#d9822b', '#e8c547', '#4f8f4a', '#2f6fa6', '#7d4f9e', '#2f8f86', '#c45a2a',
  '#2e3b55', '#d9658f', '#efe6cf', '#5d5fb0', '#1f8fa0', '#e79bb2', '#f1dc8e', '#7fc4a6',
  '#8f2f2f', '#3c7a3a', '#f0f0ea', '#9fb8d6', '#c9a64a', '#6b4a3a',
];

export function buildBookshelf(spec, ctx) {
  const { w: W, d: D, h: H } = spec;
  const q = quality(ctx);
  const rand = rng(1234);
  const g = new THREE.Group();
  const body = paintMat(1, 0.6);
  const backMat = paintMat(0.88, 0.7);

  const cornH = clamp(H * 0.062, 0.09, 0.15);
  const over = 0.028;                     // cornice overhang at front and sides
  const Wc = W - 2 * over;                // carcass width
  const zF = D / 2 - over;                // carcass front
  const ts = 0.024, tb = 0.022, tsh = 0.022;
  const plinthH = clamp(H * 0.042, 0.06, 0.1);
  const carcTop = H - cornH;

  // Sides
  for (const s of [-1, 1]) rbox(g, body, 'body', ts, carcTop, zF + D / 2, 0.004, s * (Wc / 2 - ts / 2), carcTop / 2, (zF - D / 2) / 2, 1);
  // Base plinth (slightly proud) + bottom board
  rbox(g, body, 'body', Wc + 0.016, plinthH, zF + 0.008 + D / 2, 0.005, 0, plinthH / 2, (zF + 0.008 - D / 2) / 2, 1);
  rbox(g, body, 'body', Wc - 0.002, tb, zF + D / 2, 0.003, 0, plinthH + tb / 2, (zF - D / 2) / 2, 1);
  // Top board under the cornice
  rbox(g, body, 'body', Wc - 0.002, tb, zF + D / 2, 0.003, 0, carcTop - tb / 2, (zF - D / 2) / 2, 1);

  // Shelves: 6 compartments on a full-height case, 5 on a shorter one.
  const N = H > 1.8 ? 6 : 5;
  const y0 = plinthH + tb, y1 = carcTop - tb;
  const ch = (y1 - y0 - (N - 1) * tsh) / N;
  const innerW = Wc - 2 * ts;
  const shelfD = zF - 0.004 - (-D / 2 + 0.012);
  for (let i = 1; i < N; i++) {
    const y = y0 + i * ch + (i - 1) * tsh + tsh / 2;
    rbox(g, body, 'body', innerW + 0.004, tsh, shelfD, 0.003, 0, y, (zF - 0.004 + (-D / 2 + 0.012)) / 2, 1);
  }
  // Back panel (a touch darker, it is in the shade of the shelves)
  rbox(g, backMat, 'body', innerW + 0.01, y1 - y0 + 0.01, 0.012, 0.002, 0, (y0 + y1) / 2, -D / 2 + 0.006, 1);

  // Crown cornice: frieze, bead, flared cove, then the full-size cap.
  {
    const k = cornH / 0.13;
    const fH = 0.045 * k, bH = 0.015 * k, cH = 0.045 * k, capH = cornH - fH - bH - cH;
    let y = carcTop;
    rbox(g, body, 'body', Wc + 0.004, fH, zF + 0.002 + D / 2, 0.003, 0, y + fH / 2, (zF + 0.002 - D / 2) / 2, 1);
    y += fH;
    rbox(g, body, 'body', Wc + 0.022, bH, zF + 0.011 + D / 2, bH * 0.45, 0, y + bH / 2, (zF + 0.011 - D / 2) / 2, 2);
    y += bH;
    const cove = mesh(frustumBox(Wc + 0.012, W - 0.012, cH, -D / 2, zF + 0.006, D / 2 - 0.006), body, 'body');
    cove.position.y = y + cH / 2;
    g.add(cove);
    y += cH;
    rbox(g, body, 'body', W, capH, D, 0.006, 0, y + capH / 2, 0, 2);
  }

  // ---- books (one InstancedMesh, per-instance colour) ----
  const spine = (() => {
    if (!ctx || !ctx.makeCanvas) return null;
    const cv = ctx.makeCanvas(32, 128);
    const c2 = cv.getContext('2d');
    c2.fillStyle = '#d6d6d6'; c2.fillRect(0, 0, 32, 128);           // spine body (multiplied by the book colour)
    c2.fillStyle = '#9a9a9a'; c2.fillRect(0, 10, 32, 5); c2.fillRect(0, 113, 32, 5); // bands
    c2.fillStyle = '#ffffff'; c2.fillRect(6, 44, 20, 40);           // title label
    return ctx.canvasTexture(cv, { srgb: true, wrap: 'clamp' });
  })();
  const bookGeo = new THREE.BoxGeometry(1, 1, 1);
  {
    // Only the spine (+Z face, vertices 16..19) shows the label texture; other faces
    // sample a plain area of it.
    const uv = bookGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) if (i < 16 || i > 19) uv.setXY(i, 0.5, 0.25);
  }
  const bookMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: spine, roughness: 0.6 });
  const books = [];
  const zFront = zF - 0.012;
  const xMin = -innerW / 2 + 0.006, xMax = innerW / 2 - 0.006;
  const pickColor = () => BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)];

  // Upright row from x0 in direction dir; optionally ends with one book leaning back on it.
  function row(yBase, maxH, x0, dir, len, { minH = 0.14, maxBH = 0.27, thin = false, lean = true } = {}) {
    let x = x0;
    const end = x0 + dir * len;
    let lastH = 0;
    while (dir > 0 ? x < end : x > end) {
      const bw = thin ? 0.008 + rand() * 0.014 : 0.015 + rand() * 0.03;
      const bh = Math.min(maxH, minH + rand() * (maxBH - minH));
      const bd = Math.min(0.15 + rand() * 0.08, shelfD - 0.02);
      if (dir > 0 ? x + bw > xMax : x - bw < xMin) break;
      books.push({ x: x + dir * bw / 2, y: yBase + bh / 2, z: zFront - bd / 2 - rand() * 0.015, sx: bw, sy: bh, sz: bd, rz: 0 });
      x += dir * (bw + (rand() < 0.15 ? 0.002 : 0));
      lastH = bh;
    }
    if (lean && lastH > 0) {
      // Pivot on the bottom corner nearest the row; tilt so the top rests on the last book.
      const a = 0.18 + rand() * 0.2;
      const bw = 0.02 + rand() * 0.02, bh = Math.min(maxH - 0.01, lastH * (0.85 + rand() * 0.15)), bd = 0.18;
      const px = x + dir * (bh * Math.sin(a) + 0.002);
      const ang = dir * a;
      const lx = dir * bw / 2, ly = bh / 2;
      const cx = px + lx * Math.cos(ang) - ly * Math.sin(ang);
      const cy = yBase + lx * Math.sin(ang) + ly * Math.cos(ang);
      const farX = px + dir * bw * Math.cos(a);
      if (farX > xMin && farX < xMax) books.push({ x: cx, y: cy, z: zFront - bd / 2, sx: bw, sy: bh, sz: bd, rz: ang });
    }
    return x;
  }
  // A stack of books lying flat.
  function stack(yBase, x, n) {
    let y = yBase;
    for (let i = 0; i < n; i++) {
      const t = 0.015 + rand() * 0.02, l = 0.17 + rand() * 0.07, d = 0.13 + rand() * 0.07;
      books.push({ x: x + (rand() - 0.5) * 0.015, y: y + t / 2, z: zFront - d / 2 - 0.01, sx: l, sy: t, sz: d, rz: 0, ry: (rand() - 0.5) * 0.08 });
      y += t;
    }
  }
  const compBase = (i) => y0 + i * (ch + tsh);
  const maxBookH = ch - 0.02;

  // Bottom: a wicker basket on the left, big picture books on the right.
  const basketW = Math.min(0.44, innerW * 0.45);
  row(compBase(0), maxBookH, xMax, -1, innerW * 0.3, { minH: 0.2, maxBH: 0.27, thin: true });
  // Picture-book shelves
  for (let i = 1; i < N; i++) {
    const yb = compBase(i);
    if (i === N - 1) {
      // top shelf: two flat stacks and a short upright row
      stack(yb, xMin + 0.13, 6);
      stack(yb, xMin + 0.36, 4);
      row(yb, maxBookH, xMax, -1, innerW * 0.35, { minH: 0.17, maxBH: 0.23 });
    } else if (i === N - 2) {
      // stuffed-animal shelf in the photos: a sparse row
      row(yb, maxBookH, xMax, -1, innerW * 0.3, { minH: 0.16, maxBH: 0.24 });
    } else {
      const fill = 0.6 + rand() * 0.3;
      const fromLeft = i % 2 === 1;
      row(yb, maxBookH, fromLeft ? xMin : xMax, fromLeft ? 1 : -1, innerW * fill, { minH: 0.17, maxBH: 0.27, thin: i <= 2 });
    }
  }
  if (books.length) {
    const inst = new THREE.InstancedMesh(bookGeo, bookMat, books.length);
    inst.userData.role = 'books';
    inst.castShadow = true;
    inst.receiveShadow = true;
    const m = new THREE.Matrix4(), qt = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
    books.forEach((b, i) => {
      e.set(0, b.ry || 0, b.rz || 0);
      qt.setFromEuler(e);
      m.compose(new THREE.Vector3(b.x, b.y, b.z), qt, new THREE.Vector3(b.sx, b.sy, b.sz));
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, col.set(pickColor()));
    });
    g.add(inst);
  }

  // Wicker basket: open box of thin rounded panels.
  {
    const bw = basketW, bh = Math.min(0.22, ch - 0.05), bd = Math.min(0.3, shelfD - 0.03), t = 0.012;
    const basket = new THREE.MeshStandardMaterial({ color: 0xffffff, map: weaveTexture(ctx, q), roughness: 0.92 });
    const cx = xMin + bw / 2 + 0.01, cz = zFront - bd / 2 - 0.005, yb = compBase(0);
    rbox(g, basket, 'basket', bw, t, bd, 0.004, cx, yb + t / 2, cz, 1);
    for (const s of [-1, 1]) {
      rbox(g, basket, 'basket', bw, bh, t, 0.005, cx, yb + bh / 2, cz + s * (bd / 2 - t / 2), 1);
      rbox(g, basket, 'basket', t, bh, bd, 0.005, cx + s * (bw / 2 - t / 2), yb + bh / 2, cz, 1);
    }
  }

  return finish(g, spec);
}

// ---------------------------------------------------------------------------
// Glider: light grey upholstered glider with track arms and white piping
// ---------------------------------------------------------------------------

export function buildGlider(spec, ctx) {
  const { w: W, d: D, h: H } = spec;
  const q = quality(ctx);
  const g = new THREE.Group();
  const fab = fabricMat(fabricTexture(ctx, q, [5, 5]));
  const baseMat = new THREE.MeshStandardMaterial({ color: '#55585c', roughness: 0.8 });
  const pipeMat = new THREE.MeshStandardMaterial({ color: '#f3f3f0', roughness: 0.85 });
  const pr = 0.0045; // piping cord radius

  const baseH = 0.05;
  const armW = clamp(W * 0.17, 0.1, 0.15);
  const armTop = clamp(H * 0.6, 0.5, 0.68);
  const backD = clamp(D * 0.2, 0.14, 0.22);
  const rA = 0.035, rB = 0.045, rS = 0.05;
  const k = 0.29; // a 45-degree point on a rounded edge sits 0.29 r in from each face

  // Low recessed base (the glider mechanism is hidden inside)
  rbox(g, baseMat, 'base', W - 0.07, baseH, D - 0.09, 0.008, 0, baseH / 2, -0.01, 1);

  // Track arms, full depth
  const armH = armTop - baseH + 0.005;
  const armY = baseH - 0.005 + armH / 2;
  for (const s of [-1, 1]) {
    const ax = s * (W / 2 - armW / 2);
    rbox(g, fab, 'body', armW, armH, D, rA, ax, armY, 0, q.rs);
    // piping around the arm's front face
    const pg = pipingGeometry(armW / 2 - k * rA, armH / 2 - k * rA, 0.71 * rA,
      (u, v) => new THREE.Vector3(ax + u, armY + v, D / 2 - k * rA), pr, q);
    g.add(mesh(pg, pipeMat, 'piping', false));
  }

  // Back: nearly full width, rising above the arms to the full height
  const backH = H - baseH + 0.005;
  const backZ = -D / 2 + backD / 2;
  rbox(g, fab, 'body', W - 0.02, backH, backD, rB, 0, H - backH / 2, backZ, q.rs);
  g.add(mesh(pipingGeometry((W - 0.02) / 2 - k * rB, backD / 2 - k * rB, 0.71 * rB,
    (u, v) => new THREE.Vector3(u, H - k * rB, backZ + v), pr, q), pipeMat, 'piping', false));

  // Seat deck between the arms, and the seat cushion on top
  const innerW = W - 2 * armW;
  const seatFront = D / 2 - 0.006;
  const deckTop = clamp(H * 0.3, 0.26, 0.34);
  const seatBack = -D / 2 + backD - 0.01;
  rbox(g, fab, 'body', innerW + 0.01, deckTop - baseH + 0.005, seatFront - 0.01 - seatBack, 0.02, 0, (baseH - 0.005 + deckTop) / 2, (seatFront - 0.01 + seatBack) / 2, 2);
  const cw = innerW - 0.012, cH = clamp(H * 0.145, 0.11, 0.16), cd = seatFront - seatBack;
  const seatTop = deckTop + cH, cz = (seatFront + seatBack) / 2;
  rbox(g, fab, 'body', cw, cH, cd, rS, 0, deckTop + cH / 2, cz, q.rs);
  g.add(mesh(pipingGeometry(cw / 2 - k * rS, cd / 2 - k * rS, 0.71 * rS,
    (u, v) => new THREE.Vector3(u, seatTop - k * rS, cz + v), pr, q), pipeMat, 'piping', false));

  // Back cushion leaning back slightly against the back
  {
    const bc = new THREE.Group();
    const bh = H - 0.075 - seatTop, bd = 0.13, z0 = -0.03;
    rbox(bc, fab, 'body', cw, bh, bd, rS, 0, bh / 2, z0 + bd / 2, q.rs);
    bc.add(mesh(pipingGeometry(cw / 2 - k * rS, bh / 2 - k * rS, 0.71 * rS,
      (u, v) => new THREE.Vector3(u, bh / 2 + v, z0 + bd - k * rS), pr, q), pipeMat, 'piping', false));
    bc.position.set(0, seatTop - 0.005, -D / 2 + backD);
    bc.rotation.x = -0.1; // top tips back into the frame
    g.add(bc);
  }

  return finish(g, spec);
}

// ---------------------------------------------------------------------------
// Step stool: folding 2-step, silver tubular frame with tall U handle, black treads
// ---------------------------------------------------------------------------

function treadGeometry(width, depth, thick) {
  // Side profile (z, y) with ribs on the top surface, extruded across the width.
  const ribH = 0.0035, pitch = 0.012, margin = 0.012;
  const pts = [[-depth / 2, -thick], [depth / 2, -thick], [depth / 2, 0]];
  let z = depth / 2 - margin;
  pts.push([z, 0]);
  while (z - pitch > -depth / 2 + margin) {
    pts.push([z, ribH], [z - pitch / 2, ribH], [z - pitch / 2, 0]);
    z -= pitch;
    pts.push([z, 0]);
  }
  pts.push([-depth / 2, 0]);
  const geo = new THREE.ExtrudeGeometry(shapeFrom(pts), { depth: width, bevelEnabled: false });
  geo.translate(0, 0, -width / 2);
  return alongX(creaseNormals(geo, 30));
}

export function buildStepStool(spec, ctx) {
  const { w: W, d: D, h: H } = spec;
  const q = quality(ctx);
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 1 });
  metal.userData.shade = 1;
  const plastic = new THREE.MeshStandardMaterial({ color: '#1d1d1f', roughness: 0.6 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.85 });

  const rt = 0.011;                  // tube radius
  const rc = 0.0135, capH = 0.028;   // rubber foot caps
  const xs = W / 2 - rc;             // rear frame / handle tubes
  const xf = xs - 2 * rt - 0.003;    // front legs sit just inside the rear frame
  const zr0 = -D / 2 + rc;           // rear feet
  const zf0 = D / 2 - rc;            // front feet
  const yBar = H - rt;               // handle top bar centre line
  const cr = 0.06;                   // handle corner radius
  const lean = 0.11;                 // rear frame leans forward as it rises (dz per m)
  const zRear = (y) => zr0 + lean * y;
  const tThick = 0.022;
  const yT = H * 0.63, yL = H * 0.32; // tread tops
  const yFoot = capH * 0.5;

  // Rear frame + U handle as one bent tube: up the left leg, across the top, down the right.
  {
    const yc = yBar - cr;
    const zc = zRear(yc), zCtl = zRear(yBar);
    const path = new THREE.CurvePath();
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    path.add(new THREE.LineCurve3(V(-xs, yFoot, zRear(yFoot)), V(-xs, yc, zc)));
    path.add(new THREE.QuadraticBezierCurve3(V(-xs, yc, zc), V(-xs, yBar, zCtl), V(-xs + cr, yBar, zCtl)));
    path.add(new THREE.LineCurve3(V(-xs + cr, yBar, zCtl), V(xs - cr, yBar, zCtl)));
    path.add(new THREE.QuadraticBezierCurve3(V(xs - cr, yBar, zCtl), V(xs, yBar, zCtl), V(xs, yc, zc)));
    path.add(new THREE.LineCurve3(V(xs, yc, zc), V(xs, yFoot, zRear(yFoot))));
    g.add(mesh(new THREE.TubeGeometry(path, q.hi ? 140 : 70, rt, q.radial, false), metal, 'body'));
  }

  // Top tread spans the rear frame; front legs hinge just under its front edge.
  const tdT = clamp(D * 0.62, 0.16, 0.27);
  const zT0 = zRear(yT - tThick) - 0.02, zT1 = zT0 + tdT;
  const yHinge = yT - tThick - rt;
  const zHinge = zT1 - 0.035;
  const zFront = (y) => zf0 + (zHinge - zf0) * ((y - yFoot) / (yHinge - yFoot));
  const tubes = [];
  for (const s of [-1, 1]) {
    // front leg
    tubes.push(tubeBetween(new THREE.Vector3(s * xf, yFoot, zf0), new THREE.Vector3(s * xf, yHinge, zHinge), rt, q.radial));
    // side rail under the top tread
    tubes.push(tubeBetween(new THREE.Vector3(s * xs, yHinge, zRear(yHinge)), new THREE.Vector3(s * xf, yHinge, zHinge), rt * 0.85, q.radial));
    // side rail under the lower tread, rear frame to front leg
    const yr = yL - tThick - rt;
    tubes.push(tubeBetween(new THREE.Vector3(s * xs, yr, zRear(yr)), new THREE.Vector3(s * xf, yr, zFront(yr)), rt * 0.85, q.radial));
  }
  // rear cross brace
  tubes.push(tubeBetween(new THREE.Vector3(-xs, 0.12, zRear(0.12)), new THREE.Vector3(xs, 0.12, zRear(0.12)), rt * 0.8, q.radial));
  for (const tg of tubes) g.add(mesh(tg, metal, 'body'));

  // Treads (rib tops at yT and yL)
  const ribH = 0.0035;
  const top = mesh(treadGeometry(2 * (xs - rt) - 0.004, tdT, tThick), plastic, 'tread');
  top.position.set(0, yT - ribH, (zT0 + zT1) / 2);
  g.add(top);
  const tdL = clamp(D * 0.43, 0.12, 0.19);
  const low = mesh(treadGeometry(2 * (xf - rt) - 0.004, tdL, tThick), plastic, 'tread');
  low.position.set(0, yL - ribH, zFront(yL) - 0.05);
  g.add(low);

  // Rubber foot caps
  const capGeo = new THREE.CylinderGeometry(rc * 0.92, rc, capH, q.hi ? 14 : 8);
  for (const [x, z] of [[-xs, zr0], [xs, zr0], [-xf, zf0], [xf, zf0]]) {
    const c = mesh(capGeo, rubber, 'foot');
    c.position.set(x, capH / 2, z);
    g.add(c);
  }

  return finish(g, spec);
}

// ---------------------------------------------------------------------------
// Toddler bed: grey convertible crib with slatted ends/back and a low guard rail
// ---------------------------------------------------------------------------

export function buildToddlerBed(spec, ctx) {
  const { w: W, d: D, h: H } = spec;
  const q = quality(ctx);
  const g = new THREE.Group();
  const body = paintMat(1, 0.6);
  const sheet = new THREE.MeshStandardMaterial({ color: '#e7ecf1', roughness: 0.95 });
  const pillowMat = new THREE.MeshStandardMaterial({ color: '#f5f5f2', roughness: 0.95 });
  const m4 = new THREE.Matrix4();

  // Instanced slats of one size at the given centres.
  function slats(w, h, d, centres) {
    const im = new THREE.InstancedMesh(roundedBoxGeometry(w, h, d, Math.min(0.006, w / 3, d / 3), 1), body, centres.length);
    im.userData.role = 'body';
    im.castShadow = true;
    im.receiveShadow = true;
    centres.forEach(([x, y, z], i) => im.setMatrixAt(i, m4.makeTranslation(x, y, z)));
    g.add(im);
  }

  const ps = 0.052, pr = 0.008;       // square corner posts
  const headSide = -1;                 // head at -X (guard rail end, per the room photos)
  const Hh = H, Hf = H - 0.06;         // head taller than foot
  const Hb = Hf - 0.03;                // back panel top
  const railLo = 0.1, railHi = 0.22;   // lower rails / mattress support
  const xA = -W / 2 + ps, xB = W / 2 - ps;
  const zA = -D / 2 + ps, zB = D / 2 - ps;

  for (const sx of [-1, 1]) {
    const ph = sx === headSide ? Hh : Hf;
    for (const sz of [-1, 1]) rbox(g, body, 'body', ps, ph, ps, pr, sx * (W / 2 - ps / 2), ph / 2, sz * (D / 2 - ps / 2), 2);
  }

  // End panels: lower rail, arched top rail, vertical slats (along Z)
  for (const sx of [-1, 1]) {
    const ph = sx === headSide ? Hh : Hf;
    const x = sx * (W / 2 - ps / 2);
    rbox(g, body, 'body', 0.03, railHi - railLo, zB - zA + 0.01, 0.005, x, (railLo + railHi) / 2, 0, 1);
    const b = 0.004, yb0 = ph - 0.12, endTop = ph - 0.05, apex = ph - b - 0.004;
    const s = new THREE.Shape();
    s.moveTo(zA - 0.005, yb0);
    s.lineTo(zB + 0.005, yb0);
    s.lineTo(zB + 0.005, endTop);
    s.quadraticCurveTo(zB * 0.5, apex, 0, apex);
    s.quadraticCurveTo(zA * 0.5, apex, zA - 0.005, endTop);
    s.closePath();
    const top = mesh(alongX(extrude(s, 0.032, b, q)), body, 'body');
    top.position.x = x;
    g.add(top);
    const n = Math.max(3, Math.round((zB - zA) / 0.085));
    const sh = yb0 - railHi + 0.02;
    const cs = [];
    for (let i = 0; i < n; i++) cs.push([x, railHi - 0.01 + sh / 2, zA + ((zB - zA) * (i + 0.5)) / n]);
    slats(0.022, sh, 0.034, cs);
  }

  // Back panel along -Z: wide lower board, top rail, flat slats
  {
    const z = -D / 2 + ps / 2;
    rbox(g, body, 'body', xB - xA + 0.01, 0.13, 0.03, 0.005, 0, railLo + 0.065, z, 1);
    rbox(g, body, 'body', xB - xA + 0.01, 0.06, 0.036, 0.008, 0, Hb - 0.03, z, 2);
    const n = Math.max(4, Math.round((xB - xA) / 0.095));
    const y0 = railLo + 0.12, y1 = Hb - 0.05;
    const cs = [];
    for (let i = 0; i < n; i++) cs.push([xA + ((xB - xA) * (i + 0.5)) / n, (y0 + y1) / 2, z]);
    slats(0.042, y1 - y0, 0.02, cs);
  }

  // Front: low support rail, plus the toddler guard rail on the head half
  const mattTop = railHi + clamp(H * 0.15, 0.1, 0.15);
  {
    const z = D / 2 - ps / 2;
    rbox(g, body, 'body', xB - xA + 0.01, railHi - railLo, 0.028, 0.005, 0, (railLo + railHi) / 2, z, 1);
    const gl = (xB - xA) * 0.5;
    const yG = mattTop + 0.2;
    // guard rail runs from the head post toward the middle
    const gEnd = headSide < 0 ? xA + gl : xB - gl;    // free end
    const gMid = headSide < 0 ? xA + gl / 2 : xB - gl / 2;
    rbox(g, body, 'body', gl, 0.045, 0.03, 0.008, gMid, yG - 0.0225, z, 2);
    // free-end post sits just inside the rail's end
    rbox(g, body, 'body', 0.04, yG - railHi + 0.01, 0.034, 0.007, gEnd + headSide * 0.02, (railHi + yG) / 2, z, 2);
    // slats evenly spaced between the head post and the free-end post
    const span = gl - 0.04;
    const n = Math.max(3, Math.round(span / 0.1));
    const y0 = railHi - 0.01, y1 = yG - 0.04;
    const cs = [];
    for (let i = 0; i < n; i++) {
      const t = ((i + 0.5) / n) * span;
      cs.push([headSide < 0 ? xA + t : xB - t, (y0 + y1) / 2, z]);
    }
    slats(0.03, y1 - y0, 0.02, cs);
  }

  // Mattress with a pale fitted sheet, and a pillow at the head
  {
    const mz0 = -D / 2 + ps / 2 + 0.016, mz1 = D / 2 - ps / 2 - 0.015;
    const mh = mattTop - (railHi - 0.02);
    rbox(g, sheet, 'mattress', xB - xA - 0.004, mh, mz1 - mz0, 0.035, 0, railHi - 0.02 + mh / 2, (mz0 + mz1) / 2, q.rs);
    rbox(g, pillowMat, 'bedding', 0.3, 0.085, 0.45, 0.04, headSide * (W / 2 - ps - 0.2), mattTop + 0.035, -0.03, q.rs);
  }

  const root = finish(g, spec);
  const base = [[sheet, sheet.color.getHex()], [pillowMat, pillowMat.color.getHex()]];
  // fitted sheet + pillowcase; null = the pale originals
  root.userData.baseSheetColor = '#' + sheet.color.getHexString();
  root.userData.setSheetColor = (hex) => { for (const [m, b] of base) { if (hex) m.color.set(hex); else m.color.setHex(b); } };
  return root;
}

// ---------------------------------------------------------------------------
// Storage cube: light grey fabric cube ottoman with a lid seam
// ---------------------------------------------------------------------------

export function buildStorageCube(spec, ctx) {
  const { w: W, d: D, h: H } = spec;
  const q = quality(ctx);
  const g = new THREE.Group();
  const tex = fabricTexture(ctx, q, [3, 3]);
  const fab = fabricMat(tex);
  const seam = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  seam.userData.shade = 0.55;

  const r = Math.min(0.02, W * 0.06);
  const lidH = H * 0.17, gap = 0.003;
  const bodyH = H - lidH - gap;
  rbox(g, fab, 'body', W, bodyH, D, r, 0, bodyH / 2, 0, q.rs);
  rbox(g, fab, 'body', W, lidH, D, r, 0, H - lidH / 2, 0, q.rs);
  // Darker core showing in the groove between the body and the lid = faint seam line
  const core = mesh(new THREE.BoxGeometry(W - 0.012, gap + 0.02, D - 0.012), seam, 'body');
  core.position.y = bodyH + gap / 2;
  g.add(core);

  return finish(g, spec);
}

export const FURNITURE_BUILDERS = {
  dresser: buildDresser,
  bookshelf: buildBookshelf,
  glider: buildGlider,
  step_stool: buildStepStool,
  toddler_bed: buildToddlerBed,
  storage_cube: buildStorageCube,
};
