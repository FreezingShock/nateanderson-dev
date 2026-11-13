import { TAG, type VoxelModel } from "../format";

// A small voxel builder for resource models. Pure data, no three.js, so the
// models load in Node for tests and the renderer meshes them as it likes.
//
// Units: one voxel is 0.1 world units. x and z are voxel indices with the cell
// centre between -1 and 0 (a 1x1 cell spans -5..4), y = 0 is the first layer
// above the ground.

export const VOXEL = 0.1;
/** Voxels across one board cell. */
export const CELL = 10;

/** Per-voxel render hint. Solid is lit normally, Glow is unlit and bright, Glint twinkles now and then (see glintPhase). */
export const Tag = { Solid: 0, Glow: 1, Glint: 2 } as const;
export type Tag = (typeof Tag)[keyof typeof Tag];

/** Raw builder output, cell-centred. `toModel` converts it to the shared format. */
export interface VoxelData {
    /** Edge length of one voxel in world units. */
    voxel: number;
    count: number;
    /** x, y, z per voxel in voxel units. */
    pos: Int16Array;
    /** 0xRRGGBB per voxel. The loader adds the +-7% jitter, so none is applied here. */
    color: Uint32Array;
    tag: Uint8Array;
    /** Inclusive bounds in voxel units. */
    min: [number, number, number];
    max: [number, number, number];
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
    let a = seed >>> 0 || 0x9e3779b9;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Cheap hash for per-voxel variation that does not depend on build order. */
export function hash3(x: number, y: number, z: number, s = 0): number {
    let h =
        Math.imul(x | 0, 374761393) ^
        Math.imul(y | 0, 668265263) ^
        Math.imul(z | 0, 2147483647) ^
        Math.imul(s | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Phase in 0..1 used to stagger glint twinkles so they never fire together. */
export function glintPhase(x: number, y: number, z: number): number {
    return hash3(x, y, z, 77);
}

export function scale(c: number, f: number): number {
    const r = Math.min(255, Math.round(((c >> 16) & 255) * f));
    const g = Math.min(255, Math.round(((c >> 8) & 255) * f));
    const b = Math.min(255, Math.round((c & 255) * f));
    return (r << 16) | (g << 8) | b;
}

export function mix(a: number, b: number, t: number): number {
    const ch = (s: number) =>
        Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

type Paint = number | ((x: number, y: number, z: number) => number);
const key = (x: number, y: number, z: number) =>
    ((x + 512) << 20) | ((y + 512) << 10) | (z + 512);

export class VoxelBuilder {
    private map = new Map<number, [number, number, number, number, Tag]>();

    has(x: number, y: number, z: number): boolean {
        return this.map.has(key(x, y, z));
    }
    get(x: number, y: number, z: number): number | undefined {
        return this.map.get(key(x, y, z))?.[3];
    }
    set(
        x: number,
        y: number,
        z: number,
        color: number,
        tag: Tag = Tag.Solid
    ): void {
        this.map.set(key(x, y, z), [x, y, z, color, tag]);
    }
    /** Only fills empty voxels. */
    add(
        x: number,
        y: number,
        z: number,
        color: number,
        tag: Tag = Tag.Solid
    ): void {
        if (!this.has(x, y, z)) this.set(x, y, z, color, tag);
    }
    del(x: number, y: number, z: number): void {
        this.map.delete(key(x, y, z));
    }
    /** Recolour voxels that already exist. */
    paint(
        test: (x: number, y: number, z: number, c: number) => number | null,
        tag?: Tag
    ): void {
        for (const v of this.map.values()) {
            const c = test(v[0], v[1], v[2], v[3]);
            if (c !== null) {
                v[3] = c;
                if (tag !== undefined) v[4] = tag;
            }
        }
    }
    retag(
        test: (x: number, y: number, z: number, c: number) => Tag | null
    ): void {
        for (const v of this.map.values()) {
            const t = test(v[0], v[1], v[2], v[3]);
            if (t !== null) v[4] = t;
        }
    }
    each(
        fn: (x: number, y: number, z: number, c: number, t: Tag) => void
    ): void {
        for (const v of this.map.values()) fn(v[0], v[1], v[2], v[3], v[4]);
    }
    get size(): number {
        return this.map.size;
    }

    private c(p: Paint, x: number, y: number, z: number): number {
        return typeof p === "number" ? p : p(x, y, z);
    }

    box(
        x0: number,
        y0: number,
        z0: number,
        x1: number,
        y1: number,
        z1: number,
        p: Paint,
        tag: Tag = Tag.Solid
    ): void {
        for (let x = x0; x <= x1; x++)
            for (let y = y0; y <= y1; y++)
                for (let z = z0; z <= z1; z++)
                    this.set(x, y, z, this.c(p, x, y, z), tag);
    }

    /** Filled ellipsoid centred on (cx, cy, cz) in voxel units (fractions allowed). */
    blob(
        cx: number,
        cy: number,
        cz: number,
        rx: number,
        ry: number,
        rz: number,
        p: Paint,
        onlyAboveGround = true
    ): void {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
            for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
                for (
                    let z = Math.floor(cz - rz);
                    z <= Math.ceil(cz + rz);
                    z++
                ) {
                    if (onlyAboveGround && y < 0) continue;
                    const a = (x + 0.5 - cx) / rx,
                        b = (y + 0.5 - cy) / ry,
                        c = (z + 0.5 - cz) / rz;
                    if (a * a + b * b + c * c <= 1)
                        this.set(x, y, z, this.c(p, x, y, z));
                }
    }

    /**
     * Hexagonal-ish prism along a tilted axis, tapering to a point.
     * (bx, bz) base centre, h height in voxels, r radius, (tx, tz) lean per layer.
     */
    crystal(
        bx: number,
        by: number,
        bz: number,
        h: number,
        r: number,
        tx: number,
        tz: number,
        p: (t: number, x: number, y: number, z: number) => number,
        tagTip = true
    ): void {
        for (let j = 0; j < h; j++) {
            const t = j / Math.max(1, h - 1);
            const cx = bx + tx * j,
                cz = bz + tz * j;
            // straight body, then a point over the last 35%
            const rr = t < 0.65 ? r : r * (1 - (t - 0.65) / 0.35) + 0.25;
            for (
                let x = Math.floor(cx - rr - 1);
                x <= Math.ceil(cx + rr + 1);
                x++
            )
                for (
                    let z = Math.floor(cz - rr - 1);
                    z <= Math.ceil(cz + rr + 1);
                    z++
                ) {
                    const dx = Math.abs(x + 0.5 - cx),
                        dz = Math.abs(z + 0.5 - cz);
                    // hexagon test: |x| + |z|/2 style (flat sides)
                    if (Math.max(dx * 0.866 + dz * 0.5, dz) <= rr) {
                        const y = by + j;
                        if (y < 0) continue;
                        const tip = tagTip && j >= h - 2;
                        this.set(
                            x,
                            y,
                            z,
                            p(t, x, y, z),
                            tip ? Tag.Glint : Tag.Solid
                        );
                    }
                }
        }
    }

    /** Rotate a quarter turn n times around the cell centre (voxel -0.5, -0.5). */
    rotate(n: number): void {
        n = ((n % 4) + 4) % 4;
        if (!n) return;
        const old = [...this.map.values()];
        this.map.clear();
        for (const v of old) {
            let x = v[0],
                z = v[2];
            for (let i = 0; i < n; i++) {
                const nx = -1 - z;
                z = x;
                x = nx;
            }
            this.set(x, v[1], z, v[3], v[4]);
        }
    }
    mirrorX(): void {
        const old = [...this.map.values()];
        this.map.clear();
        for (const v of old) this.set(-1 - v[0], v[1], v[2], v[3], v[4]);
    }

    /** Drop voxels outside a footprint so a model never spills into the next cell. */
    clip(x0: number, x1: number, z0: number, z1: number): void {
        for (const [k, v] of this.map)
            if (v[0] < x0 || v[0] > x1 || v[2] < z0 || v[2] > z1)
                this.map.delete(k);
    }

    /** Hollow-cull and pack. Jitter is left at 0: the shared loader applies it. */
    build(jitter = 0): VoxelData {
        const keep: [number, number, number, number, Tag][] = [];
        for (const v of this.map.values()) {
            const [x, y, z] = v;
            const buried =
                this.has(x + 1, y, z) &&
                this.has(x - 1, y, z) &&
                this.has(x, y + 1, z) &&
                this.has(x, y - 1, z) &&
                this.has(x, y, z + 1) &&
                this.has(x, y, z - 1);
            if (!buried) keep.push(v);
        }
        keep.sort((a, b) => a[1] - b[1] || a[0] - b[0] || a[2] - b[2]);
        const n = keep.length;
        const pos = new Int16Array(n * 3),
            color = new Uint32Array(n),
            tag = new Uint8Array(n);
        const min: [number, number, number] = [1e9, 1e9, 1e9],
            max: [number, number, number] = [-1e9, -1e9, -1e9];
        keep.forEach((v, i) => {
            pos[i * 3] = v[0];
            pos[i * 3 + 1] = v[1];
            pos[i * 3 + 2] = v[2];
            const j =
                v[4] === Tag.Glow
                    ? 1
                    : 1 + (hash3(v[0], v[1], v[2]) * 2 - 1) * jitter;
            color[i] = scale(v[3], j);
            tag[i] = v[4];
            for (let a = 0; a < 3; a++) {
                if (v[a] < min[a]) min[a] = v[a];
                if (v[a] > max[a]) max[a] = v[a];
            }
        });
        return { voxel: VOXEL, count: n, pos, color, tag, min, max };
    }
}

/**
 * Converts builder output to the shared Brasswork model format: origin at the
 * footprint's min corner (cell centre moves to 5, 5), an indexed palette, and
 * glint tags. One part, static.
 */
export function toModel(
    id: string,
    data: VoxelData,
    footprint?: { w: number; d: number }
): VoxelModel {
    const palette: number[] = [];
    const index = new Map<number, number>();
    const pos = new Int16Array(data.count * 3);
    const colors = new Uint8Array(data.count);
    const tags = new Uint8Array(data.count);
    for (let i = 0; i < data.count; i++) {
        pos[i * 3] = data.pos[i * 3] + CELL / 2;
        pos[i * 3 + 1] = data.pos[i * 3 + 1];
        pos[i * 3 + 2] = data.pos[i * 3 + 2] + CELL / 2;
        const c = data.color[i];
        let k = index.get(c);
        if (k === undefined) {
            k = palette.length;
            if (k > 255) throw new Error(`model ${id}: more than 256 colours`);
            palette.push(c);
            index.set(c, k);
        }
        colors[i] = k;
        tags[i] =
            data.tag[i] === Tag.Glint
                ? TAG.GLINT
                : data.tag[i] === Tag.Glow
                  ? TAG.GLOW
                  : TAG.SOLID;
    }
    const model: VoxelModel = {
        id,
        voxel: VOXEL,
        size: [CELL, data.max[1] + 1, CELL],
        palette,
        parts: [{ id: "body", pivot: [0, 0, 0], pos, colors, tags }],
    };
    if (footprint) model.footprint = footprint;
    return model;
}
