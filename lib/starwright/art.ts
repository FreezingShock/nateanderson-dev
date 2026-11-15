// Starwright's scene renderer: a 320 x 180 pixel buffer, drawn per pixel and shown pixelated. Everything is ordered-dither
// (4x4 Bayer) through a small colour ramp, so the star, corona, dust ring, planets and the supernova share one look.
// No React and no game imports beyond data, so the component and the screenshot scripts draw the same frames.
import { PLANETS, type Planet } from "./data";
import { drawFrame, frameAt, frameAtProgress, type SpriteSet } from "./sprites";

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

/** The dither buffer being drawn into. The scene is 320x180; planet sprites use a small square one. */
let BW = W;
let BH = H;

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
    /** star stage transition: the stage it came from, and 0..1 progress (1 = settled) */
    fromStage?: number;
    shift?: number;
    /** 0..1 birth of a new star after a collapse (1 = fully grown) */
    born?: number;
    /** 0..1 how close the core is to collapse */
    collapse?: number;
    /** 0 purple sky, 1 neutron-star teal, 2 singularity red */
    sky?: number;
    /** stage of each planet in orbit */
    planetStages?: Record<string, number>;
    /** the visitor waiting, and seconds since it came; drawn as a comet, flare, cloud or companion */
    visitor?: { id: string; age: number } | null;
    /** what the collapse animation was: 0 supernova, 1 neutron star; and the stage of the star that collapsed */
    novaKind?: number;
    novaFrom?: number;
    /** the birth cloud of this star: the one now, the one fading out (a collapse or a new pick), and the 0..1 crossfade between them */
    cloud?: { cur: string; prev: string; mix: number };
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

const SKIES: RGB[][] = [
    ramp("#07040f", "#120a26", "#241446", "#3c2270"),
    ramp("#03070d", "#071a22", "#0c3340", "#17586c"),
    ramp("#0a0405", "#1f0a10", "#3a1020", "#62182c"),
];
const BGS: Array<Uint8ClampedArray | null> = [null, null, null];
let STARS: { x: number; y: number; ph: number; b: number }[] = [];

function buildBackground(sky = 0) {
    const out = new Uint8ClampedArray(W * H * 4);
    BGS[sky] = out;
    const purple = SKIES[sky];
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            // two bands of nebula, drifting diagonally, thresholded through the Bayer matrix
            const n = vnoise(x / 46 + 3.1, y / 30) * 0.6 + vnoise(x / 17, y / 12 + 9) * 0.4;
            const band = Math.max(0, 1 - Math.abs((x / W) * 0.9 + (y / H) * 0.7 - 1.0) * 2.4);
            const v = Math.min(1, n * band * 1.5 + 0.04);
            const idx = Math.min(purple.length - 1, Math.floor(v * (purple.length - 1) + bayer(x, y)));
            const c = purple[idx];
            const o = (y * W + x) * 4;
            out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = 255;
        }
    }
    if (STARS.length) return;
    STARS = [];
    for (let i = 0; i < 90; i++) STARS.push({ x: Math.floor(hash(i, 7) * W), y: Math.floor(hash(i, 13) * H), ph: hash(i, 31) * 6.28, b: 0.4 + hash(i, 5) * 0.6 });
}

// ---- drawing ------------------------------------------------------------------------------------------------------

let buf: Uint8ClampedArray;
function px(x: number, y: number, c: RGB, a = 1) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= BW || y >= BH) return;
    const o = (y * BW + x) * 4;
    const ea = buf[o + 3];
    if (ea === 0) { // a transparent layer: the pixel starts from this colour
        buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = a >= 1 ? 255 : Math.round(a * 255);
        return;
    }
    if (a >= 1) { buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = 255; return; }
    buf[o] = buf[o] + (c[0] - buf[o]) * a;
    buf[o + 1] = buf[o + 1] + (c[1] - buf[o + 1]) * a;
    buf[o + 2] = buf[o + 2] + (c[2] - buf[o + 2]) * a;
    buf[o + 3] = Math.max(ea, Math.round(a * 255));
}

const pick = (r: RGB[], v: number, x: number, y: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(v * (r.length - 1) + bayer(x, y))))];

export function starRadius(mass: number, stage: number): number {
    const m = Math.min(1, Math.log10(mass + 10) / 11);
    return (22 + 16 * m) * STAGE_SCALE[stage];
}

const ease = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const mixRGB = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const mixRamp = (a: RGB[], b: RGB[], k: number): RGB[] => a.map((c, i) => mixRGB(c, b[i], k));
/** How fast each stage's surface turns. */
const SPIN = [0.05, 0.12, 0.06, 0.3, 0.22, 0.1];

function skyBuffer(sky: number): Uint8ClampedArray {
    const k = sky === 1 || sky === 2 ? sky : 0;
    if (!BGS[k]) buildBackground(k);
    return BGS[k]!;
}

