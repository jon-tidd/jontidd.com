// parts.js - builds 3D items from a small JSON "parts spec" (built-in catalog
// items and furniture Claude describes from a product photo), plus framed wall art.
//
// Exports: buildFromParts(spec, ctx, opts?), buildArt(spec, ctx, opts?),
//          validateParts(spec), PARTS_FORMAT_DOC, artOuterSize(printW, printH, hasFrame, hasMat)
//
// Origin rules (see docs/CONTRACT.md):
//   floor items: origin at floor center, x in ±w/2, y in [0,h], z in ±d/2
//   wall items : origin at the center of the BACK face, x in ±w/2, y in ±h/2, z in [0,d]
import * as THREE from 'three';

const DEG = Math.PI / 180;
const TILE = 0.5; // meters covered by one repeat of a procedural material texture

// ---------------------------------------------------------------------------
// LLM-facing format documentation (pasted into the photo -> parts prompt)
// ---------------------------------------------------------------------------
export const PARTS_FORMAT_DOC = `PARTS SPEC: JSON describing one item as simple primitives. Meters, degrees, colors "#rrggbb".
TOP LEVEL
 name: string
 category: furniture|seating|storage|decor|lighting|wall
 mount: "floor" (stands on floor) or "wall" (hangs; back touches the wall)
 w, d, h: REAL overall width (X), depth (Z), height (Y). Required: the model is stretched to exactly w x h x d.
 y: wall items only, height of the item's center above the floor (default 1.5)
 color: main color, used by all role "body" parts (user can recolor)
 parts: array of 1-80 primitives (below)
 light: lamps only {"at":[x,y,z],"color":"#ffd9a8","intensity":3,"distance":4}
COORDINATES (item-local): x = right when facing the item's front; y = up (y=0 is the floor); +z = the front, facing the room. The parts' union should span w x h x d; it is re-centered afterwards.
PART FIELDS
 shape: box|rbox|cushion|cyl|rcyl|sphere|cone|torus|plane|drape|legs4
 at: [x,y,z] center of the part (torus: ring center; arc drape: circle center)
 size: [sx,sy,sz] extent before rotation. Needed for box, rbox, cushion, plane, drape, legs4; optional for round shapes (stretches them, e.g. ellipsoid).
 r: radius (cyl, rcyl, sphere, cone, torus). Tapered cyl: r1 bottom, r2 top.
 h: height along Y (cyl, rcyl, cone)
 radius: corner rounding (rbox, rcyl)
 seg: sides of cyl/cone (3 triangle, 4 square, 6 hex); omit for round
 open: true = cyl/cone without caps (lamp shade, pipe)
 tube: torus thickness radius. A torus stands in the XY plane facing front; arc = degrees drawn, starting at +x going up over the top (180 = arch). rot [90,0,0] lays it flat.
 cushion: soft pillow box, thinner at the edges
 plane: flat rectangle facing +z, size [sx,sy,0]
 drape: hanging fabric with vertical folds. Flat panel: size [width,height,fold depth]. Curved: add arc (e.g. 180 = half circle bulging to +z), r = top radius, r2 = bottom radius, size [0,height,fold depth]. folds = count.
 legs4: 4 legs at the corners of a size[0] x size[2] footprint, height size[1]; r = leg radius (0.02), inset = gap from footprint edge (0), taper = bottom/top radius ratio (1)
 rot: [rx,ry,rz] applied z, then x, then y (yaw last)
 repeat: [n,dx,dy,dz] n copies, each shifted by (dx,dy,dz) (slats, books, bulbs)
 mat: wood|painted|fabric|velvet|sheer|fur|rattan|cork|metal|brass|plastic|glass|mirror|ceramic|emissive
 color: optional own color
 role: "body" (follows item color) or "accent" (keeps own color). Default: body if the part has no color, else accent.
 glow: true = glows softly when the lamp is on (shades). mat "emissive" = bulb/LED.
 tex: "image" = product photo on the part's front (+z) face; uv [u0,v0,u1,v1] crops it (0..1, v0 = bottom). For prints, patterned fronts.
TIPS: 4-30 parts. Proportions first (leg thickness, overhangs, gaps), then details. Accents (knobs, legs, trim) get their own color.
EXAMPLE
{"name":"Nightstand","category":"furniture","mount":"floor","w":0.45,"d":0.38,"h":0.58,"color":"#f3efe9","parts":[
{"shape":"rbox","at":[0,0.565,0],"size":[0.45,0.03,0.38],"radius":0.006,"mat":"painted"},
{"shape":"box","at":[0,0.34,-0.015],"size":[0.43,0.42,0.34],"mat":"painted"},
{"shape":"rbox","at":[0,0.44,0.165],"size":[0.39,0.18,0.02],"radius":0.005,"mat":"painted","repeat":[2,0,-0.205,0]},
{"shape":"sphere","at":[0,0.44,0.177],"r":0.012,"mat":"brass","color":"#c9a45c","repeat":[2,0,-0.205,0]},
{"shape":"legs4","at":[0,0.065,-0.01],"size":[0.41,0.13,0.34],"r":0.018,"taper":0.6,"mat":"wood","color":"#c9a074"}]}`;

// ---------------------------------------------------------------------------
// Small coercion helpers (never throw)
// ---------------------------------------------------------------------------
const SHAPES = ['box', 'rbox', 'cushion', 'cyl', 'rcyl', 'sphere', 'cone', 'torus', 'plane', 'drape', 'legs4'];
const SHAPE_ALIAS = {
  cube: 'box', block: 'box', panel: 'box', slab: 'box', board: 'box', rect: 'box', rectangle: 'box',
  roundedbox: 'rbox', rounded_box: 'rbox', 'rounded box': 'rbox', round_box: 'rbox',
  cylinder: 'cyl', tube: 'cyl', pipe: 'cyl', rod: 'cyl', disc: 'cyl', disk: 'cyl', pole: 'cyl', post: 'cyl', leg: 'cyl',
  roundedcylinder: 'rcyl', rounded_cylinder: 'rcyl', pouf: 'rcyl', puck: 'rcyl', ottoman: 'rcyl',
  ball: 'sphere', globe: 'sphere', ellipsoid: 'sphere', dome: 'sphere', knob: 'sphere',
  pyramid: 'cone', ring: 'torus', donut: 'torus', hoop: 'torus', arch: 'torus',
  pillow: 'cushion', mattress: 'cushion', seat: 'cushion', pad: 'cushion',
  quad: 'plane', sheet: 'plane', card: 'plane',
  curtain: 'drape', fabric: 'drape', cloth: 'drape', canopy: 'drape',
  legs: 'legs4', four_legs: 'legs4', '4legs': 'legs4',
};
const MATS = ['wood', 'painted', 'fabric', 'velvet', 'sheer', 'fur', 'rattan', 'cork', 'metal', 'brass', 'plastic', 'glass', 'mirror', 'ceramic', 'emissive'];
const MAT_ALIAS = {
  wooden: 'wood', oak: 'wood', walnut: 'wood', pine: 'wood', timber: 'wood', bamboo: 'wood', plywood: 'wood',
  paint: 'painted', lacquer: 'painted', mdf: 'painted', laminate: 'painted', matte: 'painted',
  cloth: 'fabric', linen: 'fabric', cotton: 'fabric', canvas: 'fabric', textile: 'fabric', boucle: 'fur', wool: 'fabric', felt: 'fabric', knit: 'fabric', upholstery: 'fabric',
  plush: 'velvet', suede: 'velvet', voile: 'sheer', tulle: 'sheer', chiffon: 'sheer', gauze: 'sheer', mesh: 'sheer',
  faux_fur: 'fur', sheepskin: 'fur', shag: 'fur', teddy: 'fur',
  wicker: 'rattan', cane: 'rattan', jute: 'rattan', seagrass: 'rattan', straw: 'rattan',
  steel: 'metal', iron: 'metal', chrome: 'metal', aluminum: 'metal', aluminium: 'metal', silver: 'metal',
  gold: 'brass', copper: 'brass', bronze: 'brass',
  vinyl: 'plastic', acrylic: 'plastic', rubber: 'plastic', resin: 'plastic',
  stone: 'ceramic', marble: 'ceramic', porcelain: 'ceramic', terracotta: 'ceramic', clay: 'ceramic', concrete: 'ceramic',
  light: 'emissive', bulb: 'emissive', led: 'emissive', lamp: 'emissive', glowing: 'emissive',
  crystal: 'glass', clear: 'glass', mirrored: 'mirror', leather: 'plastic', paper: 'painted',
};
const CATEGORIES = ['furniture', 'decor', 'lighting', 'storage', 'seating', 'wall'];
const NEUTRAL = {
  wood: '#c9a074', painted: '#e9e5de', fabric: '#e6dfd4', velvet: '#c9a7b4', sheer: '#f7f3ee', fur: '#efe6da',
  rattan: '#c8a26b', cork: '#c49a6c', metal: '#a7a9ac', brass: '#c9a45c', plastic: '#e8e4dc', glass: '#ffffff',
  mirror: '#e8eef0', ceramic: '#f2efe9', emissive: '#fff1d0',
};

