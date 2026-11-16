// Screenshots every route at desktop (1440) and phone (390) size, with CSS animations frozen, for the screenshot diff.
// Run from the repo root of the build being served, because the route list comes from that build's .next manifests.
//   node scripts/ci/checks/run.mjs shots http://localhost:3123 out-dir
// Advisory: a broken page is logged as a WARN or FAIL line, but the command still exits 0.
import { readFileSync, mkdirSync } from "node:fs";
import { unlock, waitFor } from "../../lib.mjs";
import { launch } from "../kit.mjs";

export const suite = "shots";

const FREEZE = `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}`;
const SIZES = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "phone", width: 390, height: 844 },
];

function routeList() {
    const routes = new Set(["/"]);
    try {
        const m = JSON.parse(readFileSync(".next/server/app-paths-manifest.json", "utf8"));
        for (const k of Object.keys(m)) if (k.endsWith("/page") && !k.includes("[") && !k.startsWith("/_")) routes.add(k.replace(/\/page$/, "") || "/");
    } catch {}
    try {
        const pm = JSON.parse(readFileSync(".next/prerender-manifest.json", "utf8"));
        for (const r of Object.keys(pm.routes)) if (!r.includes("opengraph-image") && !/\.\w+$/.test(r)) routes.add(r);
    } catch {}
    return routes;
}

export async function run({ base, outDir }) {
    const root = base.replace(/\/$/, "");
    const out = outDir;
    mkdirSync(out, { recursive: true });
    await waitFor(root);
    const cookie = (await unlock(root)).split("=");
    const routes = routeList();

    const browser = await launch();
    for (const s of SIZES) {
        const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, reducedMotion: "reduce", deviceScaleFactor: 1, timezoneId: "America/Los_Angeles", locale: "en-US" });
        await ctx.addCookies([{ name: cookie[0], value: cookie.slice(1).join("="), url: root }]);
        for (const r of [...routes].sort()) {
            const page = await ctx.newPage();
            const errors = [];
            page.on("pageerror", (e) => errors.push(e.message));
            try {
                await page.goto(root + r, { waitUntil: "networkidle", timeout: 30000 });
                await page.addStyleTag({ content: FREEZE });
                await page.waitForTimeout(1200);
                const file = `${out}/${s.name}__${r === "/" ? "home" : r.slice(1).replace(/\//g, "-")}.png`;
                await page.screenshot({ path: file });
                const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
                if (overflow > 1) console.log(`WARN sideways scroll ${overflow}px on ${s.name} ${r}`);
                if (errors.length) console.log(`WARN script error on ${s.name} ${r}: ${errors[0]}`);
            } catch (e) {
                console.log(`FAIL ${s.name} ${r}: ${e.message}`);
            }
            await page.close();
        }
        await ctx.close();
    }
    await browser.close();
    console.log(`Shot ${routes.size} routes x ${SIZES.length} sizes into ${out}`);
}
