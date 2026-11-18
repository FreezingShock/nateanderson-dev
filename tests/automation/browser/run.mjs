// Browser check for the automation input layer. Serves a plain canvas test scene (no renderer) built from
// lib/automation/input, then drives it with Playwright: desktop mouse and keys, and phone touch via CDP.
// Run with: npm run test:automation:browser   (needs a Playwright Chromium; uses the one preinstalled in the cloud)
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const require = createRequire(import.meta.url);
const ts = require(join(root, "node_modules/typescript"));
const { chromium, devices } = require("playwright");

// 1. Transpile the input layer into a temp folder the browser can load as ES modules.
const out = mkdtempSync(join(tmpdir(), "automation-input-"));
const srcDir = join(root, "lib/automation/input");
mkdirSync(join(out, "input"));
for (const f of readdirSync(srcDir).filter((f) => f.endsWith(".ts"))) {
    let js = ts.transpileModule(readFileSync(join(srcDir, f), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    js = js.replace(/from "(\.\.?\/[^"]+)"/g, (m, p) => (p.endsWith(".js") ? m : `from "${p}.js"`));
    writeFileSync(join(out, "input", f.replace(/\.ts$/, ".js")), js);
}
// touch-bar.ts imports the HUD glyph sheet (../icons/ui) and the control tips (../tips), which sit outside input/.
// Both sit at the same level as input/ in the temp build, so their relative imports resolve the same way.
mkdirSync(join(out, "icons"));
for (const [src, dst] of [
    ["lib/automation/icons/ui.ts", "icons/ui.js"],
    ["lib/automation/tips.ts", "tips.js"],
]) {
    writeFileSync(
        join(out, dst),
        ts.transpileModule(readFileSync(join(root, src), "utf8"), {
            compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
        }).outputText,
    );
}
writeFileSync(join(out, "index.html"), `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;overflow:hidden;background:#0b1410}canvas{display:block;width:100vw;height:100vh;touch-action:none}</style></head><body><canvas id="c"></canvas><script type="module" src="/harness.js"></script></body></html>`);
copyFileSync(join(here, "harness.js"), join(out, "harness.js"));
const server = createServer((req, res) => {
    if (req.url === "/favicon.ico") return void res.writeHead(204).end();
    const path = req.url === "/" ? "/index.html" : req.url.split("?")[0];
    try {
        // Real art (the HUD glyph sheet) comes from public/; everything else from the temp build.
        const body = readFileSync(path.startsWith("/brasswork/") ? join(root, "public", path) : join(out, path));
        const type = path.endsWith(".js") ? "text/javascript" : path.endsWith(".webp") ? "image/webp" : path.endsWith(".png") ? "image/png" : "text/html";
        res.writeHead(200, { "content-type": type });
        res.end(body);
    } catch {
        if (process.env.BW_DEBUG) console.log("404", req.url);
        res.writeHead(404).end();
    }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });

const browser = await chromium.launch();
async function scene(profile) {
    const ctx = await browser.newContext(profile);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(base);
    await page.waitForFunction(() => window.__auto);
    return { ctx, page, errors };
}

// Pixel centre of a board cell, computed in the page with the same projection the input layer uses.
const px = (page, x, z) => page.evaluate(([x, z]) => window.__auto.cellPx(x, z), [x, z]);
const state = (page) => page.evaluate(() => window.__auto.snapshot());

// ---- Desktop: 1440x900 with mouse and keyboard ----
{
    const { ctx, page, errors } = await scene({ viewport: { width: 1440, height: 900 } });
    const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    check("desktop: no sideways scroll", !hasHScroll);

    await page.evaluate(() => window.__auto.ctl.setToolById("machine"));
    let p = await px(page, 5, 5);
    await page.mouse.click(p.x, p.y);
    let s = await state(page);
    check("desktop: click places a machine on the picked cell", s.items.some((i) => i.x === 5 && i.z === 5 && i.kind === "machine"), JSON.stringify(s.items.slice(0, 3)));

    p = await px(page, 5, 5);
    await page.mouse.click(p.x, p.y);
    s = await state(page);
    check("desktop: second click on the same cell is refused and reported", s.lastEvent?.type === "invalid", JSON.stringify(s.lastEvent));

    await page.evaluate(() => window.__auto.ctl.setToolById("belt"));
    const a = await px(page, 2, 10);
    const b = await px(page, 8, 11);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 12 });
    s = await state(page);
    // Pencil: the stroke follows the drag, so the ghost is one connected path from 2,10 to 8,11 (8 cells, one turn).
    check("desktop: drag shows a ghost path that follows the drag", s.ghost && s.ghost.cells.length === 8 && s.ghost.cells.some((c) => c.z === 11), JSON.stringify(s.ghost?.cells?.map((c) => [c.x, c.z])));
    await page.mouse.up();
    s = await state(page);
    check("desktop: release commits the belt path", s.items.filter((i) => i.kind === "belt").length === 8);

    await page.keyboard.press("Control+z");
    s = await state(page);
    check("desktop: Ctrl+Z undoes the whole stroke", s.items.filter((i) => i.kind === "belt").length === 0);
    await page.keyboard.press("Control+Shift+z");
    s = await state(page);
    check("desktop: Ctrl+Shift+Z redoes it", s.items.filter((i) => i.kind === "belt").length === 8);

    p = await px(page, 5, 5);
    await page.mouse.move(p.x, p.y);
    await page.keyboard.press("Delete");
    s = await state(page);
    check("desktop: Delete removes the hovered machine", !s.items.some((i) => i.x === 5 && i.z === 5 && i.kind === "machine"));

    await page.keyboard.press("r");
    s = await state(page);
    check("desktop: R rotates the ghost", s.rot === 1);

    const before = (await state(page)).pitch;
    await page.keyboard.press("t");
    await page.waitForTimeout(900);
    s = await state(page);
    check("desktop: T toggles top-down and settles", s.topDown && s.pitch > before + 0.2, `pitch ${before.toFixed(2)} -> ${s.pitch.toFixed(2)}`);
    await page.keyboard.press("t");

    await page.evaluate(() => window.__auto.ctl.setToolById(null));
    const t0 = (await state(page)).target;
    await page.mouse.move(700, 450);
    await page.mouse.down();
    await page.mouse.move(640, 450, { steps: 8 });
    await page.mouse.up();
    const t1 = (await state(page)).target;
    check("desktop: left drag with no tool pans the map", Math.hypot(t1.x - t0.x, t1.z - t0.z) > 0.5);

    const d0 = (await state(page)).distance;
    await page.mouse.move(700, 450);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(300);
    s = await state(page);
    check("desktop: wheel zooms in", s.distance < d0 - 0.5, `${d0.toFixed(1)} -> ${s.distance.toFixed(1)}`);

    const y0 = (await state(page)).yaw;
    await page.mouse.move(700, 450);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(640, 430, { steps: 8 });
    await page.mouse.up({ button: "right" });
    await page.waitForTimeout(200);
    s = await state(page);
    check("desktop: right drag orbits", Math.abs(s.yaw - y0) > 0.05);

    const barDisplay = await page.evaluate(() => getComputedStyle(document.querySelector(".bw-touch-bar")).display);
    check("desktop: touch bar stays hidden on a wide mouse layout", barDisplay === "none", barDisplay);
    check("desktop: no script errors", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
}

