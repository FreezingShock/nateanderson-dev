// Starwright's scene renderer: a 320 x 180 pixel buffer, drawn per pixel and shown pixelated. Everything is ordered-dither
// (4x4 Bayer) through a small colour ramp, so the star, corona, dust ring, planets and the supernova share one look.
// No React and no game imports beyond data, so the component and the screenshot scripts draw the same frames.
import { PLANETS } from "./data";

export const W = 320;
export const H = 180;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

type RGB = readonly [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const ramp = (...c: string[]): RGB[] => c.map(hex);

/** Colour ramps, dark to light, one per star stage. */
export const RAMPS: Record<string, RGB[]> = {
    proto: ramp("#1a0a14", "#4a1a22", "#a8431f", "#e0852b", "#ffd27a"),
    dwarf: ramp("#2b1206", "#8a3a0c", "#d9791a", "#ffc23c", "#fff3b0"),
    giant: ramp("#2a0808", "#7a1410", "#cf3b1c", "#ff7a2e", "#ffc27a"),
    blue: ramp("#0a1030", "#1d3f8f", "#3d86e0", "#8fd0ff", "#eefaff"),
    super: ramp("#0c0a2a", "#3a2a9a", "#6a62f0", "#b6b8ff", "#ffffff"),
    iron: ramp("#14101c", "#3a3450", "#6c6688", "#b9b2cc", "#f4f0ff"),
};
const STAGE_RAMP = ["proto", "dwarf", "giant", "blue", "super", "iron"] as const;
const STAGE_SCALE = [0.8, 0.95, 1.2, 1.0, 1.08, 0.75];

export interface SceneFrame {
    t: number; // seconds, drives the turning surface and orbits
    mass: number;
    stage: number; // index into STAGE_RAMP
    planets: string[];
    /** 0..1 strength of the dust ring (grows with heavy elements held) */
    ring: number;
    /** 0..1 supernova animation, -1 for none */
    nova: number;
    /** 0..1 black hole ending, -1 for none */
    hole: number;
    /** how many neutron stars have formed (draws a pulsar companion) */
    pulsars: number;
    reduce: boolean;
}

// ---- static layers (built once) -----------------------------------------------------------------------------------

function hash(x: number, y: number): number {
    // offset so the lattice lines x = 0 and y = 0 are not degenerate (they showed as a seam through the star)
    let h = Math.imul((x | 0) + 7919, 374761393) ^ Math.imul((y | 0) + 104729, 668265263);
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function vnoise(x: number, y: number): number {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

let BG: Uint8ClampedArray | null = null;
let STARS: { x: number; y: number; ph: number; b: number }[] = [];

function buildBackground() {
    BG = new Uint8ClampedArray(W * H * 4);
    const purple = ramp("#07040f", "#120a26", "#241446", "#3c2270");
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            // two bands of nebula, drifting diagonally, thresholded through the Bayer matrix
            const n = vnoise(x / 46 + 3.1, y / 30) * 0.6 + vnoise(x / 17, y / 12 + 9) * 0.4;
            const band = Math.max(0, 1 - Math.abs((x / W) * 0.9 + (y / H) * 0.7 - 1.0) * 2.4);
            const v = Math.min(1, n * band * 1.5 + 0.04);
            const idx = Math.min(purple.length - 1, Math.floor(v * (purple.length - 1) + bayer(x, y)));
            const c = purple[idx];
            const o = (y * W + x) * 4;
            BG[o] = c[0]; BG[o + 1] = c[1]; BG[o + 2] = c[2]; BG[o + 3] = 255;
        }
    }
    STARS = [];
    for (let i = 0; i < 90; i++) STARS.push({ x: Math.floor(hash(i, 7) * W), y: Math.floor(hash(i, 13) * H), ph: hash(i, 31) * 6.28, b: 0.4 + hash(i, 5) * 0.6 });
}

// ---- drawing ------------------------------------------------------------------------------------------------------

let buf: Uint8ClampedArray;
function px(x: number, y: number, c: RGB, a = 1) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * 4;
    if (a >= 1) { buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; return; }
    buf[o] = buf[o] + (c[0] - buf[o]) * a;
    buf[o + 1] = buf[o + 1] + (c[1] - buf[o + 1]) * a;
    buf[o + 2] = buf[o + 2] + (c[2] - buf[o + 2]) * a;
}

const pick = (r: RGB[], v: number, x: number, y: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(v * (r.length - 1) + bayer(x, y))))];

