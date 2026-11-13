// Browser check of the game route shell on a production build. Covers Node Farm (phone and desktop), the Games hub,
// the hidden-tab and pause events, full screen support, the manifest, and (when SHELL_HEADER_ROUTE is set) the compact header.
// Usage:
//   SITE_PASSWORD=ci-password SITE_GATE_SECRET=x npx next start -p 3123   (after npm run build)
//   node scripts/games/shell-check.mjs http://localhost:3123
// Exits 1 if any check fails. Safari and iPhone full screen cannot be run here.
import { createRequire } from "node:module";
import { unlock } from "../ci/lib.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = (process.argv[2] || "http://localhost:3123").replace(/\/$/, "");
const headerRoute = process.env.SHELL_HEADER_ROUTE || "";
const [cookieName, ...cookieParts] = (await unlock(base)).split("=");
const cookieValue = cookieParts.join("=");
const results = [];
const check = (ok, msg) => { results.push(ok); console.log(ok ? "PASS" : "FAIL", msg); };
const browser = await chromium.launch();

async function open(viewport, path) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: viewport.width < 600 });
    await ctx.addCookies([{ name: cookieName, value: cookieValue, url: base }]);
    const page = await ctx.newPage();
    page.errs = [];
    page.on("pageerror", (e) => page.errs.push(e.message));
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    return { ctx, page };
}

// 1. Node Farm on phone and desktop: shell mounted, no sideways scroll, game renders, no page errors.
for (const [label, viewport] of [["phone 390", { width: 390, height: 844 }], ["desktop 1440", { width: 1440, height: 900 }]]) {
    const { ctx, page } = await open(viewport, "/creations/games/node-farm");
    const info = await page.evaluate(() => ({
        route: document.documentElement.classList.contains("gs-game-route"),
        shell: !!document.querySelector('.gs-shell[data-game="Node Farm"]'),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        game: !!document.querySelector('[class*="nf-"]'),
        overscroll: getComputedStyle(document.documentElement).overscrollBehaviorY,
    }));
    check(info.route && info.shell, `${label}: Node Farm mounts the shell and marks the game route`);
    check(info.overflow <= 0, `${label}: no sideways scroll (overflow ${info.overflow}px)`);
    check(info.game, `${label}: Node Farm still renders its board`);
    check(info.overscroll === "none", `${label}: pull-to-refresh and bounce are off on the game route`);
    check(page.errs.length === 0, `${label}: no page errors${page.errs.length ? ` (${page.errs[0]})` : ""}`);
    await ctx.close();
}

// 2. The hub is not a game route: no marker, no shell.
{
    const { ctx, page } = await open({ width: 1440, height: 900 }, "/creations/games");
    const marked = await page.evaluate(() => document.documentElement.classList.contains("gs-game-route"));
    check(!marked, "hub: not marked as a game route");
    await ctx.close();
}

// 3. Hidden tab: the shell publishes gameshell:visibility and gameshell:pause, and the marker clears when visible again.
{
    const { ctx, page } = await open({ width: 1440, height: 900 }, "/creations/games/node-farm");
    await page.evaluate(() => {
        window.__gs = [];
        window.addEventListener("gameshell:pause", (e) => window.__gs.push(["pause", e.detail.paused]));
        window.addEventListener("gameshell:visibility", (e) => window.__gs.push(["vis", e.detail.hidden]));
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(200);
    const hiddenEvents = await page.evaluate(() => window.__gs.slice());
    check(hiddenEvents.some(([k, v]) => k === "vis" && v === true) && hiddenEvents.some(([k, v]) => k === "pause" && v === true), "hidden tab: visibility and pause events fire");
    check(await page.evaluate(() => !!document.querySelector('.gs-shell[data-paused="true"]')), "hidden tab: shell reports paused");
    await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
        document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(200);
    check(await page.evaluate(() => !document.querySelector('.gs-shell[data-paused="true"]')), "visible again: shell is no longer paused");
    await ctx.close();
}

// 4. Full screen support on desktop: the shell box can enter and leave full screen.
{
    const { ctx, page } = await open({ width: 1440, height: 900 }, "/creations/games/node-farm");
    const ok = await page.evaluate(async () => {
        const box = document.querySelector(".gs-shell");
        if (!box || !box.requestFullscreen) return "unsupported";
        await box.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
        const inside = document.fullscreenElement === box;
        if (inside) await document.exitFullscreen().catch(() => {});
        return inside ? "toggled" : "refused";
    });
    check(ok !== "unsupported", `desktop: full screen API available on the shell box (${ok})`);
    await ctx.close();
}

// 5. Node Farm keeps saving with the shell around it.
{
    const { ctx, page } = await open({ width: 1440, height: 900 }, "/creations/games/node-farm");
    await page.waitForTimeout(2500);
    const saved = await page.evaluate(() => !!localStorage.getItem("nf-save-v1"));
    check(saved, "Node Farm writes its save with the shell mounted");
    await ctx.close();
}

// 6. Manifest is served behind the gate with shortcuts.
{
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: cookieName, value: cookieValue, url: base }]);
    const res = await ctx.request.get(base + "/manifest.webmanifest");
    const body = res.ok() ? await res.json().catch(() => null) : null;
    check(res.ok() && body && Array.isArray(body.shortcuts) && body.shortcuts.length === 2, "manifest: served with two shortcuts");
    await ctx.close();
}

// 7. Optional: compact header on a route that opts in (SHELL_HEADER_ROUTE).
if (headerRoute) {
    const { ctx, page } = await open({ width: 390, height: 844 }, headerRoute);
    const bar = await page.evaluate(() => {
        const b = document.querySelector(".gs-bar");
        if (!b) return null;
        const small = [...b.querySelectorAll("a,button")].filter((el) => el.getBoundingClientRect().height < 44).length;
        return { small, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    check(!!bar, "header: compact bar renders on an opted-in route");
    check(bar && bar.small === 0, "header: every control is at least 44px tall on a phone");
    check(bar && bar.overflow <= 0, "header: no sideways scroll on a phone");
    await page.click(".gs-btn");
    check(await page.evaluate(() => document.querySelector(".gs-btn")?.getAttribute("aria-pressed") === "true"), "header: Pause toggles and reports pressed");
    check(await page.evaluate(() => !!document.querySelector('.gs-shell[data-paused="true"]')), "header: manual pause marks the shell paused");
    await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
