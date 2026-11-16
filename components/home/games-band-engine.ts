// Renderer for the animated band behind the homepage Play section (see games-band.tsx for when it loads).
//
// The band is one low-resolution canvas scaled up with crisp pixels. It is split into one zone per game card: each
// pixel belongs to the card whose centre is nearest, and the seams between zones cross-fade with an 8x8 Bayer dither,
// the same dither the sprites use. Each zone paints its game's scene: a static backdrop drawn once per layout, then
// sprites and effects at 12 frames a second. Layout reruns only when the section changes size.
// Art: public/home/band/<game>.webp, drawn by scripts/home-band/generate.py. Frame rectangles: band-atlas.ts.

import { BAND_ATLAS } from "./band-atlas";

type Game = keyof typeof BAND_ATLAS;
type Rect = { x: number; y: number; w: number; h: number };
type Ctx = CanvasRenderingContext2D;
type RGB = [number, number, number];

const FPS = 12;
const SEAM = 26; // width of the dithered cross-fade between zones, in art pixels
const SHEET_VERSION = "1";

const BAYER = [
    0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11,
    43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
].map((v) => (v + 0.5) / 64);
const bay = (x: number, y: number) => BAYER[(y & 7) * 8 + (x & 7)];

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const ramp = (...hs: string[]) => hs.map(hex);

function rng(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const hash = (x: number, y: number) => {
    const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return v - Math.floor(v);
};
function vnoise(x: number, y: number) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x: number, y: number) => vnoise(x, y) * 0.5 + vnoise(x * 2.03 + 17, y * 2.03 + 9) * 0.3 + vnoise(x * 4.1 + 41, y * 4.1 + 23) * 0.2;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** One zone of the band: its card, the area it owns, and its canvases. */
type Zone = {
    game: Game;
    card: Rect;
    /** First row this zone owns above its card (the visible strip above the card starts here). */
    top: number;
    bbox: Rect;
    band: { w: number; h: number };
    mask: HTMLCanvasElement;
    buf: HTMLCanvasElement;
    back: HTMLCanvasElement;
    front: HTMLCanvasElement;
    seed: number;
    state: Record<string, unknown>;
};

type Scene = {
    /** Paint the still parts onto the back (behind moving sprites) and front (in front of them) layers. */
    paint(z: Zone, back: Ctx, front: Ctx, img: HTMLImageElement): void;
    /** Draw tick `t`: `under` runs before the front layer is laid on, `over` after it. */
    under?(z: Zone, c: Ctx, t: number, img: HTMLImageElement): void;
    over?(z: Zone, c: Ctx, t: number, img: HTMLImageElement): void;
};

// ---- drawing helpers (all coordinates in band art pixels) -------------------------------------------------------------
function spr(c: Ctx, img: HTMLImageElement, game: Game, name: string, frame: number, x: number, y: number, flip = false) {
    const frames = (BAND_ATLAS[game] as Record<string, readonly (readonly number[])[]>)[name];
    const f = frames[((frame % frames.length) + frames.length) % frames.length];
    const dx = Math.round(x), dy = Math.round(y);
    if (!flip) {
        c.drawImage(img, f[0], f[1], f[2], f[3], dx, dy, f[2], f[3]);
        return;
    }
    c.save();
    c.translate(dx + f[2], dy);
    c.scale(-1, 1);
    c.drawImage(img, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
    c.restore();
}
const size = (game: Game, name: string) => {
    const f = (BAND_ATLAS[game] as Record<string, readonly (readonly number[])[]>)[name][0];
    return { w: f[2], h: f[3] };
};
function dot(c: Ctx, x: number, y: number, col: string) {
    c.fillStyle = col;
    c.fillRect(Math.round(x), Math.round(y), 1, 1);
}
/** Pixel line. `upto` (0..1) draws only the first part; `sparse` skips every other pixel (a dithered fade). */
function line(c: Ctx, x0: number, y0: number, x1: number, y1: number, col: string, upto = 1, sparse = false) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
    const m = Math.round(n * upto);
    c.fillStyle = col;
    for (let i = 0; i <= m; i++) {
        if (sparse && i & 1) continue;
        const k = n ? i / n : 0;
        c.fillRect(Math.round(x0 + (x1 - x0) * k), Math.round(y0 + (y1 - y0) * k), 1, 1);
    }
}

/** Fill the zone's box on `c` with a dithered field: `fn` returns a ramp position 0..1, or -1 to leave it clear. */
function field(z: Zone, c: Ctx, fn: (x: number, y: number) => number, cols: RGB[], y0 = z.bbox.y, y1 = z.bbox.y + z.bbox.h) {
    const { x: bx, y: by, w, h } = z.bbox;
    const top = clamp(Math.round(y0) - by, 0, h), bot = clamp(Math.round(y1) - by, 0, h);
    if (bot <= top) return;
    const data = c.createImageData(w, bot - top);
    const d = data.data;
    const n = cols.length - 1;
    for (let yy = top; yy < bot; yy++) {
        const y = yy + by;
        for (let xx = 0; xx < w; xx++) {
            const x = xx + bx;
            const v = fn(x, y);
            if (v < 0) continue;
            const t = clamp(v, 0, 1) * n;
            const lo = Math.floor(t);
            const col = cols[Math.min(n, lo + (t - lo > bay(x, y) ? 1 : 0))];
            const i = ((yy - top) * w + xx) * 4;
            d[i] = col[0];
            d[i + 1] = col[1];
            d[i + 2] = col[2];
            d[i + 3] = 255;
        }
    }
    // createImageData + putImageData ignore the transform, so place it in the buffer's own coordinates.
    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = bot - top;
    tmp.getContext("2d")!.putImageData(data, 0, 0);
    c.drawImage(tmp, bx, by + top);
}

