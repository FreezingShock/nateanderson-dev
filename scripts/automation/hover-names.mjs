// Hover name check: build tile, resource box and a placed machine show a name within ~200 ms and clear on leave;
// on touch no label stays after a tap. Usage: SITE_PASSWORD=ci-password node scripts/automation/hover-names.mjs <base> <outDir>
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const [base, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const r = await fetch(`${base}/api/gate`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ password: process.env.SITE_PASSWORD || "ci-password" }) });
const cookie = r.headers.getSetCookie().find((s) => s.startsWith("site_unlock=")).split(";")[0].split("=")[1];
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const res = [];
const ok = (name, pass, detail = "") => res.push({ name, pass, detail });
// Strongest visible name tag among the icons inside the matched element.
const tag = (page, sel) => page.evaluate((sel) => { const els = [...document.querySelectorAll(sel)]; if (!els.length) return null; return els.map((el) => { const cs = getComputedStyle(el, "::before"); return { content: cs.content, opacity: Number(cs.opacity) }; }).sort((a, b) => b.opacity - a.opacity)[0]; }, sel);

async function open(profile) {
    const ctx = await browser.newContext(profile);
    await ctx.addCookies([{ name: "site_unlock", value: cookie, url: base }]);
    await ctx.addInitScript(() => localStorage.setItem("brasswork-first-run-v1", "done"));
    const page = await ctx.newPage();
    await page.goto(`${base}/creations/games/brasswork?bwdev=1`);
    await page.waitForSelector("canvas", { timeout: 120000 });
    await page.waitForTimeout(4000);
    return { ctx, page };
}

{ // Desktop
    const { ctx, page } = await open({ viewport: { width: 1440, height: 900 } });
    await page.click('button:has-text("Machines")');
    await page.waitForTimeout(900);
    const tile = page.locator('button[aria-label="Select Drill"]');
    await tile.hover();
    await page.waitForTimeout(700); // software WebGL renders ~5 fps, so the 140 ms CSS fade needs a few frames to show
    const t = await tag(page, '[aria-label="Select Drill"] .bwi[data-name]');
    ok("desktop: build tile shows its name (0.14 s fade)", !!t && t.opacity > 0.9 && t.content.includes("Drill"), JSON.stringify(t));
    await page.screenshot({ path: `${out}/hover-tile-1440.png` });
    await page.mouse.move(800, 600);
    await page.waitForTimeout(700);
    const t2 = await tag(page, '[aria-label="Select Drill"] .bwi[data-name]');
    ok("desktop: tile name clears on leave", !!t2 && t2.opacity < 0.05, JSON.stringify(t2));
    // Resource box: the tooltip drops below the box, with the name and live counts.
    const box = page.locator(".ab-res-item").first();
    await box.hover();
    await page.waitForTimeout(700);
    const rb = await box.evaluate((el) => { const tip = el.querySelector(".ab-res-tip"); const cs = getComputedStyle(tip); const r = tip.getBoundingClientRect(); return { opacity: Number(cs.opacity), name: tip.querySelector(".ab-res-tip-name")?.textContent, inView: r.top >= 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; });
    ok("desktop: resource box shows its name and counts, fully in view", rb.opacity > 0.9 && !!rb.name && rb.inView, JSON.stringify(rb));
    await page.screenshot({ path: `${out}/hover-resource-1440.png` });
    // Placed machine on the island: pointer over the hub with no tool armed.
    const hp = await page.evaluate(() => { const wd = window.__bwdev.getWorld(); const b = Object.values(wd.buildings).find((x) => x.type === "hub"); return window.__bwdev.cellPx(b.x + 1, b.z + 1); });
    await page.evaluate(() => window.__bwdev.setTool(null));
    await page.mouse.move(hp.x - 4, hp.y - 4);
    await page.mouse.move(hp.x, hp.y, { steps: 3 });
    await page.waitForTimeout(250);
    const hn = await page.evaluate(() => { const e = document.querySelector(".bw-hovername"); return { on: e?.getAttribute("data-on"), text: e?.textContent }; });
    ok("desktop: hovering the hub shows its name", hn.on === "1" && /hub/i.test(hn.text ?? ""), JSON.stringify(hn));
    await page.screenshot({ path: `${out}/hover-machine-1440.png` });
    await page.mouse.move(150, 700);
    await page.waitForTimeout(250);
    const hn2 = await page.evaluate(() => document.querySelector(".bw-hovername")?.getAttribute("data-on"));
    ok("desktop: machine name clears on leave", hn2 === "0", String(hn2));
    await ctx.close();
}
{ // Touch
    const { ctx, page } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await page.locator('button:visible:has-text("Machines")').first().tap();
    await page.waitForTimeout(900);
    const tile = page.locator('button[aria-label^="Select Drill"], [aria-label="Select Drill"]').first();
    if (await tile.count()) await tile.tap();
    await page.waitForTimeout(400);
    await page.tap("canvas", { position: { x: 100, y: 200 } }).catch(() => {});
    await page.waitForTimeout(600);
    const stuck = await page.evaluate(() => {
        const names = [...document.querySelectorAll(".bwi[data-name]")].filter((el) => Number(getComputedStyle(el, "::before").opacity) > 0.5).length;
        return { tags: names, hover: document.querySelector(".bw-hovername")?.getAttribute("data-on") };
    });
    ok("touch: no name tag stays on screen after taps", stuck.tags === 0 && stuck.hover !== "1", JSON.stringify(stuck));
    await page.screenshot({ path: `${out}/hover-touch-390.png` });
    await ctx.close();
}
for (const x of res) console.log(`${x.pass ? "PASS" : "FAIL"}  ${x.name}${x.pass ? "" : "  " + x.detail}`);
await browser.close();
process.exit(res.every((x) => x.pass) ? 0 : 1);
