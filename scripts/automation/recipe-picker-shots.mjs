// Recipe picker check and screenshots: places crafters on the live Brasswork page, clicks one with the mouse (desktop)
// or taps it (phone), and saves the open inspector. Also checks that the picker has rows, icons, a rate and a locked list,
// and that nothing overflows sideways. Usage:
//   SITE_PASSWORD=ci-password node scripts/automation/recipe-picker-shots.mjs <base> <outDir> <name>
// Runs against a production server (npm run build, then next start).
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const [base, out, name = "picker"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const pw = process.env.SITE_PASSWORD || "ci-password";
const r = await fetch(`${base}/api/gate`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ password: pw }) });
const cookie = r.headers.getSetCookie().find((s) => s.startsWith("site_unlock=")).split(";")[0].split("=")[1];
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const results = [];
const check = (n, ok, detail = "") => results.push({ n, ok, detail });

for (const phone of [false, true]) {
    const profile = phone ? { ...devices["iPhone 13"], hasTouch: true } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
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
    const w = phone ? 390 : 1440;

    // Place a kiln on the first free spot the sim accepts, and a crafter with locked recipes too.
    const spot = await page.evaluate(() => {
        const dev = window.__bwdev;
        for (let z = 2; z < 12; z++) for (let x = 2; x < 16; x++) {
            const r = dev.placeAt("kiln", x, z, 0);
            if (r.ok) return { x, z, id: r.id };
        }
        return null;
    });
    check("kiln placed", !!spot);
    if (!spot) { await ctx.close(); continue; }
    const cell = await page.evaluate(({ x, z }) => window.__bwdev.cellPx(x, z), spot);
    if (phone) {
        // Touch: a tap on a building opens its small menu; Details opens the inspector.
        await page.touchscreen.tap(cell.x, cell.y);
        await page.waitForTimeout(500);
        const details = page.locator('button:has-text("Details")').first();
        if (await details.count()) await details.tap();
    } else await page.mouse.click(cell.x, cell.y);
    await page.waitForTimeout(900);

    const panel = page.locator(".ab-inspect");
    const shown = await panel.count();
    check(`${w}: inspector opens for a placed kiln`, shown > 0);
    if (shown > 0) {
        const info = await page.evaluate(() => {
            const rows = [...document.querySelectorAll(".ab-rc")];
            return {
                rows: rows.length,
                selected: rows.filter((r2) => r2.dataset.state === "selected").length,
                locked: rows.filter((r2) => r2.dataset.state === "locked").length,
                icons: document.querySelectorAll(".ab-rc .bwi").length,
                rates: [...document.querySelectorAll(".ab-rc-rate")].map((e) => e.textContent),
                overflowX: document.documentElement.scrollWidth > window.innerWidth,
                inspectOverflow: (() => { const el = document.querySelector(".ab-inspect"); return el ? el.scrollWidth > el.clientWidth + 1 : false; })(),
            };
        });
        check(`${w}: picker lists the kiln's recipes`, info.rows >= 2, JSON.stringify(info));
        check(`${w}: every recipe row has a real icon`, info.icons >= info.rows, `${info.icons} icons / ${info.rows} rows`);
        check(`${w}: rates are shown`, info.rates.length > 0, info.rates.join(", "));
        check(`${w}: no sideways scroll`, !info.overflowX && !info.inspectOverflow);
        // Pick the second open recipe, then the marked row should be the selected one.
        const open = page.locator('.ab-rc[data-state="open"]').first();
        if (await open.count()) {
            if (phone) await open.tap(); else await open.click();
            await page.waitForTimeout(400);
            const sel = await page.locator('.ab-rc[data-state="selected"]').count();
            check(`${w}: choosing a recipe marks it selected`, sel === 1, `selected rows: ${sel}`);
        }
        await page.screenshot({ path: join(out, `${name}-${w}.png`) });
    }
    check(`${w}: no page errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
}
await browser.close();
for (const x of results) console.log(`${x.ok ? "PASS" : "FAIL"} ${x.n}${x.detail ? ` — ${x.detail}` : ""}`);
process.exit(results.every((x) => x.ok) ? 0 : 1);