function num(v, def) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : def;
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function str(v, def) { return typeof v === 'string' && v.trim() ? v.trim() : (typeof v === 'number' ? String(v) : def); }

// Accepts [x,y,z], {x,y,z}, "x,y,z" or a single number.
function vec3(v, def) {
  if (typeof v === 'string') v = v.split(/[\s,;]+/).filter(Boolean);
  if (v && typeof v === 'object' && !Array.isArray(v)) v = [v.x, v.y, v.z];
  if (typeof v === 'number') v = [v, v, v];
  if (!Array.isArray(v)) return def ? def.slice() : null;
  const d = def || [0, 0, 0];
  return [0, 1, 2].map(i => num(v[i], d[i]));
}

// '#abc', '#aabbcc', 'aabbcc', 'pink', 0xff00ff, 'rgb(1,2,3)' -> '#rrggbb' (or def)
function hex(v, def) {
  try {
    if (typeof v === 'number' && Number.isFinite(v)) return '#' + (Math.max(0, Math.floor(v)) & 0xffffff).toString(16).padStart(6, '0');
    if (typeof v !== 'string') return def;
    let s = v.trim().toLowerCase();
    if (/^#?[0-9a-f]{6}$/.test(s)) return '#' + s.replace('#', '');
    if (/^#?[0-9a-f]{3}$/.test(s)) { s = s.replace('#', ''); return '#' + s[0] + s[0] + s[1] + s[1] + s[2] + s[2]; }
    const named = THREE.Color.NAMES[s.replace(/[\s_-]/g, '')];
    if (named !== undefined) return '#' + named.toString(16).padStart(6, '0');
    const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
    if (m) return '#' + [m[1], m[2], m[3]].map(x => clamp(Math.round(+x), 0, 255).toString(16).padStart(2, '0')).join('');
  } catch (e) { /* fall through */ }
  return def;
}

function pick(v, list, alias, def) {
  if (typeof v !== 'string') return def;
  const s = v.trim().toLowerCase();
  if (list.includes(s)) return s;
  const k = s.replace(/[\s-]+/g, '_');
  if (alias && alias[s]) return alias[s];
  if (alias && alias[k]) return alias[k];
  if (alias) for (const a in alias) if (s.includes(a)) return alias[a];
  for (const l of list) if (s.includes(l)) return l;
  return def;
}

function slug(s) { return String(s || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'item'; }

// ---------------------------------------------------------------------------
// validateParts: coerce a sloppy spec into a safe one. Never throws.
// ---------------------------------------------------------------------------
export function validateParts(spec) {
  const errors = [];
  try {
    return { ...validateInner(spec, errors), errors };
  } catch (e) {
    errors.push('unrecoverable spec: ' + (e && e.message));
    const fixed = { name: 'Custom item', id: 'custom_item', category: 'decor', mount: 'floor', w: 0.5, d: 0.5, h: 0.5, color: '#d9d4cc',
      parts: [{ shape: 'box', at: [0, 0.25, 0], size: [0.5, 0.5, 0.5], mat: 'painted', role: 'body' }] };
    return { ok: false, errors, fixed };
  }
}

function validateInner(spec, errors) {
  if (typeof spec === 'string') {
    // tolerate code fences or prose around the JSON
    const a = spec.indexOf('{'), b = spec.lastIndexOf('}');
    try { spec = JSON.parse(a >= 0 && b > a ? spec.slice(a, b + 1) : spec); } catch (e) { errors.push('spec is not valid JSON'); spec = {}; }
  }
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    if (Array.isArray(spec)) { errors.push('spec was an array; treated as parts'); spec = { parts: spec }; }
    else { errors.push('spec is not an object'); spec = {}; }
  }
  const f = {};
  f.name = str(spec.name, null);
  if (!f.name) { errors.push('missing name'); f.name = 'Custom item'; }
  f.id = typeof spec.id === 'string' && spec.id.trim() ? slug(spec.id) : slug(f.name);
  f.category = pick(spec.category, CATEGORIES, { lamp: 'lighting', light: 'lighting', chair: 'seating', sofa: 'seating', shelf: 'storage', table: 'furniture', art: 'wall', mirror: 'wall' }, null);
  if (!f.category) { if (spec.category !== undefined) errors.push('unknown category'); f.category = spec.mount === 'wall' ? 'wall' : 'decor'; }
  f.mount = pick(spec.mount, ['floor', 'wall'], { hanging: 'wall', wall_mounted: 'wall', standing: 'floor', ground: 'floor' }, null);
  if (!f.mount) { if (spec.mount !== undefined) errors.push('unknown mount'); f.mount = f.category === 'wall' ? 'wall' : 'floor'; }
  f.color = hex(spec.color, null);
  if (!f.color) { if (spec.color !== undefined) errors.push('bad color'); f.color = '#d9d4cc'; }

  // --- parts ---
  let parts = spec.parts;
  if (parts && typeof parts === 'object' && !Array.isArray(parts)) parts = [parts];
  if (!Array.isArray(parts)) { if (parts !== undefined) errors.push('parts is not an array'); parts = []; }
  if (parts.length > 80) { errors.push(`too many parts (${parts.length}); kept 80`); parts = parts.slice(0, 80); }
  let budget = 200; // total part instances after "repeat"
  f.parts = [];
  parts.forEach((p, i) => {
    const q = validatePart(p, i, errors);
    if (!q) return;
    if (q.repeat) {
      const n = Math.min(q.repeat[0], budget);
      if (n < q.repeat[0]) errors.push(`part ${i}: repeat reduced to ${n}`);
      if (n <= 1) delete q.repeat; else q.repeat[0] = n;
    }
    budget -= q.repeat ? q.repeat[0] : 1;
    if (budget < 0) { errors.push(`part ${i}: dropped (instance budget)`); return; }
    f.parts.push(q);
  });

  // --- overall size: fall back to the parts' rough extent ---
  const ext = roughExtent(f.parts);
  const dim = (k, lo, hi, fromExt) => {
    let v = num(spec[k], NaN);
    if (!(v > 0)) {
      errors.push(spec[k] === undefined ? `missing ${k}` : `bad ${k}`);
      v = fromExt > 0.005 ? fromExt : 0.5;
    }
    if (v < lo || v > hi) { errors.push(`${k} clamped`); v = clamp(v, lo, hi); }
    return +v.toFixed(4);
  };
  f.w = dim('w', 0.01, 8, ext && ext[0]);
  f.d = dim('d', 0.01, 8, ext && ext[2]);
  f.h = dim('h', 0.01, 4, ext && ext[1]);
  if (f.mount === 'wall') {
    const y = num(spec.y, NaN);
    f.y = Number.isFinite(y) ? clamp(y, f.h / 2, 3) : Math.max(1.5, f.h / 2);
  }
  if (!f.parts.length) {
    errors.push('no usable parts; using a plain box');
    f.parts.push({ shape: 'box', at: [0, f.mount === 'wall' ? 0 : f.h / 2, 0], size: [f.w, f.h, f.d], mat: 'painted', role: 'body' });
  }

  // --- optional lamp light ---
  if (spec.light && typeof spec.light === 'object') {
    const L = spec.light;
    f.light = {
      at: vec3(L.at || L.position, [0, f.mount === 'wall' ? 0 : f.h * 0.8, 0]),
      color: hex(L.color, '#ffd9a8'),
      intensity: clamp(num(L.intensity, 3), 0, 50),
      distance: clamp(num(L.distance, 4), 0, 20),
    };
  } else if (spec.light !== undefined && spec.light !== null && spec.light !== false) {
    errors.push('bad light; ignored');
  }
  return { ok: errors.length === 0, fixed: f };
}

function validatePart(p, i, errors) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) { errors.push(`part ${i}: not an object, dropped`); return null; }
  const e = msg => errors.push(`part ${i}: ${msg}`);
  const q = {};
  q.shape = pick(p.shape || p.type, SHAPES, SHAPE_ALIAS, null);
  if (!q.shape) { e(`unknown shape "${p.shape}" -> box`); q.shape = 'box'; }
  if (p.name) q.name = str(p.name, undefined);
  q.at = vec3(p.at ?? p.pos ?? p.position, [0, 0, 0]);
  if (p.at === undefined && p.pos === undefined && p.position === undefined) e('missing at');
  const pos = (v, def, lo = 0.001, hi = 10) => { const n = num(v, NaN); return Number.isFinite(n) && n > 0 ? clamp(n, lo, hi) : def; };
  if (p.size !== undefined) {
    const s = vec3(p.size, null);
    if (!s) e('bad size');
    else q.size = s.map((v, k) => {
      if (q.shape === 'plane' && k === 2) return Math.max(0, Math.abs(v) || 0);
      if (q.shape === 'drape' && k === 0 && p.arc !== undefined) return Math.max(0, Math.abs(v) || 0);
      return Number.isFinite(v) && v > 0 ? clamp(v, 0.002, 10) : (e('size <= 0 fixed'), 0.05);
    });
  }
  const needsSize = ['box', 'rbox', 'cushion', 'plane', 'legs4'].includes(q.shape) || (q.shape === 'drape' && p.arc === undefined);
  if (needsSize && !q.size) {
    const r = pos(p.r, 0.05);
    q.size = q.shape === 'plane' ? [2 * r, 2 * r, 0] : [2 * r, pos(p.h, 2 * r), 2 * r];
    e('missing size');
  }
  for (const k of ['r', 'r1', 'r2', 'h', 'tube', 'radius', 'inset']) {
    if (p[k] === undefined) continue;
    const n = num(p[k], NaN);
    if (k === 'inset' ? n >= 0 : n > 0) q[k] = clamp(n, k === 'inset' ? 0 : 0.0005, 10);
    else e(`bad ${k}`);
  }
  if (p.taper !== undefined) q.taper = clamp(num(p.taper, 1), 0, 5);
  if (p.flare !== undefined) q.flare = clamp(num(p.flare, 1), 0.1, 10);
  if (p.arc !== undefined) q.arc = clamp(num(p.arc, 360), 1, 360);
  if (p.seg !== undefined) q.seg = clamp(Math.round(num(p.seg, 24)), 3, 64);
  if (p.folds !== undefined) q.folds = clamp(Math.round(num(p.folds, 6)), 0, 60);
  if (p.open !== undefined) q.open = !!p.open && p.open !== 'false';
  if (p.glow !== undefined) q.glow = !!p.glow && p.glow !== 'false';
  if (p.rot !== undefined || p.rotation !== undefined) {
    const r = vec3(p.rot ?? p.rotation, [0, 0, 0]);
    q.rot = r.map(v => ((v % 360) + 360) % 360 > 180 ? ((v % 360) + 360) % 360 - 360 : ((v % 360) + 360) % 360);
  }
  if (p.repeat !== undefined) {
    let r = p.repeat;
    if (typeof r === 'number') r = [r, 0, 0, 0];
    if (r && typeof r === 'object' && !Array.isArray(r)) r = [r.n ?? r.count, ...(vec3(r.step ?? r.offset, [0, 0, 0]))];
    if (Array.isArray(r)) {
      const n = clamp(Math.round(num(r[0], 1)), 1, 50);
      q.repeat = [n, clamp(num(r[1], 0), -10, 10), clamp(num(r[2], 0), -10, 10), clamp(num(r[3], 0), -10, 10)];
    } else e('bad repeat');
  }
  q.mat = pick(p.mat ?? p.material, MATS, MAT_ALIAS, null);
  if (!q.mat) { if (p.mat !== undefined || p.material !== undefined) e(`unknown mat "${p.mat ?? p.material}" -> painted`); q.mat = 'painted'; }
  if (p.color !== undefined) { const c = hex(p.color, null); if (c) q.color = c; else e('bad color'); }
  const role = typeof p.role === 'string' ? p.role.toLowerCase().trim() : null;
  q.role = role === 'body' || role === 'main' || role === 'primary' ? 'body' : role ? 'accent' : (q.color ? 'accent' : 'body');
  if (p.tex === 'image' || p.tex === true || p.texture === 'image') q.tex = 'image';
  if (q.tex && p.uv !== undefined) {
    const u = Array.isArray(p.uv) ? p.uv.map(x => clamp(num(x, NaN), 0, 1)) : [];
    if (u.length === 4 && u.every(Number.isFinite) && u[2] > u[0] && u[3] > u[1]) q.uv = u; else e('bad uv');
  }
  return q;
}

