// Starwright phone map and Almanac shots: the Constellations map (first and second constellation), the Almanac grid and its
// tap-open element sheet, at 1440 and 390 (and 360 for the narrowest phones). Each menu is measured for overlap of its
// labels and its card edges; the numbers are printed so a before and after can be compared.
// Usage: BASE=http://localhost:3100 SITE_PASSWORD=ci-password node scripts/starwright/ui-art/map-almanac-shots.mjs <outDir>
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = process.argv[2] ?? ".";
const SIZES = [
    ["1440", { width: 1440, height: 900 }, 1],
    ["390", { width: 390, height: 844 }, 2],
    ["360", { width: 360, height: 740 }, 2],
];

// A late-game save: most of the ladder found, several milestones, stardust for the map.
const late = (raw) => {
    const s = JSON.parse(raw);
    s.amt = [9.2e9, 4.1e9, 8.2e8, 3.1e8, 9.2e7, 2.6e7, 7.4e6, 9e6, 1e5, 1e4];
    s.bought = s.bought.map((r, i) => (i < 8 ? [40 - i, 20, 5] : r.map(() => 0)));
    s.mass = 3.2e9; s.heat = 9.5e11; s.age = 54000; s.stardust = 3.4e5; s.novas = 9; s.novasAll = 22; s.sdAll = 9e5;
    s.perks = ["l1", "l2", "l3", "l4", "l5", "k1", "k2", "k3", "k4", "k5", "a1", "a2", "a3", "a4", "a5", "w1", "w2", "w3", "w4", "w5"];
    s.deep = 12; s.neutronStars = 2; s.neutronStarsAll = 2; s.neutrons = 40; s.neutronsAll = 60; s.pulsar = ["p1", "p2"];
    s.planets = ["ember", "glass", "tide", "moss", "salt", "dust", "ice", "ring"];
    s.planetAge = { ember: 5000, glass: 900, tide: 100, moss: 4000 };
    s.ach = ["flame", "l25", "l100", "iron", "nova1", "guest", "world4"];
    s.found = ["H", "He", "C", "O", "Ne", "Mg", "Si", "Fe", "Au", "U"];
    s.name = "Vega Minor";
    return JSON.stringify(s);
};

/** Runs in the page. Reports labels that run into each other and content that leaves its card or the screen. */
const measure = () => {
    const out = [];
    const root = document.querySelector(".sw-over .sw-card, .sw-chart");
    if (!root) return ["no menu is open"];
    const rr = root.getBoundingClientRect();
    const vw = innerWidth, vh = innerHeight;
    if (rr.left < -1 || rr.right > vw + 1 || rr.bottom > vh + 1 || rr.top < -1) out.push(`card leaves the screen ${Math.round(rr.left)},${Math.round(rr.top)} to ${Math.round(rr.right)},${Math.round(rr.bottom)}`);
    // text boxes that overlap another text box in the same menu (labels colliding)
    const texts = [...root.querySelectorAll("b, h2, span, p, text")].filter((e) => e.offsetParent !== null || e.tagName.toLowerCase() === "text");
    // a box counts only where it is what the player sees: its middle point is not covered by another element
    const seen = (e, r) => { const x = r.left + r.width / 2, y = r.top + r.height / 2; const top = document.elementFromPoint(x, y); return !!top && (top === e || e.contains(top) || top.contains(e)); };
    const boxes = texts.map((e) => ({ e, r: e.getBoundingClientRect() })).filter((o) => o.r.width > 2 && o.r.height > 2 && seen(o.e, o.r));
    let collisions = 0;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
        const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (ox > 3 && oy > 3) collisions++;
    }
    if (collisions) out.push(`${collisions} text boxes overlap`);
    const de = document.documentElement;
    if (de.scrollWidth > innerWidth + 1) out.push(`page scrolls sideways (${de.scrollWidth} in ${innerWidth})`);
    return out;
};