export function render(img: ImageData, f: SceneFrame): void {
    BW = W; BH = H;
    buf = img.data;
    buf.set(skyBuffer(f.sky ?? 0));
    const t = f.reduce ? 0 : f.t;
    for (const s of STARS) {
        const tw = f.reduce ? 1 : 0.55 + 0.45 * Math.sin(t * 1.3 + s.ph);
        const v = Math.floor(120 + 135 * s.b * tw);
        px(s.x, s.y, [v, v, Math.min(255, v + 20)]);
    }
    const cx = W / 2, cy = H / 2 - 2;
    if (f.hole >= 0) { drawHole(f, cx, cy, t); return; }

    // The collapse: the old star shrinks and trembles for the first fifth, then the blast takes over.
    const imp = f.nova >= 0 && f.novaFrom !== undefined && f.nova < 0.2 ? f.nova / 0.2 : -1;
    if (imp >= 0) {
        const from = f.novaFrom as number;
        const R0 = starRadius(f.mass, from) * (1 - ease(imp) * 0.7);
        drawStar(f, cx + (hash(Math.floor(t * 40), 1) - 0.5) * imp * 3, cy + (hash(Math.floor(t * 40), 2) - 0.5) * imp * 3, R0, mixRamp(RAMPS[STAGE_RAMP[from]], RAMPS.iron, imp), from, t, 1);
        if (imp > 0.7) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (bayer(x, y) < (imp - 0.7) * 3) px(x, y, [255, 255, 255], 0.9);
        return;
    }

    const shift = f.shift === undefined ? 1 : clamp01(f.shift);
    const from = f.fromStage ?? f.stage;
    const born = f.born === undefined ? 1 : clamp01(f.born);
    const rampc = shift < 1 ? mixRamp(RAMPS[STAGE_RAMP[from]], RAMPS[STAGE_RAMP[f.stage]], ease(shift)) : RAMPS[STAGE_RAMP[f.stage]];
    let R = starRadius(f.mass, f.stage) * (shift < 1 ? (starRadius(f.mass, from) / starRadius(f.mass, f.stage)) * (1 - ease(shift)) + ease(shift) : 1);
    R *= born < 1 ? 0.15 + 0.85 * ease(born) : 1;
    if (!f.reduce) {
        if (f.stage === 2) R *= 1 + 0.035 * Math.sin(t * 1.1);
        else if (f.stage === 4) R *= 1 + 0.02 * Math.sin(t * 2.3);
    }
    const col = Math.max(0, Math.min(1, f.collapse ?? 0));
    if (f.stage === 5 && col > 0.2) R *= 1 - 0.1 * Math.min(1, col) + (f.reduce ? 0 : Math.sin(t * 30) * 0.006 * col);

    drawVisitorBack(f, cx, cy, R, t);
    drawRing(f, cx, cy, R, rampc, t, false);
    drawPlanets(f, cx, cy, R, t, false);
    drawStar(f, cx, cy, R, rampc, f.stage, t, born, col);
    if (shift < 1) drawIgnition(cx, cy, R, rampc, shift);
    if (f.pulsars > 0) drawPulsar(cx, cy, R, t);
    drawRing(f, cx, cy, R, rampc, t, true);
    drawPlanets(f, cx, cy, R, t, true);
    drawVisitorFront(f, cx, cy, R, t);
    if (f.nova >= 0) drawNova(f.novaFrom !== undefined ? (f.nova - 0.2) / 0.8 : f.nova, cx, cy, f.novaKind ?? 0);
}

/** The star itself: body, corona, and the animation that belongs to its stage. */
function drawStar(f: SceneFrame, cx: number, cy: number, R: number, rampc: RGB[], stage: number, t: number, born: number, col = 0) {
    const box = Math.ceil(R * 2) + 4;
    const spin = SPIN[stage];
    const ready = stage === 5 && col >= 1;
    for (let y = Math.max(0, Math.floor(cy - box)); y < Math.min(H, Math.ceil(cy + box)); y++) {
        for (let x = Math.max(0, Math.floor(cx - box)); x < Math.min(W, Math.ceil(cx + box)); x++) {
            if (born < 1 && bayer(x, y) > born * 1.25) continue;
            const dx = x - cx, dy = y - cy;
            const d = Math.sqrt(dx * dx + dy * dy) / R;
            if (d > 2) continue;
            let v: number;
            if (d < 1) {
                const z = Math.sqrt(1 - d * d);
                const lon = Math.atan2(dx, z) + t * spin;
                const nx = lon * 3.4, ny = (dy / R) * 3.4;
                const n = vnoise(nx, ny) * 0.62 + vnoise(nx * 2.3 + 5, ny * 2.3) * 0.38;
                const cells = n > 0.52 ? 0.95 : n > 0.4 ? 0.74 : 0.52;
                v = Math.min(1, (0.42 + 0.58 * z) * cells + 0.1);
                if (stage === 0) v *= 0.8 + 0.2 * vnoise(nx * 4 - t * 0.6, ny * 4); // a cloud still falling in, uneven and dim
                else if (stage === 2) v *= 0.88 + 0.12 * vnoise(nx * 1.2 + t * 0.15, ny * 1.2); // big slow convection cells
                else if (stage === 5) {
                    // onion shells inside a dead core; cracks of white light as it gives way
                    v *= 0.82 + 0.18 * Math.sin(d * 22);
                    const ridge = Math.abs(vnoise(nx * 1.7, ny * 1.7 + 3) - 0.5);
                    if (ridge < 0.03 + col * 0.05) v = Math.min(1, v + 0.5 * col);
                    if (ready) v = Math.min(1, v + (f.reduce ? 0.3 : 0.2 + 0.2 * Math.sin(t * 9)));
                }
            } else {
                const k = 1 - (d - 1);
                v = k * k * 0.55 * (0.8 + 0.2 * Math.sin(t * 0.7 + Math.atan2(dy, dx) * 5));
                if (stage === 3) v *= 0.75 + 0.25 * Math.abs(Math.sin(Math.atan2(dy, dx) * 4 + t * 0.8)); // hot spikes turning
                if (v < 0.08) continue;
            }
            px(x, y, pick(rampc, v, x, y));
        }
    }
    if (f.reduce) return;
    if (stage === 0) { // jets out of both poles, and dust spiralling in
        for (let i = 0; i < 46; i++) {
            const h = (hash(i, 41) + t * 0.5) % 1;
            const y = cy - R - h * 44, y2 = cy + R + h * 44;
            const x = cx + (hash(i, 43) - 0.5) * (3 + h * 5) * (0.6 + 0.4 * Math.sin(t * 5 + i));
            px(x, y, rampc[3], 0.8 * (1 - h)); px(x, y2, rampc[3], 0.8 * (1 - h));
        }
        for (let i = 0; i < 70; i++) {
            const k = 1 - ((t * 0.16 + hash(i, 47)) % 1);
            const r = R * (1.15 + 2.6 * k);
            const a = hash(i, 49) * 6.28 + k * 3.4;
            px(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.42, rampc[2], 0.35 + 0.55 * (1 - k));
        }
    } else if (stage === 1) { // prominences that rise from the rim and fall back
        for (let n = 0; n < 2; n++) {
            const life = (t / 7 + n * 0.5) % 1;
            const a = hash(Math.floor(t / 7 + n * 0.5), 53 + n) * 6.28;
            const hgt = Math.sin(life * Math.PI) * R * 0.5;
            for (let i = 0; i <= 24; i++) {
                const u = i / 24, arch = Math.sin(u * Math.PI);
                const aa = a + (u - 0.5) * 0.5;
                px(cx + Math.cos(aa) * (R + arch * hgt), cy + Math.sin(aa) * (R + arch * hgt), rampc[4], 0.85 * Math.sin(life * Math.PI));
            }
        }
    } else if (stage === 2) { // a loose shell of shed gas
        const rr = R * (1.5 + 0.1 * Math.sin(t * 0.6));
        for (let i = 0; i < 160; i++) {
            const a = (i / 160) * 6.28 + t * 0.04;
            if (hash(i, 59) < 0.45) continue;
            px(cx + Math.cos(a) * (rr + (hash(i, 61) - 0.5) * 6), cy + Math.sin(a) * (rr + (hash(i, 61) - 0.5) * 6) * 0.9, rampc[1], 0.5);
        }
    } else if (stage === 3) { // long rays, turning
        for (let r = 0; r < 8; r++) {
            const a = r * 0.785 + t * 0.35;
            const len = R * (0.7 + 0.5 * hash(r, 67) + 0.15 * Math.sin(t * 2 + r));
            for (let i = 0; i < len; i++) px(cx + Math.cos(a) * (R + i), cy + Math.sin(a) * (R + i), rampc[i % 2 ? 3 : 4], 0.6 * (1 - i / len));
        }
    } else if (stage === 4) { // wind streaming off, and a glint on the limb
        for (let i = 0; i < 90; i++) {
            const h = (hash(i, 71) + t * 0.32) % 1;
            const a = hash(i, 73) * 6.28;
            const r = R * (1.02 + h * 1.6);
            px(cx + Math.cos(a) * r, cy + Math.sin(a) * r, rampc[3], 0.7 * (1 - h));
        }
        const g = 0.5 + 0.5 * Math.sin(t * 1.7);
        const gx = cx + R * 0.55, gy = cy - R * 0.55;
        for (let i = -7; i <= 7; i++) { px(gx + i, gy, [255, 255, 255], g * (1 - Math.abs(i) / 8)); px(gx, gy + i, [255, 255, 255], g * (1 - Math.abs(i) / 8)); }
    } else if (stage === 5 && col > 0.5) { // light leaking through the cracks, and the core starting to flicker
        for (let i = 0; i < 40 * col; i++) {
            const a = hash(i, 79) * 6.28 + t * 2, r = R * (0.2 + 0.8 * hash(i, 83));
            px(cx + Math.cos(a) * r, cy + Math.sin(a) * r, [255, 240, 220], 0.5 * col * (0.5 + 0.5 * Math.sin(t * 12 + i)));
        }
    }
}

