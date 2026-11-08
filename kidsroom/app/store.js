// Where things are kept.
// Inside the claude.ai viewer: saved versions and added finds live in the artifact's shared
// database (both parents see them), photos go to its asset store, and the page can ask Claude
// about a photo. Opened any other way (npx serve), everything falls back to this browser.

const LS_WORKING = 'alice-room-working-v1';

// ---------- tiny IndexedDB key/value store (local fallback) ----------
function idbOpen() {
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open('alice-room', 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('records')) db.createObjectStore('records');
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idb(storeName, mode, fn) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const st = tx.objectStore(storeName);
    let out;
    Promise.resolve(fn(st)).then(r => { out = r; });
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
  });
}
const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

function localId() { return `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`; }
const ASSET_ID = /^[A-Za-z0-9_-]{32}$/; // asset-store ids are opaque 32-char strings; local ids are shorter

// What a db row keeps of an image: the id (plus the data url when inlined), never an upload or blob: url.
function imageRef(im) {
  if (!im) return null;
  return im.inline ? { id: im.id, shared: true, inline: true, url: im.url } : { id: im.id, shared: !!im.shared };
}

// Re-encode an image as a small JPEG data url (for viewers with a shared db but no asset store).
async function inlineJpeg(blob, maxSide = 900, quality = 0.78, maxLen = 150000) {
  const bmp = await createImageBitmap(blob);
  try {
    let side = Math.min(maxSide, Math.max(bmp.width, bmp.height)), q = quality, url = '';
    for (let i = 0; i < 6; i++) {
      const s = side / Math.max(bmp.width, bmp.height);
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(bmp.width * s));
      cv.height = Math.max(1, Math.round(bmp.height * s));
      const c = cv.getContext('2d');
      c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height);
      c.drawImage(bmp, 0, 0, cv.width, cv.height);
      url = cv.toDataURL('image/jpeg', q);
      if (url.length < maxLen) break;
      side = Math.round(side * 0.75); q = Math.max(0.6, q - 0.06);
    }
    return url;
  } finally { if (bmp.close) bmp.close(); }
}

export class Store extends EventTarget {
  constructor() {
    super();
    this.mode = 'local';         // becomes 'shared' when the db capability answers
    this.versions = [];
    this.catalog = [];           // custom finds
    this.sample = null;
    this.canSendImages = false;
    this.canUpload = false;
    this.canWrite = true;
    this.downloads = null;
    this.user = null;
    this.myId = null;
    this._db = null;
    this._assets = null;
    this._assetsReady = null;
    this._writeSaid = null;      // what user.can('data.write') answered (true/false/null)
    this._subGen = 0;
    this._resubTries = 0;
    this._resubTimer = null;
    this._urlCache = new Map();
    this._unsubs = [];
  }

  emit(type) { this.dispatchEvent(new Event(type)); }

  /** Start resolving capabilities in the background; the page renders without waiting. */
  init() {
    this._loadLocalLists();
    const c = typeof window !== 'undefined' ? window.claude : null;
    if (!c || typeof c.use !== 'function') return;
    const use = name => c.use(name).catch(() => null);

    use('downloads').then(d => { this.downloads = d; this.emit('caps'); });
    use('sample').then(async s => {
      if (!s) return;
      this.sample = s;
      try {
        const lim = await s.limits();
        this.canSendImages = !!lim?.images;
      } catch { this.canSendImages = false; }
      this.emit('caps');
    });
    this._assetsReady = use('assets').then(a => { this._assets = a; this.canUpload = !!a; this.emit('caps'); return a; });
    Promise.all([use('db'), use('user')]).then(async ([db, user]) => {
      this.user = user;
      if (user) {
        try { this.myId = await user.id(); } catch { this.myId = null; }
        try {
          const w = user.can ? await user.can('data.write') : null;
          this._writeSaid = typeof w === 'boolean' ? w : null;
          this.canWrite = w !== false;
        } catch { /* keep default */ }
      }
      if (!db) return;
      this._db = db;
      this.mode = 'shared';
      this._subscribeShared();
      this.emit('caps');
    });
  }