/** The parts of a zone that the card does not cover, biggest first. */
function freeAreas(z: Zone): Rect[] {
    const { card: c, bbox: b } = z;
    const top = Math.max(b.y, z.top);
    const out: Rect[] = [
        { x: b.x, y: top, w: b.w, h: c.y - top },
        { x: b.x, y: c.y + c.h, w: b.w, h: b.y + b.h - (c.y + c.h) },
        { x: b.x, y: c.y, w: c.x - b.x, h: c.h },
        { x: c.x + c.w, y: c.y, w: b.x + b.w - (c.x + c.w), h: c.h },
    ];
    return out.filter((r) => r.w > 6 && r.h > 6).sort((a, b2) => b2.w * b2.h - a.w * a.h);
}
function pickIn(areas: Rect[], r: () => number, pad = 4) {
    const total = areas.reduce((s, a) => s + a.w * a.h, 0);
    let k = r() * total;
    for (const a of areas) {
        k -= a.w * a.h;
        if (k <= 0) return { x: a.x + pad + r() * Math.max(1, a.w - pad * 2), y: a.y + pad + r() * Math.max(1, a.h - pad * 2) };
    }
    return { x: 0, y: 0 };
}

// ---- Brasswork: brass gears turning behind the card, a floating workshop island, an expedition airship -------------------
const B_BG = ramp("#0b0805", "#120d07", "#1a130a", "#251b0e", "#342513", "#4a3418", "#6a4a1e");
const B_SPARK = ["#fff4d6", "#f3cf82", "#f0a070", "#cf6e3a"];

const brasswork: Scene = {
    paint(z, back) {
        const { card: c } = z;
        const gx = c.x + c.w * 0.1, gy = c.y + c.h + 6; // furnace glow under the gear cluster
        const hx = c.x + c.w * 0.86, hy = c.y - 2; // lamp glow at the top-right corner gear
        // big faint gear outlines in the far background
        const ghosts = [
            { x: c.x - 26, y: c.y + c.h * 0.42, r: 64, n: 14 },
            { x: c.x + c.w * 0.62, y: z.top + 6, r: 44, n: 10 },
        ];
        field(z, back, (x, y) => {
            const g = Math.exp(-Math.hypot(x - gx, (y - gy) * 1.3) / 70);
            const l = Math.exp(-Math.hypot(x - hx, y - hy) / 46) * 0.6;
            let v = 0.1 + g * 0.6 + l * 0.45;
            // workshop blueprint grid
            if (x % 16 === 0 || y % 16 === 0) v += 0.07;
            if (x % 16 === 0 && y % 16 === 0) v += 0.12;
            for (const o of ghosts) {
                const dx = x - o.x, dy = y - o.y;
                const r = Math.hypot(dx, dy);
                const ph = ((Math.atan2(dy, dx) * o.n) / (2 * Math.PI) + 4) % 1;
                const edge = o.r - 6 + (ph > 0.12 && ph < 0.6 ? 6 : 0);
                if (Math.abs(r - edge) < 0.8 || Math.abs(r - o.r * 0.7) < 0.6 || Math.abs(r - o.r * 0.22) < 0.6) v += 0.12;
            }
            return v;
        }, B_BG);
    },
    under(z, c, t, img) {
        const { card: k } = z;
        const st = z.state as { sparks?: { x: number; y: number; vx: number; vy: number; age: number }[]; puffs?: { x: number; y: number; age: number; dx: number }[] };
        const sparks = (st.sparks ??= []);
        const puffs = (st.puffs ??= []);
        const g = Math.floor(t / 2);
        const wide = k.x - z.bbox.x >= 40;

        // floating island with the windmill: in the left margin on wide screens, top right of the header on phones
        const is = size("brasswork", "island");
        const bob = Math.round(Math.sin(t / 9) * 1.6);
        const ix = wide ? k.x * 0.48 - is.w / 2 : k.x + k.w - 84;
        const iy = wide ? k.y + k.h * 0.12 + bob : k.y - 42 + bob;
        spr(c, img, "brasswork", "island", 0, ix, iy);
        spr(c, img, "brasswork", "blades", Math.floor(t / 2), ix + 62 - 22, iy + 14 - 22);
        if (t % 9 === 0) puffs.push({ x: ix + 33, y: iy + 30, age: 0, dx: 0.25 });

        // the expedition airship drifts back and forth across the zone
        const as = size("brasswork", "airship");
        const span = Math.max(40, z.bbox.w - as.w - 20);
        const p = (t * 0.45) % (span * 2);
        const goingRight = p < span;
        const ax = z.bbox.x + 8 + (goingRight ? p : span * 2 - p);
        // wide screens: the heading fills the strip above the card, so the ship passes below the cards instead
        const ay = (wide ? k.y + k.h - 12 : z.top + 1) + Math.round(Math.sin(t / 13) * 1.5);
        spr(c, img, "brasswork", "airship", t & 1, ax, ay, !goingRight);

        // gear cluster: a big brass gear behind the card's bottom-left corner meshing with a copper and a small gear
        const A = { x: k.x - 2, y: k.y + k.h - 22 };
        const M = { x: A.x - 60, y: A.y - 42 };
        const Sg = { x: M.x - 15, y: M.y - 41 };
        spr(c, img, "brasswork", "gearS", g + 3, Sg.x - 21, Sg.y - 21);
        spr(c, img, "brasswork", "gearM", g + 4, M.x - 32, M.y - 32);
        spr(c, img, "brasswork", "gearL", g, A.x - 52, A.y - 52);
        // and a second pair at the top-right corner, half hidden by the card
        const T = { x: k.x + k.w * 0.86, y: k.y + 4 };
        if (wide) {
            spr(c, img, "brasswork", "gearM", g + 2, T.x - 32, T.y - 32);
            spr(c, img, "brasswork", "gearS", g + 5, T.x - 15 - 21, T.y - 41 - 21);
        }

        // sparks thrown off where the big and copper gears mesh
        if (t % 3 === 0) {
            const cx = (A.x + M.x) / 2 + 4, cy = (A.y + M.y) / 2;
            sparks.push({ x: cx, y: cy, vx: -0.6 - Math.random() * 1.4, vy: -1.2 - Math.random() * 1.2, age: 0 });
        }
        for (let i = sparks.length - 1; i >= 0; i--) {
            const s = sparks[i];
            s.x += s.vx;
            s.y += s.vy;
            s.vy += 0.3;
            s.age++;
            if (s.age > 10) {
                sparks.splice(i, 1);
                continue;
            }
            dot(c, s.x, s.y, B_SPARK[Math.min(3, s.age >> 2)]);
            if (s.age < 4) dot(c, s.x - s.vx * 0.5, s.y - s.vy * 0.5, B_SPARK[2]);
        }
        // steam from the workshop chimney and from behind the card's top edge
        if (wide && t % 14 === 7) puffs.push({ x: T.x - 46, y: k.y - 6, age: 0, dx: -0.15 });
        for (let i = puffs.length - 1; i >= 0; i--) {
            const q = puffs[i];
            q.age++;
            if (q.age >= 30) {
                puffs.splice(i, 1);
                continue;
            }
            spr(c, img, "brasswork", "puff", Math.floor(q.age / 5), q.x - 13 + q.age * q.dx * 2, q.y - 13 - q.age * 0.9);
        }
    },
};

