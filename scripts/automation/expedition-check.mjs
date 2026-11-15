// Expedition window check: opens it (the world must be able to prestige, so the check marks the milestones done), screenshots it,
// counts site cards with art, and tries hold-to-confirm with the keyboard and with touch. Usage: SITE_PASSWORD=ci-password node scripts/automation/expedition-check.mjs <base> <outDir> [width height]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const [base, out, w = "1440", h = "900"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const r = await fetch(`${base}/api/gate`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ password: process.env.SITE_PASSWORD || "ci-password" }) });
const cookie = r.headers.getSetCookie().find((s) => s.startsWith("site_unlock=")).split(";")[0].split("=")[1];
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const phone = +w < 500;
const ctx = await browser.newContext(phone ? { viewport: { width: +w, height: +h }, hasTouch: true, isMobile: true } : { viewport: { width: +w, height: +h } });
await ctx.addCookies([{ name: "site_unlock", value: cookie, url: base }]);
await ctx.addInitScript(() => localStorage.setItem("brasswork-first-run-v1", "done"));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror " + e));
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errors.push(`${m.type()} ${m.text()}`.slice(0, 200)));
await page.goto(`${base}/creations/games/brasswork?bwdev=1`);
await page.waitForSelector("canvas", { timeout: 120000 });
await page.waitForTimeout(4000);
const res = [];
const ok = (n, p, d = "") => res.push({ n, p, d });
if (phone) { await page.locator('button:visible:has-text("More")').first().tap(); await page.waitForTimeout(700); await page.locator('button:visible:text-is("Expedition")').first().tap(); }
else await page.locator('button:has-text("Expedition")').first().click();
await page.waitForTimeout(1400);
await page.screenshot({ path: `${out}/expedition-${w}.png` });
const info = await page.evaluate(() => {
    const win = document.querySelector('.bw-window[aria-label="Expedition"], .bw-window');
    const cards = [...win.querySelectorAll('[class*="ex-site"], [class*="ex-card"], [class*="site"]')];
    const imgs = [...win.querySelectorAll("[style*=background-image], img, canvas")].length;
    return { title: win.getAttribute("aria-label"), cards: cards.length, art: imgs, buttons: [...win.querySelectorAll("button")].map((b) => (b.getAttribute("aria-label") || b.textContent || "").trim().slice(0, 40)), scrollX: win.scrollWidth > win.clientWidth + 1 };
});
console.log(JSON.stringify(info));
ok("expedition window opens", /expedition/i.test(info.title ?? ""), info.title);
ok("no sideways scroll in the window", !info.scrollX);
ok("has artwork", info.art >= 4, `${info.art} art elements`);
ok("no console errors or React warnings", errors.length === 0, errors.slice(0, 3).join(" | "));
// Hold to confirm lives in the Prestige window: finish the milestones, open it, pick a site, hold with the keyboard, then (fresh page) with touch/mouse.
async function holdTest(how) {
    const ctx2 = await browser.newContext(phone ? { viewport: { width: +w, height: +h }, hasTouch: true, isMobile: true } : { viewport: { width: +w, height: +h } });
    await ctx2.addCookies([{ name: "site_unlock", value: cookie, url: base }]);
    await ctx2.addInitScript(() => localStorage.setItem("brasswork-first-run-v1", "done"));
    const p2 = await ctx2.newPage();
    await p2.goto(`${base}/creations/games/brasswork?bwdev=1`);
    await p2.waitForSelector("canvas", { timeout: 120000 });
    await p2.waitForTimeout(4000);
    await p2.evaluate(() => { const d = window.__bwdev; const wd = d.getWorld(); wd.progress.milestonesDone = d.CAT.tree.milestones.map((m) => m.id); d.refresh(); });
    await p2.waitForTimeout(600);
    if (phone) { await p2.locator('button:visible:has-text("More")').first().tap(); await p2.waitForTimeout(700); await p2.locator('button:visible:text-is("Expedition")').first().tap(); }
    else { await p2.locator('button:has-text("Expedition")').first().click(); }
    await p2.waitForTimeout(1200);
    await p2.locator('button:has-text("Plan the move")').first().click();
    await p2.waitForTimeout(500);
    await p2.screenshot({ path: `${out}/hold-${how}-${w}.png` });
    const btn = p2.locator("button.pw-hold").first();
    const present = (await btn.count()) > 0;
    let before = 0, after = 0;
    if (present) {
        before = await p2.evaluate(() => window.__bwdev.getWorld().progress.prestiges);
        const box = await btn.boundingBox();
        if (how === "keyboard") { await btn.focus(); await p2.keyboard.down("Space"); await p2.waitForTimeout(1700); await p2.keyboard.up("Space"); }
        else { await p2.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p2.mouse.down(); await p2.waitForTimeout(1700); await p2.mouse.up(); }
        await p2.waitForTimeout(800);
        after = await p2.evaluate(() => window.__bwdev.getWorld().progress.prestiges);
    }
    await ctx2.close();
    return { present, before, after };
}
for (const how of phone ? ["pointer"] : ["keyboard", "pointer"]) {
    const t = await holdTest(how);
    ok(`hold to confirm (${how}) opens the new workshop`, t.present && t.after === t.before + 1, JSON.stringify(t));
}
for (const x of res) console.log(`${x.p ? "PASS" : "FAIL"}  ${x.n}${x.p ? "" : "  " + x.d}`);
await browser.close();
process.exit(res.every((x) => x.p) ? 0 : 1);
