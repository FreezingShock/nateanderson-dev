// Top bar check: one row at every desktop width, nothing overflowing, rates under their boxes. Screenshots per width.
// Usage: SITE_PASSWORD=ci-password node scripts/automation/topbar-check.mjs <base> <outDir> <tag>
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const [base, out, tag = "after"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const r = await fetch(`${base}/api/gate`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ password: process.env.SITE_PASSWORD || "ci-password" }) });
const cookie = r.headers.getSetCookie().find((s) => s.startsWith("site_unlock=")).split(";")[0].split("=")[1];
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
let fails = 0;
for (const [w, h, phone] of [[1920, 1000, false], [1440, 900, false], [1280, 800, false], [1024, 768, false], [800, 700, false], [390, 844, true]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: phone, isMobile: phone });
    await ctx.addCookies([{ name: "site_unlock", value: cookie, url: base }]);
    await ctx.addInitScript(() => localStorage.setItem("brasswork-first-run-v1", "done"));
    const page = await ctx.newPage();
    await page.goto(`${base}/creations/games/brasswork?bwdev=1`);
    await page.waitForSelector("canvas", { timeout: 120000 });
    await page.waitForTimeout(3500);
    // Give a few items a rate so the rate text shows.
    await page.evaluate(() => { const wd = window.__bwdev.getWorld(); wd.buildings[wd.hubId].input.iron_ingot = 21; window.__bwdev.refresh(); });
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
        const top = document.querySelector(".ab-top").getBoundingClientRect();
        const kids = [...document.querySelectorAll(".ab-top > *")].filter((e) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== "none");
        const rows = new Set(kids.map((e) => Math.round(e.getBoundingClientRect().top / 10)));
        const nav = document.querySelector(".ab-nav");
        const btnTops = nav && getComputedStyle(nav).display !== "none" ? new Set([...nav.children].map((b) => Math.round(b.getBoundingClientRect().top))) : null;
        const over = kids.some((e) => e.getBoundingClientRect().right > innerWidth + 1 || e.getBoundingClientRect().left < -1);
        return { topH: Math.round(top.height), over, sideScroll: document.documentElement.scrollWidth > innerWidth, rowCount: rows.size, navRows: btnTops ? btnTops.size : "hidden", inset: getComputedStyle(document.querySelector(".ab-root")).getPropertyValue("--ab-top-h") };
    });
    const ok = !m.over && !m.sideScroll && (m.navRows === "hidden" || m.navRows === 1);
    console.log(ok ? "PASS" : "FAIL", `${w}px`, JSON.stringify(m));
    if (!ok) fails++;
    await page.screenshot({ path: `${out}/topbar-${tag}-${w}.png`, clip: { x: 0, y: 0, width: w, height: w > 760 ? 130 : 300 } });
    await ctx.close();
}
await browser.close();
process.exit(fails ? 1 : 0);
