// Shared helpers for /api/floorplan/* — zero-dependency.
// Auth: one team password. PLAN_PASSWORD env overrides the committed default; the cookie carries a SHA-256.
// Storage: Vercel Blob (BLOB_READ_WRITE_TOKEN) or a Redis REST store (KV_REST_API_URL/UPSTASH_REDIS_REST_URL). If neither
// is configured or reachable, the API reports { store:false } and the app keeps saving in the browser.
const crypto = require("node:crypto");
const PASSWORD = process.env.PLAN_PASSWORD || "IGCE-plan-2026";
const SALT = process.env.PLAN_SECRET || "igce-plan-studio-2026";
const NS = "planstudio";
function token() { return crypto.createHash("sha256").update(PASSWORD + "|" + SALT).digest("hex"); }
function authed(req) { const m = /(?:^|;\s*)ps_session=([a-f0-9]+)/.exec(req.headers.cookie || ""); return !!(m && m[1] === token()); }
function send(res, code, obj, extra) { res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.setHeader("Cache-Control", "no-store"); if (extra) for (const k in extra) res.setHeader(k, extra[k]); res.end(JSON.stringify(obj)); }
async function readBody(req) { if (req.body) return typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body; return await new Promise((resolve) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch (e) { resolve({}); } }); }); }

// ---- Redis REST backend ----
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_REST_API_TOKEN;
async function pipe(cmds) { const r = await fetch(KV_URL.replace(/\/$/, "") + "/pipeline", { method: "POST", headers: { Authorization: "Bearer " + KV_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(cmds) }); const j = await r.json().catch(() => []); if (!r.ok) throw new Error("kv " + r.status); return j.map((x) => x && x.result); }
const redis = {
  name: "redis",
  async index() { const [h] = await pipe([["HGETALL", NS + ":index"]]); const out = []; if (Array.isArray(h)) for (let i = 0; i < h.length - 1; i += 2) { try { out.push(JSON.parse(h[i + 1])); } catch (e) {} } return out.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")); },
  async get(id) { const [s] = await pipe([["GET", NS + ":c:" + id]]); return s ? JSON.parse(s) : null; },
  async put(rec) { const meta = { id: rec.id, name: rec.name, site: rec.site, updatedAt: rec.updatedAt, by: rec.by }; await pipe([["SET", NS + ":c:" + rec.id, JSON.stringify(rec)], ["HSET", NS + ":index", rec.id, JSON.stringify(meta)], ["HSET", NS + ":h:" + rec.id, rec.updatedAt, JSON.stringify(rec)]]);
    const [keys] = await pipe([["HKEYS", NS + ":h:" + rec.id]]); if (Array.isArray(keys) && keys.length > 30) { const old = keys.sort().slice(0, keys.length - 30); await pipe([["HDEL", NS + ":h:" + rec.id, ...old]]); } },
  async del(id) { await pipe([["DEL", NS + ":c:" + id], ["HDEL", NS + ":index", id], ["DEL", NS + ":h:" + id]]); },
  async history(id) { const [keys] = await pipe([["HKEYS", NS + ":h:" + id]]); return (keys || []).sort().reverse().map((at) => ({ at })); },
};

// ---- Vercel Blob backend (REST, no SDK) ----
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const BLOB = "https://blob.vercel-storage.com";
const PFX = () => NS + "/" + crypto.createHash("sha256").update(SALT).digest("hex").slice(0, 16) + "/";
async function bput(path, body, maxAge) { const r = await fetch(BLOB + "/" + path, { method: "PUT", headers: { authorization: "Bearer " + BLOB_TOKEN, "x-api-version": "7", "x-content-type": "application/json", "x-add-random-suffix": "0", "x-cache-control-max-age": String(maxAge || 60) }, body }); if (!r.ok) throw new Error("blob put " + r.status); return r.json(); }
async function blist(prefix, limit) { const r = await fetch(BLOB + "/?prefix=" + encodeURIComponent(prefix) + "&limit=" + (limit || 200), { headers: { authorization: "Bearer " + BLOB_TOKEN, "x-api-version": "7" } }); if (!r.ok) throw new Error("blob list " + r.status); const j = await r.json(); return j.blobs || []; }
async function bread(url) { const r = await fetch(url + (url.includes("?") ? "&" : "?") + "v=" + Date.now(), { cache: "no-store" }); if (!r.ok) return null; return r.json(); }
async function bdel(urls) { const r = await fetch(BLOB + "/delete", { method: "POST", headers: { authorization: "Bearer " + BLOB_TOKEN, "x-api-version": "7", "content-type": "application/json" }, body: JSON.stringify({ urls }) }); if (!r.ok) throw new Error("blob del " + r.status); }
async function bfind(path) { const bl = await blist(PFX() + path, 5); return bl.find((b) => b.pathname === PFX() + path) || null; }
const blob = {
  name: "blob",
  async index() { const b = await bfind("index.json"); if (!b) return []; return (await bread(b.url)) || []; },
  async get(id) { const b = await bfind("c/" + id + ".json"); if (!b) return null; return bread(b.url); },
  async put(rec) { await bput(PFX() + "c/" + rec.id + ".json", JSON.stringify(rec), 60); await bput(PFX() + "h/" + rec.id + "/" + rec.updatedAt.replace(/[:.]/g, "-") + ".json", JSON.stringify(rec), 3600);
    const idx = (await this.index()).filter((x) => x.id !== rec.id); idx.unshift({ id: rec.id, name: rec.name, site: rec.site, updatedAt: rec.updatedAt, by: rec.by }); idx.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")); await bput(PFX() + "index.json", JSON.stringify(idx.slice(0, 200)), 60); },
  async del(id) { const b = await bfind("c/" + id + ".json"); if (b) await bdel([b.url]); const idx = (await this.index()).filter((x) => x.id !== id); await bput(PFX() + "index.json", JSON.stringify(idx), 60); },
  async history(id) { const bl = await blist(PFX() + "h/" + id + "/", 100); return bl.map((b) => ({ at: b.pathname.split("/").pop().replace(".json", "") })).sort((a, b) => b.at.localeCompare(a.at)); },
};
const store = BLOB_TOKEN ? blob : (KV_URL && KV_TOKEN) ? redis : null;
module.exports = { token, authed, send, readBody, store, PASSWORD };
