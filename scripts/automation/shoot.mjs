// Headless screenshots of the Brasswork page on a running production server (npm run build, then next start).
// Usage: SITE_PASSWORD=ci-password node scripts/automation/shoot.mjs <base> <outDir> <name> [--phone] [--wait ms] [--eval "js"]
// Opens /creations/games/brasswork?bwdev=1 behind the gate with software WebGL, waits for the scene, then runs --eval (optional) and saves <name>-<w>.png.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const [base, out, name, ...rest] = process.argv.slice(2);
const flag = (f) => rest.includes(f);
const val = (f) => (rest.includes(f) ? rest[rest.indexOf(f) + 1] : null);
mkdirSync(out, { recursive: true });
const pw = process.env.SITE_PASSWORD || "ci-password";
const r = await fetch(`${base}/api/gate`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ password: pw }) });
const cookie = r.headers.getSetCookie().find((s) => s.startsWith("site_unlock=")).split(";")[0];
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const profile = flag("--phone") ? { ...devices["iPhone 13"], hasTouch: true } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const ctx = await browser.newContext(profile);
await ctx.addCookies([{ name: "site_unlock", value: cookie.split("=")[1], url: base }]);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`${base}/creations/games/brasswork${val("--query") ?? "?bwdev=1"}`);
await page.waitForSelector("canvas", { timeout: 60000 });
await page.waitForTimeout(Number(val("--wait") ?? 4000));
if (val("--eval")) { await page.evaluate(val("--eval")); await page.waitForTimeout(1500); }
const w = flag("--phone") ? 390 : 1440;
await page.screenshot({ path: join(out, `${name}-${w}.png`) });
console.log(`saved ${name}-${w}.png`, errors.length ? `errors: ${errors.slice(0, 3).join(" | ")}` : "no console errors");
await browser.close();