/** Runs in the page: how far the visible stars (and their labels) sit from the middle of the map's screen area. */
const centre = () => {
    const box = document.querySelector(".sw-chart-scroll");
    const nodes = [...document.querySelectorAll(".sw-chart .sw-node:not([data-off]), .sw-chart .sw-con:not([data-off])")];
    if (!box || nodes.length === 0) return null;
    let l = Infinity, r = -Infinity;
    for (const n of nodes) { const b = n.getBoundingClientRect(); if (b.width === 0) continue; l = Math.min(l, b.left); r = Math.max(r, b.right); }
    const br = box.getBoundingClientRect();
    return { dx: Math.round((l + r) / 2 - (br.left + br.width / 2)), spanLeft: Math.round(l - br.left), spanRight: Math.round(br.right - r) };
};

const browser = await chromium.launch();
let bad = 0;
for (const [tag, vp, dsf] of SIZES) {
    const touch = vp.width < 800;
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dsf, hasTouch: touch, isMobile: touch });
    await ctx.request.post(`${BASE}/api/gate`, { data: { password: process.env.SITE_PASSWORD ?? "ci-password" }, headers: { origin: BASE } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${BASE}/creations/games/starwright`);
    await page.waitForFunction(() => localStorage.getItem("sw-save-v1"), null, { timeout: 30000 });
    const base = await page.evaluate(() => localStorage.getItem("sw-save-v1"));
    await page.addInitScript(`(() => { localStorage.setItem("sw-save-v1", ${JSON.stringify(late(base))}); localStorage.setItem("sw-settings-v1", JSON.stringify({ welcome: false })); })()`);
    await page.reload();
    await page.waitForSelector(".sw-ladder");
    await page.waitForTimeout(12000); // the sheets load lazily

    const open = async (name) => {
        await page.getByRole("button", { name, exact: true }).click();
        await page.waitForTimeout(1100);
    };
    const close = async () => { await page.keyboard.press("Escape"); await page.waitForTimeout(600); };

    // Constellations: the first constellation, then the next one with the arrow
    await open("Constellations");
    let problems = await page.evaluate(measure);
    await page.screenshot({ path: `${OUT}/map-1-${tag}.png` });
    console.log(`${tag} map first:`, JSON.stringify(await page.evaluate(centre)), problems.length ? problems.join("; ") : "ok");
    if (problems.length) bad++;
    const next = page.getByRole("button", { name: "Next constellation", exact: true });
    if (await next.count()) {
        await next.click();
        await page.waitForTimeout(900);
        problems = await page.evaluate(measure);
        await page.screenshot({ path: `${OUT}/map-2-${tag}.png` });
        console.log(`${tag} map second:`, JSON.stringify(await page.evaluate(centre)), problems.length ? problems.join("; ") : "ok");
        if (problems.length) bad++;
    }
    await close();

    // Almanac: the grid, then the tap sheet for one made element
    await open("Almanac");
    problems = await page.evaluate(measure);
    await page.screenshot({ path: `${OUT}/almanac-grid-${tag}.png` });
    console.log(`${tag} almanac grid:`, problems.length ? problems.join("; ") : "ok");
    if (problems.length) bad++;
    await page.locator(".sw-codex .sw-cx[aria-label='Hydrogen']").first().click().catch(() => {});
    await page.waitForTimeout(700);
    problems = await page.evaluate(measure);
    await page.screenshot({ path: `${OUT}/almanac-sheet-${tag}.png` });
    console.log(`${tag} almanac sheet:`, problems.length ? problems.join("; ") : "ok");
    if (problems.length) bad++;
    await close();

    if (errors.length) { bad++; console.log(`${tag} page errors: ${errors.join("; ")}`); }
    await ctx.close();
}
await browser.close();
console.log(bad ? `${bad} problem group(s)` : "no overlap found");
process.exit(bad ? 1 : 0);
