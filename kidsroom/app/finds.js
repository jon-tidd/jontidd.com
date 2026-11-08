// finds.js — "Add a find": turn a photo of a rug, a poster or a piece of
// furniture into a catalog entry the 3D planner can place.
//
//   openFindDialog(host) -> Promise<entry | null>
//   rectifyImage(img, corners, outW, outH, opts?) -> HTMLCanvasElement
//
// No DOM access at import time (imports parts.js, so node needs "three" resolvable).
// Styles live in finds.css; every class is prefixed with "find-".

import { artOuterSize } from './models/parts.js';

const IN = 0.0254; // meters per inch
const FT = 0.3048; // meters per foot
const MAX_OUT = 1600; // max long side of any image we produce
const MAX_SRC = 3000; // max long side of the source pixels we sample from
const CLAUDE_MAX = 1568; // long side of the copy we send to Claude

// What an entry keeps of a saved image: never an upload url or a blob: url (only an inline data url).
const imageRef = (im) => (im.inline ? { id: im.id, shared: true, inline: true, url: im.url } : { id: im.id, shared: !!im.shared });

const RUG_PRESETS = [
  ['4x6', '4 × 6 ft', [4, 6]],
  ['5x7', '5 × 7 ft', [5, 7]],
  ['6x9', '6 × 9 ft', [6, 9]],
  ['8x10', '8 × 10 ft', [8, 10]],
  ['custom', 'Custom…', null],
  ['unsure', 'Not sure', null],
];
const RUG_BINDINGS = [
  ['none', 'No binding', null],
  ['photo', 'Match the photo', 'photo'],
  ['#efe6d4', 'Cream', '#efe6d4'],
  ['#b89a74', 'Tan', '#b89a74'],
  ['#8a8a8a', 'Grey', '#8a8a8a'],
  ['#2d3a5a', 'Navy', '#2d3a5a'],
];
const ART_FRAMES = [
  ['none', 'No frame', null],
  ['#f4f2ee', 'White', '#f4f2ee'],
  ['#222222', 'Black', '#222222'],
  ['#b8895a', 'Natural wood', '#b8895a'],
  ['#c9a54b', 'Gold', '#c9a54b'],
];
const FURN_CATEGORIES = [
  ['furniture', 'Furniture'],
  ['decor', 'Decor'],
  ['lighting', 'Lighting'],
  ['storage', 'Storage'],
];
// sample() error codes that mean "Claude is not usable in this session"
const OFF_CODES = new Set([
  'not_granted', 'sampling_disabled', 'images_unavailable',
  'capability_disabled', 'capability_removed', 'not_declared',
]);

// Session-wide: once Claude reports it isn't available, stop offering it.
let claudeOff = false;

/* ------------------------------------------------------------------ */
/* Geometry: square -> quad homography (Heckbert's closed form)        */
/* ------------------------------------------------------------------ */

/**
 * Projective map from the unit square to a quad.
 * corners: [TL, TR, BR, BL] as [x, y]; (u,v) = (0,0) -> TL, (1,0) -> TR,
 * (1,1) -> BR, (0,1) -> BL. Returns {a..h} with
 *   x = (a u + b v + c) / (g u + h v + 1),  y = (d u + e v + f) / (g u + h v + 1)
 */
export function squareToQuad(corners) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = corners;
  const dx3 = x0 - x1 + x2 - x3;
  const dy3 = y0 - y1 + y2 - y3;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    // parallelogram: plain affine map
    return { a: x1 - x0, b: x3 - x0, c: x0, d: y1 - y0, e: y3 - y0, f: y0, g: 0, h: 0 };
  }
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
  const den = dx1 * dy2 - dx2 * dy1 || 1e-12;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const h = (dx1 * dy3 - dx3 * dy1) / den;
  return {
    a: x1 - x0 + g * x1, b: x3 - x0 + h * x3, c: x0,
    d: y1 - y0 + g * y1, e: y3 - y0 + h * y3, f: y0,
    g, h,
  };
}

/** Clamp an output size so its long side is at most `max` px, keeping aspect. */
export function fitSize(w, h, max = MAX_OUT) {
  w = Math.max(1, w); h = Math.max(1, h);
  const s = Math.min(1, max / Math.max(w, h));
  return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))];
}

function defaultMakeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Source pixels are read once per image and cached (live preview runs every frame).
const pixelCache = new WeakMap();

function srcSize(src) {
  return [src.naturalWidth || src.videoWidth || src.width, src.naturalHeight || src.videoHeight || src.height];
}

function getSourcePixels(src, makeCanvas, maxSide) {
  // ImageData-like object: use as is
  if (src && src.data && src.width && src.height && typeof src.getContext !== 'function') {
    return { data: src.data, width: src.width, height: src.height, scale: 1 };
  }
  const [nw, nh] = srcSize(src);
  const isCanvas = typeof src.getContext === 'function';
  const cached = !isCanvas && pixelCache.get(src);
  if (cached && cached.nw === nw && cached.nh === nh && cached.maxSide === maxSide) return cached;
  const [w, h] = fitSize(nw, nh, maxSide);
  let id;
  if (isCanvas && w === nw && h === nh) {
    id = src.getContext('2d').getImageData(0, 0, w, h);
  } else {
    const c = makeCanvas(w, h);
    const cx = c.getContext('2d');
    cx.drawImage(src, 0, 0, w, h);
    id = cx.getImageData(0, 0, w, h);
  }
  const out = { data: id.data, width: w, height: h, scale: w / nw, nw, nh, maxSide };
  if (!isCanvas) pixelCache.set(src, out);
  return out;
}

/**
 * Perspective-warp the quad `corners` ([TL, TR, BR, BL] in source pixel coords)
 * of `img` into an outW × outH canvas (clamped to 1600 px on the long side).
 * Inverse mapping: each output pixel center is mapped through the homography
 * into the source and bilinearly sampled.
 * img: HTMLImageElement | HTMLCanvasElement | ImageBitmap | ImageData-like {data,width,height}.
 * opts: { makeCanvas(w,h), canvas (reuse this output canvas), maxSource }
 */