/** A shockwave ring that runs out over the new stage's colours as the star changes. */
function drawIgnition(cx: number, cy: number, R: number, rampc: RGB[], shift: number) {
    const r = R * (1 + shift * 1.6);
    for (let i = 0; i < 360; i += 2) {
        const a = (i / 180) * Math.PI;
        px(cx + Math.cos(a) * r, cy + Math.sin(a) * r, rampc[4], 0.9 * (1 - shift));
        px(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2), rampc[3], 0.5 * (1 - shift));
    }
}

/** A pulsar companion: a tiny blue-white spark on a tight orbit with two crossing beams. */
function drawPulsar(cx: number, cy: number, R: number, t: number) {
    const a = t * 0.9;
    const px0 = cx + Math.cos(a) * (R + 16), py0 = cy + Math.sin(a) * (R + 16) * 0.5;
    for (let i = -22; i <= 22; i++) {
        const k = i / 22;
        if (Math.abs(i) > 3 && (i + Math.floor(t * 8)) % 2 === 0) continue;
        px(px0 + Math.cos(a * 3) * i, py0 + Math.sin(a * 3) * i, RAMPS.blue[3], 1 - Math.abs(k) * 0.8);
    }
    px(px0, py0, [255, 255, 255]); px(px0 + 1, py0, RAMPS.blue[4]); px(px0, py0 + 1, RAMPS.blue[4]);
}


// ---- birth clouds: each one tints the whole sky in its own way, dithered and drifting ----------------------------------

interface CloudLook { c: RGB[]; /** noise scale x, y */ sx: number; sy: number; /** drift per second x, y */ dx: number; dy: number; /** strength 0..1 and where it sits: 0 even, 1 low in the frame, -1 high, 2 a band across the middle */ k: number; where: number; sparkle?: RGB }
const CLOUD_LOOK: Record<string, CloudLook> = {
    dense: { c: ramp("#06102a", "#0c2a5a", "#1d5fa8", "#5fb4ff"), sx: 38, sy: 26, dx: 1.2, dy: 0.1, k: 1.25, where: 1 },
    hot: { c: ramp("#2a0a04", "#7a2008", "#e0501a", "#ffb050"), sx: 30, sy: 22, dx: 0.5, dy: -2.2, k: 1.3, where: 1, sparkle: [255, 200, 120] },
    rich: { c: ramp("#2a1e04", "#6a4c0a", "#d9a31a", "#ffe98a"), sx: 16, sy: 14, dx: 0.8, dy: 0.3, k: 1.0, where: 0, sparkle: [255, 240, 170] },
    thin: { c: ramp("#0a1620", "#1a3448", "#4a7f9c", "#d8f0ff"), sx: 60, sy: 14, dx: 2.4, dy: 0, k: 1.35, where: -1 },
    dusty: { c: ramp("#1a0e24", "#3e1e4a", "#7a3e82", "#d9a0e8"), sx: 12, sy: 40, dx: 1.6, dy: 0.4, k: 1.1, where: 0 },
    quiet: { c: ramp("#04180f", "#0a3a26", "#1a8a5a", "#6affc0"), sx: 70, sy: 9, dx: 3.2, dy: 0, k: 1.1, where: 2, sparkle: [190, 255, 220] },
};