// ---- Starwright: nebula, a star burning behind the card, orbiting planets, constellations, a supernova ----------------
const S_BG = ramp("#050309", "#09060f", "#0e0a19", "#161027", "#21173a", "#33194a", "#4e1f58", "#76285f", "#a8396a");
const S_LINE = "#8f75e6";
const S_NOVA = ["#ffffff", "#fff3e0", "#ffc2a1", "#ff8a5c", "#c4481c", "#8f75e6", "#4a3a8a"];

const starwright: Scene = {
    paint(z, back) {
        const { card: c } = z;
        const sx = c.x + c.w * 0.8, sy = c.y - 4;
        const ox = z.seed % 97;
        field(z, back, (x, y) => {
            const n = fbm((x + ox) / 46, y / 30);
            const n2 = fbm((x - ox) / 18 + 5, y / 14 + 3);
            const glow = Math.exp(-Math.hypot(x - sx, y - sy) / 60);
            const neb = Math.max(0, n - 0.42) * 2.2 * (0.6 + n2 * 0.6);
            return 0.06 + neb * 0.62 + glow * 0.32;
        }, S_BG);
        const r = rng(z.seed);
        const count = Math.round((z.bbox.w * z.bbox.h) / 120);
        for (let i = 0; i < count; i++) {
            const x = z.bbox.x + r() * z.bbox.w, y = z.bbox.y + r() * z.bbox.h;
            const k = r();
            dot(back, x, y, k > 0.9 ? "#f0eaff" : k > 0.6 ? "#c4b4ff" : "#4a3a8a");
        }
    },
    under(z, c, t, img) {
        const { card: k } = z;
        const st = z.state as {
            tw?: { x: number; y: number; ph: number; per: number }[];
            con?: { pts: { x: number; y: number }[]; born: number };
            nova?: { x: number; y: number; born: number };
            shoot?: { x: number; y: number; vx: number; vy: number; born: number };
        };
        const areas = freeAreas(z);
        if (!st.tw) {
            const r = rng(z.seed + 3);
            const n = clamp(Math.round((z.bbox.w * z.bbox.h) / 1800), 8, 40);
            st.tw = Array.from({ length: n }, () => ({ ...pickIn(areas, r), ph: Math.floor(r() * 60), per: 40 + Math.floor(r() * 50) }));
        }
        for (const s of st.tw) {
            const f = (t + s.ph) % s.per;
            if (f < 7) spr(c, img, "starwright", "twinkle", [0, 1, 2, 3, 2, 1, 0][f], s.x - 3, s.y - 3);
            else dot(c, s.x, s.y, "#8f75e6");
        }

        // constellation: points join one line at a time, hold, fade in a dither, then a new set
        const CY = 150;
        if (!st.con || t - st.con.born >= CY) {
            const r = rng(z.seed + Math.floor(t / CY) * 7919);
            const a = areas[0];
            const n = 5 + Math.floor(r() * 2);
            const pts = Array.from({ length: n }, (_, i) => ({
                x: a.x + 6 + ((i + r() * 0.8) / n) * Math.max(10, a.w - 12),
                y: a.y + 4 + r() * Math.max(4, a.h - 8),
            }));
            st.con = { pts, born: t - ((t - (st.con?.born ?? t)) % CY) };
        }
        {
            const age = t - st.con.born;
            const segs = st.con.pts.length - 1;
            const drawn = clamp(age / 70, 0, 1) * segs;
            const fade = age > 125;
            if (age < 145) {
                for (let i = 0; i < segs; i++) {
                    if (drawn <= i) break;
                    const p = st.con.pts[i], q = st.con.pts[i + 1];
                    line(c, p.x, p.y, q.x, q.y, S_LINE, Math.min(1, drawn - i), fade || i % 2 === 1);
                }
                st.con.pts.forEach((p, i) => {
                    if (drawn >= i - 0.01) spr(c, img, "starwright", "twinkle", fade ? 0 : 1 + ((t >> 2) + i) % 2, p.x - 3, p.y - 3);
                });
            }
        }

        // the star and its planets: half the orbit passes behind the star, half in front
        const sx = k.x + k.w * 0.8, sy = k.y - 4;
        const orbits = [
            { a: 46, b: 12, sp: 0.045, ph: 0.4, name: "rock", w: 16 },
            { a: 74, b: 20, sp: 0.028, ph: 2.6, name: "ice", w: 20 },
            { a: 104, b: 28, sp: 0.018, ph: 4.4, name: "gas", w: 52 },
        ];
        const pos = orbits.map((o) => {
            const ang = o.ph + t * o.sp;
            return { o, x: sx + Math.cos(ang) * o.a, y: sy + Math.sin(ang) * o.b, front: Math.sin(ang) > 0 };
        });
        const drawPlanet = (p: (typeof pos)[number]) => {
            const s = size("starwright", p.o.name);
            spr(c, img, "starwright", p.o.name, 0, p.x - s.w / 2, p.y - s.h / 2);
        };
        // faint orbit tracks
        for (const o of orbits) {
            for (let a = 0; a < Math.PI * 2; a += 4 / o.a) {
                const x = sx + Math.cos(a) * o.a, y = sy + Math.sin(a) * o.b;
                if (bay(Math.round(x), Math.round(y)) < 0.35) dot(c, x, y, "#2a2350");
            }
        }
        pos.filter((p) => !p.front).forEach(drawPlanet);
        spr(c, img, "starwright", "star", Math.floor(t / 3), sx - 52, sy - 52);
        pos.filter((p) => p.front).forEach(drawPlanet);

        // a shooting star every few seconds
        if (!st.shoot || t - st.shoot.born > 56) {
            const r = rng(t * 31 + z.seed);
            const p = pickIn(areas, r, 10);
            st.shoot = { x: p.x - 30, y: p.y - 12, vx: 4.4, vy: 1.8, born: t };
        }
        {
            const age = t - st.shoot.born;
            if (age < 9) {
                const hx = st.shoot.x + st.shoot.vx * age, hy = st.shoot.y + st.shoot.vy * age;
                const tail = ["#ffffff", "#f0eaff", "#c4b4ff", "#8f75e6", "#4a3a8a"];
                for (let i = 0; i < 15; i++) {
                    if (i > 7 && i & 1) continue;
                    dot(c, hx - (st.shoot.vx / 4.8) * i, hy - (st.shoot.vy / 4.8) * i, tail[Math.min(4, i >> 2)]);
                }
            }
        }
        // a supernova ring now and then, somewhere the card does not cover
        if (!st.nova || t - st.nova.born > 110) {
            const r = rng(t * 17 + z.seed + 5);
            st.nova = { ...pickIn(areas, r, 14), born: t };
        }
        {
            const age = t - st.nova.born;
            if (age < 18) {
                const rad = 1 + age * 1.3;
                const col = S_NOVA[Math.min(6, age >> 2)];
                const steps = Math.max(8, Math.round(rad * 6));
                for (let i = 0; i < steps; i++) {
                    if (age > 9 && i & 1) continue;
                    const a = (i / steps) * Math.PI * 2;
                    dot(c, st.nova.x + Math.cos(a) * rad, st.nova.y + Math.sin(a) * rad, col);
                }
                if (age < 6) {
                    dot(c, st.nova.x, st.nova.y, "#ffffff");
                    spr(c, img, "starwright", "twinkle", 2, st.nova.x - 3, st.nova.y - 3);
                }
            }
        }
    },
};