export function rectifyImage(img, corners, outW, outH, opts = {}) {
  const makeCanvas = opts.makeCanvas || defaultMakeCanvas;
  const [ow, oh] = fitSize(Math.round(outW), Math.round(outH), MAX_OUT);
  const src = getSourcePixels(img, makeCanvas, opts.maxSource || MAX_SRC);
  const s = src.scale; // natural px -> sampled px
  const H = squareToQuad(corners.map(([x, y]) => [x * s, y * s]));
  const sw = src.width, sh = src.height, sd = src.data;
  const maxX = sw - 1, maxY = sh - 1;

  let canvas = opts.canvas;
  if (canvas) { if (canvas.width !== ow) canvas.width = ow; if (canvas.height !== oh) canvas.height = oh; }
  else canvas = makeCanvas(ow, oh);
  const ctx = canvas.getContext('2d');
  const out = ctx.createImageData(ow, oh);
  const od = out.data;

  let o = 0;
  for (let y = 0; y < oh; y++) {
    const v = (y + 0.5) / oh;
    // numerators/denominator are linear in u: precompute the row constants
    const nxv = H.b * v + H.c, nyv = H.e * v + H.f, dv = H.h * v + 1;
    for (let x = 0; x < ow; x++, o += 4) {
      const u = (x + 0.5) / ow;
      const den = H.g * u + dv;
      // -0.5: source pixel centers sit at integer + 0.5
      let fx = (H.a * u + nxv) / den - 0.5;
      let fy = (H.d * u + nyv) / den - 0.5;
      if (!(fx > 0)) fx = 0; else if (fx > maxX) fx = maxX;
      if (!(fy > 0)) fy = 0; else if (fy > maxY) fy = maxY;
      const x0 = fx | 0, y0 = fy | 0;
      const x1 = x0 < maxX ? x0 + 1 : x0, y1 = y0 < maxY ? y0 + 1 : y0;
      const tx = fx - x0, ty = fy - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4;
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
      od[o] = sd[i00] * w00 + sd[i10] * w10 + sd[i01] * w01 + sd[i11] * w11;
      od[o + 1] = sd[i00 + 1] * w00 + sd[i10 + 1] * w10 + sd[i01 + 1] * w01 + sd[i11 + 1] * w11;
      od[o + 2] = sd[i00 + 2] * w00 + sd[i10 + 2] * w10 + sd[i01 + 2] * w01 + sd[i11 + 2] * w11;
      od[o + 3] = 255; // rugs/art are opaque (avoids black fringes after JPEG)
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

/* ------------------------------------------------------------------ */
/* Small pure helpers (exported for tests)                             */
/* ------------------------------------------------------------------ */

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const round = (n, step = 1) => Math.round(n / step) * step;

export const INSET_CORNERS = () => [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]];

/** Width / height of a quad from its average opposite side lengths. */
export function quadAspect(c) {
  const across = (dist(c[0], c[1]) + dist(c[3], c[2])) / 2;
  const down = (dist(c[0], c[3]) + dist(c[1], c[2])) / 2;
  return down > 0 ? across / down : 1;
}

/**
 * Real width / height of the rectangle seen as quad `c` (pixel coords, [TL,TR,BR,BL])
 * in a w × h photo, undoing perspective. Single-view rectangle method (Zhang & He,
 * "Whiteboard scanning"): assumes square pixels and the principal point at the
 * image center, recovers the focal length from the two vanishing directions and
 * measures both sides in camera space. Falls back to quadAspect() if the math fails.
 */
export function perspectiveAspect(c, w, h) {
  const fallback = quadAspect(c);
  const cx = w / 2, cy = h / 2;
  // Zhang's numbering: m1 = TL, m2 = TR, m3 = BL, m4 = BR (homogeneous, centered)
  const P = (p) => [p[0] - cx, p[1] - cy, 1];
  const m1 = P(c[0]), m2 = P(c[1]), m3 = P(c[3]), m4 = P(c[2]);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const m14 = cross(m1, m4);
  const k2 = dot(m14, m3) / dot(cross(m2, m4), m3);
  const k3 = dot(m14, m2) / dot(cross(m3, m4), m2);
  if (!Number.isFinite(k2) || !Number.isFinite(k3)) return fallback;
  const n2 = [k2 * m2[0] - m1[0], k2 * m2[1] - m1[1], k2 - 1];
  const n3 = [k3 * m3[0] - m1[0], k3 * m3[1] - m1[1], k3 - 1];
  const scale = Math.max(w, h);
  let f2 = -(n2[0] * n3[0] + n2[1] * n3[1]) / (n2[2] * n3[2]);
  // When one pair of edges is parallel in the image (or the estimate is implausible, e.g. a
  // cropped photo) the focal length can't be recovered: assume a typical phone camera,
  // f ≈ 0.8 × the long side. For a fully affine quad this reduces to quadAspect().
  if (!(f2 > (0.3 * scale) ** 2 && f2 < (6 * scale) ** 2)) f2 = (0.8 * scale) ** 2;
  const r = Math.sqrt((n2[0] ** 2 + n2[1] ** 2 + f2 * n2[2] ** 2) / (n3[0] ** 2 + n3[1] ** 2 + f2 * n3[2] ** 2));
  return Number.isFinite(r) && r > 0.1 && r < 10 ? r : fallback;
}

function isConvexQuad(c) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const p = c[i], q = c[(i + 1) % 4], r = c[(i + 2) % 4];
    const z = (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]);
    if (Math.abs(z) < 1e-12) return false;
    if (sign && Math.sign(z) !== sign) return false;
    sign = Math.sign(z);
  }
  return true;
}

/**
 * Parse Claude's corners answer into 4 [x,y] fractions, clamped to [0,1].
 * Accepts pixel answers too (divides by the size of the image Claude saw).
 * Returns null if unusable.
 */
export function parseCorners(raw, imgW = 1, imgH = 1) {
  const arr = raw && Array.isArray(raw.corners) ? raw.corners : null;
  if (!arr || arr.length !== 4) return null;
  let pts = arr.map((p) => (Array.isArray(p) ? [Number(p[0]), Number(p[1])]
    : p && typeof p === 'object' ? [Number(p.x), Number(p.y)] : [NaN, NaN]));
  if (pts.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) return null;
  if (pts.some(([x, y]) => x > 1.5 || y > 1.5)) pts = pts.map(([x, y]) => [x / imgW, y / imgH]);
  pts = pts.map(([x, y]) => [clamp01(x), clamp01(y)]);
  if (!isConvexQuad(pts)) {
    // labels mixed up: sort clockwise (y down) around the centroid, start at top-left
    const cx = pts.reduce((s, p) => s + p[0], 0) / 4, cy = pts.reduce((s, p) => s + p[1], 0) / 4;
    pts.sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));
    let start = 0;
    pts.forEach((p, i) => { if (p[0] + p[1] < pts[start][0] + pts[start][1]) start = i; });
    pts = pts.slice(start).concat(pts.slice(0, start));
    if (!isConvexQuad(pts)) return null;
  }
  return pts;
}

function parseSizeFt(v) {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const a = Number(v[0]), b = Number(v[1]);
  if (!(a > 0.5 && a < 30 && b > 0.5 && b < 30)) return null;
  return [a, b];
}

const isHex = (s) => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);
const toHex = (r, g, b) => '#' + [r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');

/**
 * Local fallback model: a box of the given size (meters) whose front face
 * shows the photo. Parts are boxes with center `pos` [x,y,z] and `size`
 * [w,h,d] in meters in the item's local frame (origin = footprint center at
 * floor, +Z = front), matching the module contract.
 */
export function buildPhotoBoxSpec({ name, w, d, h, color, mount = 'floor' }) {
  const t = Math.min(0.006, d * 0.1); // thin photo slab on the front face
  return {
    name,
    mount,
    w, d, h,
    color,
    parts: [
      // parts.js format: shape / at (center) / size [x, y, z]; wall items measure y from their vertical center
      { shape: 'box', size: [w, h, d - t], at: [0, mount === 'wall' ? 0 : h / 2, -t / 2], mat: 'painted', role: 'body' },
      { shape: 'box', size: [w, h, t], at: [0, mount === 'wall' ? 0 : h / 2, d / 2 - t / 2], color: '#ffffff', mat: 'plastic', role: 'accent', tex: 'image' },
    ],
  };
}

export function cornersPrompt(kind, name) {
  const what = kind === 'rug' ? 'a rug' : 'a piece of wall art (poster, print or painting)';
  const target = kind === 'rug'
    ? 'the rug. The "top" of the rug is its far edge in the photo (the edge farthest from the camera); if the photo looks straight down on the rug, top is the top of the image. If a corner is hidden, rounded, scalloped or cut off by the photo edge, estimate where the corner of the rug\'s overall rectangle would be (clamp to the image)'
    : 'the artwork itself: the printed or painted image area, not the frame, mat or wall. "Top" is the top of the artwork';
  return [
    `This photo shows ${what}${name ? ` called "${name}"` : ''}. Find the four corners of ${target}.`,
    'Give each corner as [x, y], fractions of the image width and height (0 to 1, origin at the top-left of the image), in this order: top-left, top-right, bottom-right, bottom-left.',
    kind === 'rug'
      ? 'If a size label is visible in the image (for example "5\' x 7\'"), also give it in feet as "sizeFt": [a, b]; otherwise "sizeFt": null.'
      : '',
    'Reply with ONLY this JSON and nothing else:',
    kind === 'rug'
      ? '{"corners": [[x,y],[x,y],[x,y],[x,y]], "confidence": 0.0, "sizeFt": null}'
      : '{"corners": [[x,y],[x,y],[x,y],[x,y]], "confidence": 0.0}',
    'confidence is 0-1: how sure you are about the corners.',
  ].filter(Boolean).join('\n');
}

export function partsPrompt({ partsDoc, name, category, mount, sizeIn, note, retryNote }) {
  const fmt = (v) => (v > 0 ? `${v}` : '?');
  return [
    'Two parents are planning their young daughter\'s bedroom in a 3D room planner. They found the item in this photo and want a simple, recognisable 3D model of it to place in the room.',
    `Name: ${name || '(none given)'}`,
    `Type: ${category}; it ${mount === 'wall' ? 'hangs on a wall' : 'stands on the floor'}.`,
    `Size they entered, in inches (W × D × H): ${fmt(sizeIn[0])} × ${fmt(sizeIn[1])} × ${fmt(sizeIn[2])}. "?" means unknown: estimate it from the photo and typical sizes for this kind of item.`,
    'Convert to METERS for w, d, h and all part coordinates (1 in = 0.0254 m).',
    note ? `Their note: ${note}` : null,
    retryNote ? `They saw your previous attempt and asked for this change: ${retryNote}` : null,
    '',
    'Describe the model in exactly this format:',
    partsDoc || '',
    '',
    'Reply with ONLY the JSON object, no prose and no code fences.',
  ].filter((l) => l !== null).join('\n');
}

/* ------------------------------------------------------------------ */
/* DOM helpers                                                         */
/* ------------------------------------------------------------------ */

function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'style') n.setAttribute('style', v);
      else if (k in n && typeof v !== 'string') n[k] = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) n.append(k);
  return n;
}

