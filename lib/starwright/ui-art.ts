// Starwright's GUI art, drawn in code: every icon and panel texture is a small 4x4 Bayer-dither sprite rendered to a canvas
// once and cached as a data URL. These are stand-ins that look finished; the art thread's PNGs (public/starwright) can replace
// a slot later without the components changing. Client only: callers render after the game has booted.
import { ELEMENTS } from "./data";

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, t: number): RGB => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
const INK: RGB = [5, 4, 14];
const WHITE: RGB = [255, 255, 255];
const rampOf = (color: string): RGB[] => {
    const c = hex(color);
    return [mix(c, INK, 0.86), mix(c, INK, 0.62), mix(c, INK, 0.3), c, mix(c, WHITE, 0.55)];
};
/** Ordered dither of a 0..1 value through a ramp. */
const pick = (r: RGB[], v: number, x: number, y: number): RGB => r[Math.max(0, Math.min(r.length - 1, Math.floor(v * (r.length - 1) + bay(x, y))))];
const hash = (x: number, y: number, s = 0) => {
    let h = Math.imul(x + 7919 + s * 131, 374761393) ^ Math.imul(y + 104729, 668265263);
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

type Px = readonly [number, number, number, number] | null;
const cache = new Map<string, string>();
function make(key: string, w: number, h: number, fn: (x: number, y: number) => Px): string {
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    if (typeof document === "undefined") return "";
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const p = fn(x, y);
            if (!p) continue;
            const i = (y * w + x) * 4;
            img.data[i] = p[0]; img.data[i + 1] = p[1]; img.data[i + 2] = p[2]; img.data[i + 3] = p[3];
        }
    }
    ctx.putImageData(img, 0, 0);
    const url = c.toDataURL("image/png");
    cache.set(key, url);
    return url;
}
const solid = (c: RGB): Px => [c[0], c[1], c[2], 255];
export const cssUrl = (u: string) => `url("${u}")`;

// ---- element tiles (22 x 22, shown at 2x) ---------------------------------------------------------------------------------

type Shape = "orb" | "diamond" | "hex" | "nugget";
interface Body { shape: Shape; r: number; bands?: number; halo?: number; rays?: number; sats?: number; ring?: boolean; cracks?: boolean }
const BODIES: Body[] = [
    { shape: "orb", r: 3.6, halo: 3.4 }, // H: a small hot gas ball in a glow
    { shape: "orb", r: 5, sats: 2 }, // He: two bright satellites
    { shape: "diamond", r: 6.6 }, // C
    { shape: "orb", r: 5.8, bands: 3 }, // O: banded gas
    { shape: "orb", r: 4.2, ring: true, halo: 1.5 }, // Ne: a tube ring
    { shape: "orb", r: 5, rays: 8 }, // Mg: white sparks
    { shape: "hex", r: 6.2 }, // Si: crystal
    { shape: "orb", r: 6, cracks: true }, // Fe: a cracked dense core
    { shape: "nugget", r: 5.8 }, // Au
    { shape: "orb", r: 4.2, halo: 4.6, rays: 3 }, // U: hot glow
];
const TILE = 22;
const sector = (a: number, n: number) => Math.floor(((a + Math.PI) / (Math.PI * 2)) * n + 0.0001) % n;

