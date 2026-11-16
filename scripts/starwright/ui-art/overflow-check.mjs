// Starwright overflow check: opens every menu on a late-game save at several screen sizes and reports anything that scrolls,
// shows a scrollbar, clips its content or pokes out of its card. Exits 1 when it finds something.
// Usage: BASE=http://localhost:3100 SITE_PASSWORD=ci-password node scripts/starwright/ui-art/overflow-check.mjs [outDir]
// With an outDir it also saves a PNG of each menu at each size (named <menu>-<w>x<h>.png).
// On a phone the game is a windowed panel (.gs-frame): a menu is measured against that panel, not the screen.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = process.argv[2];
const SIZES = [[1440, 900], [1024, 640], [768, 1024], [390, 844], [360, 640], [844, 390], [667, 375]];
const MENUS = ["Constellations", "Pulsar map", "Orbit", "Almanac", "Menu"];

const late = (raw) => {
    const s = JSON.parse(raw);
    s.amt = [9.2e9, 4.1e9, 8.2e8, 3.1e8, 9.2e7, 2.6e7, 7.4e6, 9e6, 1e5, 1e4];
    s.bought = s.bought.map((r, i) => (i < 8 ? [40 - i, 20, 5] : r.map(() => 0)));
    s.mass = 3.2e9; s.heat = 9.5e11; s.age = 54000; s.stardust = 3.4e5; s.novas = 9; s.novasAll = 22; s.sdAll = 9e5;
    s.perks = ["l1", "l2", "l3", "l4", "l5", "k1", "k2", "k3", "k4", "k5", "a1", "a2", "a3", "a4", "a5", "w1", "w2", "w3", "w4", "w5"];
    s.deep = 12; s.neutronStars = 2; s.neutronStarsAll = 2; s.neutrons = 40; s.neutronsAll = 60; s.pulsar = ["p1", "p2"];
    s.planets = ["ember", "glass", "tide", "moss", "salt", "dust", "ice", "ring"].slice(0, 8);
    s.planetAge = { ember: 5000, glass: 900, tide: 100, moss: 4000 };
    s.ach = ["flame", "l25", "l100", "iron", "nova1", "guest", "world4"];
    s.found = ["H", "He", "C", "O", "Ne", "Mg", "Si", "Fe", "Au", "U"];
    s.name = "A very long star name here";
    return JSON.stringify(s);
};

