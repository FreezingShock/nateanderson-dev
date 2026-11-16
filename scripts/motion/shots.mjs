// Motion-system screenshots: first screen per route at 1440 and 390, a hover frame on the first card and
// button, and a reduced-motion computed-style check. Usage: node motion-shots.mjs <base-url> <out-dir>
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node-tools/node_modules/playwright");

const [base, out] = process.argv.slice(2);
if (!base || !out) throw new Error("usage: motion-shots.mjs <base> <out>");
mkdirSync(out, { recursive: true });
const PASSWORD = process.env.SITE_PASSWORD || "ci-password";
const ROUTES = ["/", "/about", "/creations", "/studies", "/timeline", "/history"];
const SIZES = [
    { w: 1440, h: 900, tag: "1440" },
    { w: 390, h: 844, tag: "390", mobile: true },
];

const res = await fetch(`${base}/api/gate`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ password: PASSWORD }),
});
const cookie = res.headers.getSetCookie().find((s) => s.startsWith("site_unlock=")).split(";")[0];
const [name, value] = cookie.split("=");

const browser = await chromium.launch();
const report = [];
for (const size of SIZES) {
    const ctx = await browser.newContext({
        viewport: { width: size.w, height: size.h },
        isMobile: !!size.mobile,
        hasTouch: !!size.mobile,
        deviceScaleFactor: 1,
        reducedMotion: "no-preference",
    });
    await ctx.addCookies([{ name, value, url: base }]);
    const page = await ctx.newPage();
    for (const route of ROUTES) {
        const slug = route === "/" ? "home" : route.slice(1).replaceAll("/", "-");
        await page.goto(base + route, { waitUntil: "load" });
        await page.waitForTimeout(2200);
        await page.screenshot({ path: join(out, `${slug}-${size.tag}.png`) });
        report.push({ route, size: size.tag, ok: true });
    }
    if (size.tag === "1440") {
        // Hover frame: first link card on the creations page, 180 ms into the lift.
        await page.goto(base + "/creations", { waitUntil: "load" });
        await page.waitForTimeout(1600);
        const card = page.locator(".cm-card.link, .gs-card").first();
        if (await card.count()) {
            await card.scrollIntoViewIfNeeded();
            await page.waitForTimeout(900);
            const box = await card.boundingBox();
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.waitForTimeout(180);
            await page.screenshot({ path: join(out, "hover-card-mid-1440.png") });
            await page.waitForTimeout(600);
            await page.screenshot({ path: join(out, "hover-card-end-1440.png") });
        }
    }
    await ctx.close();
}

// Reduced motion: every transition on the home page must finish in about 0 ms.
const rm = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
await rm.addCookies([{ name, value, url: base }]);
const rp = await rm.newPage();
await rp.goto(base + "/", { waitUntil: "networkidle" });
await rp.waitForTimeout(1500);
const slow = await rp.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(el);
        const ds = cs.transitionDuration.split(",").map((s) => parseFloat(s) * (s.includes("ms") ? 1 : 1000));
        const as = cs.animationDuration.split(",").map((s) => parseFloat(s) * (s.includes("ms") ? 1 : 1000));
        if ([...ds, ...as].some((v) => v > 20 && v < 1e9)) bad.push(el.className || el.tagName);
        if (bad.length > 10) break;
    }
    return bad;
});
report.push({ check: "reduced-motion home", slowElements: slow.slice(0, 10), count: slow.length });
await rm.close();
await browser.close();
console.log(JSON.stringify(report, null, 1));
