// Rugs for Alice's Room planner.
// buildRug(opts, ctx) -> THREE.Group (origin = footprint centre at floor level).
//
// UV convention for every rug top surface (verified by the node test):
//   v = 1 at local +Z (north / window)  -> image TOP faces the window,
//   u = 1 at local -X (west)            -> image RIGHT is on the viewer's right
//   when standing at the south door looking north, so nothing is mirrored.
// Canvas pixel (px, py) therefore maps to local X = w/2 - px/ppm, Z = d/2 - py/ppm.
import * as THREE from 'three';

export const RUG_KINDS = ['beige_scalloped', 'woodland_unicorn', 'navy_shag_current'];

const FT = 0.3048;
const FLAT_T = 0.01;  // flat rug thickness (top surface at y = 0.01)
const SHAG_T = 0.03;  // shag total height

export function rugSizeMeters(sizeFt) {
  const [a, b] = sizeFt || [5, 7];
  return { w: a * FT, d: b * FT };
}

// ---------------------------------------------------------------- helpers

// Small seeded PRNG so a canvas redraw (setColor) reproduces the same noise.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hexIn = (str, fallback) => {
  const m = typeof str === 'string' && str.match(/#[0-9a-fA-F]{6}/);
  return m ? m[0] : fallback;
};
const num = (str, re, fallback) => {
  const m = typeof str === 'string' && str.match(re);
  return m ? m : fallback;
};
const cssHex = (c) => '#' + new THREE.Color(c).getHexString();

// Mix two css colours in sRGB (as the canvas paints them).
function mixHex(a, b, t) {
  const ca = new THREE.Color(cssHex(a)), cb = new THREE.Color(cssHex(b));
  const sa = {}, sb = {};
  ca.getRGB(sa, THREE.SRGBColorSpace); cb.getRGB(sb, THREE.SRGBColorSpace);
  const m = (k) => Math.round(255 * (sa[k] + (sb[k] - sa[k]) * t));
  return `rgb(${m('r')},${m('g')},${m('b')})`;
}

// Points of a rounded rectangle (half extents hx, hz, corner radius r) in local X/Z,
// counter-clockwise when viewed from above.
function roundedRectPts(hx, hz, r, seg) {
  r = Math.min(r, hx, hz);
  const pts = [];
  const corners = [
    [hx - r, hz - r, 0], [-(hx - r), hz - r, Math.PI / 2],
    [-(hx - r), -(hz - r), Math.PI], [hx - r, -(hz - r), 1.5 * Math.PI],
  ];
  for (const [cx, cz, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push({ x: cx + r * Math.cos(a), z: cz + r * Math.sin(a) });
    }
  }
  return pts;
}

// Scalloped outline: an inner rounded rect (inset by the wave amplitude A) whose
// boundary is pushed outward by A*(1+cos)/2. Each straight edge and corner arc
// holds a whole number of waves with a crest at every junction, so the shape is
// symmetric and the crests touch the full w x d rectangle exactly.
function scallopPts(w, d, pitch, A, spw) {
  const hx = w / 2 - A, hz = d / 2 - A;
  const R = Math.min((4 * pitch) / Math.PI, hx, hz); // corner arc ~ 2 waves long
  const ex = hx - R, ez = hz - R;
  const segs = [
    { line: [ex, hz, -ex, hz], n: [0, 1] },
    { arc: [-ex, ez, Math.PI / 2] },
    { line: [-hx, ez, -hx, -ez], n: [-1, 0] },
    { arc: [-ex, -ez, Math.PI] },
    { line: [-ex, -hz, ex, -hz], n: [0, -1] },
    { arc: [ex, -ez, 1.5 * Math.PI] },
    { line: [hx, -ez, hx, ez], n: [1, 0] },
    { arc: [ex, ez, 0] },
  ];
  const pts = [];
  for (const s of segs) {
    const len = s.line ? Math.hypot(s.line[2] - s.line[0], s.line[3] - s.line[1]) : (Math.PI / 2) * R;
    if (len < 1e-6) continue;
    const waves = Math.max(1, Math.round(len / pitch));
    const steps = waves * spw;
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const off = A * 0.5 * (1 + Math.cos(2 * Math.PI * waves * t));
      let x, z, nx, nz;
      if (s.line) {
        const [x0, z0, x1, z1] = s.line;
        x = x0 + (x1 - x0) * t; z = z0 + (z1 - z0) * t; [nx, nz] = s.n;
      } else {
        const [cx, cz, a0] = s.arc;
        const a = a0 + t * (Math.PI / 2);
        nx = Math.cos(a); nz = Math.sin(a);
        x = cx + R * nx; z = cz + R * nz;
      }
      pts.push({ x: x + nx * off, z: z + nz * off });
    }
  }
  return pts;
}

