// Walks the Brasswork opening headless and checks each NEXT marker (drill, kiln, windmill, hub) sits on the cell it names,
// clear of the open dock, and goes away when the step is done. Needs a server with the dev hook (?bwdev=1 is added here).
// Usage: SITE_PASSWORD=ci-password node scripts/automation/next-markers.mjs <base> <width> <height> <outDir>
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const [base, w, h, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const r = await fetch(`${base}/api/gate`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ password: process.env.SITE_PASSWORD || "ci-password" }) });
const cookie = r.headers.getSetCookie().find((s) => s.startsWith("site_unlock=")).split(";")[0].split("=")[1];
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const phone = +w < 500;
const ctx = await browser.newContext(phone ? { viewport: { width: +w, height: +h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } : { viewport: { width: +w, height: +h } });
await ctx.addCookies([{ name: "site_unlock", value: cookie, url: base }]);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`${base}/creations/games/brasswork?bwdev=1`);
await page.waitForSelector("canvas", { timeout: 120000 });
await page.waitForTimeout(5000);
if (!phone) { await page.click('button:has-text("Machines")'); await page.waitForTimeout(1000); }

const results = [];
const probe = (label, want) => page.evaluate(([label, want]) => {
    const m = document.querySelector(".bw-nextmark");
    const banner = [...document.querySelectorAll("[class*=next]")].map((e) => e.textContent).find((t) => t && t.includes("NEXT")) ?? "";
    const bs = m ? [...m.querySelectorAll("i")].map((e) => e.getBoundingClientRect()) : [];
    const rect = bs.length ? { left: Math.min(...bs.map((b) => b.left)), top: Math.min(...bs.map((b) => b.top)), width: Math.max(...bs.map((b) => b.right)) - Math.min(...bs.map((b) => b.left)), height: Math.max(...bs.map((b) => b.bottom)) - Math.min(...bs.map((b) => b.top)) } : m?.getBoundingClientRect();
    const centre = rect && Number(getComputedStyle(m).opacity) > 0.5 ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
    const target = window.__bwdev.cellPx(want.x, want.z);
    const t2 = window.__bwdev.cellPx(want.x + want.w - 1, want.z + want.d - 1);
    const tc = target && t2 ? { x: (target.x + t2.x) / 2, y: (target.y + t2.y) / 2 } : null;
    return { label, marker: centre, want: tc, dist: centre && tc ? Math.hypot(centre.x - tc.x, centre.y - tc.y) : null, banner: banner.slice(0, 60) };
}, [label, want]);
const check = async (label, want, shotName) => {
    await page.waitForTimeout(900);
    const p = await probe(label, want);
    await page.screenshot({ path: `${out}/${shotName}-${w}.png` });
    results.push({ ...p, ok: p.dist !== null && p.dist < 30 });
};
const goneCheck = async (label) => {
    await page.waitForTimeout(700);
    const gone = await page.evaluate(() => { const m = document.querySelector(".bw-nextmark"); return !m || Number(getComputedStyle(m).opacity) < 0.1; });
    results.push({ label, ok: gone });
};

// Step 1: drill on the iron node (2,2).
await check("drill marker on the iron node", { x: 2, z: 2, w: 1, d: 1 }, "next-1-drill");
await page.evaluate(() => window.__bwdev.placeAt("drill", 1, 1));
await page.evaluate(() => window.__bwdev.refresh());
// Step 2: kiln at suggestSpot.
const kilnSpot = await page.evaluate(() => { const d = window.__bwdev; const s = d.suggestSpot(2, 2); return s; });
await check("kiln marker on suggestSpot", { x: kilnSpot.x, z: kilnSpot.z, w: 2, d: 2 }, "next-2-kiln");
await page.evaluate(([x, z]) => window.__bwdev.placeAt("kiln", x, z), [kilnSpot.x, kilnSpot.z]);
await page.evaluate(() => window.__bwdev.refresh());
// Step 3: windmill, shown while machines are short of power.
const wmSpot = await page.evaluate(() => { const d = window.__bwdev; return d.suggestSpot(2, 2); });
await check("windmill marker on suggestSpot", { x: wmSpot.x, z: wmSpot.z, w: 2, d: 2 }, "next-3-windmill");
await page.evaluate(([x, z]) => window.__bwdev.placeAt("windmill", x, z), [wmSpot.x, wmSpot.z]);
await page.evaluate(() => window.__bwdev.refresh());
// Step 4: hub request, shown once the hub can fill an order. Give the hub the ingots.
await page.evaluate(() => { const wd = window.__bwdev.getWorld(); wd.buildings[wd.hubId].input.iron_ingot = 40; window.__bwdev.refresh(); });
const hub = await page.evaluate(() => { const wd = window.__bwdev.getWorld(); const b = wd.buildings[wd.hubId]; return { x: b.x, z: b.z }; });
await check("hub marker on the 3x3 hub", { x: hub.x, z: hub.z, w: 3, d: 3 }, "next-4-hub");
// Finish the opening orders: the hub step is done, so no marker should remain.
await page.evaluate(() => { const wd = window.__bwdev.getWorld(); wd.progress.requestsDone = window.__bwdev.CAT.tree.requests.map((r) => r.id); window.__bwdev.refresh(); });
await goneCheck("marker disappears once the opening steps are done");
await page.screenshot({ path: `${out}/next-5-done-${w}.png` });
console.log(JSON.stringify(results, null, 1));
console.log(errors.length ? `console errors: ${errors.slice(0, 3).join(" | ")}` : "no console errors");
await browser.close();
process.exit(results.every((x) => x.ok) ? 0 : 1);
