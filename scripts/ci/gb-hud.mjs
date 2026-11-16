// Groundbreak HUD check. Usage: node scripts/ci/gb-hud.mjs http://localhost:3123 out-dir [tag] [save.json]
// A save.json (any Groundbreak save) is loaded into each page, so the checks also run on a late game with big numbers.
// Run it against a production build before merging a HUD, dock, window or chip change. Exits 1 if:
//   - any HUD parts overlap (cue, zoom, dock, feed, job card, rail) at any size,
//   - a window sheet, the welcome-back card or the material card hides the dig at 390 wide, or
//   - a currency chip is cut off, or runs past the top bar or off the screen, at 390 or 1440 wide.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { unlock } from "./lib.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const [base = "http://localhost:3123", out = ".", tag = "x", savePath = ""] = process.argv.slice(2);
// Stamp savedAt to now so the welcome-back card does not cover the scene.
const save = savePath ? (() => { const j = JSON.parse(readFileSync(savePath, "utf8")); j.savedAt = Date.now(); return JSON.stringify(j); })() : "";

// At 390 the centre of the scene (where the dig is) must stay free of every sheet, and at least 40% of the scene stays free.
const MIN_DIG_OPEN = 0.4;
const GRID = 20;

const cookie = (await unlock(base)).split("=");
const b = await chromium.launch();
const sizes = [[1440, 900], [390, 844], [360, 740], [375, 667], [844, 390], [932, 430], [667, 375]];
const sel = [".gb-cue button", ".gb-zoom", ".gb-dock", ".gb-feed li", ".gb-job", ".gb-rail-btn"];
let bad = 0;
const fail = (msg) => { bad++; console.log(`  FAIL ${msg}`); };

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

for (const [w, h] of sizes) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w > 1000 ? 1 : 2, hasTouch: w < 1000 });
    await ctx.addCookies([{ name: cookie[0], value: cookie.slice(1).join("="), url: base }]);
    if (save) await ctx.addInitScript((raw) => { if (!sessionStorage.getItem("gb-hud-seeded")) { sessionStorage.setItem("gb-hud-seeded", "1"); localStorage.setItem("gb-save-v1", raw); } }, save);
    const p = await ctx.newPage();
    await p.goto(base + "/creations/games/groundbreak", { waitUntil: "networkidle" });
    await p.waitForTimeout(2500);
    const r = await p.evaluate((sel) => {
        const boxes = (s) => [...document.querySelectorAll(s)].map((e) => e.getBoundingClientRect()).filter((q) => q.width && q.height).map((q) => ({ l: q.left, r: q.right, t: q.top, b: q.bottom }));
        const bx = Object.fromEntries(sel.map((s) => [s, boxes(s)]));
        const hit = (a, c) => a.l < c.r - 1 && a.r > c.l + 1 && a.t < c.b - 1 && a.b > c.t + 1;
        const pairs = [];
        for (let i = 0; i < sel.length; i++) for (let j = i + 1; j < sel.length; j++) if (bx[sel[i]].some((a) => bx[sel[j]].some((c) => hit(a, c)))) pairs.push(`${sel[i]} x ${sel[j]}`);
        return { pairs, sw: document.documentElement.scrollWidth };
    }, sel);
    console.log(`${w}x${h}: ${r.pairs.length ? "OVERLAP " + r.pairs.join(", ") : "clear"}`);
    bad += r.pairs.length;

    // Currency chips: at 390 and 1440 no visible chip may be cut off or run past its bar or the screen.
    if (w === 390 || w === 1440) {
        const chips = await p.evaluate(chipReport);
        for (const c of chips) {
            const why = [c.offScreen && `runs off the screen (right edge ${c.right}px)`, c.offBar && "runs past the top bar", c.offRow && "runs past the chip row", c.clipped && "text is clipped"].filter(Boolean);
            if (why.length) fail(`${w}x${h} currency chip "${c.text}" is cut off: ${why.join(", ")}`);
        }
        console.log(`${w}x${h} chips: ${chips.length} visible`);
    }

    // Sheets: at 390 each rail window opens in turn, and must leave the dig mostly visible.
    if (w === 390) {
        const onLoad = await p.evaluate(digReport, GRID);
        if (onLoad) {
            const pct = (onLoad.open * 100).toFixed(0);
            console.log(`  on load: ${pct}% of the scene free`);
            if (onLoad.centreCovered || onLoad.open < MIN_DIG_OPEN) fail(`390x844 a card on load hides the dig: ${pct}% of the scene free, centre ${onLoad.centreCovered ? "covered" : "free"}`);
        }
        const labels = await p.$$eval(".gb-rail-btn", (bs) => bs.map((e) => e.getAttribute("aria-label")));
        for (let i = 0; i < labels.length; i++) {
            const label = labels[i];
            try {
                await p.locator(".gb-rail-btn").nth(i).click({ timeout: 3000 });
            } catch {
                fail(`390x844 could not open the ${label} window from the rail`);
                continue;
            }
            await p.waitForTimeout(900);
            const d = await p.evaluate(digReport, GRID);
            if (!d) {
                console.log(`  ${label}: no sheet opened`);
            } else {
                const pct = (d.open * 100).toFixed(0);
                console.log(`  ${label}: ${pct}% of the scene free, centre y ${d.centreY}, top sheet edge y ${d.sheetTop}, centre ${d.centreCovered ? "covered" : "free"}`);
                if (d.centreCovered) fail(`390x844 the ${label} sheet covers the centre of the scene, where the dig is`);
                else if (d.open < MIN_DIG_OPEN) fail(`390x844 the ${label} sheet hides the dig: only ${pct}% of the scene free, needs ${MIN_DIG_OPEN * 100}%`);
            }
            const close = p.locator(".gb-win .gb-x").first();
            if (await close.count()) await close.click({ timeout: 3000 }).catch(() => {});
            else await p.keyboard.press("Escape");
            await p.waitForTimeout(700);
        }
    }

    await p.screenshot({ path: `${out}/hud-${tag}-${w}x${h}.png` });
    await ctx.close();
}
await b.close();
console.log(bad ? `${bad} problem(s)` : "all clear");
process.exit(bad ? 1 : 0);
