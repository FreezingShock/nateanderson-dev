// Voxel builder for Brasswork scenery props.
//
// Pure data, no three.js import: every prop is generated into a PropModel
// (typed arrays of voxels) that the renderer turns into a mesh with
// `meshData()`. Coordinates are in voxel units with the origin at the centre
// of the model's base, y up. One voxel is `voxel` world units (0.1 for props).

export type Vec3 = [number, number, number];

export interface PropModel {
    id: string;
    /** World size of one voxel. */
    voxel: number;
    count: number;
    /** i, j, k per voxel. Voxel (i, j, k) spans [i, i+1) * voxel on each axis. */
    pos: Int16Array;
    /** Final sRGB colour, 3 bytes per voxel, with ambient occlusion baked in (no jitter). */
    rgb: Uint8Array;
    /** Wind weight 0..255. 0 never moves (trunk base, rock), 255 moves the most. */
    sway: Uint8Array;
    /** 1 = emissive voxel (lamp glass, lit window). Draw unlit, see LOOK-SPEC glow. */
    glow: Uint8Array;
    /** Bounds in voxel units, max exclusive. */
    min: Vec3;
    max: Vec3;
    /** Named points in world units relative to the base centre, e.g. a lamp's light. */
    anchors?: Record<string, Vec3>;
    /** Coarser copy (2x voxel) for far placements. */
    lod?: PropModel;
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Integer hash to [0, 1). */
export function hash3(i: number, j: number, k: number, s = 0): number {
    let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(k | 0, 2147483647) ^ Math.imul(s | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

const fade = (t: number) => t * t * (3 - 2 * t);

/** Smooth 3D value noise in [0, 1). */
export function noise3(x: number, y: number, z: number, s = 0): number {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
    const l = (a: number, b: number, t: number) => a + (b - a) * t;
    const h = (a: number, b: number, c: number) => hash3(xi + a, yi + b, zi + c, s);
    return l(
        l(l(h(0, 0, 0), h(1, 0, 0), xf), l(h(0, 1, 0), h(1, 1, 0), xf), yf),
        l(l(h(0, 0, 1), h(1, 0, 1), xf), l(h(0, 1, 1), h(1, 1, 1), xf), yf),
        zf,
    );
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const smooth = (a: number, b: number, v: number) => fade(clamp((v - a) / (b - a), 0, 1));

/** Mix two 0xRRGGBB colours. */
export function mix(a: number, b: number, t: number): number {
    const r = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t;
    const g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t;
    const bl = (a & 255) + ((b & 255) - (a & 255)) * t;
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

/** Colour source: a fixed colour or a function of the voxel cell. */
export type Paint = number | ((i: number, j: number, k: number) => number);

interface Cell {
    c: number;
    s: number;
    g: number;
}

const KEY = (i: number, j: number, k: number) => ((i + 512) * 1024 + (j + 512)) * 1024 + (k + 512);

export interface BuildOptions {
    /** Wind weight per cell, 0..1. Cells set with an explicit sway keep theirs. */
    sway?: (i: number, j: number, k: number) => number;
    /** Ambient occlusion strength, 0 = off. Default 0.5. */
    ao?: number;
    /** Per-voxel brightness jitter (fraction). Default 0: the shared loader adds LOOK-SPEC's +-7%. */
    jitter?: number;
    /** Generate a 2x coarser LOD copy. Default true. */
    lod?: boolean;
    anchors?: Record<string, Vec3>;
}

export class Vox {
    readonly cells = new Map<number, Cell>();
    constructor(public readonly id: string, public readonly voxel = 0.1) {}

    private paint(p: Paint, i: number, j: number, k: number) {
        return typeof p === "number" ? p : p(i, j, k);
    }

    has(i: number, j: number, k: number) {
        return this.cells.has(KEY(i, j, k));
    }

    set(i: number, j: number, k: number, p: Paint, opt: { sway?: number; glow?: boolean; keep?: boolean } = {}) {
        i = Math.floor(i); j = Math.floor(j); k = Math.floor(k);
        const key = KEY(i, j, k);
        if (opt.keep && this.cells.has(key)) return;
        this.cells.set(key, { c: this.paint(p, i, j, k), s: opt.sway ?? -1, g: opt.glow ? 1 : 0 });
    }

    del(i: number, j: number, k: number) {
        this.cells.delete(KEY(Math.floor(i), Math.floor(j), Math.floor(k)));
    }

    /** Axis box, min inclusive, max exclusive, in voxel units. */
    box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, p: Paint, opt?: { sway?: number; glow?: boolean; keep?: boolean }) {
        for (let i = Math.round(x0); i < Math.round(x1); i++)
            for (let j = Math.round(y0); j < Math.round(y1); j++)
                for (let k = Math.round(z0); k < Math.round(z1); k++) this.set(i, j, k, p, opt);
    }

    /** Ellipsoid with optional lumpy edge (noise amplitude as a fraction of the radius). */
    ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, p: Paint, lump = 0, seed = 0, opt?: { sway?: number; keep?: boolean; hollow?: number }) {
        const m = 1 + lump;
        for (let i = Math.floor(cx - rx * m); i <= Math.ceil(cx + rx * m); i++)
            for (let j = Math.floor(cy - ry * m); j <= Math.ceil(cy + ry * m); j++)
                for (let k = Math.floor(cz - rz * m); k <= Math.ceil(cz + rz * m); k++) {
                    const a = (i + 0.5 - cx) / rx, b = (j + 0.5 - cy) / ry, c = (k + 0.5 - cz) / rz;
                    const d = Math.sqrt(a * a + b * b + c * c);
                    const lim = 1 + (lump ? (noise3(i * 0.28, j * 0.28, k * 0.28, seed) - 0.5) * 2 * lump : 0);
                    if (d <= lim && !(opt?.hollow && d < lim - opt.hollow)) this.set(i, j, k, p, opt);
                }
    }

    /** Vertical cylinder from y0 to y1 (exclusive), radius may taper from r0 to r1. */
    cyl(cx: number, cz: number, y0: number, y1: number, r0: number, p: Paint, r1 = r0, opt?: { sway?: number; keep?: boolean }) {
        for (let j = Math.round(y0); j < Math.round(y1); j++) {
            const t = (j - y0) / Math.max(1, y1 - y0);
            const r = r0 + (r1 - r0) * t;
            for (let i = Math.floor(cx - r - 1); i <= Math.ceil(cx + r); i++)
                for (let k = Math.floor(cz - r - 1); k <= Math.ceil(cz + r); k++)
                    if (Math.hypot(i + 0.5 - cx, k + 0.5 - cz) <= r + 0.15) this.set(i, j, k, p, opt);
        }
    }

    /** Thick line (a branch, a stalk) from a to b with radius tapering r0 to r1. */
    line(a: Vec3, b: Vec3, r0: number, r1: number, p: Paint, opt?: { sway?: number; keep?: boolean }) {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const steps = Math.max(1, Math.ceil(len * 2));
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
            const r = r0 + (r1 - r0) * t;
            if (r < 0.75) {
                this.set(x, y, z, p, opt);
                continue;
            }
            for (let i = Math.floor(x - r); i <= Math.ceil(x + r); i++)
                for (let j = Math.floor(y - r); j <= Math.ceil(y + r); j++)
                    for (let k = Math.floor(z - r); k <= Math.ceil(z + r); k++)
                        if (Math.hypot(i + 0.5 - x, j + 0.5 - y, k + 0.5 - z) <= r) this.set(i, j, k, p, opt);
        }
    }

    /** Copy every cell of another builder at an offset. */
    stamp(src: Vox, ox: number, oy: number, oz: number) {
        for (const [key, cell] of src.cells) {
            const k = (key % 1024) - 512, j = (Math.floor(key / 1024) % 1024) - 512, i = Math.floor(key / 1048576) - 512;
            this.cells.set(KEY(i + ox, j + oy, k + oz), { ...cell });
        }
    }

    forEach(fn: (i: number, j: number, k: number, cell: Cell) => void) {
        for (const [key, cell] of this.cells) {
            const k = (key % 1024) - 512, j = (Math.floor(key / 1024) % 1024) - 512, i = Math.floor(key / 1048576) - 512;
            fn(i, j, k, cell);
        }
    }

    build(o: BuildOptions = {}): PropModel {
        const ao = o.ao ?? 0.5, jit = o.jitter ?? 0;
        const n = this.cells.size;
        const pos = new Int16Array(n * 3), rgb = new Uint8Array(n * 3), sway = new Uint8Array(n), glow = new Uint8Array(n);
        const min: Vec3 = [1e9, 1e9, 1e9], max: Vec3 = [-1e9, -1e9, -1e9];
        let q = 0;
        this.forEach((i, j, k, cell) => {
            pos[q * 3] = i; pos[q * 3 + 1] = j; pos[q * 3 + 2] = k;
            min[0] = Math.min(min[0], i); min[1] = Math.min(min[1], j); min[2] = Math.min(min[2], k);
            max[0] = Math.max(max[0], i + 1); max[1] = Math.max(max[1], j + 1); max[2] = Math.max(max[2], k + 1);
            // Sky occlusion: how much is stacked above this voxel in a small cone.
            let occ = 0;
            if (ao > 0 && !cell.g) {
                for (let d = 1; d <= 7; d++) {
                    if (this.has(i, j + d, k)) occ += 1.2 / d;
                    if (this.has(i + 1, j + d, k) || this.has(i - 1, j + d, k)) occ += 0.35 / d;
                    if (this.has(i, j + d, k + 1) || this.has(i, j + d, k - 1)) occ += 0.35 / d;
                }
                // Buried voxels (surrounded on the sides) read darker too.
                const side = +this.has(i + 1, j, k) + +this.has(i - 1, j, k) + +this.has(i, j, k + 1) + +this.has(i, j, k - 1);
                occ += side * 0.06;
            }
            const shade = cell.g ? 1 : clamp(1 - ao * Math.min(occ, 1.6) * 0.32, 0.5, 1) * (1 + (hash3(i, j, k, 91) - 0.5) * 2 * jit);
            rgb[q * 3] = clamp(Math.round(((cell.c >> 16) & 255) * shade), 0, 255);
            rgb[q * 3 + 1] = clamp(Math.round(((cell.c >> 8) & 255) * shade), 0, 255);
            rgb[q * 3 + 2] = clamp(Math.round((cell.c & 255) * shade), 0, 255);
            const s = cell.s >= 0 ? cell.s : o.sway ? o.sway(i, j, k) : 0;
            sway[q] = clamp(Math.round(s * 255), 0, 255);
            glow[q] = cell.g;
            q++;
        });
        const m: PropModel = { id: this.id, voxel: this.voxel, count: n, pos, rgb, sway, glow, min, max };
        if (o.anchors) m.anchors = o.anchors;
        if (o.lod !== false) m.lod = downsample(m);
        return m;
    }
}

/** Halve the resolution: a coarse cell is filled when at least 3 of its 8 fine cells are. */
export function downsample(m: PropModel): PropModel {
    const acc = new Map<number, { n: number; r: number; g: number; b: number; s: number; gl: number; i: number; j: number; k: number }>();
    for (let q = 0; q < m.count; q++) {
        const i = Math.floor(m.pos[q * 3] / 2), j = Math.floor(m.pos[q * 3 + 1] / 2), k = Math.floor(m.pos[q * 3 + 2] / 2);
        const key = KEY(i, j, k);
        let a = acc.get(key);
        if (!a) acc.set(key, (a = { n: 0, r: 0, g: 0, b: 0, s: 0, gl: 0, i, j, k }));
        a.n++; a.r += m.rgb[q * 3]; a.g += m.rgb[q * 3 + 1]; a.b += m.rgb[q * 3 + 2];
        a.s = Math.max(a.s, m.sway[q]); a.gl += m.glow[q];
    }
    const keep = [...acc.values()].filter((a) => a.n >= 3 || a.gl > 0);
    const n = keep.length;
    const out: PropModel = {
        id: m.id + ":lod", voxel: m.voxel * 2, count: n,
        pos: new Int16Array(n * 3), rgb: new Uint8Array(n * 3), sway: new Uint8Array(n), glow: new Uint8Array(n),
        min: [Math.floor(m.min[0] / 2), Math.floor(m.min[1] / 2), Math.floor(m.min[2] / 2)],
        max: [Math.ceil(m.max[0] / 2), Math.ceil(m.max[1] / 2), Math.ceil(m.max[2] / 2)],
    };
    keep.forEach((a, q) => {
        out.pos[q * 3] = a.i; out.pos[q * 3 + 1] = a.j; out.pos[q * 3 + 2] = a.k;
        out.rgb[q * 3] = a.r / a.n; out.rgb[q * 3 + 1] = a.g / a.n; out.rgb[q * 3 + 2] = a.b / a.n;
        out.sway[q] = a.s; out.glow[q] = a.gl > a.n / 2 ? 1 : 0;
    });
    if (m.anchors) out.anchors = m.anchors;
    return out;
}

export interface MeshData {
    /** Float32 xyz per vertex, world units, origin at the model's base centre. */
    position: Float32Array;
    normal: Float32Array;
    /** sRGB 0..1 per vertex; convert to linear in the renderer if needed. */
    color: Float32Array;
    /** Wind weight 0..1 per vertex. */
    sway: Float32Array;
    index: Uint32Array;
    /** Same layout for emissive voxels, drawn unlit. Empty when the model has none. */
    glow: { position: Float32Array; color: Float32Array; index: Uint32Array };
}

const FACES: { d: Vec3; v: Vec3[] }[] = [
    { d: [1, 0, 0], v: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
    { d: [-1, 0, 0], v: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
    { d: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
    { d: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { d: [0, 0, 1], v: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
    { d: [0, 0, -1], v: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

/**
 * Face-culled mesh of a model: only faces between a filled and an empty cell are emitted.
 * `jitter` adds the LOOK-SPEC per-voxel brightness variation (0.07) when the caller doesn't.
 */
export function meshData(m: PropModel, jitter = 0): MeshData {
    const solid = new Set<number>();
    for (let q = 0; q < m.count; q++) solid.add(KEY(m.pos[q * 3], m.pos[q * 3 + 1], m.pos[q * 3 + 2]));
    const P: number[] = [], N: number[] = [], C: number[] = [], S: number[] = [], I: number[] = [];
    const GP: number[] = [], GC: number[] = [], GI: number[] = [];
    const v = m.voxel;
    for (let q = 0; q < m.count; q++) {
        const i = m.pos[q * 3], j = m.pos[q * 3 + 1], k = m.pos[q * 3 + 2];
        const g = m.glow[q] === 1;
        const jt = g ? 1 : 1 + (hash3(i, j, k, 91) - 0.5) * 2 * jitter;
        const r = Math.min(1, (m.rgb[q * 3] / 255) * jt), gr = Math.min(1, (m.rgb[q * 3 + 1] / 255) * jt), b = Math.min(1, (m.rgb[q * 3 + 2] / 255) * jt);
        for (const f of FACES) {
            if (solid.has(KEY(i + f.d[0], j + f.d[1], k + f.d[2]))) continue;
            const pos = g ? GP : P, col = g ? GC : C, idx = g ? GI : I;
            const base = pos.length / 3;
            for (const c of f.v) {
                pos.push((i + c[0]) * v, (j + c[1]) * v, (k + c[2]) * v);
                col.push(r, gr, b);
                if (!g) { N.push(f.d[0], f.d[1], f.d[2]); S.push(m.sway[q] / 255); }
            }
            idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
    }
    return {
        position: new Float32Array(P), normal: new Float32Array(N), color: new Float32Array(C), sway: new Float32Array(S), index: new Uint32Array(I),
        glow: { position: new Float32Array(GP), color: new Float32Array(GC), index: new Uint32Array(GI) },
    };
}
