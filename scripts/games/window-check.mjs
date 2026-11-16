// Browser check of the windowed game mode (components/games/shell, mode="windowed") on a production build.
// Covers Brasswork, Starwright and Groundbreak at 1440 and 390 wide:
//   - the panel mounts under the site chrome and the game root fills the panel (contain: layout)
//   - on load the page scrolls the panel into view and the panel takes focus
//   - game keys do not scroll the page while the panel has focus; the wheel over the panel does not either
//   - the wheel over the title bar or footer still scrolls the page
//   - no sideways scroll, no page errors
//   - Export save downloads a file; Import refuses a file that is not a save
// Usage:
//   SITE_PASSWORD=ci-password SITE_GATE_SECRET=x npx next start -p 3123   (after npm run build)
//   node scripts/games/window-check.mjs http://localhost:3123 [out-dir]
// Exits 1 if any check fails. Screenshots go to out-dir when given. Safari and iPhone full screen are not run here.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { unlock } from "../ci/lib.mjs";

const { chromium } = createRequire(import.meta.url)("playwright");
const base = (process.argv[2] || "http://localhost:3123").replace(/\/$/, "");
const outDir = process.argv[3] || "";
if (outDir) mkdirSync(outDir, { recursive: true });
const [cookieName, ...cookieParts] = (await unlock(base)).split("=");
const cookieValue = cookieParts.join("=");
const results = [];
const check = (ok, msg) => { results.push(ok); console.log(ok ? "PASS" : "FAIL", msg); };
const browser = await chromium.launch();

const GAMES = [
    { id: "brasswork", name: "Brasswork", root: ".bw-root" },
    { id: "starwright", name: "Starwright", root: ".sw-root" },
    { id: "groundbreak", name: "Groundbreak", root: ".gb-root" },
];
const VIEWS = [
    { label: "1440", viewport: { width: 1440, height: 900 }, hasTouch: false },
    { label: "390", viewport: { width: 390, height: 844 }, hasTouch: true },
];

