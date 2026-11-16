import { createRequire } from "node:module"; import { readFileSync } from "node:fs";
const { chromium } = createRequire("/home/user/nateanderson-dev/package.json")("playwright");
const late = JSON.parse(readFileSync("/tmp/claude-0/-home-user/e4886d54-38df-56ff-bff0-38b15da162c2/scratchpad/late.json","utf8")); const BASE="http://localhost:3100"; const tag0=process.argv[2];
const b = await chromium.launch();
for (const [tag,vp,mob] of [["1440",{width:1440,height:900},false],["390",{width:390,height:844},true]]) {
 for (const cloud of ["none","dense","hot","rich","thin","dusty","quiet"]) {
  const ctx = await b.newContext({ viewport:vp, hasTouch:mob, isMobile:mob, deviceScaleFactor:mob?2:1 });
  await ctx.request.post(BASE+"/api/gate",{data:{password:"ci-password"},headers:{origin:BASE}});
  const p = await ctx.newPage();
  await p.addInitScript(([s,c])=>{ if(localStorage.getItem("sw-save-v1")) return; const o=s; o.savedAt=Date.now(); o.cloud=c==="none"?"":c; localStorage.setItem("sw-save-v1",JSON.stringify(o)); localStorage.setItem("sw-hint-v1","1"); }, [late,cloud]);
  await p.goto(BASE+"/creations/games/starwright"); await p.waitForSelector(".sw-ladder"); await p.waitForTimeout(2500);
  await p.screenshot({ path: "/mnt/project-files/portfolio/starwright/cloud-"+tag0+"-"+cloud+"-"+tag+".png" });
  await ctx.close(); }
}
await b.close();