// ---- Groundbreak: golden-hour bay, skyline, a tower crane lifting beams onto a frame that grows a floor at a time -----
const G_SKY = ramp("#17131c", "#21192c", "#2f1f3c", "#46284a", "#663152", "#8c3c58", "#b44c58", "#d86650", "#f08a48", "#f6ac5a", "#ffd08a");
const G_WATER = ramp("#0e0b14", "#16111f", "#211829", "#2e1f34", "#4a2a44", "#6e3a4c");
const G_SIL = ["#120e18", "#1a1422", "#241b2e"];
const G_LIT = ["#ffd08a", "#f6ac5a", "#ffe9b8"];
const G_STEEL = ["#2a1410", "#5a2a1a", "#9a4628", "#d06a3a", "#f6a060"];

type Tower = { x: number; w: number; h: number; win: { x: number; y: number }[] };

function groundbreakGeom(z: Zone) {
    const { card: k } = z;
    const horizon = Math.round(Math.min(k.y + 30, z.bbox.y + z.bbox.h - 8));
    const roomRight = z.bbox.x + z.bbox.w - (k.x + k.w);
    const mast = Math.round(roomRight >= 34 ? k.x + k.w + 12 : k.x + k.w - 30);
    const crane = size("groundbreak", "crane");
    const craneTop = Math.round(roomRight >= 34 ? clamp(horizon - 120, z.top + 2, horizon - 40) : Math.min(Math.max(horizon - 120, z.top - 10), k.y - 28));
    const craneX = mast - 132; // the mast sits 132 px into the sprite
    const jibY = craneTop + 18;
    const site = { x: Math.round(Math.max(craneX + 30, mast - 74)), w: 32 };
    const sun = { x: Math.round(k.x + k.w * 0.34), y: horizon - 16 };
    return { horizon, mast, crane, craneTop, craneX, jibY, site, sun };
}