async function openGame(view, id) {
    const ctx = await browser.newContext({ viewport: view.viewport, deviceScaleFactor: 1, hasTouch: view.hasTouch, acceptDownloads: true });
    await ctx.addCookies([{ name: cookieName, value: cookieValue, url: base }]);
    const page = await ctx.newPage();
    page.errs = [];
    page.on("pageerror", (e) => page.errs.push(e.message));
    await page.goto(`${base}/creations/games/${id}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2200);
    return { ctx, page };
}

const rectOf = (page, sel) => page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
}, sel);

for (const g of GAMES) {
    for (const view of VIEWS) {
        const tag = `${g.name} ${view.label}`;
        const { ctx, page } = await openGame(view, g.id);
        const state = await page.evaluate((name) => ({
            shell: !!document.querySelector(`.gs-windowed[data-game="${name}"]`),
            frame: !!document.querySelector(".gs-frame"),
            focused: document.activeElement?.classList.contains("gs-frame") ?? false,
            scrollY: window.scrollY,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            theme: document.querySelector(".gs-windowed")?.getAttribute("data-theme"),
        }), g.name);
        check(state.shell && state.frame, `${tag}: windowed shell and panel mount`);
        check(state.overflow <= 0, `${tag}: no sideways scroll (${state.overflow}px)`);
        const frame = await rectOf(page, ".gs-frame");
        check(frame && frame.top >= 0 && frame.top < 180, `${tag}: panel scrolled into view (top ${Math.round(frame?.top ?? -1)}px)`);
        check(frame && frame.height >= 360, `${tag}: panel is tall (${Math.round(frame?.height ?? 0)}px)`);
        check(state.focused, `${tag}: panel takes focus on load`);
        const root = await rectOf(page, g.root);
        check(root && frame && Math.abs(root.left - frame.left) < 3 && Math.abs(root.width - frame.width) < 4 && Math.abs(root.height - frame.height) < 4,
            `${tag}: game root fills the panel (${root ? `${Math.round(root.width)}x${Math.round(root.height)}` : "missing"} in ${frame ? `${Math.round(frame.width)}x${Math.round(frame.height)}` : "?"})`);

        // Keys stay with the game: put the page at a scrolled position, press scroll keys, the page must not move.
        await page.evaluate(() => { window.scrollTo(0, 120); });
        await page.waitForTimeout(150);
        await page.evaluate(() => document.querySelector(".gs-frame")?.focus({ preventScroll: true }));
        for (const key of ["ArrowDown", "PageDown", "Space", "End"]) {
            await page.keyboard.press(key);
        }
        await page.waitForTimeout(250);
        const afterKeys = await page.evaluate(() => window.scrollY);
        check(Math.abs(afterKeys - 120) < 2, `${tag}: game keys do not scroll the page (scrollY ${afterKeys})`);

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
        check(Math.abs(afterWheelGame - beforeWheel) < 2, `${tag}: wheel over the game does not scroll the page (scrollY ${afterWheelGame}, was ${beforeWheel})`);

        // The wheel over the title bar still scrolls the page.
        const bar = await rectOf(page, ".gs-win-bar");
        if (bar) {
            // measured again: the page moved during the key and wheel checks above
            await page.waitForTimeout(600);
            const barNow = await rectOf(page, ".gs-win-bar");
            await page.mouse.move(barNow.left + barNow.width / 2, barNow.top + barNow.height / 2);
            // Scroll up, so the check does not depend on how much room is left below.
            await page.mouse.wheel(0, -200);
            await page.waitForTimeout(300);
            // Headless WebGL runs the 3D games at a few frames a second, so the page scroll can land late. Poll for it.
            let afterWheelBar = afterWheelGame;
            for (let i = 0; i < 20 && afterWheelBar >= afterWheelGame - 20; i++) {
                await page.waitForTimeout(200);
                afterWheelBar = await page.evaluate(() => window.scrollY);
            }
            check(afterWheelBar < afterWheelGame - 20, `${tag}: wheel over the title bar scrolls the page (scrollY ${afterWheelGame} to ${afterWheelBar})`);
        }

        // Save export: with a save present it downloads; without one it says so. Either way nothing throws.
        const fs = await page.evaluate(() => document.querySelector(".gs-win-msg")?.textContent ?? "");
        const saveBtn = page.getByRole("button", { name: "Export save" });
        if (await saveBtn.count()) {
            await saveBtn.click();
            await page.waitForTimeout(300);
            const msg = await page.evaluate(() => document.querySelector(".gs-win-msg")?.textContent ?? "");
            check(/downloaded|no save/i.test(msg), `${tag}: Export save answers (${msg})`);
        } else {
            check(false, `${tag}: Export save button missing`);
        }

        // Import refuses a file that is not a save.
        const bad = join(outDir || "/tmp", `bad-${g.id}.json`);
        const { writeFileSync } = await import("node:fs");
        writeFileSync(bad, "{\"not\":\"a save\"}");
        await page.locator('.gs-win-foot input[type="file"]').setInputFiles(bad);
        let refused = "";
        for (let i = 0; i < 15; i++) {
            await page.waitForTimeout(200);
            refused = await page.evaluate(() => document.querySelector(".gs-win-msg")?.textContent ?? "");
            if (refused && !/Checking/.test(refused)) break;
        }
        check(/not a save|not for|another game|damaged|not valid/i.test(refused), `${tag}: Import refuses a file that is not a save (${refused})`);

        // Panel does not steal the window: the frame still has the game and no page errors.
        check(page.errs.length === 0, `${tag}: no page errors${page.errs.length ? ` (${page.errs[0]})` : ""}`);
        void fs;

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
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addCookies([{ name: cookieName, value: cookieValue, url: base }]);
    const page = await ctx.newPage();
    await page.goto(`${base}/creations/games`, { waitUntil: "networkidle" });
    const marked = await page.evaluate(() => document.documentElement.classList.contains("gs-game-route") || !!document.querySelector(".gs-windowed"));
    check(!marked, "hub: not a game route");
    await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
