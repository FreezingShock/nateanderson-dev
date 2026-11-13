// Away-time checks in a real browser (production build). Loads a stage save, then:
//   1. welcome-back report on load (desktop and iPhone size): shows, numbers, no sideways scroll, closes, game resumes
//   2. laptop sleep: the clock jumps three hours while the tab is open; the report banks the standby window and nothing breaks
//   3. stall: the clock jumps 90 s in an open tab (what a throttled background tab looks like); report and banked time
//   4. clock moves backwards one hour: no report, no NaN in the saved game, progress kept
//   5. two tabs on one save: the second tab takes over saving and the first one shows the stale banner, nothing is overwritten
//   6. reload after the sleep keeps the banked Bytes; the backups list keeps its "when the game opened" copy
// Run with the server up: SITE_PASSWORD=ci-password next start -p 3100, then
//   node scripts/nodefarm/away-browser-check.mjs http://localhost:3100 <stage.json> <outdir>
import { createRequire } from "node:module";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
const { chromium, devices } = createRequire("/opt/node-tools/package.json")("playwright");
const [base = "http://localhost:3100", stage, out = "."] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const PASSWORD = process.env.SITE_PASSWORD || "ci-password";
const r = await fetch(`${base}/api/gate`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ password: PASSWORD }) });
const cookie = r.headers.getSetCookie().find((c) => c.startsWith("site_unlock=")).split(";")[0];
const [cname, ...cval] = cookie.split("=");
const HOUR = 3600e3;
const errors = [], fails = [], notes = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const browser = await chromium.launch();
const phone = { ...devices["iPhone 13"] }; delete phone.defaultBrowserType;
const T0 = Date.now();
// the save is stamped inside the page (fake clock), so the page load itself does not count as time away
const STAGE_TEXT = readFileSync(stage, "utf8");
const seedSave = (ageMs) => ({ text: STAGE_TEXT, ageMs });
async function newPage(ctx, opts = {}) {
    await ctx.addCookies([{ name: cname, value: cval.join("="), url: base }]);
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(`${e.message}`));
    p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon/.test(m.text())) errors.push(`console: ${m.text().slice(0, 160)}`); });
    return p;
}
const readSave = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("nf-save-v1") || "null"));
const hasNaN = (o) => JSON.stringify(o).match(/NaN|Infinity"?/) !== null;
async function seedCtx(browserOpts, save, ageLabel) {
    const ctx = await browser.newContext(browserOpts);
    // seeds once per context (a second tab on the same save must not get the seed again)
    await ctx.addInitScript((seed) => {
        try {
            if (localStorage.getItem("nf-test-seeded")) return;
            const s = JSON.parse(seed.text);
            s.at = Date.now() - seed.ageMs;
            localStorage.setItem("nf-save-v1", JSON.stringify(s));
            localStorage.setItem("nf-juice-v1", JSON.stringify({ seen: ["*"] }));
            localStorage.setItem("nf-events-v1", "off");
            localStorage.setItem("nf-test-seeded", "1");
        } catch {}
    }, save);
    return ctx;
}

// ---- 1. welcome back, desktop and phone
const summary = {};
for (const [dev, opts] of [["desktop", { viewport: { width: 1440, height: 900 } }], ["phone", phone]]) {
    const ctx = await seedCtx(opts, seedSave(6 * HOUR), "6 h");
    const p = await newPage(ctx);
    await p.clock.install({ time: T0 });
    await p.goto(`${base}/creations/games/node-farm`, { waitUntil: "networkidle" });
    await p.waitForTimeout(3000);
    const shown = await p.locator(".nf-aw").isVisible().catch(() => false);
    ok(shown, `${dev}: welcome-back report did not show after 6 h away`);
    if (shown) {
        const sum = await p.locator(".nf-aw-sum").innerText();
        const sys = await p.locator(".nf-aw-sys section").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
        summary[dev] = { sum, sys };
        notes.push(`${dev} summary: ${sum}`);
        notes.push(`${dev} systems: ${sys.join(", ") || "none"}`);
        ok(/NaN|Infinity/.test(sum) === false, `${dev}: report text has NaN/Infinity`);
        const wide = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        ok(wide <= 0, `${dev}: sideways scroll ${wide}px on the report`);
        // every text box in the report must sit inside the viewport
        const clipped = await p.evaluate(() => [...document.querySelectorAll(".nf-aw-panel *")].filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 1 || b.left < -1); }).map((e) => e.className || e.tagName).slice(0, 5));
        ok(clipped.length === 0, `${dev}: report content outside the screen: ${clipped.join(", ")}`);
        await p.screenshot({ path: `${out}/${dev}-report.png` });
        await p.locator(".nf-aw-body").evaluate((e) => e.scrollTo(0, 99999)).catch(() => {});
        await p.waitForTimeout(300);
        await p.screenshot({ path: `${out}/${dev}-report-end.png` });
        await p.click(".nf-aw-go"); await p.waitForTimeout(1500);
        ok(!(await p.locator(".nf-aw").count()), `${dev}: report did not close`);
    }
    await p.waitForTimeout(500);
    const sv = await readSave(p);
    ok(sv && !hasNaN(sv), `${dev}: saved game has NaN or Infinity after the report`);
    await ctx.close();
}