  // ---------- this viewer's working copy ----------
  loadWorking() {
    try { const s = localStorage.getItem(LS_WORKING); return s ? JSON.parse(s) : null; } catch { return null; }
  }
  saveWorking(state) {
    try { localStorage.setItem(LS_WORKING, JSON.stringify(state)); } catch { /* storage full or blocked */ }
  }

  // ---------- shared lists ----------
  _subscribeShared() {
    this._unsubs.forEach(u => { try { u(); } catch { /* already dead */ } });
    this._unsubs = [];
    const gen = ++this._subGen;
    const live = () => gen === this._subGen;
    const onErr = e => { if (live()) this._onSnapErr(e); };
    this._unsubs.push(
      this._db.collection('designs').orderBy('at', 'desc').limit(200).onSnapshot(snap => {
        if (!live()) return;
        this._resubTries = 0;
        this.versions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.emit('versions');
      }, onErr),
      this._db.collection('catalog').orderBy('at', 'desc').limit(500).onSnapshot(snap => {
        if (!live()) return;
        this._resubTries = 0;
        this.catalog = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.emit('catalog');
      }, onErr),
    );
  }

  // A listener died: retry transient/unknown failures, drop to local lists when revoked.
  _onSnapErr(e) {
    const code = e && e.code;
    if (code === 'revoked') {
      clearTimeout(this._resubTimer); this._resubTimer = null;
      this._subGen++;
      this._unsubs.forEach(u => { try { u(); } catch { /* ignore */ } });
      this._unsubs = [];
      this._db = null;
      this.mode = 'local';
      this._loadLocalLists();
      this.emit('caps');
      return;
    }
    const KNOWN = ['invalid_argument', 'resource_exhausted', 'quota_exceeded', 'not_granted', 'capability_disabled', 'capability_removed', 'transform_error'];
    if (KNOWN.includes(code) || this._resubTimer || this._resubTries >= 3 || !this._db) return;
    this._resubTries++;
    this._resubTimer = setTimeout(() => {
      this._resubTimer = null;
      if (this._db) this._subscribeShared();
    }, 2000 + Math.random() * 8000);
  }

  // db write; a rejection with invalid_argument (when the platform didn't confirm write access) means read-only.
  async _dbWrite(p) {
    try { return await p; } catch (e) {
      if (e && e.code === 'invalid_argument' && this._writeSaid !== true && this.canWrite) {
        this.canWrite = false;
        this.emit('caps');
      }
      throw e;
    }
  }

  async _loadLocalLists() {
    try {
      const all = await idb('records', 'readonly', st => reqP(st.getAll()));
      const keys = await idb('records', 'readonly', st => reqP(st.getAllKeys()));
      const rows = keys.map((k, i) => ({ key: String(k), value: all[i] }));
      if (this.mode !== 'local') return;
      this.versions = rows.filter(r => r.key.startsWith('designs/')).map(r => r.value).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
      this.catalog = rows.filter(r => r.key.startsWith('catalog/')).map(r => r.value).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
      this.emit('versions');
      this.emit('catalog');
    } catch { /* IndexedDB unavailable: lists stay empty */ }
  }

  // ---------- images ----------
  async saveImage(blob) {
    if (this._assetsReady) await this._assetsReady;
    const shared = this.mode === 'shared' || !!this._db;
    if (this._assets) {
      try {
        const r = await this._assets.upload(blob, { type: blob.type || 'image/jpeg' });
        return { id: r.id, url: r.url, shared: true };
      } catch (e) { if (!shared) throw e; }
    }
    // shared rows must never point at this browser's IndexedDB: inline a small JPEG instead
    if (shared) return { id: 'inline', url: await inlineJpeg(blob), shared: true, inline: true };
    const id = localId();
    await idb('blobs', 'readwrite', st => st.put(blob, id));
    const url = URL.createObjectURL(blob);
    this._urlCache.set(id, url);
    return { id, url, shared: false };
  }

