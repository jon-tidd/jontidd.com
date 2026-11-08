// App state: what's in the room, where, and every finish choice.
// Plain JSON so it can be saved locally, shared as a version, and undone.

export const FT = 0.3048;
export const IN = 0.0254;

export function fmtFtIn(m) {
  const totalIn = Math.round(m / IN);
  const ft = Math.floor(totalIn / 12);
  const inch = totalIn - ft * 12;
  if (!ft) return `${inch}″`;
  return inch ? `${ft}′ ${inch}″` : `${ft}′`;
}

export const WALL_IDS = ['north', 'east', 'south', 'west'];
export const WALL_NAMES = { north: 'Window wall', east: 'Bed wall', south: 'Door wall (stars)', west: 'Closet wall' };

const ART_IDS = ['art_east_1', 'art_east_2', 'art_north_1', 'art_north_2', 'art_west_1'];

export const DEFAULT_LIGHTING = {
  time: 0.42,          // 0 early morning … 0.5 midday … 0.85 sunset … 1 night
  ceilingOn: false,   // daytime; switches on when the slider reaches evening
  ceilingLevel: 0.6,
  warmth: 2700,        // kelvin
  exposure: 1.1,
  lampsOn: true,
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }

export function rugKey(sizeFt) { return `${sizeFt[0]}x${sizeFt[1]}`; }

export function defaultRugCenter(room, sizeFt) {
  const centers = room.new_items.rug_default_centers;
  // Landscape sizes like [7, 5] share the portrait entry '5x7'.
  const c = centers[rugKey(sizeFt)] || centers[rugKey([...sizeFt].sort((a, b) => a - b))] || centers['5x7'];
  return { x: c.x, z: c.z };
}

/** Clamp a rug center so a rug of sizeFt turned by yaw degrees stays inside the room. */
export function clampRugCenter(room, sizeFt, x, z, yaw = 0) {
  const r = room.room;
  const w = sizeFt[0] * FT, d = sizeFt[1] * FT;
  const a = (yaw || 0) * Math.PI / 180, co = Math.abs(Math.cos(a)), si = Math.abs(Math.sin(a));
  const hx = (w / 2) * co + (d / 2) * si, hz = (w / 2) * si + (d / 2) * co;
  const cx = Math.min(Math.max(x, r.x_west + hx), r.x_east - hx);
  const cz = Math.min(Math.max(z, r.z_south + hz), r.z_north - hz);
  return { x: (2 * hx > r.interior_width_x) ? 0 : cx, z: (2 * hz > r.interior_depth_z) ? 0 : cz };
}

function furnitureItems(room, layoutName) {
  const layout = room.layouts[layoutName];
  return room.furniture.map(f => {
    const pos = (layoutName === 'as_scanned' && f.scan_position) ? f.scan_position : f;
    return {
      uid: f.id,
      type: f.id === 'twin_bed' ? 'bed' : 'furniture',
      ref: f.id,
      x: pos.x, z: pos.z, yaw: pos.yaw ?? f.yaw,
      removed: !layout.present.includes(f.id),
    };
  });
}

function artItems(room) {
  return room.finishes.wall_art.items.map((a, i) => ({
    uid: `art${i + 1}`,
    type: 'wall',
    ref: ART_IDS[i],
    wall: a.wall,
    along: a.wall === 'north' || a.wall === 'south' ? a.x : a.z,
    y: a.y,
    removed: false,
  }));
}

export function makeDefaultState(room) {
  const pA = room.presets.A;
  const rugCenter = defaultRugCenter(room, pA.rug_size_ft);
  const state = {
    v: 1,
    wallColors: { north: pA.wall_color, east: pA.wall_color, south: pA.wall_color, west: pA.wall_color },
    paintColor: pA.wall_color,
    paintScope: 'all',
    decals: pA.decals,
    curtains: pA.curtains,
    curtainColor: null,          // null = the original navy star fabric
    artVisible: true,
    fanVisible: true,
    bedding: pA.bedding,
    bedSize: 'twin',
    lighting: clone(DEFAULT_LIGHTING),
    layout: 'planned',
    preset: 'A',
    items: [
      ...furnitureItems(room, 'planned'),
      { uid: 'rug', type: 'rug', kind: pA.rug, sizeFt: [...pA.rug_size_ft], x: rugCenter.x, z: rugCenter.z, yaw: 0, removed: false, moved: false },
      ...artItems(room),
    ],
  };
  applyPreset(room, state, 'A');
  return state;
}


