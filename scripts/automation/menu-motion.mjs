// Menu motion check for Brasswork (headless Chrome, software WebGL). Run on a production server (npm run build, then next start).
// Usage: SITE_PASSWORD=ci-password node scripts/automation/menu-motion.mjs <base> <outDir> [--phone] [--reduce]
//
// For each menu it: clicks the trigger, freezes the entrance at 55% of its timeline and saves a frame, lets it finish,
// presses Escape, freezes the exit at 45% and saves a frame, then checks the menu has left the page.
// It prints, per menu, the longest animation it saw (budget: 220 ms enter, 200 ms exit) and any failure.
// The frames are PNG only, named mid-<menu>-<width>.png, mid-out-<menu>-<width>.png, so the motion can be judged by stills.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const [base, out] = process.argv.slice(2);
const rest = process.argv.slice(4);
const flag = (f) => rest.includes(f);
mkdirSync(out, { recursive: true });

const pw = process.env.SITE_PASSWORD || "ci-password";
const r = await fetch(`${base}/api/gate`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ password: pw }) });
const cookie = r.headers.getSetCookie().find((s) => s.startsWith("site_unlock=")).split(";")[0];

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const phone = flag("--phone");
const width = phone ? 390 : 1440;
const profile = phone ? { ...devices["iPhone 13"], hasTouch: true } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const ctx = await browser.newContext({ ...profile, reducedMotion: flag("--reduce") ? "reduce" : "no-preference" });
await ctx.addCookies([{ name: "site_unlock", value: cookie.split("=")[1], url: base }]);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(`${base}/creations/games/brasswork?bwdev=1`);
await page.waitForSelector("canvas", { timeout: 60000 });
await page.waitForTimeout(4000);

// Freeze every running animation that belongs to a menu at the given fraction of its timeline.
const freeze = (fraction) => page.evaluate((f) => {
  const menu = /^(bw-|bwm-|hm-|bx-|ab-drawer|ab-pal|bw-phone)/;
  const anims = document.getAnimations().filter((a) => {
    const n = a.animationName || "";
    return menu.test(n) && a.effect && Number.isFinite(a.effect.getComputedTiming().endTime);
  });
  for (const a of anims) {
    a.pause();
    const d = a.effect.getComputedTiming().endTime;
    a.currentTime = Math.max(0, Math.min(d, d * f));
  }
  return anims.map((a) => ({ name: a.animationName, ms: Math.round(a.effect.getComputedTiming().endTime) }));
}, fraction);

// The page's animation clock is slowed to 10% while a menu is opening or closing, so a freeze lands mid-motion
// instead of after the 200 ms animation has finished. Release sets it back to real time and plays on.
const cdp = await ctx.newCDPSession(page);
await cdp.send("Animation.enable");
const clock = (rate) => cdp.send("Animation.setPlaybackRate", { playbackRate: rate });
const release = async () => {
  await clock(1);
  await page.evaluate(() => document.getAnimations().forEach((a) => a.play()));
};

// Longest menu animation currently running, read before freezing: a check against the motion budget.
const longest = () => page.evaluate(() => {
  const menu = /^(bw-|bwm-|hm-|bx-|ab-drawer|ab-pal|bw-phone)/;
  let best = { name: "", ms: 0 };
  for (const a of document.getAnimations()) {
    const n = a.animationName || "";
    if (!menu.test(n) || !a.effect) continue;
    const ms = a.effect.getComputedTiming().endTime;
    if (!Number.isFinite(ms)) continue; // looping ambient animations (breathing marks) are not part of a menu
    if (ms > best.ms) best = { name: n, ms: Math.round(ms) };
  }
  return best;
});

const menus = [
  { id: "research", open: () => page.getByRole("button", { name: /^research$/i }).first().click(), sel: ".bw-window[data-theme='research']" },
  { id: "expedition", open: () => page.getByRole("button", { name: /^expedition$/i }).first().click(), sel: ".bw-window[data-theme='expedition']" },
  { id: "hub", open: () => page.getByRole("button", { name: /^hub$/i }).first().click(), sel: ".bw-window[data-theme='hub']" },
  { id: "production", open: () => page.getByRole("button", { name: /production stats/i }).first().click(), sel: ".bw-window[data-theme='production']" },
  { id: "settings", open: () => page.getByRole("button", { name: /^settings$/i }).first().click(), sel: ".bw-window[data-theme='settings']" },
  { id: "milestones", open: () => page.getByRole("button", { name: /^milestones/i }).first().click(), sel: ".bw-window[data-theme='milestones']" },
  { id: "codex", open: () => page.keyboard.press("c"), sel: ".bx-scrim" },
];

const report = [];
for (const m of menus) {
  const row = { menu: m.id, opened: false, longest: null, leftPage: null, problems: [] };
  try {
    await clock(0.1);
    await m.open();
    await page.waitForSelector(m.sel, { timeout: 2500 });
    row.opened = true;
    row.longest = await longest();
    await freeze(0.55);
    await page.waitForTimeout(60);
    await page.screenshot({ path: join(out, `mid-${m.id}-${width}.png`) });
    await release();
    await page.waitForTimeout(350);
    await page.screenshot({ path: join(out, `open-${m.id}-${width}.png`) });
    // Close with Escape, freeze the exit mid-way, and check the menu leaves.
    await clock(0.1);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(20);
    const exitInfo = await page.evaluate(() => document.getAnimations().map((a) => a.animationName || "").filter((n) => /-out$|closing/.test(n)));
    await freeze(0.45);
    await page.screenshot({ path: join(out, `mid-out-${m.id}-${width}.png`) });
    await release();
    await page.waitForTimeout(320);
    const still = await page.$(m.sel);
    row.leftPage = still === null;
    row.exitAnimations = [...new Set(exitInfo)];
    if (!row.leftPage) row.problems.push("still on page 320 ms after Escape");
    if (row.longest && row.longest.ms > 260) row.problems.push(`longest animation ${row.longest.ms} ms (${row.longest.name})`);
  } catch (e) {
    row.problems.push(`not reached: ${String(e).split("\n")[0]}`);
  }
  report.push(row);
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(250);
}

// Horizontal scroll check on the page (phone layout must not scroll sideways).
const scroll = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
console.log(JSON.stringify({ width, reduced: flag("--reduce"), scroll, report }, null, 2));
console.log(errors.length ? `console errors: ${errors.slice(0, 4).join(" | ")}` : "no console errors");
await browser.close();
