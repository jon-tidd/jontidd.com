// Twin bed: grey velvet channel-tufted platform frame + mattress + swappable bedding.
// Local frame (CONTRACT.md): origin = footprint center at floor, X = width, Z = depth, Y up.
// For this item the HEADBOARD is at local -Z and the FOOT at local +Z (spec.geometry.headboard_end).
import * as THREE from 'three';

export const BEDDING_IDS = ['lavender_pompom', 'floral_purple_sheets', 'none'];

const TILE_M = 0.55;          // one floral texture tile covers ~0.55 m of fabric
const HEM_BELOW_TOP = 0.10;   // drape hem sits this far below the mattress top surface

// ---------------------------------------------------------------- geometry helpers

// Box with rounded edges and analytic normals. The grid is (2m+1) segments per axis:
// the outer m segments on each side wrap around the edge radius, the middle one is flat.
function roundedBox(w, h, d, r, m = 3) {
  const n = 2 * m + 1;
  const g = new THREE.BoxGeometry(1, 1, 1, n, n, n);
  const pos = g.attributes.position, nor = g.attributes.normal;
  const half = [w / 2, h / 2, d / 2];
  r = Math.min(r, half[0], half[1], half[2]);
  const s = [0, 0, 0], base = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    for (let a = 0; a < 3; a++) {
      const k = Math.round((p[a] + 0.5) * n);
      let t;
      if (k <= m) { t = -(1 - k / m); base[a] = -(half[a] - r); }
      else { t = (k - (m + 1)) / m; base[a] = half[a] - r; }
      s[a] = Math.tan(t * Math.PI / 4);   // tan spacing -> even angular steps round the edge
    }
    const len = Math.hypot(s[0], s[1], s[2]) || 1;
    const dx = s[0] / len, dy = s[1] / len, dz = s[2] / len;
    pos.setXYZ(i, base[0] + dx * r, base[1] + dy * r, base[2] + dz * r);
    nor.setXYZ(i, dx, dy, dz);
  }
  return g;
}

