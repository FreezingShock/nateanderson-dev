// Orbit panel with every planet owned (and one older, so stages differ), 1440 and 390. Run after the sheets have had time to load.
// Usage: node scripts/starwright/ui-art/orbit-shots.mjs <outDir>   (server on BASE, gate password in SITE_PASSWORD)
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = process.argv[2] ?? ".";
const IDS = ["ember", "cinder", "glass", "thule", "ironclad", "orrery", "haze", "seer"];
const errors = [];
const browser = await chromium.launch();
for (const [tag, vp] of [["1440", { width: 1440, height: 900 }], ["390", { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: tag === "390", isMobile: tag === "390" });
    await ctx.request.post(`${BASE}/api/gate`, { data: { password: process.env.SITE_PASSWORD ?? "ci-password" }, headers: { origin: BASE } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${tag}: ${e.message}`));
    await page.goto(`${BASE}/creations/games/starwright`);
    await page.waitForFunction(() => localStorage.getItem("sw-save-v1"), null, { timeout: 30000 });
    const base = await page.evaluate(() => localStorage.getItem("sw-save-v1"));
    await page.addInitScript(([raw, ids]) => {
        const s = JSON.parse(raw);
        s.planets = ids; s.planetAge = Object.fromEntries(ids.map((id, i) => [id, i * 90]));
        localStorage.setItem("sw-save-v1", JSON.stringify(s));
    }, [base, IDS]);
    await page.reload();
    await page.waitForSelector(".sw-ladder");
    await page.waitForTimeout(12000); // lazy sheets
    await page.getByRole("button", { name: "Orbit", exact: true }).click();
    await page.waitForTimeout(1200);
    // a tile that still shows the code drawing has a flat dark background (11,9,22); drawn sheets are transparent over the tile
    const flat = await page.$$eval(".sw-sprite", (cs) => cs.map((c) => { const d = c.getContext("2d").getImageData(0, 0, 1, 1).data; return d[3] === 255 && d[0] === 11 && d[1] === 9 && d[2] === 22; }));
    console.log(tag, "tiles", flat.length, "code fallback", flat.filter(Boolean).length);
    await page.screenshot({ path: `${OUT}/orbit-all-${tag}.png` });
    await ctx.close();
}
await browser.close();
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