/** One cloud's wash over the sky at `alpha`. A shape term decides where it gathers; noise through the Bayer matrix keeps it dithered. */
function drawCloudSky(id: string, t: number, alpha: number) {
    const L = CLOUD_LOOK[id];
    if (!L || alpha <= 0.01) return;
    for (let y = 0; y < H; y++) {
        const ny = y / H;
        const shape = L.where === 1 ? 0.15 + ny * 1.1 : L.where === -1 ? 1.15 - ny * 1.1 : L.where === 2 ? Math.max(0, 1 - Math.abs(ny - 0.4 + Math.sin(t * 0.3) * 0.04) * 3.2) : 0.8;
        if (shape <= 0.05) continue;
        for (let x = (y & 1); x < W; x += 2) { // every other pixel in a checker, so the wash reads as dither and costs half
            const n = vnoise(x / L.sx + t * L.dx / L.sx * 4, y / L.sy + t * L.dy / L.sy * 4) * 0.65 + vnoise(x / (L.sx / 3) + 11, y / (L.sy / 3) - t * 0.3) * 0.35;
            const v = n * shape * L.k;
            if (v < 0.28 + bayer(x, y) * 0.5) continue;
            const c = pick(L.c, Math.min(1, v), x, y);
            px(x, y, c, alpha * 0.55);
            px(x + 1, y, c, alpha * 0.55);
        }
    }
    if (L.sparkle) {
        for (let i = 0; i < 26; i++) {
            const ph = (t * 0.25 + hash(i, 91)) % 1;
            const sx = hash(i, 17) * W, sy = L.where === 1 ? H - ph * H * 0.8 : hash(i, 29) * H;
            const tw = Math.sin(ph * Math.PI);
            if (tw > 0.2) px(sx, sy, L.sparkle, alpha * tw);
        }
    }
}

// ---- visitors drawn in the sky ----------------------------------------------------------------------------------------

/** Things behind the star: a gas cloud drifting through. */
function drawVisitorBack(f: SceneFrame, cx: number, cy: number, R: number, t: number) {
    const v = f.visitor;
    if (!v || v.id !== "nebula") return;
    const p = clamp01(v.age / 150);
    const ox = -40 + p * (W + 80), oy = cy - 30 + Math.sin(p * 5) * 14;
    const tintR = ramp("#0a1e2a", "#144a5e", "#2a8aa8", "#9fe6f0");
    for (let y = Math.max(0, Math.floor(oy - 50)); y < Math.min(H, oy + 50); y++) {
        for (let x = Math.max(0, Math.floor(ox - 80)); x < Math.min(W, ox + 80); x++) {
            const d = Math.hypot((x - ox) / 80, (y - oy) / 40);
            if (d > 1) continue;
            const n = vnoise((x + t * 2) / 11, y / 9);
            const a = (1 - d) * n * 1.2;
            if (a < bayer(x, y) * 0.9) continue;
            px(x, y, pick(tintR, a, x, y), 0.55);
        }
    }
}

/** Things in front of the star: a comet falling in, a flare off the limb, a companion passing. */
function drawVisitorFront(f: SceneFrame, cx: number, cy: number, R: number, t: number) {
    const v = f.visitor;
    if (!v) return;
    if (v.id === "comet") {
        const p = clamp01(v.age / 150);
        const x0 = W - 14, y0 = 16, x1 = cx + R * 1.25, y1 = cy - R * 0.5;
        const hx = x0 + (x1 - x0) * p, hy = y0 + (y1 - y0) * p;
        const ang = Math.atan2(y1 - y0, x1 - x0);
        const tail = 34 + (1 - p) * 20;
        for (let i = 0; i < tail; i++) {
            const k = i / tail;
            const w = (1 - k) * 3.2;
            for (let s = -2; s <= 2; s++) {
                if (Math.abs(s) > w) continue;
                if (bayer(i + s * 3, s + 9) < k * 0.9) continue;
                px(hx - Math.cos(ang) * i - Math.sin(ang) * s, hy - Math.sin(ang) * i + Math.cos(ang) * s, mixRGB([255, 255, 255], [90, 150, 230], k), 0.9 * (1 - k));
            }
        }
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5) px(hx + dx, hy + dy, dx + dy < 0 ? [255, 255, 255] : [190, 220, 255]);
    } else if (v.id === "flare") {
        const p = clamp01(v.age / 150);
        const a = -0.9, size = R * (0.35 + 0.9 * Math.min(1, p * 1.6)) * (0.9 + 0.1 * Math.sin(t * 6));
        const hot = RAMPS.giant;
        for (let i = 0; i <= 60; i++) {
            const u = i / 60, arch = Math.sin(u * Math.PI);
            const aa = a + (u - 0.5) * 0.7;
            const r = R + arch * size;
            px(cx + Math.cos(aa) * r, cy + Math.sin(aa) * r, hot[4], 0.9);
            px(cx + Math.cos(aa) * (r - 1.5), cy + Math.sin(aa) * (r - 1.5), hot[3], 0.8);
            if (i % 5 === 0) px(cx + Math.cos(aa) * (r + 2 + 2 * Math.sin(t * 9 + i)), cy + Math.sin(aa) * (r + 2), [255, 255, 255], 0.6);
        }
    } else if (v.id === "pair") {
        const p = clamp01(v.age / 150);
        const a = Math.PI * (1.15 + 0.9 * p);
        const x = cx + Math.cos(a) * (R * 2.7), y = cy + Math.sin(a) * (R * 1.1) - 6;
        const c = RAMPS.blue;
        for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) {
            const d = Math.hypot(dx, dy);
            if (d > 10) continue;
            const k = d < 3.4 ? 1 : (1 - (d - 3.4) / 6.6) * 0.7;
            if (k < bayer(x + dx, y + dy)) continue;
            px(x + dx, y + dy, pick(c, k, x + dx, y + dy), d < 3.4 ? 1 : 0.7);
        }
    }
}

// ---- rings and planets ---------------------------------------------------------------------------------------------------

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
        const stage = f.planetStages?.[id] ?? 2;
        // the lit side faces the star
        drawPlanetBody(x, y, planetRadius(p, stage), -Math.cos(a), -s * 0.6, p, stage, t);
    }
}

/** On-screen radius: planets grow a little with each stage. */
export function planetRadius(p: Planet, stage: number): number {
    return Math.max(2, p.size * (0.85 + 0.12 * stage));
}

const shade = (c: RGB, k: number): RGB => [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];

/**
 * One planet at one of its four stages. Stage 0 is a hot cloud of debris, 1 a glowing molten ball, 2 a settled surface with its
 * own texture, 3 a finished world (air, clouds, lights, moons, storms, rings) depending on what kind it is.
 */