// Indexed (nu+1)x(nv+1) vertex grid. fn(i, j) -> [x, y, z, u, v].
// flip=false: front face is the side where (d(i) x d(j)) points.
function gridGeometry(nu, nv, fn, flip = false) {
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3);
  const uv = new Float32Array((nu + 1) * (nv + 1) * 2);
  for (let j = 0, k = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++, k++) {
      const r = fn(i, j);
      pos[k * 3] = r[0]; pos[k * 3 + 1] = r[1]; pos[k * 3 + 2] = r[2];
      uv[k * 2] = r[3] || 0; uv[k * 2 + 1] = r[4] || 0;
    }
  }
  const idx = [];
  const at = (i, j) => j * (nu + 1) + i;
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
      if (flip) idx.push(a, d, b, b, d, c); else idx.push(a, b, d, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Merge indexed geometries that carry position/normal/uv into one.
function mergeGeometries(list) {
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (const g of list) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    if (g.index) { const a = g.index.array; for (let k = 0; k < a.length; k++) idx[io + k] = a[k] + vo; io += a.length; }
    else { for (let k = 0; k < c; k++) idx[io + k] = k + vo; io += c; }
    vo += c;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

const linspace = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// One padded headboard channel: a front surface over a w x h rectangle (in XY), bulging +Z.
// Cross-section is a full, steep-sided superellipse so neighbours meet in a fine seam;
// the ends roll off over ~3.5 cm. Back is hidden against the headboard panel.
function channelGeometry(w, h, depth, cols, quality) {
  const roll = 0.035;
  // rows: dense in the roll-offs at both ends, sparse along the straight middle
  const ends = [0, 0.004, 0.010, 0.018, 0.027, roll];
  const midN = quality === 'low' ? 2 : 4;
  const mid = [];
  for (let k = 1; k < midN; k++) mid.push(roll + (h - 2 * roll) * k / midN);
  const ys = [...ends, ...mid, ...ends.slice().reverse().map(v => h - v)];
  const us = linspace(0, 1, cols);
  return gridGeometry(cols, ys.length - 1, (i, j) => {
    const u = us[i], y = ys[j];
    const f = Math.pow(1 - Math.pow(Math.abs(2 * u - 1), 4), 0.35);
    const dEnd = Math.min(y, h - y);
    const g = Math.pow(Math.sin(Math.min(1, dEnd / roll) * Math.PI / 2), 0.6);
    return [u * w - w / 2, y, depth * f * g, u, y / h];
  });
}

// Pillow lying in the XY plane (w along X, h along Y), puffed along ±Z.
// Optional flat flange (sham). Edges pinch slightly inward so the corners poke out.
function pillowGeometry(w, h, t, { flange = 0, pinch = 0.04, quality = 'high' } = {}) {
  const nIn = quality === 'low' ? 10 : 18;
  const axis = (L) => {
    if (!flange) return linspace(-L / 2, L / 2, nIn);
    const inner = linspace(-L / 2 + flange, L / 2 - flange, nIn);
    return [-L / 2, -L / 2 + flange * 0.5, ...inner, L / 2 - flange * 0.5, L / 2];
  };
  const xs = axis(w), ys = axis(h);
  const a = w / 2 - flange, b = h / 2 - flange, fl = flange ? 0.0025 : 0;
  const halfT = (x, y) => {
    if (Math.abs(Math.abs(x) - w / 2) < 1e-6 || Math.abs(Math.abs(y) - h / 2) < 1e-6) return 0;
    const ux = clamp(Math.abs(x) / a, 0, 1), vy = clamp(Math.abs(y) / b, 0, 1);
    return fl + (t / 2) * Math.pow(1 - Math.pow(ux, 2.5), 0.55) * Math.pow(1 - Math.pow(vy, 2.5), 0.55);
  };
  const side = (sign) => gridGeometry(xs.length - 1, ys.length - 1, (i, j) => {
    const x = xs[i], y = ys[j];
    const X = x * (1 - pinch * (1 - (y / (h / 2)) ** 2));
    const Y = y * (1 - pinch * (1 - (x / (w / 2)) ** 2));
    return [X, Y, sign * halfT(x, y) * (sign > 0 ? 1 : 0.9), (X + w / 2) / TILE_M, (Y + h / 2) / TILE_M];
  }, sign < 0);
  return mergeGeometries([side(1), side(-1)]);
}

// Points around a pillow's (pinched) outline, offset outward by `off`, spaced ~`step`.
function pillowOutlinePoints(w, h, pinch, step, off) {
  const pts = [];
  const edge = (x0, y0, x1, y1, nx, ny) => {
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / step));
    for (let k = 0; k < n; k++) {
      const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
      const X = x * (1 - pinch * (1 - (y / (h / 2)) ** 2)), Y = y * (1 - pinch * (1 - (x / (w / 2)) ** 2));
      pts.push(new THREE.Vector3(X + nx * off, Y + ny * off, 0));
    }
  };
  edge(-w / 2, -h / 2, w / 2, -h / 2, 0, -1);
  edge(w / 2, -h / 2, w / 2, h / 2, 1, 0);
  edge(w / 2, h / 2, -w / 2, h / 2, 0, 1);
  edge(-w / 2, h / 2, -w / 2, -h / 2, -1, 0);
  return pts;
}

