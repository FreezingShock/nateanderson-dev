// Hub delivery light column check: close-up of the hub, a delivery burst at day and at night, with Low fx on and off,
// plus frame time with and without bursts. Usage: SITE_PASSWORD=ci-password node scripts/automation/delivery-light.mjs <base> <width> <height> <outDir>
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const [base, w, h, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const r = await fetch(`${base}/api/gate`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ password: process.env.SITE_PASSWORD || "ci-password" }) });
const cookie = r.headers.getSetCookie().find((s) => s.startsWith("site_unlock=")).split(";")[0].split("=")[1];
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const log = [];
async function run(mood, lowFx) {
    const ctx = await browser.newContext({ viewport: { width: +w, height: +h } });
    await ctx.addCookies([{ name: "site_unlock", value: cookie, url: base }]);
    await ctx.addInitScript(([mood, lowFx]) => {
        localStorage.setItem("bw-mood-v1", mood);
        localStorage.setItem("bw-settings-v1", JSON.stringify({ sound: false, reduceMotion: false, lowFx, showRates: true, numberFormat: "short" }));
        localStorage.setItem("bw-first-run-v1", "done");
    }, [mood, lowFx]);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${base}/creations/games/brasswork?bwdev=1`);
    await page.waitForSelector("canvas", { timeout: 120000 });
    await page.waitForTimeout(4000);
    const hub = await page.evaluate(() => {
        const wd = window.__bwdev.getWorld();
        const b = Object.values(wd.buildings).find((x) => x.type === "hub");
        return [b.x - 1 + 1.5 - 9, b.z - 1 + 1.5 - 6];
    });
    // Zoom the real input camera toward the hub (wheel at the hub's screen position).
    const hp = await page.evaluate(() => { const wd = window.__bwdev.getWorld(); const b = Object.values(wd.buildings).find((x) => x.type === "hub"); return window.__bwdev.cellPx(b.x + 1, b.z + 1); });
    await page.mouse.move(hp.x, hp.y);
    for (let i = 0; i < 2; i++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(150); }
    await page.waitForTimeout(1200);
    const tag = `${mood.toLowerCase()}${lowFx ? "-lowfx" : ""}`;
    await page.evaluate(([x, z]) => window.__bwLife.burst("delivery", x, z), hub);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/delivery-${tag}-a-${w}.png` });
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${out}/delivery-${tag}-b-${w}.png` });
    // Frame time: 3 s idle, then 3 s with a burst every 0.5 s.
    const frames = (burst) => page.evaluate(async ([burst, hub]) => {
        let n = 0, t0 = performance.now(), last = t0;
        const iv = burst ? setInterval(() => window.__bwLife.burst("delivery", hub[0], hub[1]), 500) : 0;
        await new Promise((res) => { const f = () => { n++; if (performance.now() - t0 > 3000) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
        if (iv) clearInterval(iv);
        return (performance.now() - t0) / n;
    }, [burst, hub]);
    const idle = await frames(false);
    const busy = await frames(true);
    log.push({ mood, lowFx, idleMsPerFrame: +idle.toFixed(1), burstMsPerFrame: +busy.toFixed(1), errors: errors.length });
    await ctx.close();
}
await run("Day", false);
await run("Night", false);
await run("Night", true);
console.log(JSON.stringify(log, null, 1));
await browser.close();
