// Browser check of how Node Farm behaves as a web page on a production build: two tabs on one save, full or blocked storage,
// a tab hidden mid-game, rotating the phone, and a cold storage hold that loses focus. Usage:
//   node scripts/nodefarm/web-basics-browser.mjs <base url>
//   (start the build with SITE_PASSWORD=ci-password SITE_GATE_SECRET=x next start -p 3123)
// Exits 1 if any check fails. Safari and audio cannot be run here.
import { createRequire } from "node:module";
import { unlock } from "../ci/lib.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = (process.argv[2] || "http://localhost:3123").replace(/\/$/, "");
const url = `${base}/creations/games/node-farm`;
const cookie = (await unlock(base)).split("=");
const res = [];
const ok = (c, m) => { res.push(c); console.log(c ? "PASS" : "FAIL", m); };
const browser = await chromium.launch();

const page = async (vp = { width: 1280, height: 800 }, init = null) => {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    await ctx.addCookies([{ name: cookie[0], value: cookie.slice(1).join("="), url: base }]);
    if (init) await ctx.addInitScript(init);
    const p = await ctx.newPage();
    p.errs = [];
    p.on("pageerror", (e) => p.errs.push(e.message));
    return { ctx, p };
};
const save = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("nf-save-v1") || "null"));

// 1. a second tab on the same save goes stale and stops saving; the first keeps saving
{
    const { ctx, p: a } = await page();
    await a.goto(url, { waitUntil: "networkidle" });
    await a.waitForTimeout(1500);
    const b = await ctx.newPage();
    b.errs = [];
    b.on("pageerror", (e) => b.errs.push(e.message));
    await b.goto(url, { waitUntil: "networkidle" });
    await b.waitForTimeout(7000);
    ok((await b.locator(".nf-stale").count()) === 1, "two tabs: the second tab shows the stale banner");
    ok((await a.locator(".nf-stale").count()) === 0, "two tabs: the first tab shows no banner");
    const t1 = (await save(a)).at;
    await a.waitForTimeout(6000);
    ok((await save(a)).at > t1, "two tabs: the first tab keeps saving");
    ok(a.errs.length + b.errs.length === 0, "two tabs: no page errors");
    await ctx.close();
}

// 2. the browser refuses to store the save: one warning in the feed, no crash
{
    const { ctx, p } = await page({ width: 1280, height: 800 }, () => {
        const orig = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
            if (k === "nf-save-v1") throw new DOMException("full", "QuotaExceededError");
            return orig.call(this, k, v);
        };
    });
    await p.goto(url, { waitUntil: "networkidle" });
    await p.waitForTimeout(7000);
    ok(/would not store the save/i.test(await p.locator("body").innerText()), "full storage: the warning shows");
    ok(p.errs.length === 0, "full storage: no page errors");
    await ctx.close();
}

// 3. storage blocked outright (some browsers do this for third-party or strict settings): the game still renders
{
    const { ctx, p } = await page({ width: 1280, height: 800 }, () => {
        Object.defineProperty(window, "localStorage", { get() { throw new DOMException("denied", "SecurityError"); }, configurable: true });
    });
    await p.goto(url, { waitUntil: "networkidle" });
    await p.waitForTimeout(3000);
    ok((await p.locator(".nf").count()) > 0, "blocked storage: the game renders");
    ok(p.errs.length === 0, `blocked storage: no page errors ${p.errs.join(" | ").slice(0, 200)}`);
    await ctx.close();
}

// 4. the tab hidden: the save is written at once, not up to five seconds later
{
    const { ctx, p } = await page();
    await p.goto(url, { waitUntil: "networkidle" });
    await p.waitForTimeout(1500);
    const before = (await save(p)).at;
    await p.waitForTimeout(1200);
    await p.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { get: () => "hidden", configurable: true });
        Object.defineProperty(document, "hidden", { get: () => true, configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
    });
    await p.waitForTimeout(150);
    ok((await save(p)).at > before, "hidden tab: the save is written when the tab hides");
    ok(p.errs.length === 0, "hidden tab: no page errors");
    await ctx.close();
}

// 5. the phone turns sideways and back: no sideways scroll, no errors
{
    const { ctx, p } = await page({ width: 390, height: 844 });
    await p.goto(url, { waitUntil: "networkidle" });
    await p.waitForTimeout(1500);
    const over = () => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok((await over()) <= 0, "phone portrait: no sideways scroll");
    await p.setViewportSize({ width: 844, height: 390 });
    await p.waitForTimeout(800);
    ok((await over()) <= 0, "phone landscape: no sideways scroll");
    await p.setViewportSize({ width: 1280, height: 800 });
    await p.waitForTimeout(800);
    ok((await over()) <= 0, "back to desktop: no sideways scroll");
    ok(p.errs.length === 0, "rotate: no page errors");
    await ctx.close();
}

// 6. cold storage: a hold that loses focus lets go, and keeps the rows already open
{
    const { ctx, p } = await page();
    await p.goto(url, { waitUntil: "networkidle" });
    await p.waitForTimeout(1500);
    await p.evaluate(() => window.dispatchEvent(new CustomEvent("nf:fire", { detail: "vault" })));
    const go = p.locator(".nf-ev-go");
    await go.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(1500);
    if (await go.count()) await go.click({ force: true }).catch(() => {});
    const btn = p.locator(".nf-ev-hold");
    ok((await btn.count()) === 1, "cold storage: the vault card opens");
    if ((await btn.count()) === 1) {
        const bb = await btn.boundingBox();
        await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
        await p.mouse.down();
        await p.waitForTimeout(500);
        ok((await btn.getAttribute("data-held")) !== null, "cold storage: holding sets data-held");
        await p.evaluate(() => window.dispatchEvent(new Event("blur")));
        await p.waitForTimeout(300);
        ok((await btn.getAttribute("data-held")) === null, "cold storage: the hold lets go when the window loses focus");
        await p.mouse.up();
    }
    ok(p.errs.length === 0, "cold storage: no page errors");
    await ctx.close();
}

await browser.close();
const bad = res.filter((c) => !c).length;
console.log(`\n${res.length - bad} of ${res.length} checks passed`);
process.exit(bad ? 1 : 0);