// Comforter main layer. Fabric coords (s, t) map onto the bed: inside the inner rect
// [x0,x1]x[z0,z1] the fabric lies flat at topY; outside it the distance e (max-norm, so the
// hem stays level round the corners) bends over a quarter circle of radius rc and then
// hangs straight down. ext* = how much fabric lies beyond each inner edge.
function drapedSurface(o) {
  const { x0, x1, z0, z1, extL, extR, extH, extF, topY, rc, spacing, pattern, amp, waveAmp } = o;
  const eMax = Math.max(extL, extR, extH, extF);
  const arc = Math.PI / 2 * rc;
  const s0 = x0 - extL, s1 = x1 + extR, t0 = z0 - extH, t1 = z1 + extF;
  const nu = Math.max(8, Math.ceil((s1 - s0) / spacing)), nv = Math.max(8, Math.ceil((t1 - t0) / spacing));
  const g = gridGeometry(nu, nv, (i, j) => {
    const s = s0 + (s1 - s0) * i / nu, t = t0 + (t1 - t0) * j / nv;
    const qx = clamp(s, x0, x1), qz = clamp(t, z0, z1);
    const ex = s - qx, ez = t - qz;
    const e = Math.min(Math.max(Math.abs(ex), Math.abs(ez)), eMax);
    const len = Math.hypot(ex, ez);
    const dx = len > 0 ? ex / len : 0, dz = len > 0 ? ez / len : 0;
    let h, y, th;
    if (e <= arc) { th = e / rc; h = rc * Math.sin(th); y = topY - rc * (1 - Math.cos(th)); }
    else { th = Math.PI / 2; h = rc; y = topY - rc - (e - arc); }
    const hang = e > arc && eMax > arc ? (e - arc) / (eMax - arc) : 0;
    // soft wave on the hanging part, varying along the edge
    const tc = -dz * s + dx * t;
    h += waveAmp * hang * Math.sin(tc * 2 * Math.PI / 0.17 + 0.7);
    // quilting puff along the surface normal (half strength on the hanging part)
    const p = pattern(s, t) * amp * (e > arc ? 0.5 : 1);
    const nx = dx * Math.sin(th), ny = Math.cos(th), nz = dz * Math.sin(th);
    return [qx + dx * h + nx * p, y + ny * p, qz + dz * h + nz * p, s / TILE_M, -t / TILE_M];
  }, true);
  // perimeter path (head edge excluded): left column head->foot, foot row, right column foot->head
  const P = g.attributes.position, at = (i, j) => new THREE.Vector3().fromBufferAttribute(P, j * (nu + 1) + i);
  const path = [];
  for (let j = 0; j <= nv; j++) path.push(at(0, j));
  for (let i = 1; i <= nu; i++) path.push(at(i, nv));
  for (let j = nv - 1; j >= 0; j--) path.push(at(nu, j));
  return { geometry: g, path };
}

// Turned-back flap at the head: flat layer on top from zFold toward the foot (length F),
// then a half roll (radius rf) on the head side down to the main layer. Across X it bends
// over the sides with radius rcF and hangs a little (extF beyond the bend start xiF).
function flapSurface(o) {
  const { xiF, rcF, extF, zFold, F, rf, topY, spacing, pattern, amp } = o;
  const arcF = Math.PI / 2 * rcF;
  const sMax = xiF + extF, rollLen = Math.PI * rf;
  const nu = Math.max(8, Math.ceil(2 * sMax / spacing));
  const nFlat = Math.max(3, Math.ceil(F / spacing)), nRoll = 8;
  const flapTop = topY + 2 * rf;
  const g = gridGeometry(nu, nFlat + nRoll, (i, j) => {
    const s = -sMax + 2 * sMax * i / nu;
    const tt = j <= nFlat ? F * j / nFlat : F + rollLen * (j - nFlat) / nRoll;
    const ex = Math.abs(s) - xiF;
    let hx = 0, dy = 0, th = 0;
    if (ex > 0) {
      if (ex <= arcF) { th = ex / rcF; hx = rcF * Math.sin(th); dy = rcF * (1 - Math.cos(th)); }
      else { th = Math.PI / 2; hx = rcF; dy = rcF + (ex - arcF); }
    }
    const x = Math.sign(s) * (Math.min(Math.abs(s), xiF) + hx);
    let z, yb, w = 0;
    if (tt <= F) { z = zFold + F - tt; yb = flapTop; w = 1; }
    else { const ph = (tt - F) / rf; z = zFold - rf * Math.sin(ph); yb = topY + rf + rf * Math.cos(ph); }
    const p = w * pattern(s, -tt) * amp * Math.cos(th);   // puff the flat top only
    return [x, yb - dy + p, z, s / TILE_M, tt / TILE_M];
  });
  const P = g.attributes.position;
  const edge = [];
  for (let i = 0; i <= nu; i++) edge.push(new THREE.Vector3().fromBufferAttribute(P, i));
  return { geometry: g, edge };
}

// Resample a polyline at a fixed arc-length step.
function resample(path, step, offset = step / 2) {
  const out = [];
  let acc = -offset;
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1], b = path[k], L = a.distanceTo(b);
    if (L < 1e-6) continue;
    let d = step - acc;
    while (d <= L) { out.push(a.clone().lerp(b, d / L)); d += step; }
    acc = L - (d - step);
  }
  return out;
}

function dedupe(pts, eps = 0.002) {
  const out = [];
  for (const p of pts) if (!out.length || out[out.length - 1].distanceTo(p) > eps) out.push(p);
  return out;
}

function pipingTube(points, radius, quality) {
  const pts = dedupe(points);
  if (pts.length < 2) return null;
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const segs = Math.min(400, Math.ceil(curve.getLength() / (quality === 'low' ? 0.03 : 0.015)));
  return new THREE.TubeGeometry(curve, Math.max(2, segs), radius, quality === 'low' ? 4 : 5, false);
}

