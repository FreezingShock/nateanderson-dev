// Headless frame-time check for the Brasswork voxel renderer.
// Usage: BASE_URL=http://localhost:3000 SITE_PASSWORD=... node scripts/voxel-island-bench.mjs [outDir]
// Software WebGL (SwiftShader) is far slower than a phone GPU, so these numbers prove the code
// runs and show relative cost between presets. They are not device timings.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PASSWORD = process.env.SITE_PASSWORD || "dean";
const outDir = process.argv[2] || "bench-out";
mkdirSync(outDir, { recursive: true });

const runs = [
  { name: "desktop-high", viewport: { width: 1440, height: 900 }, query: "quality=2&machines=400" },
  { name: "desktop-low", viewport: { width: 1440, height: 900 }, query: "quality=0&machines=400" },
  { name: "desktop-auto", viewport: { width: 1440, height: 900 }, query: "quality=auto&machines=400" },
  { name: "phone-auto", viewport: { width: 390, height: 844 }, query: "quality=auto&machines=400", mobile: true },
  { name: "phone-low-fx", viewport: { width: 390, height: 844 }, query: "quality=0&lowfx=1&machines=400", mobile: true },
];

const browser = await chromium.launch({ args: ["--ignore-gpu-blocklist", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
const results = [];

for (const run of runs) {
  const context = await browser.newContext({
    viewport: run.viewport,
    deviceScaleFactor: 1,
    isMobile: !!run.mobile,
    hasTouch: !!run.mobile,
  });
  const unlock = await context.request.post(`${BASE}/api/gate`, {
    data: { password: PASSWORD },
    headers: { origin: BASE },
  });
  if (!unlock.ok()) throw new Error(`gate unlock failed: ${unlock.status()}`);

  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(`${BASE}/dev/voxel-island?${run.query}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__voxelBench?.ready === true, null, { timeout: 120000 });
  await page.waitForTimeout(6000);

  const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  const stats = await page.evaluate(() => window.__voxelBench.stats());
  await page.waitForTimeout(3000);
  const later = await page.evaluate(() => window.__voxelBench.stats());
  await page.screenshot({ path: join(outDir, `${run.name}.png`) });

  results.push({
    run: run.name,
    quality: later.qualityName,
    frameMsAvg: +later.frameMs.toFixed(1),
    frameMsP95: +later.p95Ms.toFixed(1),
    fps: +later.fps.toFixed(1),
    grass: `${later.grassDrawn}/${later.grassTotal}`,
    chunks: later.chunks,
    drawCalls: later.drawCalls,
    triangles: later.triangles,
    sidewaysScroll: sideways,
    errors: [...new Set(errors)].slice(0, 5),
    startFrameMs: +stats.frameMs.toFixed(1),
  });
  await context.close();
}

await browser.close();
console.table(results.map(({ errors, ...rest }) => ({ ...rest, errors: errors.length })));
for (const r of results) if (r.errors.length) console.log(r.run, "errors:", r.errors);
