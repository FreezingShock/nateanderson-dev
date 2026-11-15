// Headless hotkey check for Starwright: 1, N, Q, Space, C, Esc, driven through a production server and read back through the
// `sw:live` event (the same bridge the console uses). Not part of `npm run test:nodefarm`; run it by hand.
// Usage: BASE=http://localhost:3100 SITE_PASSWORD=ci-password node tests/starwright/browser/hotkeys.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://localhost:3100";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.request.post(`${BASE}/api/gate`, { data: { password: process.env.SITE_PASSWORD ?? "ci-password" }, headers: { origin: BASE } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/creations/games/starwright`);
await page.waitForSelector(".sw-ladder");
await page.waitForTimeout(1500);
// read or change the live state through the console bridge
const live = (fn, arg) => page.evaluate(([src, a]) => { const d = {}; window.dispatchEvent(new CustomEvent("sw:live", { detail: d })); return new Function("live", "a", `return (${src})(live, a)`)(d.live, a); }, [fn.toString(), arg]);
const results = [];
const check = (name, ok, extra = "") => { results.push([name, ok]); console.log(ok ? "ok  " : "FAIL", name, extra); };

await live((l) => { l.s.amt[0] = 1e9; l.s.mass = 1e9; l.changed(); });
const before = await live((l) => l.s.bought[0][0]);
await page.keyboard.press("1");
await page.waitForTimeout(200);
check("1 buys tier I of the first row", (await live((l) => l.s.bought[0][0])) > before);

await page.keyboard.press("c");
await page.waitForSelector(".sw-chart", { timeout: 3000 }).then(() => check("C opens the constellation map", true), () => check("C opens the constellation map", false));
await page.keyboard.press("Escape");
await page.waitForTimeout(800);
check("Esc closes it", (await page.locator(".sw-chart").count()) === 0);

// a star ready to collapse: N goes supernova
await live((l) => { const s = l.s; s.amt[7] = 1e9; s.mass = 1e9; l.changed(); });
const novas0 = await live((l) => l.s.novasAll);
await page.keyboard.press("n");
await page.waitForTimeout(300);
const novas1 = await live((l) => l.s.novasAll);
check("N goes supernova when the core is ready", novas1 === novas0 + 1, `${novas0} -> ${novas1}`);

// a visitor waiting: Q takes the first answer
await live((l) => { l.s.event = { id: "comet", left: 100 }; l.changed(); });
await page.keyboard.press("q");
await page.waitForTimeout(300);
check("Q answers a waiting visitor", (await live((l) => l.s.event)) === null);

// Space pauses: age stops moving, and moves again after a second press
await page.keyboard.press("Escape");
await page.keyboard.press("Space");
const a0 = await live((l) => l.s.age);
await page.waitForTimeout(1500);
const a1 = await live((l) => l.s.age);
check("Space pauses the star", Math.abs(a1 - a0) < 0.05, `age ${a0.toFixed(2)} -> ${a1.toFixed(2)}`);
await page.keyboard.press("Space");
await page.waitForTimeout(1500);
const a2 = await live((l) => l.s.age);
check("Space resumes it", a2 - a1 > 0.5, `age ${a1.toFixed(2)} -> ${a2.toFixed(2)}`);

check("no page errors", errors.length === 0, errors.join("; "));
await browser.close();
process.exit(results.every(([, ok]) => ok) ? 0 : 1);
