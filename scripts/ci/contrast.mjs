// Contrast check for the dim and muted text tokens, measured on the real pixels behind the text.
// Usage: node scripts/ci/contrast.mjs http://localhost:3123 [out.json]
// Needs the scripts/ci deps (cd scripts/ci && npm ci && npx playwright install chromium).
//
// For each route at 1440 and 390 (reduced motion, past the password gate):
//   1. the page is scrolled top to bottom so reveal-on-scroll content exists;
//   2. every text element whose computed colour is a dim or muted token (--cm-dim, --cm-mute, --cm-paper-mute, read
//      from :root for the dark scope and from [data-theme="paper"] for the paper scope) is listed, with its opacity
//      (ancestors multiplied) and whether it is large text (24px, or 18.66px bold);
//   3. all text on the page is made transparent, so each screenshot shows only the background;
//   4. the viewport is screenshotted at each scroll position, and each element's box is read from the first position
//      where it is fully visible and not covered by another element (fixed header, dock). Every pixel in the box is
//      scored against the element's text colour, blended by its cumulative opacity.
// Boxes are read inside the element's own border. Per element: avg = contrast of the mean background; p5 = the 5th-percentile pixel (a robust worst, so one border
// pixel does not drive a decision); min = the single worst pixel (its background colour is reported); medLum = the
// median background luminance, which separates the dithered page (dark) from component fills (chips, pills).
// Disabled controls are listed apart, since WCAG exempts inactive components.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { unlock, waitFor } from "./lib.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { PNG } = require("pngjs");

const base = (process.argv[2] || "http://localhost:3123").replace(/\/$/, "");
const outFile = process.argv[3];
const ROUTES = ["/", "/about", "/studies", "/timeline", "/history", "/blog", "/creations", "/creations/games"];
const WIDTHS = [1440, 390];
const HEIGHT = 900;
const TOKEN_NAMES = ["--cm-dim", "--cm-mute", "--cm-paper-mute"];
const NORMAL = 4.5;
const LARGE = 3;
const PAGE_MAX_LUM = 0.03; // median background darker than about #2e2e2e counts as the dithered page

await waitFor(base);
const cookieLine = await unlock(base);
const eq = cookieLine.indexOf("=");
const cookie = { name: cookieLine.slice(0, eq), value: cookieLine.slice(eq + 1) };

// ---- colour maths (WCAG 2.x relative luminance) -------------------------------------------------------------------
const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const blend = (fg, bg, a) => fg.map((c, i) => a * c + (1 - a) * bg[i]);
const hex = (rgb) => "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");
const parseRgb = (s) => { const m = s.match(/[\d.]+/g).map(Number); return { rgb: m.slice(0, 3), a: m.length > 3 ? m[3] : 1 }; };