// Rough [w,h,d] of the parts (ignores rotation) - used when w/h/d are missing.
function roughExtent(parts) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    const hs = partHalfSize(p);
    const n = p.repeat ? p.repeat[0] : 1;
    for (let k = 0; k < n; k++) {
      for (let a = 0; a < 3; a++) {
        const c = p.at[a] + (p.repeat ? p.repeat[a + 1] * k : 0);
        min[a] = Math.min(min[a], c - hs[a]); max[a] = Math.max(max[a], c + hs[a]);
      }
    }
  }
  return parts.length ? max.map((v, a) => v - min[a]) : null;
}
function partHalfSize(p) {
  if (p.size && !(p.shape === 'drape' && p.arc)) return p.size.map(v => v / 2);
  const r = p.r ?? Math.max(p.r1 ?? 0, p.r2 ?? 0) ?? 0.05;
  const R = r || 0.05;
  if (p.shape === 'torus') { const t = p.tube ?? R * 0.2; return [R + t, R + t, t]; }
  if (p.shape === 'sphere') return [R, R, R];
  if (p.shape === 'drape') { const r2 = p.r2 ?? R; const m = Math.max(R, r2); return [m, (p.size ? p.size[1] : 1) / 2, m / 2]; }
  return [R, (p.h ?? 2 * R) / 2, R];
}

// ---------------------------------------------------------------------------
// Geometry primitives (all centered at their local origin unless noted)
// ---------------------------------------------------------------------------
function segs(quality) {
  return quality === 'low'
    ? { cyl: 12, sphW: 14, sphH: 9, torR: 8, torT: 20, rbox: 2, lathe: 14, drapeX: 24, drapeY: 6 }
    : { cyl: 28, sphW: 28, sphH: 18, torR: 12, torT: 40, rbox: 3, lathe: 28, drapeX: 48, drapeY: 12 };
}

// Rounded box: a subdivided cube whose vertices are pushed onto the surface of
// the inner box (half-size minus radius) offset outward by `rad`. Each axis has
// seg + m + seg segments: the outer `seg` rings on each side form the rounded
// band, the `m` middle segments are the flat face (m > 1 lets cushions puff).
function geoRBox(sx, sy, sz, rad, seg, m = 1) {
  rad = Math.max(0, Math.min(rad, sx / 2, sy / 2, sz / 2));
  if (rad < 1e-5 && m === 1) return new THREE.BoxGeometry(sx, sy, sz);
  seg = Math.max(1, seg);
  const n = 2 * seg + m;
  const g = new THREE.BoxGeometry(1, 1, 1, n, n, n);
  const P = g.attributes.position, N = g.attributes.normal;
  const inner = [sx / 2 - rad, sy / 2 - rad, sz / 2 - rad];
  const p = [0, 0, 0], dir = [0, 0, 0];
  for (let i = 0; i < P.count; i++) {
    p[0] = P.getX(i); p[1] = P.getY(i); p[2] = P.getZ(i);
    for (let a = 0; a < 3; a++) {
      const idx = Math.round((p[a] + 0.5) * n);
      // dir = 1 on the outer face plane, 0 where the flat part starts
      if (idx <= seg) { dir[a] = -(1 - idx / seg); p[a] = -inner[a]; }
      else if (idx >= seg + m) { dir[a] = 1 - (n - idx) / seg; p[a] = inner[a]; }
      else { dir[a] = 0; p[a] = -inner[a] + 2 * inner[a] * (idx - seg) / m; }
    }
    const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    const nx = dir[0] / len, ny = dir[1] / len, nz = dir[2] / len;
    P.setXYZ(i, p[0] + nx * rad, p[1] + ny * rad, p[2] + nz * rad);
    N.setXYZ(i, nx, ny, nz);
  }
  return g;
}

// Cushion: rounded box that gets thinner toward its edges (pillowy).
function geoCushion(sx, sy, sz, seg) {
  const s = [sx, sy, sz];
  const t = s.indexOf(Math.min(sx, sy, sz)); // thickness axis
  const g = geoRBox(sx, sy, sz, Math.min(sx, sy, sz) * 0.42, seg + 1, seg * 2 + 2);
  const P = g.attributes.position;
  const o = [0, 1, 2].filter(a => a !== t);
  for (let i = 0; i < P.count; i++) {
    const v = [P.getX(i), P.getY(i), P.getZ(i)];
    const e = Math.max(Math.abs(v[o[0]]) / (s[o[0]] / 2), Math.abs(v[o[1]]) / (s[o[1]] / 2));
    v[t] *= 1 - 0.28 * e * e * e; // full thickness at the center, ~72% at the rim
    P.setXYZ(i, v[0], v[1], v[2]);
  }
  g.computeVertexNormals(); // seams stay split per face; smooth enough at this scale
  return g;
}