/** One floor's glass: dithered sunset reflection between the columns. Built once per zone. */
function glassPane(st: { glass?: HTMLCanvasElement }, w: number) {
    if (st.glass) return st.glass;
    const cv = document.createElement("canvas");
    cv.width = w - 1;
    cv.height = 6;
    const g = cv.getContext("2d")!;
    for (let x = 0; x < w - 1; x++) {
        if ((x + 1) % 8 === 0) continue;
        for (let y = 0; y < 6; y++) dot(g, x, y, bay(x, y) < 0.45 - y * 0.05 ? "#f08a48" : "#46284a");
    }
    st.glass = cv;
    return cv;
}

const groundbreak: Scene = {
    paint(z, back, front, img) {
        const G = groundbreakGeom(z);
        const { horizon, sun } = G;
        const top = z.bbox.y;
        field(z, back, (x, y) => {
            if (y >= horizon) return -1;
            const v = Math.pow(clamp((y - top) / Math.max(20, horizon - top), 0, 1), 1.25);
            const g = Math.exp(-Math.hypot(x - sun.x, (y - sun.y) * 1.6) / 40) * 0.35;
            return v * 0.92 + g;
        }, G_SKY);
        spr(back, img, "groundbreak", "sun", 0, sun.x - 32, sun.y - 32);

        // front layer: far hills, crane, towers, water
        field(z, front, (x, y) => {
            const hill = horizon - 6 - Math.round(fbm(x / 38 + 3, 1.7) * 14);
            return y >= hill && y < horizon ? 0.5 + (y - hill) * 0.02 : -1;
        }, ramp("#3a2440", "#46284a", "#4e2a4c"), horizon - 26, horizon);
        // crane, with extra mast sections down to the horizon when the sprite is too short
        spr(front, img, "groundbreak", "crane", 0, G.craneX, G.craneTop);
        const f = BAND_ATLAS.groundbreak.crane[0];
        for (let y = G.craneTop + G.crane.h - 1; y < horizon; y += 10) {
            front.drawImage(img, f[0] + 131, f[1] + 40, 12, 10, G.mast - 1, y, 12, 10);
        }
        // skyline
        const r = rng(z.seed + 11);
        const towers: Tower[] = [];
        let x = z.bbox.x - 4;
        while (x < z.bbox.x + z.bbox.w) {
            const w = 7 + Math.floor(r() * 14);
            const nearCrane = x + w > G.site.x - 6 && x < G.mast + 14;
            const h = nearCrane ? 4 + Math.floor(r() * 8) : 10 + Math.floor(r() * r() * 52);
            const win: { x: number; y: number }[] = [];
            for (let wy = horizon - h + 3; wy < horizon - 2; wy += 3) {
                for (let wx = x + 2; wx < x + w - 1; wx += 2) if (r() > 0.35) win.push({ x: wx, y: wy });
            }
            towers.push({ x, w, h, win });
            x += w + (r() > 0.7 ? 2 + Math.floor(r() * 5) : 0);
        }
        for (const tw of towers) {
            front.fillStyle = G_SIL[tw.h > 40 ? 0 : tw.h > 20 ? 1 : 2];
            front.fillRect(tw.x, horizon - tw.h, tw.w, tw.h);
            // sun-side edge catches the light
            const lit = tw.x + tw.w < sun.x ? tw.x + tw.w - 1 : tw.x;
            front.fillStyle = "#6a3456";
            front.fillRect(lit, horizon - tw.h, 1, tw.h);
            front.fillStyle = "#a8486a";
            front.fillRect(tw.x, horizon - tw.h, tw.w, 1);
            if (tw.h > 34 && r() > 0.5) {
                front.fillStyle = G_SIL[0];
                front.fillRect(tw.x + (tw.w >> 1), horizon - tw.h - 6, 1, 6);
            }
            front.fillStyle = "#2c2034";
            for (const w of tw.win) front.fillRect(w.x, w.y, 1, 1);
        }
        z.state.towers = towers;
        // the bay
        field(z, front, (x2, y) => {
            const d = (y - horizon) / Math.max(10, z.bbox.y + z.bbox.h - horizon);
            const glint = Math.exp(-Math.abs(x2 - sun.x) / 14) * (1 - d) * 0.35;
            return 0.55 - d * 0.55 + glint + (y === horizon ? 0.25 : 0);
        }, G_WATER, horizon, z.bbox.y + z.bbox.h);
    },
    under(z, c, t, img) {
        const G = groundbreakGeom(z);
        // clouds drift right, behind the skyline
        const span = z.bbox.w + 120;
        const band = Math.max(10, G.horizon - 40 - Math.max(z.top, z.bbox.y));
        [0, 1, 2].forEach((i) => {
            const s = size("groundbreak", "cloud");
            const x = z.bbox.x - 90 + ((t * (0.12 + i * 0.05) + i * (span / 3)) % span);
            const y = Math.max(z.top, z.bbox.y) + 4 + ((i * 0.37 * band) % band);
            spr(c, img, "groundbreak", "cloud", i, x, y - s.h / 2);
        });
    },
    over(z, c, t, img) {
        const G = groundbreakGeom(z);
        const st = z.state as { towers?: Tower[]; glass?: HTMLCanvasElement };
        const { horizon, site, jibY, mast } = G;

        // windows switch on and off
        for (const tw of st.towers ?? []) {
            tw.win.forEach((w, i) => {
                if (hash(i + tw.x * 13, Math.floor(t / 30 + i * 0.37)) > 0.72) dot(c, w.x, w.y, G_LIT[i % 3]);
            });
        }

        // building site: steel frame that gains a floor each time the crane drops a beam
        const CY = 192;
        const cyc = Math.floor(t / CY);
        const maxFloors = Math.max(3, Math.floor((horizon - jibY - 26) / 7));
        const floors = 2 + (cyc % (maxFloors - 1));
        const ph = t % CY;
        const topY = horizon - floors * 7;
        for (let f = 0; f < floors; f++) {
            const y = horizon - (f + 1) * 7;
            c.fillStyle = G_STEEL[3];
            c.fillRect(site.x, y, site.w, 1);
            for (let x = site.x; x <= site.x + site.w; x += 8) {
                c.fillStyle = x === site.x ? G_STEEL[4] : G_STEEL[2];
                c.fillRect(x, y, 1, 7);
            }
            // finished floors get glass that holds the sunset (one cached pane, stamped per floor)
            if (f < floors - 1) c.drawImage(glassPane(st, site.w), site.x + 1, y + 1);
        }
        // the crane's run: hook down, lift a beam, travel to the frame, set it, return
        const pick = mast - 16;
        const dropX = site.x + site.w / 2;
        let tx = pick, hookY = jibY + 10, carrying = true;
        const lerp = (a: number, b: number, k: number) => a + (b - a) * clamp(k, 0, 1);
        const groundY = horizon - 4;
        const setY = topY - 6;
        if (ph < 24) { tx = pick; hookY = lerp(jibY + 10, groundY, ph / 24); carrying = false; }
        else if (ph < 56) { tx = pick; hookY = lerp(groundY, jibY + 12, (ph - 24) / 32); }
        else if (ph < 104) { tx = lerp(pick, dropX, (ph - 56) / 48); hookY = jibY + 12; }
        else if (ph < 136) { tx = dropX; hookY = lerp(jibY + 12, setY, (ph - 104) / 32); }
        else if (ph < 164) { tx = dropX; hookY = lerp(setY, jibY + 10, (ph - 136) / 28); carrying = false; }
        else { tx = lerp(dropX, pick, (ph - 164) / 28); hookY = jibY + 10; carrying = false; }
        tx = Math.round(tx);
        hookY = Math.round(hookY);
        // trolley, cable, hook
        c.fillStyle = "#4a2e10";
        c.fillRect(tx - 3, jibY + 6, 7, 2);
        c.fillStyle = "#1a1008";
        c.fillRect(tx, jibY + 8, 1, hookY - jibY - 8);
        c.fillStyle = "#d2921e";
        c.fillRect(tx - 1, hookY, 3, 2);
        if (carrying) spr(c, img, "groundbreak", "beam", 0, tx - 14, hookY + 2);
        // the beam just set sits on top of the frame until the next floor shows; welding sparks while it is fixed
        if (ph >= 136) spr(c, img, "groundbreak", "beam", 0, dropX - 14, setY + 2);
        if (ph >= 136 && ph < 176 && t % 2 === 0) {
            const wx = dropX - 12 + ((t * 7) % 24);
            dot(c, wx, setY + 6, "#fff3c0");
            dot(c, wx + (t % 3) - 1, setY + 4, "#ffd08a");
            dot(c, wx + (t % 5) - 2, setY + 8, "#f6ac5a");
        }

        // warning lights blink on the jib tip and the tower top
        if (t % 16 < 8) {
            dot(c, G.craneX + 3, G.craneTop + 17, "#ff5a3c");
            dot(c, mast + 4, G.craneTop, "#ff5a3c");
        }

        // birds cross the sky
        const span = z.bbox.w + 60;
        for (let i = 0; i < 5; i++) {
            const bx = z.bbox.x + z.bbox.w + 20 - ((t * 0.9 + i * 7 + (i & 1) * 5) % span);
            const by = Math.max(z.top, z.bbox.y) + 8 + i * 3 + ((i * 5) % 7) + Math.round(Math.sin((t + i * 9) / 7));
            spr(c, img, "groundbreak", "bird", (t >> 1) + i, bx, by);
        }

        // the sun's path on the water shimmers
        for (let y = horizon + 2; y < z.bbox.y + z.bbox.h; y += 2) {
            const d = y - horizon;
            const w = Math.max(1, 12 - d * 0.35);
            const off = Math.round(Math.sin((t + d * 3) / 3) * 2);
            if (hash(d, Math.floor(t / 2)) > 0.45) {
                c.fillStyle = d < 8 ? "#ffd08a" : d < 22 ? "#f6ac5a" : "#b44c58";
                c.fillRect(Math.round(G.sun.x - w / 2 + off), y, Math.round(w * (0.5 + hash(y, t >> 2) * 0.5)), 1);
            }
        }
    },
};

