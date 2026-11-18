// Superseded for the expedition previews by scripts/brasswork/build-site-previews.py (pixel art, 2026-11-16). This 3D still is kept for reference only.
// Renders one picture per prestige site with the game's own renderer (software WebGL is fine for stills).
// Usage: VOXEL_BENCH=1 npm run build && VOXEL_BENCH=1 npm start, then
//   BASE_URL=http://localhost:3000 SITE_PASSWORD=... node scripts/brasswork/render-sites.mjs
// Writes public/brasswork/sites/<id>.png; scripts/brasswork/to-webp.py shrinks them.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const PASSWORD = process.env.SITE_PASSWORD;
if (!PASSWORD) throw new Error("Set SITE_PASSWORD (the site gate password) before running this script.");
const ids = ["ridge", "cove", "high-bank", "quarry"];
mkdirSync("public/brasswork/sites", { recursive: true });
const browser = await chromium.launch({ args: ["--ignore-gpu-blocklist", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
const context = await browser.newContext({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 });
const unlock = await context.request.post(`${BASE}/api/gate`, { data: { password: PASSWORD }, headers: { origin: BASE } });
if (!unlock.ok()) throw new Error(`gate unlock failed: ${unlock.status()}`);
for (const id of ids) {
  const page = await context.newPage();
  await page.goto(`${BASE}/dev/brasswork-site?site=${id}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__siteShot?.ready === true, null, { timeout: 120000 });
  await page.waitForTimeout(5000);
  const url = await page.evaluate(() => window.__siteShot.snap());
  writeFileSync(`public/brasswork/sites/${id}.png`, Buffer.from(url.split(",")[1], "base64"));
  await page.close();
  console.log("rendered", id);
}
await browser.close();