// Rounded cylinder (pouf / puck) via a lathe profile.
function geoRCyl(r, h, rad, seg, arcSeg) {
  rad = Math.max(0.0005, Math.min(rad, r * 0.99, h / 2 * 0.99));
  const pts = [new THREE.Vector2(0, -h / 2)];
  const k = 5;
  for (let i = 0; i <= k; i++) { const a = -Math.PI / 2 + (i / k) * Math.PI / 2; pts.push(new THREE.Vector2(r - rad + Math.cos(a) * rad, -h / 2 + rad + Math.sin(a) * rad)); }
  for (let i = 0; i <= k; i++) { const a = (i / k) * Math.PI / 2; pts.push(new THREE.Vector2(r - rad + Math.cos(a) * rad, h / 2 - rad + Math.sin(a) * rad)); }
  pts.push(new THREE.Vector2(0, h / 2));
  return new THREE.LatheGeometry(pts, arcSeg || seg);
}

// Drape: hanging fabric with vertical folds. Folds are deeper toward the hem.
function geoDrape(p, S) {
  const folds = p.folds ?? null;
  const depth = p.size ? p.size[2] : 0.03;
  if (p.arc) {
    // partial open cylinder around the vertical axis, centered on +z
    const r1 = p.r ?? (p.size && p.size[0] ? p.size[0] / 2 : 0.3);
    const r2 = p.r2 ?? r1 * (p.flare ?? 1);
    const hgt = p.h ?? (p.size ? p.size[1] : 1);
    const arc = p.arc * DEG;
    const nf = folds ?? Math.max(3, Math.round(arc * Math.max(r1, r2) / 0.09));
    const g = new THREE.CylinderGeometry(r1, r2, hgt, Math.max(S.drapeX, nf * 6), S.drapeY, true, -arc / 2, arc);
    // thetaStart chosen so the arc is centered on +z (three's theta 0 points to +z)
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      const rr = Math.hypot(x, z) || 1e-6;
      const th = Math.atan2(x, z); // -arc/2..arc/2
      const u = (th + arc / 2) / arc;
      const down = 0.5 - y / hgt; // 0 at top, 1 at hem
      const off = (depth / 2) * (0.35 + 0.65 * down) * Math.sin(u * nf * Math.PI * 2);
      const k = (rr + off) / rr;
      P.setXYZ(i, x * k, y, z * k);
    }
    g.computeVertexNormals();
    return g;
  }
  const [sx, sy] = p.size;
  const nf = folds ?? Math.max(2, Math.round(sx / 0.09));
  const g = new THREE.PlaneGeometry(sx, sy, Math.max(S.drapeX, nf * 6), S.drapeY);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i);
    const down = 0.5 - y / sy;
    P.setZ(i, (depth / 2) * (0.35 + 0.65 * down) * Math.sin((x / sx + 0.5) * nf * Math.PI * 2));
  }
  g.computeVertexNormals();
  return g;
}

// Four legs at the corners of an sx x sz footprint, height sy (merged).
function geoLegs4(p, S) {
  const [sx, sy, sz] = p.size;
  const r = Math.min(p.r ?? 0.02, sx / 4, sz / 4);
  const taper = p.taper ?? 1;
  const inset = p.inset ?? 0;
  const ox = Math.max(0, sx / 2 - inset - r), oz = Math.max(0, sz / 2 - inset - r);
  const legs = [];
  for (const [x, z] of [[-ox, -oz], [ox, -oz], [-ox, oz], [ox, oz]]) {
    const g = (p.seg === 4)
      ? new THREE.BoxGeometry(2 * r, sy, 2 * r)
      : new THREE.CylinderGeometry(r, Math.max(0.0005, r * taper), sy, p.seg ?? Math.max(8, S.cyl >> 1));
    g.translate(x, 0, z);
    legs.push(g);
  }
  return mergeGeos(legs);
}

function makePartGeometry(p, S) {
  const r = p.r ?? (p.size ? Math.max(p.size[0], p.size[2]) / 2 : 0.05);
  let g;
  switch (p.shape) {
    case 'rbox': g = geoRBox(...p.size, p.radius ?? Math.min(...p.size) * 0.15, S.rbox); break;
    case 'cushion': g = geoCushion(...p.size, S.rbox); break; // seg 3 -> 18 segments/axis
    case 'cyl': {
      const r1 = p.r1 ?? r, r2 = p.r2 ?? (p.r1 !== undefined && p.r === undefined ? r1 : r);
      const h = p.h ?? (p.size ? p.size[1] : 2 * r);
      const arc = (p.arc ?? 360) * DEG;
      // full cylinders start at theta 0 (a vertex at +z, same as cone); partial arcs are centered on +z
      g = new THREE.CylinderGeometry(r2, r1, h, p.seg ?? S.cyl, 1, !!p.open || arc < 2 * Math.PI, arc < 2 * Math.PI ? -arc / 2 : 0, arc);
      break;
    }
    case 'rcyl': g = geoRCyl(r, p.h ?? (p.size ? p.size[1] : 2 * r), p.radius ?? Math.min(r, (p.h ?? 2 * r) / 2) * 0.35, S.lathe, p.seg); break;
    case 'sphere': g = new THREE.SphereGeometry(r, S.sphW, S.sphH); break;
    case 'cone': g = new THREE.CylinderGeometry(0, r, p.h ?? (p.size ? p.size[1] : 2 * r), p.seg ?? S.cyl, 1, !!p.open); break;
    case 'torus': {
      const tube = Math.min(p.tube ?? r * 0.2, r);
      g = new THREE.TorusGeometry(r, tube, S.torR, Math.max(6, Math.round(S.torT * (p.arc ?? 360) / 360)), (p.arc ?? 360) * DEG);
      break;
    }
    case 'plane': g = new THREE.PlaneGeometry(p.size[0], p.size[1]); break;
    case 'drape': g = geoDrape(p, S); break;
    case 'legs4': g = geoLegs4(p, S); break;
    default: g = new THREE.BoxGeometry(...p.size);
  }
  // round shapes: an explicit size stretches the shape's bbox to fill it
  if (p.size && ['cyl', 'rcyl', 'sphere', 'cone', 'torus'].includes(p.shape)) {
    g.computeBoundingBox();
    const b = g.boundingBox, c = b.getCenter(new THREE.Vector3()), e = b.getSize(new THREE.Vector3());
    g.translate(-c.x, -c.y, -c.z);
    g.scale(e.x > 1e-6 ? p.size[0] / e.x : 1, e.y > 1e-6 ? p.size[1] / e.y : 1, e.z > 1e-6 ? p.size[2] / e.z : 1);
  }
  return g;
}

// Concatenate geometries into one non-indexed geometry (position, normal, uv).
function mergeGeos(geos) {
  const list = geos.map(g => {
    const n = g.index ? g.toNonIndexed() : g;
    if (n !== g) g.dispose();
    if (!n.attributes.normal) n.computeVertexNormals();
    return n;
  });
  let count = 0;
  for (const g of list) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2);
  let o = 0;
  for (const g of list) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array.subarray(0, c * 3), o * 3);
    nor.set(g.attributes.normal.array.subarray(0, c * 3), o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array.subarray(0, c * 2), o * 2);
    o += c;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

// World-scale planar UVs (by dominant normal axis) so procedural textures keep
// a constant real-world scale regardless of part size.
function worldUVs(g) {
  const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    const ax = Math.abs(N.getX(i)), ay = Math.abs(N.getY(i)), az = Math.abs(N.getZ(i));
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    if (ay >= ax && ay >= az) U.setXY(i, x / TILE, z / TILE);
    else if (ax >= az) U.setXY(i, z / TILE, y / TILE);
    else U.setXY(i, x / TILE, y / TILE);
  }
  U.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// Procedural canvas textures (light grayscale, multiplied by material color)