const SCENES: Record<Game, Scene> = { brasswork, starwright, groundbreak };

// ---- layout ------------------------------------------------------------------------------------------------------------
function offsetIn(el: HTMLElement, root: HTMLElement) {
    let x = 0, y = 0;
    let e: HTMLElement | null = el;
    while (e && e !== root) {
        x += e.offsetLeft;
        y += e.offsetTop;
        e = e.offsetParent as HTMLElement | null;
    }
    return { x, y };
}
const canvas = (w: number, h: number) => {
    const c = document.createElement("canvas");
    c.width = Math.max(1, w);
    c.height = Math.max(1, h);
    return c;
};

function layoutZones(section: HTMLElement, W: number, H: number, S: number): Zone[] {
    const cards = Array.from(section.querySelectorAll<HTMLElement>(".gs-card[data-game]")).filter((el) => el.dataset.game! in SCENES);
    const raw = cards.map((el) => {
        const o = offsetIn(el, section);
        return {
            game: el.dataset.game as Game,
            card: { x: Math.round(o.x / S), y: Math.round(o.y / S), w: Math.round(el.offsetWidth / S), h: Math.round(el.offsetHeight / S) },
        };
    });
    if (!raw.length) return [];
    const C = raw.map((r) => ({ x: r.card.x + r.card.w / 2, y: r.card.y + r.card.h / 2 }));
    const n = raw.length;
    // seam width per pair of cards: at most SEAM, and no wider than most of the gap between the two cards
    const seam = raw.map((p) =>
        raw.map((q) => {
            const gx = Math.max(q.card.x - (p.card.x + p.card.w), p.card.x - (q.card.x + q.card.w), 0);
            const gy = Math.max(q.card.y - (p.card.y + p.card.h), p.card.y - (q.card.y + q.card.h), 0);
            return gx > 0 && gy === 0 ? SEAM : clamp(gy * 0.8, 6, SEAM);
        }),
    );
    // ownership: nearest card centre, seams cross-faded by the dither; the band also fades out at its top and bottom
    const owner = new Uint8Array(W * H).fill(255);
    const box = raw.map(() => ({ x0: W, y0: H, x1: -1, y1: -1 }));
    const top = raw.map(() => H);
    const a = new Float32Array(n);
    for (let y = 0; y < H; y++) {
        const edge = Math.min((y + 1) / 10, (H - y) / 12);
        for (let x = 0; x < W; x++) {
            if (edge < 1 && edge <= bay(x + 3, y + 5)) continue;
            let sum = 0;
            for (let k = 0; k < n; k++) {
                let d = Infinity;
                const dk = (x - C[k].x) ** 2 + (y - C[k].y) ** 2;
                for (let j = 0; j < n; j++) {
                    if (j === k) continue;
                    const dist = Math.hypot(C[j].x - C[k].x, C[j].y - C[k].y) || 1;
                    d = Math.min(d, ((x - C[j].x) ** 2 + (y - C[j].y) ** 2 - dk) / (2 * dist) / seam[k][j]);
                }
                a[k] = n === 1 ? 1 : clamp(0.5 + d, 0, 1);
                sum += a[k];
            }
            const b = bay(x, y) * sum;
            let acc = 0, k = 0;
            for (; k < n - 1; k++) {
                acc += a[k];
                if (acc > b) break;
            }
            owner[y * W + x] = k;
            const bx = box[k];
            if (x < bx.x0) bx.x0 = x;
            if (x > bx.x1) bx.x1 = x;
            if (y < bx.y0) bx.y0 = y;
            if (y > bx.y1) bx.y1 = y;
            if (a[k] >= 0.5 && y < top[k] && Math.abs(x - C[k].x) < 2) top[k] = y;
        }
    }
    return raw.map((r, k) => {
        const bb = box[k];
        const bbox = { x: bb.x0, y: bb.y0, w: Math.max(1, bb.x1 - bb.x0 + 1), h: Math.max(1, bb.y1 - bb.y0 + 1) };
        const mask = canvas(bbox.w, bbox.h);
        const mc = mask.getContext("2d")!;
        const img = mc.createImageData(bbox.w, bbox.h);
        for (let y = 0; y < bbox.h; y++) {
            for (let x = 0; x < bbox.w; x++) {
                if (owner[(y + bbox.y) * W + x + bbox.x] === k) img.data[(y * bbox.w + x) * 4 + 3] = 255;
            }
        }
        mc.putImageData(img, 0, 0);
        return {
            ...r,
            top: Math.min(top[k], r.card.y),
            bbox,
            band: { w: W, h: H },
            mask,
            buf: canvas(bbox.w, bbox.h),
            back: canvas(bbox.w, bbox.h),
            front: canvas(bbox.w, bbox.h),
            seed: 1000 + k * 7717 + (r.game.length * 131),
            state: {},
        };
    });
}

