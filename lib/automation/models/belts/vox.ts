// Voxel authoring and meshing for the logistics kit.
// Three-free on purpose: this file loads in plain Node for the tests.
//
// Units: one grid cell is 1 unit and holds 10 x 10 voxels of 0.1 (LOOK-SPEC).
// A piece is authored in voxel indices with the cell's min corner at (0, 0, 0)
// and +z as the flow direction (rot 0 in lib/automation/types.ts).

export const VOX = 0.1;

/** How a voxel moves. Everything that moves is animated on the GPU. */
export const Motion = {
    Static: 0,
    /** Belt slat: slides along a path, wraps every `len` path units. */
    Slat: 1,
    /** Spins around a pivot and axis. Rate in radians per cell travelled. */
    Spin: 2,
} as const;
export type Motion = (typeof Motion)[keyof typeof Motion];

export interface SlatInfo {
    /** Path id (see paths.ts). */
    path: number;
    /** Rest distance along the path, in path units (cells). */
    rest: number;
    /** Path length in path units (1 for a full cell, 0.5 for a half). */
    len: number;
    /** Slat template centre, in units, in the template frame (x across, y up, z along). */
    centre: [number, number, number];
}

export interface SpinInfo {
    pivot: [number, number, number];
    axis: [number, number, number];
    /** Radians per cell of belt travel. Negative spins the other way. */
    rate: number;
}

export interface Voxel {
    i: number;
    j: number;
    k: number;
    color: number;
    /** Voxels only cull faces against voxels of the same group (moving parts are separate groups). */
    group: number;
    motion: Motion;
    slat?: SlatInfo;
    spin?: SpinInfo;
    /** Unlit glow voxel (lamp, furnace window). Rendered brighter. */
    glow?: boolean;
}

/** Plain typed arrays, ready to hand to a BufferGeometry. */
export interface MeshData {
    position: Float32Array;
    normal: Float32Array;
    color: Float32Array;
    /** Motion per vertex. */
    motion: Float32Array;
    /** Slat: offset in the slat frame. Spin: pivot. Static: zero. */
    a: Float32Array;
    /** Slat: (rest, path id, len, 0). Spin: (axis * rate, 0). Static: (0, 0, 0, glow). */
    b: Float32Array;
    index: Uint32Array;
    triangles: number;
}

const key = (g: number, i: number, j: number, k: number) => `${g}|${i}|${j}|${k}`;

/** Collects voxels for one piece. Later writes replace earlier ones in the same group. */
export class VoxelSet {
    readonly map = new Map<string, Voxel>();
    private nextGroup = 1;

    newGroup(): number {
        return this.nextGroup++;
    }

    put(i: number, j: number, k: number, color: number, extra?: Partial<Voxel>): void {
        const group = extra?.group ?? 0;
        this.map.set(key(group, i, j, k), {
            i,
            j,
            k,
            color,
            group,
            motion: extra?.motion ?? Motion.Static,
            slat: extra?.slat,
            spin: extra?.spin,
            glow: extra?.glow,
        });
    }

    has(i: number, j: number, k: number, group = 0): boolean {
        return this.map.has(key(group, i, j, k));
    }

    get(i: number, j: number, k: number, group = 0): Voxel | undefined {
        return this.map.get(key(group, i, j, k));
    }

    remove(i: number, j: number, k: number, group = 0): void {
        this.map.delete(key(group, i, j, k));
    }

    /** Fill an inclusive box of voxel indices. */
    box(i0: number, j0: number, k0: number, i1: number, j1: number, k1: number, color: number, extra?: Partial<Voxel>): void {
        for (let i = Math.min(i0, i1); i <= Math.max(i0, i1); i++)
            for (let j = Math.min(j0, j1); j <= Math.max(j0, j1); j++)
                for (let k = Math.min(k0, k1); k <= Math.max(k0, k1); k++) this.put(i, j, k, color, extra);
    }

    get size(): number {
        return this.map.size;
    }

    voxels(): Voxel[] {
        return [...this.map.values()];
    }

    /** Mirror across the cell's x centre (i -> 9 - i for a 10-wide cell). Static voxels only. */
    mirrorX(width = 10): VoxelSet {
        const out = new VoxelSet();
        for (const v of this.map.values()) {
            out.put(width - 1 - v.i, v.j, v.k, v.color, { ...v });
        }
        out.nextGroup = this.nextGroup;
        return out;
    }
}

// Per-voxel brightness jitter of about +-7% (LOOK-SPEC), same hash as the reference scene.
export function jitter(i: number, j: number, k: number): number {
    const h = (((i * 7 + j * 13 + k * 5) % 5) + 5) % 5;
    return 1 + (h - 2) * 0.035;
}

