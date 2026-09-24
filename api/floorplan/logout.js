const { send } = require("./_lib.js");
module.exports = async (req, res) => send(res, 200, { ok: true }, { "Set-Cookie": "ps_session=; Path=/floorplan; HttpOnly; Secure; SameSite=Lax; Max-Age=0" });