// ---- 2. laptop sleep: clock jumps 3 h with the tab open
{
    const ctx = await seedCtx({ viewport: { width: 1440, height: 900 } }, seedSave(0), "0");
    const p = await newPage(ctx);
    await p.clock.install({ time: T0 });
    await p.goto(`${base}/creations/games/node-farm`, { waitUntil: "networkidle" });
    await p.waitForTimeout(2500);
    const before = (await readSave(p)).life.bytes;
    await p.clock.setSystemTime((await p.evaluate(() => Date.now())) + 3 * HOUR); // page time, not this script's clock
    await p.waitForTimeout(1500);
    const shown = await p.locator(".nf-aw").isVisible().catch(() => false);
    ok(shown, "sleep: report did not show after the clock jumped 3 h");
    if (shown) notes.push(`sleep 3 h: ${await p.locator(".nf-aw-sum").innerText()}`);
    await p.click(".nf-aw-go").catch(() => {}); await p.waitForTimeout(1200);
    await p.waitForTimeout(500);
    const sv = await readSave(p);
    ok(!hasNaN(sv), "sleep: NaN or Infinity in the save");
    ok(sv.life.bytes > before, "sleep: lifetime Bytes did not rise");
    // reload keeps it
    const kept = sv.life.bytes;
    await p.reload({ waitUntil: "networkidle" });
    await p.waitForTimeout(1500);
    const sv2 = await readSave(p);
    ok(sv2.life.bytes >= kept, "reload: lifetime Bytes went down on reload");
    const backups = await p.evaluate(() => JSON.parse(localStorage.getItem("nf-backups-v1") || "[]"));
    notes.push(`backups after sleep: ${backups.map((b) => `${b.kind}:${b.why}`).join(" | ")}`);
    ok(backups.some((b) => b.why === "when the game opened"), "backups: no 'when the game opened' copy after reload");
    await ctx.close();
}

// ---- 3. a 90 s stall in an open tab (throttled timers look like this)
{
    const ctx = await seedCtx({ viewport: { width: 1440, height: 900 } }, seedSave(0), "0");
    const p = await newPage(ctx);
    await p.clock.install({ time: T0 });
    await p.goto(`${base}/creations/games/node-farm`, { waitUntil: "networkidle" });
    await p.waitForTimeout(2500);
    await p.clock.setSystemTime((await p.evaluate(() => Date.now())) + 90e3);
    await p.waitForTimeout(1500);
    const shown = await p.locator(".nf-aw").isVisible().catch(() => false);
    notes.push(`90 s stall with the tab open: report ${shown ? "shows" : "does not show"}${shown ? `: ${await p.locator(".nf-aw-sum").innerText()}` : ""}`);
    await ctx.close();
}

// ---- 4. clock moves back one hour
{
    const ctx = await seedCtx({ viewport: { width: 1440, height: 900 } }, seedSave(0), "0");
    const p = await newPage(ctx);
    await p.clock.install({ time: T0 });
    await p.goto(`${base}/creations/games/node-farm`, { waitUntil: "networkidle" });
    await p.waitForTimeout(2500);
    const a = (await readSave(p)).life.bytes;
    await p.clock.setSystemTime((await p.evaluate(() => Date.now())) - HOUR);
    await p.waitForTimeout(2000);
    const shown = await p.locator(".nf-aw").isVisible().catch(() => false);
    ok(!shown, "clock back: a report showed for a negative gap");
    const sv = await readSave(p);
    ok(!hasNaN(sv), "clock back: NaN or Infinity in the save");
    ok(sv.life.bytes >= a, "clock back: lifetime Bytes went down");
    await ctx.close();
}

// ---- 5. two tabs on one save: one tab keeps saving, the other shows the stale banner and stops writing
{
    const ctx = await seedCtx({ viewport: { width: 1440, height: 900 } }, seedSave(HOUR), "1 h");
    const counter = () => {
        window.__saveWrites = 0;
        const orig = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) { if (k === "nf-save-v1") window.__saveWrites += 1; return orig.call(this, k, v); };
    };
    const a = await newPage(ctx);
    await a.addInitScript(counter);
    await a.goto(`${base}/creations/games/node-farm`, { waitUntil: "networkidle" });
    await a.waitForTimeout(2500);
    await a.locator(".nf-aw-go").click().catch(() => {});
    const b = await newPage(ctx);
    await b.addInitScript(counter);
    await b.goto(`${base}/creations/games/node-farm`, { waitUntil: "networkidle" });
    await b.waitForTimeout(12000);
    const staleA = await a.locator(".nf-stale").count();
    const staleB = await b.locator(".nf-stale").count();
    const w0 = [await a.evaluate(() => window.__saveWrites), await b.evaluate(() => window.__saveWrites)];
    await a.waitForTimeout(12000);
    const w1 = [await a.evaluate(() => window.__saveWrites), await b.evaluate(() => window.__saveWrites)];
    const dA = w1[0] - w0[0], dB = w1[1] - w0[1];
    notes.push(`two tabs: stale banner A=${staleA > 0} B=${staleB > 0}; saves in the next 12 s A=${dA} B=${dB}`);
    ok(staleA + staleB === 1, `two tabs: expected exactly one stale banner, got ${staleA + staleB}`);
    ok((staleA > 0 ? dA : dB) === 0, `two tabs: the stale tab kept writing (${staleA > 0 ? dA : dB} saves in 12 s)`);
    ok((staleA > 0 ? dB : dA) > 0, "two tabs: the live tab stopped saving");
    await ctx.close();
}

await browser.close();
const res = { notes, errors: [...new Set(errors)], fails, summary };
writeFileSync(`${out}/browser-report.json`, JSON.stringify(res, null, 2));
console.log(notes.join("\n"));
console.log("errors", res.errors.length ? res.errors : "none");
console.log("fails", fails.length ? fails : "none");
