// Renders one voxel model to a PNG through the preview page.
// Usage: BASE_URL=http://localhost:3000 SITE_PASSWORD=... node scripts/voxel-model-preview.mjs <id> <out.png> [state] [width] [height]
// The page only exists in dev, or in a production build made with VOXEL_BENCH=1.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const [id, out, state = "always", width = "960", height = "720"] =
    process.argv.slice(2);
if (!id || !out) {
    console.error(
        "usage: node scripts/voxel-model-preview.mjs <id> <out.png> [state] [width] [height]"
    );
    process.exit(1);
}
const BASE = process.env.BASE_URL || "http://localhost:3000";
const PASSWORD = process.env.SITE_PASSWORD || "dean";

const browser = await chromium.launch({
    args: [
        "--ignore-gpu-blocklist",
        "--enable-unsafe-swiftshader",
        "--use-angle=swiftshader",
    ],
});
const context = await browser.newContext({
    viewport: { width: Number(width), height: Number(height) },
    deviceScaleFactor: 2,
});
const unlock = await context.request.post(`${BASE}/api/gate`, {
    data: { password: PASSWORD },
    headers: { origin: BASE },
});
if (!unlock.ok()) throw new Error(`gate unlock failed: ${unlock.status()}`);
const page = await context.newPage();
await page.goto(
    `${BASE}/dev/voxel-model?id=${encodeURIComponent(id)}&state=${encodeURIComponent(state)}`,
    { waitUntil: "load" }
);
await page.waitForFunction(
    () =>
        window.__modelPreview?.ready === true ||
        document.querySelector("p") !== null,
    null,
    { timeout: 60000 }
);
const dataUrl = await page.evaluate(() =>
    window.__modelPreview ? window.__modelPreview.snapshot() : null
);
if (!dataUrl) {
    const text = await page.textContent("p");
    console.error(text);
    process.exit(2);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.from(dataUrl.split(",")[1], "base64"));
console.log("wrote", out);
await browser.close();
