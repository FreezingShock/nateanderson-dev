// Groundbreak HUD check (the game's own layout, not the shell). For every game with a `hud` config, each seed (a save
// loaded into the page, so the late game with big numbers is checked too) at each size:
//   - no HUD parts overlap: cue, zoom buttons, dock, feed, job card and rail
//   - at 390 wide, a window sheet, the welcome-back card or the material card does not hide the dig: at least 40% of the
//     scene stays free, and the centre is never covered. Each rail window opens in turn
//   - at 390 and 1440 wide, no currency chip is cut off, or runs past its top bar, its chip row or the screen
// Writes a PNG per seed and size when an out dir is given.
import { mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gatedContext } from "../kit.mjs";

export const suite = "hud";

const CI_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MIN_DIG_OPEN = 0.4;
const GRID = 20;
const PARTS = [".gb-cue button", ".gb-zoom", ".gb-dock", ".gb-feed li", ".gb-job", ".gb-rail-btn"];

// Visible currency chips, and how far each one sits outside the screen, its top bar or its chip row.
const chipReport = () => {
    const top = document.querySelector(".gb-top")?.getBoundingClientRect();
    const row = document.querySelector(".gb-res")?.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    return [...document.querySelectorAll(".gb-res li")].map((li) => {
        const q = li.getBoundingClientRect();
        if (!q.width || !q.height) return null;
        // Children only: scrollWidth on the chip counts its hover tooltip, which sits off the chip on purpose.
        const outside = (a) => a.width > 0 && (a.left < q.left - 0.5 || a.right > q.right + 0.5);
        return {
            text: li.textContent.trim(),
            offScreen: q.left < -0.5 || q.right > vw + 0.5,
            offBar: !!(top && (q.left < top.left - 0.5 || q.right > top.right + 0.5)),
            offRow: !!(row && (q.left < row.left - 0.5 || q.right > row.right + 0.5)),
            clipped: [...li.children].some((c) => outside(c.getBoundingClientRect())),
            right: Math.round(q.right),
        };
    }).filter(Boolean);
};

// Share of a grid over the dig (the scene view) that no open sheet covers, and whether its centre is covered.
const digReport = (grid) => {
    const view = document.querySelector(".gb-view")?.getBoundingClientRect();
    if (!view || !view.width || !view.height) return null;
    const sheets = [...document.querySelectorAll(".gb-win, .gb-away, .gb-card")]
        .map((e) => e.getBoundingClientRect())
        .filter((q) => q.width && q.height);
    if (!sheets.length) return null;
    const inside = (x, y, q) => x >= q.left && x <= q.right && y >= q.top && y <= q.bottom;
    // A point on a sheet's edge is not covered: the sheet has to be over the centre, not touching it.
    const over = (x, y, q) => x > q.left && x < q.right && y > q.top && y < q.bottom;
    let free = 0;
    for (let i = 0; i < grid; i++) for (let j = 0; j < grid; j++) {
        const x = view.left + ((i + 0.5) * view.width) / grid;
        const y = view.top + ((j + 0.5) * view.height) / grid;
        if (!sheets.some((q) => inside(x, y, q))) free++;
    }
    const cx = view.left + view.width / 2;
    const cy = view.top + view.height / 2;
    return { open: free / (grid * grid), centreCovered: sheets.some((q) => over(cx, cy, q)), centreY: Math.round(cy), sheetTop: Math.round(Math.min(...sheets.map((q) => q.top))) };
};

function loadSave(path) {
    // savedAt is stamped to now so the welcome-back card does not cover the scene.
    const j = JSON.parse(readFileSync(path, "utf8"));
    j.savedAt = Date.now();
    return JSON.stringify(j);
}

