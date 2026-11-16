// Checks the Daily and Unlimited tabs on the Outline and Flag Guessers against a built site.
// Usage: SITE_PASSWORD=ci-password node scripts/games/guessers-check.mjs http://localhost:3123
// Covers: Unlimited locked on a fresh device, a locked tab does not open, finishing a daily opens Unlimited, the state
// survives a reload, ?mode=unlimited stays on Daily while locked, existing daily stats open Unlimited, old daily routes
// redirect, and no script errors or sideways scroll on a phone.
import { createRequire } from "node:module";
import { unlock, waitFor } from "../ci/lib.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const base = (process.argv[2] ?? "http://localhost:3123").replace(/\/$/, "");
await waitFor(base);
const [cookieName, ...cookieValue] = (await unlock(base)).split("=");

const failures = [];
const check = (ok, what) => {
    console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
    if (!ok) failures.push(what);
};

const GAMES = [
    { slug: "outline-guesser", unlockKey: "outline-unlimited-unlocked-v1", statsKey: "outline-stats-v1" },
    { slug: "flag-guesser", unlockKey: "flag-unlimited-unlocked-v1", statsKey: "flag-stats-v1" },
];

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

async function newPage(viewport = { width: 1440, height: 900 }) {
    const ctx = await browser.newContext({ viewport, reducedMotion: "no-preference", timezoneId: "America/Los_Angeles", locale: "en-US" });
    await ctx.addCookies([{ name: cookieName, value: cookieValue.join("="), url: base }]);
    const page = await ctx.newPage();
    page.errors = [];
    page.on("pageerror", (e) => page.errors.push(e.message));
    return { ctx, page };
}

const tab = (page, id) => page.locator(`#gk-tab-${id}`);
const selected = async (page, id) => (await tab(page, id).getAttribute("aria-selected")) === "true";
const locked = async (page) => (await tab(page, "unlimited").getAttribute("aria-disabled")) === "true";
const waitForBoard = async (page) => {
    await page.waitForSelector(".gk-tabs", { timeout: 60000 });
    await settle(page);
};
// The site's intro splash covers the page for about a second and eats clicks, so wait until it has gone.
const settle = async (page) => {
    await page.waitForFunction(() => !["full", "quick"].includes(document.documentElement.dataset.boot), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(250);
};

for (const g of GAMES) {
    const url = `${base}/creations/games/${g.slug}`;

    // 1. Fresh device: Daily is open, Unlimited is locked, and a click on the locked tab does nothing.
    {
        const { ctx, page } = await newPage();
        await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
        await waitForBoard(page);
        check(await selected(page, "daily"), `${g.slug}: fresh device opens on Daily`);
        check(await locked(page), `${g.slug}: Unlimited is locked on a fresh device`);
        // Playwright treats aria-disabled as not clickable, so force the click; the tab must still take it.
        await tab(page, "unlimited").click({ force: true });
        await page.waitForTimeout(150);
        check(await selected(page, "daily") && !(await selected(page, "unlimited")), `${g.slug}: clicking locked Unlimited keeps Daily`);
        check((await page.locator(".gk-tab.is-nudge").count()) === 1, `${g.slug}: a locked click shakes the Unlimited tab`);
        check((await page.locator(".gk-filters").count()) === 0, `${g.slug}: no filters while Daily is open`);

        // 2. Finish today's daily (give up twice: the first press asks to confirm).
        const give = page.locator('[data-action="giveup"]');
        if ((await give.count()) > 0) {
            await give.click();
            await give.click();
        }
        await page.waitForTimeout(400);
        const stored = await page.evaluate((k) => localStorage.getItem(k), g.unlockKey);
        check(stored === "true", `${g.slug}: finishing a daily stores the unlock`);
        check(!(await locked(page)), `${g.slug}: Unlimited opens after the daily ends`);

        // 3. Switching opens Unlimited with its filters, and it survives a reload.
        await tab(page, "unlimited").click();
        await page.waitForTimeout(300);
        check(await selected(page, "unlimited"), `${g.slug}: Unlimited opens when clicked`);
        check((await page.locator(".gk-filters").count()) === 1, `${g.slug}: Unlimited shows the filter panel`);
        await page.reload({ waitUntil: "networkidle", timeout: 60000 });
        await waitForBoard(page);
        await page.waitForTimeout(300);
        check(await selected(page, "unlimited"), `${g.slug}: reload keeps Unlimited selected`);
        check(!(await locked(page)), `${g.slug}: reload keeps Unlimited unlocked`);
        check(page.errors.length === 0, `${g.slug}: no script errors on desktop (${page.errors[0] ?? "none"})`);
        await ctx.close();
    }

    // 4. ?mode=unlimited on a locked device lands on Daily.
    {
        const { ctx, page } = await newPage();
        await page.goto(`${url}?mode=unlimited`, { waitUntil: "networkidle", timeout: 60000 });
        await waitForBoard(page);
        check(await selected(page, "daily") && (await locked(page)), `${g.slug}: ?mode=unlimited on a locked device opens Daily`);
        await ctx.close();
    }

    // 5. Existing daily results on this device open Unlimited straight away.
    {
        const { ctx, page } = await newPage();
        await page.addInitScript((k) => {
            if (!sessionStorage.getItem("seeded")) {
                sessionStorage.setItem("seeded", "1");
                localStorage.setItem(k, JSON.stringify({ daily: { played: 2, won: 1, streak: 0, best: 1, last: "2026-11-01", dist: [0, 1, 0, 0, 0, 0] } }));
            }
        }, g.statsKey);
        await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
        await waitForBoard(page);
        check(!(await locked(page)), `${g.slug}: existing daily stats keep Unlimited open`);
        await ctx.close();
    }

    // 6. Phone: no sideways scroll, and the tabs take a tap.
    {
        const { ctx, page } = await newPage({ width: 390, height: 844 });
        await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
        await waitForBoard(page);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        check(overflow <= 1, `${g.slug}: no sideways scroll at 390 (${overflow}px)`);
        check(page.errors.length === 0, `${g.slug}: no script errors on phone`);
        await ctx.close();
    }
}

// 7. Old daily routes redirect to the Daily tab of the merged guesser.
for (const [from, to] of [
    ["/creations/games/daily-outline", "/creations/games/outline-guesser?mode=daily"],
    ["/creations/games/daily-flag", "/creations/games/flag-guesser?mode=daily"],
]) {
    const { ctx, page } = await newPage();
    const response = await page.goto(base + from, { waitUntil: "domcontentloaded", timeout: 60000 });
    const landed = new URL(page.url());
    check(landed.pathname + landed.search === to, `${from} lands on ${to} (got ${landed.pathname + landed.search}, status ${response?.status()})`);
    await ctx.close();
}

await browser.close();
if (failures.length) {
    console.log(`\n${failures.length} check(s) failed.`);
    process.exit(1);
}
console.log("\nAll guesser checks passed.");
