// Checks that the tool hint never overlaps the objective card, at several widths. Screenshots 1440 and 390.
// Usage: SITE_PASSWORD=ci-password node scripts/automation/overlap-check.mjs <base> <outDir> <tag>
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
for (const [w, h, phone] of [[1440, 900, false], [1100, 800, false], [800, 700, false], [390, 844, true]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: phone, isMobile: phone });
    await ctx.addCookies([{ name: "site_unlock", value: cookie, url: base }]);
    await ctx.addInitScript(() => localStorage.setItem("brasswork-first-run-v1", "done"));
    const page = await ctx.newPage();
    await page.goto(`${base}/creations/games/brasswork?bwdev=1`);
    await page.waitForSelector("canvas", { timeout: 120000 });
    await page.waitForTimeout(3500);
    await page.evaluate(() => { const wd = window.__bwdev.getWorld(); wd.buildings[wd.hubId].input.iron_ingot = 12; window.__bwdev.refresh(); window.__bwdev.setTool("belt"); });
    await page.keyboard.press("Escape").catch(() => {});
    await page.evaluate(() => window.__bwdev.setTool("belt"));
    await page.waitForTimeout(500);
    // The host mirrors the tool into its hint on a key or pointer event.
    await page.mouse.move(w / 2, h / 3);
    await page.keyboard.press("Shift");
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => {
        const a = document.querySelector(".bw-note")?.getBoundingClientRect();
        const b = document.querySelector(".ab-next")?.getBoundingClientRect();
        if (!a || !b) return { a: !!a, b: !!b };
        const overlap = !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
        return { overlap, note: [a.top, a.bottom].map(Math.round), next: [b.top, b.bottom].map(Math.round) };
    });
    const ok = m.a !== false && m.overlap === false;
    console.log(ok ? "PASS" : "FAIL", `${w}px`, JSON.stringify(m));
    if (!ok) fails++;
    if (w === 1440 || w === 390) await page.screenshot({ path: `${out}/hint-${tag}-${w}.png` });
    await ctx.close();
}
await browser.close();
process.exit(fails ? 1 : 0);
