// Screenshots of the Starwright GUI art pass: start and mid-game, desktop 1440 and phone 390, plus each menu.
// Usage: node scripts/starwright/ui-art/shots.mjs <outDir>   (server on BASE, gate password in SITE_PASSWORD)
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = process.argv[2] ?? ".";
const errors = [];
const browser = await chromium.launch();
for (const [tag, vp] of [["1440", { width: 1440, height: 900 }], ["390", { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: tag === "390", isMobile: tag === "390" });
    await ctx.request.post(`${BASE}/api/gate`, { data: { password: process.env.SITE_PASSWORD ?? "ci-password" }, headers: { origin: BASE } });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error" || /Warning:/.test(m.text())) errors.push(`${tag}: ${m.text()}`); });
    page.on("pageerror", (e) => errors.push(`${tag}: ${e.message}`));
    await page.goto(`${BASE}/creations/games/starwright`);
    await page.waitForSelector(".sw-ladder", { timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/start-${tag}.png` });
    await page.waitForFunction(() => localStorage.getItem("sw-save-v1"), null, { timeout: 30000 });
    // a mid-game star: every row up to silicon lit, some planets, a little stardust
    const base = await page.evaluate(() => localStorage.getItem("sw-save-v1"));
    await page.addInitScript((raw) => {
        const k = "sw-save-v1";
        const s = JSON.parse(raw);
        s.amt = [9.2e6, 4.1e6, 820000, 310000, 92000, 26000, 7400, 1900, 0, 0];
        s.bought = s.bought.map((r, i) => (i < 7 ? [12 - i, 3, i < 3 ? 1 : 0] : r.map(() => 0)));
        s.mass = 3.2e7; s.heat = 9.5e9; s.age = 5400; s.stardust = 340; s.novas = 2; s.novasAll = 2; s.sdAll = 900; s.perks = ["l1", "l2", "k1"]; s.deep = 0;
        localStorage.setItem(k, JSON.stringify(s));
    }, base);
    await page.reload();
    await page.waitForSelector(".sw-ladder");
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${OUT}/mid-${tag}.png`, fullPage: false });
    if (tag === "390") { await page.locator(".sw-ladder").scrollIntoViewIfNeeded(); await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/ladder-390.png` }); }
    for (const id of ["Orbit", "Almanac", "Menu", "Constellations"]) {
        await page.getByRole("button", { name: id, exact: true }).click();
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${OUT}/menu-${id.toLowerCase()}-${tag}.png` });
        if (id === "Constellations") {
            await page.locator('[data-id="l3"]').click();
            await page.waitForTimeout(1300);
            await page.screenshot({ path: `${OUT}/chart-zoom-${tag}.png` });
            await page.locator(".sw-sc-buy").click();
            await page.waitForTimeout(300);
            await page.screenshot({ path: `${OUT}/chart-buy-${tag}.png` });
            await page.waitForTimeout(900);
            await page.screenshot({ path: `${OUT}/chart-lit-${tag}.png` });
            await page.keyboard.press("Escape");
            await page.waitForTimeout(700);
        }
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
    }
    // every star lit, to show the deep stars row
    await page.addInitScript(() => {
        const s = JSON.parse(localStorage.getItem("sw-save-v1"));
        s.perks = ["l1","l2","l3","l4","l5","k1","k2","k3","k4","k5","a1","a2","a3","a4","a5","w1","w2","w3","w4","w5"]; s.stardust = 4200; s.deep = 3;
        localStorage.setItem("sw-save-v1", JSON.stringify(s));
    });
    await page.reload(); await page.waitForSelector(".sw-ladder"); await page.waitForTimeout(1200);
    await page.getByRole("button", { name: "Constellations", exact: true }).click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/chart-deep-${tag}.png` });
    await page.locator(".sw-deep-buy").click(); await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/chart-deep-bought-${tag}.png` });
    await ctx.close();
}
await browser.close();
console.log(errors.length ? `ERRORS\n${errors.join("\n")}` : "no console errors");
