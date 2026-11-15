// Groundbreak HUD overlap check. Usage: node scripts/ci/gb-hud.mjs http://localhost:3123 out-dir [tag]
// Run it against a production build before merging a HUD, dock or window change. Exits 1 if any HUD parts overlap.
import { createRequire } from "node:module";
import { unlock } from "./lib.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const [base = "http://localhost:3123", out = ".", tag = "x"] = process.argv.slice(2);
const cookie = (await unlock(base)).split("=");
const b = await chromium.launch();
const sizes = [[1440, 900], [390, 844], [360, 740], [375, 667], [844, 390], [932, 430], [667, 375]];
const sel = [".gb-cue button", ".gb-zoom", ".gb-dock", ".gb-feed li", ".gb-job", ".gb-rail-btn"];
let bad = 0;
for (const [w, h] of sizes) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w > 1000 ? 1 : 2, hasTouch: w < 1000 });
    await ctx.addCookies([{ name: cookie[0], value: cookie.slice(1).join("="), url: base }]);
    const p = await ctx.newPage();
    await p.goto(base + "/creations/games/groundbreak", { waitUntil: "networkidle" });
    await p.waitForTimeout(2500);
    const r = await p.evaluate((sel) => {
        const boxes = (s) => [...document.querySelectorAll(s)].map((e) => e.getBoundingClientRect()).filter((q) => q.width && q.height).map((q) => ({ l: q.left, r: q.right, t: q.top, b: q.bottom }));
        const bx = Object.fromEntries(sel.map((s) => [s, boxes(s)]));
        const hit = (a, c) => a.l < c.r - 1 && a.r > c.l + 1 && a.t < c.b - 1 && a.b > c.t + 1;
        const pairs = [];
        for (let i = 0; i < sel.length; i++) for (let j = i + 1; j < sel.length; j++) if (bx[sel[i]].some((a) => bx[sel[j]].some((c) => hit(a, c)))) pairs.push(`${sel[i]} x ${sel[j]}`);
        return { pairs, sw: document.documentElement.scrollWidth };
    }, sel);
    console.log(`${w}x${h}: ${r.pairs.length ? "OVERLAP " + r.pairs.join(", ") : "clear"}`);
    bad += r.pairs.length;
    await p.screenshot({ path: `${out}/hud-${tag}-${w}x${h}.png` });
    await ctx.close();
}
await b.close();
process.exit(bad ? 1 : 0);