// Extruded slab from an X/Z outline, y0..y1. Group 0 = caps, group 1 = sides.
// UVs follow the rug convention (v=1 at +Z, u=1 at -X) over a w x d rectangle.
function slabGeometry(pts, y0, y1, w, d) {
  const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false, steps: 1 });
  g.rotateX(-Math.PI / 2); // shape (x, y) -> world (x, ., -y); extrusion -> +Y
  g.translate(0, y0, 0);
  setRugUVs(g, w, d);
  return g;
}

// Flat top surface (single sided, facing +Y) from an outline, at height y.
function topGeometry(pts, y, w, d) {
  const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.z)));
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  setRugUVs(g, w, d);
  return g;
}

function setRugUVs(g, w, d) {
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (w / 2 - pos.getX(i)) / w;
    uv[i * 2 + 1] = (pos.getZ(i) + d / 2) / d;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// Crop-to-fill: show the centre of an image of aspect imgA on a surface of aspect rugA.
function fitCover(tex, rugA, imgA) {
  if (!(imgA > 0) || !(rugA > 0)) return;
  tex.center.set(0, 0);
  tex.rotation = 0;
  if (imgA > rugA) {
    const r = rugA / imgA;
    tex.repeat.set(r, 1); tex.offset.set((1 - r) / 2, 0);
  } else {
    const r = imgA / rugA;
    tex.repeat.set(1, r); tex.offset.set(0, (1 - r) / 2);
  }
}

function imageAspect(img) {
  if (!img) return 0;
  const w = img.naturalWidth || img.videoWidth || img.width;
  const h = img.naturalHeight || img.videoHeight || img.height;
  return w > 0 && h > 0 ? w / h : 0;
}

// Fine tileable speckle canvas (no getImageData needed). mode 'color' gives
// light/dark streaks with low alpha (for overlay); 'bump' gives an opaque grey field.
function speckleTile(ctx, size, seed, mode) {
  const c = ctx.makeCanvas(size, size);
  const g = c.getContext('2d');
  const r = rng(seed);
  if (mode === 'bump') { g.fillStyle = '#808080'; g.fillRect(0, 0, size, size); }
  const n = Math.round(size * size * (mode === 'bump' ? 0.6 : 0.35));
  for (let i = 0; i < n; i++) {
    const v = r();
    const lw = 1 + Math.floor(r() * (mode === 'bump' ? 2 : 4)); // short horizontal streaks
    const x = Math.floor(r() * size), y = Math.floor(r() * size);
    if (mode === 'bump') {
      const gr = Math.floor(70 + v * 120);
      g.fillStyle = `rgb(${gr},${gr},${gr})`;
    } else {
      g.fillStyle = v < 0.5 ? `rgba(60,50,30,${0.05 + r() * 0.06})` : `rgba(255,255,250,${0.05 + r() * 0.07})`;
    }
    g.fillRect(x, y, lw, 1);
    if (x + lw > size) g.fillRect(x - size, y, lw, 1); // wrap so the tile is seamless
  }
  return c;
}

function makeBumpTexture(ctx, w, d, tileM, seed) {
  const size = ctx.quality === 'low' ? 128 : 256;
  const c = speckleTile(ctx, size, seed, 'bump');
  return ctx.canvasTexture(c, { srgb: false, repeat: [w / tileM, d / tileM], wrap: 'repeat' });
}

// ---------------------------------------------------------------- beige scalloped

function beigeParams(spec, w, d) {
  const dr = (spec && spec.draw) || {};
  const short = Math.min(w, d);
  const bandList = Array.isArray(dr.bands_inward_from_edge) ? dr.bands_inward_from_edge : [];
  const find = (word) => bandList.find((s) => typeof s === 'string' && s.toLowerCase().includes(word)) || '';

  const pm = num(dr.edge, /pitch\s*≈?\s*([\d.]+)(?:\s*-\s*([\d.]+))?\s*cm/i, null);
  const pitch = pm ? ((+pm[1] + +(pm[2] || pm[1])) / 2) / 100 : 0.095;
  const am = num(dr.edge, /amplitude\s*≈?\s*([\d.]+)\s*\/\s*([\d.]+)/i, null);
  const ampFrac = am ? +am[1] / +am[2] : 0.25;
  const bm = num(dr.band_width, /([\d.]+)\s*(?:-\s*([\d.]+))?\s*%/, null);
  const bandFrac = bm ? ((+bm[1] + +(bm[2] || bm[1])) / 2) / 100 : 0.055;
  const cm = num(dr.binding, /([\d.]+)\s*cm/i, null);
  const bindW = cm ? +cm[1] / 100 : 0.01;
  const gm = num(find('gap'), /([\d.]+)\s*x/i, null);
  const gapFrac = gm ? +gm[1] : 0.8;
  const mm = num(find('margin'), /([\d.]+)\s*x/i, null);
  const marginFrac = mm ? +mm[1] : 1; // "about one band wide"
  const tm = num(dr.bars, /1\s*\/\s*(\d+)\s*-\s*1\s*\/\s*(\d+)/, null);
  const thickFrac = tm ? (1 / +tm[1] + 1 / +tm[2]) / 2 : 1 / 9;
  const bp = num(dr.bars, /pitch\s*≈?\s*([\d.]+)\s*x/i, null);
  const barPitch = bp ? +bp[1] : 2;

  return {
    field: hexIn(dr.field, '#DBD9CA'),
    binding: hexIn(dr.binding, '#C9C2A6'),
    bars: hexIn(find('outer band'), hexIn(find('bars'), '#F3F1E9')),
    pitch, amp: pitch * ampFrac, bindW,
    band: bandFrac * short, gap: gapFrac * bandFrac * short, margin: marginFrac * bandFrac * short,
    thickFrac, barPitch,
  };
}

// One rectangular band of bars, inset e px from the rug edge, bw px wide.
// Corner squares get nested L-shapes concentric about the OUTER corner, their
// vertices on the diagonal and their legs continuing the bars of both bands.
function drawBand(g, W, H, e, bw, t, pitchMul, color) {
  g.fillStyle = color;
  // corners (drawn once in a local frame, mirrored to the four corners)
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    g.setTransform(sx, 0, 0, sy, sx < 0 ? W : 0, sy < 0 ? H : 0);
    for (let k = bw - t / 2; k - t / 2 > -0.01; k -= pitchMul * t) {
      const k0 = Math.max(0, k - t / 2), k1 = k + t / 2;
      g.fillRect(e, e + k0, k1, k1 - k0); // leg belonging to the side band
      g.fillRect(e + k0, e, k1 - k0, k1); // leg belonging to the top band
    }
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  // straight runs: bars perpendicular to the band, spread evenly between corners
  const run = (len, cb) => {
    const n = Math.max(1, Math.round((len - t) / (pitchMul * t)));
    const gap = (len - n * t) / (n + 1);
    for (let i = 0; i < n; i++) cb(gap + i * (t + gap));
  };
  const lx = W - 2 * e - 2 * bw, ly = H - 2 * e - 2 * bw;
  run(lx, (o) => { g.fillRect(e + bw + o, e, t, bw); g.fillRect(e + bw + o, H - e - bw, t, bw); });
  run(ly, (o) => { g.fillRect(e, e + bw + o, bw, t); g.fillRect(W - e - bw, e + bw + o, bw, t); });
}

function drawBeige(canvas, P, outline, w, d, ppm, fieldHex, bindingHex, noiseTile) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const toPx = (p) => [(w / 2 - p.x) * ppm, (d / 2 - p.z) * ppm];
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  const path = () => {
    g.beginPath();
    outline.forEach((p, i) => { const [x, y] = toPx(p); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.closePath();
  };
  // field (alpha = 0 outside the scallops)
  path(); g.fillStyle = fieldHex; g.fill();

  // soft large-scale mottling, clipped to the rug
  g.save(); path(); g.clip();
  const r = rng(7);
  for (let i = 0; i < 14; i++) {
    const cx = r() * W, cy = r() * H, rad = (0.25 + r() * 0.5) * Math.min(W, H);
    const grad = g.createRadialGradient && g.createRadialGradient(cx, cy, 0, cx, cy, rad);
    if (!grad) break;
    const light = r() < 0.5;
    grad.addColorStop(0, light ? 'rgba(255,255,245,0.06)' : 'rgba(90,80,60,0.05)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
  }

  // bands of bars
  const bw = P.band * ppm, t = Math.max(1, bw * P.thickFrac);
  const e1 = (P.amp + P.margin) * ppm;
  const e2 = e1 + bw + P.gap * ppm;
  drawBand(g, W, H, e1, bw, t, P.barPitch, P.bars);
  drawBand(g, W, H, e2, bw, t, P.barPitch, P.bars);
  g.restore();

  // piped binding cord following the wave: soft shadow, cord, highlight.
  // Strokes are centred on the outline, so only the inner half shows.
  g.lineJoin = 'round';
  path(); g.strokeStyle = 'rgba(40,30,10,0.10)'; g.lineWidth = (P.bindW * 2 + 0.008) * ppm; g.stroke();
  path(); g.strokeStyle = bindingHex; g.lineWidth = P.bindW * 2 * ppm; g.stroke();
  path(); g.strokeStyle = mixHex(bindingHex, '#ffffff', 0.25); g.lineWidth = P.bindW * 0.9 * ppm; g.stroke();

  // fine low-pile speckle over everything, keeping the alpha mask
  const pat = noiseTile && g.createPattern && g.createPattern(noiseTile, 'repeat');
  if (pat) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = pat; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
  }
}

function buildBeige(opts, ctx, group, own) {
  const { w, d } = rugSizeMeters(opts.sizeFt);
  const P = beigeParams(opts.spec, w, d);
  const low = ctx.quality === 'low';
  const outline = scallopPts(w, d, P.pitch, P.amp, low ? 8 : 14);

  // canvas aspect = rug aspect; long side 2048 (1024 on low)
  const longPx = low ? 1024 : 2048;
  const ppm = longPx / Math.max(w, d);
  const canvas = ctx.makeCanvas(Math.round(w * ppm), Math.round(d * ppm));
  const noise = speckleTile(ctx, low ? 128 : 256, 11, 'color');
  let field = opts.color ? cssHex(opts.color) : P.field;
  group.userData.baseColor = cssHex(P.field);
  const binding = opts.binding ? cssHex(opts.binding) : P.binding;
  drawBeige(canvas, P, outline, w, d, ppm, field, binding, noise);

  const map = own.tex(ctx.canvasTexture(canvas, { srgb: true, wrap: 'clamp' }));
  const bump = own.tex(makeBumpTexture(ctx, w, d, 0.18, 5));
  const top = own.mat(new THREE.MeshStandardMaterial({
    map, bumpMap: bump, bumpScale: 0.6, roughness: 0.95, metalness: 0,
    alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }));
  const side = own.mat(new THREE.MeshStandardMaterial({ color: binding, roughness: 0.9 }));
  const mesh = own.mesh(new THREE.Mesh(own.geo(slabGeometry(outline, 0, FLAT_T, w, d)), [top, side]));
  mesh.name = 'rug_field';
  mesh.userData.role = 'body';
  group.add(mesh);

  group.userData.size = { w, d, h: FLAT_T };
  group.userData.setColor = (hex) => {
    field = cssHex(hex);
    drawBeige(canvas, P, outline, w, d, ppm, field, binding, noise);
    map.needsUpdate = true;
  };
}

// ---------------------------------------------------------------- printed rugs (woodland / image)

function resolveTexture(src, ctx, own) {
  if (!src) return null;
  if (src.isTexture) return src; // caller owns it
  if (typeof src === 'string') return own.tex(ctx.loadTexture(src, { srgb: true, wrap: 'clamp' }));
  if (typeof src.getContext === 'function') return own.tex(ctx.canvasTexture(src, { srgb: true, wrap: 'clamp' }));
  // HTMLImageElement / ImageBitmap
  const tex = own.tex(new THREE.Texture(src));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = ctx.anisotropy || 1;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  if (src.complete === false && src.addEventListener) {
    src.addEventListener('load', () => { tex.needsUpdate = true; }, { once: true });
  } else {
    tex.needsUpdate = true;
  }
  return tex;
}

function buildPrinted(opts, ctx, group, own) {
  const { w, d } = rugSizeMeters(opts.sizeFt);
  const spec = opts.spec || null;
  const low = ctx.quality === 'low';
  const isWood = opts.kind === 'woodland_unicorn';

  // binding colour & width: spec text for woodland, opts.binding for any kind
  let bindHex = null, bindW = 0;
  if (isWood) {
    bindHex = hexIn(spec && spec.binding, '#C9B48F');
    const m = num(spec && spec.binding, /([\d.]+)\s*cm/i, null);
    bindW = m ? +m[1] / 100 : 0.015;
  }
  if (opts.binding) { bindHex = cssHex(opts.binding); bindW = bindW || 0.015; }

  const corner = 0.02;
  const slabPts = roundedRectPts(w / 2, d / 2, corner, low ? 3 : 6);
  const slabMat = own.mat(new THREE.MeshStandardMaterial({ color: bindHex || '#b9b2a4', roughness: 0.92 }));
  const slab = own.mesh(new THREE.Mesh(own.geo(slabGeometry(slabPts, 0, FLAT_T, w, d)), slabMat));
  slab.name = 'rug_binding';
  group.add(slab);

  // printed field: inset by the binding, coplanar with the slab top, pulled forward
  // with polygonOffset so it always wins the depth test.
  const pw = w - 2 * bindW, pd = d - 2 * bindW;
  const tex = resolveTexture(opts.image || (spec && spec.texture), ctx, own);
  const rugA = w / d; // fit to the rug's aspect (matches room.json fit_rule numbers)
  if (tex) {
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    let imgA = imageAspect(tex.image);
    if (!imgA && isWood && spec && Array.isArray(spec.texture_px)) imgA = spec.texture_px[0] / spec.texture_px[1];
    fitCover(tex, rugA, imgA);
    // Re-fit once the real image is uploaded (async url loads, or a wrong guess).
    const prev = tex.onUpdate;
    tex.onUpdate = function (t) {
      if (prev) prev.call(this, t);
      const a = imageAspect(tex.image);
      if (a) fitCover(tex, rugA, a);
    };
  }
  const bump = own.tex(makeBumpTexture(ctx, pw, pd, 0.2, 9));
  const printMat = own.mat(new THREE.MeshStandardMaterial({
    map: tex, color: opts.color ? cssHex(opts.color) : '#ffffff', bumpMap: bump, bumpScale: 0.4,
    roughness: 0.92, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  const printPts = roundedRectPts(pw / 2, pd / 2, Math.max(0.004, corner - bindW), low ? 3 : 6);
  const print = own.mesh(new THREE.Mesh(own.geo(topGeometry(printPts, FLAT_T, pw, pd)), printMat));
  print.name = 'rug_field';
  print.userData.role = 'body';
  group.add(print);
  if (!bindHex) slab.userData.role = 'edge';

  group.userData.size = { w, d, h: FLAT_T };
  group.userData.texture = tex;
  group.userData.setColor = (hex) => { printMat.color.set(hex); };
  group.userData.baseColor = '#ffffff';   // a print: the color is a tint over the photo
}

// ---------------------------------------------------------------- navy shag

// Tileable "tuft" canvases: height (alpha/bump; black gaps, bright tuft centres)
// and colour (darker roots, lighter tips). Tufts are drawn as 3 concentric discs
// so higher shells show smaller cross-sections -> tapered fibre tips.
function shagTiles(ctx, size, seed) {
  const hc = ctx.makeCanvas(size, size), cc = ctx.makeCanvas(size, size);
  const h = hc.getContext('2d'), c = cc.getContext('2d');
  h.fillStyle = '#000'; h.fillRect(0, 0, size, size);
  c.fillStyle = 'rgb(120,120,120)'; c.fillRect(0, 0, size, size);
  const r = rng(seed);
  const n = 1100;
  const rMin = size * 0.02, rMax = size * 0.036; // tuft radius ~3-5 mm on a 15 cm tile
  for (let i = 0; i < n; i++) {
    const x = r() * size, y = r() * size, rad = rMin + r() * (rMax - rMin);
    const ht = 0.55 + 0.45 * r();
    const tint = r();
    for (const [f, k] of [[1, 0.35], [0.66, 0.7], [0.33, 1]]) {
      const hv = Math.round(255 * ht * k);
      const cv = Math.round(140 + 115 * (0.35 + 0.65 * k) * (0.7 + 0.3 * tint));
      // wrap copies near the tile edges keep the tile seamless
      const oxs = [0], oys = [0];
      if (x < rad) oxs.push(size); else if (x > size - rad) oxs.push(-size);
      if (y < rad) oys.push(size); else if (y > size - rad) oys.push(-size);
      for (const ox of oxs) for (const oy of oys) {
        h.fillStyle = `rgb(${hv},${hv},${hv})`;
        h.beginPath(); h.arc(x + ox, y + oy, rad * f, 0, Math.PI * 2); h.fill();
        c.fillStyle = `rgb(${cv},${cv},${Math.min(255, cv + 6)})`;
        c.beginPath(); c.arc(x + ox, y + oy, rad * f, 0, Math.PI * 2); c.fill();
      }
    }
  }
  return { hc, cc };
}

function buildShag(opts, ctx, group, own) {
  const spec = opts.spec || {};
  const { w, d } = rugSizeMeters(opts.sizeFt || spec.size_ft);
  const low = ctx.quality === 'low';
  const base = new THREE.Color(opts.color ? cssHex(opts.color) : hexIn(spec.color, '#1f2547'));
  group.userData.baseColor = cssHex(hexIn(spec.color, '#1f2547'));
  const corner = 0.035;
  const slabH = 0.012;
  const nShell = low ? 3 : 5;
  const tileM = 0.15; // one tuft tile covers 15 cm (tufts ~6-10 mm across)

  const { hc, cc } = shagTiles(ctx, low ? 256 : 512, 3);
  const rep = [w / tileM, d / tileM];
  const hTex = own.tex(ctx.canvasTexture(hc, { srgb: false, repeat: rep, wrap: 'repeat' }));
  const cTex = own.tex(ctx.canvasTexture(cc, { srgb: true, repeat: rep, wrap: 'repeat' }));

  // dense root layer: a slab with darker colour
  const slabMat = own.mat(new THREE.MeshStandardMaterial({ color: base.clone().multiplyScalar(0.55), map: cTex, roughness: 1 }));
  const slab = own.mesh(new THREE.Mesh(
    own.geo(slabGeometry(roundedRectPts(w / 2, d / 2, corner, low ? 3 : 6), 0, slabH, w, d)), slabMat));
  slab.name = 'rug_shag_base';
  slab.userData.role = 'body';
  group.add(slab);

  // shells: stacked planes, each discarding fibres shorter than its height.
  // Each shell is inset a little more (pile tapers at the edge) and nudged a
  // millimetre sideways so the fibres appear to lean rather than stack.
  const shellMats = [];
  const r = rng(21);
  for (let i = 0; i < nShell; i++) {
    const f = (i + 1) / nShell;
    const y = slabH + (SHAG_T - slabH) * f;
    const inset = 0.002 + 0.0015 * i;
    const jx = (r() - 0.5) * 0.002, jz = (r() - 0.5) * 0.002;
    const pts = roundedRectPts(w / 2 - inset, d / 2 - inset, corner - inset, low ? 3 : 6);
    const geo = topGeometry(pts, y, w, d);
    geo.translate(jx, 0, jz);
    setRugUVs(geo, w, d); // UVs from the full rug rect so fibres line up across shells
    const m = own.mat(new THREE.MeshStandardMaterial({
      color: 0xffffff, map: cTex, alphaMap: hTex, alphaTest: 0.08 + 0.72 * (i / Math.max(1, nShell - 1)),
      bumpMap: hTex, bumpScale: 2, roughness: 1, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }));
    shellMats.push(m);
    const mesh = own.mesh(new THREE.Mesh(own.geo(geo), m));
    mesh.name = `rug_shag_shell_${i}`;
    mesh.userData.role = 'body';
    group.add(mesh);
  }

  const setColor = (hex) => {
    base.set(hex);
    slabMat.color.copy(base).multiplyScalar(0.55);
    shellMats.forEach((m, i) => m.color.copy(base).multiplyScalar(0.75 + 1.0 * (i / Math.max(1, nShell - 1))));
  };
  setColor(base.getHex());
  group.userData.size = { w, d, h: SHAG_T };
  group.userData.setColor = setColor;
}

// ---------------------------------------------------------------- entry point

export function buildRug(opts, ctx) {
  opts = opts || {};
  const kind = opts.kind || 'beige_scalloped';
  const group = new THREE.Group();
  group.name = `rug_${kind}`;

  // ownership tracking for dispose()
  const geos = [], mats = [], texs = [], meshes = [];
  const own = {
    geo: (g) => (geos.push(g), g),
    mat: (m) => (mats.push(m), m),
    tex: (t) => (t && texs.push(t), t),
    mesh: (m) => { m.receiveShadow = true; m.castShadow = false; meshes.push(m); return m; },
  };

  group.userData = { kind: 'rug', rugKind: kind, sizeFt: opts.sizeFt ? [...opts.sizeFt] : null };
  if (kind === 'beige_scalloped') buildBeige(opts, ctx, group, own);
  else if (kind === 'navy_shag_current') buildShag(opts, ctx, group, own);
  else if (kind === 'woodland_unicorn' || kind === 'image') buildPrinted(opts, ctx, group, own);
  else throw new Error(`buildRug: unknown kind "${kind}"`);

  if (!group.userData.sizeFt) group.userData.sizeFt = opts.sizeFt || (opts.spec && opts.spec.size_ft) || null;
  group.userData.dispose = () => {
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    texs.forEach((t) => t.dispose());
  };
  return group;
}