// ---------------------------------------------------------------------------
function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function hashStr(t) { let h = 2166136261; for (const ch of String(t)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

function paintPattern(kind, c, W, rand) {
  const H = W;
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
  if (kind === 'wood') {
    c.fillStyle = '#f1ece6'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) { // long wavy grain lines along u
      const y0 = rand() * H, amp = 2 + rand() * 6, ph = rand() * 6.28, sh = 200 + Math.floor(rand() * 40);
      c.strokeStyle = `rgba(${sh - 70},${sh - 95},${sh - 125},${0.06 + rand() * 0.12})`;
      c.lineWidth = 0.6 + rand() * 2.2;
      c.beginPath();
      for (let x = 0; x <= W; x += 8) { const y = y0 + Math.sin(x / W * 6.28 * 2 + ph) * amp; x ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke();
    }
  } else if (kind === 'fabric' || kind === 'velvet') {
    c.fillStyle = '#f6f6f6'; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(0,0,0,0.035)';
    for (let i = 0; i < W; i += 3) { c.fillRect(i, 0, 1, H); c.fillRect(0, i, W, 1); }
    for (let i = 0; i < W * 6; i++) { c.fillStyle = `rgba(0,0,0,${rand() * 0.05})`; c.fillRect(rand() * W, rand() * H, 2, 1); }
  } else if (kind === 'rattan') {
    c.fillStyle = '#dcd2c2'; c.fillRect(0, 0, W, H);
    const n = 16, cell = W / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { // basket weave: alternating strand direction
      const x = i * cell, y = j * cell, horiz = (i + j) % 2 === 0;
      c.fillStyle = horiz ? '#f4ede1' : '#e8dccb';
      c.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      c.strokeStyle = 'rgba(90,60,30,0.25)'; c.lineWidth = 1;
      for (let k = 1; k < 4; k++) {
        c.beginPath();
        if (horiz) { c.moveTo(x + 1, y + k * cell / 4); c.lineTo(x + cell - 1, y + k * cell / 4); }
        else { c.moveTo(x + k * cell / 4, y + 1); c.lineTo(x + k * cell / 4, y + cell - 1); }
        c.stroke();
      }
    }
  } else if (kind === 'fur' || kind === 'cork') {
    c.fillStyle = kind === 'fur' ? '#f2f2f2' : '#ece6dc'; c.fillRect(0, 0, W, H);
    const n = W * W / (kind === 'fur' ? 18 : 30);
    for (let i = 0; i < n; i++) {
      const v = Math.floor(120 + rand() * 135);
      c.fillStyle = `rgba(${v},${v},${v},${kind === 'fur' ? 0.5 : 0.35})`;
      const s = kind === 'fur' ? 1 + rand() * 2 : 1 + rand() * 3;
      c.fillRect(rand() * W, rand() * H, s, kind === 'fur' ? s * 2 : s);
    }
  }
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
function texFor(kind, env, data) {
  const key = kind + (data ? ':data' : '');
  if (env.tex[key]) return env.tex[key];
  const W = env.quality === 'low' ? 256 : 512;
  let canvas = env.canvases[kind];
  if (!canvas) {
    canvas = env.ctx.makeCanvas(W, W);
    const c = canvas.getContext('2d');
    if (c) paintPattern(kind, c, W, rng(hashStr(kind)));
    env.canvases[kind] = canvas;
  }
  const t = env.ctx.canvasTexture(canvas, { srgb: !data, wrap: 'repeat' });
  env.textures.push(t);
  env.tex[key] = t;
  return t;
}

function fakeEnv(env) { // soft room-ish equirect so a mirror reflects something without a scene env map
  if (env.tex.env) return env.tex.env;
  const cv = env.ctx.makeCanvas(256, 128), c = cv.getContext('2d');
  if (c) {
    const g = c.createLinearGradient && c.createLinearGradient(0, 0, 0, 128);
    if (g && g.addColorStop) { g.addColorStop(0, '#fbfaf7'); g.addColorStop(0.5, '#dfe6ea'); g.addColorStop(0.55, '#c99a66'); g.addColorStop(1, '#8a6040'); c.fillStyle = g; }
    else c.fillStyle = '#dfe6ea';
    c.fillRect(0, 0, 256, 128);
    c.fillStyle = 'rgba(255,255,240,0.9)'; c.fillRect(100, 30, 40, 30); // a bright window
  }
  const t = env.ctx.canvasTexture(cv, { srgb: true, wrap: 'clamp' });
  t.mapping = THREE.EquirectangularReflectionMapping;
  env.textures.push(t);
  return (env.tex.env = t);
}

const TEXTURED = { wood: 1, fabric: 1, velvet: 1, rattan: 1, fur: 1, cork: 1, sheer: 1 };

function makeMaterial(p, color, env) {
  const col = new THREE.Color(color);
  let m;
  switch (p.mat) {
    case 'wood': m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, map: texFor('wood', env) }); break;
    case 'painted': m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.62 }); break;
    case 'fabric':
      m = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.95, map: texFor('fabric', env), sheen: 0.35, sheenRoughness: 0.8 });
      break;
    case 'velvet':
      m = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.9, map: texFor('velvet', env), sheen: 1, sheenRoughness: 0.45 });
      break;
    case 'sheer':
      m = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.9, map: texFor('fabric', env), sheen: 0.4, sheenRoughness: 0.7,
        transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false });
      break;
    case 'fur':
      m = new THREE.MeshStandardMaterial({ color: col, roughness: 1, map: texFor('fur', env), bumpMap: texFor('fur', env, true), bumpScale: 2.5 });
      break;
    case 'rattan':
      m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.82, map: texFor('rattan', env), bumpMap: texFor('rattan', env, true), bumpScale: 1.5 });
      break;
    case 'cork': m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.95, map: texFor('cork', env), bumpMap: texFor('cork', env, true), bumpScale: 1 }); break;
    case 'metal': m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: 0.9 }); break;
    case 'brass': m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.32, metalness: 0.9 }); break;
    case 'plastic': m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.42 }); break;
    case 'glass':
      m = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, clearcoat: 1, depthWrite: false });
      break;
    case 'mirror': m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.03, metalness: 1, envMap: fakeEnv(env) }); break;
    case 'ceramic': m = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 }); break;
    case 'emissive':
      m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, emissive: col.clone(), emissiveIntensity: 1.6 });
      m.userData.emissiveBase = 1.6;
      break;
    default: m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.62 });
  }
  if (m.sheen !== undefined && m.sheen > 0) m.sheenColor = col.clone().lerp(new THREE.Color('#ffffff'), 0.35);
  if (p.glow) { m.emissive = col.clone(); m.emissiveIntensity = 0.45; m.userData.glowBase = 0.45; }
  if (p.shape === 'plane' || p.shape === 'drape' || p.open) m.side = THREE.DoubleSide;
  m.userData.role = p.role;
  env.materials.push(m);
  return m;
}

function imageMaterial(p, env, opts) {
  const base = env.imageTex || (env.imageTex = loadImageTexture(opts && opts.image, env));
  if (!base) return null;
  let t = base;
  if (p.uv) { // crop: clone shares the image, only offset/repeat differ
    t = base.clone();
    t.repeat.set(p.uv[2] - p.uv[0], p.uv[3] - p.uv[1]);
    t.offset.set(p.uv[0], p.uv[1]);
    t.needsUpdate = !!base.image;
    env.textures.push(t);
  }
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, map: t });
  if (p.shape === 'plane' || p.shape === 'drape') m.side = THREE.DoubleSide;
  m.userData.role = 'image';
  env.materials.push(m);
  return m;
}

function loadImageTexture(img, env) {
  if (!img) return null;
  let t = null;
  try {
    if (typeof img === 'string') t = env.ctx.loadTexture(img, { srgb: true, wrap: 'clamp' });
    else if (typeof img.getContext === 'function') t = env.ctx.canvasTexture(img, { srgb: true, wrap: 'clamp' });
    else {
      t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = env.ctx.anisotropy || 1;
      t.needsUpdate = true;
    }
  } catch (e) { t = null; }
  if (t) env.textures.push(t);
  return t;
}

// ---------------------------------------------------------------------------
// buildFromParts
// ---------------------------------------------------------------------------
export function buildFromParts(spec, ctx, opts = {}) {
  const { fixed, errors } = validateParts(spec);
  let g = buildValidated(fixed, ctx, opts || {}, ctx && ctx.quality === 'low' ? 'low' : 'high');
  if (g.userData.triangles > 60000 && ctx && ctx.quality !== 'low') { // over budget: rebuild coarser
    g.userData.dispose();
    g = buildValidated(fixed, ctx, opts || {}, 'low');
  }
  g.userData.validation = errors;
  return g;
}