export function starRadius(mass: number, stage: number): number {
    const m = Math.min(1, Math.log10(mass + 10) / 11);
    return (22 + 16 * m) * STAGE_SCALE[stage];
}

export function render(img: ImageData, f: SceneFrame): void {
    if (!BG) buildBackground();
    buf = img.data;
    buf.set(BG!);
    const t = f.reduce ? 0 : f.t;
    for (const s of STARS) {
        const tw = f.reduce ? 1 : 0.55 + 0.45 * Math.sin(t * 1.3 + s.ph);
        const v = Math.floor(120 + 135 * s.b * tw);
        px(s.x, s.y, [v, v, Math.min(255, v + 20)]);
    }
    const cx = W / 2, cy = H / 2 - 2;
    if (f.hole >= 0) { drawHole(f, cx, cy, t); return; }
    const R = starRadius(f.mass, f.stage);
    const rampc = RAMPS[STAGE_RAMP[f.stage]];

    // back halves: dust ring and planets behind the star
    drawRing(f, cx, cy, R, rampc, t, false);
    drawPlanets(f, cx, cy, R, t, false);

    // corona and body
    const box = Math.ceil(R * 2) + 4;
    for (let y = Math.max(0, Math.floor(cy - box)); y < Math.min(H, Math.ceil(cy + box)); y++) {
        for (let x = Math.max(0, Math.floor(cx - box)); x < Math.min(W, Math.ceil(cx + box)); x++) {
            const dx = x - cx, dy = y - cy;
            const d = Math.sqrt(dx * dx + dy * dy) / R;
            if (d > 2) continue;
            let v: number;
            if (d < 1) {
                const z = Math.sqrt(1 - d * d);
                const lon = Math.atan2(dx, z) + t * 0.12;
                const nx = lon * 3.4, ny = (dy / R) * 3.4;
                const n = vnoise(nx, ny) * 0.62 + vnoise(nx * 2.3 + 5, ny * 2.3) * 0.38;
                // darker cells between bright ones, like granulation
                const cells = n > 0.52 ? 0.95 : n > 0.4 ? 0.74 : 0.52;
                v = Math.min(1, (0.42 + 0.58 * z) * cells + 0.1);
            } else {
                const k = 1 - (d - 1);
                v = k * k * 0.55 * (0.8 + 0.2 * Math.sin(t * 0.7 + Math.atan2(dy, dx) * 5));
                if (v < 0.08) continue;
            }
            px(x, y, pick(rampc, v, x, y));
        }
    }
    // pulsar companion: a tiny blue-white spark on a tight orbit with two crossing beams
    if (f.pulsars > 0) {
        const a = t * 0.9;
        const px0 = cx + Math.cos(a) * (R + 16), py0 = cy + Math.sin(a) * (R + 16) * 0.5;
        for (let i = -22; i <= 22; i++) {
            const k = i / 22;
            if (Math.abs(i) > 3 && (i + Math.floor(t * 8)) % 2 === 0) continue;
            px(px0 + Math.cos(a * 3) * i, py0 + Math.sin(a * 3) * i, RAMPS.blue[3], 1 - Math.abs(k) * 0.8);
        }
        px(px0, py0, [255, 255, 255]); px(px0 + 1, py0, RAMPS.blue[4]); px(px0, py0 + 1, RAMPS.blue[4]);
    }
    drawRing(f, cx, cy, R, rampc, t, true);
    drawPlanets(f, cx, cy, R, t, true);
    if (f.nova >= 0) drawNova(f.nova, cx, cy);
}

function drawRing(f: SceneFrame, cx: number, cy: number, R: number, rampc: RGB[], t: number, front: boolean) {
    if (f.ring <= 0.02) return;
    const rr = R * 1.55 + 6, ry = rr * 0.2;
    const n = Math.floor(260 * (0.4 + 0.6 * f.ring));
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + t * 0.05;
        const s = Math.sin(a);
        if ((s > 0) !== front) continue;
        const jitter = (hash(i, 3) - 0.5) * 4;
        const x = cx + Math.cos(a) * (rr + jitter), y = cy + s * (ry + jitter * 0.2);
        if (hash(i, 11) < 0.25) continue;
        px(x, y, rampc[3 + (hash(i, 17) > 0.7 ? 1 : 0)] ?? rampc[3], 0.9);
    }
}