export function elementIcon(i: number): string {
    const el = ELEMENTS[i];
    return make(`el${i}`, TILE, TILE, (x, y) => {
        const R = rampOf(el.color);
        const b = BODIES[i];
        const cx = (TILE - 1) / 2, cy = (TILE - 1) / 2;
        const dx = x - cx, dy = y - cy;
        // stepped corners of the frame
        const edge = x === 0 || y === 0 || x === TILE - 1 || y === TILE - 1;
        const corner = (x < 2 && y < 2) || (x > TILE - 3 && y < 2) || (x < 2 && y > TILE - 3) || (x > TILE - 3 && y > TILE - 3);
        if (corner) return null;
        if (edge) return solid(mix(hex(el.color), INK, 0.45));
        const d = Math.hypot(dx, dy);
        const ang = Math.atan2(dy, dx);
        // background: a dark dithered bowl with the colour leaking in from the lit corner
        const bgv = 0.1 + 0.2 * (1 - Math.min(1, d / 14)) + 0.12 * Math.max(0, (-dx - dy) / 22);
        const bg = pick(R, bgv * 0.55, x, y);
        let inside = false;
        let v = 0.5;
        if (b.shape === "orb") {
            inside = d <= b.r;
            if (inside) {
                const nx = dx / b.r, ny = dy / b.r;
                const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
                v = 0.5 + 0.62 * (-0.5 * nx - 0.6 * ny + 0.62 * nz) - 0.2;
                if (b.bands) v += 0.14 * Math.sin((ny + 1) * Math.PI * b.bands);
                if (b.cracks) v -= (hash(Math.floor(x / 2), Math.floor(y / 2), i) > 0.78 ? 0.35 : 0) + (Math.abs(dx - dy * 0.6 + 1) < 0.7 && ny > -0.4 ? 0.3 : 0);
            }
        } else if (b.shape === "diamond") {
            const m = Math.abs(dx) + Math.abs(dy);
            inside = m <= b.r + 1;
            if (inside) v = [0.98, 0.62, 0.3, 0.74][sector(ang, 4)] + (m < 2 ? 0.2 : 0);
        } else if (b.shape === "hex") {
            const m = Math.max(Math.abs(dy) * 1.1, Math.abs(dx) * 0.87 + Math.abs(dy) * 0.5);
            inside = m <= b.r;
            if (inside) v = [0.95, 0.75, 0.4, 0.28, 0.5, 0.8][sector(ang, 6)];
        } else {
            const rr = b.r * (0.82 + 0.34 * hash(sector(ang, 9), 3, i));
            inside = d <= rr;
            if (inside) {
                const nx = dx / rr, ny = dy / rr;
                v = 0.55 + 0.5 * (-0.5 * nx - 0.65 * ny) + (hash(x >> 1, y >> 1, i) - 0.5) * 0.25;
            }
        }
        if (inside) {
            // a dark rim keeps every body the same size in the frame
            if (b.shape === "orb" && d > b.r - 1) v -= 0.3;
            return solid(pick(R, Math.max(0, Math.min(1, v)), x, y));
        }
        if (b.halo && d > b.r && d < b.r + b.halo) {
            const g = 0.55 * (1 - (d - b.r) / b.halo);
            if (bay(x, y) < g) return solid(R[2]);
        }
        if (b.ring && Math.abs(d - (b.r + 3.4)) < 0.6 && Math.abs(dx) > 1) return solid(R[3]);
        if (b.rays) {
            const k = Math.abs(Math.sin(ang * b.rays * (b.rays === 3 ? 1.5 : 0.5)));
            if (k > 0.93 && d > b.r + 1 && d < b.r + 4.4) return solid(R[4]);
        }
        if (b.sats) {
            for (let s = 0; s < b.sats; s++) {
                const a = 0.9 + s * Math.PI;
                if (Math.hypot(dx - Math.cos(a) * 8.2, dy - Math.sin(a) * 8.2) < 1.3) return solid(R[4]);
            }
        }
        return solid(bg);
    });
}

/** A locked tile: the same frame, empty. */
export function lockedIcon(): string {
    return make("lock-tile", TILE, TILE, (x, y) => {
        const edge = x === 0 || y === 0 || x === TILE - 1 || y === TILE - 1;
        const corner = (x < 2 && y < 2) || (x > TILE - 3 && y < 2) || (x < 2 && y > TILE - 3) || (x > TILE - 3 && y > TILE - 3);
        if (corner) return null;
        if (edge) return solid([52, 54, 76]);
        return solid(bay(x, y) < 0.16 ? [22, 23, 40] : [11, 11, 22]);
    });
}

// ---- planets (32 x 32) -----------------------------------------------------------------------------------------------------

export function planetIcon(id: string, color: string, size: number): string {
    const S = 32;
    return make(`pl-${id}`, S, S, (x, y) => {
        const R = rampOf(color);
        const r = 5 + size * 1.5;
        const c = (S - 1) / 2;
        const dx = x - c, dy = y - c;
        const ringed = id === "seer" || id === "orrery";
        if (ringed) {
            const ry = Math.hypot(dx / (r * 1.85), (dy + dx * 0.18) / (r * 0.55));
            const front = dy + dx * 0.18 > 0;
            if (Math.abs(ry - 1) < 0.1 && (front || Math.hypot(dx, dy) > r)) return solid(pick(R, front ? 0.85 : 0.5, x, y));
        }
        const d = Math.hypot(dx, dy);
        if (d > r) return null;
        const nx = dx / r, ny = dy / r;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        let v = 0.45 + 0.6 * (-0.5 * nx - 0.6 * ny + 0.62 * nz) - 0.12;
        if (id === "haze" || id === "seer") v += 0.12 * Math.sin(ny * 9);
        else if (hash(x >> 1, y >> 1, id.length) > 0.84) v -= 0.22; // craters and clouds
        if (d > r - 1) v -= 0.25;
        return solid(pick(R, Math.max(0, Math.min(1, v)), x, y));
    });
}

// ---- glyph masks (14 x 14, white on clear; the CSS colours them) ------------------------------------------------------------

