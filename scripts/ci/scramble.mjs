// Scramble regression check. Usage: node scripts/ci/scramble.mjs http://localhost:3123
// Hammers hover, scrolling and client navigation, then asserts that
//  1. every scramble target that is on screen and at rest shows its real text, never glyphs;
//  2. a hover scramble plays once per hover: resting on it or moving between its children does not re-run it,
//     and it plays again only after the pointer has left and come back.
import { createRequire } from "node:module";
import { unlock, waitFor } from "./lib.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const base = process.argv[2].replace(/\/$/, "");
await waitFor(base);
const [cname, cval] = (await unlock(base)).split("=");
const ROUTES = ["/", "/about", "/history", "/studies", "/timeline", "/creations/projects", "/creations/games"];
const SIZES = [{ w: 1440, h: 900 }, { w: 390, h: 844 }];
const fails = [];
const fail = (m) => { fails.push(m); console.log("FAIL", m); };

// Every target on screen that does not show its real text.
const stuck = () =>
    [...document.querySelectorAll("[data-final]")].flatMap((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth || !r.width) return [];
        // clipped away by a scrolling or overflow-hidden ancestor (a gantt bar scrolled sideways): not visible
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
            const o = getComputedStyle(a).overflowX;
            if (o !== "visible") {
                const ar = a.getBoundingClientRect();
                if (r.right <= ar.left + 1 || r.left >= ar.right - 1) return [];
            }
        }
        // Lines still entering at the bottom edge are allowed to be mid-decode; everything above it must be resolved.
        if (r.top > innerHeight * 0.92) return [];
        return el.textContent === el.getAttribute("data-final") ? [] : [`${el.getAttribute("data-final")} -> ${el.textContent}`];
    });

const browser = await chromium.launch();
for (const sz of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: sz.w, height: sz.h } });
    await ctx.addCookies([{ name: cname, value: cval, url: base }]);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    for (const route of ROUTES) {
        const tag = `${sz.w} ${route}`;
        await page.goto(base + route, { waitUntil: "load" });
        await page.waitForTimeout(2600);
        // scroll in steps and stop at each one: nothing on screen may rest as glyphs
        const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
        for (let y = 0; y <= total; y += Math.max(70, Math.floor(sz.h / 7))) {
            await page.evaluate((v) => scrollTo(0, v), y);
            await page.waitForTimeout(900);
            const bad = await page.evaluate(stuck);
            if (bad.length) fail(`${tag} @${y} resting glyphs: ${bad.slice(0, 3).join(" | ")}`);
        }
        // fling up and down, then rest
        for (let i = 0; i < 6; i++) {
            await page.evaluate((v) => scrollTo(0, v), i % 2 ? 0 : total);
            await page.waitForTimeout(90);
        }
        await page.waitForTimeout(1500);
        const bad = await page.evaluate(stuck);
        if (bad.length) fail(`${tag} after fling: ${bad.slice(0, 3).join(" | ")}`);
    }

    // hover: once per enter
    if (sz.w >= 1000) {
        await page.goto(base + "/", { waitUntil: "load" });
        await page.waitForTimeout(2600);
        await page.evaluate(() => scrollTo(0, 0));
        const n = await page.locator("[data-scr-hover]").count();
        for (let i = 0; i < n; i++) {
            const loc = page.locator("[data-scr-hover]").nth(i);
            if (!(await loc.isVisible())) continue;
            await loc.scrollIntoViewIfNeeded();
            const box = await loc.boundingBox();
            await page.mouse.move(2, 2);
            await page.waitForTimeout(150);
            await page.evaluate((idx) => {
                const el = document.querySelectorAll("[data-scr-hover]")[idx];
                const t = el.querySelector("[data-scr-text]") || el;
                window.__muts = 0;
                window.__mo?.disconnect();
                window.__mo = new MutationObserver((m) => (window.__muts += m.length));
                window.__mo.observe(t, { childList: true, characterData: true, subtree: true });
            }, i);
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
            await page.waitForTimeout(1000);
            const first = await page.evaluate(() => window.__muts);
            if (!first) fail(`hover ${i}: no scramble on enter`);
            // rest and wander across the element: no further runs
            for (const fx of [0.15, 0.85, 0.5, 0.3, 0.7]) {
                await page.mouse.move(box.x + box.width * fx, box.y + box.height * fx, { steps: 3 });
                await page.waitForTimeout(250);
            }
            await page.waitForTimeout(600);
            const after = await page.evaluate(() => window.__muts);
            if (after !== first) fail(`hover ${i}: re-triggered while pointer stayed over it (${first} -> ${after})`);
            // leave, re-enter: plays again
            await page.mouse.move(2, 2, { steps: 4 });
            await page.waitForTimeout(200);
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
            await page.waitForTimeout(1000);
            const again = await page.evaluate(() => window.__muts);
            if (again <= after) fail(`hover ${i}: did not play again after leaving and returning`);
            const txt = await page.evaluate((idx) => {
                const el = document.querySelectorAll("[data-scr-hover]")[idx];
                const t = el.querySelector("[data-scr-text]") || el;
                return [t.textContent, t.getAttribute("data-final")];
            }, i);
            if (txt[1] && txt[0] !== txt[1]) fail(`hover ${i}: ended on "${txt[0]}" instead of "${txt[1]}"`);
        }
        // hammer: sweep the pointer across every hover target many times, then everything must settle
        for (let k = 0; k < 6; k++) {
            for (let i = 0; i < n; i++) {
                const box = await page.locator("[data-scr-hover]").nth(i).boundingBox();
                if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 2 });
            }
            await page.mouse.move(2, 2, { steps: 2 });
        }
        await page.waitForTimeout(1800);
        const left = await page.evaluate(stuck);
        if (left.length) fail(`after hammer, not on real text: ${left.slice(0, 4).join(" | ")}`);
    }

    // client navigation mid-scramble
    await page.goto(base + "/", { waitUntil: "load" });
    await page.waitForTimeout(2200);
    for (let i = 0; i < 4; i++) {
        for (const href of ["/about", "/studies", "/"]) {
            await page.evaluate((h) => document.querySelector(`a[href="${h}"]`)?.click(), href);
            await page.waitForTimeout(260);
        }
    }
    await page.waitForTimeout(3000);
    const bad = await page.evaluate(stuck);
    if (bad.length) fail(`${sz.w} after navigation hammer: ${bad.slice(0, 3).join(" | ")}`);
    if (errors.length) fail(`${sz.w} page errors: ${errors.slice(0, 2).join(" | ")}`);
    await ctx.close();
}
await browser.close();
if (fails.length) {
    console.log(`\n${fails.length} scramble check(s) failed`);
    process.exit(1);
}
console.log("scramble checks passed");
