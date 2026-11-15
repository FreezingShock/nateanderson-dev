// Brasswork tooltip check (shared layer in components/brasswork-ui/tip.tsx). Desktop: hover shows a tag with the
// game data, it follows the pointer over the island, and it clears on leave. Phone (390 wide, touch): a tap shows the
// tag and it clears by itself, with no sideways scroll. Writes screenshots named <label>-<state>-<width>.png.
// Usage: SITE_PASSWORD=ci-password node scripts/automation/tooltip-check.mjs <base> <outDir> [label]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const [base, out, label = "after"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const r = await fetch(`${base}/api/gate`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ password: process.env.SITE_PASSWORD || "ci-password" }) });
const cookie = r.headers.getSetCookie().find((s) => s.startsWith("site_unlock=")).split(";")[0].split("=")[1];
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const res = [];
const ok = (name, pass, detail = "") => res.push({ name, pass: !!pass, detail });
// animations: "disabled" finishes running fades at once; software WebGL here renders too slowly for a 140 ms fade to finish.
const shot = (page, state, width) => page.screenshot({ path: `${out}/${label}-${state}-${width}.png`, animations: "disabled" });

// The one shared tag: visible state, title, tag line and row labels.
const tip = (page) =>
  page.evaluate(() => {
    const el = document.querySelector(".bwtip");
    if (!el) return null;
    return {
      on: el.getAttribute("data-on") === "1",
      opacity: Number(getComputedStyle(el).opacity),
      title: el.querySelector(".bwtip-title")?.textContent ?? "",
      tag: el.querySelector(".bwtip-tag")?.textContent ?? "",
      rows: [...el.querySelectorAll(".bwtip-row dt")].map((d) => d.textContent),
      inView: (() => { const b = el.getBoundingClientRect(); return b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight; })(),
    };
  });

async function open(profile) {
  const ctx = await browser.newContext(profile);
  await ctx.addCookies([{ name: "site_unlock", value: cookie, url: base }]);
  await ctx.addInitScript(() => localStorage.setItem("brasswork-first-run-v1", "done"));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${base}/creations/games/brasswork?bwdev=1`);
  await page.waitForSelector("canvas", { timeout: 120000 });
  await page.waitForTimeout(3500);
  return { ctx, page, errors };
}

{ // Desktop, 1440 wide
  const { ctx, page, errors } = await open({ viewport: { width: 1440, height: 900 } });
  await page.click('button:has-text("Machines")').catch(() => {});
  await page.waitForTimeout(700);
  await page.locator('button[aria-label="Select Drill"]').hover();
  // Software WebGL runs near 5 frames a second, so the 140 ms fade needs a few frames before it reads fully opaque.
  await page.waitForTimeout(1200);
  const t = await tip(page);
  ok("desktop: build tile tag shows the machine, its tag and its cost", t?.on && /Drill/.test(t.title) && t.rows.includes("Cost"), JSON.stringify(t));
  ok("desktop: tag stays inside the window", t?.inView, JSON.stringify(t));
  await shot(page, "build-tile", 1440);

  await page.mouse.move(700, 880);
  await page.waitForTimeout(350);
  ok("desktop: tag clears when the pointer leaves", (await tip(page))?.on === false);

  await page.locator(".ab-res-item").first().hover();
  await page.waitForTimeout(1200);
  const rt = await tip(page);
  ok("desktop: resource tag gives the name, stock and trend", rt?.on && rt.rows.includes("In stock") && rt.rows.includes("Trend"), JSON.stringify(rt));
  await shot(page, "resource", 1440);

  await page.locator('button.ab-text-btn.ab-primary').hover();
  await page.waitForTimeout(450);
  ok("desktop: Research button tag", (await tip(page))?.title === "Research");
  await page.mouse.move(700, 880);
  await page.waitForTimeout(300);

  // Canvas: a tag follows the pointer over a placed building when no tool is armed.
  await page.evaluate(() => window.__bwdev?.setTool?.(null));
  const hp = await page.evaluate(() => {
    const wd = window.__bwdev.getWorld();
    const b = Object.values(wd.buildings).find((x) => x.type === "hub");
    return window.__bwdev.cellPx(b.x + 1, b.z + 1);
  });
  await page.mouse.move(hp.x - 4, hp.y - 4);
  await page.mouse.move(hp.x, hp.y, { steps: 3 });
  await page.waitForTimeout(1200);
  const ht = await tip(page);
  ok("desktop: hovering the hub on the island shows its tag", ht?.on && /hub/i.test(ht.title), JSON.stringify(ht));
  await shot(page, "island-hub", 1440);
  await page.mouse.move(120, 760, { steps: 2 });
  await page.waitForTimeout(350);
  ok("desktop: island tag clears off the island", (await tip(page))?.on === false);
  ok("desktop: no script errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

{ // Phone, 390 wide, touch
  const { ctx, page, errors } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await page.locator('button:visible:has-text("Machines")').first().tap().catch(() => {});
  await page.waitForTimeout(800);
  const drill = page.locator('button[aria-label^="Select Drill"]').first();
  if (await drill.count()) await drill.tap({ force: true });
  await page.waitForTimeout(350);
  await page.waitForTimeout(600);
  const pt = await tip(page);
  ok("phone: a tap shows the machine tag", pt?.on && /Drill/.test(pt.title), JSON.stringify(pt));
  ok("phone: tag stays inside the screen", pt?.inView, JSON.stringify(pt));
  await shot(page, "tap-build-tile", 390);
  await page.waitForTimeout(3600);
  ok("phone: tag clears by itself after a few seconds", (await tip(page))?.on === false);
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok("phone: no sideways scroll", sideways <= 0, String(sideways));
  ok("phone: no script errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

for (const x of res) console.log(`${x.pass ? "PASS" : "FAIL"}  ${x.name}${x.pass ? "" : "  " + x.detail}`);
await browser.close();
process.exit(res.every((x) => x.pass) ? 0 : 1);
