// Windowed game mode (components/games/shell, mode="windowed") on a production build. For every game with a `window`
// config, at each of its views (1440, 390 touch and 1366x657 by default):
//   - the panel mounts under the site chrome and the game root fills the panel (contain: layout)
//   - desktop: the Play section starts below the site bar, and the panel and its footer fit the viewport and sit above the dock
//   - short desktop (under 700 px tall): the panel's title bar is the anchor and starts below the site bar
//   - phone: the panel is scrolled into view. Brasswork on a phone is full screen by design (no title bar or save footer),
//     so the title-bar and Export checks skip there because those elements are not on the page
//   - on load the panel takes focus; game keys do not scroll the page while it has focus; the wheel over the panel does not either
//   - the wheel over the title bar still scrolls the page (from the top, when there is no room above)
//   - no sideways scroll, no page errors
//   - Export save downloads a file; Import refuses a file that is not a save
// The hub at /creations/games stays a plain page (no windowed shell, no game-route marker).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gatedContext, rectOf } from "../kit.mjs";

export const suite = "window";

async function openGame({ browser, base, cookie }, g, view) {
    const ctx = await gatedContext(browser, base, cookie, { viewport: view.viewport, deviceScaleFactor: 1, hasTouch: view.hasTouch, acceptDownloads: true });
    const page = await ctx.newPage();
    page.errs = [];
    page.on("pageerror", (e) => page.errs.push(e.message));
    await page.goto(`${base}${g.route}`, { waitUntil: "networkidle" });
    // Headless WebGL can run the on-load smooth scroll for many seconds. Wait until the panel's title bar sits near the
    // site bar's line (or 20 s), then until the scroll stops moving for 3 reads.
    let last = -1;
    let still = 0;
    for (let i = 0; i < 40; i++) {
        await page.waitForTimeout(500);
        const y = await page.evaluate(() => window.scrollY);
        const top = await page.evaluate(() => document.querySelector(".gs-win-bar")?.getBoundingClientRect().top ?? 9999);
        still = y === last ? still + 1 : 0;
        last = y;
        if (i >= 4 && still >= 3 && top <= 140) break;
    }
    // The windowed route keeps the Play section under the site bar for a few seconds after load (game-route-shell "hold").
    // Any key from the reader ends it; without this the page snaps back while the checks move it.
    await page.keyboard.press("Shift");
    await page.waitForTimeout(300);
    return { ctx, page };
}

