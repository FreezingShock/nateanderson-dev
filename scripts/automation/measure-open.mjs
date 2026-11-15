// Opening-view check: with the Machines dock open, where does the first drill node land on screen and is it clear of the dock?
// Usage: SITE_PASSWORD=ci-password node scripts/automation/measure-open.mjs <base> <width> <height> [screenshot.png]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const [base, w, h, shot] = process.argv.slice(2);
const r = await fetch(`${base}/api/gate`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ password: process.env.SITE_PASSWORD || "ci-password" }) });
const cookie = r.headers.getSetCookie().find((s) => s.startsWith("site_unlock=")).split(";")[0].split("=")[1];
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h } });
await ctx.addCookies([{ name: "site_unlock", value: cookie, url: base }]);
const page = await ctx.newPage();
await page.goto(`${base}/creations/games/brasswork?bwdev=1`);
await page.waitForSelector("canvas", { timeout: 120000 });
await page.waitForTimeout(5000);
await page.click('button:has-text("Machines")');
await page.waitForTimeout(1200);
const m = await page.evaluate(() => {
    const dock = [...document.querySelectorAll("[class*=dock], [class*=popover], aside, [role=dialog]")].map((e) => e.getBoundingClientRect()).filter((b) => b.width > 150 && b.height > 150);
    const marker = document.querySelector("[class*=next-marker], [class*=nextMarker], [class*=bw-next]");
    const node = window.__bwdev.cellPx(2, 2);
    const right = Math.max(...dock.filter((b) => b.left < 300).map((b) => b.right), 0);
    return { node, dockRight: right, marker: marker?.getBoundingClientRect().toJSON?.() };
});
console.log(JSON.stringify(m));
if (shot) await page.screenshot({ path: shot });
await browser.close();