/** Bed width for a size ('twin' | 'full') from room.json size_options. */
export function bedWidth(room, size) {
  const bed = room.furniture.find(f => f.id === 'twin_bed');
  return bed.size_options?.[size]?.w ?? bed.w;
}

/** Change the new bed's size, keeping the long side that's against a wall in place. */
export function resizeBed(room, state, size) {
  const bed = state.items.find(i => i.uid === 'twin_bed');
  const oldW = bedWidth(room, state.bedSize || 'twin'), newW = bedWidth(room, size);
  state.bedSize = size;
  if (!bed || oldW === newW) return;
  const r = room.room, a = (bed.yaw || 0) * Math.PI / 180;
  const ux = Math.cos(a), uz = -Math.sin(a);            // bed-local +X in world
  const nearWall = sgn => {
    const x = bed.x + ux * oldW / 2 * sgn, z = bed.z + uz * oldW / 2 * sgn;
    return x < r.x_west + 0.05 || x > r.x_east - 0.05 || z < r.z_south + 0.05 || z > r.z_north - 0.05;
  };
  const shift = nearWall(-1) && !nearWall(1) ? 1 : nearWall(1) && !nearWall(-1) ? -1 : 0;
  const dw = (newW - oldW) / 2 * shift;
  bed.x += ux * dw; bed.z += uz * dw;
  // keep it inside the room
  const d = room.furniture.find(f => f.id === 'twin_bed').d;
  const hx = newW / 2 * Math.abs(Math.cos(a)) + d / 2 * Math.abs(Math.sin(a));
  const hz = newW / 2 * Math.abs(Math.sin(a)) + d / 2 * Math.abs(Math.cos(a));
  bed.x = Math.min(Math.max(bed.x, r.x_west + hx), r.x_east - hx);
  bed.z = Math.min(Math.max(bed.z, r.z_south + hz), r.z_north - hz);
}

/** Apply one of the JSON presets: finishes, plus the bed size and anything the preset takes out. */
export function applyPreset(room, state, key) {
  const p = room.presets[key];
  if (!p) return;
  for (const w of WALL_IDS) {
    if (p.paint_scope === 'all') state.wallColors[w] = p.wall_color;
  }
  state.paintColor = p.wall_color;
  state.paintScope = p.paint_scope;
  state.decals = p.decals;
  state.curtains = p.curtains;
  state.artVisible = p.wall_art;
  if (p.bedding !== 'unchanged') state.bedding = p.bedding;
  // A preset shows the products as they come: drop custom curtain, sheet, comforter and rug colors.
  state.curtainColor = null;
  for (const it of state.items) {
    if (it.type === 'rug') delete it.color;
    delete it.sheetColor;
    delete it.comforterColor;
  }
  if (p.bed_size) resizeBed(room, state, p.bed_size);
  for (const id of p.remove || []) {
    const it = state.items.find(i => i.uid === id);
    if (it) it.removed = true;
  }
  const rug = state.items.find(i => i.uid === 'rug');
  if (rug) {
    rug.removed = false;
    rug.kind = p.rug;
    if (p.rug === 'navy_shag_current') {
      const shag = room.new_items.rug_options.find(r => r.id === 'navy_shag_current');
      rug.sizeFt = [...shag.size_ft];
      if (!rug.moved) { rug.x = shag.center.x; rug.z = shag.center.z; rug.yaw = 0; }
    } else {
      rug.sizeFt = [...p.rug_size_ft];
      if (!rug.moved) { const c = defaultRugCenter(room, rug.sizeFt); rug.x = c.x; rug.z = c.z; rug.yaw = 0; }
    }
    const c = clampRugCenter(room, rug.sizeFt, rug.x, rug.z, rug.yaw);
    rug.x = c.x; rug.z = c.z;
  }
  state.preset = key;
}

