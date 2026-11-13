// Browser check of Node Farm on a production build at phone and desktop sizes: the page loads with no script errors,
// nothing scrolls sideways. Usage:
//   node scripts/nodefarm/tree-browser.mjs <base url>
//   (start the build with SITE_PASSWORD=ci-password SITE_GATE_SECRET=x next start -p 3123)
// Exits 1 if any check fails. Safari and audio cannot be run here.
import { createRequire } from "node:module";
import { unlock } from "../ci/lib.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = (process.argv[2] || "http://localhost:3123").replace(/\/$/, "");
const url = `${base}/creations/games/node-farm`;
const cookie = (await unlock(base)).split("=");
const browser = await chromium.launch();
let fails = 0;
const ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) fails++; };
for (const [name, vp, mobile] of [["phone", { width: 390, height: 844 }, true], ["desktop", { width: 1440, height: 900 }, false]]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    await ctx.addCookies([{ name: cookie[0], value: cookie.slice(1).join("="), url: base }]);
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(url, { waitUntil: "networkidle" });
    await p.waitForTimeout(1500);
    ok(errs.length === 0, `${name}: no script errors (${errs.length})`);
    const sideways = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(sideways <= 1, `${name}: no sideways scroll (overflow ${sideways}px)`);
    await ctx.close();
}
await browser.close();
console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
