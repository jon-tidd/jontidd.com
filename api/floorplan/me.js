const { authed, send, store } = require("./_lib.js");
module.exports = async (req, res) => {
  if (!authed(req)) return send(res, 401, { error: "unauthorized" });
  let live = false, err = null; if (store) { try { await store.index(); live = true; } catch (e) { err = String((e && e.message) || e); } }
  send(res, 200, { ok: true, store: live, backend: store ? store.name : null, error: err });
};