function field(id, label, input, hint) {
  return el('div', { class: 'find-field' },
    el('label', { class: 'find-label', for: id, text: label }),
    input,
    hint ? el('span', { class: 'find-hint', id: id + '-hint', text: hint }) : null);
}

function numInput(id, value, attrs = {}) {
  return el('input', {
    id, class: 'find-input find-input--num', type: 'number', inputmode: 'decimal',
    min: '0', step: 'any', value: value ?? '', ...attrs,
  });
}

function select(id, options, value) {
  const s = el('select', { id, class: 'find-input find-select' });
  for (const [v, label] of options) s.append(el('option', { value: v, text: label }));
  s.value = value;
  return s;
}

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : null; };

function canvasToBlob(canvas, type = 'image/jpeg', q = 0.9) {
  return new Promise((resolve, reject) => {
    if (canvas.toBlob) {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image'))), type, q);
    } else {
      try {
        const url = canvas.toDataURL(type, q);
        const bin = atob(url.split(',')[1]);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        resolve(new Blob([arr], { type }));
      } catch (e) { reject(e); }
    }
  });
}

/** Draw an image onto a white canvas no larger than maxSide (white = no black PNG holes in JPEG). */
function downscale(img, maxSide) {
  const [nw, nh] = srcSize(img);
  const [w, h] = fitSize(nw, nh, maxSide);
  const c = defaultMakeCanvas(w, h);
  const cx = c.getContext('2d');
  cx.fillStyle = '#ffffff';
  cx.fillRect(0, 0, w, h);
  cx.drawImage(img, 0, 0, w, h);
  return c;
}

/** Average color of the central 60% of an image (skips most background). */
function averageColor(img) {
  const [nw, nh] = srcSize(img);
  const c = defaultMakeCanvas(24, 24);
  const cx = c.getContext('2d');
  cx.drawImage(img, nw * 0.2, nh * 0.2, nw * 0.6, nh * 0.6, 0, 0, 24, 24);
  const d = cx.getImageData(0, 0, 24, 24).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
  }
  return n ? toHex(r / n, g / n, b / n) : '#b0a89c';
}

/** Average color of the outer band of a rectified image, a little darker (binding). */
function edgeColor(img, cornersPx) {
  const c = rectifyImage(img, cornersPx, 48, 48);
  const d = c.getContext('2d').getImageData(0, 0, 48, 48).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
    if (x > 2 && x < 45 && y > 2 && y < 45) continue;
    const i = (y * 48 + x) * 4;
    r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
  }
  return toHex(r / n * 0.85, g / n * 0.85, b / n * 0.85);
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}

function slug(s) {
  return (String(s || 'find').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'find').slice(0, 40);
}

function claudeErrorMessage(err) {
  const code = err && err.code;
  if (code === 'cancelled') return { silent: true };
  if (OFF_CODES.has(code)) return { off: true, text: 'Claude isn\'t available here, so this works by hand.' };
  if (code === 'rate_limited') return { text: 'Claude is busy - try again in a minute.' };
  if (code === 'invalid_json') return { text: 'Claude\'s answer came back garbled.', retry: true };
  if (code === 'image_rejected') return { text: 'Claude couldn\'t read this image. Try a different photo or screenshot.' };
  return { text: 'Something went wrong talking to Claude.', retry: true };
}

/* ------------------------------------------------------------------ */
/* The dialog                                                          */
/* ------------------------------------------------------------------ */

/**
 * Open the "Add a find" dialog in host.mount.
 * Resolves the saved catalog entry (as returned by host.addEntry) or null.
 */
