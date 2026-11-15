// Opens "Open a new workshop" and saves screenshots; checks the frame stays below the top bar and nothing repeats.
// Usage: SITE_PASSWORD=ci-password node scripts/automation/prestige-check.mjs <base> <outDir> <tag>
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const [base, out, tag = "after"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const r = await fetch(`${base}/api/gate`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ password: process.env.SITE_PASSWORD || "ci-password" }) });
const cookie = r.headers.getSetCookie().find((s) => s.startsWith("site_unlock=")).split(";")[0].split("=")[1];
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
let fails = 0;
const ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) fails++; };
for (const [w, h, phone] of [[1440, 900, false], [1440, 848, false], [1280, 720, false], [390, 844, true]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: phone, isMobile: phone });
    await ctx.addCookies([{ name: "site_unlock", value: cookie, url: base }]);
    await ctx.addInitScript(() => localStorage.setItem("brasswork-first-run-v1", "done"));
    const page = await ctx.newPage();
    await page.goto(`${base}/creations/games/brasswork?bwdev=1`);
    await page.waitForSelector("canvas", { timeout: 120000 });
    await page.waitForTimeout(3500);
    if (!process.env.NOTREADY) await page.evaluate(() => { const wd = window.__bwdev.getWorld(); wd.progress.milestonesDone = window.__bwdev.CAT.tree.milestones.map((m) => m.id); window.__bwdev.refresh(); });
    await page.waitForTimeout(500);
    if (process.env.NOTREADY) {
        // Not ready: Expedition's button is locked, so the window opens from the Prestige header in Milestones.
        if (phone) await page.locator('.ab-tab:has-text("Milestones")').first().tap();
        else await page.locator('button:visible:has-text("Milestones")').first().click();
        await page.waitForTimeout(900);
        await page.locator(".ms-prestige button:visible").first().click({ force: true }).catch(() => {});
        await page.waitForTimeout(1200);
    } else if (phone) { await page.locator('.ab-tab:has-text("More")').first().tap(); await page.waitForTimeout(500); await page.locator('.ab-more-item:has-text("Expedition")').first().tap(); }
    else await page.locator('.ab-nav button[data-label="Expedition"]').first().click();
    if (!process.env.NOTREADY) {
        await page.waitForTimeout(900);
        await page.locator('button:has-text("Plan the move")').first().click({ force: true }).catch(() => {});
        await page.waitForTimeout(1200);
    }
    const m = await page.evaluate(() => {
        const win = document.querySelector(".pw-wrap")?.getBoundingClientRect();
        const bar = document.querySelector(".ab-top")?.getBoundingClientRect();
        const reqs = [...document.querySelectorAll(".pw *")].filter((e) => e.children.length === 0 && /Finish every milestone/.test(e.textContent || "")).length;
        return { open: !!win, winTop: win && Math.round(win.top), barBottom: bar && Math.round(bar.bottom), reqs };
    });
    console.log(JSON.stringify(m));
    ok(m.open, `${w}px window opens`);
    if (m.open && w >= 760) ok(m.winTop >= m.barBottom - 2, `${w}px frame starts below the top bar`);
    ok(m.reqs <= 1, `${w}px requirement text shows once`);
    await page.screenshot({ path: `${out}/prestige-${tag}-${w}.png` });
    const cut = await page.evaluate(() => { const b = document.querySelector(".pw-body"); if (!b) return null; const r = b.getBoundingClientRect(); return { scrolls: b.scrollHeight > b.clientHeight + 1, over: b.scrollHeight - b.clientHeight }; });
    console.log("body", JSON.stringify(cut));
    if (!phone) ok(!cut?.scrolls, `${w}x${h} lists fit without scrolling`);
    await ctx.close();
}
await browser.close();
process.exit(fails ? 1 : 0);
