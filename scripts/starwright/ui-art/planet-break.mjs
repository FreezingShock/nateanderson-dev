// Screenshots of planets breaking apart in a neutron star: blast, chunks cooling, chunks gone, at 1440 and 390.
// Usage: node scripts/starwright/ui-art/planet-break.mjs <outDir>   (server on BASE, gate password in SITE_PASSWORD)
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = process.argv[2] ?? ".";
const errors = [];
const browser = await chromium.launch();
for (const [tag, vp] of [["1440", { width: 1440, height: 900 }], ["390", { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: tag === "390", isMobile: tag === "390" });
    await ctx.request.post(`${BASE}/api/gate`, { data: { password: process.env.SITE_PASSWORD ?? "ci-password" }, headers: { origin: BASE } });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error" || /Warning:/.test(m.text())) errors.push(`${tag}: ${m.text()}`); });
    page.on("pageerror", (e) => errors.push(`${tag}: ${e.message}`));
    await page.goto(`${BASE}/creations/games/starwright`);
    await page.waitForFunction(() => localStorage.getItem("sw-save-v1"), null, { timeout: 30000 });
    const base = await page.evaluate(() => localStorage.getItem("sw-save-v1"));
    // a star with three planets in orbit and enough stardust in the layer for a neutron star
    await page.addInitScript((raw) => {
        const s = JSON.parse(raw);
        s.stardust = 7000; s.sdLayer = 7000; s.sdAll = 7000; s.novas = 3; s.novasAll = 3;
        s.planets = ["ember", "glass", "cinder"]; s.planetAge = { ember: 900, glass: 600, cinder: 300 };
        localStorage.setItem("sw-save-v1", JSON.stringify(s));
    }, base);
    await page.reload();
    await page.waitForSelector(".sw-ladder");
    await page.waitForTimeout(8000); // let the lazy sheets (fx/planet-gone) download
    await page.screenshot({ path: `${OUT}/0-before-${tag}.png` });
    const go = page.locator(".sw-go2");
    await go.scrollIntoViewIfNeeded();
    // screenshots are too slow to catch a 2 s effect, so record the scene canvas from inside the page every 100 ms and keep the frames we want
    await page.evaluate(() => {
        const c = document.querySelector("canvas.sw-canvas");
        window.__frames = [];
        const t0 = performance.now();
        const grab = () => {
            const t = performance.now() - t0;
            const o = document.createElement("canvas"); o.width = c.width * 4; o.height = c.height * 4;
            const g = o.getContext("2d"); g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, o.width, o.height);
            window.__frames.push([Math.round(t), o.toDataURL("image/png")]);
            if (t < 3200) setTimeout(grab, 100);
        };
        window.__grab = grab;
    });
    await go.click();
    await page.evaluate(() => window.__grab());
    await go.click();
    await page.waitForTimeout(3600);
    const frames = await page.evaluate(() => window.__frames);
    const { writeFileSync } = await import("node:fs");
    const want = [["1-blast", 150], ["2-chunks-flying", 700], ["3-chunks-cooling", 1300], ["4-chunks-gone", 2800]];
    for (const [name, ms] of want) {
        const f = frames.reduce((a, b) => (Math.abs(b[0] - ms) < Math.abs(a[0] - ms) ? b : a));
        writeFileSync(`${OUT}/${name}-${tag}.png`, Buffer.from(f[1].split(",")[1], "base64"));
    }
    await ctx.close();
}
await browser.close();
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("ok");
