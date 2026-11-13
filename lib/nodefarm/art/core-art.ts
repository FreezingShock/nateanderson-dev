// The reactor core's pixel renderer: a 144 px buffer drawn per pixel and per sprite, shown pixelated at 2x.
// It has no React and no game imports, so the component (components/nodefarm/zones/core.tsx) and the art preview script
// (scripts/naos-art/core-preview.mjs) draw exactly the same frames.
//
// Layers, back to front:
//   corona rays (Origin arc) · copper socket (Copper) · masts (Exploit Lab) · drone docks (Drones) · back halves of the
//   gyro rings (Ascend, Nebula, Origin) · inflowing sparks · the radial core (body, tick ring, Reboot arc, AP halo) ·
//   clamps (first Reboot) · front halves of the rings · code glyphs (Scripts) · drones · arcs · press pulse.
// Every layer writes a value (0..1, how lit) and a channel (which colour ramp), and the last pass maps them through the
// ramps with a 4x4 Bayer dither, so everything shares one dithered look.

export const CORE_S = 144;

import { PART, PART_ORDER, type PartId } from "./core-parts";
export { PART, PART_ORDER, type PartId };

export interface CoreFrame {
    /** 0..1 progress toward the cheapest Reboot (outer arc) */
    progress: number;
    overclock: boolean;
    /** stats unlocked (tick ring sectors, orbiting nodes, body shape) */
    unlocked: number;
    /** 0..1 from log10 of Bytes per second */
    speed: number;
    /** 0..1 strength of the last press pulse */
    pulse: number;
    /** stat index of the last press (the pulse ring wears its colour) */
    pulseStat: number;
    reboots: number;
    ap: number;
    /** stat index of the zone whose colours the core wears, and the one it is dissolving away from */
    zone: number;
    prevZone: number;
    /** 0..1 dither dissolve from prevZone to zone */
    zoneMix: number;
    /** index into SKINS: 0 zone colours, 1 chroma, 2 aurora, 3 gold, 4 mono */
    skin: number;
    /** 0..1 strength of a flare (a milestone or unlock just happened): a shockwave and a brighter body */
    flare: number;
    /** running zone event, index + 1 in CORE_EVENTS (0 = none) */
    event: number;
    /** rig level per zone (lights the rig rack on the frame) */
    rigs: number[];
    /** 0..1 share of the Firmware owned (lights the Handover shell) */
    fw: number;
    /** PART bitmask */
    parts: number;
    /** 0..1 per part: how far each part has built in (index = PART_ORDER position) */
    build: number[];
    /** drones flying (0..4) */
    drones: number;
    /** script glyphs orbiting (0..6) */
    glyphs: number;
}

// ---- palettes

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const cl = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
/** A five-step ramp from one colour: shadows lean blue, highlights lean toward white (classic pixel-art hue shift). */
function ramp(c: RGB): RGB[] {
    const [r, g, b] = c;
    return [
        [cl(r * 0.13 + 3), cl(g * 0.14 + 4), cl(b * 0.16 + 12)],
        [cl(r * 0.36), cl(g * 0.4 + 2), cl(b * 0.46 + 14)],
        [cl(r * 0.66), cl(g * 0.69), cl(b * 0.72 + 8)],
        [r, g, b],
        [cl(r + (255 - r) * 0.74), cl(g + (255 - g) * 0.76), cl(b + (255 - b) * 0.8)],
    ];
}
// zone 01 keeps the exact cyan the core always had
const CYAN: RGB[] = [[6, 32, 42], [11, 90, 107], [23, 150, 170], [47, 216, 232], [201, 251, 255]];
const MAG: RGB[] = [[43, 5, 23], [125, 15, 69], [196, 28, 108], [255, 45, 138], [255, 194, 222]];
const STEEL: RGB[] = [[12, 15, 22], [38, 44, 58], [76, 86, 108], [128, 142, 166], [204, 216, 232]];

const CH_ZONE = 0;
const CH_STEEL = 1;
const CH_STAT = 2; // + stat index
const CH_EVENT = 40; // the running zone event's colour

const GOLD: RGB[] = [[30, 18, 4], [96, 60, 10], [178, 124, 26], [255, 197, 58], [255, 242, 204]];
const MONO: RGB[] = [[10, 10, 10], [36, 36, 36], [98, 98, 96], [206, 206, 198], [244, 244, 236]];
/** zone event colours (surge, clearance, resonance, vein, fault, convoy, tune), the same as lib/nodefarm/zones/zoneevents.ts */
export const EVENT_COLORS = ["#2fd8e8", "#b6f04a", "#b46bff", "#ffc53a", "#ff5a4a", "#ffa23a", "#6bffc9", "#b46bff", "#5be37d"];

// ---- geometry, computed once

const S = CORE_S;
const N = S * S;
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => n / 16 - 0.5);
const BAYER8 = (() => {
    const m = new Float32Array(64);
    for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
            let v = 0;
            for (let bit = 0, xx = x, yy = y ^ x; bit < 3; bit++, xx >>= 1, yy >>= 1) v = (v << 2) | ((yy & 1) << 1) | (xx & 1);
            m[y * 8 + x] = (v + 0.5) / 64;
        }
    return m;
})();

let G: { dx: Float32Array; dy: Float32Array; r: Float32Array; a: Float32Array; s3: Float32Array; c3: Float32Array; s6: Float32Array; c6: Float32Array; ri: Uint8Array; bay: Float32Array; b8: Float32Array } | null = null;
function geo() {
    if (G) return G;
    const g = { dx: new Float32Array(N), dy: new Float32Array(N), r: new Float32Array(N), a: new Float32Array(N), s3: new Float32Array(N), c3: new Float32Array(N), s6: new Float32Array(N), c6: new Float32Array(N), ri: new Uint8Array(N), bay: new Float32Array(N), b8: new Float32Array(N) };
    for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
            const i = y * S + x;
            const dx = x - S / 2 + 0.5, dy = y - S / 2 + 0.5;
            const a = Math.atan2(dy, dx);
            g.dx[i] = dx; g.dy[i] = dy; g.r[i] = Math.hypot(dx, dy); g.a[i] = a;
            g.s3[i] = Math.sin(a * 3); g.c3[i] = Math.cos(a * 3);
            g.s6[i] = Math.sin(a * 6); g.c6[i] = Math.cos(a * 6); g.ri[i] = Math.min(255, Math.round(g.r[i]));
            g.bay[i] = BAYER4[(y & 3) * 4 + (x & 3)] * 0.9;
            g.b8[i] = BAYER8[(y & 7) * 8 + (x & 7)];
        }
    return (G = g);
}

