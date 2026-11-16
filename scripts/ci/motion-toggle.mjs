// Live motion toggle check. Usage: node scripts/ci/motion-toggle.mjs http://localhost:3123
// Flips the OS "reduce motion" setting (Windows: Animation effects) on a running page with no reload, and checks that:
//  - off: nothing is left inside a curtain, no text is stuck as glyphs, and clicks navigate at once;
//  - on again: on-screen items settle without a replay, items further down reveal as they scroll in, a click runs the
//    page curtain, and no text is stuck as glyphs.
// Headless Chromium only. Not tested: Safari, Windows, real GPUs.
import { createRequire } from "node:module";
import { unlock, waitFor } from "./lib.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const base = process.argv[2].replace(/\/$/, "");
await waitFor(base);
const [cname, cval] = (await unlock(base)).split("=");
const fails = [];
const ok = (m) => console.log("ok  ", m);
const fail = (m) => {
    fails.push(m);
    console.log("FAIL", m);
};

const stuck = () =>
    [...document.querySelectorAll("[data-final]")].flatMap((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || r.bottom < 0 || r.top > innerHeight) return [];
        return el.textContent === el.getAttribute("data-final") ? [] : [`${el.getAttribute("data-final")} -> ${el.textContent}`];
    });
const settled = async (page, ms) => {
    const end = Date.now() + ms;
    for (;;) {
        const bad = await page.evaluate(stuck);
        if (!bad.length || Date.now() >= end) return bad;
        await page.waitForTimeout(150);
    }
};

