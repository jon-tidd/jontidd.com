// Password gate for /floorplan (IGCE Plan Studio). Everything else on jontidd.com is untouched.
export const config = { matcher: ["/floorplan", "/floorplan/:path*", "/api/floorplan/:path*"] };
const enc = new TextEncoder();
async function sha(s) { const b = await crypto.subtle.digest("SHA-256", enc.encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
export default async function middleware(req) {
  const url = new URL(req.url);
  if (/\/api\/floorplan\/login$|\/floorplan\/api\/login$/.test(url.pathname)) return;
  const expect = await sha((process.env.PLAN_PASSWORD || "IGCE-plan-2026") + "|" + (process.env.PLAN_SECRET || "igce-plan-studio-2026"));
  const m = /(?:^|;\s*)ps_session=([a-f0-9]+)/.exec(req.headers.get("cookie") || "");
  if (m && m[1] === expect) return;
  if (url.pathname.includes("/api/")) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  return new Response(LOGIN, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
const LOGIN = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IGCE Plan Studio</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#eef1f3;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1a2228}
.box{background:#fff;border:1px solid #dfe6ea;border-radius:14px;padding:28px 26px;width:min(360px,92vw);box-shadow:0 6px 24px rgba(20,35,45,.08)}
.eyebrow{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#0b5e6a;font-weight:700}h1{font-family:Cambria,Georgia,serif;font-size:22px;margin:4px 0 14px;color:#1d3a52}
label{display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#8c98a0;font-weight:700;margin-bottom:6px}
input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cfd8dd;border-radius:8px;font-size:16px}
button{margin-top:12px;width:100%;background:#0f7d8c;color:#fff;border:0;border-radius:8px;padding:11px;font-size:14px;font-weight:600;cursor:pointer}
.err{color:#c8312a;font-size:12.5px;margin-top:10px;min-height:16px}p{font-size:12.5px;color:#5d6b74;margin:10px 0 0}</style></head>
<body><form class="box" id="f"><div class="eyebrow">Ira Gordon Center of Excellence</div><h1>Plan Studio</h1><label for="pw">Team password</label><input id="pw" type="password" autocomplete="current-password" autofocus><button type="submit">Open the studio</button><div class="err" id="err"></div><p>Founders only.</p></form>
<script>document.getElementById("f").onsubmit=async e=>{e.preventDefault();const err=document.getElementById("err");err.textContent="";try{const r=await fetch("/floorplan/api/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({password:document.getElementById("pw").value})});if(r.ok){location.href="/floorplan/";}else err.textContent="That password did not match.";}catch(x){err.textContent="Could not reach the server.";}};</script></body></html>`;