type G = { put: (x: number, y: number, half?: boolean) => void; line: (x0: number, y0: number, x1: number, y1: number, half?: boolean) => void; rect: (x: number, y: number, w: number, h: number, half?: boolean) => void; box: (x: number, y: number, w: number, h: number) => void; disc: (cx: number, cy: number, r: number, half?: boolean) => void; ring: (cx: number, cy: number, rx: number, ry: number, rot?: number) => void };
const GL = 14;
const DRAW: Record<string, (g: G) => void> = {
    star: (g) => { g.line(7, 0, 7, 13); g.line(0, 7, 13, 7); g.disc(7, 7, 2.6); g.line(3, 3, 11, 11, true); g.line(11, 3, 3, 11, true); },
    pulse: (g) => { const p: [number, number][] = [[0, 7], [4, 7], [6, 1], [8, 12], [10, 7], [13, 7]]; for (let i = 0; i < p.length - 1; i++) g.line(p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]); },
    orbit: (g) => { g.disc(6.5, 6.5, 3.4); g.ring(6.5, 6.5, 6.6, 2.4, -0.55); g.disc(11.2, 3.2, 1); },
    book: (g) => { g.box(0, 1, 7, 12); g.box(6, 1, 7, 12); g.line(2, 4, 4, 4, true); g.line(2, 7, 4, 7, true); g.line(9, 4, 11, 4, true); g.line(9, 7, 11, 7, true); },
    menu: (g) => { g.rect(0, 2, 14, 2); g.rect(0, 6, 14, 2); g.rect(0, 10, 14, 2); },
    back: (g) => { g.line(9, 1, 3, 7); g.line(3, 7, 9, 13); g.line(10, 1, 4, 7); g.line(4, 7, 10, 13); },
    pause: (g) => { g.rect(2, 1, 4, 12); g.rect(8, 1, 4, 12); },
    play: (g) => { for (let i = 0; i < 7; i++) g.rect(3 + i, 1 + i, 1, 12 - i * 2); },
    full: (g) => { g.line(0, 0, 4, 0); g.line(0, 0, 0, 4); g.line(13, 0, 9, 0); g.line(13, 0, 13, 4); g.line(0, 13, 4, 13); g.line(0, 13, 0, 9); g.line(13, 13, 9, 13); g.line(13, 13, 13, 9); g.disc(7, 7, 1.5, true); },
    sound: (g) => { g.rect(0, 5, 3, 4); g.line(3, 5, 6, 2); g.line(3, 8, 6, 11); g.rect(6, 2, 1, 10); g.line(9, 5, 9, 9); g.line(11, 3, 11, 11); g.line(13, 1, 13, 13, true); },
    mute: (g) => { g.rect(0, 5, 3, 4); g.line(3, 5, 6, 2); g.line(3, 8, 6, 11); g.rect(6, 2, 1, 10); g.line(9, 4, 13, 10); g.line(13, 4, 9, 10); },
    export: (g) => { g.line(7, 9, 7, 0); g.line(3, 4, 7, 0); g.line(11, 4, 7, 0); g.line(0, 9, 0, 13); g.line(13, 9, 13, 13); g.line(0, 13, 13, 13); },
    import: (g) => { g.line(7, 0, 7, 9); g.line(3, 5, 7, 9); g.line(11, 5, 7, 9); g.line(0, 9, 0, 13); g.line(13, 9, 13, 13); g.line(0, 13, 13, 13); },
    burst: (g) => { g.disc(7, 7, 3); for (let a = 0; a < 8; a++) { const t = (a * Math.PI) / 4; g.line(7 + Math.cos(t) * 4.4, 7 + Math.sin(t) * 4.4, 7 + Math.cos(t) * 7, 7 + Math.sin(t) * 7, a % 2 === 1); } },
    lock: (g) => { g.rect(1, 6, 12, 7); g.ring(7, 5, 3.4, 4); },
    medal: (g) => { g.disc(7, 5, 4.4); g.line(4, 9, 3, 13); g.line(10, 9, 11, 13); g.rect(5, 4, 4, 2, true); },
    check: (g) => { g.line(1, 7, 5, 11); g.line(5, 11, 13, 2); g.line(1, 8, 5, 12); g.line(5, 12, 13, 3); },
    cross: (g) => { g.line(2, 2, 11, 11); g.line(11, 2, 2, 11); g.line(3, 2, 12, 11); g.line(12, 2, 3, 11); },
};
export const GLYPHS = Object.keys(DRAW);