function local(cv: HTMLCanvasElement, z: Zone) {
    const c = cv.getContext("2d")!;
    c.imageSmoothingEnabled = false;
    c.setTransform(1, 0, 0, 1, -z.bbox.x, -z.bbox.y);
    return c;
}

// ---- the band ----------------------------------------------------------------------------------------------------------
export function startBand(section: HTMLElement, motion: boolean) {
    const wrap = document.createElement("div");
    wrap.className = "gs-band";
    wrap.setAttribute("aria-hidden", "true");
    const cv = document.createElement("canvas");
    wrap.appendChild(cv);
    section.prepend(wrap);
    const ctx = cv.getContext("2d")!;

    const games = Object.keys(SCENES) as Game[];
    const sheets = new Map<Game, HTMLImageElement>();
    let zones: Zone[] = [];
    let W = 0, H = 0;
    let t = 0;
    let raf = 0;
    let last = 0;
    let visible = false;
    let moving = motion;
    let stopped = false;
    let ready = false;
    let relayout = 0;

    const loaded = Promise.all(
        games.map(
            (g) =>
                new Promise<void>((res) => {
                    const im = new Image();
                    im.decoding = "async";
                    im.onload = () => {
                        sheets.set(g, im);
                        res();
                    };
                    im.onerror = () => res();
                    im.src = `/home/band/${g}.webp?v=${SHEET_VERSION}`;
                }),
        ),
    );

    function layout() {
        const dpr = window.devicePixelRatio || 1;
        // whole device pixels per art pixel, about 2 CSS px each
        const S = Math.max(2, Math.round(2 * dpr)) / dpr;
        W = Math.ceil(section.clientWidth / S);
        H = Math.ceil(section.clientHeight / S);
        if (W < 8 || H < 8) return;
        cv.width = W;
        cv.height = H;
        cv.style.width = `${W * S}px`;
        cv.style.height = `${H * S}px`;
        ctx.imageSmoothingEnabled = false;
        zones = layoutZones(section, W, H, S);
        for (const z of zones) {
            const img = sheets.get(z.game);
            if (!img) continue;
            SCENES[z.game].paint(z, local(z.back, z), local(z.front, z), img);
        }
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);
        for (const z of zones) {
            const img = sheets.get(z.game);
            if (!img) continue;
            const sc = SCENES[z.game];
            const c = local(z.buf, z);
            c.globalCompositeOperation = "source-over";
            c.clearRect(z.bbox.x, z.bbox.y, z.bbox.w, z.bbox.h);
            c.drawImage(z.back, z.bbox.x, z.bbox.y);
            sc.under?.(z, c, t, img);
            c.drawImage(z.front, z.bbox.x, z.bbox.y);
            sc.over?.(z, c, t, img);
            c.globalCompositeOperation = "destination-in";
            c.drawImage(z.mask, z.bbox.x, z.bbox.y);
            c.globalCompositeOperation = "source-over";
            ctx.drawImage(z.buf, z.bbox.x, z.bbox.y);
        }
    }

    function frame(now: number) {
        raf = 0;
        if (stopped || !running()) return;
        if (now - last >= 1000 / FPS - 2) {
            last = now;
            t++;
            draw();
        }
        raf = requestAnimationFrame(frame);
    }
    const running = () => ready && moving && visible && !document.hidden;
    function kick() {
        if (!raf && running()) raf = requestAnimationFrame(frame);
    }
    /** A still frame for reduced motion: a moment where every scene shows its main pieces. */
    function still() {
        t = 140;
        // let the effects that build up over time (sparks, puffs, constellations) settle into a natural frame
        for (const z of zones) z.state = { ...(z.state.towers ? { towers: z.state.towers } : {}) };
        for (let i = 0; i < 6; i++) {
            t += 1;
            draw();
        }
    }

    const io = new IntersectionObserver((es) => {
        visible = es.some((e) => e.isIntersecting);
        kick();
    });
    io.observe(section);
    const onVis = () => kick();
    document.addEventListener("visibilitychange", onVis);
    const ro = new ResizeObserver(() => {
        window.clearTimeout(relayout);
        relayout = window.setTimeout(() => {
            if (stopped || !ready) return;
            const dpr = window.devicePixelRatio || 1;
            const S = Math.max(2, Math.round(2 * dpr)) / dpr;
            if (Math.ceil(section.clientWidth / S) === W && Math.ceil(section.clientHeight / S) === H) return;
            layout();
            if (!moving) still();
            else draw();
        }, 140);
    });

    loaded.then(() => {
        if (stopped) return;
        ready = true;
        layout();
        if (moving) {
            t = 60; // start mid-scene so the first frame already has something going on
            draw();
        } else still();
        requestAnimationFrame(() => wrap.classList.add("on"));
        ro.observe(section);
        kick();
    });

    return {
        setMotion(on: boolean) {
            moving = on;
            if (!ready) return;
            if (!on) {
                if (raf) cancelAnimationFrame(raf);
                raf = 0;
                still();
            } else kick();
        },
        stop() {
            stopped = true;
            if (raf) cancelAnimationFrame(raf);
            io.disconnect();
            ro.disconnect();
            window.clearTimeout(relayout);
            document.removeEventListener("visibilitychange", onVis);
            wrap.remove();
        },
    };
}
