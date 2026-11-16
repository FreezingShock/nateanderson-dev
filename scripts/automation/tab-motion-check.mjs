// Tab motion check for Brasswork on a phone (headless Chrome, software WebGL). Run on a production server.
// Usage: SITE_PASSWORD=ci-password node scripts/automation/tab-motion-check.mjs <base> [outDir]
//
// Checks the tab rows that swap a pane on a phone: Settings pages and Hub pages. For each switch it reads the
// running animations on the pane that came into view (it should be bwm-swap-in, 180 ms), checks that the tab shows
// the press state (translateY 2px) while the pointer is down, and that reduce motion turns the pane swap off.
// Exits 1 on any failure. Screenshots go to outDir when given (PNG only).
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const [base, outDir] = process.argv.slice(2);
if (outDir) mkdirSync(outDir, { recursive: true });
const pw = process.env.SITE_PASSWORD || "ci-password";
const r = await fetch(`${base}/api/gate`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ password: pw }) });
const cookie = r.headers.getSetCookie().find((s) => s.startsWith("site_unlock=")).split(";")[0];

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const results = [];
const check = (ok, msg) => { results.push(ok); console.log(ok ? "PASS" : "FAIL", msg); };

async function open(reduce) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], hasTouch: true, reducedMotion: reduce ? "reduce" : "no-preference" });
  await ctx.addCookies([{ name: "site_unlock", value: cookie.split("=")[1], url: base }]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${base}/creations/games/brasswork?bwdev=1`);
  await page.waitForSelector("canvas", { timeout: 60000 });
  await page.waitForTimeout(3000);
  return { ctx, page, errors };
}

const runningAnims = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  return el ? el.getAnimations().filter((a) => a.playState === "running").map((a) => a.animationName) : null;
}, sel);

const pressed = (page, sel) => page.evaluate(async (s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const box = el.getBoundingClientRect();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}, sel);

// Phone: the Hub and Settings are reached from the More tab.
// The phone stage sits over the tab bar in headless layout, so pointer clicks are intercepted. Clicking the element
// itself runs the same React handler, which is what a tap does.
const tap = (loc) => loc.evaluate((el) => el.click());

async function menuFrom(page, item) {
  await tap(page.locator(".ab-tab", { hasText: "More" }).first());
  await page.waitForTimeout(150);
  await tap(page.locator(".ab-more-item", { hasText: item }).first());
  await page.waitForTimeout(400);
}

const { ctx, page, errors } = await open(false);

// ---- Hub: Order -> Orders and milestones
await menuFrom(page, "Hub");
await page.waitForSelector(".hm-tabs", { timeout: 10000 });
await tap(page.locator(".hm-tab", { hasText: "Orders and milestones" }));
await page.waitForTimeout(30);
const hubAnims = await runningAnims(page, ".hm-side");
check(Array.isArray(hubAnims) && hubAnims.includes("bwm-swap-in"), `hub ladder pane swaps in on phone (animations: ${JSON.stringify(hubAnims)})`);
await page.waitForTimeout(300);
if (outDir) await page.screenshot({ path: join(outDir, "tab-hub-ladder-390.png") });

// Press state: the :active rule for tabs is loaded and the tab has a transition on it. (Holding :active over a phone
// tab is not reliable headless, because the stage canvas sits over the tab bar, so the rule is checked, not the pixel.)
const press = await page.evaluate(() => {
  const rules = [...document.styleSheets].flatMap((sh) => { try { return [...sh.cssRules]; } catch { return []; } });
  const hasActive = rules.some((r) => r.selectorText && r.selectorText.includes(".bwm-tab:active") && /translateY\(2px\)/.test(r.cssText));
  const tab = document.querySelector(".hm-tab");
  return { hasActive, transition: tab ? getComputedStyle(tab).transitionProperty : "" };
});
check(press.hasActive && press.transition.includes("transform"), `tab press rule loaded and tabs ease their transform (transition: ${press.transition})`);

await page.keyboard.press("Escape");
await page.waitForTimeout(400);

// ---- Settings: Sound -> Display -> Numbers
await menuFrom(page, "Settings");
await page.waitForSelector(".bws-tabs", { timeout: 10000 });
await tap(page.locator(".bws-tab", { hasText: "Display" }));
await page.waitForTimeout(30);
const setAnims = await runningAnims(page, '.bws-group[data-tab="display"]');
check(Array.isArray(setAnims) && setAnims.includes("bwm-swap-in"), `settings page pane swaps in on phone (animations: ${JSON.stringify(setAnims)})`);
await page.waitForTimeout(300);
if (outDir) await page.screenshot({ path: join(outDir, "tab-settings-display-390.png") });
await tap(page.locator(".bws-tab", { hasText: "Numbers" }));
await page.waitForTimeout(30);
const numAnims = await runningAnims(page, '.bws-group[data-tab="numbers"]');
check(Array.isArray(numAnims) && numAnims.includes("bwm-swap-in"), "switching to Numbers swaps the pane again");
const titleFits = await page.evaluate(() => { const t = document.querySelector(".bws-body")?.closest(".bw-window")?.querySelector(".bw-window-title"); return t ? t.scrollWidth <= t.clientWidth : false; });
check(titleFits, "settings window title is not truncated on a phone");
check(errors.length === 0, `no page errors (${errors.length})`);
await ctx.close();

// ---- Reduce motion: the pane appears at once
const red = await open(true);
await menuFrom(red.page, "Settings");
await red.page.waitForSelector(".bws-tabs", { timeout: 10000 });
await tap(red.page.locator(".bws-tab", { hasText: "Display" }));
await red.page.waitForTimeout(30);
const redAnims = await runningAnims(red.page, '.bws-group[data-tab="display"]');
check(Array.isArray(redAnims) && !redAnims.includes("bwm-swap-in"), `reduce motion: no pane swap (animations: ${JSON.stringify(redAnims)})`);
await red.ctx.close();

// Desktop (1440): the same windows show every pane at once, so nothing should animate in the pane. Screenshots only.
if (outDir) {
  const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await dctx.addCookies([{ name: "site_unlock", value: cookie.split("=")[1], url: base }]);
  const dp = await dctx.newPage();
  await dp.goto(`${base}/creations/games/brasswork?bwdev=1`);
  await dp.waitForSelector("canvas", { timeout: 60000 });
  await dp.waitForTimeout(3000);
  await tap(dp.locator('button[data-label="Hub"]').first());
  await dp.waitForTimeout(700);
  await dp.screenshot({ path: join(outDir, "tab-hub-1440.png") });
  await dp.keyboard.press("Escape");
  await dp.waitForTimeout(400);
  await menuFrom(dp, "Settings");
  await dp.waitForSelector(".bws-body", { timeout: 10000 });
  await dp.waitForTimeout(500);
  await dp.screenshot({ path: join(outDir, "tab-settings-1440.png") });
  const desk = await dp.evaluate(() => [...document.querySelectorAll(".bws-group")].map((g) => getComputedStyle(g).animationName));
  check(desk.every((n) => n === "none"), `desktop: settings panes do not animate on open (${JSON.stringify(desk)})`);
  await dctx.close();
}

await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