function drawPlanetBody(x: number, y: number, r: number, lx: number, ly: number, p: Planet, stage: number, t: number) {
    const c = hex(p.color);
    const molten: RGB = [255, 130, 50];
    if (p.look === "moons") { // a cluster of small moons that gathers one by one
        const n = 1 + stage;
        for (let m = 0; m < n; m++) {
            const a = t * (0.6 + m * 0.25) + m * 2.1;
            const mx = x + Math.cos(a) * (r + 1 + m * 1.5), my = y + Math.sin(a) * (r + 1 + m * 1.5) * 0.5;
            const rr = Math.max(1, r * (0.45 - m * 0.05));
            for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
                if (dx * dx + dy * dy > rr * rr) continue;
                const lit = (dx * lx + dy * ly) / rr;
                px(mx + dx, my + dy, shade(m % 2 ? hex("#c9a8ee") : c, lit > 0 ? 1 : 0.5));
            }
        }
        if (stage === 0) for (let i = 0; i < 12; i++) px(x + (hash(i, 91) - 0.5) * r * 3, y + (hash(i, 93) - 0.5) * r * 1.5, c, 0.6);
        return;
    }
    if (p.look === "ringed" && stage >= 2) drawPlanetRing(x, y, r, false, stage);
    const spin = t * 0.2;
    const sc = p.look === "gas" || p.look === "ringed" ? 1 : 2.4;
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
        for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
            const d = Math.hypot(dx, dy);
            if (d > r) continue;
            const z = Math.sqrt(Math.max(0, 1 - (d / r) * (d / r)));
            const lon = Math.atan2(dx / r, z) + spin;
            const lat = dy / r;
            const n = vnoise(lon * sc * 2, lat * sc * 2 + 4);
            const lit = (dx / r) * lx + (dy / r) * ly + 0.4 * z;
            const qx = x + dx, qy = y + dy;
            let col: RGB = c;
            let glow = false;
            if (stage === 0) { // hot, lumpy, dim: still pulling together
                col = shade(c, 0.55 + 0.5 * n);
                if (n > 0.62) { col = molten; glow = true; }
                if (hash(dx * 3 + 9, dy * 5 + 11) < 0.18 + 0.1 * Math.sin(t * 3 + dx)) col = shade(col, 0.6);
            } else if (stage === 1) { // cracks of lava over a dark crust
                col = shade(c, 0.4 + 0.3 * n);
                const crack = Math.abs(vnoise(lon * 5, lat * 5 + 2) - 0.5);
                if (crack < 0.06) { col = molten; glow = true; }
            } else if (p.look === "gas" || p.look === "ringed") { // bands, sharper and with a storm at stage 3
                const band = 0.5 + 0.5 * Math.sin(lat * (stage >= 3 ? 11 : 6) + n * 2.2);
                col = mixRGB(shade(c, 0.62), shade(c, 1.15), band);
                if (stage === 3) {
                    const sx = lon - 0.9 * Math.sin(t * 0.05), sy = lat - 0.28;
                    if (sx * sx * 3 + sy * sy * 14 < 0.12) col = [200, 80, 50];
                }
            } else if (p.look === "ash") {
                col = shade(c, 0.75 + 0.5 * n);
                if (stage === 3) col = mixRGB(col, [200, 196, 188], 0.3 * vnoise(lon * 4, lat * 4));
            } else if (p.look === "ice") {
                col = mixRGB(shade(c, 0.8), [235, 248, 255], n * 0.8);
                if (stage === 3) col = mixRGB([40, 90, 150], col, n > 0.58 ? 1 : 0.15); // dark sea showing between ice
            } else if (p.look === "glass") {
                col = mixRGB(shade(c, 0.7), [220, 245, 255], Math.pow(n, 2));
                if (stage === 3) col = mixRGB(col, [250, 255, 255], 0.35 * Math.abs(Math.sin(lon * 6 + lat * 3))); // glints off a flat sea
            } else if (p.look === "metal") {
                col = shade(c, 0.7 + 0.5 * n);
                if (stage === 3 && hash(Math.floor(lon * 9), Math.floor(lat * 9)) < 0.22) col = shade(col, 0.5); // dug-out pits
            } else { // rock
                col = shade(c, 0.7 + 0.6 * n);
                if (stage === 3) col = n > 0.56 ? [70, 140, 80] : n > 0.4 ? [60, 100, 160] : shade(c, 0.9);
            }
            // light, dithered into four steps
            let k = lit > 0.35 ? 1 : lit > 0.02 ? 0.72 : lit > -0.35 ? 0.5 : 0.32;
            k = 0.32 + 0.68 * (Math.floor(((k - 0.32) / 0.68) * 3 + bayer(qx, qy)) / 3);
            let out = glow ? shade(col, 0.9 + 0.2 * Math.sin(t * 4 + dx * 0.7)) : shade(col, k);
            // finished worlds: air at the rim, clouds, and lights on the dark side
            if (stage === 3 && p.look !== "gas" && p.look !== "ringed" && p.look !== "metal" && p.look !== "ash") {
                const rim = d / r;
                if (rim > 0.78 && lit > -0.2) out = mixRGB(out, [170, 215, 255], Math.min(0.75, (rim - 0.78) * 3.4));
                const cloud = vnoise(lon * 5 - t * 0.05, lat * 5 + 8);
                if (cloud > 0.62 && lit > 0.0) out = mixRGB(out, [255, 255, 255], 0.55);
                if (p.look === "rock" && lit < -0.15 && hash(Math.floor(lon * 14), Math.floor(lat * 14)) < 0.06) out = [255, 220, 120];
            }
            px(qx, qy, out);
        }
    }
    if (stage === 0) { // debris still coming in
        for (let i = 0; i < 14; i++) {
            const a = hash(i, 97) * 6.28 + t * (0.5 + hash(i, 99)), rr = r * (1.3 + 0.9 * hash(i, 101));
            px(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.6, molten, 0.55);
        }
    }
    if (p.look === "ringed" && stage >= 2) drawPlanetRing(x, y, r, true, stage);
    if (stage === 3 && (p.look === "rock" || p.look === "ice" || p.look === "glass")) { // a small moon
        const a = t * 1.1 + p.orbit * 9;
        const mx = x + Math.cos(a) * (r + 3.5), my = y + Math.sin(a) * (r + 3.5) * 0.5;
        px(mx, my, [225, 222, 215]); px(mx + 1, my, [140, 138, 134]);
    }
}