export async function run({ base, browser, cookie, outDir, games, check, log = console.log }) {
    if (outDir) mkdirSync(outDir, { recursive: true });

    for (const g of games.filter((x) => x.hud)) {
        for (const seed of g.hud.seeds) {
            const tag = seed.label;
            const save = seed.save ? loadSave(join(CI_DIR, seed.save)) : "";
            log(`-- ${g.name}, ${tag} save${seed.save ? "" : " (none)"}`);

            for (const { width: w, height: h } of g.hud.sizes) {
                const ctx = await gatedContext(browser, base, cookie, { viewport: { width: w, height: h }, deviceScaleFactor: w > 1000 ? 1 : 2, hasTouch: w < 1000 });
                if (save) await ctx.addInitScript((raw) => { if (!sessionStorage.getItem("gb-hud-seeded")) { sessionStorage.setItem("gb-hud-seeded", "1"); localStorage.setItem("gb-save-v1", raw); } }, save);
                const p = await ctx.newPage();
                await p.goto(base + g.route, { waitUntil: "networkidle" });
                await p.waitForTimeout(2500);
                const r = await p.evaluate((sel) => {
                    const boxes = (s) => [...document.querySelectorAll(s)].map((e) => e.getBoundingClientRect()).filter((q) => q.width && q.height).map((q) => ({ l: q.left, r: q.right, t: q.top, b: q.bottom }));
                    const bx = Object.fromEntries(sel.map((s) => [s, boxes(s)]));
                    const hit = (a, c) => a.l < c.r - 1 && a.r > c.l + 1 && a.t < c.b - 1 && a.b > c.t + 1;
                    const pairs = [];
                    for (let i = 0; i < sel.length; i++) for (let j = i + 1; j < sel.length; j++) if (bx[sel[i]].some((a) => bx[sel[j]].some((c) => hit(a, c)))) pairs.push(`${sel[i]} x ${sel[j]}`);
                    return { pairs, sw: document.documentElement.scrollWidth };
                }, PARTS);
                const size = `${tag} ${w}x${h}`;
                check(suite, r.pairs.length === 0, `${size}: ${r.pairs.length ? `HUD parts overlap: ${r.pairs.join(", ")}` : "HUD parts clear"}`);

                // Currency chips: at 390 and 1440 no visible chip may be cut off or run past its bar or the screen.
                if (w === 390 || w === 1440) {
                    const chips = await p.evaluate(chipReport);
                    for (const c of chips) {
                        const why = [c.offScreen && `runs off the screen (right edge ${c.right}px)`, c.offBar && "runs past the top bar", c.offRow && "runs past the chip row", c.clipped && "text is clipped"].filter(Boolean);
                        check(suite, why.length === 0, `${size}: currency chip "${c.text}" ${why.length ? `is cut off: ${why.join(", ")}` : "fits"}`);
                    }
                    log(`${size} chips: ${chips.length} visible`);
                }

                // Sheets: at 390 each rail window opens in turn, and must leave the dig mostly visible.
                if (w === 390) {
                    const onLoad = await p.evaluate(digReport, GRID);
                    if (onLoad) {
                        const pct = (onLoad.open * 100).toFixed(0);
                        log(`  on load: ${pct}% of the scene free`);
                        const bad = onLoad.centreCovered || onLoad.open < MIN_DIG_OPEN;
                        check(suite, !bad, `${size}: a card on load ${bad ? `hides the dig: ${pct}% of the scene free, centre ${onLoad.centreCovered ? "covered" : "free"}` : `leaves the dig ${pct}% free`}`);
                    }
                    const labels = await p.$$eval(".gb-rail-btn", (bs) => bs.map((e) => e.getAttribute("aria-label")));
                    for (let i = 0; i < labels.length; i++) {
                        const label = labels[i];
                        try {
                            await p.locator(".gb-rail-btn").nth(i).click({ timeout: 3000 });
                        } catch {
                            check(suite, false, `${size}: could not open the ${label} window from the rail`);
                            continue;
                        }
                        await p.waitForTimeout(900);
                        const d = await p.evaluate(digReport, GRID);
                        if (!d) {
                            log(`  ${label}: no sheet opened`);
                        } else {
                            const pct = (d.open * 100).toFixed(0);
                            log(`  ${label}: ${pct}% of the scene free, centre y ${d.centreY}, top sheet edge y ${d.sheetTop}, centre ${d.centreCovered ? "covered" : "free"}`);
                            const bad = d.centreCovered || d.open < MIN_DIG_OPEN;
                            check(suite, !bad, `${size}: the ${label} sheet ${d.centreCovered ? "covers the centre of the scene, where the dig is" : bad ? `hides the dig: only ${pct}% of the scene free, needs ${MIN_DIG_OPEN * 100}%` : `leaves the dig ${pct}% free`}`);
                        }
                        const close = p.locator(".gb-win .gb-x").first();
                        if (await close.count()) await close.click({ timeout: 3000 }).catch(() => {});
                        else await p.keyboard.press("Escape");
                        await p.waitForTimeout(700);
                    }
                }

                if (outDir) await p.screenshot({ path: join(outDir, `hud-${tag}-${w}x${h}.png`) });
                await ctx.close();
            }
        }
    }
}
