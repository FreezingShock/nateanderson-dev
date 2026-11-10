// Screenshots every route at desktop and phone size.
// Usage: node scripts/ci/shots.mjs http://localhost:3123 out-dir   (run from the repo root of the build being served)
import { readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { unlock, waitFor } from "./lib.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const base = process.argv[2].replace(/\/$/, "");
const out = process.argv[3];
mkdirSync(out, { recursive: true });
await waitFor(base);
const cookie = (await unlock(base)).split("=");

const routes = new Set(["/"]);
try {
    const m = JSON.parse(readFileSync(".next/server/app-paths-manifest.json", "utf8"));
    for (const k of Object.keys(m)) if (k.endsWith("/page") && !k.includes("[") && !k.startsWith("/_")) routes.add(k.replace(/\/page$/, "") || "/");
} catch {}
try {
    const pm = JSON.parse(readFileSync(".next/prerender-manifest.json", "utf8"));
    for (const r of Object.keys(pm.routes)) if (!r.includes("opengraph-image") && !/\.\w+$/.test(r)) routes.add(r);
} catch {}

const sizes = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "phone", width: 390, height: 844 },
];
const FREEZE = `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const s of sizes) {
    const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, reducedMotion: "reduce", deviceScaleFactor: 1, timezoneId: "America/Los_Angeles", locale: "en-US" });
    await ctx.addCookies([{ name: cookie[0], value: cookie.slice(1).join("="), url: base }]);
    for (const r of [...routes].sort()) {
        const page = await ctx.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        try {
            await page.goto(base + r, { waitUntil: "networkidle", timeout: 30000 });
            await page.addStyleTag({ content: FREEZE });
            await page.waitForTimeout(1200);
            const file = `${out}/${s.name}__${r === "/" ? "home" : r.slice(1).replace(/\//g, "-")}.png`;
            await page.screenshot({ path: file });
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            if (overflow > 1) console.log(`WARN sideways scroll ${overflow}px on ${s.name} ${r}`);
            if (errors.length) console.log(`WARN script error on ${s.name} ${r}: ${errors[0]}`);
        } catch (e) {
            console.log(`FAIL ${s.name} ${r}: ${e.message}`);
        }
        await page.close();
    }
    await ctx.close();
}
await browser.close();
console.log(`Shot ${routes.size} routes x ${sizes.length} sizes into ${out}`);
