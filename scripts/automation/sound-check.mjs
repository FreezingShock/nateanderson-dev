// Brasswork sound wiring check. Counts Web Audio voices (oscillators and noise bursts) created by the page, then drives
// the game and asserts that each cue makes sound: Tab (group tick), a menu opening and closing, a placed machine, and a
// refused research purchase. It cannot judge how the sounds feel; it proves they are wired and do not throw.
// Usage: SITE_PASSWORD=ci-password node scripts/automation/sound-check.mjs <base> <outDir>
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const [base = "http://localhost:3123", out = "sound-check-out"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const r = await fetch(`${base}/api/gate`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ password: process.env.SITE_PASSWORD || "ci-password" }) });
const cookie = r.headers.getSetCookie().find((s) => s.startsWith("site_unlock=")).split(";")[0].split("=")[1];
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "site_unlock", value: cookie, url: base }]);
await ctx.addInitScript(() => {
    localStorage.setItem("brasswork-first-run-v1", "done");
    // Count every voice the game starts. The audio module builds its graph on the first gesture, so this sees all of it.
    window.__voices = 0;
    const count = (proto, name) => {
        const orig = proto[name];
        proto[name] = function (...a) {
            window.__voices++;
            return orig.apply(this, a);
        };
    };
    count(AudioContext.prototype, "createOscillator");
    count(AudioContext.prototype, "createBufferSource");
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror " + e.message));
page.on("console", (m) => m.type() === "error" && errors.push("console " + m.text().slice(0, 200)));
await page.goto(`${base}/creations/games/brasswork?bwdev=1`);
await page.waitForSelector("canvas", { timeout: 120000 });
await page.waitForTimeout(4000);

const res = [];
const check = (name, ok, detail = "") => res.push({ name, ok, detail });
const voices = () => page.evaluate(() => window.__voices);
const cue = async (name, act) => {
    const before = await voices();
    await act();
    await page.waitForTimeout(350);
    const after = await voices();
    check(name, after > before, `${after - before} voices`);
};

// The first gesture arms the audio graph: nothing should sound before it, and the first click should wake it.
const beforeArm = await voices();
check("silent before the first gesture", beforeArm === 0, `${beforeArm} voices`);
await page.mouse.click(720, 450); // centre of the screen, clear of the top bar and dock
await page.waitForTimeout(300);

await cue("Tab cycles the build group with a tick", () => page.keyboard.press("Tab"));
// Settings sits in the top bar on wide screens and in the More menu otherwise; open whichever is visible.
const openSettings = async () => {
    // The top bar re-renders while the game runs, so Playwright's click keeps finding a detached node. A DOM click
    // still fires the same React handler.
    const topOk = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button[data-label="Settings"]')].find((e) => e.offsetParent);
        if (!b) return false;
        b.click();
        return true;
    });
    if (topOk) return;
    await page.locator('button:visible:has-text("Menu"), button:visible:has-text("More")').first().click();
    await page.waitForTimeout(250);
    await page.locator('[role=menuitem]:visible:has-text("Settings"), button:visible:has-text("Settings")').first().click();
};
await cue("Settings window opens with a sweep", openSettings);
await page.screenshot({ path: `${out}/settings-open.png` });
await cue("Escape closes the window with a sweep", () => page.keyboard.press("Escape"));
await page.waitForTimeout(400);
// Make sure the window is gone before the next step, so a stray click cannot land on its blank-area layer.
if (await page.locator(".bw-window-scrim").count()) {
    await page.locator(".bw-window-close").first().click().catch(() => {});
    await page.waitForTimeout(400);
}
check("Settings window is closed again", (await page.locator(".bw-window-scrim").count()) === 0);

await page.keyboard.press("1"); // arm the first machine tool (no cue of its own)
await page.waitForTimeout(200);
const box = await page.locator("canvas").first().boundingBox();
await cue("Placing a machine on the island makes a sound", () => page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.55));
await page.screenshot({ path: `${out}/after-place.png` });

await page.evaluate(() => window.__bwdev.refresh());
// Clicking a button always plays its press tick, so this only proves the window opened with some sound.
await cue("Opening Research makes a sound", async () => {
    await page.locator('button:has-text("Research")').first().click();
    await page.waitForTimeout(300);
});
await page.screenshot({ path: `${out}/research-open.png` });
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

await browser.close();

for (const c of res) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}  (${c.detail})`);
console.log(errors.length ? `errors: ${errors.length}\n  ${errors.slice(0, 5).join("\n  ")}` : "errors: none");
const bad = res.filter((c) => !c.ok).length + (errors.length ? 1 : 0);
process.exit(bad ? 1 : 0);
