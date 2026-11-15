import { createRequire } from "node:module"; import { readFileSync } from "node:fs";
const { chromium } = createRequire("/home/user/nateanderson-dev/package.json")("playwright");
const tag0 = process.argv[2]; const BASE="http://localhost:3100";
const late = JSON.parse(readFileSync("/tmp/claude-0/-home-user/e4886d54-38df-56ff-bff0-38b15da162c2/scratchpad/late.json","utf8"));
const b = await chromium.launch();
for (const [tag,vp,mob] of [["1440",{width:1440,height:900},false],["390",{width:390,height:844},true]]) {
 for (const kind of ["away","comet","flare","nebula","pair"]) {
  const ctx = await b.newContext({ viewport:vp, hasTouch:mob, isMobile:mob, deviceScaleFactor:mob?2:1 });
  await ctx.request.post(BASE+"/api/gate",{data:{password:"ci-password"},headers:{origin:BASE}});
  const p = await ctx.newPage();
  const save = JSON.parse(JSON.stringify(late));
  await p.addInitScript(([s,kind])=>{ if(localStorage.getItem("sw-save-v1")) return; const o=s; o.savedAt = kind==="away" ? Date.now()-150000 : Date.now(); if(kind!=="away"){ o.event={id:kind,left:138}; o.evIn=9999; } localStorage.setItem("sw-save-v1",JSON.stringify(o)); }, [save,kind]);
  await p.goto(BASE+"/creations/games/starwright"); await p.waitForSelector(".sw-ladder"); await p.waitForTimeout(2500);
  const sel = kind==="away" ? ".sw-away" : ".sw-visitor";
  const n = await p.locator(sel).count();
  if (n) await p.screenshot({ path: "/mnt/project-files/portfolio/starwright/cards-"+tag0+"-"+kind+"-"+tag+".png" });
  console.log(tag, kind, n); await ctx.close(); }
}
await b.close();
