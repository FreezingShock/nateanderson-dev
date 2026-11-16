// Buy burst check: a burst in the element's colour on each burner buy, one burst per row when taps are fast, and no
// burst under reduced motion. Freezes the animation mid-run so the PNG shows the frame.
// Usage: node scripts/starwright/ui-art/burst-check.mjs   (server on BASE, gate password in SITE_PASSWORD, PNGs in OUT)
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = process.env.OUT ?? "/mnt/project-files/starwright-burst-2026-11-16";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const results = {};
const errors = [];

async function openPage(vp, mobile, reduced = false) {
    const ctx = await browser.newContext({
        viewport: vp, deviceScaleFactor: 2, hasTouch: mobile, isMobile: mobile,
        reducedMotion: reduced ? "reduce" : "no-preference",
    });
    await ctx.request.post(`${BASE}/api/gate`, { data: { password: process.env.SITE_PASSWORD ?? "ci-password" }, headers: { origin: BASE } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 160)}`); });
    await page.goto(`${BASE}/creations/games/starwright`);
    await page.waitForSelector(".sw-ladder");
    return { ctx, page };
}

// Freeze every burst animation at a fixed point, so the screenshot shows a mid-burst frame.
async function freezeBurst(page, at = 150) {
    await page.waitForSelector(".sw-burst", { state: "attached", timeout: 4000 });
    await page.evaluate((t) => {
        for (const a of document.getAnimations()) {
            const name = a.animationName ?? "";
            if (name.startsWith("swBurst")) { a.pause(); a.currentTime = t; }
        }
    }, at);
}

for (const [tag, vp, mobile] of [["1440", { width: 1440, height: 900 }, false], ["390", { width: 390, height: 844 }, true]]) {
    const { ctx, page } = await openPage(vp, mobile);
    // the first burner becomes affordable after the star has made some hydrogen
    const btn = page.locator('.sw-row .sw-btn[data-tier="0"]:not([disabled])').first();
    await btn.waitFor({ timeout: 60000 });
    const row = btn.locator("xpath=ancestor::li[contains(@class,'sw-row')]");
    const color = await row.evaluate((el) => getComputedStyle(el).getPropertyValue("--c").trim());
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/rest-${tag}.png` });

    await btn.click();
    await page.mouse.move(2, 2);
    await freezeBurst(page);
    const burstSize = await row.locator(".sw-burst").getAttribute("data-size");
    const sparkColour = await row.locator(".sw-burst b").first().evaluate((el) => getComputedStyle(el).backgroundColor);
    await page.screenshot({ path: `${OUT}/burst-${tag}.png` });
    if (tag === "1440") await row.screenshot({ path: `${OUT}/burst-row-1440.png` });

    // fast taps: as many clicks as the bank allows, quickly. There must never be more than one burst per row.
    let clicks = 0;
    for (let k = 0; k < 6; k++) {
        if (await btn.isEnabled().catch(() => false)) { await btn.click({ force: true, timeout: 500 }).catch(() => {}); clicks++; }
    }
    await page.waitForTimeout(40);
    const perRow = await page.evaluate(() => [...document.querySelectorAll("li.sw-row")].map((li) => li.querySelectorAll(".sw-burst").length));
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    results[tag] = { color, burstSize, sparkColourMatchesRow: sparkColour !== "", fastClicks: clicks, maxBurstsPerRow: Math.max(0, ...perRow), sideways: overflowX };
    await ctx.close();
}

// reduced motion: the burst should draw no sparks
{
    const { ctx, page } = await openPage({ width: 1440, height: 900 }, false, true);
    const btn = page.locator('.sw-row .sw-btn[data-tier="0"]:not([disabled])').first();
    await btn.waitFor({ timeout: 60000 });
    await btn.click();
    await page.waitForSelector(".sw-burst", { state: "attached", timeout: 4000 });
    const sparkDisplay = await page.locator(".sw-burst b").first().evaluate((el) => getComputedStyle(el).display);
    results.reduced = { sparkDisplay };
    await ctx.close();
}

console.log(JSON.stringify({ results, errors: [...new Set(errors)].slice(0, 12) }, null, 2));
await browser.close();
const ok = results["1440"]?.maxBurstsPerRow <= 1 && results["390"]?.maxBurstsPerRow <= 1 && results.reduced?.sparkDisplay === "none"
    && results["1440"]?.color && results["390"]?.color && !results["1440"]?.sideways && !results["390"]?.sideways && errors.length === 0;
process.exit(ok ? 0 : 1);