// ---- Phone: 390x844 with touch emulation through CDP ----
{
    const { ctx, page, errors } = await scene({ ...devices["iPhone 13"], hasTouch: true });
    const cdp = await ctx.newCDPSession(page);
    const touch = async (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
    const tap = async (x, y) => {
        await touch("touchStart", [{ x, y, id: 1 }]);
        await touch("touchEnd", []);
    };
    const drag = async (from, to, steps = 10, holdMs = 0) => {
        await touch("touchStart", [{ x: from.x, y: from.y, id: 1 }]);
        if (holdMs) await page.waitForTimeout(holdMs);
        for (let i = 1; i <= steps; i++) {
            await touch("touchMove", [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps, id: 1 }]);
            await page.waitForTimeout(16);
        }
        await touch("touchEnd", []);
    };

    const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    check("phone: no sideways scroll", !hasHScroll);

    await page.evaluate(() => window.__auto.ctl.setToolById("machine"));
    let p = await px(page, 6, 6);
    await tap(p.x, p.y);
    await page.waitForTimeout(100);
    let s = await state(page);
    check("phone: first tap on a machine only previews it", !s.items.some((i) => i.x === 6 && i.z === 6 && i.kind === "machine"));
    await tap(p.x, p.y);
    await page.waitForTimeout(100);
    s = await state(page);
    check("phone: second tap on the same cell places one machine", s.items.some((i) => i.x === 6 && i.z === 6 && i.kind === "machine"));

    await page.evaluate(() => window.__auto.ctl.setToolById("belt"));
    const a = await px(page, 10, 3);
    const b = await px(page, 10, 9);
    await drag(a, b, 12, 420);
    await page.waitForTimeout(100);
    s = await state(page);
    check("phone: rest, then drag draws a belt line", s.items.filter((i) => i.kind === "belt").length === 7, `${s.items.filter((i) => i.kind === "belt").length} belts`);

    await page.evaluate(() => window.__auto.ctl.setToolById(null));
    const t0 = (await state(page)).target;
    const y0Orbit = (await state(page)).yaw;
    const from = { x: 200, y: 500 };
    await drag(from, { x: 120, y: 500 }, 12);
    await page.waitForTimeout(100);
    const t1 = (await state(page)).target;
    const t1Yaw = (await state(page)).yaw;
    // On touch, one finger orbits the camera (pointer.ts: "One finger drags to orbit"); panning is a two-finger slide.
    check("phone: one-finger drag orbits the camera", Math.abs(t1Yaw - y0Orbit) > 0.05 && Math.hypot(t1.x - t0.x, t1.z - t0.z) < 0.3, `yaw ${y0Orbit.toFixed(2)} -> ${t1Yaw.toFixed(2)}`);

    // Pinch: fingers spread apart zooms in (distance goes down).
    const d0 = (await state(page)).distance;
    const c = { x: 195, y: 420 };
    await touch("touchStart", [{ x: c.x - 40, y: c.y, id: 1 }, { x: c.x + 40, y: c.y, id: 2 }]);
    for (let i = 1; i <= 10; i++) {
        await touch("touchMove", [{ x: c.x - 40 - i * 6, y: c.y, id: 1 }, { x: c.x + 40 + i * 6, y: c.y, id: 2 }]);
        await page.waitForTimeout(16);
    }
    await touch("touchEnd", []);
    await page.waitForTimeout(400);
    s = await state(page);
    check("phone: pinch spread zooms in", s.distance < d0 - 1, `${d0.toFixed(1)} -> ${s.distance.toFixed(1)}`);

    // Two-finger rotate: rotate the pair around its centre by 60 degrees.
    const y0 = (await state(page)).yaw;
    const r = 50;
    const ang = (deg) => (deg * Math.PI) / 180;
    const pt = (deg) => ({ x: c.x + Math.cos(ang(deg)) * r, y: c.y + Math.sin(ang(deg)) * r });
    await touch("touchStart", [{ ...pt(0), id: 1 }, { ...pt(180), id: 2 }]);
    for (let i = 1; i <= 12; i++) {
        await touch("touchMove", [{ ...pt(i * 5), id: 1 }, { ...pt(180 + i * 5), id: 2 }]);
        await page.waitForTimeout(16);
    }
    await touch("touchEnd", []);
    await page.waitForTimeout(400);
    s = await state(page);
    check("phone: two-finger rotate turns the camera", Math.abs(s.yaw - y0) > 0.3, `${y0.toFixed(2)} -> ${s.yaw.toFixed(2)}`);

    // Long-press on an empty cell with a machine tool turns the ghost.
    await page.evaluate(() => window.__auto.ctl.setToolById("machine"));
    // Pick an empty cell on screen. Pinch zoom moves the target toward the fingers, so a fixed cell can end up off screen.
    // Scan a grid of screen points for the first one over an empty board cell. The belt drawn above crosses the
    // middle of the screen, so a fixed point can land on a belt and test the wrong thing.
    const e = await page.evaluate(() => {
        const ctl = window.__auto.ctl;
        const r = document.querySelector("canvas").getBoundingClientRect();
        const occupied = new Set(window.__auto.snapshot().items.map((i) => `${i.x},${i.z}`));
        for (let y = r.top + 120; y < r.bottom - 120; y += 30) {
            for (let x = r.left + 40; x < r.right - 40; x += 30) {
                const cell = ctl.pointer.cellAt(x, y);
                if (cell && !occupied.has(`${cell.x},${cell.z}`)) return { x, y, cell };
            }
        }
        return { x: 0, y: 0, cell: null };
    });
    check("phone: long-press target is an empty cell on screen", !!e.cell, JSON.stringify(e.cell));
    await touch("touchStart", [{ x: e.x, y: e.y, id: 1 }]);
    await page.waitForTimeout(450);
    await touch("touchEnd", []);
    await page.waitForTimeout(100);
    s = await state(page);
    check("phone: long-press on an empty cell turns the ghost", s.rot === 1 && !s.items.some((i) => i.x === e.cell?.x && i.z === e.cell?.z), `rot ${s.rot}`);

    // Long-press on a placed machine turns that machine, in place.
    await page.evaluate(() => window.__auto.focus(6, 6));
    await page.waitForTimeout(200);
    const m = await px(page, 6, 6);
    await touch("touchStart", [{ x: m.x, y: m.y, id: 1 }]);
    await page.waitForTimeout(450);
    await touch("touchEnd", []);
    await page.waitForTimeout(100);
    s = await state(page);
    const placed = s.items.find((i) => i.x === 6 && i.z === 6);
    check("phone: long-press on a machine turns it", placed && placed.rot === 1, JSON.stringify(placed));

    // The on-screen bar: six buttons, each at least 48 by 48 CSS pixels.
    const sizes = await page.evaluate(() => [...document.querySelectorAll(".bw-touch-bar button")].map((b) => {
        const r = b.getBoundingClientRect();
        return [r.width, r.height];
    }));
    check("phone: six touch-bar buttons, each at least 44 by 44", sizes.length === 6 && sizes.every(([w, h]) => w >= 44 && h >= 44), JSON.stringify(sizes));
    check("phone: touch bar is visible", await page.evaluate(() => getComputedStyle(document.querySelector(".bw-touch-bar")).display !== "none"));

    // Tapping the Top button switches to top-down.
    await page.tap('button[aria-label="Top-down view"]');
    await page.waitForTimeout(900);
    s = await state(page);
    check("phone: Top button switches to top-down", s.topDown && s.pitch > 1.3, `pitch ${s.pitch.toFixed(2)}`);
    await page.tap('button[aria-label="Top-down view"]');
    await page.waitForTimeout(300);

    check("phone: no script errors", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
}

await browser.close();
server.close();
let failed = 0;
for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail && !r.ok ? `  (${r.detail})` : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