function drawPlanets(f: SceneFrame, cx: number, cy: number, R: number, t: number, front: boolean) {
    if (!f.planets.length) return;
    for (const id of f.planets) {
        const p = PLANETS.find((x) => x.id === id);
        if (!p) continue;
        const orbit = R * 1.5 + (W / 2 - R * 1.5 - 26) * p.orbit;
        const a = (t / p.period) * Math.PI * 2 + hash(p.orbit * 100, 3) * 6.28;
        const s = Math.sin(a);
        if ((s > 0) !== front) continue;
        const x = cx + Math.cos(a) * orbit, y = cy + s * orbit * 0.27;
        const c = hex(p.color);
        const r = p.size;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > r) continue;
            const lit = (dx * -Math.cos(a) + dy * -s * 0.6) / r; // lit side faces the star
            const k = lit > 0.1 ? 1 : lit > -0.4 ? 0.62 : 0.34;
            px(x + dx, y + dy, [c[0] * k, c[1] * k, c[2] * k]);
        }
        if (p.id === "seer") for (let dx = -r - 4; dx <= r + 4; dx++) px(x + dx, y + dx * 0.12, hex("#e8cf9a"), 0.8);
    }
}

function drawNova(n: number, cx: number, cy: number) {
    const r = Math.pow(n, 0.6) * 230;
    const flash = Math.max(0, 1 - n * 5);
    const hot = ramp("#ffffff", "#ffe9a0", "#ff9a3a", "#c2318f", "#3a1070");
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const dx = x - cx, dy = y - cy;
            const d = Math.sqrt(dx * dx + dy * dy);
            let v = -1;
            if (d < r) v = 0.15 + 0.85 * (d / Math.max(r, 1)) * (1 - n * 0.7) + (1 - n) * 0.2;
            const band = Math.abs(d - r);
            if (band < 9) v = Math.min(v < 0 ? 1 : v, 0.05 + band / 14);
            if (v < 0 && flash <= 0) continue;
            if (v >= 0 && n > 0.75) { // fade the cloud out through the dither so it never pops
                const fade = (1 - n) / 0.25;
                if (bayer(x, y) > fade) continue;
            }
            if (v >= 0) px(x, y, hot[Math.max(0, Math.min(hot.length - 1, Math.floor(v * (hot.length - 1) + bayer(x, y))))]);
            if (flash > 0) px(x, y, [255, 255, 255], flash * 0.9);
        }
    }
}

function drawHole(f: SceneFrame, cx: number, cy: number, t: number) {
    const k = Math.max(0, Math.min(1, f.hole));
    const R = 12 + 16 * k;
    const disc = ramp("#1a0a14", "#7a2a1a", "#d9791a", "#ffc23c", "#fff3b0");
    // accretion disc: a wide tilted ring of dither, bright where it moves toward us
    for (let pass = 0; pass < 2; pass++) {
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const dx = x - cx, dy = (y - cy) / 0.2;
                const d = Math.sqrt(dx * dx + dy * dy);
                const front = y - cy > 0;
                if ((pass === 1) !== front) continue;
                if (d < R * 1.5 || d > R * 4.2) continue;
                const u = (d - R * 1.5) / (R * 2.7);
                const swirl = vnoise(Math.atan2(dy, dx) * 6 - t * 0.9, d / 7);
                const v = (1 - u) * (0.45 + 0.7 * swirl) * (dx > 0 ? 1.1 : 0.85);
                if (v < 0.12) continue;
                px(x, y, pick(disc, Math.min(1, v), x, y));
            }
        }
        if (pass === 0) {
            for (let y = Math.floor(cy - R - 2); y <= cy + R + 2; y++) for (let x = Math.floor(cx - R - 2); x <= cx + R + 2; x++) {
                const d = Math.hypot(x - cx, y - cy);
                if (d <= R) px(x, y, [0, 0, 0]);
                else if (d <= R + 1.6) px(x, y, disc[4], 0.9); // the photon ring
            }
        }
    }
    // lensed arc over the top
    for (let i = 0; i < 90; i++) {
        const a = Math.PI + (i / 90) * Math.PI;
        px(cx + Math.cos(a) * R * 1.35, cy + Math.sin(a) * R * 1.35, disc[3], 0.8);
    }
}

/** The scene without a star: the nebula and starfield only. The constellation map draws this behind its chart. */
export function renderBackdrop(img: ImageData, t = 0): void {
    if (!BG) buildBackground();
    img.data.set(BG!);
    buf = img.data;
    for (const s of STARS) {
        const v = Math.floor(120 + 135 * s.b * (0.55 + 0.45 * Math.sin(t * 1.3 + s.ph)));
        px(s.x, s.y, [v, v, Math.min(255, v + 20)]);
    }
}
