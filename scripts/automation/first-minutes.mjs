// A fresh save's first minutes, headless: screenshots of what a new player sees at load, after 20 s of doing nothing,
// then the filled-order and milestone reward moments. Also logs the text a newcomer reads (objective, hint, quest).
// Needs a production server with the dev hook. Usage:
//   SITE_PASSWORD=ci-password node scripts/automation/first-minutes.mjs <base> <width> <height> <outDir> <prefix>
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const [base, w, h, out, prefix = "run"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const r = await fetch(`${base}/api/gate`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ password: process.env.SITE_PASSWORD || "ci-password" }) });
const cookie = r.headers.getSetCookie().find((s) => s.startsWith("site_unlock=")).split(";")[0].split("=")[1];
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const phone = +w < 500;
const ctx = await browser.newContext(phone ? { viewport: { width: +w, height: +h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } : { viewport: { width: +w, height: +h } });
await ctx.addCookies([{ name: "site_unlock", value: cookie, url: base }]);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`${base}/creations/games/brasswork?bwdev=1`);
await page.waitForSelector("canvas", { timeout: 120000 });
await page.waitForTimeout(3000);
const shot = (n) => page.screenshot({ path: `${out}/${prefix}-${n}-${w}.png` });
const text = () => page.evaluate(() => [...document.querySelectorAll(".ab-root [role=status], .ab-goal, .ab-next, [class*=nextstep], [class*=quest]")].map((e) => e.textContent?.trim().replace(/\s+/g, " ").slice(0, 160)).filter(Boolean));
await shot("1-load");
console.log("load text:", JSON.stringify(await text()));
await page.waitForTimeout(8000);
await shot("2-idle20s");
console.log("idle text:", JSON.stringify(await text()));
// The panels a newcomer opens first: Machines (locked slots) and the Hub order (empty crate).
const openBtn = async (label) => { const b = page.locator(`button:has-text("${label}"):visible`).first(); if (await b.count()) { await b.click(); await page.waitForTimeout(1200); return true; } return false; };
if (await openBtn("Machines")) { await shot("2a-machines"); await page.keyboard.press("Escape"); await page.waitForTimeout(600); }
if (!phone && await openBtn("Hub")) { await shot("2b-hub"); await page.keyboard.press("Escape"); await page.waitForTimeout(600); }
// Play the opening quickly through the hook, then fill the first order and the first milestone.
const spot = (a, b) => page.evaluate(([a, b]) => window.__bwdev.suggestSpot(a, b), [a, b]);
await page.evaluate(() => window.__bwdev.placeAt("drill", 1, 1));
const k = await spot(2, 2);
await page.evaluate(([x, z]) => window.__bwdev.placeAt("kiln", x, z), [k.x, k.z]);
const m = await spot(2, 2);
await page.evaluate(([x, z]) => window.__bwdev.placeAt("windmill", x, z), [m.x, m.z]);
await shot("3-built");
console.log("after build text:", JSON.stringify(await text()));
await page.evaluate(() => { const wd = window.__bwdev.getWorld(); wd.progress.delivered.iron_ingot = 10; wd.buildings[wd.hubId].input.iron_ingot = 10; });
await page.waitForTimeout(2500);
await shot("4-order-reward");
console.log("order text:", JSON.stringify(await page.evaluate(() => document.querySelector(".rm-card, .hm-toast")?.textContent?.replace(/\s+/g, " ") ?? null)));
await page.waitForTimeout(9000);
await page.evaluate(() => { const wd = window.__bwdev.getWorld(); const c = window.__bwdev.CAT; wd.progress.requestsDone = c.tree.requests.map((q) => q.id); const ms = c.tree.milestones[0]; for (const s of ms.deliver) wd.progress.delivered[s.item] = s.qty; });
await page.waitForTimeout(1500);
// The three other orders queue ahead of the milestone: dismiss them with Escape so the milestone card is on screen.
for (let i = 0; i < 3; i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(700); }
await page.waitForTimeout(1500);
await shot("5-milestone-reward");
console.log("milestone text:", JSON.stringify(await page.evaluate(() => document.querySelector(".rm-card, .hm-toast")?.textContent?.replace(/\s+/g, " ") ?? null)));
console.log(errors.length ? `console errors: ${errors.slice(0, 3).join(" | ")}` : "no console errors");
await browser.close();
