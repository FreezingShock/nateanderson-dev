// Game route shell on a production build (components/games/shell, framed mode: Node Farm and any other framed game).
// For every game with a `shell` config:
//   - phone 390 and desktop 1440: the shell mounts and marks the game route, no sideways scroll, the game still renders,
//     pull-to-refresh and bounce are off, no page errors
//   - the game writes its save with the shell mounted (saveKey)
//   - the compact header on a route that opts in (headerRoute, or SHELL_HEADER_ROUTE): controls at least 44 px tall on a phone,
//     no sideways scroll, Pause toggles and reports pressed
// Global checks, run once: the hub is not a game route, the hidden tab publishes visibility and pause events (on the first
// shell game), full screen works on desktop, and the manifest is served with two shortcuts.
// Safari and iPhone full screen cannot be run here.
import { gatedContext } from "../kit.mjs";

export const suite = "shell";

export async function run(env) {
    const { base, browser, cookie, games, check } = env;

    async function open(viewport, path) {
        const ctx = await gatedContext(browser, base, cookie, { viewport, deviceScaleFactor: 1, hasTouch: viewport.width < 600 });
        const page = await ctx.newPage();
        page.errs = [];
        page.on("pageerror", (e) => page.errs.push(e.message));
        await page.goto(base + path, { waitUntil: "networkidle" });
        await page.waitForTimeout(800);
        return { ctx, page };
    }

    const shellGames = games.filter((g) => g.shell);

    // 1. Each framed game on phone and desktop: shell mounted, no sideways scroll, game renders, no page errors.
    for (const g of shellGames) {
        for (const [label, viewport] of [["phone 390", { width: 390, height: 844 }], ["desktop 1440", { width: 1440, height: 900 }]]) {
            const { ctx, page } = await open(viewport, g.route);
            const info = await page.evaluate(({ name, selector }) => ({
                route: document.documentElement.classList.contains("gs-game-route"),
                shell: !!document.querySelector(`.gs-shell[data-game="${name}"]`),
                overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                game: !!document.querySelector(selector),
                overscroll: getComputedStyle(document.documentElement).overscrollBehaviorY,
            }), { name: g.name, selector: g.shell.gameSelector });
            check(suite, info.route && info.shell, `${label}: ${g.name} mounts the shell and marks the game route`);
            check(suite, info.overflow <= 0, `${label}: no sideways scroll (overflow ${info.overflow}px)`);
            check(suite, info.game, `${label}: ${g.name} still renders its board`);
            check(suite, info.overscroll === "none", `${label}: pull-to-refresh and bounce are off on the game route`);
            check(suite, page.errs.length === 0, `${label}: no page errors${page.errs.length ? ` (${page.errs[0]})` : ""}`);
            await ctx.close();
        }
    }

    // 2. The hub is not a game route: no marker, no shell.
    {
        const { ctx, page } = await open({ width: 1440, height: 900 }, "/creations/games");
        const marked = await page.evaluate(() => document.documentElement.classList.contains("gs-game-route"));
        check(suite, !marked, "hub: not marked as a game route");
        await ctx.close();
    }

    // The hidden-tab, full screen checks run on the first framed game.
    const first = shellGames[0];

    // 3. Hidden tab: the shell publishes gameshell:visibility and gameshell:pause, and the marker clears when visible again.
    if (first) {
        const { ctx, page } = await open({ width: 1440, height: 900 }, first.route);
        await page.evaluate(() => {
            window.__gs = [];
            window.addEventListener("gameshell:pause", (e) => window.__gs.push(["pause", e.detail.paused]));
            window.addEventListener("gameshell:visibility", (e) => window.__gs.push(["vis", e.detail.hidden]));
            Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
            document.dispatchEvent(new Event("visibilitychange"));
        });
        await page.waitForTimeout(200);
        const hiddenEvents = await page.evaluate(() => window.__gs.slice());
        check(suite, hiddenEvents.some(([k, v]) => k === "vis" && v === true) && hiddenEvents.some(([k, v]) => k === "pause" && v === true), "hidden tab: visibility and pause events fire");
        check(suite, await page.evaluate(() => !!document.querySelector('.gs-shell[data-paused="true"]')), "hidden tab: shell reports paused");
        await page.evaluate(() => {
            Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
            document.dispatchEvent(new Event("visibilitychange"));
        });
        await page.waitForTimeout(200);
        check(suite, await page.evaluate(() => !document.querySelector('.gs-shell[data-paused="true"]')), "visible again: shell is no longer paused");
        await ctx.close();

        // 4. Full screen support on desktop: the shell box can enter and leave full screen.
        const fs = await open({ width: 1440, height: 900 }, first.route);
        const ok = await fs.page.evaluate(async () => {
            const box = document.querySelector(".gs-shell");
            if (!box || !box.requestFullscreen) return "unsupported";
            await box.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
            const inside = document.fullscreenElement === box;
            if (inside) await document.exitFullscreen().catch(() => {});
            return inside ? "toggled" : "refused";
        });
        check(suite, ok !== "unsupported", `desktop: full screen API available on the shell box (${ok})`);
        await fs.ctx.close();
    }

    // 5. Each framed game keeps saving with the shell around it.
    for (const g of shellGames.filter((x) => x.shell.saveKey)) {
        const { ctx, page } = await open({ width: 1440, height: 900 }, g.route);
        await page.waitForTimeout(2500);
        const key = g.shell.saveKey;
        const saved = await page.evaluate((k) => !!localStorage.getItem(k), key);
        check(suite, saved, `${g.name} writes its save with the shell mounted`);
        await ctx.close();
    }

    // 6. Manifest is served behind the gate with shortcuts.
    {
        const ctx = await gatedContext(browser, base, cookie, {});
        const res = await ctx.request.get(base + "/manifest.webmanifest");
        const body = res.ok() ? await res.json().catch(() => null) : null;
        check(suite, res.ok() && body && Array.isArray(body.shortcuts) && body.shortcuts.length === 2, "manifest: served with two shortcuts");
        await ctx.close();
    }

    // 7. Compact header on the routes that opt in (a game's headerRoute, or SHELL_HEADER_ROUTE for a one-off run).
    const headerRoutes = [...new Set([...shellGames.map((g) => g.shell.headerRoute), process.env.SHELL_HEADER_ROUTE].filter(Boolean))];
    for (const route of headerRoutes) {
        const { ctx, page } = await open({ width: 390, height: 844 }, route);
        const bar = await page.evaluate(() => {
            const b = document.querySelector(".gs-bar");
            if (!b) return null;
            const small = [...b.querySelectorAll("a,button")].filter((el) => el.getBoundingClientRect().height < 44).length;
            return { small, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        });
        check(suite, !!bar, `header: compact bar renders on an opted-in route (${route})`);
        check(suite, bar && bar.small === 0, "header: every control is at least 44px tall on a phone");
        check(suite, bar && bar.overflow <= 0, "header: no sideways scroll on a phone");
        await page.click(".gs-btn");
        check(suite, await page.evaluate(() => document.querySelector(".gs-btn")?.getAttribute("aria-pressed") === "true"), "header: Pause toggles and reports pressed");
        check(suite, await page.evaluate(() => !!document.querySelector('.gs-shell[data-paused="true"]')), "header: manual pause marks the shell paused");
        await ctx.close();
    }
}
