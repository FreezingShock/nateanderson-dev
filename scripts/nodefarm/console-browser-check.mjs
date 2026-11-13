// Browser check of the new `nf` console commands (next, rate, find, help) on a production build, at desktop and phone sizes.
// Usage: node scripts/nodefarm/console-browser-check.mjs <base url> [out dir]
//   (start the build with SITE_PASSWORD=ci-password SITE_GATE_SECRET=x npx next start -p 3100)
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { unlock } from "../ci/lib.mjs";

const { chromium } = createRequire(import.meta.url)("playwright");
const [base = "http://localhost:3100", out = "/home/user/scratch/console-shots"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const here = dirname(fileURLToPath(import.meta.url));
const save = readFileSync(resolve(here, "fixtures", "release-post-ascend.json"), "utf8");
const res = [];
const ok = (c, m) => { res.push(c); console.log(c ? "PASS" : "FAIL", m); };

const ck = (await unlock(base)).split("=");
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const vps = [{ name: "desktop", width: 1440, height: 900 }, { name: "phone", width: 390, height: 844, mobile: true }];
for (const vp of vps) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.mobile, hasTouch: !!vp.mobile, deviceScaleFactor: 1 });
    await ctx.addCookies([{ name: ck[0], value: ck[1], url: base }]);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript((s) => { try { localStorage.setItem("nf-save-v1", s); } catch {} }, save);
    await page.goto(`${base}/creations/games/node-farm`, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    await page.keyboard.press("Backquote");
    await page.waitForSelector("input[placeholder='type a command']", { timeout: 8000 });
    const run = async (cmd) => {
        await page.fill("input[placeholder='type a command']", cmd);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(400);
        return (await page.locator(".cn-out").last().innerText()).toLowerCase();
    };
    const next = await run("nf next");
    ok(next.includes("progress") && next.includes("next:"), `${vp.name}: nf next shows a step with progress`);
    const rate = await run("nf rate");
    ok(rate.includes("income per second") && rate.includes("bytes"), `${vp.name}: nf rate shows income`);
    const find = await run("nf find zzqqxx");
    ok(find.includes("nothing found"), `${vp.name}: nf find with no match says so`);
    const help = await run("nf help");
    ok(help.includes("nf find"), `${vp.name}: nf help lists the new commands`);
    await page.screenshot({ path: resolve(out, `console-${vp.name}.png`) });
    ok(errors.length === 0, `${vp.name}: no script errors${errors.length ? `: ${errors[0]}` : ""}`);
    await ctx.close();
}
await browser.close();
console.log(res.every(Boolean) ? "ALL PASS" : "SOME FAILED");
process.exit(res.every(Boolean) ? 0 : 1);