export function openFindDialog(host) {
  return new Promise((resolveOuter) => {
    const S = {
      file: null, img: null, url: null, token: 0,
      claudeBlob: null, claudeDims: [1, 1],
      kind: null, name: '', note: '',
      rugPreset: '5x7', rugA: '', rugB: '', rugBinding: 'none',
      artW: '', artH: '', artFrame: 'none', artMat: false,
      furnW: '', furnD: '', furnH: '', furnCat: 'furniture', furnMount: 'floor',
      corners: INSET_CORNERS(), swap: false, cornersAutoFor: 0, foundSizeFt: null,
      spec: null, specErrors: [], specFor: 0, modelMode: 'box', color: null, prefill: {}, prefillMount: null,
      busy: false, abort: null,
    };
    const claudeOn = () => !claudeOff && !!host.sample && typeof host.sample.json === 'function' && !!host.canSendImages;
    const prevFocus = typeof document !== 'undefined' ? document.activeElement : null;
    let done = false;
    let cleanupStep = () => {};

    // ---------- shell ----------
    const titleId = 'find-title';
    const title = el('h2', { id: titleId, class: 'find-title', tabindex: '-1', text: 'Add a find' });
    const stepLabel = el('span', { class: 'find-steplabel', id: 'find-steplabel' });
    const closeBtn = el('button', { type: 'button', class: 'find-iconbtn', id: 'find-close', 'aria-label': 'Close', text: '×' });
    const body = el('div', { class: 'find-body' });
    const footer = el('div', { class: 'find-footer' });
    const msg = el('p', { class: 'find-msg', id: 'find-msg', role: 'status', 'aria-live': 'polite' });
    const dialog = el('div', { class: 'find-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
      el('div', { class: 'find-header' }, el('div', { class: 'find-headtext' }, title, stepLabel), closeBtn),
      body, msg, footer);
    const overlay = el('div', { class: 'find-overlay' }, dialog);
    host.mount.replaceChildren(overlay);

    function say(text, kind = 'info') {
      msg.textContent = text || '';
      msg.className = 'find-msg' + (text ? ' find-msg--' + kind : '');
    }

    function finish(result) {
      if (done) return;
      done = true;
      if (S.abort) S.abort.abort();
      cleanupStep();
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('paste', onPaste);
      if (S.url) URL.revokeObjectURL(S.url);
      host.mount.replaceChildren();
      try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (_) { /* ignore */ }
      resolveOuter(result || null);
    }

    closeBtn.addEventListener('click', () => finish(null));
    // no close-on-backdrop: a stray tap while dragging a corner on a tablet would lose the work

    function onKey(e) {
      if (done) return;
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        if (!S.busy) finish(null); // never drop a save that is in flight
      } else if (e.key === 'Tab') {
        // keep focus inside the dialog
        const f = [...dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
          .filter((n) => !n.disabled && n.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey, true);

    function onPaste(e) {
      if (S.step !== 1 || S.busy) return;
      const items = (e.clipboardData && e.clipboardData.items) || [];
      for (const it of items) {
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) { e.preventDefault(); useFile(f); return; }
        }
      }
    }
    document.addEventListener('paste', onPaste);

    function setFooter(...btns) { footer.replaceChildren(...btns); }
    function setBusy(b) {
      S.busy = b;
      footer.querySelectorAll('button').forEach((n) => { if (!n.dataset.keep) n.disabled = b; });
    }

    async function useFile(file) {
      if (!file || !(file.type || '').startsWith('image/')) {
        say('That isn\'t an image. Choose a photo or a screenshot.', 'error');
        return;
      }
      say('Opening the photo…');
      try {
        const { img, url } = await loadImageFile(file);
        if (S.url) URL.revokeObjectURL(S.url);
        // drop sizes and mount that only Claude filled in for the previous photo
        ['furnW', 'furnD', 'furnH'].forEach((k) => { if (S.prefill[k] != null && S[k] === S.prefill[k]) S[k] = ''; });
        if (S.prefillMount && S.furnMount === S.prefillMount) S.furnMount = 'floor';
        Object.assign(S, {
          file, img, url, token: S.token + 1, claudeBlob: null,
          corners: INSET_CORNERS(), swap: false, foundSizeFt: null, spec: null, specErrors: [], color: null, prefill: {}, prefillMount: null,
        });
        if (!S.name) S.name = (file.name || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 60)
          .replace(/^(image|img|screenshot|photo|pasted).*$/i, '');
        say('');
        renderStep1();
      } catch (_) {
        say('Couldn\'t open this image. Try a JPEG or PNG (a screenshot works too).', 'error');
      }
    }

    async function getClaudeBlob() {
      if (!S.claudeBlob) {
        const c = downscale(S.img, CLAUDE_MAX);
        S.claudeBlob = await canvasToBlob(c, 'image/jpeg', 0.85);
        S.claudeDims = [c.width, c.height];
      }
      return S.claudeBlob;
    }

    /* ---------------- Step 1: photo + what is it ---------------- */
    function renderStep1() {
      cleanupStep(); cleanupStep = () => {};
      S.step = 1;
      title.textContent = 'Add a find';
      stepLabel.textContent = 'Step 1 of 2 · Photo and details';

      const fileInput = el('input', { id: 'find-file', class: 'find-sr', type: 'file', accept: 'image/*' });
      fileInput.addEventListener('change', () => { if (fileInput.files[0]) useFile(fileInput.files[0]); });
      const drop = el('label', { class: 'find-drop' + (S.img ? ' find-drop--has' : ''), for: 'find-file', id: 'find-drop' },
        fileInput,
        S.img ? el('img', { class: 'find-drop-img', src: S.url, alt: 'Your photo' }) : null,
        el('span', { class: 'find-drop-text' },
          el('strong', { text: S.img ? 'Change photo' : 'Choose a photo' }),
          el('span', { text: ' or drop it here, or paste a screenshot (Ctrl/⌘ V)' })));
      ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('find-drop--over'); }));
      ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('find-drop--over')));
      drop.addEventListener('drop', (e) => {
        e.preventDefault();
        const f = e.dataTransfer && [...e.dataTransfer.files].find((x) => (x.type || '').startsWith('image/'));
        if (f) useFile(f); else say('Drop an image file (JPEG, PNG…).', 'error');
      });

      const nameIn = el('input', { id: 'find-name', class: 'find-input', type: 'text', value: S.name, maxlength: '80', placeholder: 'e.g. Rainbow rug from Target', autocomplete: 'off' });
      nameIn.addEventListener('input', () => { S.name = nameIn.value; });

      // what is it
      const kinds = [['rug', 'Rug', 'Lies flat on the floor'], ['art', 'Wall art', 'Poster, print, painting'], ['furniture', 'Furniture or decor', 'Anything 3D']];
      const kindSet = el('fieldset', { class: 'find-kinds' }, el('legend', { class: 'find-label', text: 'What is it?' }),
        kinds.map(([k, label, hint]) => {
          const r = el('input', { type: 'radio', name: 'find-kind', id: 'find-kind-' + k, value: k, class: 'find-radio', checked: S.kind === k });
          r.addEventListener('change', () => { S.kind = k; renderSize(); updateNext(); });
          return el('label', { class: 'find-kind', for: 'find-kind-' + k }, r,
            el('span', { class: 'find-kind-text' }, el('strong', { text: label }), el('span', { text: hint })));
        }));

      const sizeBox = el('div', { class: 'find-sizebox', id: 'find-sizebox' });
      function renderSize() {
        sizeBox.replaceChildren();
        if (S.kind === 'rug') {
          const sel = select('find-rug-size', RUG_PRESETS.map(([v, l]) => [v, l]), S.rugPreset);
          const a = numInput('find-rug-a', S.rugA, { placeholder: 'ft' });
          const b = numInput('find-rug-b', S.rugB, { placeholder: 'ft' });
          const custom = el('div', { class: 'find-row find-custom', hidden: S.rugPreset !== 'custom' },
            field('find-rug-a', 'Side A (ft)', a), field('find-rug-b', 'Side B (ft)', b));
          sel.addEventListener('change', () => { S.rugPreset = sel.value; custom.hidden = sel.value !== 'custom'; });
          a.addEventListener('input', () => { S.rugA = a.value; });
          b.addEventListener('input', () => { S.rugB = b.value; });
          sizeBox.append(field('find-rug-size', 'Rug size', sel), custom);
        } else if (S.kind === 'art') {
          const w = numInput('find-art-w', S.artW, { placeholder: 'in' });
          const h = numInput('find-art-h', S.artH, { placeholder: 'in' });
          w.addEventListener('input', () => { S.artW = w.value; });
          h.addEventListener('input', () => { S.artH = h.value; });
          sizeBox.append(el('div', { class: 'find-row' },
            field('find-art-w', 'Width (in)', w), field('find-art-h', 'Height (in)', h)),
          el('span', { class: 'find-hint', text: 'Size of the artwork without the frame. Leave blank if you don\'t know.' }));
        } else if (S.kind === 'furniture') {
          const inputs = ['W', 'D', 'H'].map((k) => {
            const n = numInput('find-furn-' + k.toLowerCase(), S['furn' + k], { placeholder: 'in' });
            n.addEventListener('input', () => { S['furn' + k] = n.value; });
            return n;
          });
          const cat = select('find-furn-category', FURN_CATEGORIES, S.furnCat);
          cat.addEventListener('change', () => { S.furnCat = cat.value; });
          const mount = select('find-furn-mount', [['floor', 'Stands on the floor'], ['wall', 'Hangs on a wall']], S.furnMount);
          mount.addEventListener('change', () => { S.furnMount = mount.value; S.prefillMount = null; });
          sizeBox.append(
            el('div', { class: 'find-row' }, field('find-furn-category', 'Kind', cat), field('find-furn-mount', 'Where', mount)),
            el('div', { class: 'find-row find-row--3' },
              field('find-furn-w', 'Width (in)', inputs[0]), field('find-furn-d', 'Depth (in)', inputs[1]), field('find-furn-h', 'Height (in)', inputs[2])),
            el('span', { class: 'find-hint', text: 'Any of these can be blank.' }));
        }
      }
      renderSize();

      const noteIn = el('textarea', { id: 'find-note', class: 'find-input find-textarea', rows: '2', placeholder: 'Price, store, link…' });
      noteIn.value = S.note;
      noteIn.addEventListener('input', () => { S.note = noteIn.value; });

      body.replaceChildren(el('div', { class: 'find-step1' },
        el('div', { class: 'find-col' }, drop),
        el('div', { class: 'find-col' },
          field('find-name', 'Name', nameIn),
          kindSet, sizeBox,
          field('find-note', 'Note (optional)', noteIn))));

      const cancel = el('button', { type: 'button', class: 'find-btn', id: 'find-cancel', text: 'Cancel', onclick: () => finish(null) });
      const next = el('button', { type: 'button', class: 'find-btn find-btn--primary', id: 'find-next', text: 'Next' });
      function updateNext() { next.disabled = !(S.img && S.kind); }
      next.addEventListener('click', () => {
        if (!S.img) { say('Choose a photo first.', 'error'); return; }
        if (!S.kind) { say('Pick what it is: rug, wall art or furniture.', 'error'); return; }
        if (S.kind === 'rug' && S.rugPreset === 'custom' && !(num(S.rugA) && num(S.rugB))) {
          say('Enter both sides of the custom rug size, or pick a preset.', 'error'); return;
        }
        say('');
        if (S.kind === 'furniture') renderFurniture(); else renderStraighten();
      });
      updateNext();
      setFooter(cancel, next);
    }

    /* ---------------- Step 2a: straighten (rug / art) ---------------- */

    // Real-world size of the output image: [width across, height down] in the
    // unit of the kind (ft for rugs, in for art), or null if unknown.
    function enteredSize() {
      if (S.kind === 'rug') {
        if (S.rugPreset === 'custom') return num(S.rugA) && num(S.rugB) ? [num(S.rugA), num(S.rugB)] : null;
        if (S.rugPreset === 'unsure') return S.foundSizeFt;
        const p = RUG_PRESETS.find((r) => r[0] === S.rugPreset);
        return p && p[2];
      }
      const w = num(S.artW), h = num(S.artH);
      return w && h ? [w, h] : null;
    }

    const cornersPx = () => S.corners.map(([x, y]) => [x * S.img.naturalWidth, y * S.img.naturalHeight]);

    // [across, down] in feet (rug) / inches (art) for the output image
    function outputSize() {
      const qa = perspectiveAspect(cornersPx(), S.img.naturalWidth, S.img.naturalHeight);
      const sz = enteredSize();
      if (S.kind === 'rug') {
        let pair;
        if (sz) {
          // rug sizes are unordered: guess which side runs across from the quad, user can swap
          const lo = Math.min(sz[0], sz[1]), hi = Math.max(sz[0], sz[1]);
          pair = qa >= 1 ? [hi, lo] : [lo, hi];
        } else {
          // unknown: assume a 7 ft long side and keep the photo's proportions
          pair = qa >= 1 ? [7, round(7 / qa, 0.5)] : [round(7 * qa, 0.5), 7];
          pair = pair.map((v) => Math.max(2, v));
        }
        return { size: S.swap ? [pair[1], pair[0]] : pair, guessed: !sz };
      }
      if (sz) return { size: sz, guessed: false };
      // art with no size: long side 18 in, photo's proportions
      const pair = qa >= 1 ? [18, round(18 / qa, 0.5)] : [round(18 * qa, 0.5), 18];
      return { size: pair, guessed: true };
    }

    function renderStraighten() {
      cleanupStep();
      S.step = 2;
      const isRug = S.kind === 'rug';
      title.textContent = isRug ? 'Straighten the rug' : 'Straighten the art';
      stepLabel.textContent = 'Step 2 of 2 · Drag the 4 corners onto the ' + (isRug ? 'rug' : 'artwork');

      // --- corner editor ---
      const img = el('img', { class: 'find-stage-img', src: S.url, alt: '', draggable: false });
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('class', 'find-stage-svg');
      svg.setAttribute('viewBox', '0 0 1 1');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('aria-hidden', 'true');
      const poly = document.createElementNS(svgNS, 'polygon');
      poly.setAttribute('class', 'find-quad');
      poly.setAttribute('vector-effect', 'non-scaling-stroke');
      const topEdge = document.createElementNS(svgNS, 'line');
      topEdge.setAttribute('class', 'find-quad-top');
      topEdge.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.append(poly, topEdge);
      const loupe = el('canvas', { class: 'find-loupe', width: 240, height: 240, 'aria-hidden': 'true', hidden: true });
      const names = ['Top-left', 'Top-right', 'Bottom-right', 'Bottom-left'];
      const handles = names.map((n, i) => el('button', {
        type: 'button', class: 'find-handle find-handle--' + i, id: 'find-handle-' + i,
        'aria-label': `${n} corner. Use the arrow keys to move it.`,
      }, el('span', { class: 'find-handle-dot' }, el('span', { class: 'find-handle-tag', text: ['TL', 'TR', 'BR', 'BL'][i] }))));
      const stage = el('div', { class: 'find-stage' }, img, svg, ...handles, loupe);
      const stageWrap = el('div', { class: 'find-stagewrap' }, stage);
      // Size the stage to the photo's aspect in JS, so handle percentages map exactly onto the image.
      function fitStage() {
        const nw = S.img.naturalWidth, nh = S.img.naturalHeight;
        const availW = Math.max(120, (stageWrap.clientWidth || 320) - 28); // room for edge handles
        const availH = Math.max(220, Math.min(window.innerHeight * 0.56, 620));
        const k = Math.min(availW / nw, availH / nh, 2);
        stage.style.width = Math.floor(nw * k) + 'px';
        stage.style.height = Math.floor(nh * k) + 'px';
      }
      const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fitStage) : null;
      if (ro) ro.observe(stageWrap);
      window.addEventListener('resize', fitStage);

      const preview = el('canvas', { class: 'find-preview-canvas', id: 'find-preview', role: 'img', 'aria-label': 'Straightened preview' });
      const sizeNote = el('p', { class: 'find-hint', id: 'find-size-note' });

      function drawOverlay() {
        poly.setAttribute('points', S.corners.map((p) => p.join(',')).join(' '));
        topEdge.setAttribute('x1', S.corners[0][0]); topEdge.setAttribute('y1', S.corners[0][1]);
        topEdge.setAttribute('x2', S.corners[1][0]); topEdge.setAttribute('y2', S.corners[1][1]);
        handles.forEach((hd, i) => {
          hd.style.left = (S.corners[i][0] * 100) + '%';
          hd.style.top = (S.corners[i][1] * 100) + '%';
        });
      }

      let raf = 0;
      function schedulePreview() {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const { size, guessed } = outputSize();
          const [pw, ph] = fitSize(size[0] * 100, size[1] * 100, 420);
          try { rectifyImage(S.img, cornersPx(), pw, ph, { canvas: preview }); } catch (_) { /* tainted or tiny image */ }
          const u = isRug ? 'ft' : 'in';
          sizeNote.textContent = `${fmtNum(size[0])} × ${fmtNum(size[1])} ${u} (width × ${isRug ? 'length' : 'height'})`
            + (guessed ? ' - size guessed from the photo, edit it in step 1' : '');
        });
      }
      const fmtNum = (n) => String(Math.round(n * 100) / 100);

      // --- dragging (pointer events: mouse, pen and touch) ---
      let drag = null;
      function pointFromEvent(e) {
        const r = img.getBoundingClientRect();
        return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, r];
      }
      function showLoupe(i, r) {
        const [x, y] = S.corners[i];
        const nw = S.img.naturalWidth, nh = S.img.naturalHeight;
        const view = 120 / 3 / (r.width / nw); // natural px shown across the loupe (3x zoom)
        const cx = loupe.getContext('2d');
        cx.fillStyle = '#000'; cx.fillRect(0, 0, 240, 240);
        cx.drawImage(S.img, x * nw - view / 2, y * nh - view / 2, view, view, 0, 0, 240, 240);
        cx.strokeStyle = '#fff'; cx.lineWidth = 3;
        cx.beginPath(); cx.moveTo(120, 96); cx.lineTo(120, 144); cx.moveTo(96, 120); cx.lineTo(144, 120); cx.stroke();
        cx.strokeStyle = '#000'; cx.lineWidth = 1; cx.stroke();
        loupe.hidden = false;
        // keep the loupe away from the finger: above it, or below when near the top
        const px = x * r.width, py = y * r.height;
        loupe.style.left = Math.min(Math.max(px - 60, -20), r.width - 100) + 'px';
        loupe.style.top = (py > 150 ? py - 150 : py + 40) + 'px';
      }
      handles.forEach((hd, i) => {
        hd.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          hd.setPointerCapture(e.pointerId);
          const [px, py] = pointFromEvent(e);
          drag = { i, id: e.pointerId, dx: S.corners[i][0] - px, dy: S.corners[i][1] - py };
          hd.classList.add('find-handle--active');
          hd.focus({ preventScroll: true });
        });
        hd.addEventListener('pointermove', (e) => {
          if (!drag || drag.i !== i || drag.id !== e.pointerId) return;
          const [px, py, r] = pointFromEvent(e);
          S.corners[i] = [clamp01(px + drag.dx), clamp01(py + drag.dy)];
          drawOverlay(); schedulePreview(); showLoupe(i, r);
        });
        const end = (e) => {
          if (!drag || drag.id !== e.pointerId) return;
          drag = null; loupe.hidden = true;
          hd.classList.remove('find-handle--active');
        };
        hd.addEventListener('pointerup', end);
        hd.addEventListener('pointercancel', end);
        hd.addEventListener('keydown', (e) => {
          const step = e.shiftKey ? 0.025 : 0.004;
          const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
          if (!d) return;
          e.preventDefault();
          S.corners[i] = [clamp01(S.corners[i][0] + d[0]), clamp01(S.corners[i][1] + d[1])];
          drawOverlay(); schedulePreview();
        });
      });

      // --- options ---
      const opts = el('div', { class: 'find-opts' });
      if (isRug) {
        const swap = el('button', { type: 'button', class: 'find-btn find-btn--small', id: 'find-swap', text: 'Swap width / length' });
        swap.addEventListener('click', () => { S.swap = !S.swap; schedulePreview(); });
        const bind = select('find-rug-binding', RUG_BINDINGS.map(([v, l]) => [v, l]), S.rugBinding);
        bind.addEventListener('change', () => { S.rugBinding = bind.value; });
        opts.append(el('div', { class: 'find-row find-row--end' }, field('find-rug-binding', 'Edge binding', bind), swap));
      } else {
        const frame = select('find-art-frame', ART_FRAMES.map(([v, l]) => [v, l]), S.artFrame);
        frame.addEventListener('change', () => { S.artFrame = frame.value; });
        const mat = el('input', { type: 'checkbox', id: 'find-art-mat', class: 'find-check', checked: S.artMat });
        mat.addEventListener('change', () => { S.artMat = mat.checked; });
        opts.append(el('div', { class: 'find-row find-row--end' }, field('find-art-frame', 'Frame', frame),
          el('label', { class: 'find-checklabel', for: 'find-art-mat' }, mat, el('span', { text: 'White mat' }))));
      }

      // --- Claude: find corners ---
      const findBtn = el('button', { type: 'button', class: 'find-btn find-btn--small', id: 'find-corners', 'data-keep': '1', text: 'Find corners' });
      const resetBtn = el('button', { type: 'button', class: 'find-btn find-btn--small', id: 'find-reset', text: 'Reset corners' });
      resetBtn.addEventListener('click', () => { S.corners = INSET_CORNERS(); drawOverlay(); schedulePreview(); });
      const tools = el('div', { class: 'find-tools' }, claudeOn() ? findBtn : null, resetBtn);
      let cornerAbort = null;
      async function findCorners(manual = false) {
        if (cornerAbort || !claudeOn()) return;
        const ac = cornerAbort = new AbortController();
        S.abort = cornerAbort;
        findBtn.disabled = true;
        findBtn.textContent = 'Finding…';
        say('Asking Claude to find the corners…');
        const token = S.token;
        try {
          const blob = await getClaudeBlob();
          const res = await host.sample.json(cornersPrompt(S.kind, S.name.trim()), {
            images: [blob], modelTier: 'default', signal: ac.signal,
            ...(manual ? { cache: false } : {}),
          });
          if (done || token !== S.token) return;
          if (ac.signal.aborted) throw { code: 'cancelled' };
          const pts = parseCorners(res, S.claudeDims[0], S.claudeDims[1]);
          if (!pts) { say('Claude couldn\'t find clear corners. Drag the handles yourself.', 'error'); return; }
          S.corners = pts;
          let extra = '';
          if (isRug) {
            const sz = parseSizeFt(res && res.sizeFt);
            if (sz) {
              S.foundSizeFt = sz;
              const mine = enteredSize();
              const same = mine && Math.min(...mine) === Math.min(...sz) && Math.max(...mine) === Math.max(...sz);
              if (S.rugPreset === 'unsure') extra = ` It read the size label: ${sz[0]} × ${sz[1]} ft.`;
              else if (!same) extra = ` The photo has a size label of ${sz[0]} × ${sz[1]} ft; you entered ${mine ? mine.join(' × ') : 'another size'}.`;
            }
          }
          const conf = Number(res && res.confidence);
          const low = Number.isFinite(conf) && conf < 0.5;
          say((low ? 'Claude made a rough guess at the corners. Check them and drag to fix.'
            : 'Claude placed the corners. Drag any handle to fine-tune.') + extra, low ? 'warn' : 'ok');
          drawOverlay(); schedulePreview();
        } catch (err) {
          if (done) return;
          const m = claudeErrorMessage(err);
          if (m.silent) { say(''); return; }
          if (m.off) { claudeOff = true; findBtn.remove(); }
          say(m.text + (m.off ? '' : ' Drag the handles yourself' + (m.retry ? ', or press Find corners to try again.' : '.')), m.off ? 'info' : 'error');
        } finally {
          if (S.abort === cornerAbort) S.abort = null;
          cornerAbort = null;
          findBtn.disabled = false;
          findBtn.textContent = 'Find corners';
        }
      }
      findBtn.addEventListener('click', () => findCorners(true));

      body.replaceChildren(el('div', { class: 'find-step2' },
        el('div', { class: 'find-editor' }, stageWrap, tools,
          el('p', { class: 'find-hint', text: isRug
            ? 'Put the dashed edge on the rug\'s far edge. Tap a handle and use the arrow keys for small moves.'
            : 'Put the corners on the artwork itself, inside any frame.' })),
        el('div', { class: 'find-side' },
          el('div', { class: 'find-label', text: 'Preview' }),
          el('div', { class: 'find-previewwrap' }, preview), sizeNote, opts)));

      const back = el('button', { type: 'button', class: 'find-btn', id: 'find-back', text: 'Back', onclick: () => { if (cornerAbort) cornerAbort.abort(); say(''); renderStep1(); } });
      const save = el('button', { type: 'button', class: 'find-btn find-btn--primary', id: 'find-save', text: 'Save to catalog' });
      save.addEventListener('click', () => saveFlat());
      setFooter(back, save);

      fitStage();
      drawOverlay();
      schedulePreview();
      title.focus();
      cleanupStep = () => {
        if (raf) cancelAnimationFrame(raf);
        if (cornerAbort) cornerAbort.abort();
        if (ro) ro.disconnect();
        window.removeEventListener('resize', fitStage);
      };

      // run once automatically per photo
      if (claudeOn() && S.cornersAutoFor !== S.token) {
        S.cornersAutoFor = S.token;
        findCorners();
      }
    }

    async function saveFlat() {
      if (S.busy) return;
      setBusy(true);
      say('Saving…');
      try {
        const isRug = S.kind === 'rug';
        const { size } = outputSize();
        const [ow, oh] = fitSize(size[0] * 1000, size[1] * 1000, MAX_OUT);
        const pts = cornersPx();
        const canvas = rectifyImage(S.img, pts, ow, oh);
        const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
        const name = S.name.trim() || (isRug ? 'New rug' : 'New art');
        const image = await host.saveImage(blob, slug(name) + '.jpg');
        let entry;
        if (isRug) {
          const b = RUG_BINDINGS.find((r) => r[0] === S.rugBinding);
          const binding = !b || !b[2] ? null : b[2] === 'photo' ? edgeColor(S.img, pts) : b[2];
          // sizeFt = [across the image, top-to-bottom of the image]
          entry = { category: 'rug', name, sizeFt: [size[0], size[1]], image: imageRef(image), binding, note: S.note.trim() };
        } else {
          const f = ART_FRAMES.find((r) => r[0] === S.artFrame);
          const frame = f ? f[2] : null;
          // the dialog asks for the print size; buildArt's w/h is the outer size (frame + mat included)
          const printW = +(size[0] * IN).toFixed(4), printH = +(size[1] * IN).toFixed(4);
          const outer = artOuterSize(printW, printH, !!frame, !!S.artMat);
          entry = {
            category: 'wall', kind: 'art', mount: 'wall', name,
            w: +outer.w.toFixed(4), h: +outer.h.toFixed(4), d: 0.03, printW, printH,
            frame, mat: S.artMat ? '#f6f3ec' : null,
            image: imageRef(image), note: S.note.trim(),
          };
        }
        const saved = await host.addEntry(entry);
        if (!done) finish(saved || entry);
      } catch (err) {
        if (done) return;
        setBusy(false);
        say('Couldn\'t save: ' + ((err && err.message) || 'unknown error') + '. Try again.', 'error');
      }
    }

    /* ---------------- Step 2b: furniture / decor ---------------- */

    const sizeInFromState = () => [num(S.furnW), num(S.furnD), num(S.furnH)];

    function renderFurniture() {
      cleanupStep();
      S.step = 2;
      title.textContent = 'Make it 3D';
      stepLabel.textContent = 'Step 2 of 2 · Check the model, then save';
      if (!S.color) S.color = averageColor(S.img);
      if (!S.spec || S.specFor !== S.token) S.modelMode = claudeOn() ? 'claude' : 'box';

      const thumb = el('img', { class: 'find-thumb', src: S.url, alt: 'Your photo' });
      const sketch = el('canvas', { class: 'find-sketch', width: 360, height: 240, role: 'img', 'aria-label': 'Front view sketch of the model' });
      const status = el('div', { class: 'find-claude', id: 'find-claude-status' });
      const errorsBox = el('div', { class: 'find-errors', id: 'find-errors' });

      // editable fields
      const nameIn = el('input', { id: 'find-furn-name', class: 'find-input', type: 'text', value: S.name, maxlength: '80' });
      nameIn.addEventListener('input', () => { S.name = nameIn.value; });
      const dims = ['W', 'D', 'H'].map((k) => {
        const n = numInput('find-furn2-' + k.toLowerCase(), S['furn' + k], { placeholder: 'in' });
        n.addEventListener('input', () => { S['furn' + k] = n.value; drawSketch(); });
        return n;
      });
      const colorIn = el('input', { id: 'find-furn-color', class: 'find-color', type: 'color', value: S.color });
      colorIn.addEventListener('input', () => { S.color = colorIn.value; drawSketch(); });
      const mountSel = select('find-furn2-mount', [['floor', 'Floor'], ['wall', 'Wall']], S.furnMount);
      mountSel.addEventListener('change', () => { S.furnMount = mountSel.value; S.prefillMount = null; });

      // model choice
      const modeClaude = el('input', { type: 'radio', name: 'find-model', id: 'find-model-claude', class: 'find-radio', value: 'claude' });
      const modeBox = el('input', { type: 'radio', name: 'find-model', id: 'find-model-box', class: 'find-radio', value: 'box' });
      const modeSet = el('fieldset', { class: 'find-modes' }, el('legend', { class: 'find-label', text: 'Model' }),
        el('label', { class: 'find-mode', for: 'find-model-claude' }, modeClaude, el('span', { text: 'Claude\'s 3D model' })),
        el('label', { class: 'find-mode', for: 'find-model-box' }, modeBox, el('span', { text: 'Simple photo box' })));
      [modeClaude, modeBox].forEach((r) => r.addEventListener('change', () => { if (r.checked) { S.modelMode = r.value; drawSketch(); } }));

      // retry with a note
      const retryIn = el('textarea', { id: 'find-retry-note', class: 'find-input find-textarea', rows: '2', placeholder: 'e.g. the legs are thinner, it has 3 drawers' });
      const retryBtn = el('button', { type: 'button', class: 'find-btn find-btn--small', id: 'find-retry', text: 'Try again with this note' });
      const retryBox = el('div', { class: 'find-retry' }, field('find-retry-note', 'Not quite right? Tell Claude what to change', retryIn), retryBtn);
      const retryLabel = retryBox.querySelector('label');

      let partsAbort = null;
      function refreshClaudeUI() {
        const on = claudeOn();
        modeClaude.disabled = !S.spec || S.specFor !== S.token;
        if (modeClaude.disabled && S.modelMode === 'claude' && !partsAbort) S.modelMode = 'box';
        modeClaude.checked = S.modelMode === 'claude';
        modeBox.checked = S.modelMode === 'box';
        modeSet.hidden = !on && !(S.spec && S.specFor === S.token);
        retryBox.hidden = !on || !!partsAbort;
        const hasSpec = S.spec && S.specFor === S.token;
        retryBtn.textContent = hasSpec ? 'Try again with this note' : 'Ask Claude again';
        retryLabel.textContent = hasSpec ? 'Not quite right? Tell Claude what to change' : 'Anything Claude should know? (optional)';
        errorsBox.replaceChildren();
        if (S.modelMode === 'claude' && S.specErrors.length) {
          errorsBox.append(el('p', { class: 'find-hint', text: 'The model had a few problems (fixed where possible):' }),
            el('ul', { class: 'find-errlist' }, S.specErrors.slice(0, 8).map((t) => el('li', { text: String(t) }))));
        }
        if (!on && !partsAbort && !(S.spec && S.specFor === S.token)) {
          status.replaceChildren(el('p', { class: 'find-hint', text: 'This will be a simple box in your size with the photo on its front. You can resize and recolor it.' }));
        }
      }

      // retry = user pressed the button (always cache:false); retryNote may be ''
      async function askClaude(retry = false, retryNote = '') {
        if (partsAbort || !claudeOn()) return;
        const ac = partsAbort = new AbortController();
        S.abort = partsAbort;
        const token = S.token;
        const stop = el('button', { type: 'button', class: 'find-btn find-btn--small', id: 'find-stop', 'data-keep': '1', text: 'Stop' });
        stop.addEventListener('click', () => partsAbort && partsAbort.abort());
        status.replaceChildren(el('div', { class: 'find-thinking' },
          el('span', { class: 'find-spinner', 'aria-hidden': 'true' }),
          el('span', { text: 'Thinking… Claude is building a 3D model from your photo. This can take a minute or two.' }), stop));
        S.modelMode = 'claude';
        say('');
        refreshClaudeUI();
        save.disabled = true;
        try {
          const blob = await getClaudeBlob();
          const res = await host.sample.json(partsPrompt({
            partsDoc: host.partsDoc, name: S.name.trim(), category: S.furnCat, mount: S.furnMount,
            sizeIn: sizeInFromState(), note: S.note.trim(), retryNote,
          }), {
            images: [blob], modelTier: 'complex', signal: ac.signal,
            ...(retry ? { cache: false } : {}),
          });
          if (done || token !== S.token) return;
          if (ac.signal.aborted) throw { code: 'cancelled' };
          let spec = res && !Array.isArray(res.parts) && res.spec && typeof res.spec === 'object' ? res.spec : res;
          if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw { code: 'invalid_json' };
          let v = { ok: true, errors: [], fixed: spec };
          try { v = host.validateParts(spec) || v; } catch (e) { v = { ok: false, errors: [String(e && e.message || e)], fixed: null }; }
          const fixed = v.fixed || spec;
          // validateParts swaps an unusable reply for a plain box: treat that as a failed answer
          const noParts = (v.errors || []).some((t) => /no usable parts|unrecoverable spec/.test(String(t)));
          if (noParts || !Array.isArray(fixed.parts) || !fixed.parts.length) {
            S.specErrors = (v.errors || []).map(String);
            throw { code: 'invalid_json' };
          }
          S.spec = fixed; S.specFor = token; S.specErrors = (v.errors || []).map(String);
          // prefill blanks (and earlier untouched prefills) from Claude's size (meters -> inches)
          [['w', 0], ['d', 1], ['h', 2]].forEach(([k, i]) => {
            const key = 'furn' + k.toUpperCase();
            const untouched = S.prefill[key] != null && S[key] === S.prefill[key];
            if ((!num(S[key]) || untouched) && Number(fixed[k]) > 0) {
              S[key] = String(round(fixed[k] / IN, 0.5)); dims[i].value = S[key];
              S.prefill[key] = S[key]; // untouched prefill -> keep Claude's exact meters
            }
          });
          if (isHex(fixed.color)) { S.color = fixed.color; colorIn.value = fixed.color; }
          if (fixed.mount === 'wall' || fixed.mount === 'floor') {
            if (S.furnMount !== fixed.mount) S.prefillMount = fixed.mount;
            S.furnMount = fixed.mount; mountSel.value = fixed.mount;
          }
          S.modelMode = 'claude';
          status.replaceChildren(el('p', { class: 'find-ok', text: `Claude made a model with ${fixed.parts.length} part${fixed.parts.length === 1 ? '' : 's'}. Adjust the size or color, then save.` }));
          retryIn.value = '';
        } catch (err) {
          if (done) return;
          const m = claudeErrorMessage(err);
          if (m.off) claudeOff = true;
          if (!(S.spec && S.specFor === token)) S.modelMode = 'box';
          if (m.off) say(m.text, 'info');
          const fallback = S.spec && S.specFor === token ? ' Your previous model is still here.' : ' Using a simple photo box for now.';
          status.replaceChildren(m.silent
            ? el('p', { class: 'find-hint', text: 'Stopped.' + fallback })
            : el('p', { class: m.off ? 'find-hint' : 'find-warn', text: m.text + fallback + (m.retry ? ' You can try again below.' : '') }));
        } finally {
          if (S.abort === partsAbort) S.abort = null;
          partsAbort = null;
          if (!done) { save.disabled = false; refreshClaudeUI(); drawSketch(); }
        }
      }
      retryBtn.addEventListener('click', () => askClaude(true, retryIn.value.trim()));

      // Front elevation sketch (best effort: draws parts that carry box-like size/pos)
      function drawSketch() {
        const cx = sketch.getContext('2d');
        const W = sketch.width, H = sketch.height;
        cx.clearRect(0, 0, W, H);
        const box = currentDims();
        const parts = S.modelMode === 'claude' && S.spec ? S.spec.parts : buildPhotoBoxSpec({ ...box, color: S.color }).parts;
        const sx = S.modelMode === 'claude' && S.spec && S.spec.w > 0 ? box.w / S.spec.w : 1;
        const sy = S.modelMode === 'claude' && S.spec && S.spec.h > 0 ? box.h / S.spec.h : 1;
        const scale = Math.min((W - 40) / box.w, (H - 30) / box.h);
        const ox = W / 2, oy = H - 14;
        cx.strokeStyle = 'rgba(128,128,128,.6)'; cx.lineWidth = 1;
        cx.beginPath(); cx.moveTo(10, oy + 0.5); cx.lineTo(W - 10, oy + 0.5); cx.stroke();
        const drawable = (parts || []).map((p) => {
          const size = p.size || p.dims || (p.w && p.h ? [p.w, p.h, p.d || 0] : null);
          const pos = p.pos || p.position || p.at || p.center || (Number.isFinite(p.x) ? [p.x, p.y || 0, p.z || 0] : null);
          return Array.isArray(size) && Array.isArray(pos) && size.length >= 2 && pos.length >= 2 ? { p, size, pos } : null;
        }).filter(Boolean).sort((a, b) => (a.pos[2] || 0) - (b.pos[2] || 0)); // back to front
        if (!drawable.length) {
          cx.fillStyle = S.color;
          cx.fillRect(ox - box.w * scale / 2, oy - box.h * scale, box.w * scale, box.h * scale);
          return;
        }
        for (const { p, size, pos } of drawable) {
          const w = size[0] * sx * scale, h = size[1] * sy * scale;
          const x = ox + pos[0] * sx * scale - w / 2, y = oy - pos[1] * sy * scale - h / 2;
          if (p.tex === 'image' && S.img.complete) cx.drawImage(S.img, x, y, w, h);
          else {
            cx.fillStyle = p.role === 'body' || p.color === 'body' || !isHex(p.color) ? S.color : p.color;
            cx.fillRect(x, y, w, h);
          }
          cx.strokeStyle = 'rgba(0,0,0,.25)';
          cx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
        }
      }

      body.replaceChildren(el('div', { class: 'find-step2 find-step2--furn' },
        el('div', { class: 'find-editor' },
          el('div', { class: 'find-furnviews' }, thumb, sketch),
          status, errorsBox, retryBox),
        el('div', { class: 'find-side' },
          modeSet,
          field('find-furn-name', 'Name', nameIn),
          el('div', { class: 'find-row find-row--3' },
            field('find-furn2-w', 'Width (in)', dims[0]), field('find-furn2-d', 'Depth (in)', dims[1]), field('find-furn2-h', 'Height (in)', dims[2])),
          el('div', { class: 'find-row' }, field('find-furn-color', 'Main color', colorIn), field('find-furn2-mount', 'Goes on', mountSel)))));

      const back = el('button', { type: 'button', class: 'find-btn', id: 'find-back', text: 'Back', onclick: () => { if (partsAbort) partsAbort.abort(); say(''); renderStep1(); } });
      const save = el('button', { type: 'button', class: 'find-btn find-btn--primary', id: 'find-save', text: 'Save to catalog' });
      save.addEventListener('click', () => saveFurniture());
      setFooter(back, save);
      cleanupStep = () => { if (partsAbort) partsAbort.abort(); };

      refreshClaudeUI();
      drawSketch();
      thumb.addEventListener('load', drawSketch);
      title.focus();
      if (claudeOn() && !(S.spec && S.specFor === S.token)) askClaude();
      else if (S.spec && S.specFor === S.token) {
        status.replaceChildren(el('p', { class: 'find-ok', text: `Claude's model has ${S.spec.parts.length} parts.` }));
      }
    }

    // Size in meters: entered inches, else Claude's size, else 18 in (wall items 4 in deep)
    function currentDims() {
      const sp = S.modelMode === 'claude' && S.spec ? S.spec : {};
      const typed = (k) => (S.spec && S.prefill['furn' + k] === S['furn' + k] && Number(sp[k.toLowerCase()]) > 0 ? null : num(S['furn' + k]));
      const [wi, di, hi] = ['W', 'D', 'H'].map(typed);
      const def = (k) => (Number(sp[k]) > 0 ? Number(sp[k]) : (k === 'd' && S.furnMount === 'wall' ? 4 : 18) * IN);
      return {
        w: wi ? wi * IN : def('w'),
        d: di ? di * IN : def('d'),
        h: hi ? hi * IN : def('h'),
        mount: S.furnMount,
      };
    }

    async function saveFurniture() {
      if (S.busy) return;
      setBusy(true);
      say('Saving…');
      try {
        const name = S.name.trim() || 'New find';
        const box = currentDims();
        const r4 = (v) => +v.toFixed(4);
        const photo = await canvasToBlob(downscale(S.img, MAX_OUT), 'image/jpeg', 0.9);
        const image = await host.saveImage(photo, slug(name) + '.jpg');
        let entry;
        if (S.modelMode === 'claude' && S.spec && S.specFor === S.token) {
          const sp = S.spec;
          entry = {
            ...sp,
            category: S.furnCat, name, mount: S.furnMount,
            w: r4(box.w), d: r4(box.d), h: r4(box.h),
            color: S.color, parts: sp.parts,
            image: imageRef(image), note: S.note.trim(), source: 'claude',
          };
          if (sp.light) entry.light = sp.light; else delete entry.light;
        } else {
          let spec = buildPhotoBoxSpec({ name, w: r4(box.w), d: r4(box.d), h: r4(box.h), color: S.color, mount: S.furnMount });
          try { const v = host.validateParts(spec); if (v && v.fixed) spec = v.fixed; } catch (_) { /* keep local spec */ }
          entry = {
            category: S.furnCat, name, mount: S.furnMount,
            w: r4(box.w), d: r4(box.d), h: r4(box.h), color: S.color, parts: spec.parts,
            image: imageRef(image), note: S.note.trim(), source: 'photo-box',
          };
        }
        const saved = await host.addEntry(entry);
        if (!done) finish(saved || entry);
      } catch (err) {
        if (done) return;
        setBusy(false);
        say('Couldn\'t save: ' + ((err && err.message) || 'unknown error') + '. Try again.', 'error');
      }
    }

    renderStep1();
    // focus the photo picker first
    const first = dialog.querySelector('#find-file');
    if (first) first.focus();
  });
}