// Quilting patterns: value in [0,1], 1 = fully puffed.
function lavenderPattern(s, t) {
  // sparse tack points (one every ~36 cm, short along the length) on a gently lumpy base
  const sp = 0.36;
  const u = s / sp, v = t / sp;
  const du = (u - Math.round(u)) * sp, dv = (v - Math.round(v)) * sp * 0.5;
  const dimple = Math.exp(-(du * du + dv * dv) / (0.032 * 0.032));
  const lump = 0.78 + 0.22 * Math.sin(s * 6.3 + 1.3) * Math.sin(t * 4.7 + 0.4);
  return clamp(lump - 0.85 * dimple, 0, 1);
}

function floralPattern(s, t) {
  // puffy cells separated by wavy quilting lines
  const cs = 0.24;
  const u = s / cs + 0.18 * Math.sin(2 * Math.PI * t / (cs * 2));
  const v = t / cs + 0.18 * Math.sin(2 * Math.PI * s / (cs * 2));
  return Math.pow(Math.abs(Math.sin(Math.PI * u)) * Math.abs(Math.sin(Math.PI * v)), 0.35);
}

// ---------------------------------------------------------------- builder

export function buildTwinBed(spec, ctx, opts = {}) {
  const quality = ctx && ctx.quality === 'low' ? 'low' : 'high';
  const bedding = BEDDING_IDS.includes(opts.bedding) ? opts.bedding : 'lavender_pompom';
  const drape = { left: false, right: true, ...(opts.drape || {}) };
  const bs = opts.beddingSpec || {};
  const geo = spec.geometry || {};

  const W = spec.w, D = spec.d, H = spec.h;
  const hbH = geo.headboard_height_from_floor ?? H;
  const hbT = geo.headboard_thickness ?? 0.08;
  const nCh = geo.headboard_channels ?? 8;
  const deckTop = geo.deck_top ?? 0.215;
  const railH = geo.rail_band_height ?? 0.09;
  const railBottom = deckTop - railH;
  const legH = railBottom;                     // legs reach exactly up to the rail band
  const mat = geo.mattress || { w: W - 0.07, d: D - 0.19, thickness: 0.25 };

  const zBack = -D / 2, zFoot = D / 2;
  const zHbFront = zBack + hbT;                // headboard front face (channel peaks)
  const mattTop = deckTop + mat.thickness;
  const mattZ0 = zHbFront, mattZ1 = zHbFront + mat.d;
  const mattHalf = mat.w / 2;

  const group = new THREE.Group();
  group.name = spec.id || 'twin_bed';
  const textures = [];
  const add = (geom, material, { role, cast = true, name } = {}) => {
    const m = new THREE.Mesh(geom, material);
    m.castShadow = cast; m.receiveShadow = true;
    if (role) m.userData.role = role;
    if (name) m.name = name;
    group.add(m);
    return m;
  };

  // ---- frame: grey velvet
  const baseColor = new THREE.Color(spec.color || '#67686A');
  const velvet = new THREE.MeshPhysicalMaterial({
    color: baseColor.clone(), roughness: 0.85, metalness: 0,
    sheen: 1, sheenRoughness: 0.5, sheenColor: baseColor.clone().lerp(new THREE.Color('#ffffff'), 0.45),
  });
  const legMat = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.45, metalness: 0 });

  // headboard: backing panel (full height, flat top) + lower full-depth band behind the mattress
  const backT = hbT * 0.62, chDepth = hbT - backT;
  const chStart = mattTop + 0.015;
  const back = roundedBox(W, hbH - railBottom, backT, 0.012, 3);
  back.translate(0, (hbH + railBottom) / 2, zBack + backT / 2);
  const band = roundedBox(W, chStart - railBottom, hbT, 0.012, 3);
  band.translate(0, (chStart + railBottom) / 2, zBack + hbT / 2);
  add(mergeGeometries([back, band]), velvet, { role: 'body', name: 'headboard' });

  // padded vertical channels from just above the mattress line to the top
  const chW = W / nCh;
  const chList = [];
  for (let k = 0; k < nCh; k++) {
    const c = channelGeometry(chW, hbH - chStart, chDepth, quality === 'low' ? 8 : 14, quality);
    c.translate(-W / 2 + chW * (k + 0.5), chStart, zBack + backT);
    chList.push(c);
  }
  add(mergeGeometries(chList), velvet, { role: 'body', name: 'headboard_channels' });

  // side + foot rails: one slim upholstered platform band from the headboard to the foot
  const rail = roundedBox(W, railH, zFoot - zHbFront, 0.014, 3);
  rail.translate(0, railBottom + railH / 2, (zFoot + zHbFront) / 2);
  add(rail, velvet, { role: 'body', name: 'rails' });

  // legs: tapered black rounds, inset from the corners, + a center support under the foot rail
  const inset = 0.06, legSeg = quality === 'low' ? 10 : 18;
  const legSpots = [
    [-(W / 2 - inset), zBack + hbT / 2], [W / 2 - inset, zBack + hbT / 2],
    [-(W / 2 - inset), zFoot - inset], [W / 2 - inset, zFoot - inset], [0, zFoot - inset],
  ];
  const legs = legSpots.map(([x, z]) => {
    const c = new THREE.CylinderGeometry(0.021, 0.013, legH, legSeg, 1);
    c.translate(x, legH / 2, z);
    return c;
  });
  add(mergeGeometries(legs), legMat, { role: 'legs', name: 'legs' });

  // ---- mattress, wearing the fitted sheet
  const sheetColor = bedding === 'none' ? '#F3F1EC'
    : bedding === 'lavender_pompom' ? (bs.sheet_color || bs.comforter_color || '#D3C6E2')
    : (bs.sheet_color || '#AE96B0');
  const sheetMat = new THREE.MeshStandardMaterial({ color: sheetColor, roughness: 0.95 });
  // recolorable groups: sheets = fitted sheet + pillowcases; comforter = comforter, shams, pom-poms
  const sheetMats = [sheetMat], comforterMats = [];
  const mattress = roundedBox(mat.w, mat.thickness, mat.d, 0.035, 3);
  mattress.translate(0, deckTop + mat.thickness / 2, (mattZ0 + mattZ1) / 2);
  add(mattress, sheetMat, { role: 'sheet', name: 'mattress' });

  const sphereSeg = quality === 'low' ? [6, 4] : [8, 6];
  const spacing = quality === 'low' ? 0.035 : 0.02;
  const pompomCenters = [];

  // Pillow placement: leaning back against the headboard (or the pillow behind),
  // bottom edge resting on the mattress. Returns the next lean-on z.
  const placePillow = (geom, material, { h, halfT, tilt, x = 0, zLean, name, sag = 0.012 }) => {
    const m = add(geom, material, { role: 'bedding', name });
    m.rotation.x = -tilt;
    const zc = zLean + halfT / Math.cos(tilt);
    m.position.set(x, mattTop + (h / 2) * Math.cos(tilt) - sag, zc);
    m.updateMatrix();
    return { mesh: m, zNext: zc + halfT / Math.cos(tilt) - 0.035 };
  };

  if (bedding !== 'none') {
    const lav = bedding === 'lavender_pompom';
    const loft = lav ? 0.035 : 0.025;
    const rc = loft + 0.025;                    // bend radius over the mattress edge (clears its rounding)
    const hangX = mattHalf + 0.01;              // hanging plane just outside the mattress side
    const hangZ = mattZ1 + 0.01;
    const topY = mattTop + loft;
    const hemY = mattTop - HEM_BELOW_TOP;
    const xi = hangX - rc;
    const arc = Math.PI / 2 * rc;
    const dropExt = arc + (topY - rc - hemY);   // fabric length past the bend start for a full drape
    const shortExt = arc + 0.02;                // non-draped side: just rolls over the edge
    const zFold = mattZ0 + (lav ? 0.40 : 0.58); // head fold line (floral: ~30% of the length)
    const F = lav ? 0.14 : 0.22;                // turned-back flap length
    const pattern = lav ? lavenderPattern : floralPattern;
    const amp = lav ? 0.014 : 0.011;

    let comfMat, shamMat, pillowMat;
    if (lav) {
      const c = bs.comforter_color || '#D3C6E2';
      comfMat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, side: THREE.DoubleSide });
      pillowMat = new THREE.MeshStandardMaterial({ color: bs.pillowcase_color || c, roughness: 0.95 });
      shamMat = new THREE.MeshStandardMaterial({ color: bs.pillowcase_color || c, roughness: 0.95 });
    } else {
      let map = null;
      if (ctx && ctx.loadTexture && opts.floralTextureUrl) {
        // UVs are in tiles of 0.55 m of fabric, so repeat stays 1:1 for every piece
        map = ctx.loadTexture(opts.floralTextureUrl, { repeat: [1, 1], wrap: 'repeat' });
        textures.push(map);
      }
      comfMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map, roughness: 0.92, side: THREE.DoubleSide });
      shamMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map, roughness: 0.92 });
      pillowMat = new THREE.MeshStandardMaterial({ color: bs.pillowcase_color || bs.sheet_color || '#AE96B0', roughness: 0.95 });
    }
    sheetMats.push(pillowMat);
    comforterMats.push(comfMat, shamMat);

    // main comforter layer, from the fold line to the foot
    const main = drapedSurface({
      x0: -xi, x1: xi, z0: zFold, z1: hangZ - rc,
      extL: drape.left ? dropExt : shortExt, extR: drape.right ? dropExt : shortExt,
      extH: 0, extF: dropExt, topY, rc, spacing, pattern, amp, waveAmp: 0.004,
    });
    add(main.geometry, comfMat, { role: 'bedding', name: 'comforter' });

    // turned-back flap + roll at the head
    const rf = loft * 0.45;
    const flap = flapSurface({
      xiF: hangX - 0.018, rcF: 0.03, extF: Math.PI / 2 * 0.03 + 0.015,
      zFold, F, rf, topY, spacing, pattern, amp: amp * 0.7,
    });
    add(flap.geometry, comfMat, { role: 'bedding', name: 'comforter_fold' });

    if (lav) {
      // thin self-colored piping on the hem and on the flap edge
      const pipeR = 0.004;
      const tubes = [pipingTube(main.path, pipeR, quality), pipingTube(flap.edge, pipeR, quality)].filter(Boolean);
      add(mergeGeometries(tubes), comfMat, { role: 'bedding', name: 'piping', cast: false });
      // ball fringe hanging at the hem wherever the comforter actually hangs (draped sides + foot)
      const r = 0.0085, lim = 0.0015;
      for (const p of resample(main.path, 0.04)) {
        if (p.y > hemY + 0.02) continue;
        pompomCenters.push(new THREE.Vector3(
          clamp(p.x, -W / 2 + r + lim, W / 2 - r - lim), p.y - pipeR - r * 0.9,
          clamp(p.z, zBack + r + lim, zFoot - r - lim)));
      }
    }

    // pillows leaning against the headboard
    const q = { quality };
    // Full/double and wider: pillows sit in pairs, side by side (like the product photo).
    const wide = mat.w >= 1.25;
    const pw = Math.min(0.64, mat.w / 2 - 0.02), px = pw / 2 + 0.01;
    if (wide && lav) {
      const deg = THREE.MathUtils.degToRad;
      let zNext = zHbFront;
      for (const s of [-1, 1]) {
        const A = placePillow(pillowGeometry(pw, 0.48, 0.15, q), pillowMat,
          { h: 0.48, halfT: 0.075, tilt: deg(12), x: s * px, zLean: zHbFront, name: 'pillow' });
        zNext = A.zNext;
      }
      for (const s of [-1, 1]) {
        const B = placePillow(pillowGeometry(pw - 0.02, 0.46, 0.13, q), shamMat,
          { h: 0.46, halfT: 0.065, tilt: deg(20), x: s * px, zLean: zNext, name: 'sham_pompom', sag: -0.006 });
        for (const p of pillowOutlinePoints(pw - 0.02, 0.46, 0.04, 0.04, 0.0085 + 0.001)) pompomCenters.push(p.applyMatrix4(B.mesh.matrix));
      }
    } else if (wide) {
      const deg = THREE.MathUtils.degToRad;
      let zNext = zHbFront;
      for (const s of [-1, 1]) {
        const A = placePillow(pillowGeometry(pw, 0.48, 0.14, q), pillowMat,
          { h: 0.48, halfT: 0.07, tilt: deg(10), x: s * px, zLean: zHbFront, name: 'pillow_mauve' });
        zNext = A.zNext;
      }
      for (const s of [-1, 1]) {
        placePillow(pillowGeometry(pw, 0.51, 0.12, { flange: 0.045, quality }), shamMat,
          { h: 0.51, halfT: 0.06, tilt: deg(18), x: s * px, zLean: zNext, name: 'sham_floral', sag: 0.02 });
      }
    } else if (lav) {
      const A = placePillow(pillowGeometry(0.66, 0.48, 0.15, q), pillowMat,
        { h: 0.48, halfT: 0.075, tilt: THREE.MathUtils.degToRad(12), zLean: zHbFront, name: 'pillow' });
      const shamW = 0.64, shamH = 0.46;
      const B = placePillow(pillowGeometry(shamW, shamH, 0.13, q), shamMat,
        { h: shamH, halfT: 0.065, tilt: THREE.MathUtils.degToRad(20), zLean: A.zNext, name: 'sham_pompom', sag: -0.006 });  // lifted so the bottom balls rest on the sheet
      // pom-poms on all 4 sham edges (in the sham's local frame, then to bed space)
      for (const p of pillowOutlinePoints(shamW, shamH, 0.04, 0.04, 0.0085 + 0.001)) {
        pompomCenters.push(p.applyMatrix4(B.mesh.matrix));
      }
    } else {
      const deg = THREE.MathUtils.degToRad;
      const A = placePillow(pillowGeometry(0.66, 0.48, 0.14, q), pillowMat,
        { h: 0.48, halfT: 0.07, tilt: deg(10), x: -0.02, zLean: zHbFront, name: 'pillow_mauve_1' });
      const B = placePillow(pillowGeometry(0.66, 0.48, 0.14, q), pillowMat,
        { h: 0.48, halfT: 0.07, tilt: deg(14), x: 0.03, zLean: A.zNext, name: 'pillow_mauve_2' });
      const C = placePillow(pillowGeometry(0.66, 0.51, 0.12, { flange: 0.045, quality }), shamMat,
        { h: 0.51, halfT: 0.06, tilt: deg(18), x: -0.05, zLean: B.zNext, name: 'sham_floral_1', sag: 0.02 });
      placePillow(pillowGeometry(0.66, 0.51, 0.12, { flange: 0.045, quality }), shamMat,
        { h: 0.51, halfT: 0.06, tilt: deg(22), x: 0.06, zLean: C.zNext, name: 'sham_floral_2', sag: 0.035 });
    }

    if (pompomCenters.length) {
      const pomMat = new THREE.MeshStandardMaterial({ color: bs.pompom_color || bs.comforter_color || '#D3C6E2', roughness: 1 });
      comforterMats.push(pomMat);
      const sph = new THREE.SphereGeometry(0.0085, sphereSeg[0], sphereSeg[1]);
      const im = new THREE.InstancedMesh(sph, pomMat, pompomCenters.length);
      const m4 = new THREE.Matrix4();
      pompomCenters.forEach((c, k) => { m4.makeTranslation(c.x, c.y, c.z); im.setMatrixAt(k, m4); });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingBox(); im.computeBoundingSphere();
      im.castShadow = true; im.receiveShadow = true;
      im.userData.role = 'bedding'; im.name = 'pompoms';
      group.add(im);
    }
  }

  // remember each material's own color so "Original" can put it back
  for (const m of [...sheetMats, ...comforterMats]) m.userData.baseColor = m.color.getHex();
  const recolor = (mats, hex) => { for (const m of mats) { if (hex) m.color.set(hex); else m.color.setHex(m.userData.baseColor); } };

  group.userData = {
    kind: 'bed',
    size: { w: W, d: D, h: H },
    bedding,
    drape: { left: !!drape.left, right: !!drape.right },
    setColor(hex) {
      // only the velvet frame follows the item color; bedding/legs stay as they are
      velvet.color.set(hex);
      velvet.sheenColor.set(hex).lerp(new THREE.Color('#ffffff'), 0.45);
    },
    /** Fitted sheet + pillowcases. null = the bedding's own color. */
    baseSheetColor: '#' + sheetMat.color.getHexString(),
    baseComforterColor: comforterMats.length ? '#' + comforterMats[0].color.getHexString() : null,
    setSheetColor(hex) { recolor(sheetMats, hex); },
    /** Comforter, shams and pom-poms (tints the floral print). null = as bought. Absent with no comforter. */
    setComforterColor: comforterMats.length ? (hex) => recolor(comforterMats, hex) : undefined,
    dispose() {
      const mats = new Set();
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m));
        if (o.isInstancedMesh) o.dispose();
      });
      mats.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
  return group;
}
