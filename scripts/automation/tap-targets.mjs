// Phone tap-target audit: lists every visible interactive element under 44 CSS px (width or height) in each phone state.
// Usage: SITE_PASSWORD=ci-password node scripts/automation/tap-targets.mjs <base> <outDir>
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
await page.goto(`${base}/creations/games/brasswork?bwdev=1`);
await page.waitForSelector("canvas", { timeout: 120000 });
await page.waitForTimeout(4000);
const small = () => page.evaluate(() => {
    const sel = 'button, a[href], [role="button"], [role="tab"], input, select, summary, [tabindex="0"]';
    const bad = [];
    for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.width === 0 || r.height === 0 || cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0 || cs.pointerEvents === "none") continue;
        if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
        if (el.closest("nextjs-portal, [data-nextjs-toast]")) continue;
        if (r.width < 43.5 || r.height < 43.5) bad.push({ label: (el.getAttribute("aria-label") || el.textContent || el.className || el.tagName).toString().trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) });
    }
    return bad;
});
const report = {};
report["main view"] = await small();
await page.screenshot({ path: `${out}/tap-main-390.png` });
const states = [["Machines"], ["Milestones"], ["Research"], ["More"]];
for (const [name] of states) {
    await page.locator(`button:visible:has-text("${name}")`).first().tap().catch(() => {});
    await page.waitForTimeout(900);
    report[`${name} sheet`] = await small();
    await page.screenshot({ path: `${out}/tap-${name.toLowerCase()}-390.png` });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    const close = page.locator('button[aria-label*="Close" i]:visible').first();
    if (await close.count()) await close.tap().catch(() => {});
    await page.waitForTimeout(500);
}
for (const item of ["Hub", "Prestige", "Expedition", "Production stats", "Settings"]) {
    await page.locator('button:visible:has-text("More")').first().tap().catch(() => {});
    await page.waitForTimeout(700);
    await page.locator(`button:visible:text-is("${item}"), [role=menuitem]:visible:has-text("${item}")`).first().tap().catch(() => {});
    await page.waitForTimeout(1000);
    report[`${item} window`] = await small();
    await page.screenshot({ path: `${out}/tap-${item.toLowerCase().replace(/ /g, "-")}-390.png` });
    const close = page.locator("button.bw-window-close:visible").first();
    if (await close.count()) await close.tap().catch(() => {}); else await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
}
let total = 0;
for (const [k, v] of Object.entries(report)) { total += v.length; console.log(`${k}: ${v.length} under 44 px`); for (const b of v) console.log(`   ${b.w}x${b.h}  ${b.label}`); }
await browser.close();
process.exit(total ? 1 : 0);