/** Furniture layouts from the JSON. Custom items go to the Removed list so nothing is lost. */
export function applyLayout(room, state, name) {
  const fresh = furnitureItems(room, name);
  for (const f of fresh) {
    const cur = state.items.find(i => i.uid === f.uid);
    if (cur) Object.assign(cur, { x: f.x, z: f.z, yaw: f.yaw, removed: f.removed });
    else state.items.push(f);
  }
  const art = artItems(room);
  for (const a of art) {
    const cur = state.items.find(i => i.uid === a.uid);
    if (cur) Object.assign(cur, { wall: a.wall, along: a.along, y: a.y, removed: false });
    else state.items.push(a);
  }
  for (const it of state.items) {
    if (it.type === 'catalog' || it.type === 'custom') it.removed = true;
  }
  const rug = state.items.find(i => i.uid === 'rug');
  if (rug) {
    rug.moved = false; rug.yaw = 0; rug.removed = false;
    let c;
    if (rug.kind === 'navy_shag_current') c = room.new_items.rug_options.find(r => r.id === 'navy_shag_current').center;
    else c = defaultRugCenter(room, rug.sizeFt);
    const cc = clampRugCenter(room, rug.sizeFt, c.x, c.z, 0);
    rug.x = cc.x; rug.z = cc.z;
  }
  state.layout = name;
  // Layout positions are for a twin bed: re-apply the chosen size so a full bed stays clear of the wall.
  const size = state.bedSize || 'twin';
  state.bedSize = 'twin';
  resizeBed(room, state, size);
}

/** Make sure a state loaded from storage or a shared version has every field we expect. */
export function normalizeState(room, s) {
  const d = makeDefaultState(room);
  if (!s || typeof s !== 'object' || !Array.isArray(s.items)) return d;
  const out = Object.assign(d, clone(s));
  out.lighting = Object.assign(clone(DEFAULT_LIGHTING), s.lighting || {});
  out.wallColors = Object.assign(d.wallColors, s.wallColors || {});
  const pr = room.presets[out.preset];
  if (pr && pr.paint_scope === 'all' && WALL_IDS.some(w => (out.wallColors[w] || '').toLowerCase() !== pr.wall_color.toLowerCase())) out.preset = null;
  // Furniture that exists in the JSON but is missing from an old save comes back as removed.
  for (const f of room.furniture) {
    if (!out.items.some(i => i.uid === f.id)) {
      out.items.push({ uid: f.id, type: f.id === 'twin_bed' ? 'bed' : 'furniture', ref: f.id, x: f.x, z: f.z, yaw: f.yaw, removed: true });
    }
  }
  if (!out.items.some(i => i.uid === 'rug')) {
    const c = defaultRugCenter(room, [5, 7]);
    out.items.push({ uid: 'rug', type: 'rug', kind: 'beige_scalloped', sizeFt: [5, 7], x: c.x, z: c.z, yaw: 0, removed: true, moved: false });
  }
  return out;
}

/** Undo/redo over whole-state JSON snapshots. */
export class History {
  constructor(limit = 80) { this.limit = limit; this.past = []; this.future = []; }
  push(state) {
    const snap = typeof state === 'string' ? state : JSON.stringify(state);
    if (this.past[this.past.length - 1] === snap) return;
    this.past.push(snap);
    if (this.past.length > this.limit) this.past.shift();
    this.future.length = 0;
  }
  undo(current) {
    if (!this.past.length) return null;
    this.future.push(JSON.stringify(current));
    return JSON.parse(this.past.pop());
  }
  redo(current) {
    if (!this.future.length) return null;
    this.past.push(JSON.stringify(current));
    return JSON.parse(this.future.pop());
  }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
}

let uidCounter = 0;
export function newUid(prefix = 'item') {
  uidCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${uidCounter}`;
}

/** 0..1 slider value -> clock label (7 am .. 9 pm). */
export function timeLabel(t) {
  const hours = 7 + t * 14;
  const h = Math.floor(hours), m = Math.round((hours - h) * 60 / 15) * 15;
  const hh = (h + (m === 60 ? 1 : 0));
  const mm = m === 60 ? 0 : m;
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'pm' : 'am'}`;
}
