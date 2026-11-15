// Phone sheet check: opens each bottom sheet at 390 wide, screenshots the open frame, then the first frames of the exit, then confirms the sheet is gone.
// Usage: SITE_PASSWORD=ci-password node scripts/automation/phone-sheets.mjs <base> <outDir>
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const [base, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const r = await fetch(`${base}/api/gate`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ password: process.env.SITE_PASSWORD || "ci-password" }) });
const cookie = r.headers.getSetCookie().find((s) => s.startsWith("site_unlock=")).split(";")[0].split("=")[1];
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
await ctx.addCookies([{ name: "site_unlock", value: cookie, url: base }]);
await ctx.addInitScript(() => localStorage.setItem("brasswork-first-run-v1", "done"));
const page = await ctx.newPage();
const errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await page.goto(`${base}/creations/games/brasswork?bwdev=1`);
await page.waitForSelector("canvas", { timeout: 120000 });
await page.waitForTimeout(4000);
let fails = 0;
const ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) fails++; };
for (const [tab, sel] of [["Machines", ".ab-pal"], ["Milestones", ".ab-factory"], ["More", ".ab-more"]]) {
    const btn = page.locator(`.ab-tab:has-text("${tab}")`).first();
    await btn.tap();
    await page.waitForTimeout(700);
    const open = await page.locator(`${sel}:visible`).count();
    await page.screenshot({ path: `${out}/${tab.toLowerCase()}-open-390.png` });
    await btn.tap();
    await page.waitForTimeout(70);
    const mid = await page.evaluate((s) => { const el = document.querySelector(s); return el ? { op: Number(getComputedStyle(el).opacity), anim: getComputedStyle(el).animationName } : null; }, sel);
    await page.screenshot({ path: `${out}/${tab.toLowerCase()}-closing-390.png` });
    await page.waitForTimeout(500);
    const gone = await page.locator(`${sel}:visible`).count();
    ok(open > 0, `${tab} sheet opens`);
    ok(!!mid && /out/.test(mid.anim), `${tab} plays an exit (${JSON.stringify(mid)})`);
    ok(gone === 0, `${tab} sheet is gone afterwards`);
}
ok(errs.length === 0, `no console errors ${errs.slice(0, 2).join(" | ")}`);
await browser.close();
process.exit(fails ? 1 : 0);
