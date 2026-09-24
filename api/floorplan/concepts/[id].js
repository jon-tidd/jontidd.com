const { authed, send, readBody, store } = require("../_lib.js");
module.exports = async (req, res) => {
  if (!authed(req)) return send(res, 401, { error: "unauthorized" });
  const id = String((req.query && req.query.id) || "").replace(/[^A-Za-z0-9_-]/g, ""); if (!id) return send(res, 400, { error: "id" });
  if (!store) return send(res, 503, { error: "no store configured" });
  try {
    if (req.method === "GET") { if (req.query.history) return send(res, 200, await store.history(id)); const c = await store.get(id); return c ? send(res, 200, c) : send(res, 404, { error: "not found" }); }
    if (req.method === "PUT") { const b = await readBody(req); if (!b || !b.json) return send(res, 400, { error: "json required" });
      const rec = { id, name: String(b.name || "Untitled").slice(0, 120), site: String(b.site || "").slice(0, 160), by: String(b.by || "").slice(0, 60), updatedAt: new Date().toISOString(), json: String(b.json).slice(0, 2000000) };
      await store.put(rec); return send(res, 200, { ok: true, id, updatedAt: rec.updatedAt }); }
    if (req.method === "DELETE") { await store.del(id); return send(res, 200, { ok: true }); }
    send(res, 405, { error: "method" });
  } catch (e) { send(res, 503, { error: String((e && e.message) || e) }); }
};
