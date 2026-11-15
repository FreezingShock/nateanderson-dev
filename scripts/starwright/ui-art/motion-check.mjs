// Starwright motion and sound check, in headless Chromium against a production server. It cannot judge how anything looks or
// sounds; it checks that the moving parts happen in the right order and that sounds are asked for (and not when muted).
//   - a menu opens with its own animation and closes through a leaving state, then is removed
//   - going from one menu to another plays the first one's exit before the second appears
//   - a page flip changes the page and plays its sound; reduced motion plays no animation at all
//   - buying plays a sound, muted plays none; no console errors or React warnings
// Usage: BASE=http://localhost:3100 SITE_PASSWORD=ci-password node scripts/starwright/ui-art/motion-check.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://localhost:3100";
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
let bad = 0;
const check = (name, ok, extra = "") => { if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${name} ${extra}`); };

const SPY = () => {
    // counts every oscillator and noise source a sound creates
    const AC = window.AudioContext;
    window.__voices = 0;
    window.AudioContext = class extends AC {
        createOscillator() { window.__voices++; return super.createOscillator(); }
        createBufferSource() { window.__voices++; return super.createBufferSource(); }
    };
};
const late = (raw) => {
    const s = JSON.parse(raw);
    s.amt = [9.2e9, 4.1e9, 8.2e8, 3.1e8, 9.2e7, 2.6e7, 7.4e6, 9e6, 1e5, 1e4];
    s.bought = s.bought.map((r, i) => (i < 8 ? [40 - i, 20, 5] : r.map(() => 0)));
    s.mass = 3.2e9; s.heat = 9.5e11; s.stardust = 3.4e5; s.perks = ["l1"];
    s.planets = ["ember"]; s.planetAge = { ember: 5000 };
    return JSON.stringify(s);
};

async function open(reduced) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 640 }, hasTouch: true, isMobile: true, reducedMotion: reduced ? "reduce" : "no-preference" });
    await ctx.request.post(`${BASE}/api/gate`, { data: { password: process.env.SITE_PASSWORD ?? "ci-password" }, headers: { origin: BASE } });
    await ctx.addInitScript(SPY);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error" || /Warning:/.test(m.text())) errors.push(m.text().slice(0, 200)); });
    await page.goto(`${BASE}/creations/games/starwright`);
    await page.waitForSelector(".sw-ladder", { timeout: 30000 });
    await page.waitForFunction(() => localStorage.getItem("sw-save-v1"), null, { timeout: 30000 });
    const base = await page.evaluate(() => localStorage.getItem("sw-save-v1"));
    await page.addInitScript(`localStorage.setItem("sw-save-v1", ${JSON.stringify(late(base))}); localStorage.setItem("sw-settings-v1", '{"welcome":false}');`);
    await page.reload();
    await page.waitForSelector(".sw-ladder");
    await page.waitForTimeout(1200);
    return { ctx, page, errors };
}

{
    const { ctx, page, errors } = await open(false);
    const dock = (n) => page.getByRole("button", { name: n, exact: true });
    const voices = () => page.evaluate(() => window.__voices);

    // open and close
    await dock("Orbit").tap();
    await page.waitForSelector(".sw-over");
    const anim = await page.evaluate(() => document.querySelector(".sw-over .sw-card").getAnimations().map((a) => a.animationName));
    check("Orbit opens with its own animation", anim.includes("swShutter"), anim.join(","));
    await page.waitForTimeout(900);
    check("opening animations have finished", (await page.evaluate(() => document.querySelector(".sw-over .sw-card").getAnimations().filter((a) => a.playState === "running").length)) === 0);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
    check("closing shows a leaving state", (await page.locator(".sw-over[data-leaving]").count()) === 1);
    await page.waitForTimeout(450);
    check("the menu is removed after it", (await page.locator(".sw-over").count()) === 0);

    // swap
    await dock("Orbit").tap();
    await page.waitForSelector(".sw-over");
    await page.waitForTimeout(700);
    await page.keyboard.press("a");
    await page.waitForTimeout(90);
    const mid = await page.evaluate(() => ({ title: document.querySelector(".sw-over")?.getAttribute("aria-label"), leaving: !!document.querySelector(".sw-over[data-leaving]") }));
    check("switching plays the first menu's exit first", mid.title === "Orbit" && mid.leaving, JSON.stringify(mid));
    await page.waitForTimeout(500);
    check("then the next menu opens", (await page.locator('.sw-over[aria-label="Almanac"]:not([data-leaving])').count()) === 1);

    // pages: phone sized Orbit has more than one page
    await page.keyboard.press("o");
    await page.waitForTimeout(700);
    await page.waitForSelector(".sw-pg-nav");
    await page.waitForTimeout(700);
    const first = await page.locator(".sw-pg-page").innerText();
    const before = await voices();
    await page.locator(".sw-pg-btn[data-next]").tap();
    await page.waitForTimeout(500);
    const second = await page.locator(".sw-pg-page").innerText();
    check("flipping the page changes it", first !== second);
    check("page counter moves to 2", /2 of/i.test(await page.locator(".sw-pg-dots b").innerText()));
    check("a page flip makes a sound", (await voices()) > before);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // buying makes a sound; muted does not
    const v0 = await voices();
    await page.keyboard.press("2");
    await page.waitForTimeout(300);
    const v1 = await voices();
    check("buying makes a sound", v1 > v0, `${v0} -> ${v1}`);
    await page.keyboard.press("u");
    await page.waitForTimeout(300);
    const v2 = await voices();
    check("the u key muted it", (await page.evaluate(() => localStorage.getItem("sw-sound-v1"))) === "off");
    await page.waitForTimeout(1500);
    check("idle muted star is silent", (await voices()) === v2, `${v2} -> ${await voices()}`);
    await page.keyboard.press("2"); // a key, not a tap: the site's own click sounds would count too
    await page.waitForTimeout(300);
    check("muted buying is silent", (await voices()) === v2, `${v2} -> ${await voices()}`);
    check("no console errors or React warnings", errors.length === 0, errors.join(" | "));
    await ctx.close();
}
{
    const { ctx, page } = await open(true);
    await page.getByRole("button", { name: "Orbit", exact: true }).tap();
    await page.waitForSelector(".sw-over");
    await page.waitForTimeout(100);
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && document.querySelector(".sw-over")?.contains(a.effect?.target)).map((a) => a.animationName));
    check("reduced motion: no animation runs in an open menu", running.length === 0, running.join(","));
    await ctx.close();
}
await browser.close();
console.log(bad ? `\n${bad} check(s) failed` : "\nall checks pass");
process.exit(bad ? 1 : 0);
