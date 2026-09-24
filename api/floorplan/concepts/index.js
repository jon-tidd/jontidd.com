const { authed, send, store } = require("../_lib.js");
module.exports = async (req, res) => {
  if (!authed(req)) return send(res, 401, { error: "unauthorized" });
  if (req.method !== "GET") return send(res, 405, { error: "method" });
  if (!store) return send(res, 200, []);
  try { const idx = await store.index(); const meta = req.query && req.query.meta; if (meta) return send(res, 200, idx);
    const full = await Promise.all(idx.slice(0, 30).map(async (m) => (await store.get(m.id)) || m)); send(res, 200, full);
  } catch (e) { send(res, 503, { error: String((e && e.message) || e) }); }
};