function buildValidated(f, ctx, opts, quality) {
  const S = segs(quality);
  const env = { ctx, quality, tex: {}, canvases: {}, textures: [], materials: [], geometries: [] };
  const group = new THREE.Group();
  group.name = f.id;

  // 1) build every part instance in item-local space, bucketed by material
  const buckets = new Map(); // key -> {part, color, geos[]}
  const singles = [];        // image-textured parts keep their own mesh/groups
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), one = new THREE.Vector3(1, 1, 1);
  for (const p of f.parts) {
    const color = p.role === 'body' ? f.color : (p.color || NEUTRAL[p.mat] || '#d9d4cc');
    const n = p.repeat ? p.repeat[0] : 1;
    let proto;
    try { proto = makePartGeometry(p, S); } catch (err) { proto = new THREE.BoxGeometry(0.05, 0.05, 0.05); }
    if (p.rot) e.set(p.rot[0] * DEG, p.rot[1] * DEG, p.rot[2] * DEG, 'YXZ'); else e.set(0, 0, 0, 'YXZ');
    q.setFromEuler(e);
    for (let k = 0; k < n; k++) {
      const geo = k === n - 1 ? proto : proto.clone();
      const off = p.repeat ? [p.repeat[1] * k, p.repeat[2] * k, p.repeat[3] * k] : [0, 0, 0];
      m4.compose(new THREE.Vector3(p.at[0] + off[0], p.at[1] + off[1], p.at[2] + off[2]), q, one);
      geo.applyMatrix4(m4);
      if (p.tex === 'image' && opts.image) { singles.push({ p, color, geo }); continue; }
      const key = [p.mat, color, p.role, p.glow ? 1 : 0, (p.shape === 'plane' || p.shape === 'drape' || p.open) ? 1 : 0].join('|');
      if (!buckets.has(key)) buckets.set(key, { p, color, geos: [] });
      buckets.get(key).geos.push(geo);
    }
  }

  // 2) merge buckets, give textured materials world-scale UVs
  const meshes = [];
  for (const { p, color, geos } of buckets.values()) {
    const geo = mergeGeos(geos);
    if (TEXTURED[p.mat]) worldUVs(geo);
    meshes.push(new THREE.Mesh(geo, makeMaterial(p, color, env)));
  }
  for (const { p, color, geo } of singles) {
    const im = imageMaterial(p, env, opts);
    const base = makeMaterial(p, color, env);
    let mat = im || base;
    // boxy shapes: photo on the +z face only (BoxGeometry group 4), rest keeps the base material
    if (im && ['box', 'rbox', 'cushion'].includes(p.shape) && geo.groups.length === 6) mat = [base, base, base, base, im, base];
    meshes.push(new THREE.Mesh(geo, mat));
  }

  // 3) normalize: stretch/translate so the union is exactly w x h x d
  const box = new THREE.Box3();
  for (const m of meshes) { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox); }
  const wall = f.mount === 'wall';
  const tmin = wall ? [-f.w / 2, -f.h / 2, 0] : [-f.w / 2, 0, -f.d / 2];
  const tsz = [f.w, f.h, f.d];
  const bmin = box.min.toArray(), bsz = box.getSize(new THREE.Vector3()).toArray();
  const sc = bsz.map((s, a) => (s > 1e-6 ? tsz[a] / s : 1));
  const tr = bmin.map((v, a) => (bsz[a] > 1e-6 ? tmin[a] - v * sc[a] : tmin[a] + tsz[a] / 2 - (v + bsz[a] / 2)));
  const norm = new THREE.Matrix4().makeScale(sc[0], sc[1], sc[2]).premultiply(new THREE.Matrix4().makeTranslation(tr[0], tr[1], tr[2]));
  let tris = 0;
  for (const m of meshes) {
    m.geometry.applyMatrix4(norm);
    m.geometry.computeBoundingBox();
    m.geometry.computeBoundingSphere();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const mat = mats[0];
    const role = mats.some(x => x.userData.role === 'image') ? 'image' : mat.userData.role;
    m.userData.role = role;
    const thin = mat.transparent || mat.emissiveIntensity > 1 || mat.side === THREE.DoubleSide;
    m.castShadow = !thin;
    m.receiveShadow = !(mat.userData.emissiveBase);
    tris += m.geometry.index ? m.geometry.index.count / 3 : m.geometry.attributes.position.count / 3;
    env.geometries.push(m.geometry);
    group.add(m);
  }

  // 4) optional lamp light (positioned through the same normalization)
  let light = null;
  if (f.light) {
    light = new THREE.PointLight(f.light.color, f.light.intensity, f.light.distance, 2);
    light.castShadow = false;
    light.position.fromArray(f.light.at).applyMatrix4(norm);
    light.name = f.id + '_light';
    light.userData.baseIntensity = f.light.intensity;
    group.add(light);
  }

  const setColor = hexColor => {
    const c = hex(hexColor, null);
    if (!c) return;
    for (const m of env.materials) {
      if (m.userData.role !== 'body') continue;
      m.color.set(c);
      if (m.sheenColor && m.sheen > 0) m.sheenColor.set(c).lerp(new THREE.Color('#ffffff'), 0.35);
      if (m.userData.glowBase !== undefined || m.userData.emissiveBase !== undefined) m.emissive.set(c);
    }
    group.userData.color = c;
  };
  const setLight = (on = true, level01 = 1) => {
    const lv = clamp(num(level01, 1), 0, 1);
    const live = !!on && lv > 0;
    if (light) { light.visible = live; light.intensity = light.userData.baseIntensity * lv; }
    for (const m of env.materials) {
      if (m.userData.emissiveBase !== undefined) m.emissiveIntensity = live ? m.userData.emissiveBase * (0.3 + 0.7 * lv) : 0;
      if (m.userData.glowBase !== undefined) m.emissiveIntensity = live ? m.userData.glowBase * lv : 0;
    }
    group.userData.lightOn = live;
    group.userData.lightLevel = lv;
  };

  group.userData = {
    kind: 'custom',
    id: f.id,
    name: f.name,
    category: f.category,
    mount: f.mount,
    mountY: f.mount === 'wall' ? f.y : undefined,
    size: { w: f.w, d: f.d, h: f.h },
    color: f.color,
    spec: f,
    light,
    hasLight: !!light || env.materials.some(m => m.userData.emissiveBase !== undefined || m.userData.glowBase !== undefined),
    lightOn: true,
    lightLevel: 1,
    triangles: Math.round(tris),
    normScale: sc.map(v => +v.toFixed(3)), // how much the parts were stretched to hit w/h/d (1 = parts matched)
    setColor,
    setLight,
    dispose() {
      for (const g of env.geometries) g.dispose();
      for (const m of env.materials) m.dispose();
      for (const t of env.textures) t.dispose();
      if (light) light.dispose();
    },
  };
  return group;
}

// ---------------------------------------------------------------------------
// buildArt: framed wall art (origin = center of the back face, z 0..d)
// ---------------------------------------------------------------------------
const COLOR_WORDS = {
  purple: '#7d55a8', violet: '#8a63c2', lilac: '#c8b6dc', lavender: '#cdbbe3', plum: '#6d3b67', pink: '#f2a7bf', blush: '#edc0c4',
  rose: '#e3a9b2', red: '#d0473f', coral: '#f28b82', orange: '#f4a261', peach: '#f7c6a3', yellow: '#f6d36b', gold: '#d4af37',
  green: '#7fb77e', sage: '#a3b899', mint: '#a9d3c9', teal: '#4fa3a5', blue: '#6fa8dc', navy: '#1f2547', sky: '#a8d0ec',
  white: '#f7f5f0', cream: '#f3ead8', ivory: '#f4f0e4', beige: '#e3d6c0', grey: '#9a9a9a', gray: '#9a9a9a', black: '#1d1d1f',
  brown: '#8a6040', natural: '#c9a074', oak: '#c9a074', walnut: '#6b4a33', silver: '#b8bcc0', brass: '#c9a45c',
};
const FRAME_COLORS = { white: '#f4f2ee', black: '#1d1d1f', gold: '#c9a45c', brass: '#c9a45c', silver: '#b8bcc0', natural: '#c9a074', oak: '#c9a074', wood: '#b88a5a', walnut: '#6b4a33', pink: '#efc3cb', grey: '#8f9396', gray: '#8f9396' };

function parseArtStyle(style) {
  const t = String(style || '').toLowerCase();
  const fm = t.match(/([a-z]+)\s+(?:wood\s+)?frame/);
  const mm = t.match(/([a-z]+)\s+mat\b/);
  const frameless = /frameless|unframed|\bcanvas\b/.test(t) && !fm;
  // what is left after removing frame/mat phrases describes the print itself
  const rest = t.replace(/[a-z]+\s+(?:wood\s+)?frame/g, '').replace(/[a-z]+\s+mat\b/g, '');
  const colors = [];
  for (const w of Object.keys(COLOR_WORDS)) if (new RegExp('\\b' + w + '\\b').test(rest)) colors.push(COLOR_WORDS[w]);
  return {
    frame: frameless ? null : fm ? (FRAME_COLORS[fm[1]] || hex(fm[1], COLOR_WORDS[fm[1]] || '#1d1d1f')) : (/poster/.test(t) ? null : '#f4f2ee'),
    mat: mm ? (COLOR_WORDS[mm[1]] || hex(mm[1], '#f4f1ea')) : null,
    canvas: /\bcanvas\b/.test(t),
    colors,
    text: rest,
  };
}

/** Outer {w, h} (m) that makes buildArt show a printW x printH print: same frame-bar and mat math. */
export function artOuterSize(printW, printH, hasFrame, hasMat) {
  const pw = Math.max(0, num(printW, 0)), ph = Math.max(0, num(printH, 0));
  if (!hasFrame) return { w: pw, h: ph }; // no bars, and buildArt draws a mat only inside a frame
  const p = Math.min(pw, ph);
  const border = m => {
    const fw = clamp(m * 0.06, 0.015, 0.05);
    const mw = hasMat ? Math.min(0.12 * m, (m - 2 * fw) * 0.3) : 0;
    return fw + mw;
  };
  let m = p;
  for (let i = 0; i < 40; i++) m = p + 2 * border(m); // contraction: converges fast
  const b = border(m);
  return { w: pw + 2 * b, h: ph + 2 * b };
}

