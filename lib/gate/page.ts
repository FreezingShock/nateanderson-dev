import { GATE } from "./config";

// The whole response for a locked visitor. The real page is never rendered or sent, so there is
// nothing in the DOM to unhide, and no client code decides whether to show it.
export const gateHtml = () => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="dark"><title>${GATE.title}</title>
<style>
*{box-sizing:border-box}html,body{height:100%;margin:0}
body{display:grid;place-items:center;background:#040506;color:#e9eff1;font:14px/1.5 "Helvetica Neue",Helvetica,Arimo,Arial,sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden}
body::before{content:"";position:fixed;inset:0;background-image:linear-gradient(rgba(226,238,240,.14) 1px,transparent 1px),linear-gradient(90deg,rgba(226,238,240,.14) 1px,transparent 1px);background-size:48px 48px;-webkit-mask-image:radial-gradient(60% 60% at 50% 45%,#000,transparent 75%);mask-image:radial-gradient(60% 60% at 50% 45%,#000,transparent 75%);opacity:.7}
body::after{content:"";position:fixed;inset:0;pointer-events:none;background:radial-gradient(130% 95% at 50% 45%,transparent 58%,rgba(0,0,0,.6) 100%)}
main{position:relative;z-index:1;width:min(23rem,calc(100vw - 2rem));border:1px solid rgba(226,238,240,.14);border-radius:2px;background:rgba(9,12,14,.72);backdrop-filter:blur(16px) saturate(135%);-webkit-backdrop-filter:blur(16px) saturate(135%);box-shadow:0 1px 0 rgba(255,255,255,.04) inset,0 18px 40px -24px rgba(0,0,0,.9)}
.h{display:flex;justify-content:space-between;align-items:center;background:#f2f3f1;color:#050607;font:600 10.5px/1 "IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;letter-spacing:.16em;text-transform:uppercase;padding:7px 10px}
.h span:last-child{font-weight:500;color:#4a565c;letter-spacing:.08em}
.b{padding:22px 18px 18px;display:grid;gap:14px}
.m{display:flex;align-items:center;gap:10px}.m b{font:800 15px/1 "Helvetica Neue",Helvetica,Arimo,Arial,sans-serif}
h1{margin:0;font:700 24px/1.05 "Helvetica Neue",Helvetica,Arimo,Arial,sans-serif;letter-spacing:-.02em}
p{margin:0;color:#8a99a3;font-size:13px}
label{font:500 10px/1.2 "IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;letter-spacing:.16em;text-transform:uppercase;color:#8a99a3}
input,button{width:100%;border-radius:0;font:inherit}
input{height:2.8rem;padding:0 .8rem;background:transparent;color:#e9eff1;border:1px solid rgba(226,238,240,.14);outline:none;font:400 16px "IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;letter-spacing:.12em;margin-top:6px}
input:focus{border-color:#2fd8e8}
button{height:2.6rem;border:1px solid #2fd8e8;background:#2fd8e8;color:#031417;cursor:pointer;font:600 10px "IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;letter-spacing:.13em;text-transform:uppercase}
button:hover{filter:brightness(1.1)}button:disabled{opacity:.35;cursor:default}button:focus-visible,input:focus-visible{outline:2px solid #2fd8e8;outline-offset:2px}
#e{min-height:1.2rem;font:500 11px "IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;letter-spacing:.08em;color:#ff4436}
main.s{animation:s .35s}@keyframes s{25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
@media (prefers-reduced-motion:reduce){main.s{animation:none}}
</style></head><body><main id="m"><div class="h"><span>Restricted</span><span>nateanderson.dev</span></div><div class="b">
<div class="m"><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="3" width="4.5" height="18" fill="#f2f3f1"/><rect x="17.5" y="3" width="4.5" height="18" fill="#f2f3f1"/><polygon points="6.5,3 11.5,3 17.5,21 12.5,21" fill="#2fd8e8"/></svg><b>NATE ANDERSON</b></div>
<div><h1>${GATE.title}</h1><p>${GATE.hint}</p></div>
<form id="f" autocomplete="off"><label for="p">Password</label><input id="p" type="password" placeholder="••••••••" autofocus required autocomplete="current-password"><button id="b" style="margin-top:12px">Unlock</button></form><p id="e" role="alert"></p></div></main>
<script>
var f=document.getElementById("f"),p=document.getElementById("p"),b=document.getElementById("b"),e=document.getElementById("e"),m=document.getElementById("m");
f.addEventListener("submit",function(ev){ev.preventDefault();b.disabled=true;e.textContent="";
fetch("${GATE.unlockPath}",{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify({password:p.value})})
.then(function(r){return r.json().then(function(j){return[r.ok,j]})}).then(function(x){
if(x[0]){location.reload();return}
e.textContent=x[1].error||"Wrong password";p.value="";p.focus();m.classList.remove("s");void m.offsetWidth;m.classList.add("s");b.disabled=false})
.catch(function(){e.textContent="Network error";b.disabled=false})});
</script></body></html>`;
