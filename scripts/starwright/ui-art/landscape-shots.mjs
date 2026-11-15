// Landscape phone pass: start and mid game at 844x390 and 667x375 with touch, plus the Orbit and constellation panels.
// Usage: node scripts/starwright/ui-art/landscape-shots.mjs <outDir>   (server on BASE, gate password in SITE_PASSWORD)
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = process.argv[2] ?? ".";
const errors = [];
const browser = await chromium.launch();
for (const [w, h] of [[844, 390], [667, 375]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await ctx.request.post(`${BASE}/api/gate`, { data: { password: process.env.SITE_PASSWORD ?? "ci-password" }, headers: { origin: BASE } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${w}: ${e.message}`));
    await page.goto(`${BASE}/creations/games/starwright`);
    await page.waitForFunction(() => localStorage.getItem("sw-save-v1"), null, { timeout: 30000 });
    const base = await page.evaluate(() => localStorage.getItem("sw-save-v1"));
    await page.addInitScript((raw) => {
        const s = JSON.parse(raw);
        s.amt = [9.2e6, 4.1e6, 820000, 310000, 92000, 26000, 7400, 9000, 0, 0];
        s.bought = s.bought.map((r, i) => (i < 7 ? [12 - i, 3, i < 3 ? 1 : 0] : r.map(() => 0)));
        s.mass = 3.2e7; s.heat = 9.5e9; s.age = 5400; s.stardust = 340; s.novas = 2; s.novasAll = 2; s.sdAll = 900; s.perks = ["l1", "l2", "k1"]; s.planets = ["ember", "glass"]; s.planetAge = { ember: 300, glass: 90 };
        localStorage.setItem("sw-save-v1", JSON.stringify(s));
    }, base);
    await page.reload();
    await page.waitForSelector(".sw-ladder");
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/land-${w}-game.png` });
    // overflow and clipping report: anything of the dock or panels outside the viewport, and the document scrolling sideways
    const rep = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll(".sw-ladder, .sw-dock, .sw-collapse, .sw-panel, [class*=sw-hud]")) {
            const r = el.getBoundingClientRect();
            if (r.width && (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1)) out.push(`${el.className.toString().slice(0, 40)} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.right)},${Math.round(r.bottom)}`);
        }
        return { out, sideways: document.documentElement.scrollWidth > innerWidth + 1, vp: `${innerWidth}x${innerHeight}` };
    });
    console.log(w, JSON.stringify(rep));
    for (const id of ["Orbit", "Constellations"]) {
        await page.getByRole("button", { name: id, exact: true }).click();
        await page.waitForTimeout(1100);
        await page.screenshot({ path: `${OUT}/land-${w}-${id.toLowerCase()}.png` });
        await page.keyboard.press("Escape");
        await page.waitForTimeout(600);
    }
    await ctx.close();
}
await browser.close();
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
