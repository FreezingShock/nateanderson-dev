// Frame-time probe. Usage: node scripts/ci/frames.mjs http://localhost:3123
// Scrolls each route at a steady pace and samples rAF intervals. Reports p95 and the share of frames over 50ms,
// then checks reduced motion: every reveal must end fully shown with no motion left running.
import { createRequire } from "node:module";
import { unlock, waitFor } from "./lib.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const base = process.argv[2].replace(/\/$/, "");
await waitFor(base);
const [cname, cval] = (await unlock(base)).split("=");
const ROUTES = ["/", "/about", "/creations/games", "/timeline", "/studies"];
const browser = await chromium.launch();
const bad = [];

for (const [w, h] of [[1440, 900], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.addCookies([{ name: cname, value: cval, url: base }]);
    const page = await ctx.newPage();
    for (const route of ROUTES) {
        await page.goto(base + route, { waitUntil: "load" });
        await page.waitForTimeout(1800);
        const r = await page.evaluate(async () => {
            const gaps = [];
            let last = performance.now();
            let on = true;
            const tick = (t) => {
                if (!on) return;
                gaps.push(t - last);
                last = t;
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
            const max = document.documentElement.scrollHeight - innerHeight;
            for (let y = 0; y <= max; y += 40) {
                scrollTo(0, y);
                await new Promise((res) => requestAnimationFrame(() => res()));
            }
            await new Promise((res) => setTimeout(res, 400));
            on = false;
            const g = gaps.slice(2).sort((a, b) => a - b);
            return {
                frames: g.length,
                p95: g[Math.floor(g.length * 0.95)] || 0,
                over50: g.filter((x) => x > 50).length,
            };
        });
        const share = r.frames ? ((r.over50 / r.frames) * 100).toFixed(1) : "0";
        console.log(`${w} ${route}: ${r.frames} frames, p95 ${r.p95.toFixed(1)}ms, ${share}% over 50ms`);
        if (r.frames && r.over50 / r.frames > 0.05) bad.push(`${w} ${route} janky (${share}% over 50ms)`);
    }
    await ctx.close();
}

// reduced motion: everything shown, nothing left mid-reveal
const rm = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
await rm.addCookies([{ name: cname, value: cval, url: base }]);
const rp = await rm.newPage();
for (const route of ROUTES) {
    await rp.goto(base + route, { waitUntil: "load" });
    await rp.waitForTimeout(800);
    const hidden = await rp.evaluate(() =>
        [...document.querySelectorAll("[data-rx], [data-mx]")].filter((el) => {
            const r = el.getBoundingClientRect();
            return r.height && getComputedStyle(el).opacity === "0";
        }).length,
    );
    if (hidden) bad.push(`reduced motion ${route}: ${hidden} hidden reveal(s)`);
}
await rm.close();
await browser.close();
if (bad.length) {
    console.log("\n" + bad.join("\n"));
    process.exit(1);
}
console.log("frame and reduced-motion checks passed");