function drawPlanetRing(x: number, y: number, r: number, front: boolean, stage: number) {
    const rr = r * 1.9, ry = rr * 0.28;
    const rings = stage >= 3 ? 3 : 1;
    for (let n = 0; n < rings; n++) {
        const r0 = rr * (0.9 + n * 0.14);
        for (let i = 0; i < 90; i++) {
            const a = (i / 90) * Math.PI * 2;
            const s = Math.sin(a);
            if ((s > 0) !== front) continue;
            px(x + Math.cos(a) * r0, y + s * ry * (0.9 + n * 0.14), n === 1 ? hex("#c9a572") : hex("#e8cf9a"), 0.85);
        }
    }
}

/** A planet at a stage on its own small square canvas, for the Orbit panel. */
export function renderPlanetSprite(img: ImageData, id: string, stage: number, t: number): void {
    const p = PLANETS.find((x) => x.id === id);
    BW = img.width; BH = img.height;
    buf = img.data;
    for (let i = 0; i < buf.length; i += 4) { buf[i] = 11; buf[i + 1] = 9; buf[i + 2] = 22; buf[i + 3] = 255; }
    if (p) {
        for (let i = 0; i < 14; i++) px(hash(i, 7) * BW, hash(i, 13) * BH, [150, 150, 190], 0.6);
        const r = Math.min(BW * 0.4, 8 + p.size * 1.7) * (0.8 + 0.07 * stage);
        drawPlanetBody(BW / 2, BH / 2, r, -0.7, -0.5, p, stage, t);
    }
    BW = W; BH = H;
}

// ---- the blast ---------------------------------------------------------------------------------------------------------