export function hexToRgb(hex: number): [number, number, number] {
    // sRGB to linear, the same conversion Three applies to colours.
    const f = (c: number) => {
        const s = c / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return [f((hex >> 16) & 255), f((hex >> 8) & 255), f(hex & 255)];
}

// Face table: normal, then the 4 corners (unit cube) counter-clockwise seen from outside.
const FACES: { n: [number, number, number]; c: [number, number, number][] }[] = [
    { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
    { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
    { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
    { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
    { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

export interface MeshOptions {
    /** Rest position of a slat vertex from its frame offset, so bounds and the shadow pass look right. */
    restSlat?: (slat: SlatInfo, offset: [number, number, number]) => [number, number, number];
    /** Glow voxels get this brightness multiplier in the vertex colour. */
    glowBoost?: number;
}

/**
 * Face mesher with greedy merging: only faces that do not touch another voxel of the
 * same group are kept (the reference scene's hollow cull taken one step further),
 * and coplanar neighbour faces with the same final colour merge into one quad.
 * The jitter hash is constant along z, so belt runs collapse into long strips.
 */
export function meshVoxels(set: VoxelSet, opts: MeshOptions = {}): MeshData {
    const pos: number[] = [];
    const nor: number[] = [];
    const col: number[] = [];
    const mo: number[] = [];
    const a: number[] = [];
    const b: number[] = [];
    const idx: number[] = [];
    const glowBoost = opts.glowBoost ?? 1.6;

    // Bucket voxels by group: moving parts never merge with each other or with static voxels.
    const groups = new Map<number, Voxel[]>();
    for (const v of set.map.values()) {
        let g = groups.get(v.group);
        if (!g) groups.set(v.group, (g = []));
        g.push(v);
    }

    const emit = (v: Voxel, f: (typeof FACES)[number], corners: [number, number, number][], rgb: [number, number, number]) => {
        const base = pos.length / 3;
        for (const p of corners) {
            let rest = p;
            let av: [number, number, number] = [0, 0, 0];
            let bv: [number, number, number, number] = [0, 0, 0, 0];
            if (v.motion === Motion.Slat && v.slat) {
                av = [p[0] - v.slat.centre[0], p[1] - v.slat.centre[1], p[2] - v.slat.centre[2]];
                bv = [v.slat.rest, v.slat.path, v.slat.len, 0];
                if (opts.restSlat) rest = opts.restSlat(v.slat, av);
            } else if (v.motion === Motion.Spin && v.spin) {
                av = v.spin.pivot;
                const { axis, rate } = v.spin;
                const l = Math.hypot(axis[0], axis[1], axis[2]) || 1;
                bv = [(axis[0] / l) * rate, (axis[1] / l) * rate, (axis[2] / l) * rate, 0];
            } else if (v.glow) {
                bv = [0, 0, 0, 1];
            }
            pos.push(rest[0], rest[1], rest[2]);
            nor.push(f.n[0], f.n[1], f.n[2]);
            col.push(rgb[0], rgb[1], rgb[2]);
            mo.push(v.motion);
            a.push(av[0], av[1], av[2]);
            b.push(bv[0], bv[1], bv[2], bv[3]);
        }
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };

    for (const [g, list] of groups) {
        for (let fi = 0; fi < 6; fi++) {
            const f = FACES[fi];
            const axis = f.n[0] ? 0 : f.n[1] ? 1 : 2;
            const ua = axis === 0 ? 1 : 0; // first in-plane axis
            const va = axis === 2 ? 1 : 2; // second in-plane axis
            // Visible faces in this direction, keyed by slice then (u, v).
            const slices = new Map<number, Map<string, { v: Voxel; key: string; rgb: [number, number, number] }>>();
            for (const v of list) {
                if (set.has(v.i + f.n[0], v.j + f.n[1], v.k + f.n[2], g)) continue;
                const c = [v.i, v.j, v.k];
                const base = hexToRgb(v.color);
                const jit = v.glow ? glowBoost : jitter(v.i, v.j, v.k);
                const rgb: [number, number, number] = [base[0] * jit, base[1] * jit, base[2] * jit];
                const key = `${v.color}|${jit}|${v.glow ? 1 : 0}`;
                let sl = slices.get(c[axis]);
                if (!sl) slices.set(c[axis], (sl = new Map()));
                sl.set(`${c[ua]},${c[va]}`, { v, key, rgb });
            }
            for (const [d, sl] of slices) {
                const done = new Set<string>();
                const entries = [...sl.entries()].map(([k, e]) => {
                    const [u, w] = k.split(",").map(Number);
                    return { u, w, e };
                });
                entries.sort((p, q) => p.w - q.w || p.u - q.u);
                for (const { u, w, e } of entries) {
                    if (done.has(`${u},${w}`)) continue;
                    // Moving voxels keep per-voxel quads (their offsets are per vertex anyway, but the
                    // template is tiny); static faces grow greedily in u, then in w.
                    let du = 1,
                        dw = 1;
                    const same = (uu: number, ww: number) => {
                        const o = sl.get(`${uu},${ww}`);
                        return !!o && o.key === e.key && !done.has(`${uu},${ww}`);
                    };
                    while (same(u + du, w)) du++;
                    grow: while (true) {
                        for (let x = 0; x < du; x++) if (!same(u + x, w + dw)) break grow;
                        dw++;
                    }
                    for (let x = 0; x < du; x++) for (let y = 0; y < dw; y++) done.add(`${u + x},${w + y}`);
                    const corners: [number, number, number][] = f.c.map((cc) => {
                        const p = [0, 0, 0];
                        p[axis] = (d + cc[axis]) * VOX;
                        p[ua] = (u + cc[ua] * du) * VOX;
                        p[va] = (w + cc[va] * dw) * VOX;
                        return p as [number, number, number];
                    });
                    emit(e.v, f, corners, e.rgb);
                }
            }
        }
    }
    return {
        position: new Float32Array(pos),
        normal: new Float32Array(nor),
        color: new Float32Array(col),
        motion: new Float32Array(mo),
        a: new Float32Array(a),
        b: new Float32Array(b),
        index: new Uint32Array(idx),
        triangles: idx.length / 3,
    };
}
