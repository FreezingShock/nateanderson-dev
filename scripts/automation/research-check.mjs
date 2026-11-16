// Research menu check: opens it with blueprints in hand, lists React/console errors, checks every card has art and a name,
// that Tab reaches the cards, and clicking a card opens one pop-up beside it. Usage: SITE_PASSWORD=ci-password node scripts/automation/research-check.mjs <base> <outDir> [width height]
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
await page.evaluate(() => { const wd = window.__bwdev.getWorld(); wd.progress.blueprints = 60; window.__bwdev.refresh(); });
await page.waitForTimeout(500);
const res = [];
const ok = (n, p, d = "") => res.push({ n, p, d });
const open = phone ? page.locator('button:visible:has-text("Research")').first() : page.locator('button:has-text("Research")').first();
await (phone ? open.tap() : open.click());
await page.waitForTimeout(1400);
await page.screenshot({ path: `${out}/research-${w}.png` });
const cards = await page.evaluate(() => [...document.querySelectorAll(".bw-window .rs-card")].filter((e) => e.matches("button, [role=button], [tabindex]")).map((e) => ({ name: (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 30), art: !!e.querySelector("[class*=art], canvas, img, .bwi, [style*=background]") })));
ok("research has cards", cards.length >= 20, `${cards.length} cards`);
ok("every card has a name", cards.every((c) => c.name), JSON.stringify(cards.filter((c) => !c.name).length));
ok("every card has art", cards.every((c) => c.art), `${cards.filter((c) => !c.art).length} without`);
// Names must fit inside their card: the art sits above the name with no overlap, and the name's text is not cut off.
const fit = await page.evaluate(() => [...document.querySelectorAll(".bw-window .rs-card")].map((c) => {
    const a = c.querySelector(".rs-card-art").getBoundingClientRect(), n = c.querySelector(".rs-card-name"), nb = n.getBoundingClientRect(), cb = c.getBoundingClientRect();
    return { name: n.textContent, bad: n.scrollHeight > n.clientHeight + 1 || nb.bottom > cb.bottom + 0.5 || a.bottom > nb.top + 1 };
}).filter((x) => x.bad));
ok("every card name fits inside its card", fit.length === 0, fit.slice(0, 3).map((x) => x.name).join(", "));
const headH = await page.evaluate(() => document.querySelector('.bw-window[aria-label="Research"] .bw-window-head')?.getBoundingClientRect().height ?? 0);
ok("research header band is 52 px or less", headH > 0 && headH <= 52, `${Math.round(headH)} px`);
if (!phone) {
    const sc = await page.evaluate(() => { const t = document.querySelector(".bw-window .rs-tree-wrap"); return t ? { sw: t.scrollWidth, cw: t.clientWidth } : null; });
    ok("whole tree fits without sideways scroll on desktop", !!sc && sc.sw <= sc.cw + 1, JSON.stringify(sc));
}
// Keyboard: Tab from the window moves focus to a card.
await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
const focus = await page.evaluate(() => { const a = document.activeElement; return { tag: a?.tagName, inside: !!a?.closest(".bw-window"), label: (a?.getAttribute("aria-label") || a?.textContent || "").trim().slice(0, 30) }; });
ok("Tab keeps focus inside the window", focus.inside, JSON.stringify(focus));
// Click the first available card: one pop-up.
const first = page.locator('.bw-window .rs-card:not([data-status="locked"])').first();
if (await first.count()) { await (phone ? first.tap() : first.click()); await page.waitForTimeout(900); await page.screenshot({ path: `${out}/research-popup-${w}.png` }); }
const pops = await page.evaluate(() => document.querySelectorAll(".bw-window [class*=rs-pop]").length);
ok("a card opens a detail pop-up", pops > 0, `${pops} pop elements`);
ok("no console errors or React warnings", errors.length === 0, errors.slice(0, 4).join(" | "));
for (const x of res) console.log(`${x.p ? "PASS" : "FAIL"}  ${x.n}${x.p ? "" : "  " + x.d}`);
await browser.close();
process.exit(res.every((x) => x.p) ? 0 : 1);