  /** A display/texture URL for a stored image reference {id, url, shared}. */
  async imageUrl(image) {
    if (!image) return null;
    const id = image.id ? String(image.id) : '';
    const stored = typeof image.url === 'string' && !image.url.startsWith('blob:') ? image.url : null; // a blob: url is dead after reload
    if (image.inline || (stored && stored.startsWith('data:'))) return stored && stored.startsWith('data:') ? stored : null;
    if (image.shared || ASSET_ID.test(id) || (this.mode === 'shared' && id && !id.startsWith('l'))) {
      return id ? `/_blob/${id}` : null;
    }
    if (!id) return stored;
    if (this._urlCache.has(id)) return this._urlCache.get(id);
    try {
      const blob = await idb('blobs', 'readonly', st => reqP(st.get(id)));
      if (!blob) return stored;
      const url = URL.createObjectURL(blob);
      this._urlCache.set(id, url);
      return url;
    } catch { return stored; }
  }

  // ---------- catalog of custom finds ----------
  async addCatalogEntry(entry) {
    const row = { ...entry, at: new Date().toISOString(), by: this.myId || null };
    if (this._db) {
      const ref = this._db.collection('catalog').doc();
      row.id = ref.id;
      await this._dbWrite(ref.set(row));
      return row;
    }
    row.id = localId();
    await idb('records', 'readwrite', st => st.put(row, `catalog/${row.id}`));
    this.catalog = [row, ...this.catalog];
    this.emit('catalog');
    return row;
  }

  async deleteCatalogEntry(id) {
    if (this._db) { await this._db.doc(`catalog/${id}`).delete(); return; }
    await idb('records', 'readwrite', st => st.delete(`catalog/${id}`));
    this.catalog = this.catalog.filter(c => c.id !== id);
    this.emit('catalog');
  }

  // ---------- saved versions ----------
  async saveVersion({ name, state, thumbBlob }) {
    let thumb = null;
    if (thumbBlob) {
      try { thumb = imageRef(await this.saveImage(thumbBlob)); } catch { thumb = null; }
    }
    const row = { name, state, thumb, at: new Date().toISOString(), by: this.myId || null };
    if (this._db) {
      const ref = this._db.collection('designs').doc();
      await this._dbWrite(ref.set(row));
      return { id: ref.id, ...row };
    }
    row.id = localId();
    await idb('records', 'readwrite', st => st.put(row, `designs/${row.id}`));
    this.versions = [row, ...this.versions];
    this.emit('versions');
    return row;
  }

  async deleteVersion(id) {
    if (this._db) {
      const t = this.versions.find(v => v.id === id)?.thumb;
      await this._db.doc(`designs/${id}`).delete();
      // its thumbnail asset is now unreferenced
      if (t && !t.inline && this._assets && (t.shared || ASSET_ID.test(String(t.id || '')))) {
        Promise.resolve().then(() => this._assets.delete(t.id)).catch(() => {});
      }
      return;
    }
    await idb('records', 'readwrite', st => st.delete(`designs/${id}`));
    this.versions = this.versions.filter(v => v.id !== id);
    this.emit('versions');
  }

  async renameVersion(id, name) {
    if (this._db) { await this._db.doc(`designs/${id}`).update({ name }); return; }
    const v = this.versions.find(x => x.id === id);
    if (!v) return;
    v.name = name;
    await idb('records', 'readwrite', st => st.put(v, `designs/${id}`));
    this.emit('versions');
  }

  // ---------- people ----------
  async namesFor(ids) {
    const out = {};
    const clean = [...new Set(ids.filter(Boolean))];
    if (!this.user || !clean.length || !this.user.profiles) return out;
    try {
      const ps = await this.user.profiles(clean);
      for (const id of clean) out[id] = (ps?.[id]?.name) || '';
    } catch { /* names are optional */ }
    return out;
  }

  // ---------- files for the viewer ----------
  async saveFile(filename, blob) {
    if (this.downloads) {
      try {
        await this.downloads.save({ filename, data: blob });
        return 'saved';
      } catch (e) {
        if (e?.code === 'declined') return 'declined';
        if (e?.code === 'rate_limited') return 'busy';
        return 'failed';
      }
    }
    if (typeof window !== 'undefined' && window.claude) return 'unavailable';
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      return 'saved';
    } catch { return 'failed'; }
  }
}