export function buildArt(spec, ctx, opts = {}) {
  spec = spec && typeof spec === 'object' ? spec : {};
  opts = opts || {};
  const quality = ctx && ctx.quality === 'low' ? 'low' : 'high';
  const st = parseArtStyle(spec.style);
  const w = clamp(num(spec.w, 0.5), 0.05, 4), h = clamp(num(spec.h, 0.6), 0.05, 4);
  const frame = spec.frame === null ? null : spec.frame !== undefined ? hex(spec.frame, st.frame) : st.frame;
  const matColor = spec.mat === null ? null : spec.mat !== undefined ? hex(spec.mat, st.mat) : st.mat;
  const d = clamp(num(spec.d, frame || st.canvas ? 0.03 : 0.012), 0.003, 0.2);
  const id = typeof spec.id === 'string' ? spec.id : 'art_' + slug(spec.style || 'print');
  const env = { ctx, quality, tex: {}, canvases: {}, textures: [], materials: [], geometries: [] };
  const group = new THREE.Group();
  group.name = id;
  const add = (geo, mat, x, y, z, role, cast = true) => {
    geo.translate(x, y, z);
    const m = new THREE.Mesh(geo, mat);
    m.userData.role = role;
    m.castShadow = cast; m.receiveShadow = true;
    env.geometries.push(geo);
    group.add(m);
    return m;
  };
  const stdMat = (color, rough, role) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough });
    m.userData.role = role; env.materials.push(m); return m;
  };

  // print texture: the given image, or a painted placeholder
  const fw = frame ? clamp(Math.min(w, h) * 0.06, 0.015, 0.05) : 0;
  const ow = w - 2 * fw, oh = h - 2 * fw;
  const mw = matColor ? Math.min(0.12 * Math.min(w, h), ow * 0.3, oh * 0.3) : 0;
  const pw = ow - 2 * mw, ph = oh - 2 * mw;
  let printTex = loadImageTexture(opts.image, env);
  let palette = st.colors.length ? st.colors : ['#7d55a8'];
  if (printTex) {
    coverFit(printTex, pw / ph);
  } else {
    const long = quality === 'low' ? 512 : 1024;
    const cw = pw >= ph ? long : Math.max(64, Math.round(long * pw / ph));
    const ch = pw >= ph ? Math.max(64, Math.round(long * ph / pw)) : long;
    const cv = ctx.makeCanvas(cw, ch);
    const c = cv.getContext('2d');
    if (c) palette = paintPrint(c, cw, ch, st, spec.style || '');
    printTex = ctx.canvasTexture(cv, { srgb: true, wrap: 'clamp' });
    env.textures.push(printTex);
  }
  const printMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: st.canvas ? 0.85 : 0.7, map: printTex });
  printMat.userData.role = 'print';
  env.materials.push(printMat);

  if (!frame) {
    // frameless canvas / poster board: a slab with the print on its front face
    const side = stdMat(st.canvas ? palette[0] : '#f4f2ee', 0.85, 'body');
    const back = stdMat('#e9e2d4', 0.9, 'back');
    add(new THREE.BoxGeometry(w, h, d), [side, side, side, side, printMat, back], 0, 0, d / 2, 'print');
  } else {
    const fmat = stdMat(frame, 0.55, 'body');
    const S = segs(quality);
    const rad = Math.min(0.004, fw / 4, d / 4);
    // four frame bars (top/bottom full width, sides between them)
    add(geoRBox(w, fw, d, rad, S.rbox - 1), fmat, 0, h / 2 - fw / 2, d / 2, 'body');
    add(geoRBox(w, fw, d, rad, S.rbox - 1), fmat, 0, -h / 2 + fw / 2, d / 2, 'body');
    add(geoRBox(fw, h - 2 * fw, d, rad, S.rbox - 1), fmat, -w / 2 + fw / 2, 0, d / 2, 'body');
    add(geoRBox(fw, h - 2 * fw, d, rad, S.rbox - 1), fmat, w / 2 - fw / 2, 0, d / 2, 'body');
    // backing board recessed behind the glass, print on top, mat window over it
    const zf = Math.max(0.004, d - 0.008);
    add(new THREE.BoxGeometry(ow, oh, zf), stdMat(matColor || '#f4f2ee', 0.9, 'backing'), 0, 0, zf / 2, 'backing');
    add(new THREE.PlaneGeometry(pw, ph), printMat, 0, 0, zf + 0.0006, 'print', false);
    if (matColor && mw > 0) {
      const mt = 0.0025, mm = stdMat(matColor, 0.92, 'mat'), z = zf + 0.0006 + mt / 2;
      add(new THREE.BoxGeometry(ow, mw, mt), mm, 0, oh / 2 - mw / 2, z, 'mat', false);
      add(new THREE.BoxGeometry(ow, mw, mt), mm, 0, -oh / 2 + mw / 2, z, 'mat', false);
      add(new THREE.BoxGeometry(mw, ph, mt), mm, -ow / 2 + mw / 2, 0, z, 'mat', false);
      add(new THREE.BoxGeometry(mw, ph, mt), mm, ow / 2 - mw / 2, 0, z, 'mat', false);
    }
    // glass: a faint glossy sheet just inside the frame front
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.08, clearcoat: 1, depthWrite: false });
    glass.userData.role = 'glass'; env.materials.push(glass);
    add(new THREE.PlaneGeometry(ow, oh), glass, 0, 0, Math.min(d - 0.001, zf + 0.005), 'glass', false);
  }

  group.userData = {
    kind: 'art',
    id,
    mount: 'wall',
    size: { w, d, h },
    style: spec.style || '',
    frame, mat: matColor,
    setColor(hexColor) { // recolors the frame (or the canvas edge)
      const c = hex(hexColor, null);
      if (!c) return;
      for (const m of env.materials) if (m.userData.role === 'body') m.color.set(c);
    },
    setImage(image) { // swap the print for a photo later
      const t = loadImageTexture(image, env);
      if (!t) return;
      coverFit(t, pw / ph);
      printMat.map = t; printMat.needsUpdate = true;
    },
    dispose() {
      for (const g of env.geometries) g.dispose();
      for (const m of env.materials) m.dispose();
      for (const t of env.textures) t.dispose();
    },
  };
  return group;
}

// Crop a texture like CSS object-fit: cover once its image is known.
function coverFit(t, aspect) {
  const apply = () => {
    const img = t.image;
    const iw = img && (img.naturalWidth || img.videoWidth || img.width), ih = img && (img.naturalHeight || img.videoHeight || img.height);
    if (!iw || !ih) return false;
    const ia = iw / ih;
    if (ia > aspect) { t.repeat.set(aspect / ia, 1); t.offset.set((1 - aspect / ia) / 2, 0); }
    else { t.repeat.set(1, ia / aspect); t.offset.set(0, (1 - ia / aspect) / 2); }
    return true;
  };
  if (!apply()) t.onUpdate = () => { apply(); t.onUpdate = null; };
}

