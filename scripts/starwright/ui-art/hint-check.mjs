// The phone scroll cue: shows once, goes away on the first scroll of the page, and does not come back after a reload.
// Usage: node scripts/starwright/ui-art/hint-check.mjs   (server on BASE, gate password in SITE_PASSWORD)
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://localhost:3100";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await ctx.request.post(`${BASE}/api/gate`, { data: { password: process.env.SITE_PASSWORD ?? "ci-password" }, headers: { origin: BASE } });
const page = await ctx.newPage();
const shown = () => page.locator(".sw-hint2").count();
await page.goto(`${BASE}/creations/games/starwright`);
await page.waitForSelector(".sw-ladder");
await page.waitForTimeout(3500);
const first = await shown();
await page.evaluate(() => window.scrollBy(0, 200));
await page.waitForTimeout(500);
const afterScroll = await shown();
await page.reload();
await page.waitForSelector(".sw-ladder");
await page.waitForTimeout(3500);
const afterReload = await shown();
console.log(JSON.stringify({ first, afterScroll, afterReload }));
await browser.close();
if (!(first === 1 && afterScroll === 0 && afterReload === 0)) process.exit(1);