// ---- page side: find the candidates and measure their boxes --------------------------------------------------------
function collect(names) {
    const probe = document.createElement("span");
    document.body.appendChild(probe);
    const scopeEl = document.createElement("div");
    scopeEl.setAttribute("data-theme", "paper");
    document.body.appendChild(scopeEl);
    // Tokens are hex in camino.tokens.css; parse them directly. A probe element read back through getComputedStyle
    // returned the inherited text colour here, which mislabelled every element.
    const asRgb = (v) => {
        const m = v.match(/^#([0-9a-f]{6})$/i);
        if (m) { const n = parseInt(m[1], 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; }
        probe.style.color = ""; probe.style.color = v; return getComputedStyle(probe).color;
    };
    const tokenMap = new Map();
    for (const [scope, node] of [["dark", document.documentElement], ["paper", scopeEl]]) {
        const cs = getComputedStyle(node);
        for (const n of names) {
            const v = cs.getPropertyValue(n).trim();
            if (!v) continue;
            const key = asRgb(v);
            if (!tokenMap.has(key)) tokenMap.set(key, []);
            tokenMap.get(key).push({ name: n, scope });
        }
    }
    probe.remove();
    scopeEl.remove();

    const out = [];
    let idx = 0;
    for (const el of document.body.querySelectorAll("*")) {
        if (el instanceof SVGElement || el.closest("script,style,noscript")) continue;
        let text = "";
        for (const n of el.childNodes) if (n.nodeType === 3) text += n.textContent;
        text = text.replace(/\s+/g, " ").trim();
        if (!text) continue;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        const scope = el.closest('[data-theme="paper"]') ? "paper" : "dark";
        const entries = (tokenMap.get(cs.color) || []).filter((e) => e.scope === scope);
        if (!entries.length) continue;
        let alpha = 1;
        for (let a = el; a && a.nodeType === 1; a = a.parentElement) alpha *= parseFloat(getComputedStyle(a).opacity);
        if (alpha < 0.02) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        const fs = parseFloat(cs.fontSize);
        const fw = parseInt(cs.fontWeight, 10);
        const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
        el.setAttribute("data-ctr", String(idx));
        out.push({
            i: idx,
            token: `${entries[0].name} (${scope})`,
            fg: cs.color,
            alpha,
            fs,
            fw,
            large: fs >= 24 || (fs >= 18.66 && fw >= 700),
            disabled: !!el.closest(":disabled, [aria-disabled='true']"),
            text: text.slice(0, 48),
            where: `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}`,
        });
        idx++;
    }
    return out;
}

// Viewport geometry for the given candidates: where each box sits now, and whether another element covers it.
function measure(idxs) {
    const vw = innerWidth, vh = innerHeight;
    return idxs.map((i) => {
        const el = document.querySelector(`[data-ctr="${i}"]`);
        if (!el) return { i, state: "missing" };
        const r = el.getBoundingClientRect();
        // Sample the area inside the element's own border: the text sits there, and a 1px border ring is not background.
        const bs = getComputedStyle(el);
        const px = (v) => parseFloat(v) || 0;
        const x0 = Math.max(0, Math.ceil(r.left + px(bs.borderLeftWidth))), y0 = Math.max(0, Math.ceil(r.top + px(bs.borderTopWidth)));
        const x1 = Math.min(vw, Math.floor(r.right - px(bs.borderRightWidth))), y1 = Math.min(vh, Math.floor(r.bottom - px(bs.borderBottomWidth)));
        if (x1 - x0 < 2 || y1 - y0 < 2) return { i, state: "offscreen" };
        let bad = 0, cover = null;
        for (let gx = 0; gx < 5; gx++) for (let gy = 0; gy < 3; gy++) {
            const hit = document.elementFromPoint(x0 + ((gx + 0.5) / 5) * (x1 - x0), y0 + ((gy + 0.5) / 3) * (y1 - y0));
            if (!hit || !(el.contains(hit) || hit.contains(el))) {
                bad++;
                cover = cover || (hit ? `${hit.tagName.toLowerCase()}${typeof hit.className === "string" && hit.className ? "." + hit.className.trim().split(/\s+/).slice(0, 2).join(".") : ""}` : "none");
            }
        }
        return { i, state: bad ? "covered" : "clear", cover, x0, y0, x1, y1 };
    });
}

// ---- node side: score the pixels ----------------------------------------------------------------------------------
function scoreBox(shot, b, fgRgb, alpha) {
    const count = (b.x1 - b.x0) * (b.y1 - b.y0);
    const ratios = new Float32Array(count);
    const lums = new Float32Array(count);
    let sum = [0, 0, 0], n = 0, worst = { ratio: Infinity, bg: null };
    for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) {
        const o = (y * shot.width + x) * 4;
        const bg = [shot.data[o], shot.data[o + 1], shot.data[o + 2]];
        const ratio = contrast(lum(blend(fgRgb, bg, alpha)), lum(bg));
        lums[n] = lum(bg);
        ratios[n++] = ratio;
        sum = sum.map((s, k) => s + bg[k]);
        if (ratio < worst.ratio) worst = { ratio, bg };
    }
    const mean = sum.map((s) => s / n);
    const avg = contrast(lum(blend(fgRgb, mean, alpha)), lum(mean));
    ratios.sort();
    lums.sort();
    return {
        n,
        avg,
        p5: ratios[Math.floor(0.05 * (n - 1))],
        p50: ratios[Math.floor(0.5 * (n - 1))],
        min: worst.ratio,
        minBg: worst.bg,
        medLum: lums[Math.floor(0.5 * (n - 1))],
    };
}

// Score every candidate on one route. Each candidate is scored at the first scroll position where its box is clear.
async function sampleRoute(page, route) {
    await page.goto(base + route, { waitUntil: "load" });
    await page.waitForTimeout(1200);
    const docH = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < docH; y += 400) {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(60);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);

    const cands = await page.evaluate(collect, TOKEN_NAMES);
    // Hide every glyph on the page so the screenshots hold only background (and icons, which are not text).
    await page.addStyleTag({ content: "body *, body *::before, body *::after { color: transparent !important; text-shadow: none !important; -webkit-text-stroke-color: transparent !important; } ::placeholder { color: transparent !important; }" });

    const pending = new Set(cands.map((c) => c.i));
    const byIdx = new Map(cands.map((c) => [c.i, c]));
    const stats = new Map();
    const last = new Map();
    const step = HEIGHT - 120;
    const maxY = Math.max(0, docH - HEIGHT);
    const ys = [];
    for (let y = 0; ; y += step) { ys.push(Math.min(y, maxY)); if (y >= maxY) break; }
    for (const y of ys) {
        if (!pending.size) break;
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(80);
        const shot = PNG.sync.read(await page.screenshot({ type: "png" }));
        const geo = await page.evaluate(measure, [...pending]);
        for (const g of geo) {
            last.set(g.i, g);
            if (g.state !== "clear") continue;
            const c = byIdx.get(g.i);
            const { rgb, a } = parseRgb(c.fg);
            stats.set(g.i, { ...scoreBox(shot, g, rgb, c.alpha * a), y });
            pending.delete(g.i);
        }
    }
    return cands.map((c) => {
        const s = stats.get(c.i);
        if (s) return { ...c, ...s };
        const g = last.get(c.i);
        return { ...c, unsampled: true, why: g ? g.state : "never measured", cover: g?.cover || null };
    });
}

