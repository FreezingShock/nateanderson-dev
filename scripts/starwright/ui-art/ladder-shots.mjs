// Ladder row fit check: screenshots the ladder at 1440 and 390 and reports any text that runs under a buy button.
// Run against a production server on :3100: node scripts/starwright/ui-art/ladder-shots.mjs <tag> <savefile.json> <outdir>
import { createRequire } from "node:module"; import { readFileSync } from "node:fs";
const { chromium } = createRequire(process.cwd() + "/package.json")("playwright");
const [tag0, saveFile, out] = process.argv.slice(2); const BASE = "http://localhost:3100";
const late = JSON.parse(readFileSync(saveFile, "utf8"));
const b = await chromium.launch(); let bad = 0;
for (const [tag, vp, mob] of [["1440", { width: 1440, height: 900 }, false], ["390", { width: 390, height: 844 }, true]]) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: mob, isMobile: mob, deviceScaleFactor: mob ? 2 : 1 });
  await ctx.request.post(BASE + "/api/gate", { data: { password: "ci-password" }, headers: { origin: BASE } });
  const p = await ctx.newPage();
  await p.addInitScript((s) => { if (localStorage.getItem("sw-save-v1")) return; s.savedAt = Date.now(); localStorage.setItem("sw-save-v1", JSON.stringify(s)); }, late);
  await p.goto(BASE + "/creations/games/starwright"); await p.waitForSelector(".sw-ladder"); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => [...document.querySelectorAll(".sw-row")].map((row) => {
    const btn = row.querySelector(".sw-btn"); const info = row.querySelector(".sw-info"); if (!btn || !info) return null;
    const bl = btn.getBoundingClientRect().left; let over = 0;
    for (const el of info.querySelectorAll("*")) { const rg = document.createRange(); rg.selectNodeContents(el); for (const q of rg.getClientRects()) if (q.width && q.right > bl + 0.5) over = Math.max(over, q.right - bl); }
    return { name: info.textContent.slice(0, 14), over: Math.round(over) };
  }).filter(Boolean));
  bad += r.filter((x) => x.over > 0).length; console.log(tag, JSON.stringify(r.filter((x) => x.over > 0)), r.length, "rows");
  await p.locator(".sw-ladder").scrollIntoViewIfNeeded();
  await p.locator(".sw-ladder").screenshot({ path: `${out}/ladder-${tag0}-${tag}.png` });
  await ctx.close();
}
await b.close(); process.exit(bad ? 1 : 0);
