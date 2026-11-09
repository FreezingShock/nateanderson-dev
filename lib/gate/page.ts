import { GATE } from "./config";

// The whole response for a locked visitor. The real page is never rendered or sent, so there is
// nothing in the DOM to unhide, and no client code decides whether to show it.
// Styled as the naOS status card (ground #1a1a1a, white title block, cyan edge, magenta guide line). Only the
// look changed: the form, the unlock request and the shake on a wrong password work exactly as before.
export const gateHtml =
    () => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="dark"><title>${GATE.title}</title>
<style>
:root{--ground:#1a1a1a;--block:#f4f4f2;--ink:#1a1a1a;--cyan:#2fd8e8;--mute:#8d8d88;--hair:rgba(244,244,242,.14);--hair-hi:rgba(244,244,242,.3);--display:"Helvetica Neue",Helvetica,Arimo,Arial,sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace}
*{box-sizing:border-box}
html,body{min-height:100%;margin:0}
body{display:grid;place-items:center;padding:20px 16px;background:var(--ground);color:var(--block);font:14px/1.5 var(--display);-webkit-font-smoothing:antialiased;position:relative;overflow-x:hidden}
body::before{content:"";position:fixed;inset:0;pointer-events:none;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'%3E%3Cpath d='M0 8 L100 82 M0 96 L100 14' stroke='%23c23bd0' stroke-width='1' fill='none' vector-effect='non-scaling-stroke'/%3E%3C/svg%3E") center/100% 100% no-repeat;opacity:.5}
body::after{content:"";position:fixed;inset:0;pointer-events:none;background-image:radial-gradient(circle,rgba(244,244,242,.5) 0 28%,transparent 32%);background-size:5px 5px;-webkit-mask-image:linear-gradient(100deg,transparent 8%,#000 100%);mask-image:linear-gradient(100deg,transparent 8%,#000 100%);opacity:.12}
main{position:relative;z-index:1;width:min(24rem,100%);background:#141414;border:1px solid var(--hair);border-left:3px solid var(--cyan);box-shadow:0 24px 48px -28px #000}
main::before,main::after{content:"";position:absolute;width:14px;height:14px;pointer-events:none}
main::before{right:-1px;top:-1px;border-top:2px solid var(--block);border-right:2px solid var(--block)}
main::after{left:-3px;bottom:-1px;border-bottom:2px solid var(--block);border-left:2px solid var(--block)}
.h{display:flex;justify-content:space-between;align-items:center;gap:12px;background:var(--block);color:var(--ink);font:700 10.5px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;padding:9px 14px}
.h span:last-child{font-weight:500;color:#4a4a47;letter-spacing:.08em}
.b{padding:22px 16px 18px;display:grid;gap:16px}
h1{margin:0;justify-self:start;background:var(--block);color:var(--ink);font:700 clamp(40px,12vw,56px)/.86 var(--display);letter-spacing:-.055em;text-transform:lowercase;padding:.1em .16em .2em .06em}
p{margin:0;color:#a9a9a4;font-size:14px}
form{display:grid;gap:0}
label{font:600 10px/1.2 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--mute)}
input,button{width:100%;border-radius:0;font:inherit}
input{height:2.8rem;padding:0 .8rem;margin-top:8px;background:transparent;color:var(--block);border:1px solid var(--hair-hi);outline:none;font:400 16px var(--mono);letter-spacing:.12em}
input::placeholder{color:#5c5c58}
input:focus{border-color:var(--cyan)}
button{height:2.75rem;margin-top:12px;border:1px solid var(--cyan);background:var(--cyan);color:#031417;cursor:pointer;font:700 11px var(--mono);letter-spacing:.14em;text-transform:uppercase;touch-action:manipulation}
button:hover{filter:brightness(1.1)}
button:disabled{opacity:.35;cursor:default}
button:focus-visible,input:focus-visible{outline:2px solid var(--cyan);outline-offset:3px}
#e{min-height:1.2rem;font:500 11px var(--mono);letter-spacing:.08em;color:#ff4436}
.f{display:flex;align-items:center;gap:12px;padding:9px 14px;border-top:1px dashed var(--hair-hi);font:500 9px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:#77776f}
.f span:last-child{margin-left:auto}
.f i{display:inline-block;width:3px;background:var(--cyan)}
.f i:nth-child(1){height:30%}.f i:nth-child(2){height:48%}.f i:nth-child(3){height:66%}.f i:nth-child(4){height:84%}.f i:nth-child(5){height:100%}
.bars{display:inline-flex;align-items:flex-end;gap:2px;height:12px}
main.s{animation:s .35s}@keyframes s{25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
@media (prefers-reduced-motion:reduce){main.s{animation:none}}
</style></head><body><main id="m"><div class="h"><span>naOS // access</span><span>nateanderson.dev</span></div><div class="b">
<div><h1>${GATE.title}</h1><p style="margin-top:12px">${GATE.hint}</p></div>
<form id="f" autocomplete="off"><label for="p">Password</label><input id="p" type="password" placeholder="••••••••" autofocus required autocomplete="current-password"><button id="b">Unlock</button></form><p id="e" role="alert"></p></div>
<div class="f"><span class="bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span>Locked / signal held</span></div></main>
<script>
var f=document.getElementById("f"),p=document.getElementById("p"),b=document.getElementById("b"),e=document.getElementById("e"),m=document.getElementById("m");
f.addEventListener("submit",function(ev){ev.preventDefault();b.disabled=true;e.textContent="";
fetch("${GATE.unlockPath}",{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify({password:p.value})})
.then(function(r){return r.json().then(function(j){return[r.ok,j]})}).then(function(x){
if(x[0]){location.reload();return}
e.textContent=x[1].error||"Wrong password";p.value="";p.focus();m.classList.remove("s");void m.offsetWidth;m.classList.add("s");b.disabled=false})
.catch(function(){e.textContent="Network error";b.disabled=false})});
</script></body></html>`;
