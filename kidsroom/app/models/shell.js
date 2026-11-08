// Room shell for Alice's room: walls (with real openings), oak floor, trim, doors,
// window + sky, curtains, star decals, ceiling + fan, small fixtures.
// All sizes come from room.json; see docs/CONTRACT.md.
import * as THREE from 'three';

// ---------------------------------------------------------------- helpers

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// First #rrggbb found in a string (room.json often embeds colors in prose).
function hexIn(str, fallback) {
  const m = typeof str === 'string' ? str.match(/#[0-9a-fA-F]{6}/) : null;
  return m ? m[0] : fallback;
}
function numIn(str, re, fallback) {
  const m = typeof str === 'string' ? str.match(re) : null;
  return m ? parseFloat(m[1]) : fallback;
}
function hexToRgb(hex) {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function rgba(rgb, a = 1) {
  return `rgba(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])},${a})`;
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// Linear gradient with a graceful fallback when the 2D context is a stub.
function linGrad(c, x0, y0, x1, y1, stops) {
  const g = c.createLinearGradient ? c.createLinearGradient(x0, y0, x1, y1) : null;
  if (!g || typeof g.addColorStop !== 'function') return stops[0][1];
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}
function radGrad(c, x, y, r, stops) {
  const g = c.createRadialGradient ? c.createRadialGradient(x, y, 0, x, y, r) : null;
  if (!g || typeof g.addColorStop !== 'function') return stops[0][1];
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

// Concatenate geometries (any mix of indexed / non-indexed) into one non-indexed geometry.
// Inputs are disposed. Keeps position, normal, uv.
function mergeGeoms(geoms) {
  const parts = [];
  let total = 0;
  for (const g of geoms) {
    const ng = g.index ? g.toNonIndexed() : g;
    if (ng !== g) g.dispose();
    if (!ng.attributes.normal) ng.computeVertexNormals();
    parts.push(ng);
    total += ng.attributes.position.count;
  }
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  let o = 0;
  for (const g of parts) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += n;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}

// Axis-aligned box from ranges.
function boxR(x0, x1, y0, y1, z0, z1) {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  return g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
}

function addMesh(parent, geom, material, { cast = true, receive = true, name } = {}) {
  const m = new THREE.Mesh(geom, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  if (name) m.name = name;
  parent.add(m);
  return m;
}
function noRaycast(m) { m.raycast = () => {}; return m; }

// 4-point star (decals) and 5-point star (curtain print).
function starPath(c, x, y, R, points, inner, rot = 0) {
  c.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 ? R * inner : R;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
  c.fill();
}

// Raised (pillowed) door panel, optionally with a circular-arc ("camber") top.
// Returned in panel-local coords: x centered, y from 0..h, z in [-bt, depth+bt].
function raisedPanel(w, h, rise, Q) {
  const bs = 0.012, bt = 0.005, depth = 0.002;
  const iw = w - 2 * bs, ih = h - 2 * bs;
  const s = new THREE.Shape();
  s.moveTo(-iw / 2, 0);
  s.lineTo(iw / 2, 0);
  if (rise > 0.001) {
    const r = Math.min(rise, ih * 0.3);
    s.lineTo(iw / 2, ih - r);
    // circle through both springing points and the crown
    const Rr = (iw * iw / 4 + r * r) / (2 * r), cy = ih - Rr;
    for (let i = 1; i < Q.arcSeg; i++) {
      const x = iw / 2 - (iw * i) / Q.arcSeg;
      s.lineTo(x, cy + Math.sqrt(Rr * Rr - x * x));
    }
    s.lineTo(-iw / 2, ih - r);
  } else {
    s.lineTo(iw / 2, ih);
    s.lineTo(-iw / 2, ih);
  }
  const g = new THREE.ExtrudeGeometry(s, {
    depth, bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelSegments: Q.bevelSeg, steps: 1,
  });
  g.translate(0, bs, 0);
  return g;
}

// Door slab with raised panels on both faces. Local frame: x 0..W (hinge at 0), y 0..Hd, z ±t/2.
function doorLeafGeom(W, Hd, t, panels, Q) {
  const parts = [boxR(0, W, 0, Hd, -t / 2, t / 2)];
  for (const p of panels) {
    const front = raisedPanel(p.w, p.y1 - p.y0, p.rise, Q);
    const back = front.clone();
    front.translate(p.cx, p.y0, t / 2);
    back.rotateY(Math.PI).translate(p.cx, p.y0, -t / 2);
    parts.push(front, back);
  }
  return mergeGeoms(parts);
}

// Door/window casing (flat board + thicker back band on the outer edge).
// Opening spans u0..u1, legs from yBottom..yTop, head above yTop. Casing is clamped to uLo..uHi.
// zFace = wall face, dir = +1 (towards room) or -1 (hallway side).
function casingGeoms(u0, u1, yBottom, yTop, uLo, uHi, zFace, dir, cw) {
  const cd = 0.016, bw = 0.015, bd = 0.024;
  const lo = Math.max(u0 - cw, uLo), hi = Math.min(u1 + cw, uHi);
  const zb = [zFace, zFace + dir * cd].sort((a, b) => a - b);
  const zk = [zFace, zFace + dir * bd].sort((a, b) => a - b);
  const g = [];
  const yHead = yTop + cw;
  // legs (board) + back bands
  if (u0 - lo > bw + 0.005) g.push(boxR(lo + bw, u0, yBottom, yTop, zb[0], zb[1]));
  if (u0 - lo > 0.004) g.push(boxR(lo, lo + Math.min(bw, u0 - lo), yBottom, yHead, zk[0], zk[1]));
  if (hi - u1 > bw + 0.005) g.push(boxR(u1, hi - bw, yBottom, yTop, zb[0], zb[1]));
  if (hi - u1 > 0.004) g.push(boxR(hi - Math.min(bw, hi - u1), hi, yBottom, yHead, zk[0], zk[1]));
  // head
  const hl = lo + Math.min(bw, u0 - lo), hr = hi - Math.min(bw, hi - u1);
  g.push(boxR(hl, hr, yTop, yHead - bw, zb[0], zb[1]));
  g.push(boxR(hl, hr, yHead - bw, yHead, zk[0], zk[1]));
  return { geoms: g, lo, hi };
}

// Baseboard segment along a wall (local u range), with a small bead on top.
function baseboardGeoms(u0, u1, h) {
  if (u1 - u0 < 0.02) return [];
  return [boxR(u0, u1, 0, h - 0.012, 0, 0.011), boxR(u0, u1, h - 0.012, h, 0, 0.015)];
}

// ---------------------------------------------------------------- canvases

// Strip oak floor. Boards run along canvas Y (mapped to world Z). The pattern tiles in both
// directions: each column wraps its last board back to its first joint.
function drawFloor(c, Wc, Hc, boardsAcross, tileLenM, baseHex, rng) {
  const base = hexToRgb(baseHex);
  const bw = Wc / boardsAcross;
  const pxPerM = Hc / tileLenM;
  c.fillStyle = rgba(base);
  c.fillRect(0, 0, Wc, Hc);
  const joints = [];

  const drawBoard = (x0, ya, len) => {
    // per-board tone: brightness + warmth jitter (honey <-> reddish)
    const f = 0.84 + rng() * 0.3;
    const warm = (rng() - 0.5) * 22;
    const col = [base[0] * f + warm * 0.6, base[1] * f - warm * 0.15, base[2] * f - warm * 0.5];
    const dark = [col[0] * 0.62, col[1] * 0.5, col[2] * 0.38];
    const light = [Math.min(255, col[0] * 1.12), Math.min(255, col[1] * 1.12), Math.min(255, col[2] * 1.1)];
    const seeds = Array.from({ length: 40 }, () => rng());
    for (const off of [0, -Hc]) {
      const y0 = ya + off;
      if (y0 + len < 0 || y0 > Hc) continue;
      let k = 0; const r = () => seeds[(k++) % seeds.length];
      c.save();
      c.beginPath(); c.rect(x0, y0, bw, len); c.clip();
      c.fillStyle = rgba(col);
      c.fillRect(x0, y0, bw, len);
      // broad lengthwise tone streaks
      for (let i = 0; i < 4; i++) {
        c.fillStyle = rgba(r() > 0.5 ? light : dark, 0.05 + r() * 0.07);
        c.fillRect(x0 + r() * bw, y0, bw * (0.15 + r() * 0.35), len);
      }
      // straight grain lines
      c.lineCap = 'round';
      const nLines = 6 + Math.floor(r() * 6);
      for (let i = 0; i < nLines; i++) {
        c.strokeStyle = rgba(dark, 0.1 + r() * 0.2);
        c.lineWidth = 0.5 + r() * 1.2;
        let x = x0 + r() * bw;
        const ph = r() * 6.28, amp = 0.4 + r() * 1.4;
        c.beginPath(); c.moveTo(x, y0);
        for (let y = 24; y <= len + 24; y += 24) {
          c.lineTo(x + Math.sin(ph + y * 0.01) * amp, y0 + y);
        }
        c.stroke();
      }
      // flat-sawn "cathedral" arches on about half the boards
      if (r() < 0.5) {
        const xc = x0 + bw * (0.3 + r() * 0.4);
        const apex = y0 + len * (0.15 + r() * 0.7);
        const dir = r() < 0.5 ? 1 : -1;
        const n = 3 + Math.floor(r() * 3);
        for (let i = 1; i <= n; i++) {
          const s = i * bw * 0.085;
          const L = 60 + i * (45 + r() * 30);
          c.strokeStyle = rgba(dark, 0.14 + r() * 0.16);
          c.lineWidth = 0.8 + r() * 0.9;
          c.beginPath();
          c.moveTo(xc - s, apex + dir * L);
          c.bezierCurveTo(xc - s, apex - dir * i * 4, xc + s, apex - dir * i * 4, xc + s, apex + dir * L);
          c.stroke();
        }
      }
      // red-oak ray flecks
      for (let i = 0; i < 8; i++) {
        c.fillStyle = rgba(dark, 0.18 + r() * 0.15);
        c.fillRect(x0 + r() * bw, y0 + r() * len, 1, 2 + r() * 6);
      }
      // slightly darker eased edges
      c.fillStyle = rgba(dark, 0.16);
      c.fillRect(x0, y0, 2, len);
      c.fillRect(x0 + bw - 2, y0, 2, len);
      c.restore();
    }
  };

  for (let i = 0; i < boardsAcross; i++) {
    const x0 = i * bw;
    const start = rng() * Hc;
    const segs = [];
    let y = start;
    while (y < start + Hc - 0.001) {
      let len = (0.35 + rng() * 0.95) * pxPerM;
      if (start + Hc - (y + len) < 0.25 * pxPerM) len = start + Hc - y; // last board closes the loop
      segs.push([y, len]);
      y += len;
    }
    for (const [ya, len] of segs) {
      const yw = ya % Hc;
      drawBoard(x0, yw, len);
      joints.push([x0, yw]);
    }
  }
  // seams between boards and butt joints
  c.fillStyle = 'rgba(58,28,10,0.7)';
  for (let i = 0; i < boardsAcross; i++) c.fillRect(i * bw, 0, 1.3, Hc);
  for (const [x0, y] of joints) c.fillRect(x0, y - 0.7, bw, 1.4);
  c.fillStyle = 'rgba(255,225,180,0.10)';
  for (let i = 0; i < boardsAcross; i++) c.fillRect(i * bw + 1.3, 0, 1, Hc);
}

// Soft sky + blurred trees seen through the window.
function drawSky(c, Wc, Hc, rng) {
  c.fillStyle = linGrad(c, 0, 0, 0, Hc, [[0, '#8fbbe3'], [0.45, '#c4dcef'], [0.75, '#e4eee9'], [1, '#dfe8dc']]);
  c.fillRect(0, 0, Wc, Hc);
  const greens = ['#4d7440', '#5f8a4a', '#77a058', '#8fb66a', '#a6c47d', '#3e6236'];
  // trunks first (faint), then layers of leafy blobs from back (pale) to front (dark)
  for (let i = 0; i < 14; i++) {
    c.fillStyle = 'rgba(80,70,55,0.25)';
    c.fillRect(rng() * Wc, Hc * (0.35 + rng() * 0.3), 3 + rng() * 6, Hc);
  }
  for (let layer = 0; layer < 3; layer++) {
    const n = 70 + layer * 30;
    for (let i = 0; i < n; i++) {
      const x = rng() * Wc;
      const y = Hc * (0.18 + layer * 0.12 + Math.pow(rng(), 0.7) * (0.85 - layer * 0.1));
      const r = (Wc / 1024) * (25 + rng() * (90 - layer * 20));
      const g = hexToRgb(greens[Math.floor(rng() * greens.length)]);
      const a = 0.35 + layer * 0.2;
      c.fillStyle = radGrad(c, x, y, r, [[0, rgba(g, a)], [0.6, rgba(g, a * 0.6)], [1, rgba(g, 0)]]);
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
  }
  // light haze over the top of the tree line
  c.fillStyle = linGrad(c, 0, 0, 0, Hc * 0.5, [[0, 'rgba(220,235,248,0.55)'], [1, 'rgba(220,235,248,0)']]);
  c.fillRect(0, 0, Wc, Hc * 0.5);
}

// Navy blackout fabric with scattered silver 5-point stars. Tiles seamlessly.
function drawCurtainFabric(c, S, navyHex, rng) {
  const navy = hexToRgb(navyHex);
  c.fillStyle = rgba(navy);
  c.fillRect(0, 0, S, S);
  // faint weave
  for (let i = 0; i < S; i += 2) {
    c.fillStyle = rgba([255, 255, 255], 0.012 + rng() * 0.02);
    c.fillRect(i, 0, 1, S);
  }
  const stars = [];
  let tries = 0;
  while (stars.length < 42 && tries++ < 2000) {
    const x = rng() * S, y = rng() * S;
    const R = S * (0.012 + rng() * 0.016);
    let ok = true;
    for (const s of stars) {
      let dx = Math.abs(s.x - x), dy = Math.abs(s.y - y);
      dx = Math.min(dx, S - dx); dy = Math.min(dy, S - dy);
      if (dx * dx + dy * dy < (S * 0.07) ** 2) { ok = false; break; }
    }
    if (ok) stars.push({ x, y, R, rot: rng() * 1.2 });
  }
  // silver stars on dark fabric; on a light fabric they're a darker shade of it so they still show
  const lum = (0.2126 * navy[0] + 0.7152 * navy[1] + 0.0722 * navy[2]) / 255;
  for (const s of stars) {
    const shade = 200 + rng() * 40;
    const k = 0.68 + (shade - 200) / 400;
    c.fillStyle = lum > 0.55 ? rgba(navy.map(v => Math.round(v * k))) : rgba([shade, shade + 4, shade + 12]);
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
      starPath(c, s.x + dx, s.y + dy, s.R, 5, 0.45, s.rot);
    }
  }
}

// ---------------------------------------------------------------- main builder

export function buildRoomShell(room, ctx) {
  const R = room.room;
  const F = room.finishes || {};
  const H = R.ceiling_height;
  const T = R.wall_thickness ?? 0.16;
  const low = ctx.quality === 'low';
  const Q = { seg: low ? 16 : 32, arcSeg: low ? 8 : 16, bevelSeg: low ? 1 : 2 };
  const rng = mulberry32(0xa11ce);
  const textures = [];
  const tex = (canvas, opts) => { const t = ctx.canvasTexture(canvas, opts); textures.push(t); return t; };

  const trimHex = hexIn(F.trim_and_doors, '#F4F2EE');
  const baseH = numIn(F.trim_and_doors, /Baseboards\s+([\d.]+)/i, 0.09);
  const CW = numIn(F.trim_and_doors, /casings\s*~?\s*([\d.]+)/i, 0.07);
  const wallHex = (F.current_wall_color && F.current_wall_color[1]) || '#D3E0E5';
  const fixtures = F.small_fixtures_optional || [];
  const fixture = (key) => fixtures.find((f) => (f.what || '').toLowerCase().includes(key));

  const root = new THREE.Group();
  root.name = 'shell';

  // ---- shared materials
  const M = {
    side: new THREE.MeshStandardMaterial({ color: '#f1ede6', roughness: 0.85 }),
    trim: new THREE.MeshStandardMaterial({ color: trimHex, roughness: 0.6 }),
    metal: new THREE.MeshStandardMaterial({ color: '#c6c7c5', metalness: 1, roughness: 0.35 }),
    plastic: new THREE.MeshStandardMaterial({ color: '#f4f3ef', roughness: 0.45 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2b2c2f', roughness: 0.55, metalness: 0.4 }),
    glass: new THREE.MeshStandardMaterial({
      color: '#cfe4f2', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.25, depthWrite: false,
    }),
    rod: new THREE.MeshStandardMaterial({ color: '#26262b', metalness: 0.6, roughness: 0.45 }),
  };

  // ---- floor (covers interior + under walls)
  const boardW = 0.057; // 2.25" strips
  const boardsAcross = 20;
  const tileW = boardsAcross * boardW; // 1.14 m
  const tileL = 2 * tileW; // 2.28 m along the boards
  const floorCanvas = ctx.makeCanvas(low ? 512 : 1024, low ? 1024 : 2048);
  drawFloor(floorCanvas.getContext('2d'), floorCanvas.width, floorCanvas.height, boardsAcross, tileL,
    hexIn(F.floor, '#C68B4E'), rng);
  const floorTex = tex(floorCanvas, { srgb: true, wrap: 'repeat' });
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.35, metalness: 0 });
  // Plane UVs are scaled to tile units so the texture repeat stays [1,1] and boards are real size.
  const floorPlane = (w, d) => {
    const g = new THREE.PlaneGeometry(w, d);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tileW, (uv.getY(i) * d) / tileL);
    return g.rotateX(-Math.PI / 2); // canvas Y (board length) -> world Z
  };
  const fx0 = R.x_west - T, fx1 = R.x_east + T, fz0 = R.z_south - T, fz1 = R.z_north + T;
  const floor = addMesh(root, floorPlane(fx1 - fx0, fz1 - fz0).translate((fx0 + fx1) / 2, 0, (fz0 + fz1) / 2),
    floorMat, { cast: false, name: 'floor' });
  floor.userData.pick = { type: 'floor' };

  // ---- walls
  const walls = {};
  const wallInfo = {};
  const paintMats = {};
  const xmid = (R.x_west + R.x_east) / 2, zmid = (R.z_south + R.z_north) / 2;

  for (const w of room.walls) {
    const n = new THREE.Vector3(...w.inward_normal).normalize();
    const theta = Math.atan2(n.x, n.z);
    const localX = new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta)); // viewer's right
    const runsX = w.x_from !== undefined;
    let origin, L, uMin, uMax;
    if (runsX) {
      const z = n.z < 0 ? R.z_north : R.z_south;
      origin = new THREE.Vector3((w.x_from + w.x_to) / 2, 0, z);
      L = w.x_to - w.x_from;
      uMin = -L / 2 - T; uMax = L / 2 + T; // north/south cover the corners
    } else {
      const x = n.x > 0 ? R.x_west : R.x_east;
      origin = new THREE.Vector3(x, 0, (w.z_from + w.z_to) / 2);
      L = w.z_to - w.z_from;
      uMin = -L / 2; uMax = L / 2;
    }
    const toU = (px, pz) => (px - origin.x) * localX.x + (pz - origin.z) * localX.z;
    const toZ = (px, pz) => (px - origin.x) * n.x + (pz - origin.z) * n.z; // inward distance
    const openings = (w.openings || []).map((o) => {
      const uc = runsX ? toU(o.center_x, origin.z) : toU(origin.x, o.center_z);
      const y0 = o.sill_height || 0;
      return { ...o, u0: uc - o.width / 2, u1: uc + o.width / 2, uc, y0, y1: y0 + o.height };
    });

    // The wall group IS the wall-local frame: origin on the interior face at the wall's
    // horizontal midpoint, floor level; +Z = inward normal; +X = viewer's right.
    const group = new THREE.Group();
    group.name = 'wall_' + w.id;
    group.position.copy(origin);
    group.rotation.y = theta;
    root.add(group);
    const mount = new THREE.Object3D();
    mount.name = 'mount_' + w.id;
    group.add(mount);

    // Solid: outline with door notches cut from the bottom edge + window holes.
    const doors = openings.filter((o) => o.y0 < 0.001).sort((a, b) => a.u0 - b.u0);
    const holes = openings.filter((o) => o.y0 >= 0.001);
    const shape = new THREE.Shape();
    shape.moveTo(uMin, 0);
    for (const d of doors) {
      shape.lineTo(d.u0, 0); shape.lineTo(d.u0, d.y1); shape.lineTo(d.u1, d.y1); shape.lineTo(d.u1, 0);
    }
    shape.lineTo(uMax, 0); shape.lineTo(uMax, H); shape.lineTo(uMin, H); shape.lineTo(uMin, 0);
    for (const h of holes) {
      const p = new THREE.Path();
      p.moveTo(h.u0, h.y0); p.lineTo(h.u1, h.y0); p.lineTo(h.u1, h.y1); p.lineTo(h.u0, h.y1); p.lineTo(h.u0, h.y0);
      shape.holes.push(p);
    }
    const wg = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, steps: 1 });
    wg.translate(0, 0, -T); // extrude outward: z in [-T, 0]
    const paint = new THREE.MeshStandardMaterial({ color: wallHex, roughness: 0.9, metalness: 0 });
    paintMats[w.id] = paint;
    // ExtrudeGeometry: group 0 = caps (room face + outside face), group 1 = sides (cut top, reveals)
    const solid = addMesh(group, wg, [paint, M.side], { name: 'wall_solid_' + w.id });
    solid.userData.pick = { type: 'wall', wall: w.id };

    const center = origin.clone().setY(H / 2);
    walls[w.id] = { group, mount, center, outward: n.clone().negate(), length: L };
    wallInfo[w.id] = {
      w, group, n, theta, localX, origin, L, uMin, uMax, uIn0: -L / 2, uIn1: L / 2, toU, toZ, openings, runsX,
      trim: [], metal: [], plastic: [], dark: [],
    };
  }

  // ---- baseboards + casings (per wall)
  for (const id in wallInfo) {
    const I = wallInfo[id];
    // East/west baseboards stop at the face of the north/south ones (no overlap in corners).
    const inset = I.runsX ? 0 : 0.016;
    let segs = [[I.uIn0 + inset, I.uIn1 - inset]];
    for (const o of I.openings) {
      if (o.type !== 'door') continue;
      const cas = casingGeoms(o.u0, o.u1, 0, o.y1, I.uIn0, I.uIn1, 0, 1, CW);
      I.trim.push(...cas.geoms);
      const next = [];
      for (const [a, b] of segs) {
        if (b <= cas.lo || a >= cas.hi) { next.push([a, b]); continue; }
        if (a < cas.lo) next.push([a, cas.lo]);
        if (b > cas.hi) next.push([cas.hi, b]);
      }
      segs = next;
    }
    for (const [a, b] of segs) I.trim.push(...baseboardGeoms(a, b, baseH));
  }

  // ---- north: window, sky backdrop, curtains, outlet, register
  const north = wallInfo.north;
  let curtainsGroup = null;
  let curtainRedraw = null;   // (hex|null) => repaint the fabric; null = original color
  if (north) {
    const win = north.openings.find((o) => o.type === 'window');
    if (win) {
      const { u0, u1, y0, y1 } = win;
      // casing + stool + apron
      const stoolTop = y0 + 0.003;
      const cas = casingGeoms(u0, u1, stoolTop, y1, north.uIn0, north.uIn1, 0, 1, CW);
      north.trim.push(...cas.geoms);
      north.trim.push(boxR(cas.lo - 0.02, cas.hi + 0.02, y0 - 0.022, stoolTop, -0.04, 0.045)); // stool
      north.trim.push(boxR(cas.lo, cas.hi, y0 - 0.022 - CW, y0 - 0.022, 0, 0.016)); // apron
      // window frame inside the opening
      const fw = 0.025, fz0 = -0.13, fz1 = -0.02;
      north.trim.push(boxR(u0, u0 + fw, stoolTop, y1, fz0, fz1), boxR(u1 - fw, u1, stoolTop, y1, fz0, fz1));
      north.trim.push(boxR(u0 + fw, u1 - fw, y1 - fw, y1, fz0, fz1), boxR(u0 + fw, u1 - fw, stoolTop, stoolTop + fw, fz0, fz1));
      // two sashes, 6-over-6 (each sash 3 lites wide x 2 high)
      const ui0 = u0 + fw, ui1 = u1 - fw, yi0 = stoolTop + fw, yi1 = y1 - fw;
      const mid = (yi0 + yi1) / 2, st = 0.035, sw = 0.05, mw = 0.016, md = 0.02;
      const glassParts = [];
      const sash = (yA, yB, zc, rb, rt) => {
        const z0 = zc - st / 2, z1 = zc + st / 2;
        north.trim.push(boxR(ui0, ui0 + sw, yA, yB, z0, z1), boxR(ui1 - sw, ui1, yA, yB, z0, z1));
        north.trim.push(boxR(ui0 + sw, ui1 - sw, yA, yA + rb, z0, z1), boxR(ui0 + sw, ui1 - sw, yB - rt, yB, z0, z1));
        const gu0 = ui0 + sw, gu1 = ui1 - sw, gy0 = yA + rb, gy1 = yB - rt;
        const xs = [gu0, gu0 + (gu1 - gu0) / 3, gu0 + (2 * (gu1 - gu0)) / 3, gu1];
        const gm = (gy0 + gy1) / 2;
        for (const x of [xs[1], xs[2]]) north.trim.push(boxR(x - mw / 2, x + mw / 2, gy0, gy1, zc - md / 2, zc + md / 2));
        for (let k = 0; k < 3; k++) {
          // horizontal muntin split between the verticals (avoids coplanar overlaps)
          const a = k === 0 ? xs[0] : xs[k] + mw / 2, b = k === 2 ? xs[3] : xs[k + 1] - mw / 2;
          north.trim.push(boxR(a, b, gm - mw / 2, gm + mw / 2, zc - md / 2, zc + md / 2));
        }
        glassParts.push(new THREE.PlaneGeometry(gu1 - gu0, gy1 - gy0).translate((gu0 + gu1) / 2, (gy0 + gy1) / 2, zc));
      };
      sash(yi0, mid + 0.0175, -0.045, 0.07, 0.035); // lower sash, inner track
      sash(mid - 0.0175, yi1, -0.085, 0.035, 0.05); // upper sash, outer track
      north.metal.push(boxR((ui0 + ui1) / 2 - 0.03, (ui0 + ui1) / 2 + 0.03, mid + 0.0175, mid + 0.0295, -0.056, -0.034)); // sash lock
      addMesh(north.group, mergeGeoms(glassParts), M.glass, { cast: false, receive: false, name: 'window_glass' });

      // Sky backdrop ~1.5 m beyond the wall. A stencil mask in the opening limits it to what is
      // seen through the window (renderer stencil buffer is on by default in r160; without one
      // the backdrop simply draws everywhere it is visible, which is still fine).
      const skyCanvas = ctx.makeCanvas(low ? 512 : 1024, low ? 320 : 640);
      drawSky(skyCanvas.getContext('2d'), skyCanvas.width, skyCanvas.height, rng);
      const skyTex = tex(skyCanvas, { srgb: true, wrap: 'clamp' });
      const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false, fog: false });
      skyMat.color.setScalar(0.92);
      skyMat.stencilWrite = true; // enables the stencil test in three
      skyMat.stencilRef = 1;
      skyMat.stencilFunc = THREE.EqualStencilFunc;
      skyMat.stencilFail = skyMat.stencilZFail = skyMat.stencilZPass = THREE.KeepStencilOp;
      const sky = addMesh(north.group, new THREE.PlaneGeometry(5.2, 3.25).translate((u0 + u1) / 2, (y0 + y1) / 2, -T - 1.5),
        skyMat, { cast: false, receive: false, name: 'sky_backdrop' });
      sky.renderOrder = 11;
      noRaycast(sky);
      const maskMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
      maskMat.stencilWrite = true;
      maskMat.stencilRef = 1;
      maskMat.stencilFunc = THREE.AlwaysStencilFunc;
      maskMat.stencilZPass = THREE.ReplaceStencilOp;
      const mask = addMesh(north.group, new THREE.PlaneGeometry(u1 - u0, y1 - y0).translate((u0 + u1) / 2, (y0 + y1) / 2, -T + 0.002),
        maskMat, { cast: false, receive: false, name: 'window_stencil' });
      mask.renderOrder = 10;
      noRaycast(mask);

      // Curtains
      const cur = F.curtains;
      if (cur) {
        curtainsGroup = new THREE.Group();
        curtainsGroup.name = 'curtains';
        north.group.add(curtainsGroup);
        const rodY = cur.rod_height, hem = cur.hem_height;
        const ra = north.toU(cur.rod_x_from, north.origin.z), rb = north.toU(cur.rod_x_to, north.origin.z);
        const rodU0 = Math.min(ra, rb), rodU1 = Math.max(ra, rb);
        const zc = 0.095; // rod / curtain centerline off the wall
        const fabricCanvas = ctx.makeCanvas(low ? 256 : 512, low ? 256 : 512);
        const curtainBase = hexIn(cur.color, '#1f2547');
        // own seed, so a recolor redraws the same stars in the same places
        drawCurtainFabric(fabricCanvas.getContext('2d'), fabricCanvas.width, curtainBase, mulberry32(0x5ca27));
        const fabricTex = tex(fabricCanvas, { srgb: true, wrap: 'repeat' });
        let curtainNow = curtainBase;
        curtainRedraw = (hex) => {
          const want = hex ? hexIn(hex, curtainBase) : curtainBase;
          if (want === curtainNow) return;
          curtainNow = want;
          drawCurtainFabric(fabricCanvas.getContext('2d'), fabricCanvas.width, want, mulberry32(0x5ca27));
          fabricTex.needsUpdate = true;
        };
        const fabricTile = 0.5; // m per texture tile
        const curtainMat = new THREE.MeshStandardMaterial({ map: fabricTex, roughness: 0.88, side: THREE.DoubleSide });
        const rings = [];
        const panel = (a, b) => {
          const wdt = b - a, top = rodY + 0.035, len = top - hem;
          const halfN = Math.max(2, Math.round(wdt / 0.075));
          const period = (2 * wdt) / halfN; // panel edges land on zero crossings (grommets)
          const g = new THREE.PlaneGeometry(wdt, len, halfN * (low ? 5 : 8), low ? 6 : 12);
          const p = g.attributes.position, uv = g.attributes.uv;
          for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i);
            const t = 0.5 - y / len; // 0 at top, 1 at hem
            const amp = 0.03 * (1 + 0.2 * t); // folds flare slightly toward the hem
            p.setZ(i, amp * Math.sin((2 * Math.PI * (x + wdt / 2)) / period));
            uv.setXY(i, (uv.getX(i) * wdt * 1.5) / fabricTile, (uv.getY(i) * len) / fabricTile);
          }
          g.translate((a + b) / 2, hem + len / 2, zc);
          g.computeVertexNormals();
          const m = addMesh(curtainsGroup, g, curtainMat, { name: 'curtain_panel' });
          m.userData.pick = { type: 'curtains' };
          for (let k = 0; k <= halfN; k++) rings.push(a + (k * period) / 2);
        };
        panel(rodU0 + 0.02, win.u0 + 0.12);
        panel(win.u1 - 0.12, rodU1 - 0.02);
        // grommets (rod passes through them)
        const ringGeo = new THREE.TorusGeometry(0.019, 0.004, 6, low ? 10 : 14).rotateY(Math.PI / 2);
        const ringMesh = new THREE.InstancedMesh(ringGeo, M.metal, rings.length);
        const mtx = new THREE.Matrix4();
        rings.forEach((u, i) => ringMesh.setMatrixAt(i, mtx.makeTranslation(u, rodY, zc)));
        ringMesh.instanceMatrix.needsUpdate = true;
        ringMesh.castShadow = true; ringMesh.receiveShadow = true;
        ringMesh.name = 'grommets';
        ringMesh.userData.pick = { type: 'curtains' };
        curtainsGroup.add(ringMesh);
        // rod, finials, brackets
        const rodParts = [
          new THREE.CylinderGeometry(0.0095, 0.0095, rodU1 - rodU0 + 0.06, 12).rotateZ(Math.PI / 2)
            .translate((rodU0 + rodU1) / 2, rodY, zc),
          new THREE.SphereGeometry(0.02, 12, 8).translate(rodU0 - 0.045, rodY, zc),
          new THREE.SphereGeometry(0.02, 12, 8).translate(rodU1 + 0.045, rodY, zc),
          boxR(rodU0 + 0.005, rodU0 + 0.017, rodY - 0.035, rodY + 0.012, 0, zc),
          boxR(rodU1 - 0.017, rodU1 - 0.005, rodY - 0.035, rodY + 0.012, 0, zc),
          boxR(rodU0 - 0.004, rodU0 + 0.026, rodY - 0.05, rodY + 0.02, 0, 0.006),
          boxR(rodU1 - 0.026, rodU1 + 0.004, rodY - 0.05, rodY + 0.02, 0, 0.006),
        ];
        addMesh(curtainsGroup, mergeGeoms(rodParts), M.rod, { name: 'curtain_rod' });
      }
    }
    // duplex outlet
    const out = fixture('outlet');
    if (out && out.wall === 'north') {
      const u = north.toU(out.x, north.origin.z), y = out.y;
      north.plastic.push(boxR(u - 0.035, u + 0.035, y - 0.058, y + 0.058, 0, 0.005));
      for (const dy of [-0.02, 0.02]) {
        north.plastic.push(boxR(u - 0.017, u + 0.017, y + dy - 0.013, y + dy + 0.013, 0.005, 0.009));
        north.dark.push(boxR(u - 0.009, u - 0.006, y + dy - 0.002, y + dy + 0.007, 0.009, 0.0095));
        north.dark.push(boxR(u + 0.006, u + 0.009, y + dy - 0.002, y + dy + 0.007, 0.009, 0.0095));
      }
    }
    // floor register (on the floor by the window wall)
    const reg = fixture('register');
    if (reg) {
      const m = (reg.what || '').match(/([\d.]+)\s*x\s*([\d.]+)/);
      const rw = m ? parseFloat(m[1]) : 0.25, rd = m ? parseFloat(m[2]) : 0.1;
      const u = north.toU(reg.x, reg.z), z = north.toZ(reg.x, reg.z);
      const hgt = 0.006, f = 0.012;
      north.dark.push(boxR(u - rw / 2, u + rw / 2, 0, hgt, z - rd / 2, z - rd / 2 + f));
      north.dark.push(boxR(u - rw / 2, u + rw / 2, 0, hgt, z + rd / 2 - f, z + rd / 2));
      north.dark.push(boxR(u - rw / 2, u - rw / 2 + f, 0, hgt, z - rd / 2 + f, z + rd / 2 - f));
      north.dark.push(boxR(u + rw / 2 - f, u + rw / 2, 0, hgt, z - rd / 2 + f, z + rd / 2 - f));
      const ns = 12;
      for (let i = 0; i < ns; i++) {
        const uu = u - rw / 2 + f + ((i + 0.5) * (rw - 2 * f)) / ns;
        north.dark.push(boxR(uu - 0.003, uu + 0.003, 0, hgt * 0.8, z - rd / 2 + f, z + rd / 2 - f));
      }
      const hole = addMesh(north.group, new THREE.PlaneGeometry(rw - 2 * f, rd - 2 * f).rotateX(-Math.PI / 2).translate(u, 0.0008, z),
        new THREE.MeshBasicMaterial({ color: '#0d0d0e' }), { cast: false, receive: false, name: 'register_void' });
      noRaycast(hole);
    }
  }

  // ---- south: entry door (open), hallway, decals, light switch
  const south = wallInfo.south;
  let decalMesh = null;
  if (south) {
    const door = south.openings.find((o) => o.type === 'door');
    if (door) {
      const t = 0.035, W = door.width - 0.006, Hd = door.height - 0.012;
      const panels = [
        { cx: W / 2, w: W - 0.23, y0: 0.95, y1: Hd - 0.2, rise: 0.09 },
        { cx: W / 2, w: W - 0.23, y0: 0.2, y1: 0.82, rise: 0 },
      ];
      const leaf = new THREE.Group();
      leaf.name = 'entry_door';
      addMesh(leaf, doorLeafGeom(W, Hd, t, panels, Q), M.trim, { name: 'entry_door_leaf' });
      // brushed-nickel levers both sides (pointing toward the hinge), plus hinge knuckles
      const met = [];
      const hx = W - 0.065, hy = 0.92;
      for (const s of [1, -1]) {
        const zf = s * t / 2;
        met.push(new THREE.CylinderGeometry(0.026, 0.027, 0.008, 24).rotateX(Math.PI / 2).translate(hx, hy, zf + s * 0.004));
        met.push(new THREE.CylinderGeometry(0.009, 0.01, 0.04, 12).rotateX(Math.PI / 2).translate(hx, hy, zf + s * 0.028));
        met.push(new THREE.CylinderGeometry(0.0085, 0.0085, 0.115, 12).rotateZ(Math.PI / 2).translate(hx - 0.05, hy, zf + s * 0.044));
        met.push(new THREE.SphereGeometry(0.0095, 12, 8).translate(hx - 0.1075, hy, zf + s * 0.044));
      }
      for (const y of [0.2, Hd / 2, Hd - 0.25]) {
        met.push(new THREE.CylinderGeometry(0.0065, 0.0065, 0.085, 12).translate(0, y, t / 2));
      }
      addMesh(leaf, mergeGeoms(met), M.metal, { name: 'entry_door_hardware' });
      // Pivot at the west (u0) jamb; leaf on the room side of the jamb line. Rotating by
      // -angle about +Y sends leaf-local +X (hinge->latch) toward +Z (into the room).
      const angle = THREE.MathUtils.degToRad(numIn(door.render_state, /open\s+(\d+)/i, 90));
      leaf.position.set(door.u0 + 0.002 + t / 2, 0, 0.008);
      leaf.rotation.y = -angle;
      south.group.add(leaf);

      // hallway beyond the doorway (dim, simple)
      const hall = new THREE.Group();
      hall.name = 'hallway';
      south.group.add(hall);
      const hd = 1.2, hA = door.u0 - 0.6, hB = door.u1 + 0.6, hw = hB - hA, hc = (hA + hB) / 2;
      const zA = -T, zB = -T - hd;
      const hallWall = new THREE.MeshStandardMaterial({ color: '#a9aeab', roughness: 0.92 });
      const hallCeil = new THREE.MeshStandardMaterial({ color: '#cfcfcc', roughness: 0.95 });
      const hallFloor = new THREE.MeshStandardMaterial({ map: floorTex, color: '#a8a8a8', roughness: 0.4 });
      addMesh(hall, floorPlane(hw, hd).translate(hc, 0, (zA + zB) / 2), hallFloor, { cast: false });
      addMesh(hall, new THREE.PlaneGeometry(hw, hd).rotateX(Math.PI / 2).translate(hc, H, (zA + zB) / 2), hallCeil, { cast: false });
      addMesh(hall, new THREE.PlaneGeometry(hw, H).translate(hc, H / 2, zB), hallWall, { cast: false });
      addMesh(hall, new THREE.PlaneGeometry(hd, H).rotateY(Math.PI / 2).translate(hA, H / 2, (zA + zB) / 2), hallWall, { cast: false });
      addMesh(hall, new THREE.PlaneGeometry(hd, H).rotateY(-Math.PI / 2).translate(hB, H / 2, (zA + zB) / 2), hallWall, { cast: false });
      const hallTrim = [];
      // casing on the hallway side of the entry door
      hallTrim.push(...casingGeoms(door.u0, door.u1, 0, door.y1, hA, hB, -T, -1, CW).geoms);
      // baseboards: back wall + both side walls
      hallTrim.push(boxR(hA, hB, 0, baseH, zB, zB + 0.013));
      hallTrim.push(boxR(hA, hA + 0.013, 0, baseH, zB + 0.013, zA));
      hallTrim.push(boxR(hB - 0.013, hB, 0, baseH, zB + 0.013, zA));
      // a closed white door at the end of the hall
      const ed0 = hc + 0.05, ed1 = ed0 + 0.76;
      hallTrim.push(boxR(ed0, ed1, 0, 2.03, zB, zB + 0.02));
      hallTrim.push(...casingGeoms(ed0, ed1, 0, 2.03, hA, hB, zB, 1, CW).geoms);
      addMesh(hall, mergeGeoms(hallTrim), M.trim, { name: 'hall_trim' });
    }

    // Star decals + ALICE constellation (transparent canvas 2 mm off the wall)
    const D = F.decals;
    if (D && (D.wall || 'south') === 'south') {
      const yLo = 0.85;
      const uA = south.uIn0, uB = south.uIn1;
      const Wc = low ? 1024 : 2048;
      const s = Wc / (uB - uA); // px per meter
      const Hc = Math.round((H - yLo) * s);
      const canvas = ctx.makeCanvas(Wc, Hc);
      const c = canvas.getContext('2d');
      const col = hexIn(D.color, '#1b1b22');
      c.fillStyle = col; c.strokeStyle = col;
      c.lineCap = 'round'; c.lineJoin = 'round';
      const px = (u) => (u - uA) * s, py = (y) => (H - y) * s;
      const segs = [], dots = [];
      const line = (p, q) => {
        segs.push([p, q]);
        c.lineWidth = Math.max(1.2, 0.0028 * s);
        c.beginPath(); c.moveTo(px(p[0]), py(p[1])); c.lineTo(px(q[0]), py(q[1])); c.stroke();
      };
      const dot = (p, R) => { dots.push(p); starPath(c, px(p[0]), py(p[1]), R * s, 4, 0.28); };

      // ALICE as connect-the-dots letters (vertex coords in letter-height units)
      const A = D.alice || {};
      const LET = {
        A: { w: 0.72, lines: [[[0, 0], [0.36, 1], [0.72, 0]], [[0.15, 0.42], [0.57, 0.42]]] },
        L: { w: 0.5, lines: [[[0, 1], [0, 0], [0.5, 0]]] },
        I: { w: 0, lines: [[[0, 1], [0, 0.5], [0, 0]]] },
        C: { w: 0.62, lines: [[[0.62, 0.92], [0.18, 0.98], [0, 0.52], [0.12, 0.06], [0.62, 0]]] },
        E: { w: 0.58, lines: [[[0.58, 1], [0, 1], [0, 0.5], [0, 0], [0.58, 0]], [[0, 0.5], [0.45, 0.5]]] },
      };
      const word = 'ALICE';
      const lh = A.letter_height ?? 0.22, ww = A.word_width ?? 0.9;
      const lettersW = [...word].reduce((acc, ch) => acc + LET[ch].w, 0);
      const gap = Math.max(0.2, (ww / lh - lettersW) / (word.length - 1));
      const cx = south.toU(A.center_x ?? 0.1, south.origin.z), cy = A.center_y ?? 1.65;
      let xCursor = cx - ww / 2;
      for (const ch of word) {
        const L = LET[ch];
        const jit = new Map();
        const P = ([x, y]) => {
          const k = x + ',' + y;
          if (!jit.has(k)) jit.set(k, [(rng() - 0.5) * 0.05, (rng() - 0.5) * 0.05]);
          const j = jit.get(k);
          return [xCursor + (x + j[0]) * lh, cy - lh / 2 + (y + j[1]) * lh];
        };
        const seen = new Set();
        for (const pl of L.lines) {
          for (let i = 0; i + 1 < pl.length; i++) line(P(pl[i]), P(pl[i + 1]));
        }
        for (const pl of L.lines) for (const v of pl) {
          const k = v.join(',');
          if (!seen.has(k)) { seen.add(k); dot(P(v), 0.015); }
        }
        xCursor += (L.w + gap) * lh;
      }
      // six simple constellations around the name (offsets in meters from the word center)
      const CONST = [
        { p: [[-0.36, 0.30], [-0.22, 0.44], [-0.08, 0.31], [-0.01, 0.37]], e: [[0, 1], [1, 2], [2, 0], [2, 3]] }, // triangle, above-left
        { p: [[0.23, 0.47], [0.33, 0.37], [0.45, 0.42], [0.34, 0.27]], e: [[0, 1], [1, 2], [1, 3]] }, // Y, above-right
        { p: [[0.62, 0.02], [0.78, -0.06], [0.86, 0.08], [0.74, 0.16], [0.79, 0.27], [0.86, 0.36]], e: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5]] }, // dipper, right
        { p: [[-0.56, 0.27], [-0.57, 0.16], [-0.60, 0.09], [-0.645, 0.11]], e: [[0, 1], [1, 2], [2, 3]] }, // hook, left
        { p: [[-0.50, -0.16], [-0.44, -0.21], [-0.46, -0.30], [-0.52, -0.38], [-0.40, -0.37], [-0.38, -0.24]], e: [[0, 1], [1, 2], [2, 3], [2, 4], [1, 5]] }, // below-left
        { p: [[0.10, -0.37], [0.19, -0.27], [0.30, -0.25], [0.26, -0.36], [0.37, -0.19]], e: [[0, 1], [1, 2], [2, 3], [3, 1], [2, 4]] }, // below-center
      ];
      for (const k of CONST) {
        const pts = k.p.map(([x, y]) => [cx + x, cy + y]);
        for (const [a, b] of k.e) line(pts[a], pts[b]);
        for (const p of pts) dot(p, 0.011 + rng() * 0.006);
      }
      // scattered stars over the whole wall (dart throwing), clear of the door + casing,
      // the light switch and the drawn figures
      const dr = door ? { u1: door.u1 + CW + 0.03, y1: door.y1 + CW + 0.03 } : null;
      const sw = fixture('switch');
      const swU = sw ? south.toU(sw.x, south.origin.z) : null;
      const distSeg = (p, a, b) => {
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const t2 = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
        return Math.hypot(p[0] - a[0] - t2 * dx, p[1] - a[1] - t2 * dy);
      };
      const stars = [];
      const target = 260;
      for (let tries = 0; tries < 6000 && stars.length < target; tries++) {
        const p = [uA + 0.03 + rng() * (uB - uA - 0.06), 0.9 + rng() * (H - 0.93)];
        const r = (0.03 + 0.05 * Math.pow(rng(), 2.2)) / 2;
        if (dr && p[0] - r < dr.u1 && p[1] - r < dr.y1) continue;
        if (sw && Math.abs(p[0] - swU) < 0.07 && Math.abs(p[1] - sw.y) < 0.1) continue;
        if (stars.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.07)) continue;
        if (dots.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.045)) continue;
        if (segs.some(([a, b]) => distSeg(p, a, b) < 0.03 + r)) continue;
        stars.push(p);
        starPath(c, px(p[0]), py(p[1]), r * s, 4, 0.28, (rng() - 0.5) * 0.3);
      }
      const decalTex = tex(canvas, { srgb: true, wrap: 'clamp' });
      const decalMat = new THREE.MeshStandardMaterial({
        map: decalTex, transparent: true, depthWrite: false, roughness: 0.55,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      });
      decalMesh = addMesh(south.group,
        new THREE.PlaneGeometry(uB - uA, H - yLo).translate((uA + uB) / 2, (H + yLo) / 2, 0.002),
        decalMat, { cast: false, receive: true, name: 'star_decals' });
      noRaycast(decalMesh); // picks pass through to the wall
    }

    // light switch
    const sw = fixture('switch');
    if (sw && sw.wall === 'south') {
      const u = south.toU(sw.x, south.origin.z), y = sw.y;
      south.plastic.push(boxR(u - 0.035, u + 0.035, y - 0.058, y + 0.058, 0, 0.005));
      south.plastic.push(boxR(u - 0.005, u + 0.005, y - 0.012, y + 0.012, 0.005, 0.012));
    }
  }

  // ---- west: closed bi-fold closet
  const west = wallInfo.west;
  if (west) {
    const cl = west.openings.find((o) => o.type === 'door');
    if (cl) {
      const nLeaves = 2, gap = 0.003, t = 0.03;
      const Wl = (cl.u1 - cl.u0 - gap * (nLeaves + 1)) / nLeaves, Hl = cl.height - 0.012;
      const zc = -0.026;
      const panels = [
        { cx: Wl / 2, w: Wl - 0.15, y0: Hl * 0.47, y1: Hl - 0.17, rise: 0.07 },
        { cx: Wl / 2, w: Wl - 0.15, y0: 0.17, y1: Hl * 0.41, rise: 0 },
      ];
      for (let i = 0; i < nLeaves; i++) {
        const g = doorLeafGeom(Wl, Hl, t, panels, Q);
        const u = cl.u0 + gap + i * (Wl + gap);
        g.translate(u, 0.006, zc);
        const parts = [g];
        if (i === 0) {
          // small round knob near the center seam
          const ku = u + Wl - 0.05, ky = numIn(cl.knob_height, /([\d.]+)/, 0.95);
          parts.push(new THREE.CylinderGeometry(0.006, 0.008, 0.022, 12).rotateX(Math.PI / 2).translate(ku, ky, zc + t / 2 + 0.011));
          parts.push(new THREE.SphereGeometry(0.016, 16, 10).scale(1, 1, 0.8).translate(ku, ky, zc + t / 2 + 0.03));
        }
        addMesh(west.group, mergeGeoms(parts), M.trim, { name: 'closet_leaf_' + i });
      }
      // dark closet interior behind the slats/gaps
      addMesh(west.group, new THREE.PlaneGeometry(cl.u1 - cl.u0, cl.y1).translate((cl.u0 + cl.u1) / 2, cl.y1 / 2, -T + 0.01),
        new THREE.MeshStandardMaterial({ color: '#2f2d2b', roughness: 1 }), { cast: false, name: 'closet_back' });
      // top track
      west.metal.push(boxR(cl.u0, cl.u1, cl.y1 - 0.012, cl.y1, -0.06, -0.012));
    }
  }

  // ---- east: baby monitor camera
  const east = wallInfo.east;
  const mon = fixture('monitor');
  if (east && mon && mon.wall === 'east') {
    const u = east.toU(east.origin.x, mon.z), y = mon.y;
    east.plastic.push(boxR(u - 0.022, u + 0.022, y - 0.035, y + 0.025, 0, 0.012)); // wall plate
    east.plastic.push(new THREE.CylinderGeometry(0.007, 0.007, 0.06, 10).rotateX(Math.PI / 2).translate(u, y, 0.04)); // arm
    east.plastic.push(boxR(u - 0.035, u + 0.035, y - 0.045, y + 0.03, 0.065, 0.13)); // camera body
    east.dark.push(new THREE.CylinderGeometry(0.014, 0.014, 0.006, 16).rotateX(Math.PI / 2).translate(u, y - 0.005, 0.132)); // lens
  }

  // ---- merge per-wall small parts
  for (const id in wallInfo) {
    const I = wallInfo[id];
    if (I.trim.length) addMesh(I.group, mergeGeoms(I.trim), M.trim, { name: 'trim_' + id });
    if (I.metal.length) addMesh(I.group, mergeGeoms(I.metal), M.metal, { name: 'metal_' + id });
    if (I.plastic.length) addMesh(I.group, mergeGeoms(I.plastic), M.plastic, { name: 'fixtures_' + id });
    if (I.dark.length) addMesh(I.group, mergeGeoms(I.dark), M.dark, { name: 'dark_' + id });
  }

  // ---- ceiling, fan, smoke detector
  const ceiling = new THREE.Group();
  ceiling.name = 'ceiling';
  root.add(ceiling);
  const ceilMat = new THREE.MeshStandardMaterial({ color: '#f7f6f2', roughness: 0.95 });
  addMesh(ceiling, new THREE.PlaneGeometry(R.x_east - R.x_west, R.z_north - R.z_south).rotateX(Math.PI / 2)
    .translate(xmid, H, zmid), ceilMat, { cast: false, name: 'ceiling_plane' }); // faces down

  const CF = F.ceiling_fan || {};
  const fan = new THREE.Group();
  fan.name = 'ceiling_fan';
  fan.position.set(CF.x ?? xmid, H, CF.z ?? zmid);
  ceiling.add(fan);
  const fanWhite = new THREE.MeshStandardMaterial({ color: '#f1efea', roughness: 0.5 });
  const drop = clamp(CF.drop ?? 0.3, 0.25, 0.5);
  const span = numIn(CF.style, /([\d.]+)\s*m\b/, 1.1);
  const nBlades = Math.round(numIn(CF.style, /(\d+)\s+white blades/i, 5));
  const fanParts = [];
  fanParts.push(new THREE.CylinderGeometry(0.075, 0.085, 0.03, Q.seg).translate(0, -0.015, 0)); // canopy
  // motor housing profile, listed bottom -> top so lathe normals face outward
  const prof = [[0, -0.135], [0.11, -0.135], [0.15, -0.125], [0.168, -0.105], [0.172, -0.075], [0.155, -0.045], [0.11, -0.03], [0, -0.03]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  fanParts.push(new THREE.LatheGeometry(prof, Q.seg));
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0.17, -0.05); bladeShape.lineTo(0.52, -0.066);
  bladeShape.quadraticCurveTo(span / 2, -0.066, span / 2, 0);
  bladeShape.quadraticCurveTo(span / 2, 0.066, 0.52, 0.066);
  bladeShape.lineTo(0.17, 0.05); bladeShape.lineTo(0.17, -0.05);
  for (let i = 0; i < nBlades; i++) {
    const a = (i * 2 * Math.PI) / nBlades;
    const b = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.008, bevelEnabled: false, curveSegments: 6 });
    b.translate(0, 0, -0.004).rotateX(-Math.PI / 2).rotateX(THREE.MathUtils.degToRad(12)).translate(0, -0.118, 0).rotateY(a);
    fanParts.push(b);
    fanParts.push(boxR(0.09, 0.25, -0.13, -0.122, -0.018, 0.018).rotateY(a)); // blade iron
  }
  fanParts.push(new THREE.CylinderGeometry(0.09, 0.08, 0.025, Q.seg).translate(0, -0.1475, 0)); // switch housing
  const gr = 0.105, gsy = 0.8, th0 = 0.3 * Math.PI;
  const gyc = -drop + gr * gsy; // globe center (bottom of globe at -drop)
  fanParts.push(new THREE.CylinderGeometry(0.088, 0.088, 0.012, Q.seg).translate(0, gyc + gr * gsy * Math.cos(th0) + 0.004, 0)); // fitter
  if (gyc + gr * gsy * Math.cos(th0) < -0.16) {
    // stem between switch housing and fitter for deeper drops
    const top = -0.16, bot = gyc + gr * gsy * Math.cos(th0);
    fanParts.push(new THREE.CylinderGeometry(0.06, 0.06, top - bot, Q.seg).translate(0, (top + bot) / 2, 0));
  }
  addMesh(fan, mergeGeoms(fanParts), fanWhite, { name: 'fan_body' });
  const lightHex = '#ffc58a'; // ~2700 K
  const globeMat = new THREE.MeshStandardMaterial({
    color: '#f6f2ea', roughness: 0.45, emissive: lightHex, emissiveIntensity: 1.15, transparent: true, opacity: 0.96,
  });
  addMesh(fan, new THREE.SphereGeometry(gr, Q.seg, Q.seg / 2, 0, Math.PI * 2, th0, Math.PI - th0).scale(1, gsy, 1).translate(0, gyc, 0),
    globeMat, { cast: false, name: 'fan_globe' });
  const chain = [];
  for (const [x, z] of [[0.05, 0.02], [-0.03, -0.045]]) {
    const top = -0.155, len = 0.24;
    chain.push(new THREE.CylinderGeometry(0.0015, 0.0015, len, 5).translate(x, top - len / 2, z));
    chain.push(new THREE.CylinderGeometry(0.005, 0.007, 0.03, 10).translate(x, top - len - 0.015, z));
  }
  addMesh(fan, mergeGeoms(chain), M.metal, { name: 'fan_pull_chains' });

  // fan light lives on the root so it keeps lighting the room when the ceiling is hidden
  const fanLight = new THREE.PointLight(lightHex, 6, 0, 2);
  fanLight.name = 'fan_light';
  fanLight.castShadow = false;
  fanLight.position.set(fan.position.x, H + gyc, fan.position.z);
  root.add(fanLight);

  const sd = fixture('smoke');
  if (sd) {
    const sm = mergeGeoms([
      new THREE.CylinderGeometry(0.065, 0.068, 0.03, Q.seg).translate(sd.x, H - 0.015, sd.z),
      new THREE.CylinderGeometry(0.035, 0.035, 0.004, Q.seg).translate(sd.x, H - 0.032, sd.z),
    ]);
    addMesh(ceiling, sm, M.plastic, { name: 'smoke_detector' });
  }

  // ---- API
  const setFanLight = (on, level01 = 0.6, colorHex) => {
    const lv = clamp(level01 ?? 0.6, 0, 1);
    fanLight.intensity = on ? lv * 10 : 0;
    if (colorHex != null) { fanLight.color.set(colorHex); globeMat.emissive.set(colorHex); }
    globeMat.emissiveIntensity = on ? 0.25 + 1.5 * lv : 0;
  };
  const setWallColor = (wallId, hex) => { if (paintMats[wallId]) paintMats[wallId].color.set(hex); };
  const setDecals = (v) => { if (decalMesh) decalMesh.visible = !!v; };
  const setCurtains = (v) => { if (curtainsGroup) curtainsGroup.visible = !!v; };
  const setCurtainColor = (hex) => { if (curtainRedraw) curtainRedraw(hex || null); };
  const dispose = () => {
    const mats = new Set();
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m));
      if (o.isInstancedMesh) o.dispose();
    });
    mats.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  };

  const outerW = R.x_east - R.x_west + 2 * T, outerD = R.z_north - R.z_south + 2 * T;
  root.userData = { kind: 'shell', size: { w: outerW, d: outerD, h: H }, setColor() {}, dispose };

  return {
    group: root, walls, floor, ceiling, fan, fanLight,
    setFanLight, setWallColor, setDecals, setCurtains, setCurtainColor, dispose,
  };
}