export async function run(env) {
    const { base, cookie, outDir, games, check } = env;
    if (outDir) mkdirSync(outDir, { recursive: true });

    for (const g of games) {
        for (const view of g.window.views) {
            const tag = `${g.name} ${view.label}`;
            const { ctx, page } = await openGame(env, g, view);
            const state = await page.evaluate((name) => ({
                shell: !!document.querySelector(`.gs-windowed[data-game="${name}"]`),
                frame: !!document.querySelector(".gs-frame"),
                focused: document.activeElement?.classList.contains("gs-frame") ?? false,
                scrollY: window.scrollY,
                overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                theme: document.querySelector(".gs-windowed")?.getAttribute("data-theme"),
            }), g.name);
            check(suite, state.shell && state.frame, `${tag}: windowed shell and panel mount`);
            check(suite, state.overflow <= 0, `${tag}: no sideways scroll (${state.overflow}px)`);
            const frame = await rectOf(page, ".gs-frame");
            const sectionNow = await rectOf(page, "section.cm-section");
            const barNow = await rectOf(page, "header.nv-top");
            const desktop = view.viewport.width >= 761;
            if (desktop) {
                // Groundbreak hides the site bar on its route, so its line is the 72px fallback from the shell.
                const floor = barNow && barNow.bottom > 0 ? barNow.bottom : 0;
                const line = barNow && barNow.bottom > 0 ? barNow.bottom : 72;
                // Under 700px tall the panel is the anchor (no Play heading in view), so the panel's title bar starts at the line.
                const short = view.viewport.height < 700;
                if (short) {
                    const winBarNow = await rectOf(page, ".gs-win-bar");
                    check(suite, winBarNow && winBarNow.top >= floor - 1 && winBarNow.top < line + 30,
                        `${tag}: panel title bar starts below the site bar on a short screen (title bar ${Math.round(winBarNow?.top ?? -1)}px, line ${Math.round(line)}px)`);
                } else {
                    check(suite, sectionNow && sectionNow.top >= floor - 1 && sectionNow.top < line + 30,
                        `${tag}: Play section starts below the site bar (section ${Math.round(sectionNow?.top ?? -1)}px, line ${Math.round(line)}px)`);
                }
                const foot = await rectOf(page, ".gs-win-foot");
                const dock = await rectOf(page, ".cm-dock");
                const lowest = Math.max(frame?.bottom ?? 0, foot?.bottom ?? 0);
                check(suite, lowest <= view.viewport.height, `${tag}: panel and footer fit the viewport (bottom ${Math.round(lowest)}px of ${view.viewport.height}px)`);
                if (dock && dock.height > 0) check(suite, lowest <= dock.top, `${tag}: panel and footer sit above the site dock (bottom ${Math.round(lowest)}px, dock top ${Math.round(dock.top)}px)`);
            } else {
                // Tall phones (760px and up) anchor the scroll on the Play section, so its heading shows above the panel (PR #690).
                // Short phones keep the panel as the anchor.
                const tallPhone = view.viewport.height >= 760;
                const anchorBox = tallPhone ? sectionNow : frame;
                check(suite, anchorBox && anchorBox.top >= 0 && anchorBox.top < 180,
                    `${tag}: ${tallPhone ? "Play section" : "panel"} scrolled into view (top ${Math.round(anchorBox?.top ?? -1)}px)`);
            }
            const minTall = view.viewport.height < 700 ? 260 : 360;
            check(suite, frame && frame.height >= minTall, `${tag}: panel is tall (${Math.round(frame?.height ?? 0)}px)`);
            check(suite, state.focused, `${tag}: panel takes focus on load`);
            const root = await rectOf(page, g.window.root);
            check(suite, root && frame && Math.abs(root.left - frame.left) < 3 && Math.abs(root.width - frame.width) < 4 && Math.abs(root.height - frame.height) < 4,
                `${tag}: game root fills the panel (${root ? `${Math.round(root.width)}x${Math.round(root.height)}` : "missing"} in ${frame ? `${Math.round(frame.width)}x${Math.round(frame.height)}` : "?"})`);

            // Keys stay with the game: put the page at a scrolled position, press scroll keys, the page must not move.
            // A phone panel can be most of the screen (Groundbreak on a phone), so the page may have less than 120 px to scroll:
            // start at 120 px or at the most the page has.
            const room = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
            const start = Math.max(0, Math.min(120, room));
            await page.evaluate((y) => { window.scrollTo(0, y); }, start);
            await page.waitForTimeout(150);
            await page.evaluate(() => document.querySelector(".gs-frame")?.focus({ preventScroll: true }));
            for (const key of ["ArrowDown", "PageDown", "Space", "End"]) {
                await page.keyboard.press(key);
            }
            await page.waitForTimeout(250);
            const afterKeys = await page.evaluate(() => window.scrollY);
            check(suite, Math.abs(afterKeys - start) < 2, `${tag}: game keys do not scroll the page (scrollY ${afterKeys}, was ${start})`);

            // The wheel over the panel stays with the game while it has focus. Bring the panel back under the pointer first.
            await page.evaluate(() => document.querySelector(".gs-frame").focus({ preventScroll: true }));
            await page.evaluate(() => { const p = document.querySelector(".gs-win"); window.scrollTo({ top: p.getBoundingClientRect().top + window.scrollY - 72, behavior: "instant" }); });
            await page.waitForTimeout(300);
            const inView = await rectOf(page, ".gs-frame");
            const center = { x: inView.left + inView.width / 2, y: inView.top + inView.height / 2 };
            const beforeWheel = await page.evaluate(() => window.scrollY);
            await page.mouse.move(center.x, center.y);
            await page.mouse.wheel(0, 300);
            await page.waitForTimeout(300);
            const afterWheelGame = await page.evaluate(() => window.scrollY);
            check(suite, Math.abs(afterWheelGame - beforeWheel) < 2, `${tag}: wheel over the game does not scroll the page (scrollY ${afterWheelGame}, was ${beforeWheel})`);

            // The wheel over the title bar still scrolls the page.
            const bar = await rectOf(page, ".gs-win-bar");
            if (bar && bar.height > 0) {
                // measured again: the page moved during the key and wheel checks above
                await page.waitForTimeout(600);
                // A short phone page can sit at its top with no room above the panel (Groundbreak on a phone): then scroll down instead.
                const atTop = afterWheelGame < 20;
                const barNow = await rectOf(page, ".gs-win-bar");
                await page.mouse.move(barNow.left + barNow.width / 2, barNow.top + barNow.height / 2);
                // Scroll up when there is room above, so the check does not depend on how much room is left below.
                await page.mouse.wheel(0, atTop ? 200 : -200);
                await page.waitForTimeout(300);
                // Headless WebGL runs the 3D games at a few frames a second, so the page scroll can land late. Poll for it.
                const moved = (y) => (atTop ? y > afterWheelGame + 20 : y < afterWheelGame - 20);
                let afterWheelBar = afterWheelGame;
                for (let i = 0; i < 20 && !moved(afterWheelBar); i++) {
                    await page.waitForTimeout(200);
                    afterWheelBar = await page.evaluate(() => window.scrollY);
                }
                check(suite, moved(afterWheelBar), `${tag}: wheel over the title bar scrolls the page (scrollY ${afterWheelGame} to ${afterWheelBar}${atTop ? ", from the top" : ""})`);
            }

            // Save export: with a save present it downloads; without one it says so. Either way nothing throws.
            const saveBtn = page.getByRole("button", { name: "Export save" });
            if (!(await saveBtn.isVisible().catch(() => false))) {
                // Brasswork on a phone is full screen: its save rows live in Settings, so the footer is hidden there.
                env.skip(`${tag}: Export save is not shown on this layout`);
            } else {
                await saveBtn.click();
                await page.waitForTimeout(300);
                const msg = await page.evaluate(() => document.querySelector(".gs-win-msg")?.textContent ?? "");
                check(suite, /downloaded|no save/i.test(msg), `${tag}: Export save answers (${msg})`);
            }

            // Import refuses a file that is not a save.
            const bad = join(outDir || tmpdir(), `bad-${g.id}.json`);
            writeFileSync(bad, "{\"not\":\"a save\"}");
            await page.locator('.gs-win-foot input[type="file"]').setInputFiles(bad);
            let refused = "";
            for (let i = 0; i < 15; i++) {
                await page.waitForTimeout(200);
                refused = await page.evaluate(() => document.querySelector(".gs-win-msg")?.textContent ?? "");
                if (refused && !/Checking/.test(refused)) break;
            }
            check(suite, /not a save|not for|another game|damaged|not valid/i.test(refused), `${tag}: Import refuses a file that is not a save (${refused})`);

            // Panel does not steal the window: the frame still has the game and no page errors.
            check(suite, page.errs.length === 0, `${tag}: no page errors${page.errs.length ? ` (${page.errs[0]})` : ""}`);

            if (outDir) {
                await page.evaluate(() => { window.scrollTo(0, 0); });
                await page.waitForTimeout(200);
                await page.evaluate(() => { const p = document.querySelector(".gs-win"); window.scrollTo({ top: p.getBoundingClientRect().top + window.scrollY - 72 }); });
                await page.waitForTimeout(400);
                await page.screenshot({ path: join(outDir, `${g.id}-${view.label}.png`) });
            }
            await ctx.close();
        }
    }

    // Hub stays a plain page: no windowed shell, no game-route marker.
    {
        const ctx = await gatedContext(env.browser, base, cookie, { viewport: { width: 1440, height: 900 } });
        const page = await ctx.newPage();
        await page.goto(`${base}/creations/games`, { waitUntil: "networkidle" });
        const marked = await page.evaluate(() => document.documentElement.classList.contains("gs-game-route") || !!document.querySelector(".gs-windowed"));
        check(suite, !marked, "hub: not a game route");
        await ctx.close();
    }
}
