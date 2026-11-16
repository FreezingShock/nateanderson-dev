// Desktop window fit check: opens the Machines flyout and the Settings window on the live Brasswork page (production
// server), saves PNGs and measures what the thread cares about: the locked-row text inside its box, the NEXT banner
// against the open window, and the Settings control styles. Usage:
//   SITE_PASSWORD=ci-password node scripts/automation/fit-check.mjs <base> <outDir> <tag>
// Writes <tag>-machines-1440.png, <tag>-settings-1440.png and <tag>-machines-390.png, and prints a JSON report.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const [base, out, tag = "before"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const pw = process.env.SITE_PASSWORD || "ci-password";
const r = await fetch(`${base}/api/gate`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ password: pw }) });
const cookie = r.headers.getSetCookie().find((s) => s.startsWith("site_unlock=")).split(";")[0].split("=")[1];
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const report = { tag };

async function open(profile) {
    const ctx = await browser.newContext(profile);
    await ctx.addCookies([{ name: "site_unlock", value: cookie, url: base }]);
    await ctx.addInitScript(() => localStorage.setItem("brasswork-first-run-v1", "done"));
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(`${base}/creations/games/brasswork?bwdev=1`);
    await page.waitForSelector("canvas", { timeout: 120000 });
    await page.waitForTimeout(4000);
    await page.evaluate(() => {
        const dev = window.__bwdev;
        const placed = [];
        for (let z = 2; z < 12 && placed.length < 2; z++) for (let x = 2; x < 16 && placed.length < 2; x++) {
            const t = placed.length === 0 ? "drill" : "kiln";
            if (dev.placeAt(t, x, z, 0).ok) placed.push(t);
        }
    });
    await page.waitForTimeout(800);
    return { ctx, page, errors };
}

const geom = (page) => page.evaluate(() => {
    const rect = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
    const pal = document.querySelector(".ab-pal");
    const next = document.querySelector(".ab-next");
    const note = document.querySelector(".ab-pal .ab-locked-note");
    const noteBox = note ? note.querySelector("span:last-child") : null;
    const overlap = (a, b) => (a && b ? Math.max(0, Math.min(a.r, b.r) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.y, b.y)) : 0);
    const palR = rect(pal), nextR = rect(next);
    const dashed = note ? rect(note.querySelector(".ab-locked-slots")?.parentElement ?? note) : null;
    return {
        palette: palR,
        paletteOverflowPx: pal ? pal.scrollHeight - pal.clientHeight : null,
        next: nextR,
        paletteNextOverlapPx: overlap(palR, nextR),
        lockedNoteTextBottom: noteBox ? Math.round(noteBox.getBoundingClientRect().bottom) : null,
        lockedNoteBoxBottom: dashed ? dashed.b : null,
        lockedNoteOverflowY: note ? note.scrollHeight > note.clientHeight + 1 : null,
        settingsSwitches: document.querySelectorAll(".bws-switch").length,
        settingsRanges: document.querySelectorAll(".bwa-range input[type=range]").length,
        settingsChoices: document.querySelectorAll(".bws-pair").length,
        settingsWindow: rect(document.querySelector(".bws-body")),
        settingsNextOverlapPx: overlap(rect(document.querySelector(".bws-body")), nextR),
        sidewaysScroll: document.documentElement.scrollWidth > window.innerWidth,
    };
});

// Desktop 1440 by 900.
{
    const { ctx, page, errors } = await open({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    // Put the game panel just under the fixed site bar, so the shot shows the whole stage.
    const centre = () => page.evaluate(() => { const r = document.querySelector(".ab-root")?.getBoundingClientRect(); if (r) window.scrollBy(0, r.top - 120); });
    await centre();
    await page.locator('button[aria-label^="Machines,"]').first().click();
    await page.waitForTimeout(900);
    await centre();
    await page.waitForTimeout(300);
    report.machines1440 = await geom(page);
    await page.screenshot({ path: join(out, `${tag}-machines-1440.png`) });
    await page.locator('button[data-label="Settings"]').first().click();
    await page.waitForTimeout(900);
    await centre();
    await page.waitForTimeout(300);
    report.settings1440 = await geom(page);
    await page.screenshot({ path: join(out, `${tag}-settings-1440.png`) });
    report.errors1440 = errors.slice(0, 5);
    await ctx.close();
}

// Phone 390 by 664 (iPhone 13 emulation), Machines sheet.
{
    const { ctx, page, errors } = await open({ ...devices["iPhone 13"], hasTouch: true });
    await page.locator('.ab-tabbar button').filter({ hasText: "Machines" }).first().tap();
    await page.waitForTimeout(900);
    report.machines390 = await geom(page);
    await page.screenshot({ path: join(out, `${tag}-machines-390.png`) });
    await ctx.close();
}
{
    // Phone Settings lives under More in the tab bar; a fresh page so no sheet is open underneath.
    const { ctx, page, errors } = await open({ ...devices["iPhone 13"], hasTouch: true });
    const clickText = (sel, text) => page.evaluate(([sel, text]) => {
        const b = [...document.querySelectorAll(sel)].find((el) => el.textContent.trim().startsWith(text));
        if (!b) throw new Error(`no ${text} in ${sel}`);
        b.click();
    }, [sel, text]);
    await clickText(".ab-tabbar button", "More");
    await page.waitForTimeout(500);
    await clickText(".ab-more button", "Settings");
    await page.waitForTimeout(900);
    report.settings390 = await geom(page);
    await page.screenshot({ path: join(out, `${tag}-settings-390.png`) });
    report.errors390 = errors.slice(0, 5);
    await ctx.close();
}

console.log(JSON.stringify(report, null, 2));
await browser.close();