/** Runs in the page: returns a list of problems inside the open menu. */
const measure = () => {
    const out = [];
    const root = document.querySelector(".sw-over .sw-card, .sw-chart");
    if (!root) return ["no menu is open"];
    const rr = root.getBoundingClientRect();
    // on a phone the game is a windowed panel (.gs-frame): a menu must fit inside that panel, which can sit below the fold
    const frame = document.querySelector(".gs-frame");
    const fr = frame ? frame.getBoundingClientRect() : { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const vw = innerWidth, vh = innerHeight;
    if (rr.left < fr.left - 1 || rr.top < fr.top - 1 || rr.right > fr.right + 1 || rr.bottom > fr.bottom + 1) out.push(`card leaves its ${frame ? "panel" : "screen"}: ${Math.round(rr.left)},${Math.round(rr.top)} to ${Math.round(rr.right)},${Math.round(rr.bottom)} in ${Math.round(fr.left)},${Math.round(fr.top)} to ${Math.round(fr.right)},${Math.round(fr.bottom)} (${vw}x${vh})`);
    const name = (e) => `${e.tagName.toLowerCase()}.${String(e.className?.baseVal ?? e.className).split(" ").slice(0, 2).join(".")}`;
    const all = [root, ...root.querySelectorAll("*")];
    for (const e of all) {
        const cs = getComputedStyle(e);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        if (e.matches("[data-anim]")) continue; // a sprite strip clipped to one frame on purpose
        if (e.matches("input, textarea")) continue; // a text field scrolls its own long text by design
        const ox = cs.overflowX, oy = cs.overflowY;
        const scrollsY = (oy === "auto" || oy === "scroll") && e.scrollHeight > e.clientHeight + 1;
        const scrollsX = (ox === "auto" || ox === "scroll") && e.scrollWidth > e.clientWidth + 1;
        if (scrollsY) out.push(`scrolls vertically: ${name(e)} (${e.scrollHeight} in ${e.clientHeight})`);
        if (scrollsX) out.push(`scrolls sideways: ${name(e)} (${e.scrollWidth} in ${e.clientWidth})`);
        if ((oy === "auto" || oy === "scroll" || ox === "auto" || ox === "scroll") && (e.offsetWidth - e.clientWidth > 1 || e.offsetHeight - e.clientHeight > 1) && cs.scrollbarWidth !== "none") out.push(`native scrollbar shown: ${name(e)}`);
        // clipped: content wider or taller than a box that hides it
        if ((ox === "hidden" || ox === "clip") && e.scrollWidth > e.clientWidth + 1) out.push(`clips sideways: ${name(e)} (${e.scrollWidth} in ${e.clientWidth})`);
        if ((oy === "hidden" || oy === "clip") && e.scrollHeight > e.clientHeight + 1) out.push(`clips vertically: ${name(e)} (${e.scrollHeight} in ${e.clientHeight})`);
        // text that pokes out of its card
        const r = e.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && e !== root && !e.closest("svg") && (r.right > rr.right + 1 || r.left < rr.left - 1) && cs.position !== "fixed" && cs.position !== "absolute") out.push(`wider than the card: ${name(e)} (${Math.round(r.left)} to ${Math.round(r.right)} vs ${Math.round(rr.left)} to ${Math.round(rr.right)})`);
    }
    const de = document.documentElement;
    if (de.scrollWidth > innerWidth + 1) out.push(`page scrolls sideways (${de.scrollWidth} in ${innerWidth})`);
    return [...new Set(out)];
};

const browser = await chromium.launch();
let bad = 0;
for (const [w, h] of SIZES) {
    const touch = w < 800 || h < 500;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.request.post(`${BASE}/api/gate`, { data: { password: process.env.SITE_PASSWORD ?? "ci-password" }, headers: { origin: BASE } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${BASE}/creations/games/starwright`);
    await page.waitForSelector(".sw-ladder", { timeout: 30000 });
    await page.waitForFunction(() => localStorage.getItem("sw-save-v1"), null, { timeout: 30000 });
    const base = await page.evaluate(() => localStorage.getItem("sw-save-v1"));
    await page.addInitScript(`(() => { const raw = ${JSON.stringify(late(base))}; localStorage.setItem("sw-save-v1", raw); localStorage.setItem("sw-settings-v1", JSON.stringify({ welcome: false })); })()`);
    await page.reload();
    await page.waitForSelector(".sw-ladder");
    await page.waitForTimeout(1500);
    for (const m of MENUS) {
        const btn = page.getByRole("button", { name: m, exact: true });
        if (!(await btn.count())) { console.log(`${w}x${h} ${m}: no dock button`); continue; }
        await page.locator(".gs-frame").first().scrollIntoViewIfNeeded().catch(() => {});
        // the dock tiles bob while idle and the windowed panel can sit under them, so the click is a DOM click (what a tap does);
        // this check is about what a menu shows, not about hit testing
        await btn.evaluate((b) => b.click());
        await page.waitForTimeout(900);
        const problems = await page.evaluate(measure);
        if (OUT) await page.screenshot({ path: `${OUT}/${m.toLowerCase().replace(/ /g, "-")}-${w}x${h}.png` });
        if (problems.length) { bad++; console.log(`FAIL ${w}x${h} ${m}\n  ${problems.join("\n  ")}`); } else console.log(`ok   ${w}x${h} ${m}`);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
    }
    if (errors.length) { bad++; console.log(`FAIL ${w}x${h} page errors: ${errors.join("; ")}`); }
    await ctx.close();
}
await browser.close();
console.log(bad ? `\n${bad} problem group(s)` : "\nno overflow found");
process.exit(bad ? 1 : 0);