const browser = await chromium.launch();
for (const [w, h] of [[1440, 900], [390, 844]]) {
    const tag = `${w}`;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    await ctx.addCookies([{ name: cname, value: cval, url: base }]);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    // 1) Start with animations off, then turn them on without a reload.
    await page.goto(base + "/", { waitUntil: "load" });
    await page.waitForTimeout(400);
    const rxOff = await page.evaluate(() => document.querySelectorAll("[data-rx]").length);
    const inlineOff = await page.evaluate(() => [...document.querySelectorAll("[data-rx]")].filter((el) => el.style.getPropertyValue("--p")).length);
    if (inlineOff) fail(`${tag} reduced: engine still wrote --p on ${inlineOff} items`);
    else ok(`${tag} reduced: engine idle (${rxOff} data-rx items, no inline progress)`);

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForTimeout(120);
    // On-screen items settle: data-in is set at once and no CSS transition runs on them.
    const onScreen = await page.evaluate(() => {
        const els = [...document.querySelectorAll("[data-mx]")].filter((el) => {
            const r = el.getBoundingClientRect();
            return r.bottom > 0 && r.top < innerHeight && r.width;
        });
        return { n: els.length, hidden: els.filter((el) => !el.hasAttribute("data-in")).length, running: document.getAnimations().filter((a) => a.transitionProperty && els.some((el) => el.contains(a.effect?.target))).length };
    });
    if (onScreen.n && onScreen.hidden) fail(`${tag} on: ${onScreen.hidden}/${onScreen.n} on-screen items still hidden`);
    else ok(`${tag} on: ${onScreen.n} on-screen items settled at once (${onScreen.running} transitions running)`);
    if (onScreen.running) fail(`${tag} on: on-screen items replayed a transition (${onScreen.running})`);

    // Items below the fold reveal as they scroll in.
    const below = await page.evaluate(() => {
        const el = [...document.querySelectorAll("[data-mx], [data-rx]")].find((e) => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().top > innerHeight + 200);
        if (!el) return null;
        el.scrollIntoView({ block: "center" });
        return true;
    });
    if (below) {
        await page.waitForTimeout(1200);
        const revealed = await page.evaluate(() => {
            const el = [...document.querySelectorAll("[data-mx], [data-rx]")].find((e) => {
                const r = e.getBoundingClientRect();
                return r.width > 0 && r.top >= 0 && r.top < innerHeight;
            });
            return el ? { mx: el.hasAttribute("data-in") || el.hasAttribute("data-rin"), rx: el.style.getPropertyValue("--p") } : null;
        });
        if (revealed && !revealed.mx && !revealed.rx) fail(`${tag} on: an item that scrolled in never revealed`);
        else ok(`${tag} on: items below the fold reveal on scroll ${JSON.stringify(revealed)}`);
    }
    const bad1 = await settled(page, 2500);
    if (bad1.length) fail(`${tag} on: stuck glyphs ${bad1.slice(0, 3).join(" | ")}`);
    else ok(`${tag} on: no stuck text after scrolling`);

    // 2) The curtain runs again: a nav click sets data-xition straight away.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const link = await page.evaluate(() => {
        const a = [...document.querySelectorAll('a[href^="/"]')].find((x) => x.pathname !== "/" && x.getBoundingClientRect().width && x.getBoundingClientRect().top >= 0 && x.getBoundingClientRect().top < innerHeight);
        return a ? a.getAttribute("href") : null;
    });
    if (link) {
        await page.click(`a[href="${link}"]`);
        const curtain = await page.evaluate(() => document.documentElement.hasAttribute("data-xition"));
        if (!curtain) fail(`${tag} on: click did not start the page curtain (${link})`);
        else ok(`${tag} on: click ${link} runs the page curtain`);
        await page.waitForURL((u) => u.pathname === link, { timeout: 8000 }).catch(() => fail(`${tag} on: route ${link} never committed`));
        await page.waitForTimeout(900);
        const left = await page.evaluate(() => document.documentElement.getAttribute("data-xition"));
        if (left) fail(`${tag} on: curtain left stuck as ${left}`);
    }

    // 3) Off again on the new page: clicks navigate with no curtain, glyphs resolve at once.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(120);
    const off2 = await page.evaluate(() => document.documentElement.getAttribute("data-xition"));
    if (off2) fail(`${tag} off: curtain attribute left on ${off2}`);
    const bad2 = await page.evaluate(stuck);
    if (bad2.length) fail(`${tag} off: text stuck as glyphs ${bad2.slice(0, 3).join(" | ")}`);
    else ok(`${tag} off again: no curtain, no stuck text`);
    const back = await page.evaluate(() => {
        const a = [...document.querySelectorAll('a[href="/"]')].find((x) => x.getBoundingClientRect().width);
        if (!a) return null;
        a.click();
        return document.documentElement.getAttribute("data-xition");
    });
    if (back !== null) fail(`${tag} off: click still ran a curtain (${back})`);
    else ok(`${tag} off: click navigates without a curtain`);

    // 4) Rapid flips must not leave the engine half-built.
    for (let i = 0; i < 8; i++) {
        await page.emulateMedia({ reducedMotion: i % 2 ? "reduce" : "no-preference" });
        await page.waitForTimeout(40);
    }
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForTimeout(400);
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(1200);
    const nowRx = await page.evaluate(() => [...document.querySelectorAll("[data-rx]")].filter((el) => el.getBoundingClientRect().top >= 0 && el.getBoundingClientRect().top < innerHeight).map((el) => el.style.getPropertyValue("--p")));
    if (nowRx.length && nowRx.every((v) => v === "")) fail(`${tag} flips: scrubbed items never wrote progress after 8 flips`);
    else ok(`${tag} flips: engine rebuilt after 8 rapid flips`);
    const bad3 = await settled(page, 2500);
    if (bad3.length) fail(`${tag} flips: stuck glyphs ${bad3.slice(0, 3).join(" | ")}`);

    if (errors.length) fail(`${tag} page errors: ${errors.slice(0, 3).join(" | ")}`);
    await ctx.close();
}
await browser.close();
console.log(fails.length ? `\n${fails.length} failure(s)` : "\nall motion toggle checks passed");
process.exit(fails.length ? 1 : 0);