function drawNova(n: number, cx: number, cy: number, kind = 0) {
    n = clamp01(n);
    const r = Math.pow(n, 0.6) * 230;
    const flash = Math.max(0, 1 - n * 5);
    // a supernova is warm; a neutron star's collapse is cold and tight, with a hard ring
    const hot = kind === 1 ? ramp("#ffffff", "#d6f4ff", "#5fb4ff", "#3a4ad8", "#10124a") : ramp("#ffffff", "#ffe9a0", "#ff9a3a", "#c2318f", "#3a1070");
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const dx = x - cx, dy = y - cy;
            const d = Math.sqrt(dx * dx + dy * dy);
            let v = -1;
            if (d < r) v = 0.15 + 0.85 * (d / Math.max(r, 1)) * (1 - n * 0.7) + (1 - n) * 0.2;
            const band = Math.abs(d - r);
            if (band < (kind === 1 ? 5 : 9)) v = Math.min(v < 0 ? 1 : v, 0.05 + band / 14);
            if (kind === 0 && d < r && n > 0.1) { // clumps and filaments in the cloud
                const fil = vnoise(Math.atan2(dy, dx) * 5, d / 14);
                if (fil > 0.6) v = Math.min(v, 0.3);
            }
            if (v < 0 && flash <= 0) continue;
            if (v >= 0 && n > 0.75) {
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
    BW = W; BH = H;
    img.data.set(skyBuffer(0));
    buf = img.data;
    for (const s of STARS) {
        const v = Math.floor(120 + 135 * s.b * (0.55 + 0.45 * Math.sin(t * 1.3 + s.ph)));
        px(s.x, s.y, [v, v, Math.min(255, v + 20)]);
    }
}

// ---- layered scene: drawn sprite sheets over code-drawn fallbacks ----------------------------------------------------

interface Layer { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; img: ImageData }
export interface Layers { ctx: CanvasRenderingContext2D; sky: Layer; back: Layer; front: Layer }

function layer(): Layer | null {
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    return ctx ? { canvas, ctx, img: ctx.createImageData(W, H) } : null;
}

/** Make the three working layers for a visible scene canvas. */
export function makeLayers(ctx: CanvasRenderingContext2D): Layers | null {
    const sky = layer(), back = layer(), front = layer();
    return sky && back && front ? { ctx, sky, back, front } : null;
}

function begin(l: Layer, opaque?: Uint8ClampedArray) {
    BW = W; BH = H;
    buf = l.img.data;
    if (opaque) buf.set(opaque); else buf.fill(0);
}
function flush(L: Layers, l: Layer) {
    l.ctx.putImageData(l.img, 0, 0);
    L.ctx.drawImage(l.canvas, 0, 0);
}

const NAMES = STAGE_RAMP as readonly string[];
/** last stage seen per planet, and when it changed (scene time), to play the stage-up burst once */
const planetSeen = new Map<string, { st: number; at: number }>();
/** where each planet was last drawn, so one that vanishes can break apart in place */
const planetPos = new Map<string, { x: number; y: number; goneAt: number }>();
/** How much bigger than the code-drawn body a drawn star sprite is drawn (its corona and rays sit outside the body). */
const STAR_FIT = 1.3;

/**
 * Draws the scene with sprite sheets where they exist and the code-drawn version where they do not, so a missing or still-loading
 * sheet never leaves a hole. Order: sky, drifting cloud, back planets, back layer (ring, code-drawn star), star sprite, front
 * layer (ring, pulsar, code-drawn planets), front planets, visitors, then the blast on top.
 */
export function renderLayered(L: Layers, f: SceneFrame, S: SpriteSet): void {
    const ctx = L.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    const t = f.reduce ? 0 : f.t;
    const cx = W / 2, cy = H / 2 - 2;
    const to = f.stage;
    const shift = f.shift === undefined ? 1 : clamp01(f.shift);
    const from = f.fromStage ?? to;

    // 1. sky: a drawn backdrop (crossfaded when the stage changes), or the code-drawn sky and stars
    const bgId = (st: number) => (f.sky === 1 ? "bg/nebula-n1" : f.sky === 2 ? "bg/nebula-n2" : `bg/nebula-${NAMES[st]}`);
    const bg = S.get(bgId(to));
    if (bg) {
        const old = shift < 1 && f.sky === 0 && from !== to ? S.get(bgId(from)) : null;
        // skies are short loops (twinkling stars, glowing gas); a still sky has one frame and frameAt returns 0
        if (old) { drawFrame(ctx, old, frameAt(old, t), W / 2, H / 2); drawFrame(ctx, bg, frameAt(bg, t), W / 2, H / 2, 1, ease(shift)); } else drawFrame(ctx, bg, frameAt(bg, t), W / 2, H / 2);
    } else {
        begin(L.sky, skyBuffer(f.sky ?? 0));
        for (const s of STARS) {
            const tw = f.reduce ? 1 : 0.55 + 0.45 * Math.sin(t * 1.3 + s.ph);
            const v = Math.floor(120 + 135 * s.b * tw);
            px(s.x, s.y, [v, v, Math.min(255, v + 20)]);
        }
        flush(L, L.sky);
    }

    // the birth cloud's wash over the sky, crossfading from the last one when a star is born or a collapse clears it
    if (f.hole < 0 && f.cloud && (f.cloud.cur || f.cloud.prev)) {
        begin(L.front);
        if (f.cloud.prev && f.cloud.mix < 1) drawCloudSky(f.cloud.prev, t, 1 - f.cloud.mix);
        if (f.cloud.cur) drawCloudSky(f.cloud.cur, t, f.cloud.mix);
        flush(L, L.front);
    }

    // the ending: the hole sheet over the sky, or the code-drawn hole
    if (f.hole >= 0) {
        const hs = S.get("star/hole");
        if (hs) { drawFrame(ctx, hs, frameAt(hs, t), W / 2, H / 2); return; }
        begin(L.front);
        drawHole(f, cx, cy, t);
        flush(L, L.front);
        return;
    }

    // the old star shrinking before the blast
    const imp = f.nova >= 0 && f.novaFrom !== undefined && f.nova < 0.2 ? f.nova / 0.2 : -1;
    if (imp >= 0) {
        const from0 = f.novaFrom as number;
        const is = S.get(`star/implode-${NAMES[from0]}`);
        if (is) {
            const k = (2 * starRadius(f.mass, from0) * STAR_FIT) / is.body;
            drawFrame(ctx, is, frameAtProgress(is, imp), cx, cy, k);
        } else {
            const R0 = starRadius(f.mass, from0) * (1 - ease(imp) * 0.7);
            begin(L.front);
            drawStar(f, cx, cy, R0, mixRamp(RAMPS[STAGE_RAMP[from0]], RAMPS.iron, imp), from0, t, 1);
            flush(L, L.front);
        }
        if (imp > 0.85) { ctx.globalAlpha = (imp - 0.85) / 0.15; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
        return;
    }

    const born = f.born === undefined ? 1 : clamp01(f.born);
    const rampc = shift < 1 ? mixRamp(RAMPS[STAGE_RAMP[from]], RAMPS[STAGE_RAMP[to]], ease(shift)) : RAMPS[STAGE_RAMP[to]];
    let R = starRadius(f.mass, to) * (shift < 1 ? (starRadius(f.mass, from) / starRadius(f.mass, to)) * (1 - ease(shift)) + ease(shift) : 1);
    R *= born < 1 ? 0.15 + 0.85 * ease(born) : 1;
    if (!f.reduce) {
        if (to === 2) R *= 1 + 0.035 * Math.sin(t * 1.1);
        else if (to === 4) R *= 1 + 0.02 * Math.sin(t * 2.3);
    }
    const col = Math.max(0, Math.min(1, f.collapse ?? 0));
    if (to === 5 && col > 0.2) R *= 1 - 0.1 * Math.min(1, col) + (f.reduce ? 0 : Math.sin(t * 30) * 0.006 * col);

    // a new star's first seconds: the old star's remnant drifts off while the new one gathers out of a spiral of gas
    const birth = born < 1 && !f.reduce ? S.get("star/birth") : null;
    if (birth) drawFrame(ctx, birth, frameAtProgress(birth, born), W / 2, H / 2, 1, born > 0.75 ? (1 - born) / 0.25 : 1);

    // 2. a gas cloud drifting behind the star
    const v = f.visitor;
    const neb = v?.id === "nebula" ? S.get("visitor/nebula") : null;
    if (v && neb) {
        const p = clamp01(v.age / 150);
        drawFrame(ctx, neb, frameAt(neb, t), -40 + p * (W + 80), cy - 30 + Math.sin(p * 5) * 14, 2, 0.85);
    }

    // planets: stage sheets at their own size; ones without a sheet are drawn in code
    const orbitOf = (p: Planet) => R * 1.5 + (W / 2 - R * 1.5 - 26) * p.orbit;
    const angleOf = (p: Planet) => (t / p.period) * Math.PI * 2 + hash(p.orbit * 100, 3) * 6.28;
    const planetSheet = (p: Planet) => S.get(`planet/${p.id}-s${f.planetStages?.[p.id] ?? 2}`);
    const drawSheetPlanets = (front: boolean) => {
        for (const id of f.planets) {
            const p = PLANETS.find((x) => x.id === id);
            if (!p) continue;
            const sh = planetSheet(p);
            const a = angleOf(p), s = Math.sin(a);
            if (!sh || (s > 0) !== front) continue;
            drawFrame(ctx, sh, frameAt(sh, t), cx + Math.cos(a) * orbitOf(p), cy + s * orbitOf(p) * 0.27, 1);
        }
    };
    const codePlanets = (front: boolean) => {
        for (const id of f.planets) {
            const p = PLANETS.find((x) => x.id === id);
            if (!p || planetSheet(p)) continue;
            const a = angleOf(p), s = Math.sin(a);
            if ((s > 0) !== front) continue;
            const stage = f.planetStages?.[id] ?? 2;
            drawPlanetBody(cx + Math.cos(a) * orbitOf(p), cy + s * orbitOf(p) * 0.27, planetRadius(p, stage), -Math.cos(a), -s * 0.6, p, stage, t);
        }
    };

    // star sprite, if there is one for this stage
    const sheetOf = (st: number) => S.get(st === 5 && col >= 1 ? "star/iron-ready" : `star/${NAMES[st]}`) ?? S.get(`star/${NAMES[st]}`);
    const cur = sheetOf(to);
    const trans = cur && shift < 1 && from !== to ? S.get(`star/trans-${NAMES[from]}-${NAMES[to]}`) : null;
    const prev = cur && shift < 1 && from !== to && !trans ? sheetOf(from) : null;

    drawSheetPlanets(false);
    begin(L.back);
    drawRing(f, cx, cy, R, rampc, t, false);
    codePlanets(false);
    if (!cur) {
        drawStar(f, cx, cy, R, rampc, to, t, born, col);
        if (shift < 1) drawIgnition(cx, cy, R, rampc, shift);
    }
    flush(L, L.back);
    if (cur) {
        const k = (2 * R * STAR_FIT) / cur.body;
        const a = born < 1 ? Math.min(1, born * 1.6) : 1;
        if (trans) drawFrame(ctx, trans, frameAtProgress(trans, shift), cx, cy, (2 * starRadius(f.mass, to) * STAR_FIT) / cur.body, a);
        else if (prev) {
            drawFrame(ctx, prev, frameAt(prev, t), cx, cy, (2 * R * STAR_FIT) / prev.body, a * (1 - ease(shift)));
            drawFrame(ctx, cur, frameAt(cur, t), cx, cy, k, a * ease(shift));
        } else drawFrame(ctx, cur, frameAt(cur, t), cx, cy, k, a);
    }

    // front layer
    begin(L.front);
    if (f.pulsars > 0) drawPulsar(cx, cy, R, t);
    drawRing(f, cx, cy, R, rampc, t, true);
    codePlanets(true);
    const comet = v?.id === "comet" ? S.get("visitor/comet") : null;
    const flare = v?.id === "flare" ? S.get("visitor/flare") : null;
    const pair = v?.id === "pair" ? S.get("visitor/pair") : null;
    if (v && !neb && !comet && !flare && !pair) { drawVisitorBack(f, cx, cy, R, t); drawVisitorFront(f, cx, cy, R, t); }
    const blast = f.nova >= 0 ? S.get(f.novaKind === 1 ? "star/nova-neutron" : "star/nova-supernova") : null;
    if (f.nova >= 0 && !blast) drawNova(f.novaFrom !== undefined ? (f.nova - 0.2) / 0.8 : f.nova, cx, cy, f.novaKind ?? 0);
    flush(L, L.front);
    drawSheetPlanets(true);

    // a planet that just grew a stage gets a burst of light over it; a visitor that just arrived opens out of a ripple
    if (!f.reduce) {
        const up = S.get("fx/planet-up");
        for (const id of f.planets) {
            const st = f.planetStages?.[id] ?? 2;
            const seen = planetSeen.get(id);
            if (!seen || st < seen.st) planetSeen.set(id, { st, at: -1e9 });
            else if (st > seen.st) planetSeen.set(id, { st, at: f.t });
            const at = planetSeen.get(id)!.at;
            const p = PLANETS.find((x) => x.id === id);
            if (!up || !p || f.t - at > 1.7) continue;
            const a = angleOf(p);
            drawFrame(ctx, up, frameAtProgress(up, (f.t - at) / 1.7), cx + Math.cos(a) * orbitOf(p), cy + Math.sin(a) * orbitOf(p) * 0.27);
        }
        // note where each planet stands, so a planet stripped away by a blast can break up there (drawn above the blast, below)
        for (const [id, at] of planetPos) {
            if (f.planets.includes(id)) continue;
            if (at.goneAt < 0) at.goneAt = f.t;
        }
        for (const id of f.planets) {
            const p = PLANETS.find((x) => x.id === id);
            if (!p) continue;
            const a = angleOf(p);
            planetPos.set(id, { x: cx + Math.cos(a) * orbitOf(p), y: cy + Math.sin(a) * orbitOf(p) * 0.27, goneAt: -1 });
        }
        const arrive = v && v.age < 2 ? S.get("fx/arrive") : null;
        if (v && arrive) {
            const ax = v.id === "comet" ? W - 14 : v.id === "nebula" ? 24 : v.id === "pair" ? cx + Math.cos(Math.PI * 1.15) * R * 2.7 : cx + Math.cos(-0.9) * R;
            const ay = v.id === "comet" ? 16 : v.id === "nebula" ? cy - 30 : v.id === "pair" ? cy + Math.sin(Math.PI * 1.15) * R * 1.1 - 6 : cy + Math.sin(-0.9) * R;
            drawFrame(ctx, arrive, frameAtProgress(arrive, v.age / 2), Math.max(24, Math.min(W - 24, ax)), Math.max(20, ay));
        }
    }

    // visitors drawn as sprites
    if (v && comet) {
        const p = clamp01(v.age / 150);
        const x0 = W - 14, y0 = 16, x1 = cx + R * 1.25, y1 = cy - R * 0.5;
        drawFrame(ctx, comet, frameAt(comet, t), x0 + (x1 - x0) * p, y0 + (y1 - y0) * p, 2);
    } else if (v && flare) {
        const p = clamp01(v.age / 150);
        const ang = -0.9, k = (R / 24) * (0.5 + 0.7 * Math.min(1, p * 1.6));
        drawFrame(ctx, flare, frameAt(flare, t), cx + Math.cos(ang) * (R + 4 * k), cy + Math.sin(ang) * (R + 4 * k), k, 0.95, ang + Math.PI / 2);
    } else if (v && pair) {
        const p = clamp01(v.age / 150);
        const a = Math.PI * (1.15 + 0.9 * p);
        drawFrame(ctx, pair, frameAt(pair, t), cx + Math.cos(a) * (R * 2.7), cy + Math.sin(a) * (R * 1.1) - 6, 1.2);
    }

    // the blast on top
    if (blast && f.nova >= 0) {
        const n = f.novaFrom !== undefined ? (f.nova - 0.2) / 0.8 : f.nova;
        drawFrame(ctx, blast, frameAtProgress(blast, n), W / 2, H / 2);
    }

    // a planet stripped away by a blast breaks into glowing chunks that cool as they fly; drawn over the blast so they show
    const gone = f.reduce ? null : S.get("fx/planet-gone");
    if (gone) {
        for (const [id, at] of planetPos) {
            if (f.planets.includes(id) || at.goneAt < 0) continue;
            const k = (f.t - at.goneAt) / (gone.frames / gone.fps);
            if (k > 1) { planetPos.delete(id); continue; }
            drawFrame(ctx, gone, frameAtProgress(gone, k), at.x, at.y, 1.3);
        }
    }
}
