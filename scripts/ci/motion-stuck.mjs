// Stuck-text check. Usage: node scripts/ci/motion-stuck.mjs http://localhost:3123
// Quick companion to scramble.mjs (which hammers hover and scroll in detail). This one covers the paths that
// check does not: jumping straight to a #hash anchor, a fast scroll to the bottom and back, tabbing through the
// page with the keyboard, and reduced motion. Each must leave every on-screen `data-final` element showing its real
// text within 3 s (reduced motion: at once), never glyphs.
import { createRequire } from "node:module";
import { unlock, waitFor } from "./lib.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const base = process.argv[2].replace(/\/$/, "");
await waitFor(base);
const [cname, cval] = (await unlock(base)).split("=");
const ROUTES = ["/", "/about", "/timeline", "/studies", "/creations", "/creations/games"];
const fails = [];
const fail = (m) => { fails.push(m); console.log("FAIL", m); };

// On-screen scramble targets that are not showing their real text.
const stuck = () =>
    [...document.querySelectorAll("[data-final]")].flatMap((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return [];
        if (getComputedStyle(el).visibility === "hidden") return [];
        return el.textContent === el.getAttribute("data-final") ? [] : [`${el.getAttribute("data-final")} -> ${el.textContent}`];
    });
const SETTLE = 3000;

const browser = await chromium.launch();
for (const [w, h] of [[1440, 900], [390, 844]]) {
    for (const reduced of w > 1000 ? [false, true] : [false]) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: reduced ? "reduce" : "no-preference" });
        await ctx.addCookies([{ name: cname, value: cval, url: base }]);
        const page = await ctx.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(String(e)));
        for (const route of ROUTES) {
            const tag = `${w}${reduced ? " reduced" : ""} ${route}`;
            await page.goto(base + route, { waitUntil: "load" });
            await page.waitForTimeout(reduced ? 600 : 2200);
            if (reduced) {
                const bad = await page.evaluate(stuck);
                if (bad.length) fail(`${tag} reduced motion shows glyphs: ${bad.slice(0, 3).join(" | ")}`);
            } else {
                // jump to each in-page anchor in turn
                const hashes = await page.evaluate(() =>
                    [...new Set([...document.querySelectorAll('a[href^="#"], a[href*="#"]')].map((a) => a.getAttribute("href")).filter((x) => x && /^(#|\/[^#]*#)./.test(x)))].slice(0, 3));
                for (const hv of hashes) {
                    const id = hv.slice(hv.indexOf("#") + 1);
                    await page.evaluate((i) => document.getElementById(i)?.scrollIntoView(), id);
                    await page.waitForTimeout(SETTLE);
                    const bad = await page.evaluate(stuck);
                    if (bad.length) fail(`${tag} after jump to #${id}: ${bad.slice(0, 3).join(" | ")}`);
                }
                // fast scroll to the bottom and back
                const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
                for (let i = 0; i < 4; i++) {
                    await page.evaluate((v) => scrollTo(0, v), i % 2 ? 0 : total);
                    await page.waitForTimeout(80);
                }
                await page.waitForTimeout(SETTLE);
                const bad = await page.evaluate(stuck);
                if (bad.length) fail(`${tag} after fast scroll: ${bad.slice(0, 3).join(" | ")}`);
            }
            // tab through the first 25 focusable things
            await page.evaluate(() => scrollTo(0, 0));
            for (let i = 0; i < 25; i++) await page.keyboard.press("Tab");
            await page.waitForTimeout(reduced ? 300 : SETTLE);
            const bad = await page.evaluate(stuck);
            if (bad.length) fail(`${tag} after tabbing: ${bad.slice(0, 3).join(" | ")}`);
        }
        if (errors.length) fail(`${w}${reduced ? " reduced" : ""} page errors: ${errors.slice(0, 2).join(" | ")}`);
        await ctx.close();
    }
}
await browser.close();
if (fails.length) {
    console.log(`\n${fails.length} stuck-text check(s) failed`);
    process.exit(1);
}
console.log("stuck-text checks passed");
