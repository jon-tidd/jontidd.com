const { token, send, readBody, PASSWORD } = require("./_lib.js");
module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "method" });
  const b = await readBody(req).catch(() => ({}));
  if (!b || b.password !== PASSWORD) { await new Promise((r) => setTimeout(r, 600)); return send(res, 401, { ok: false }); }
  send(res, 200, { ok: true }, { "Set-Cookie": "ps_session=" + token() + "; Path=/floorplan; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000" });
};
