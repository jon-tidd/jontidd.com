import { fmtFtIn, WALL_IDS, WALL_NAMES, FT, clampRugCenter, defaultRugCenter, DEFAULT_LIGHTING, timeLabel } from './state.js';

const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
};
const sec = (title, aside, ...kids) => h('section', { class: 'sec' }, h('h2', {}, title, aside ? h('span', { class: 'aside' }, aside) : null), ...kids);
const ICON = {
  ccw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  cw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4.5-4.5L8 19"/><path d="M17 3v6M14 6h6"/></svg>',
};
// rug sizes match whichever way round they are
const sameSize = (a, b) => Math.min(...a) === Math.min(...b) && Math.max(...a) === Math.max(...b);
const iconBtn = (svg, label, onclick, cls = 'btn') => { const b = h('button', { class: cls, onclick, 'aria-label': label, title: label }); b.innerHTML = svg; return b; };
const withId = (el, id) => { el.id = id; return el; };

// Colors offered on the selection card for furniture
// [name, hex]; the first entry is what the product looks like as bought
const CURTAIN_COLORS = [['Navy (as bought)', '#1f2547'], ['White', '#f4f2ee'], ['Ballerina pink', '#f0dee0'], ['Blush', '#e6bfc5'], ['Lavender', '#cdbbe3'], ['Dusty mauve', '#ae96b0'], ['Sage', '#b7c9ad'], ['Soft grey', '#a3a8ad'], ['Plum', '#5e3a5c']];
const SHEET_COLORS = [['White', '#f6f4ef'], ['Ballerina pink', '#f0dee0'], ['Blush', '#e6bfc5'], ['Lilac', '#d3c6e2'], ['Dusty mauve', '#ae96b0'], ['Pale blue', '#cfdde8'], ['Sage', '#c6d6bd'], ['Soft grey', '#c4c6c9'], ['Butter yellow', '#f2e3a8']];
const RUG_COLORS = [['Cream', '#eee5d3'], ['Oatmeal', '#d8c8ae'], ['Ballerina pink', '#f0dee0'], ['Blush', '#e2b8bf'], ['Lilac', '#cdbbe3'], ['Sage', '#b7c9ad'], ['Soft grey', '#a7a9ac'], ['Pale blue', '#b9cfdf'], ['Navy', '#1f2547']];
const ITEM_COLORS = ['#ffffff', '#efe9e1', '#d9cfc2', '#b3b7bb', '#8c9196', '#5b6067', '#33363b', '#c9a27a', '#9a6b43', '#e8c9d0', '#cdb8e6', '#a9c7d8', '#b9d3b0'];

export class UI {
  constructor(app) {
    this.app = app;
    this.panes = {
      look: document.getElementById('pane-look'),
      things: document.getElementById('pane-things'),
      light: document.getElementById('pane-light'),
      saved: document.getElementById('pane-saved'),
    };
    this.card = document.getElementById('card');
    this.setupTabs();
    this.setupViewbar();
    this.setupSheet();
    document.getElementById('roomlabel').textContent = app.room.room.label.replace(/ x /, ' × ');
  }