export function glyphMask(name: string): string {
    const draw = DRAW[name];
    if (!draw) return "";
    return make(`gl-${name}`, GL, GL, (() => {
        const a = new Uint8Array(GL * GL);
        const put = (x: number, y: number, half?: boolean) => {
            x = Math.round(x); y = Math.round(y);
            if (x < 0 || y < 0 || x >= GL || y >= GL) return;
            if (half && (x + y) % 2) return;
            a[y * GL + x] = 1;
        };
        const line = (x0: number, y0: number, x1: number, y1: number, half?: boolean) => {
            const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
            for (let i = 0; i <= n; i++) put(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, half);
        };
        const rect = (x: number, y: number, w: number, h: number, half?: boolean) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, half); };
        const box = (x: number, y: number, w: number, h: number) => { line(x, y, x + w - 1, y); line(x, y + h - 1, x + w - 1, y + h - 1); line(x, y, x, y + h - 1); line(x + w - 1, y, x + w - 1, y + h - 1); };
        const disc = (cx: number, cy: number, r: number, half?: boolean) => { for (let j = 0; j < GL; j++) for (let i = 0; i < GL; i++) if (Math.hypot(i - cx, j - cy) <= r) put(i, j, half); };
        const ring = (cx: number, cy: number, rx: number, ry: number, rot = 0) => { for (let t = 0; t < 96; t++) { const k = (t / 96) * Math.PI * 2; const ex = Math.cos(k) * rx, ey = Math.sin(k) * ry; put(cx + ex * Math.cos(rot) - ey * Math.sin(rot), cy + ex * Math.sin(rot) + ey * Math.cos(rot)); } };
        draw({ put, line, rect, box, disc, ring });
        return (x: number, y: number): Px => (a[y * GL + x] ? [255, 255, 255, 255] : null);
    })());
}

// ---- panel textures -------------------------------------------------------------------------------------------------------

/** Sparse dither dots over a dark panel. */
export function panelDots(): string {
    return make("tx-dots", 8, 8, (x, y) => { const v = bay(x, y); return v < 0.1 ? [120, 140, 255, 20] : v > 0.93 ? [255, 255, 255, 6] : null; });
}
/** A 4x4 black checker at a given density: laid over a flat colour it turns the colour into a dithered one. */
export function checker(density: number, key = ""): string {
    return make(`ck-${density}-${key}`, 4, 4, (x, y) => (bay(x, y) < density ? [4, 3, 12, 255] : null));
}
/** A divider that fades out downward in four dithered rows. */
export function ruleTile(): string {
    return make("tx-rule", 8, 4, (x, y) => (bay(x, y * 4) < [0.95, 0.62, 0.34, 0.12][y] ? [95, 227, 255, 150] : null));
}
/** A vertical dark-to-clear dither fade, 4 x 64, for the top and bottom of the screen. */
export function fadeTile(): string {
    return make("tx-fade", 4, 64, (x, y) => (bay(x, y) < Math.pow(1 - y / 64, 1.6) * 0.9 ? [3, 2, 9, 255] : null));
}
/** A bar fill: light flecks over the bar's colour. */
export function barTile(): string {
    return make("tx-bar", 4, 4, (x, y) => (bay(x, y) < 0.32 ? [255, 240, 200, 120] : bay(x, y) > 0.8 ? [20, 6, 0, 120] : null));
}

/** CSS variables for .sw-root; computed once after boot. */
export function uiVars(): Record<string, string> {
    return {
        "--px-dots": cssUrl(panelDots()),
        "--px-rule": cssUrl(ruleTile()),
        "--px-fade": cssUrl(fadeTile()),
        "--px-bar": cssUrl(barTile()),
        "--px-ck1": cssUrl(checker(0.18)),
        "--px-ck2": cssUrl(checker(0.34)),
        "--px-ck3": cssUrl(checker(0.5)),
    };
}

// ---- birth-cloud cards (80 x 28, shown at 2x) ----------------------------------------------------------------------------

export function cloudArt(id: string, color: string): string {
    const w = 80, h = 28;
    const seed = id.length * 7 + id.charCodeAt(0);
    return make(`cloud-${id}`, w, h, (x, y) => {
        const R = rampOf(color);
        const n = (px: number, py: number, k: number) => {
            const gx = Math.floor(px / k), gy = Math.floor(py / k);
            const fx = px / k - gx, fy = py / k - gy;
            const a = hash(gx, gy, seed), b = hash(gx + 1, gy, seed), c = hash(gx, gy + 1, seed), d = hash(gx + 1, gy + 1, seed);
            const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
            return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
        };
        const cx = 20 + (seed % 5) * 10, cy = 12 + (seed % 3) * 2;
        const core = Math.max(0, 1 - Math.hypot((x - cx) / 26, (y - cy) / 11));
        const v = 0.55 * n(x, y, 12) + 0.3 * n(x, y, 6) + 0.15 * n(x, y, 3) - 0.1 + core * 0.55;
        return solid(pick(R, Math.max(0, Math.min(1, v)), x, y));
    });
}
