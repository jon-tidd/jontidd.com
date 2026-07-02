// /api/notes — shared notes & favorites store for the Site Screener.
//
// Zero-dependency. Persists to a Vercel KV / Upstash Redis store when its
// REST credentials are present in the environment; otherwise it responds with
// { configured:false } so the client silently falls back to per-device
// localStorage. To turn on shared sync, set the REST URL + token env vars
// (any of the KV_*/UPSTASH_*/REDIS_* names below) and redeploy. No code change.
//
// Data model (avoids whole-blob clobbering under concurrent edits):
//   HASH  sitescreener:notes   field=<pin>                 value=<note text>
//   HASH  sitescreener:favs    field=<pin><SEP><person>    value="1"
//   STR   sitescreener:updatedAt
// Per-person favorite fields mean two people favoriting the same site never
// overwrite each other. SEP is a control char that never appears in pins/names.

const KV_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL   || process.env.REDIS_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_REST_API_TOKEN;
const WRITE_TOKEN = process.env.SCREENER_TOKEN || ""; // if set, POSTs must include a matching token
const NS = "sitescreener";
const SEP = String.fromCharCode(1); // separates pin from person in the favs hash field name
const configured = !!(KV_URL && KV_TOKEN);

async function pipe(cmds) {
  const r = await fetch(KV_URL.replace(/\/$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + KV_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  });
  const j = await r.json().catch(() => []);
  if (!r.ok) throw new Error("kv pipeline " + r.status + " " + JSON.stringify(j));
  return j; // array of { result }
}

function arrToObj(a) {
  const o = {};
  if (Array.isArray(a)) for (let i = 0; i < a.length - 1; i += 2) o[a[i]] = a[i + 1];
  return o;
}

async function getState() {
  const out = await pipe([
    ["HGETALL", NS + ":notes"],
    ["HGETALL", NS + ":favs"],
    ["GET", NS + ":updatedAt"],
  ]);
  const notes = arrToObj(out[0] && out[0].result);
  // favs hash fields are "<pin><SEP><person>" -> "1"; rebuild as { pin: { person: true } }
  const fa = arrToObj(out[1] && out[1].result);
  const favs = {};
  for (const k in fa) {
    const i = k.indexOf(SEP);
    if (i < 0) continue;
    const pin = k.slice(0, i), person = k.slice(i + SEP.length);
    (favs[pin] = favs[pin] || {})[person] = true;
  }
  const ua = out[2] && out[2].result;
  return { notes, favs, updatedAt: +ua || 0 };
}

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  if (req.body) return typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
  return await new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch (e) { resolve({}); } });
  });
}

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      if (!configured) return send(res, 200, { configured: false, notes: {}, favs: {} });
      return send(res, 200, { configured: true, ...(await getState()) });
    }
    if (req.method === "POST") {
      if (!configured) return send(res, 200, { configured: false });
      const b = await readBody(req).catch(() => ({}));
      if (WRITE_TOKEN && b.token !== WRITE_TOKEN) return send(res, 403, { error: "forbidden" });
      const delta = b.delta || {};
      const cmds = [];
      if (delta.notes) for (const p in delta.notes) {
        const v = delta.notes[p];
        cmds.push(v ? ["HSET", NS + ":notes", p, String(v).slice(0, 2000)] : ["HDEL", NS + ":notes", p]);
      }
      // delta.favs is an array of { pin, person, on }
      if (Array.isArray(delta.favs)) for (const f of delta.favs) {
        if (!f || !f.pin || !f.person) continue;
        const field = f.pin + SEP + f.person;
        cmds.push(f.on ? ["HSET", NS + ":favs", field, "1"] : ["HDEL", NS + ":favs", field]);
      }
      cmds.push(["SET", NS + ":updatedAt", String(Date.now())]);
      if (cmds.length) await pipe(cmds);
      return send(res, 200, { configured: true, ...(await getState()) });
    }
    res.statusCode = 405;
    res.end("Method Not Allowed");
  } catch (e) {
    // Never hard-fail the client; report not-configured so it stays on localStorage.
    send(res, 200, { configured: false, error: String((e && e.message) || e) });
  }
};