// small deterministic hash so sparks and bolts need no state
const hash = (n: number) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
};
const TAU = Math.PI * 2;
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

// 3x5 glyphs for the Scripts orbit
const GLYPHS = ["{", "}", ";", ">", "$", "#"];
const FONT: Record<string, string[]> = {
    "{": [".##", ".#.", "#..", ".#.", ".##"],
    "}": ["##.", ".#.", "..#", ".#.", "##."],
    ";": ["...", ".#.", "...", ".#.", "#.."],
    ">": ["#..", ".#.", "..#", ".#.", "#.."],
    $: [".##", "##.", ".#.", ".##", "##."],
    "#": ["#.#", "###", "#.#", "###", "#.#"],
};
// a drone seen from above: rotors at the corners, a light in the middle
const DRONE = ["#...#", ".###.", ".#o#.", "#...#"];

export interface CoreRenderer {
    draw(out: Uint8ClampedArray, f: CoreFrame, t: number): void;
}

/** One renderer per canvas. `statColors` is the stat list's colours in order (zone 01 first). */
export function makeCoreRenderer(statColors: string[], eventColors: string[] = EVENT_COLORS): CoreRenderer {
    const NS = statColors.length;
    const ZR: RGB[][] = statColors.map((c, i) => (i === 0 ? CYAN : ramp(hex(c))));
    const ER: RGB[][] = eventColors.map((c) => ramp(hex(c)));
    // aurora: curtains of Aether, Pulsars, Nebula and Voidsteel
    const AUR: RGB[][] = ["#6bffc9", "#64e6ff", "#ff8ad8", "#9a7bff"].map((c) => ramp(hex(c)));
    const V = new Float32Array(N);
    const CA = new Float32Array(104), SA = new Float32Array(104), AMP = new Float32Array(104);
    // the corona turns slowly, so it is traced ten times a second and replayed in between
    const CI = new Int32Array(N), CVv = new Float32Array(N);
    let coronaN = 0, coronaT = -1, coronaHO = 0;
    const C = new Uint8Array(N);
    const g = geo();

    const put = (x: number, y: number, v: number, c: number) => {
        x = Math.round(x); y = Math.round(y);
        if (x < 0 || y < 0 || x >= S || y >= S) return;
        const i = y * S + x;
        V[i] = v; C[i] = c;
    };
    /** plot only where nothing brighter is already drawn (glows and back layers) */
    const under = (x: number, y: number, v: number, c: number) => {
        x = Math.round(x); y = Math.round(y);
        if (x < 0 || y < 0 || x >= S || y >= S) return;
        const i = y * S + x;
        if (V[i] < 0) { V[i] = v; C[i] = c; }
    };
    const line = (x0: number, y0: number, x1: number, y1: number, v: number, c: number) => {
        const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
        for (let k = 0; k <= n; k++) put(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, v, c);
    };

    /**
     * Draw a solid sprite in a rotated frame: u points out from the centre, `inside(s, q)` returns a material for the
     * point s px along u from the canvas centre and q px across it, or null for empty. Edges facing the top-left light get
     * a highlight and edges facing away a shadow, so every rotated copy is lit the same way.
     */
    // `d` marks a light: when DYN[d] is set this frame it draws as LIGHT_ON instead
    type Mat = { v: number; hi: number; lo: number; c: number; d?: number } | null;
    const MASK: Mat[] = [];
    const DYN = new Uint8Array(32);
    // A sprite's shape only changes while it builds in or the core rescales, so each one is traced once per `key` and
    // replayed from the cache: pixel index, material and edge (0 body, 1 lit edge, 2 shadow edge).
    const CACHE = new Map<string, { idx: Int32Array; mats: Mat[]; edge: Uint8Array }>();
    const solid = (key: string, ux: number, uy: number, s0: number, s1: number, q: number, inside: (s: number, q: number) => Mat) => {
        let hit = CACHE.get(key);
        if (!hit) {
            const wx = -uy, wy = ux;
            const cx = S / 2 - 0.5, cy = S / 2 - 0.5;
            let x0 = S, x1 = -1, y0 = S, y1 = -1;
            for (const s of [s0, s1])
                for (const w of [-q, q]) {
                    const px = cx + ux * s + wx * w, py = cy + uy * s + wy * w;
                    x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
                }
            x0 = Math.max(0, Math.floor(x0) - 1); x1 = Math.min(S - 1, Math.ceil(x1) + 1);
            y0 = Math.max(0, Math.floor(y0) - 1); y1 = Math.min(S - 1, Math.ceil(y1) + 1);
            const bw = x1 - x0 + 3, bh = y1 - y0 + 3;
            // one pass to find the shape (with a 1 px border), one to classify its edges
            for (let y = -1; y <= bh - 2; y++)
                for (let x = -1; x <= bw - 2; x++) {
                    const px = x0 + x - cx, py = y0 + y - cy;
                    const s = px * ux + py * uy, w = px * wx + py * wy;
                    MASK[(y + 1) * bw + x + 1] = s < s0 || s > s1 || Math.abs(w) > q ? null : inside(s, w);
                }
            const idx: number[] = [], mats: Mat[] = [], edge: number[] = [];
            for (let y = 0; y <= y1 - y0; y++)
                for (let x = 0; x <= x1 - x0; x++) {
                    const k = (y + 1) * bw + x + 1;
                    const m = MASK[k];
                    if (!m) continue;
                    idx.push((y0 + y) * S + x0 + x);
                    mats.push(m);
                    edge.push(!MASK[k - 1] || !MASK[k - bw] ? 1 : !MASK[k + 1] || !MASK[k + bw] ? 2 : 0);
                }
            if (CACHE.size > 96) CACHE.clear();
            hit = { idx: Int32Array.from(idx), mats, edge: Uint8Array.from(edge) };
            CACHE.set(key, hit);
        }
        const { idx, mats, edge } = hit;
        for (let j = 0; j < idx.length; j++) {
            let m = mats[j]!;
            if (m.d && DYN[m.d]) m = LIGHT_ON!;
            const e = edge[j];
            V[idx[j]] = e === 1 ? m.hi : e === 2 ? m.lo : m.v;
            C[idx[j]] = m.c;
        }
    };
    const mat = (v: number, hi: number, lo: number, c: number): Mat => ({ v, hi, lo, c });
    const PLATE = mat(0.5, 0.88, 0.2, CH_STEEL);
    const PLATE_D = mat(0.34, 0.6, 0.14, CH_STEEL);
    const SEAM = mat(0.14, 0.14, 0.14, CH_STEEL);
    const LIGHT_ON = mat(1, 1, 0.85, CH_ZONE);
    const LIGHT_OFF = mat(0.42, 0.52, 0.3, CH_ZONE);
    const LIGHT_DIM = mat(0.7, 0.8, 0.6, CH_ZONE);
    const MARK = mat(0.8, 0.8, 0.8, CH_ZONE);
    const PAD = mat(0.3, 0.3, 0.3, CH_STEEL);
    const DISH = mat(0.6, 0.95, 0.3, CH_STEEL);
    const RAIL = mat(0.55, 0.9, 0.28, CH_STEEL);
    const BOLT = mat(0.72, 0.95, 0.5, CH_STEEL);
    const SLOT = mat(0.16, 0.16, 0.16, CH_STEEL);
    const lightAt = (base: Mat, d: number): Mat => ({ ...base!, d });
    const CLAMP_LIGHT = [1, 2, 3, 4].map((d) => lightAt(LIGHT_OFF, d));
    const TIP_LIGHT = [5, 6].map((d) => lightAt(LIGHT_DIM, d));
    const DOCK_LIGHT = Array.from({ length: 16 }, (_, k) => lightAt(PLATE, 8 + k));

    /** A tilted ring in 3D, projected flat: a steel band with a glowing inner edge. `front` picks which half to draw. */
    const RX = new Float32Array(4096), RY = new Float32Array(4096), RV = new Float32Array(4096), RC = new Uint8Array(4096);
    let rn = 0;
    /** draw the front halves the back pass kept */
    const ringFront = () => {
        for (let j = 0; j < rn; j++) put(RX[j], RY[j], RV[j], RC[j]);
        rn = 0;
    };
    const ring = (R: number, tilt: number, spin: number, roll: number, t: number, beads: number, grow: number) => {
        const ct = Math.cos(tilt), st = Math.sin(tilt), cs = Math.cos(spin), ss = Math.sin(spin), cr = Math.cos(roll), sr = Math.sin(roll);
        const steps = Math.ceil(R * 6.5);
        const cx = S / 2 - 0.5, cy = S / 2 - 0.5;
        const span = TAU * grow;
        for (let k = 0; k < steps; k++) {
            const th = (k / steps) * TAU;
            if (th > span) break;
            const cth = Math.cos(th), sth = Math.sin(th);
            let bead = false;
            for (let b = 0; b < beads; b++) {
                const bt = ((((t * 0.5 + b / beads) % 1) + 1) % 1) * TAU;
                let d = Math.abs(th - bt);
                if (d > Math.PI) d = TAU - d;
                if (d < 0.06) bead = true;
            }
            for (let layer = 0; layer < 3; layer++) {
                const rr = R - layer * 1.1;
                const x = rr * cth, y0 = rr * sth;
                const y = y0 * ct, z = y0 * st;
                const x2 = x * cs + z * ss, z2 = -x * ss + z * cs;
                const front = z2 >= 0;
                const px = x2 * cr - y * sr, py = x2 * sr + y * cr;
                // the side of the ring facing up-left catches the light
                const lit = 0.5 - 0.5 * ((px / R) * 0.6 + (py / R) * 0.8);
                let v: number, c: number;
                if (layer < 2) { v = front ? (layer === 0 ? 0.3 + lit * 0.66 : 0.24 + lit * 0.4) : 0.14 + lit * 0.16; c = CH_STEEL; }
                else { v = front ? 0.55 + lit * 0.3 : 0.22; c = CH_ZONE; }
                if (bead) { v = front ? 1 : 0.5; c = CH_ZONE; }
                if (front) {
                    if (rn < 4096) { RX[rn] = cx + px; RY[rn] = cy + py; RV[rn] = v; RC[rn++] = c; }
                } else put(cx + px, cy + py, v, c);
            }
        }
    };

    // how much the radial core shrinks to make room, by number of parts built
    const KS = [1, 0.95, 0.9, 0.87, 0.85, 0.82, 0.8, 0.79, 0.78, 0.77, 0.77, 0.77, 0.77, 0.77];

    return {
        draw(out, f, t) {
            V.fill(-1);
            rn = 0;
            const has = (p: PartId) => (f.parts & PART[p]) !== 0;
            const bd = (p: PartId) => (has(p) ? f.build[PART_ORDER.indexOf(p)] ?? 1 : 0);
            const cx = S / 2 - 0.5, cy = S / 2 - 0.5;
            // the core pulls back to make room as structures bolt on (smoothly, while a part builds in)
            let n = 0;
            for (const p of PART_ORDER) n += smooth(bd(p));
            const K = KS[Math.floor(n)] + (KS[Math.min(KS.length - 1, Math.floor(n) + 1)] - KS[Math.floor(n)]) * (n - Math.floor(n));
            const iK = 1 / K;
            const HO = 70 * K; // outer edge of the halo
            const pulse = f.pulse;
            const spin = t * (0.25 + f.speed * 0.9);
            const stage = f.unlocked >= 6 ? 2 : f.unlocked >= 4 ? 1 : 0;
            const sides = stage === 1 ? 8 : 6;
            const seg = TAU / sides;
            const spokes = Math.min(8, Math.floor(Math.log2(1 + f.reboots)));
            const lit = Math.min(24, f.ap);
            const ct = Math.cos(t), st = Math.sin(t);
            const diag = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => [x / Math.SQRT2, y / Math.SQRT2]);
            const cu = CH_STAT + Math.min(3, NS - 1); // Copper's colours

            // ---- corona (Origin arc): thin slow rays behind everything, past the halo
            const corona = bd("corona");
            if (corona > 0 && (t - coronaT > 0.1 || t < coronaT || Math.abs(HO - coronaHO) > 0.05)) {
                coronaT = t;
                coronaHO = HO;
                coronaN = 0;
                const cs = smooth(corona);
                // the ray phase and flicker only depend on the radius, so they are tabled per frame
                const rot = 6 * t * 0.035;
                for (let r = 0; r < 104; r++) {
                    const ph = rot + Math.sin(r * 0.06 - t * 0.5) * 0.35;
                    const fall = Math.max(0, 1 - (r - HO) / (104 - HO));
                    CA[r] = Math.cos(ph); SA[r] = Math.sin(ph);
                    AMP[r] = fall * fall * cs * (0.85 + 0.15 * Math.sin(t * 2.2 + r * 0.2));
                }
                for (let i = 0; i < N; i++) {
                    if (g.r[i] < HO + 1) continue;
                    const ri = g.ri[i];
                    if (ri >= 104) continue;
                    // six narrow rays turning slowly, combed into fine streaks, and a thin glow hugging the halo. The dark
                    // between the rays stays dark, so the structures in front read cleanly.
                    const ray = g.c6[i] * CA[ri] - g.s6[i] * SA[ri];
                    const core = ray > 0.7 ? (ray - 0.7) / 0.3 : 0;
                    const glow = ri < HO + 9 ? (HO + 9 - ri) / 9 : 0;
                    if (core === 0 && glow === 0) continue;
                    const streak = 0.55 + 0.45 * Math.sin(g.a[i] * 56 + ri * 0.18 - t * 1.4);
                    const v = (core * core * streak * 1.25 + glow * glow * 0.3) * AMP[ri];
                    if (v + g.bay[i] * 0.4 > 0.3) { CI[coronaN] = i; CVv[coronaN++] = 0.1 + v * 0.5; }
                }
            }
            if (corona > 0) for (let j = 0; j < coronaN; j++) { V[CI[j]] = CVv[j]; C[CI[j]] = CH_ZONE; }

            // ---- basalt crust (Descent): jagged rock along the bottom edge between the docks, magma glowing in its cracks,
            // embers rising; geodes sprout crystals on it once they open
            const crust = bd("crust");
            const stat = (k: number) => CH_STAT + Math.min(k, NS - 1);
            if (crust > 0) {
                const cg = smooth(crust);
                const basalt = stat(21), magma = stat(22), geode = stat(23);
                for (let x = 28; x < S - 28; x++) {
                    const h = Math.round((3 + hash(x * 0.37) * 3 + hash(Math.floor(x / 6) + 0.5) * 5) * cg);
                    const crack = hash(Math.floor(x / 2) * 1.7 + 3) > 0.72;
                    for (let d = 0; d < h; d++) {
                        const y = S - 2 - d;
                        if (crack && d < h - 1 && d > 0) put(x, y, 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(t * 2.3 + x * 0.5)), magma);
                        else put(x, y, d === h - 1 ? 0.7 : d === h - 2 ? 0.5 : 0.28, basalt);
                    }
                    // crystals on the rock once Geodes are open
                    if (f.unlocked >= 24 && x % 11 === 4 && cg >= 1) for (let d = 0; d < 4; d++) { put(x, S - 2 - h - d, 0.7 + d * 0.08, geode); if (d < 2) put(x + 1, S - 2 - h - d, 0.5, geode); }
                    // embers
                    if (crack && cg >= 1) {
                        const ph = (t * (0.4 + hash(x) * 0.3) + hash(x + 9)) % 1;
                        under(x + Math.round(Math.sin(t * 3 + x) * ph * 2), S - 2 - h - Math.round(ph * 22), 1 - ph * 0.7, magma);
                    }
                }
            }

            // ---- copper socket: a trace frame round the edge, corner brackets, packets running clockwise, and four
            // capacitor banks at the edge midpoints that charge with the Reboot gauge
            const sock = bd("socket");
            if (sock > 0) {
                const sg = smooth(sock);
                const lo = 2, hi = S - 3, len = hi - lo;
                const perim = len * 4;
                const at = (d: number): [number, number] => {
                    d = ((d % perim) + perim) % perim;
                    if (d < len) return [lo + d, lo];
                    if (d < len * 2) return [hi, lo + d - len];
                    if (d < len * 3) return [hi - (d - len * 2), hi];
                    return [lo, hi - (d - len * 3)];
                };
                for (let d = 0; d < perim * sg; d++) {
                    const [x, y] = at(d);
                    put(x, y, 0.45, cu);
                    if (d % 5 === 0) {
                        const ix = x === lo ? 1 : x === hi ? -1 : 0, iy = y === lo ? 1 : y === hi ? -1 : 0;
                        for (let k = 1; k <= 2; k++) if (Math.hypot(x + ix * k - cx, y + iy * k - cy) > HO + 3) under(x + ix * k, y + iy * k, 0.28, cu);
                    }
                }
                for (const [sx, sy] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
                    const ox = sx ? S - 1 : 0, oy = sy ? S - 1 : 0, mx = sx ? -1 : 1, my = sy ? -1 : 1;
                    for (let k = 0; k < 14 * sg; k++) { put(ox + mx * k, oy, 0.95, cu); put(ox, oy + my * k, 0.95, cu); put(ox + mx * k, oy + my, 0.55, cu); put(ox + mx, oy + my * k, 0.55, cu); }
                }
                // capacitor banks: three cans per edge, standing on the frame and pointing at the core
                const room = 72 - HO - 3;
                if (room >= 4) {
                    const hgt = Math.min(9, room) * sg;
                    const fill = Math.round(f.progress * 20) / 20;
                    for (const [ux, uy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                        const sEdge = 69, sTop = sEdge - hgt;
                        solid(`cap${ux},${uy}|${sTop.toFixed(2)}|${fill}`, ux, uy, sTop, sEdge, 10, (s, q) => {
                            const can = Math.round(q / 6.5);
                            if (Math.abs(can) > 1) return null;
                            const lq = q - can * 6.5;
                            if (Math.abs(lq) > 2.6) return null;
                            const h = (sEdge - s) / Math.max(1, hgt); // 0 at the base, 1 at the top
                            if (h > 0.82) return Math.abs(lq) < 1.6 ? mat(0.9, 1, 0.7, cu) : PLATE; // contact cap
                            if (Math.abs(lq) < 1.1 && h < 0.78) return h < fill * 0.78 ? LIGHT_ON : SLOT; // charge window
                            return mat(0.42, 0.78, 0.2, cu);
                        });
                    }
                }
                if (sock >= 1) {
                    const np = 3 + Math.round(f.speed * 5);
                    for (let k = 0; k < np; k++) {
                        const d = t * (34 + f.speed * 60) + (k / np) * perim;
                        const [x, y] = at(d);
                        put(x, y, 1, CH_ZONE);
                        const [x2, y2] = at(d - 1);
                        put(x2, y2, 0.75, CH_ZONE);
                        const [x3, y3] = at(d - 2);
                        put(x3, y3, 0.45, CH_ZONE);
                    }
                }
            }

            // ---- vines (Overgrowth): runners creep round the frame, leaves stir, and buds open in pollen and bloom colours
            const vine = bd("vines");
            if (vine > 0) {
                const sporeC = stat(17), mycC = stat(18), pollenC = stat(19), bloomC = stat(20);
                const lo = 2, hi = S - 3, len = hi - lo, perim = len * 4;
                const shown = perim * smooth(vine);
                const at = (d: number): [number, number, number, number] => {
                    // position on the frame plus the inward direction
                    if (d < len) return [lo + d, lo, 0, 1];
                    if (d < len * 2) return [hi, lo + d - len, -1, 0];
                    if (d < len * 3) return [hi - (d - len * 2), hi, 0, -1];
                    return [lo, hi - (d - len * 3), 1, 0];
                };
                for (let d = 0; d < shown; d++) {
                    // two runners twisting round each other along the frame, starting from the bottom left corner
                    const dd = (d + len * 3) % perim;
                    const [x, y, ix, iy] = at(dd);
                    const off = 1.5 + Math.sin(d * 0.21) * 1.5;
                    under(x + ix * off, y + iy * off, 0.6, mycC);
                    under(x + ix * (off + 1), y + iy * (off + 1), 0.35, mycC);
                    const off2 = 1.5 + Math.sin(d * 0.21 + Math.PI) * 1.5;
                    if (d % 3) under(x + ix * off2, y + iy * off2, 0.5, sporeC);
                    if (d % 6 === 3) {
                        const sway = Math.floor(t * 1.5 + d * 0.3) % 3 - 1;
                        const lx = x + ix * (off + 2) + iy * sway, ly = y + iy * (off + 2) + ix * sway;
                        put(lx, ly, 0.85, sporeC); put(lx + iy, ly + ix, 0.6, sporeC); put(lx + ix, ly + iy, 0.7, sporeC);
                    }
                    if (vine >= 1 && d % 17 === 8 && f.unlocked >= 19) {
                        const bc = f.unlocked >= 21 && d % 2 ? bloomC : pollenC;
                        const fx = x + ix * (off + 2.5), fy = y + iy * (off + 2.5);
                        const open = 0.6 + 0.4 * Math.sin(t * 1.2 + d);
                        put(fx, fy, 1, pollenC);
                        put(fx + 1, fy, open, bc); put(fx - 1, fy, open, bc); put(fx, fy + 1, open, bc); put(fx, fy - 1, open, bc);
                    }
                }
            }

            // ---- masts (Exploit Lab): lattice towers in the top corners with a dish, sending
            const mast = bd("masts");
            if (mast > 0) {
                const base = HO + 12, tipMax = 98;
                for (const di of [0, 1]) {
                    const [ux, uy] = diag[di];
                    const top = base + (tipMax - base) * smooth(mast);
                    DYN[5 + di] = Math.floor(t * 2 + di) % 2;
                    solid(`mast${di}|${base.toFixed(2)}|${top.toFixed(2)}`, ux, uy, base, tipMax + 1, 8, (s, q) => {
                        if (s > top) return null;
                        const aq = Math.abs(q);
                        const u = s - base;
                        const taper = 4.2 - (u / (tipMax - base)) * 2.2; // the tower narrows toward the top
                        // dish: a shallow cup at the top, open toward the corner
                        const ds = top - s;
                        if (ds < 6 && ds > 1 && aq < 7 && Math.abs(ds - 1.2 - (aq * aq) / 12) < 0.9) return DISH;
                        if (ds <= 2.5 && aq < 1.3) return TIP_LIGHT[di];
                        if (u < 3) return aq < 6 ? PLATE : null; // foot
                        if (ds < 4) return null;
                        if (Math.abs(aq - taper) < 0.75) return RAIL; // rails
                        if (aq < taper && Math.abs(((u + (q > 0 ? 0 : 2.5)) % 5) - 2.5) < 0.6) return PLATE_D; // braces
                        return null;
                    });
                    if (mast >= 1) {
                        // signal rings leave the dish sideways, along the top and side edges
                        const tx = cx + ux * (top - 3), ty = cy + uy * (top - 3);
                        const ang0 = Math.atan2(uy, ux);
                        for (let w = 0; w < 3; w++) {
                            const ph = (t * 0.6 + w / 3 + di * 0.17) % 1;
                            const rr = 3 + ph * 16;
                            const v = 0.95 * (1 - ph);
                            if (v < 0.2) continue;
                            for (const side of [-1, 1])
                                for (let k = -6; k <= 6; k++) {
                                    const ang = ang0 + side * (Math.PI / 2 + 0.25) + (k / 6) * 0.55;
                                    under(tx + Math.cos(ang) * rr, ty + Math.sin(ang) * rr, v, CH_ZONE);
                                }
                        }
                    }
                }
            }

            // ---- drone docks (first Drone): octagonal pads in the bottom corners with chasing lights
            const dock = bd("docks");
            if (dock > 0)
                for (const di of [2, 3]) {
                    const [ux, uy] = diag[di];
                    const r0 = Math.min(12, (98 - HO - 12) / 2);
                    const pc = HO + 12 + r0;
                    const pr = r0 * smooth(dock);
                    // a strut from the clamp to the pad
                    for (let k = 0; k < 8; k++) DYN[8 + (di - 2) * 8 + k] = Math.floor(t * 6 + di * 4) % 8 === k ? 1 : 0;
                    solid(`strut${di}|${HO.toFixed(2)}|${pr.toFixed(2)}`, ux, uy, HO + 9, pc - pr + 1, 2.5, (_s, q) => (Math.abs(q) < 1.6 ? PLATE_D : null));
                    solid(`pad${di}|${pc.toFixed(2)}|${pr.toFixed(2)}`, ux, uy, pc - pr - 1, pc + pr + 1, pr + 1, (s, q) => {
                        const ds = s - pc;
                        const d = Math.hypot(ds, q);
                        if (d > pr || Math.abs(ds) + Math.abs(q) > pr * 1.3) return null;
                        if (d > pr - 2) {
                            const k = Math.floor(((Math.atan2(q, ds) + Math.PI) / TAU) * 8);
                            return DOCK_LIGHT[(di - 2) * 8 + k];
                        }
                        if (d > pr - 3) return SEAM;
                        // an H on the pad
                        const sx = Math.abs(ds), sq = Math.abs(q);
                        if (sx < 3.6 && Math.abs(sq - 2.6) < 0.7) return MARK;
                        if (sx < 0.7 && sq < 2.6) return MARK;
                        return PAD;
                    });
                }

            // ---- back halves of the gyro rings: part, radius past the halo, tilt, spin speed, roll, beads
            const rings: [PartId, number, number, number, number, number][] = [
                ["ring1", 7, 1.2, 0.3, -0.42, 3],
                ["ring2", 11, 1.34, -0.22, 0.6, 2],
                ["ring3", 15, 1.08, 0.16, 1.5, 4],
            ];
            for (const [p, dr, tilt, w, roll, beads] of rings) {
                const b = bd(p);
                if (b > 0) ring(HO + dr, tilt, t * w + roll * 2, roll, t, beads, smooth(b));
            }

            // ---- sparks falling into the core
            const ev = f.event;
            const spCh = ev === 1 || ev === 4 ? CH_EVENT : CH_ZONE; // a surge or a rich vein colours the sparks
            const ns = 5 + Math.round(f.speed * 14) + (ev === 1 ? 10 : ev === 4 ? 6 : 0) + Math.round(f.flare * 16);
            const spd = ev === 1 ? 2 : 1;
            for (let k = 0; k < ns; k++) {
                const ph = (t * (0.22 + hash(k) * 0.2) * spd + hash(k + 40)) % 1;
                const r = (74 - ph * 36) * K;
                const ang = hash(k + 80) * TAU + ph * 1.6;
                const v = 0.45 + ph * 0.55;
                under(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, v, spCh);
                under(cx + Math.cos(ang - 0.05) * (r + 2), cy + Math.sin(ang - 0.05) * (r + 2), v * 0.5, spCh);
            }

            // ---- code glyphs (Scripts), back half: on a flat orbit just past the halo
            const gl = bd("glyphs");
            const glyph = (front: boolean) => {
                if (gl <= 0 || f.glyphs <= 0) return;
                const n = Math.min(6, f.glyphs);
                for (let k = 0; k < n; k++) {
                    const th = t * 0.4 + (k / n) * TAU;
                    const z = Math.sin(th);
                    if (z >= 0 !== front) continue;
                    const x = Math.cos(th) * (HO + 4), y = z * (HO + 4) * 0.34 + 6;
                    const fnt = FONT[GLYPHS[k % GLYPHS.length]];
                    const v = front ? 0.7 + 0.3 * z : 0.4;
                    for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 3; gx++) if (fnt[gy][gx] === "#") put(cx + x + gx - 1, cy + y + gy - 2, v * smooth(gl), CH_ZONE);
                }
            };
            glyph(false);

            // ---- the radial core (the original design, lit as a dome and scaled by K)
            const nodes: number[] = [];
            for (let k = 2; k < f.unlocked; k++) {
                const na = t * (0.5 + k * 0.17) * (k % 2 ? 1 : -1) + k * 1.7;
                nodes.push(Math.cos(na) * 45, Math.sin(na) * 45, k % NS);
            }
            const pr = 14 + (1 - pulse) * 50;
            const fl = f.flare;
            // Handover shell: a slow twelve-sided cage between the body and the tick ring, one facet lit per twelfth of the Firmware
            const shell = bd("shell");
            const shSeg = TAU / 12, shRot = t * 0.06, shLit = Math.round(f.fw * 12), shR = 47.4 - (1 - smooth(shell)) * 8;
            // events: surge rings out from the centre, clearance sweeps like radar, resonance wobbles a ring, fault flickers the rim
            const evPr = 14 + ((t * 1.1) % 1) * 52;
            const sweep = (t * 2.4) % TAU;
            const faultOn = ev === 5 && Math.floor(t * 9) % 3 === 0;
            for (let i = 0; i < N; i++) {
                const r = g.r[i] * iK;
                if (r >= 70) continue;
                const dx = g.dx[i] * iK, dy = g.dy[i] * iK, a = g.a[i];
                let v = -1;
                let c = CH_ZONE;
                if (r < 46) {
                    let hx: number;
                    if (stage === 2) hx = (r * 40) / (40 * (0.74 + 0.26 * Math.cos(8 * (a + t * 0.12))) + 0.001);
                    else {
                        const m = (((a + (stage === 1 ? t * 0.04 : 0)) % seg) + seg) % seg;
                        hx = (r * Math.cos(m - seg / 2)) / Math.cos(seg / 2);
                    }
                    if (hx < 40) {
                        const plasma = 0.5 + 0.5 * Math.sin(r * 0.28 - t * 2.4 + (g.s3[i] * ct + g.c3[i] * st) * 1.2);
                        v = 0.18 + plasma * (0.42 + f.progress * 0.28) + (1 - r / 52) * 0.22;
                        // dome light from the top left, with a small glint
                        const nx = dx / 44, ny = dy / 44, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
                        v *= 0.62 + 0.48 * (-0.5 * nx - 0.55 * ny + 0.67 * nz);
                        if ((dx + 15) * (dx + 15) + (dy + 16) * (dy + 16) < 17) v = Math.max(v, 0.92);
                        v += fl * 0.3;
                        if (hx > 36) { v = 0.74 + 0.36 * Math.max(0, -0.7 * (dx + dy) / r); if (faultOn) c = CH_EVENT; } // rim, brighter on the lit side
                        else if (hx > 33) v = 0.1;
                        if (stage >= 1 && r > 17 && r < 21 && Math.sin(a * 6 - t * 1.6) > -0.2) v = 0.85; // inner rotor
                        if (spokes > 0 && r < 24 && r > 6) {
                            const sp = ((a - t * 0.35) / TAU) * spokes;
                            if (Math.abs(sp - Math.round(sp)) * (r / 4) < 0.5) v = Math.max(v, 0.88);
                        }
                        if (r < 9) v = 0.97 - r * 0.012; // hot centre
                    } else {
                        // dithered glow round the body
                        const glow = (1 - (hx - 40) / 6) * (0.32 + 0.08 * Math.sin(t * 2.2 + a * 3));
                        if (glow + g.bay[i] * 0.55 > 0.2) v = 0.16;
                    }
                }
                // rotating tick ring
                if (r > 50 && r < 58) {
                    const k = ((a + spin) / TAU) * 36;
                    if (k - Math.floor(k) < 0.38) {
                        v = r > 55 ? 0.95 : 0.55;
                        const si = Math.floor(((a + Math.PI) / TAU) * NS) % NS;
                        if (si < f.unlocked) c = CH_STAT + si;
                    }
                }
                // Reboot progress arc
                if (r > 61 && r < 64) {
                    const ang = (a + Math.PI / 2 + TAU) % TAU;
                    if (ang < f.progress * TAU) v = 0.95;
                    else if (((g.dx[i] + g.dy[i] + 1) & 1) === 0) v = 0.2;
                }
                // orbiting nodes, one per stat past the second
                if (r > 40 && r < 50)
                    for (let q = 0; q < nodes.length; q += 3) {
                        const ex = dx - nodes[q], ey = dy - nodes[q + 1];
                        const d2 = ex * ex + ey * ey;
                        if (d2 < 6.76) { v = d2 < 1.6 ? 1 : 0.8; c = CH_STAT + nodes[q + 2]; }
                    }
                // ascension halo
                if (r > 66) {
                    const hseg = (((a + Math.PI) / TAU) * 24 + t * 0.4) % 24;
                    const si = Math.floor((hseg + 24) % 24);
                    if ((hseg + 24) % 1 < 0.8) v = si < lit ? 0.95 : 0.22;
                }
                if (shell > 0 && r > 45 && r < 50) {
                    const m = (((a - shRot) % shSeg) + shSeg) % shSeg;
                    const hx12 = (r * Math.cos(m - shSeg / 2)) / Math.cos(shSeg / 2);
                    if (Math.abs(hx12 - shR) < 0.75) {
                        const fi = Math.floor((((a - shRot) % TAU) + TAU) % TAU / shSeg);
                        const corner = Math.abs(m - shSeg / 2) > shSeg * 0.42;
                        if (corner) { v = 0.9; c = CH_STEEL; }
                        else if (fi < shLit) { v = 0.82 + 0.15 * Math.sin(t * 3 + fi); c = CH_ZONE; }
                        else { v = 0.3; c = CH_STEEL; }
                    }
                }
                if (ev === 1 && Math.abs(r - evPr) < 1.1) { v = 0.85; c = CH_EVENT; }
                else if (ev === 2 && v < 0.3 && r > 38) {
                    let d = sweep - ((a + TAU) % TAU);
                    if (d < 0) d += TAU;
                    if (d < 0.9 && 0.75 - d + g.bay[i] * 0.5 > 0.25) { v = d < 0.06 ? 1 : 0.7 - d * 0.5; c = CH_EVENT; }
                } else if (ev === 3 && ((r > 41 && r < 49) || (r > 61 && r < 68))) {
                    const rr = 45 + Math.sin(a * 5 + t * 4) * 2.6, rr2 = 64.5 + Math.sin(a * 7 - t * 3) * 2;
                    if (Math.abs(r - rr) < 1.1 || Math.abs(r - rr2) < 0.8) { v = 0.9; c = CH_EVENT; }
                } else if (ev === 4 && r > 66 && hash(Math.floor(t * 3) * 31 + Math.floor((a + Math.PI) * 4)) > 0.72) { v = 1; c = CH_EVENT; }
                if (pulse > 0 && Math.abs(r - pr) < 1.6) { v = Math.max(v, 0.5 + pulse * 0.5); c = CH_STAT + (f.pulseStat % NS); }
                if (v >= 0) { V[i] = v; C[i] = c; }
            }

            // ---- clamps (first Reboot): four steel clamps biting the halo, each with a status light
            const clamp = bd("clamps");
            if (clamp > 0) {
                const s0 = HO - 7, s1 = HO + 11;
                const grow = smooth(clamp);
                for (let di = 0; di < 4; di++) {
                    const [ux, uy] = diag[di];
                    DYN[1 + di] = Math.floor(t * 1.5 + di * 0.75) % 4 === 0 || pulse > 0.6 ? 1 : 0;
                    solid(`clamp${di}|${s0.toFixed(2)}|${grow.toFixed(3)}`, ux, uy, s0, s1, 8, (s, q) => {
                        const u = s1 - s, aq = Math.abs(q); // u: from the outer end inward
                        if (u > 18 * grow) return null;
                        if (u > 11) return aq > 2.2 && aq < 6 - (u - 11) * 0.3 ? PLATE : null; // jaws over the halo
                        if (aq < 7.5 - Math.max(0, 3 - u) * 1.2) {
                            if (u > 4 && u < 7 && aq < 1.6) return CLAMP_LIGHT[di];
                            if (Math.abs(aq - 4.6) < 0.6 && u > 2) return SEAM; // panel seams
                            if (u < 2.2 && Math.abs(aq - 4.6) < 1.2) return BOLT; // bolts
                            return PLATE;
                        }
                        return null;
                    });
                }
                // now and then a bolt jumps from the body to a clamp
                if (clamp >= 1) {
                    const period = 2.6 - f.speed * 1.2;
                    const nb = Math.floor(t / period);
                    if (t / period - nb < 0.09 || pulse > 0.85) {
                        const [ux, uy] = diag[Math.floor(hash(nb + 7) * 4)];
                        const wx = -uy, wy = ux;
                        let px = cx + ux * 37 * K, py = cy + uy * 37 * K;
                        const steps = 9;
                        for (let k = 1; k <= steps; k++) {
                            const s = 37 * K + ((HO - 6 - 37 * K) * k) / steps;
                            const j = k === steps ? 0 : (hash(nb * 13 + k + Math.floor(t * 20)) - 0.5) * 7 * Math.sin((k / steps) * Math.PI);
                            const nx = cx + ux * s + wx * j, ny = cy + uy * s + wy * j;
                            line(px, py, nx, ny, 1, CH_ZONE);
                            px = nx; py = ny;
                        }
                    }
                }
            }

            // ---- front halves of the rings, then the front of the glyph orbit
            ringFront();
            glyph(true);

            // ---- drones (one per owned tier, up to four) circling low between the docks
            if (dock >= 1 && f.drones > 0) {
                const n = Math.min(4, f.drones);
                const R = HO + 10;
                for (let k = 0; k < n; k++) {
                    const th = t * (0.45 + k * 0.06) + (k / n) * TAU;
                    const z = Math.sin(th);
                    const x = Math.cos(th) * R, y = z * R * 0.3 + R * 0.55 + Math.sin(t * 2 + k) * 1.5;
                    if (z < 0 && Math.abs(x) < 40 * K) continue; // behind the core
                    const on = Math.floor(t * 4 + k) % 2 === 0;
                    for (let gy = 0; gy < 4; gy++)
                        for (let gx = 0; gx < 5; gx++) {
                            const ch = DRONE[gy][gx];
                            if (ch === ".") continue;
                            put(cx + x + gx - 2, cy + y + gy - 2, ch === "o" ? (on ? 1 : 0.5) : gy === 0 ? 0.85 : 0.6, ch === "o" ? CH_ZONE : CH_STEEL);
                        }
                }
            }

            // ---- rig rack: a pod on the frame per zone, lit in the zone's colour once its rig has a level
            const rack = bd("rigs");
            if (rack > 0) {
                const slots = [26, 36, 46, 56, 88, 98, 108, 118];
                const n = Math.min(f.unlocked, NS, Math.ceil(NS * smooth(rack)));
                for (let z = 0; z < n; z++) {
                    const edge = Math.floor(z / 8) % 4, u = slots[z % 8];
                    // pod 7 along the edge, 4 deep, standing on the frame
                    for (let a = -3; a <= 3; a++)
                        for (let d = 0; d < 4; d++) {
                            const x = edge === 0 ? u + a : edge === 1 ? S - 4 - d : edge === 2 ? S - 1 - u - a : 3 + d;
                            const y = edge === 0 ? 3 + d : edge === 1 ? u + a : edge === 2 ? S - 4 - d : S - 1 - u - a;
                            const lv = f.rigs[z] ?? 0;
                            const rim = Math.abs(a) === 3 || d === 0 || d === 3;
                            if (rim) put(x, y, d === 0 || a === -3 ? 0.78 : 0.3, CH_STEEL);
                            else if (lv > 0) put(x, y, Math.min(1, 0.55 + lv * 0.08 + (Math.floor(t * 2 + z) % 5 === a + 2 ? 0.3 : 0)), CH_STAT + z);
                            else put(x, y, 0.12, CH_STEEL);
                        }
                }
            }

            // ---- flare: a shockwave rolls out past the halo when a milestone or unlock lands
            if (fl > 0) {
                const fr = HO + (1 - fl) * 34;
                const steps = Math.ceil(fr * 6.4);
                for (let k = 0; k < steps; k++) {
                    const th = (k / steps) * TAU;
                    put(cx + Math.cos(th) * fr, cy + Math.sin(th) * fr, 0.35 + fl * 0.65, CH_ZONE);
                    if (fl > 0.4) under(cx + Math.cos(th) * (fr - 2), cy + Math.sin(th) * (fr - 2), fl * 0.5, CH_ZONE);
                }
            }

            // ---- fault: a few rows slip sideways, like a bad signal
            if (ev === 5) {
                const tick = Math.floor(t * 12);
                for (let y = 0; y < S; y++) {
                    if (hash(tick * 7 + Math.floor(y / 3)) < 0.9) continue;
                    const sh = Math.round((hash(tick + y) - 0.5) * 10);
                    if (!sh) continue;
                    const row = y * S;
                    if (sh > 0) for (let x = S - 1; x >= sh; x--) { V[row + x] = V[row + x - sh]; C[row + x] = C[row + x - sh]; }
                    else for (let x = 0; x < S + sh; x++) { V[row + x] = V[row + x - sh]; C[row + x] = C[row + x - sh]; }
                }
            }

            // ---- palette pass
            const nz = Math.max(1, Math.min(NS, f.unlocked));
            for (let i = 0; i < N; i++) {
                const o = i * 4;
                const v = V[i];
                if (v < 0) { out[o + 3] = 0; continue; }
                const idx = Math.max(0, Math.min(4, Math.floor(v * 4 + 0.5 + g.bay[i])));
                const ch = C[i];
                let col: RGB;
                if (ch === CH_EVENT) col = ER[(f.event - 1) % ER.length][idx];
                else if (f.skin === 4) col = MONO[idx]; // mono: the whole machine in the site's 1-bit off-white
                else if (ch === CH_STEEL) col = STEEL[idx];
                else if (f.overclock) col = MAG[idx];
                else if (ch >= CH_STAT) col = ZR[(ch - CH_STAT) % NS][idx];
                else if (f.skin === 2) {
                    // aurora: slow curtains that hang down the core and drift sideways
                    const x = i % S, y = (i / S) | 0;
                    const b = ((y * 0.03 + Math.sin(x * 0.07 + t * 0.5) * 0.7 + t * 0.1) % 4 + 4) % 4;
                    col = AUR[(Math.floor(b) + (b - Math.floor(b) > 0.75 + g.b8[i] * 0.25 ? 1 : 0)) % 4][idx];
                } else if (f.skin === 3) {
                    // gold, with a glint that slides across now and then
                    const x = i % S, y = (i / S) | 0;
                    const gl = ((x + y - t * 70) % 260 + 260) % 260;
                    col = GOLD[Math.min(4, idx + (gl < 7 ? 1 : 0))];
                } else if (f.skin === 1) {
                    // chroma: swirling bands of every unlocked zone's colours, dithered where they meet
                    const b = (((g.a[i] / TAU + 0.5) * Math.min(nz, 6) - t * 0.35 + g.r[i] * 0.03) % nz + nz) % nz;
                    const z = (Math.floor(b) + (b - Math.floor(b) > 0.78 + g.b8[i] * 0.22 ? 1 : 0)) % nz;
                    col = ZR[z][idx];
                } else col = ZR[(f.zoneMix >= 1 || g.b8[i] < f.zoneMix ? f.zone : f.prevZone) % NS][idx];
                out[o] = col[0]; out[o + 1] = col[1]; out[o + 2] = col[2]; out[o + 3] = 255;
            }
        },
    };
}