  // ------------------------------------------------------------------ chrome
  setupTabs() {
    const tabs = [...document.querySelectorAll('#tabs [role="tab"]')];
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.setAttribute('aria-selected', String(x === t)));
      for (const [k, el] of Object.entries(this.panes)) el.hidden = `tab-${k}` !== t.id;
      document.getElementById('panel').classList.remove('collapsed');
      this.syncSheetVar();
    }));
  }

  setupViewbar() {
    document.querySelectorAll('#viewbar [data-view]').forEach(b => b.addEventListener('click', () => this.app.setView(b.dataset.view)));
    document.getElementById('undo').addEventListener('click', () => this.app.undo());
    document.getElementById('redo').addEventListener('click', () => this.app.redo());
    document.getElementById('snap').addEventListener('click', () => this.app.saveImage());
  }

  renderViewbar() {
    document.querySelectorAll('#viewbar [data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === this.app.view)));
    document.getElementById('undo').disabled = !this.app.history.canUndo;
    document.getElementById('redo').disabled = !this.app.history.canRedo;
  }

  setupSheet() {
    const panel = document.getElementById('panel');
    const grab = document.getElementById('grab');
    const narrow = () => matchMedia('(max-width: 820px), (max-aspect-ratio: 4/5)').matches;
    let start = null, dragEnd = 0;
    grab.addEventListener('pointerdown', e => { start = { y: e.clientY, h: panel.getBoundingClientRect().height, moved: false }; grab.setPointerCapture(e.pointerId); });
    grab.addEventListener('pointermove', e => {
      if (!start) return;
      const dy = start.y - e.clientY;
      if (Math.abs(dy) > 4) start.moved = true;
      if (!start.moved) return;
      panel.classList.remove('collapsed');
      // keep room for the selection card while one is open
      const hh = Math.min(window.innerHeight * (this.card.hidden ? 0.85 : 0.6), Math.max(110, start.h + dy));
      panel.style.setProperty('--sheet-h', `${hh}px`);
      panel.style.transition = 'none';
      this.syncSheetVar();
    });
    const end = () => {
      panel.style.transition = '';
      if (start?.moved) {
        dragEnd = performance.now(); // the click that follows a drag is not a toggle
        if (panel.getBoundingClientRect().height < 150) { panel.classList.add('collapsed'); panel.style.removeProperty('--sheet-h'); }
      }
      start = null;
      setTimeout(() => this.syncSheetVar(), 240);
    };
    grab.addEventListener('pointerup', end);
    grab.addEventListener('pointercancel', end);
    // tap, Enter or Space opens / closes the sheet
    grab.addEventListener('click', () => {
      if (performance.now() - dragEnd < 400) return;
      panel.classList.toggle('collapsed');
      this.syncSheetVar();
      setTimeout(() => this.syncSheetVar(), 240);
    });
    if (narrow()) panel.classList.add('collapsed');
    window.addEventListener('resize', () => {
      const v = parseFloat(panel.style.getPropertyValue('--sheet-h'));
      if (v) panel.style.setProperty('--sheet-h', `${Math.max(110, Math.min(v, window.innerHeight * 0.85))}px`);
      this.syncSheetVar();
    });
    new ResizeObserver(() => this.syncSheetVar()).observe(panel);
    this.syncSheetVar();
  }

  syncSheetVar() {
    const panel = document.getElementById('panel');
    const narrow = matchMedia('(max-width: 820px), (max-aspect-ratio: 4/5)').matches;
    document.documentElement.style.setProperty('--sheet-px', narrow ? `${panel.getBoundingClientRect().height}px` : '0px');
    document.getElementById('grab').setAttribute('aria-expanded', String(!panel.classList.contains('collapsed')));
  }

  toast(text, { action, onAction, ms = 3200 } = {}) {
    const wrap = document.getElementById('toasts');
    const t = h('div', { class: 'toast' }, text);
    if (action) {
      const b = h('button', { class: 'btn', style: { marginLeft: '10px', padding: '2px 9px', pointerEvents: 'auto' }, onclick: () => { onAction?.(); t.remove(); } }, action);
      t.append(b);
      t.style.pointerEvents = 'auto';
    }
    wrap.append(t);
    setTimeout(() => t.remove(), action ? ms + 2500 : ms);
  }

  showShot(blob, name) {
    const box = document.getElementById('shot');
    const url = URL.createObjectURL(blob);
    box.replaceChildren(h('figure', {},
      h('img', { src: url, alt: 'Picture of the current view' }),
      h('figcaption', {}, h('span', {}, 'Press and hold (or right-click) the picture to save or share it.'),
        h('button', { class: 'btn primary', onclick: () => { box.hidden = true; URL.revokeObjectURL(url); } }, 'Done'))));
    box.hidden = false;
    box.onclick = e => { if (e.target === box) { box.hidden = true; URL.revokeObjectURL(url); } };
  }

  renderCaps() {
    const el = document.getElementById('sync');
    const shared = this.app.store.mode === 'shared';
    el.classList.toggle('shared', shared);
    el.lastElementChild.textContent = shared ? 'Shared' : 'On this device';
    el.title = shared ? 'Saved versions and added finds are shared with everyone you share this page with.' : 'Saved versions and finds stay in this browser.';
    this.renderThings();
    this.renderSaved();
  }

  renderAll() {
    this.renderLook();
    this.renderThings();
    this.renderLight();
    this.renderSaved();
    this.renderViewbar();
  }

  // keep scroll position when re-rendering a pane
  fill(pane, ...kids) {
    const sc = document.getElementById('tabpanes');
    const top = sc.scrollTop;
    const focusId = document.activeElement?.id;
    pane.replaceChildren(...kids);
    sc.scrollTop = top;
    if (focusId) { const f = document.getElementById(focusId); if (f && pane.contains(f)) f.focus({ preventScroll: true }); }
  }

  // ------------------------------------------------------------------ Look tab
  renderLook() {
    const app = this.app, s = app.state, room = app.room;
    const presets = h('div', { class: 'presets' }, ...['A', 'B', 'Today'].map(k => {
      const p = room.presets[k];
      const [title, rest] = p.label.split(': ');
      return h('button', { class: 'preset', id: `preset-${k}`, 'aria-pressed': String(s.preset === k), onclick: () => app.applyPreset(k) },
        h('b', {}, k === 'Today' ? 'T' : k), h('span', {}, k === 'Today' ? 'Today' : `Version ${k}`), h('small', {}, rest || title));
    }));

    // Paint
    const palette = [['Current blue', room.finishes.current_wall_color[1]], ...room.finishes.pink_wall_palette];
    const scope = s.paintScope || 'all';
    const targetWalls = scope === 'all' ? WALL_IDS : scope === 'accent_south' ? ['south'] : ['north', 'east', 'west'];
    const isOn = hex => targetWalls.every(w => (s.wallColors[w] || '').toLowerCase() === hex.toLowerCase());
    const paintSt = (st, hex) => { for (const w of targetWalls) st.wallColors[w] = hex; st.paintColor = hex; st.preset = null; };
    const paint = (hex) => app.change(st => paintSt(st, hex), { items: false });
    const chips = h('div', { class: 'chips' },
      ...palette.map(([name, hex], i) => h('button', { class: 'chip', id: `chip-${i}`, 'aria-pressed': String(isOn(hex)), onclick: () => paint(hex), title: `${name} ${hex}` },
        h('i', { style: { background: hex } }), h('span', {}, name, h('em', {}, hex.toUpperCase())))),
      h('label', { class: 'chip custom', title: 'Pick any color' },
        h('span', {}, 'Any color', h('em', {}, 'pick…')),
        h('input', { type: 'color', id: 'paint-custom', value: s.paintColor || '#edc0c4', ...this.colorPicker(paintSt, { finishes: true }) })));
    const scopeSeg = h('div', { class: 'segline', role: 'group', 'aria-label': 'Which walls to paint' },
      ...[['all', 'All walls'], ['accent_south', 'Star wall only'], ['others', 'Other three']].map(([k, label]) =>
        h('button', { id: `scope-${k}`, 'aria-pressed': String(scope === k), onclick: () => app.change(st => { st.paintScope = k; }, { items: false, history: false }) }, label)));
    const wallDots = h('div', { class: 'swatches', style: { gap: '10px' } }, ...WALL_IDS.map(w =>
      h('button', { class: 'btn', style: { padding: '4px 8px', fontWeight: 500, fontSize: '12px' }, onclick: () => app.editor.select(`wall:${w}`), title: `Paint only the ${WALL_NAMES[w].toLowerCase()}` },
        h('i', { style: { width: '12px', height: '12px', borderRadius: '3px', background: s.wallColors[w], boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.15)', display: 'inline-block' } }), WALL_NAMES[w].replace(' (stars)', ''))));

    const toggles = h('div', { class: 'toggles' },
      this.toggle('t-decals', 'Star decals + ALICE', s.decals, v => app.change(st => { st.decals = v; st.preset = null; }, { items: false })),
      this.toggle('t-curtains', 'Star curtains', s.curtains, v => app.change(st => { st.curtains = v; st.preset = null; }, { items: false })),
      this.toggle('t-art', 'Wall art', s.artVisible, v => app.change(st => { st.artVisible = v; })),
      this.toggle('t-fan', 'Ceiling fan', s.fanVisible, v => app.change(st => { st.fanVisible = v; }, { items: false }), 'hidden in Dollhouse & Plan'));
    const curtainColor = s.curtains ? this.curtainColorRow('look-curt') : null;

    // Bedding
    const bed = s.items.find(i => i.uid === 'twin_bed');
    const bedOpts = [
      ['lavender_pompom', 'Lavender pom-pom', 'thumbs/bedding_lavender.jpg', 'Solid lilac, ball fringe'],
      ['floral_purple_sheets', 'Floral + mauve sheets', 'thumbs/bedding_floral.jpg', 'Watercolor flowers'],
      ['none', 'Plain white sheet', null, 'See the frame'],
    ];
    const bedding = h('div', { class: 'cards' }, ...bedOpts.map(([id, name, pic, sub]) =>
      h('button', { class: 'ocard', id: `bedding-${id}`, 'aria-pressed': String(s.bedding === id), onclick: () => this.pickBedding(id) },
        h('i', { class: 'pic', style: pic ? { backgroundImage: `url(${pic})` } : { background: 'linear-gradient(#f7f5f2,#e9e4de)' } }),
        h('span', { class: 'txt' }, h('b', {}, name), h('small', {}, sub)))));
    const bedNote = bed?.removed ? h('p', { class: 'note' }, 'The new bed is in the Removed list (Furniture tab).') : null;
    const bedColors = bed && !bed.removed ? this.beddingColorRows(bed, 'look') : [];

    // Rugs
    const rug = s.items.find(i => i.uid === 'rug');
    const customRugs = app.store.catalog.filter(e => e.category === 'rug');
    const rugOpts = [
      ['beige_scalloped', 'Beige scalloped', 'thumbs/rug_beige.jpg', 'Scalloped edge'],
      ['woodland_unicorn', 'Woodland unicorn', 'thumbs/rug_woodland.jpg', 'Cream, animals'],
      ['navy_shag_current', 'Navy shag (today)', null, '4×6, what’s there now'],
    ];
    const setRug = kind => app.change(st => {
      const r = st.items.find(i => i.uid === 'rug');
      r.removed = false;
      if (r.kind !== kind) delete r.color;   // a color means something different on each rug
      r.kind = kind;
      if (kind === 'navy_shag_current') {
        const sh = room.new_items.rug_options.find(o => o.id === 'navy_shag_current');
        r.sizeFt = [...sh.size_ft];
        if (!r.moved) { r.x = sh.center.x; r.z = sh.center.z; r.yaw = 0; }
      } else {
        if (kind.startsWith('custom:')) { const e = app.catalogEntry(kind.slice(7)); if (e?.sizeFt) r.sizeFt = [...e.sizeFt]; }
        else if (r.sizeFt[0] === 4 && r.sizeFt[1] === 6 && rug.kind === 'navy_shag_current') r.sizeFt = [5, 7];
        if (!r.moved) { const c = defaultRugCenter(room, r.sizeFt); r.x = c.x; r.z = c.z; r.yaw = 0; }
      }
      const c = clampRugCenter(room, r.sizeFt, r.x, r.z, r.yaw);
      r.x = c.x; r.z = c.z;
      st.preset = null;
    });
    const rugCards = h('div', { class: 'cards' },
      ...rugOpts.map(([id, name, pic, sub]) => h('button', { class: 'ocard', id: `rug-${id}`, 'aria-pressed': String(!rug.removed && rug.kind === id), onclick: () => setRug(id) },
        h('i', { class: 'pic', style: pic ? { backgroundImage: `url(${pic})` } : { background: 'radial-gradient(circle at 30% 30%, #34407a, #1f2547 70%)' } }),
        h('span', { class: 'txt' }, h('b', {}, name), h('small', {}, sub)))),
      ...customRugs.map(e => {
        const card = h('button', { class: 'ocard', id: `rug-c-${e.id}`, 'aria-pressed': String(!rug.removed && rug.kind === `custom:${e.id}`), onclick: () => setRug(`custom:${e.id}`) },
          h('i', { class: 'pic' }), h('span', { class: 'txt' }, h('b', {}, e.name || 'Rug'), h('small', {}, `${(e.sizeFt || [5, 7]).join('×')} ft · your find`)));
        app.store.imageUrl(e.image).then(u => { if (u) card.querySelector('.pic').style.backgroundImage = `url("${u}")`; });
        return card;
      }),
      h('button', { class: 'ocard', id: 'rug-none', 'aria-pressed': String(rug.removed), onclick: () => app.change(st => { st.items.find(i => i.uid === 'rug').removed = true; st.preset = null; }) },
        h('i', { class: 'pic', style: { background: 'repeating-linear-gradient(90deg,#c98e55 0 14px,#bd8249 14px 15px)' } }), h('span', { class: 'txt' }, h('b', {}, 'No rug'), h('small', {}, 'Bare oak floor'))));
    const isShag = rug.kind === 'navy_shag_current';
    const sizeSeg = h('div', { class: 'segline', role: 'group', 'aria-label': 'Rug size' },
      ...this.rugSizes(rug).map(({ sz, label }) => h('button', { id: `rugsize-${sz.join('x')}`, disabled: rug.removed, 'aria-pressed': String(sameSize(rug.sizeFt, sz)),
        onclick: () => this.setRugSize(sz, true) }, label)));

    this.fill(this.panes.look,
      sec('Quick versions', null, presets),
      sec('Wall paint', 'tap a wall to paint just that one', h('div', { style: { display: 'grid', gap: '8px' } }, scopeSeg, chips, wallDots)),
      sec('On the walls', null, toggles, curtainColor),
      sec('Bed & bedding', null, this.bedSizeSeg('bedsize'), bedding, ...bedColors, bedNote),
      sec('Rug', rug.removed ? null : app.rugName(rug), rugCards, sizeSeg, rug.removed ? null : this.rugColorRow(rug, 'look-rug'), isShag ? h('p', { class: 'note' }, 'The navy shag in the room now is 4×6. Other sizes show what a bigger one would look like.') : null),
    );
  }

  /** Size buttons for a rug. A photo rug keeps its photo's orientation and also offers its own size. */
  rugSizes(rug, short = false) {
    const ft = short ? '' : ' ft';
    let sizes = [[4, 6], [5, 7], [6, 9], [8, 10]].map(sz => ({ sz, label: `${sz[0]}×${sz[1]}${ft}` }));
    if (!rug.kind?.startsWith('custom:')) return sizes;
    const orig = this.app.catalogEntry(rug.kind.slice(7))?.sizeFt;
    const ref = orig || rug.sizeFt;
    if (ref[0] > ref[1]) sizes = sizes.map(({ sz, label }) => ({ sz: [sz[1], sz[0]], label: `${sz[1]}×${sz[0]}${ft}` }));
    if (orig) {
      const own = { sz: [...orig], label: `${orig[0]}×${orig[1]} (as bought)` };
      const i = sizes.findIndex(o => sameSize(o.sz, orig));
      if (i >= 0) sizes[i] = own; else sizes.push(own);
    }
    return sizes;
  }

  setRugSize(sz, recenter) {
    const room = this.app.room;
    this.app.change(st => {
      const r = st.items.find(i => i.uid === 'rug');
      r.sizeFt = [...sz];
      if (recenter && !r.moved) { const c = defaultRugCenter(room, [...sz].sort((a, b) => a - b)); r.x = c.x; r.z = c.z; }
      const c = clampRugCenter(room, sz, r.x, r.z, r.yaw); r.x = c.x; r.z = c.z;
      st.preset = null;
    });
  }

  /** Twin / Full switch for the new bed. */
  bedSizeSeg(idPrefix) {
    const app = this.app, cur = app.state.bedSize || 'twin';
    const opts = app.furnitureSpec('twin_bed')?.size_options || {};
    return h('div', { class: 'segline', role: 'group', 'aria-label': 'Bed size' },
      ...['twin', 'full'].map(k => h('button', { id: `${idPrefix}-${k}`, 'aria-pressed': String(cur === k), title: opts[k]?.mattress_in ? `${opts[k].mattress_in} mattress` : '',
        onclick: () => { if (cur !== k) app.setBedSize(k); } }, k === 'twin' ? 'Twin bed' : 'Full (double) bed')));
  }

  toggle(id, label, value, onchange, note) {
    return h('label', { class: 'toggle', for: id },
      h('input', { type: 'checkbox', role: 'switch', id, checked: !!value, onchange: e => onchange(e.target.checked) }),
      label, note ? h('small', {}, note) : null);
  }

  // ------------------------------------------------------------------ Furniture tab
  renderThings() {
    const app = this.app, s = app.state;
    if (!app.editor) return;
    const sel = app.editor.selectedUid;
    const present = s.items.filter(i => !i.removed);
    const removed = s.items.filter(i => i.removed);
    const dotColor = it => it.color || (it.type === 'rug' ? '#d9cfc2' : (it.type === 'furniture' || it.type === 'bed') ? (app.furnitureSpec(it.ref)?.color || '#999') : (app.catalogEntry(it.ref)?.color || '#c9c2cf'));
    const dims = it => { const d = app.editor.dimsOf(it); return `${fmtFtIn(d.w)} × ${fmtFtIn(app.isWallItem(it) ? d.h : d.d)}`; };
    const order = it => ({ bed: 0, furniture: 1, catalog: 2, rug: 3, wall: 4 })[it.type] ?? 5;

    const inRoom = present.length ? h('div', { class: 'list' }, ...present.slice().sort((a, b) => order(a) - order(b)).map(it =>
      h('div', { class: 'li', 'aria-current': String(sel === it.uid) },
        h('i', { class: 'dot', style: { background: dotColor(it) } }),
        h('button', { class: 'name', id: `sel-${it.uid}`, onclick: () => { app.editor.select(it.uid); } }, app.itemName(it)),
        h('span', { class: 'meta' }, dims(it)),
        h('button', { class: 'mini', onclick: () => app.editor.remove(it.uid), 'aria-label': `Remove ${app.itemName(it)}` }, 'Remove'))))
      : h('p', { class: 'empty' }, 'The room is empty. Restore something below, or add from the list.');

    const removedList = removed.length ? h('div', { class: 'list' }, ...removed.map(it =>
      h('div', { class: 'li' },
        h('i', { class: 'dot', style: { background: dotColor(it), opacity: 0.5 } }),
        h('span', { class: 'name', style: { color: 'var(--ink-2)' } }, app.itemName(it)),
        (it.type === 'catalog' || it.type === 'custom' || (it.type === 'wall' && !/^art\d$/.test(it.uid)))
          ? h('button', { class: 'mini', onclick: () => app.change(st => { st.items = st.items.filter(x => x.uid !== it.uid); }), 'aria-label': `Forget ${app.itemName(it)}` }, 'Forget') : null,
        h('button', { class: 'mini', onclick: () => it.type === 'rug' ? app.change(st => { st.items.find(i => i.uid === 'rug').removed = false; }) : app.editor.restore(it.uid) }, 'Restore'))))
      : h('p', { class: 'empty' }, 'Nothing removed. Removed pieces wait here so you can bring them back.');

    const finds = app.store.catalog.filter(e => e.category !== 'rug');
    const builtin = app.builtinCatalog.filter(e => e.kind !== 'art' && e.category !== 'rug');
    const catBtn = e => {
      const b = h('button', { class: 'citem', id: `add-${e.id}`, onclick: () => app.addFromCatalog(e), title: `Add ${e.name}` },
        h('i', { class: 'ic', style: { background: e.color || '#ddd' } }),
        h('b', {}, e.name), h('small', {}, `${fmtFtIn(e.w || 0.5)} × ${fmtFtIn(e.mount === 'wall' ? (e.h || 0.5) : (e.d || 0.5))}`));
      if (e.image) app.store.imageUrl(e.image).then(u => { if (u) b.querySelector('.ic').style.background = `center/cover url("${u}")`; });
      return b;
    };
    const findsBlock = finds.length ? h('div', { class: 'catalog' }, ...finds.map(catBtn)) : null;
    const readOnly = app.store.canWrite === false;
    const addFind = h('button', { class: 'addfind', id: 'add-find', disabled: readOnly, onclick: () => app.openFind() },
      h('span', { html: ICON.plus }), h('b', {}, 'Add a find from a photo'),
      h('small', {}, app.store.sample && app.store.canSendImages
        ? 'Rug, poster or furniture: Claude turns the photo into something you can place.'
        : 'Rug or poster: straighten the photo and it goes in the room. Furniture becomes a sized block with the photo on it.'));
    addFind.querySelector('span').replaceWith(...h('span', { html: ICON.plus }).childNodes);

    this.fill(this.panes.things,
      sec('Your finds', finds.length ? `${finds.length}` : null, addFind,
        readOnly ? h('p', { class: 'note' }, 'You can look, but only people with edit access can add finds.') : null, findsBlock),
      sec('In the room', `${present.length}`, inRoom),
      sec('Removed', removed.length ? `${removed.length}` : null, removedList),
      sec('Add more', null, h('div', { class: 'catalog' }, ...builtin.map(catBtn))),
      sec('Layout', null,
        h('div', { class: 'saverow' },
          h('button', { class: 'btn', id: 'layout-planned', onclick: () => app.applyLayout('planned') }, 'Reset to the plan'),
          h('button', { class: 'btn', id: 'layout-scanned', onclick: () => app.applyLayout('as_scanned') }, 'Room as it is today')),
        h('p', { class: 'note' }, 'Tip: drag a piece to move it (on a phone or iPad, tap it first). R turns it, Delete removes it, arrow keys nudge an inch.')),
    );
  }

  // ------------------------------------------------------------------ Light tab
  renderLight() {
    const app = this.app, L = app.state.lighting;
    const setL = (patch, history = false) => app.change(st => Object.assign(st.lighting, patch), { history, finishes: false, items: false, lighting: true });
    const slider = (id, label, min, max, step, value, fmt, onInput) => {
      const out = h('output', { for: id }, fmt(value));
      return h('div', { class: 'slider' },
        h('label', { for: id }, label, out),
        h('input', { type: 'range', id, min, max, step, value, oninput: e => { const v = +e.target.value; out.textContent = fmt(v); onInput(v); } }));
    };
    const hasLamps = app.state.items.some(i => !i.removed && app.catalogEntry(i.ref)?.light);
    this.fill(this.panes.light,
      sec('Time of day', null, h('div', { class: 'sky', 'aria-hidden': 'true' }),
        slider('l-time', 'Daylight through the window', 0, 1, 0.01, L.time, timeLabel, v => this.liveLight({ time: v }))),
      sec('Ceiling light', null,
        h('div', { class: 'toggles' }, this.toggle('l-ceil', 'Light on', L.ceilingOn, v => setL({ ceilingOn: v }, true))),
        slider('l-level', 'Brightness', 0.05, 1, 0.01, L.ceilingLevel, v => `${Math.round(v * 100)}%`, v => this.liveLight({ ceilingLevel: v })),
        slider('l-warm', 'Bulb color', 2200, 5000, 100, L.warmth, v => `${v} K · ${v < 2900 ? 'warm' : v < 3800 ? 'neutral' : 'cool'}`, v => this.liveLight({ warmth: v }))),
      sec('Lamps', null, h('div', { class: 'toggles' }, this.toggle('l-lamps', hasLamps ? 'Lamps on' : 'Lamps on (add a lamp from Furniture)', L.lampsOn, v => setL({ lampsOn: v }, true)))),
      sec('Overall', null,
        slider('l-exp', 'Brightness of the picture', 0.6, 1.6, 0.01, L.exposure, v => `${v.toFixed(2)}×`, v => this.liveLight({ exposure: v })),
        h('button', { class: 'btn', id: 'l-reset', onclick: () => app.change(st => { st.lighting = { ...DEFAULT_LIGHTING }; }, { finishes: false, items: false, lighting: true }) }, 'Reset lighting'),
        h('p', { class: 'note' }, 'Paint looks different morning to night. Try your favorite pink at 7 pm with the light on.')),
    );
  }

  liveLight(patch) {
    // Sliders update the scene live and save after a pause, with one undo step per drag.
    const app = this.app;
    if (!this._lightDrag) { app.history.push(app.state); this._lightDrag = true; }
    const wasNight = app.state.lighting.time > 0.86;
    Object.assign(app.state.lighting, patch);
    if ('time' in patch && !wasNight && patch.time > 0.86 && !app.state.lighting.ceilingOn) {
      // Evening: people switch the light on.
      app.state.lighting.ceilingOn = true;
      const t = document.getElementById('l-ceil'); if (t) t.checked = true;
    }
    app.applyLighting();
    clearTimeout(this._lt);
    this._lt = setTimeout(() => { this._lightDrag = false; app.saveSoon(); this.renderViewbar(); }, 500);
  }

  colorPicker(mutate, { finishes = false, items = false }) {
    // 'input' previews in 3D only (re-rendering would close the native picker); 'change' commits once.
    const app = this.app;
    return {
      oninput: e => {
        if (this._colorEl !== e.target) { app.history.push(app.state); this._colorEl = e.target; }
        mutate(app.state, e.target.value);
        if (finishes) app.applyFinishes();
        if (items) app.syncItems();
        app.saveSoon();
        this.renderViewbar();
      },
      onchange: e => {
        const fresh = this._colorEl !== e.target; // 'change' without any 'input'
        this._colorEl = null;
        app.change(st => mutate(st, e.target.value), { history: fresh, finishes, items });
      },
    };
  }

  /** Switch bedding product. A custom comforter color means something different per product, so it resets. */
  pickBedding(id) {
    if (this.app.state.bedding === id) return;
    this.app.change(st => { st.bedding = id; st.preset = null; delete st.items.find(i => i.uid === 'twin_bed')?.comforterColor; });
  }

  /** Label + named swatches + any-color picker + "Original". setSt(st, hex|null); null = as bought. */
  colorRow(id, label, cur, palette, setSt, { finishes = false, items = true, orig = null } = {}) {
    const app = this.app;
    const set = hex => app.change(st => setSt(st, hex), { finishes, items });
    const now = (cur || orig || '').toLowerCase();
    return h('div', { class: 'colorrow', role: 'group', 'aria-label': label },
      h('span', { class: 'note' }, label),
      h('div', { class: 'swatches' },
        ...palette.map(([name, hex], i) => h('button', { class: 'sw', id: `${id}-sw-${i}`, title: `${name} ${hex}`, 'aria-label': name, 'aria-pressed': String(now === hex.toLowerCase()), style: { background: hex }, onclick: () => set(i === 0 && orig && hex.toLowerCase() === orig.toLowerCase() ? null : hex) })),
        h('input', { type: 'color', id: `${id}-any`, title: 'Pick any color', 'aria-label': `${label}: any color`, value: cur || orig || palette[0][1], ...this.colorPicker(setSt, { finishes, items }) }),
        cur ? h('button', { class: 'btn mini', id: `${id}-orig`, onclick: () => { set(null); document.getElementById(`${id}-any`)?.focus({ preventScroll: true }); } }, 'Original') : null));
  }

  curtainColorRow(id) {
    return this.colorRow(id, 'Curtain color', this.app.state.curtainColor, CURTAIN_COLORS,
      (st, hex) => { st.curtainColor = hex || null; st.preset = null; }, { finishes: true, items: false, orig: CURTAIN_COLORS[0][1] });
  }

  /** Sheets (and comforter, when the bed has one) color rows for a bed item. */
  beddingColorRows(item, id) {
    const obj = this.app.objects.get(item.uid);
    const setField = field => (st, hex) => {
      const x = st.items.find(i => i.uid === item.uid);
      if (hex) x[field] = hex; else delete x[field];
      st.preset = null;
    };
    const comforter = item.type === 'bed' ? this.app.state.bedding !== 'none' : !!obj?.userData.setComforterColor;
    const floral = item.type === 'bed' && this.app.state.bedding === 'floral_purple_sheets';
    const ud = obj?.userData || {};
    return [
      this.colorRow(`${id}-sheet`, 'Sheets & pillowcases', item.sheetColor, SHEET_COLORS, setField('sheetColor'), { orig: ud.baseSheetColor }),
      comforter ? this.colorRow(`${id}-comf`, floral ? 'Comforter tint' : 'Comforter', item.comforterColor, SHEET_COLORS, setField('comforterColor'), { orig: ud.baseComforterColor }) : null,
    ].filter(Boolean);
  }

  rugColorRow(rug, id) {
    const printed = rug.kind === 'woodland_unicorn' || rug.kind?.startsWith('custom:');
    return this.colorRow(id, printed ? 'Rug tint' : 'Rug color', rug.color, RUG_COLORS, (st, hex) => {
      const r = st.items.find(i => i.uid === 'rug');
      if (hex) r.color = hex; else delete r.color;
      st.preset = null;
    }, { orig: this.app.objects.get('rug')?.userData.baseColor });
  }

  // ------------------------------------------------------------------ Saved tab
  renderSaved() {
    const app = this.app, st = app.store;
    const readOnly = st.canWrite === false;
    // keep what's being typed: this re-renders on every change and shared update
    const old = document.getElementById('ver-name');
    const typing = old && document.activeElement === old ? [old.selectionStart, old.selectionEnd] : null;
    const nameIn = h('input', { id: 'ver-name', type: 'text', placeholder: 'Name, e.g. Blush + scalloped rug', maxlength: 60, value: old?.value || null });
    const save = () => {
      if (readOnly) return;
      const name = nameIn.value.trim() || defaultName();
      nameIn.value = '';
      app.saveVersion(name);
    };
    const defaultName = () => {
      const s = app.state;
      const pink = [['Current blue', app.room.finishes.current_wall_color[1]], ...app.room.finishes.pink_wall_palette].find(([, hx]) => hx.toLowerCase() === (s.wallColors.north || '').toLowerCase());
      const rug = s.items.find(i => i.uid === 'rug');
      return `${pink ? pink[0] : 'Custom walls'} + ${rug.removed ? 'no rug' : app.rugName(rug).toLowerCase()}`;
    };
    nameIn.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    const list = st.versions.length ? h('div', { class: 'versions' }, ...st.versions.map(v => this.versionRow(v)))
      : h('p', { class: 'empty' }, 'No saved versions yet. Save the room as it looks now to compare later.');
    this.fill(this.panes.saved,
      sec('Save this version', null,
        h('div', { class: 'saverow' }, nameIn, h('button', { class: 'btn primary', id: 'ver-save', onclick: save, disabled: readOnly }, 'Save')),
        readOnly ? h('p', { class: 'note' }, 'You can look, but only people with edit access can save.') : null,
        h('p', { class: 'note' }, st.mode === 'shared'
          ? 'Saved versions are shared: whoever you share this page with sees them and can open them.'
          : 'Saved in this browser. Open the shared page to see each other’s versions.')),
      sec('Picture of this view', null,
        h('button', { class: 'btn', id: 'shot-btn', onclick: () => app.saveImage(), html: `${ICON.camera} Save image` }),
        h('p', { class: 'note' }, 'Saves a PNG of exactly what’s on screen, to text to each other.')),
      sec('Saved versions', st.versions.length ? `${st.versions.length}` : null, list),
    );
    if (typing) { try { nameIn.setSelectionRange(...typing); } catch { /* not focused */ } }
    if (st.mode === 'shared') this.fillNames();
  }

  versionRow(v) {
    const app = this.app;
    const th = h('button', { class: 'th', 'aria-label': `Open ${v.name}`, onclick: () => app.loadVersion(v) });
    if (v.thumb) app.store.imageUrl(v.thumb).then(u => { if (u) th.style.backgroundImage = `url("${u}")`; });
    const when = v.at ? new Date(v.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
    // the open "Delete for everyone?" survives re-renders
    const acts = this._confirmId === v.id
      ? h('div', { class: 'acts' }, h('span', { class: 'confirm' }, 'Delete for everyone?',
        h('button', { class: 'mini btn danger', id: `ver-del-${v.id}`, onclick: () => { this._confirmId = null; app.store.deleteVersion(v.id).catch(() => { this.toast('Couldn’t delete it'); this.renderSaved(); }); } }, 'Delete'),
        h('button', { class: 'mini btn', id: `ver-keep-${v.id}`, onclick: () => { this._confirmId = null; this.renderSaved(); } }, 'Keep')))
      : h('div', { class: 'acts' },
        h('button', { class: 'mini btn', id: `ver-open-${v.id}`, onclick: () => app.loadVersion(v) }, 'Open'),
        h('button', { class: 'mini btn danger', id: `ver-ask-${v.id}`, onclick: () => {
          this._confirmId = v.id;
          this.renderSaved();
          document.getElementById(`ver-keep-${v.id}`)?.focus({ preventScroll: true });
        } }, 'Delete'));
    return h('div', { class: 'ver' }, th,
      h('div', { class: 'vi' }, h('b', {}, v.name || 'Untitled'), h('small', { 'data-by': v.by || '' }, when), acts));
  }

  async fillNames() {
    const ids = this.app.store.versions.map(v => v.by).filter(Boolean);
    const names = await this.app.store.namesFor(ids);
    this.panes.saved.querySelectorAll('small[data-by]').forEach(el => {
      const n = names[el.dataset.by];
      if (n && !el.dataset.named) { el.textContent = `${n} · ${el.textContent}`; el.dataset.named = '1'; }
    });
  }

  // ------------------------------------------------------------------ Selection card
  renderCard(info) {
    // controls have stable ids so focus comes back after the rebuild
    const card = this.card;
    const was = card.contains(document.activeElement) ? document.activeElement.id : null;
    this._renderCard(info);
    if (was) document.getElementById(was)?.focus({ preventScroll: true });
  }

  _renderCard(info) {
    const app = this.app, card = this.card;
    this._cardInfo = info;
    if (!info) { card.hidden = true; card.replaceChildren(); return; }
    card.hidden = false;
    const close = h('button', { class: 'close', id: 'card-close', 'aria-label': 'Close', onclick: () => app.editor.select(null) }, '×');

    if (info.kind === 'wall') {
      const w = info.wall;
      const palette = [['Current blue', app.room.finishes.current_wall_color[1]], ...app.room.finishes.pink_wall_palette];
      const cur = app.state.wallColors[w];
      const setSt = (st, hex) => { st.wallColors[w] = hex; st.preset = null; };
      const set = hex => app.change(st => setSt(st, hex), { items: false });
      card.replaceChildren(
        h('div', { class: 'head' }, h('h3', {}, WALL_NAMES[w]), h('span', { class: 'dims' }, `${fmtFtIn(app.shell.walls[w].length)} wide`), close),
        h('div', { class: 'swatches' }, ...palette.map(([n, hex], i) => h('button', { class: 'sw', id: `card-wsw-${i}`, title: `${n} ${hex}`, 'aria-label': n, 'aria-pressed': String(cur.toLowerCase() === hex.toLowerCase()), style: { background: hex }, onclick: () => set(hex) })),
          h('input', { type: 'color', id: 'wall-color', value: cur, 'aria-label': 'Any color', ...this.colorPicker(setSt, { finishes: true }) })),
        w === 'south' ? h('div', { class: 'row' }, this.toggle('c-decals', 'Star decals + ALICE', app.state.decals, v => app.change(st => { st.decals = v; }, { items: false }))) : null,
        w === 'north' ? h('div', { class: 'row' }, this.toggle('c-curt', 'Curtains', app.state.curtains, v => app.change(st => { st.curtains = v; }, { items: false }))) : null,
      );
      return;
    }
    if (info.kind === 'curtains') {
      card.replaceChildren(h('div', { class: 'head' }, h('h3', {}, 'Star curtains'), close),
        this.curtainColorRow('card-curt'),
        h('div', { class: 'row' }, h('button', { class: 'btn', id: 'card-curt-down', onclick: () => { app.change(st => { st.curtains = false; }, { items: false }); app.editor.select(null); } }, 'Take them down'),
          h('span', { class: 'note' }, 'Bring them back under Look → On the walls.')));
      return;
    }
    if (info.kind === 'fan') {
      card.replaceChildren(h('div', { class: 'head' }, h('h3', {}, 'Ceiling fan'), close),
        h('div', { class: 'row' },
          this.toggle('c-fanlight', 'Light on', app.state.lighting.ceilingOn, v => app.change(st => { st.lighting.ceilingOn = v; }, { finishes: false, items: false, lighting: true })),
          h('button', { class: 'btn', id: 'card-fan-hide', onclick: () => { app.change(st => { st.fanVisible = false; }, { items: false }); app.editor.select(null); } }, 'Hide the fan')));
      return;
    }

    const it = info.item, d = info.dims, isWall = info.wall;
    const name = app.itemName(it);
    const dimsText = isWall ? `${fmtFtIn(d.w)} W × ${fmtFtIn(d.h)} H` : it.type === 'rug' ? `${it.sizeFt[0]}′ × ${it.sizeFt[1]}′` : `${fmtFtIn(d.w)} W × ${fmtFtIn(d.d)} D × ${fmtFtIn(d.h)} H`;
    const rows = [];
    if (!isWall) {
      rows.push(h('div', { class: 'row', role: 'group', 'aria-label': 'Turn' },
        withId(iconBtn(ICON.ccw, 'Turn 90° left', () => app.editor.rotate(-90)), 'card-l90'),
        h('button', { class: 'btn', id: 'card-l15', onclick: () => app.editor.rotate(-15), title: 'Turn 15° left' }, '15°', h('span', { html: ICON.ccw, style: { display: 'inline-flex' } })),
        h('button', { class: 'btn', id: 'card-r15', onclick: () => app.editor.rotate(15), title: 'Turn 15° right' }, h('span', { html: ICON.cw, style: { display: 'inline-flex' } }), '15°'),
        withId(iconBtn(ICON.cw, 'Turn 90° right', () => app.editor.rotate(90)), 'card-r90'),
        h('span', { style: { flex: 1 } }),
        (it.type === 'catalog' || it.type === 'custom') ? withId(iconBtn(ICON.copy, 'Duplicate', () => app.duplicate(it.uid)), 'card-dup') : null,
        h('button', { class: 'btn danger', id: 'card-remove', onclick: () => app.editor.remove(it.uid), html: `${ICON.trash} Remove` })));
    } else {
      rows.push(h('div', { class: 'row' },
        h('label', { for: 'c-wall', class: 'note' }, 'Wall'),
        h('select', { id: 'c-wall', class: 'btn', onchange: e => app.change(st => { const x = st.items.find(i => i.uid === it.uid); x.wall = e.target.value; x.along = 0; }, { finishes: false }) },
          ...WALL_IDS.map(w => h('option', { value: w, selected: it.wall === w }, WALL_NAMES[w]))),
        h('span', { style: { flex: 1 } }),
        it.type !== 'wall' || !/^art\d$/.test(it.uid) ? withId(iconBtn(ICON.copy, 'Duplicate', () => app.duplicate(it.uid)), 'card-dup') : null,
        h('button', { class: 'btn danger', id: 'card-remove', onclick: () => app.editor.remove(it.uid), html: `${ICON.trash} Remove` })));
    }
    if (it.type === 'bed') {
      rows.push(h('div', { class: 'row' }, h('span', { class: 'note' }, 'Size'), h('div', { style: { flex: 1 } }, this.bedSizeSeg('card-bedsize'))));
      rows.push(h('div', { class: 'row' }, h('span', { class: 'note' }, 'Bedding'),
        h('div', { class: 'segline', style: { flex: 1 } }, ...[['lavender_pompom', 'Lavender'], ['floral_purple_sheets', 'Floral'], ['none', 'Plain']].map(([id, l]) =>
          h('button', { id: `card-bed-${id}`, 'aria-pressed': String(app.state.bedding === id), onclick: () => this.pickBedding(id) }, l)))));
    }
    if (it.type === 'rug') {
      const isShag = it.kind === 'navy_shag_current';
      rows.push(h('div', { class: 'segline', role: 'group', 'aria-label': 'Rug size' }, ...this.rugSizes(it, true).map(({ sz, label }) =>
        h('button', { id: `card-rug-${sz.join('x')}`, 'aria-pressed': String(sameSize(it.sizeFt, sz)), onclick: () => this.setRugSize(sz, false) }, label))));
      rows.push(this.rugColorRow(it, 'card-rug'));
    }
    const obj = app.objects.get(it.uid);
    const hasSheets = !!obj?.userData.setSheetColor;
    // Beds: one color row at a time, picked with Sheets | Comforter | Frame, so the card stays short on a phone
    let colorTarget = 'frame';
    if (hasSheets) {
      const bedRows = this.beddingColorRows(it, 'card');
      const targets = [['sheet', 'Sheets'], ...(bedRows.length > 1 ? [['comf', 'Comforter']] : []), ...(obj.userData.setColor ? [['frame', 'Frame']] : [])];
      const want = this._colorTarget?.[it.uid];
      colorTarget = targets.some(([k]) => k === want) ? want : 'sheet';
      rows.push(h('div', { class: 'row' }, h('span', { class: 'note' }, 'Color'),
        h('div', { class: 'segline', role: 'group', 'aria-label': 'What to color', style: { flex: 1 } }, ...targets.map(([k, l]) =>
          h('button', { id: `card-ct-${k}`, 'aria-pressed': String(colorTarget === k), onclick: () => {
            this._colorTarget = { ...this._colorTarget, [it.uid]: k };
            this.renderCard(this._cardInfo);
          } }, l)))));
      if (colorTarget === 'sheet') rows.push(bedRows[0]);
      if (colorTarget === 'comf') rows.push(bedRows[1]);
    }
    if (obj?.userData.setColor && it.type !== 'rug' && colorTarget === 'frame') {
      const cur = it.color;
      const setCSt = (st, hex) => { st.items.find(i => i.uid === it.uid).color = hex; };
      const setC = hex => app.change(st => setCSt(st, hex), { finishes: false });
      rows.push(h('div', { class: 'swatches' },
        ...ITEM_COLORS.map((hex, i) => h('button', { class: 'sw', id: `card-sw-${i}`, 'aria-label': `Color ${hex}`, 'aria-pressed': String(cur === hex), style: { background: hex }, onclick: () => setC(hex) })),
        h('input', { type: 'color', id: 'item-color', 'aria-label': 'Any color', value: cur || '#b3b7bb', ...this.colorPicker(setCSt, { items: true }) }),
        cur ? h('button', { class: 'btn', id: 'card-orig', onclick: () => app.change(st => { delete st.items.find(i => i.uid === it.uid).color; }, { finishes: false }) }, 'Original') : null));
    }
    if (obj?.userData.setLight) {
      rows.push(h('div', { class: 'row' }, this.toggle('c-lamp', 'Lamp on', it.lampOn !== false, v => app.change(st => { st.items.find(i => i.uid === it.uid).lampOn = v; }, { finishes: false, items: false, lighting: true }))));
    }
    if (it.on) {
      const sup = app.state.items.find(i => i.uid === it.on);
      rows.push(h('div', { class: 'row' }, h('span', { class: 'note', style: { flex: 1 } }, `Sitting on the ${sup ? app.itemName(sup).toLowerCase() : 'furniture'}`),
        h('button', { class: 'btn', id: 'card-floor', onclick: () => app.editor.putOnFloor(it.uid) }, 'Put on the floor')));
    } else if (app.editor.canRest(it) && app.editor.surfacesFor(it).length) {
      const names = app.editor.surfacesFor(it).map(c => `the ${app.itemName(c).toLowerCase()}`);
      const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0];
      rows.push(h('p', { class: 'note', id: 'card-stack-hint' }, `To set it on top of something, drag it onto ${list}.`));
    }
    const warn = h('div', { class: 'warn', id: 'card-warn' }, info.overlap ? `Overlaps the ${app.itemName(info.overlap).toLowerCase()}` : '');
    warn.hidden = !info.overlap;
    card.replaceChildren(h('div', { class: 'head' }, h('h3', {}, name), h('span', { class: 'dims' }, dimsText), close), ...rows, warn);
  }

  updateCardLive(info) {
    if (!info || info.kind !== 'item') return;
    const warn = document.getElementById('card-warn');
    if (!warn) return;
    warn.hidden = !info.overlap;
    warn.textContent = info.overlap ? `Overlaps the ${this.app.itemName(info.overlap).toLowerCase()}` : '';
  }
}