// ---------------------------------------------------------------------------
// Placeholder prints, painted from the style text. Returns the palette used.
// ---------------------------------------------------------------------------
function grad(c, x0, y0, x1, y1, stops, fallback) {
  const g = c.createLinearGradient ? c.createLinearGradient(x0, y0, x1, y1) : null;
  if (g && g.addColorStop) { stops.forEach((s, i) => g.addColorStop(i / Math.max(1, stops.length - 1), s)); c.fillStyle = g; }
  else c.fillStyle = fallback || stops[0];
}
function circle(c, x, y, r, fill) { c.fillStyle = fill; c.beginPath(); c.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); c.fill(); }
function ellipse(c, x, y, rx, ry, rot, fill) { c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, Math.PI * 2); c.fill(); }
function blob(c, x, y, r, fill, rand) { // soft organic shape
  c.fillStyle = fill; c.beginPath();
  const n = 7, pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rr = r * (0.75 + rand() * 0.45); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  for (let i = 0; i <= n; i++) {
    const p0 = pts[i % n], p1 = pts[(i + 1) % n], mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
    i === 0 ? c.moveTo(mx, my) : c.quadraticCurveTo(p0[0], p0[1], mx, my);
  }
  c.closePath(); c.fill();
}
function star(c, x, y, r, fill, points = 5) {
  c.fillStyle = fill; c.beginPath();
  for (let i = 0; i < points * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / points, rr = i % 2 ? r * 0.45 : r; i ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fill();
}
function tri(c, x, y, w, h, fill) { c.fillStyle = fill; c.beginPath(); c.moveTo(x, y - h); c.lineTo(x + w / 2, y); c.lineTo(x - w / 2, y); c.closePath(); c.fill(); }
function shade(hexc, k) { const col = new THREE.Color(hexc); return '#' + (k > 0 ? col.lerp(new THREE.Color('#ffffff'), k) : col.lerp(new THREE.Color('#000000'), -k)).getHexString(); }

function paintPrint(c, W, H, st, style) {
  const t = st.text, rand = rng(hashStr(style || 'art'));
  const s = Math.min(W, H);
  if (/unicorn/.test(t)) {
    const bg = st.colors[0] || COLOR_WORDS.purple;
    grad(c, 0, 0, 0, H, [shade(bg, 0.15), bg, shade(bg, -0.2)], bg); c.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) star(c, rand() * W, rand() * H * 0.9, s * (0.008 + rand() * 0.018), 'rgba(255,255,255,0.75)', i % 3 ? 5 : 4);
    circle(c, W * 0.8, H * 0.15, s * 0.07, 'rgba(255,248,220,0.9)');
    drawUnicorn(c, W / 2, H * 0.58, s * 0.9);
    // little grass hill
    ellipse(c, W / 2, H * 1.02, W * 0.7, H * 0.12, 0, shade(bg, -0.3));
    return [bg, '#ffffff'];
  }
  if (/night|space|ufo|moon|galax|alone|\bstar/.test(t) || (/poster/.test(t) && !st.colors.length && !/print|illustrat/.test(t))) {
    // night scene: gradient sky, stars, pine silhouettes and a saucer beam (matches the poster in the room photos)
    const sky = st.colors[0] || '#3b2f6b';
    grad(c, 0, 0, 0, H, ['#151a3a', sky, '#7a5ea8', '#e0a8c0'], sky); c.fillRect(0, 0, W, H);
    for (let i = 0; i < 80; i++) circle(c, rand() * W, rand() * H * 0.6, s * (0.002 + rand() * 0.004), 'rgba(255,255,255,0.85)');
    c.fillStyle = 'rgba(255,250,200,0.28)'; c.beginPath();
    c.moveTo(W * 0.46, H * 0.3); c.lineTo(W * 0.54, H * 0.3); c.lineTo(W * 0.72, H * 0.8); c.lineTo(W * 0.28, H * 0.8); c.closePath(); c.fill();
    ellipse(c, W * 0.5, H * 0.29, W * 0.13, H * 0.025, 0, '#c9cfd8');
    ellipse(c, W * 0.5, H * 0.27, W * 0.05, H * 0.03, 0, '#9fd8c9');
    for (let i = 0; i < 14; i++) {
      const x = (i + rand() * 0.6) / 13 * W, hh = H * (0.18 + rand() * 0.2);
      for (let k = 0; k < 3; k++) tri(c, x, H * 0.95 - k * hh * 0.25, s * (0.16 - k * 0.035), hh * 0.55, '#13241f');
    }
    c.fillStyle = '#0d1a16'; c.fillRect(0, H * 0.93, W, H * 0.07);
    return [sky, '#13241f'];
  }
  if (/pink|red|coral|warm/.test(t) && /poster/.test(t)) {
    const a = st.colors.includes(COLOR_WORDS.pink) ? COLOR_WORDS.pink : '#f6b3c4', b = st.colors.includes(COLOR_WORDS.red) ? COLOR_WORDS.red : '#d9534f';
    grad(c, 0, 0, 0, H, [shade(a, 0.4), a, b], a); c.fillRect(0, 0, W, H);
    circle(c, W * 0.5, H * 0.42, s * 0.22, 'rgba(255,240,215,0.85)');
    ellipse(c, W * 0.3, H * 0.98, W * 0.6, H * 0.22, 0, shade(b, -0.35));
    ellipse(c, W * 0.8, H, W * 0.5, H * 0.17, 0, shade(b, -0.5));
    c.strokeStyle = shade(b, -0.55); c.lineWidth = Math.max(1, s * 0.008); c.lineCap = 'round';
    for (let i = 0; i < 6; i++) { // little birds
      const x = W * (0.2 + rand() * 0.6), y = H * (0.12 + rand() * 0.3), r = s * (0.02 + rand() * 0.02);
      c.beginPath(); c.moveTo(x - r, y); c.quadraticCurveTo(x - r / 2, y - r * 0.6, x, y); c.quadraticCurveTo(x + r / 2, y - r * 0.6, x + r, y); c.stroke();
    }
    for (let i = 0; i < 3; i++) { const x = W * (0.15 + i * 0.3 + rand() * 0.1), y = H * 0.82; c.fillStyle = shade(b, -0.6); c.fillRect(x - s * 0.006, y - s * 0.12, s * 0.012, s * 0.12); circle(c, x, y - s * 0.13, s * 0.05, shade(b, -0.6)); }
    return [a, b];
  }
  if (/landscape|forest|tree|small print/.test(t) && !/illustrat|colorful/.test(t)) {
    grad(c, 0, 0, 0, H, ['#dfeef2', '#f6efd9'], '#e9efe6'); c.fillRect(0, 0, W, H);
    circle(c, W * 0.72, H * 0.25, s * 0.09, '#f6d36b');
    const greens = st.colors.length ? st.colors : ['#a3b899', '#7fb77e', '#55805a'];
    greens.forEach((g, i) => ellipse(c, W * (0.2 + i * 0.35), H * (0.85 + i * 0.05), W * 0.6, H * (0.3 - i * 0.04), 0, g));
    for (let i = 0; i < 6; i++) { const x = rand() * W, y = H * (0.6 + rand() * 0.15); c.fillStyle = '#6b4a33'; c.fillRect(x - s * 0.008, y, s * 0.016, s * 0.08); circle(c, x, y, s * (0.04 + rand() * 0.03), greens[i % greens.length]); }
    return greens;
  }
  // default: soft illustrated pastel blobs (e.g. "colorful illustrated print")
  const pal = st.colors.length >= 2 ? st.colors : ['#f2a7bf', '#a9d3c9', '#f6d36b', '#c8b6dc', '#a8d0ec', '#f7c6a3'];
  grad(c, 0, 0, 0, H, ['#fbf6ec', '#f3ead8'], '#f8f2e6'); c.fillRect(0, 0, W, H);
  blob(c, W * 0.5, H * 1.05, s * 0.55, shade(pal[1 % pal.length], -0.05), rand);
  blob(c, W * 0.15, H * 0.95, s * 0.35, pal[0], rand);
  circle(c, W * 0.75, H * 0.25, s * 0.12, pal[2 % pal.length]);
  for (let i = 0; i < 9; i++) blob(c, W * (0.1 + rand() * 0.8), H * (0.2 + rand() * 0.5), s * (0.05 + rand() * 0.1), pal[i % pal.length] + 'cc', rand);
  for (let i = 0; i < 7; i++) { // tiny flowers
    const x = W * (0.08 + rand() * 0.84), y = H * (0.72 + rand() * 0.22), r = s * 0.018, col = pal[(i + 3) % pal.length];
    for (let k = 0; k < 5; k++) circle(c, x + Math.cos(k * 1.256) * r, y + Math.sin(k * 1.256) * r, r * 0.75, col);
    circle(c, x, y, r * 0.6, '#fff6d6');
  }
  return pal;
}

// Simple white unicorn silhouette facing right, centered on (x, y), size ~s.
function drawUnicorn(c, x, y, s) {
  const u = s / 2, white = '#fbf8f4';
  const leg = (lx, ly) => { c.fillStyle = white; c.fillRect(lx - u * 0.035, ly, u * 0.07, u * 0.32); };
  leg(x - u * 0.28, y + u * 0.05); leg(x - u * 0.16, y + u * 0.07); leg(x + u * 0.14, y + u * 0.07); leg(x + u * 0.26, y + u * 0.05);
  ellipse(c, x, y, u * 0.38, u * 0.2, 0, white);                     // body
  c.fillStyle = white; c.beginPath();                                  // neck
  c.moveTo(x + u * 0.2, y - u * 0.12); c.lineTo(x + u * 0.36, y - u * 0.48); c.lineTo(x + u * 0.5, y - u * 0.4); c.lineTo(x + u * 0.36, y - u * 0.02); c.closePath(); c.fill();
  ellipse(c, x + u * 0.47, y - u * 0.46, u * 0.15, u * 0.09, 0.45, white); // head
  tri(c, x + u * 0.42, y - u * 0.55, u * 0.06, u * 0.22, '#f3d27a');    // horn
  const rainbow = ['#f2a7bf', '#c8b6dc', '#a8d0ec', '#a9d3c9', '#f6d36b'];
  for (let i = 0; i < 6; i++) circle(c, x + u * (0.33 - i * 0.03), y - u * (0.5 - i * 0.075), u * 0.055, rainbow[i % 5]); // mane
  for (let i = 0; i < 6; i++) circle(c, x - u * (0.4 + i * 0.03), y - u * (0.05 - i * 0.06), u * 0.06, rainbow[(i + 2) % 5]); // tail
  circle(c, x + u * 0.5, y - u * 0.49, u * 0.015, '#3a2f4a');            // eye
}