// ---- run ----------------------------------------------------------------------------------------------------------
const browser = await chromium.launch();
const results = []; // { width, route, ...candidate }
for (const width of WIDTHS) {
    const ctx = await browser.newContext({
        viewport: { width, height: HEIGHT },
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
    });
    await ctx.addCookies([{ ...cookie, url: base }]);
    for (const route of ROUTES) {
        const page = await ctx.newPage();
        const rows = await sampleRoute(page, route);
        for (const r of rows) results.push({ width, route, ...r });
        const skipped = rows.filter((r) => r.unsampled);
        const why = {};
        for (const r of skipped) { const k = `${r.why}${r.cover ? " by " + r.cover : ""}`; why[k] = (why[k] || 0) + 1; }
        console.log(`${width} ${route}: ${rows.length} text elements on dim tokens, ${skipped.length} not sampled ${JSON.stringify(why)}`);
        await page.close();
    }
    await ctx.close();
}
await browser.close();

// ---- report -------------------------------------------------------------------------------------------------------
// "page" = the dithered page ground (median background dark). Lighter medians are component fills (a chip, a pill, a
// selected state): the token cannot fix text on those, so they are reported apart.
const measured = results.filter((r) => !r.unsampled).map((r) => ({ ...r, page: r.medLum < PAGE_MAX_LUM }));
const need = (r) => (r.large ? LARGE : NORMAL);
const f2 = (v) => v.toFixed(2);
const pageRows = measured.filter((r) => r.page && !r.disabled);
const fillRows = measured.filter((r) => !r.page && !r.disabled);
const disabledRows = measured.filter((r) => r.disabled);
const tokens = [...new Set(measured.map((r) => r.token))].sort();

console.log(`\nDithered page (median background darker than #2e2e2e): ${pageRows.length} elements.`);
console.log("Cell = worst-element p50 / p5 / min (lowest pixel) contrast, then (elements, elements failing p5). Threshold 4.5 normal, 3 large.");
for (const width of WIDTHS) {
    console.log(`\n### ${width}px, dithered page\n`);
    console.log(`| token | ${ROUTES.join(" | ")} |`);
    console.log(`|---|${ROUTES.map(() => "---").join("|")}|`);
    for (const t of tokens) {
        const cells = ROUTES.map((route) => {
            const g = pageRows.filter((r) => r.width === width && r.token === t && r.route === route);
            if (!g.length) return "-";
            const fails = g.filter((r) => r.p5 < need(r)).length;
            return `${f2(Math.min(...g.map((r) => r.p50)))} / ${f2(Math.min(...g.map((r) => r.p5)))} / ${f2(Math.min(...g.map((r) => r.min)))} (${g.length}, ${fails})`;
        });
        console.log(`| ${t} | ${cells.join(" | ")} |`);
    }
}

console.log(`\nComponent fills (median background lighter than #2e2e2e): ${fillRows.length} elements.`);
for (const t of tokens) {
    const g = fillRows.filter((r) => r.token === t);
    if (!g.length) continue;
    const w = g.reduce((a, b) => (b.min < a.min ? b : a));
    console.log(`- ${t}: ${g.length} elements, lowest p5 ${f2(Math.min(...g.map((r) => r.p5)))}; worst "${w.text}" (${w.width} ${w.route} ${w.where}) min ${f2(w.min)} on ${hex(w.minBg)}`);
}
if (disabledRows.length) {
    const w = disabledRows.reduce((a, b) => (b.p5 < a.p5 ? b : a));
    console.log(`\nDisabled controls (exempt, listed apart): ${disabledRows.length} elements; lowest p5 ${f2(w.p5)} at ${w.route} ${w.width}px, "${w.text}"`);
}

console.log("\nWorst 8 on the dithered page (by p5):");
for (const r of [...pageRows].sort((a, b) => a.p5 - b.p5).slice(0, 8)) {
    console.log(`- ${r.width} ${r.route} ${r.token} ${r.where} "${r.text}" avg ${f2(r.avg)} p5 ${f2(r.p5)} min ${f2(r.min)} bg@min ${hex(r.minBg)} medLum ${f2(r.medLum)} need ${need(r)}`);
}

// Lift proposals: keep hue and saturation, move HSL lightness the smallest step that reaches the threshold on the worst
// real dithered pixel. Direction follows the text: darker text moves down, lighter text moves up.
function rgbToHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [((h * 60) + 360) % 360, s, l];
}
function hslToRgb([h, s, l]) {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
console.log("\nLift for normal text on the dithered page (worst real pixel; hue and saturation kept):");
for (const t of tokens) {
    const g = pageRows.filter((r) => r.token === t && !r.large);
    if (!g.length) continue;
    const worstPx = g.reduce((a, b) => (b.min < a.min ? b : a));
    if (worstPx.min >= NORMAL) { console.log(`- ${t}: clears ${NORMAL} on every sampled dithered pixel (worst ${f2(worstPx.min)})`); continue; }
    const fgRgb = parseRgb(worstPx.fg).rgb;
    const bg = worstPx.minBg;
    const dark = lum(fgRgb) < lum(bg);
    const [h, s, l0] = rgbToHsl(fgRgb);
    const a = worstPx.alpha; // cumulative opacity of the element: the lift has to clear the blended colour
    let chosen = null;
    for (let k = 1; k <= 2000; k++) {
        const l = dark ? l0 - k * 0.0005 : l0 + k * 0.0005;
        if (l < 0 || l > 1) break;
        const cand = hslToRgb([h, s, l]).map((v) => Math.round(v));
        if (contrast(lum(blend(cand, bg, a)), lum(bg)) >= NORMAL) { chosen = cand; break; }
    }
    console.log(`- ${t}: ${hex(fgRgb)} -> ${chosen ? hex(chosen) : "none"} (L ${chosen ? ((rgbToHsl(chosen)[2] - l0) * 100).toFixed(1) : "n/a"} pts), worst bg ${hex(bg)}, ratio ${f2(worstPx.min)} -> ${chosen ? f2(contrast(lum(blend(chosen, bg, a)), lum(bg))) : "n/a"} (opacity ${a.toFixed(2)}), at ${worstPx.width} ${worstPx.route} ${worstPx.where} "${worstPx.text}"`);
}

if (outFile) writeFileSync(outFile, JSON.stringify({ base, results: measured }, null, 2));
