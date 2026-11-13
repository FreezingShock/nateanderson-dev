// Voxel builder for machine models. All coordinates are model-space voxels (10 per cell), y up.
// Boxes are half-open: box(0,0,0, 20,2,20) fills x 0..19, y 0..1, z 0..19.

import { TAG, type Axis, type ModelPart, type ModelState, type PortRef, type ModelLight, type VoxelModel, type Rot } from "../format";
import type { PartAnim as MachineAnim } from "../format";
import { PALETTE, GLOW_COLORS } from "./palette";

type PartAnim = MachineAnim;

export const VOX = 10; // voxels per cell
export const VOXEL_SIZE = 0.1;

type Grid = Map<number, number>;
// Pack x, y, z into one key. Models stay inside -512..511 on each axis.
const key = (x: number, y: number, z: number) => ((x + 512) << 20) | ((y + 512) << 10) | (z + 512);
const unkey = (k: number): [number, number, number] => [((k >> 20) & 1023) - 512, ((k >> 10) & 1023) - 512, (k & 1023) - 512];

interface PartDraft {
    id: string;
    pivot: [number, number, number];
    anim?: PartAnim;
    glow?: boolean;
    grid: Grid;
}

export interface AnimOpts {
    phase?: number;
    when?: ModelState;
    wave?: MachineAnim["wave"];
}

/** Spin about `axis` through the pivot, `speed` turns per second. */
export const spin = (axis: Axis, speed: number, o: AnimOpts = {}): PartAnim => ({ kind: "spin", axis, speed, amp: 0, phase: o.phase ?? 0, when: o.when ?? "working" });
/** Slide along `axis`, amp in voxels. `wave` "stamp" slams then lifts, "crank" follows a crank and rod. */
export const slide = (axis: Axis, amp: number, speed: number, o: AnimOpts = {}): PartAnim => ({ kind: "slide", axis, speed, amp, phase: o.phase ?? 0, when: o.when ?? "working", ...(o.wave && o.wave !== "sine" ? { wave: o.wave } : {}) });
/** Rock about `axis` through the pivot, amp in radians. Needs the "swing" kind in the shared format. */
export const swing = (axis: Axis, amp: number, speed: number, o: AnimOpts = {}): PartAnim => ({ kind: "swing", axis, speed, amp, phase: o.phase ?? 0, when: o.when ?? "working" });
/** Glow brightness pulse, amp 0..1. */
export const pulse = (speed: number, amp: number, o: AnimOpts = {}): PartAnim => ({ kind: "pulse", axis: "y", speed, amp, phase: o.phase ?? 0, when: o.when ?? "working" });

/** Perpendicular axes for a cylinder along `axis`: [a, b] index into [x, y, z]. */
const PERP: Record<Axis, [number, number, number]> = { x: [1, 2, 0], y: [0, 2, 1], z: [0, 1, 2] };

export class Builder {
    private parts: PartDraft[] = [];
    private cur: PartDraft;
    private ports: { in: PortRef[]; out: PortRef[] } = { in: [], out: [] };
    private lights: ModelLight[] = [];

    readonly id: string;
    readonly name: string;
    readonly w: number;
    readonly d: number;

    constructor(id: string, name: string, w: number, d: number) {
        this.id = id;
        this.name = name;
        this.w = w;
        this.d = d;
        this.cur = { id: "body", pivot: [0, 0, 0], grid: new Map() };
        this.parts.push(this.cur);
    }

    /** Footprint size in voxels. */
    get W() {
        return this.w * VOX;
    }
    get D() {
        return this.d * VOX;
    }

    /** Start a new part. Later shapes go into it until the next part() or body(). */
    part(id: string, pivot: [number, number, number], anim?: PartAnim, glow = false) {
        const found = this.parts.find((p) => p.id === id);
        if (found) {
            this.cur = found;
            return this;
        }
        this.cur = { id, pivot, anim, glow, grid: new Map() };
        this.parts.push(this.cur);
        return this;
    }

    body() {
        this.cur = this.parts[0];
        return this;
    }

    set(x: number, y: number, z: number, c: number) {
        this.cur.grid.set(key(x, y, z), c);
    }

    clear(x: number, y: number, z: number) {
        this.cur.grid.delete(key(x, y, z));
    }

    has(x: number, y: number, z: number) {
        return this.cur.grid.has(key(x, y, z));
    }

    box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number) {
        for (let x = Math.min(x0, x1); x < Math.max(x0, x1); x++)
            for (let y = Math.min(y0, y1); y < Math.max(y0, y1); y++) for (let z = Math.min(z0, z1); z < Math.max(z0, z1); z++) this.set(x, y, z, c);
        return this;
    }

    /** Remove voxels in a box from the current part. */
    carve(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
        for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) this.clear(x, y, z);
        return this;
    }

    /** Hollow box frame: only the 12 edges, `t` voxels thick. */
    frame(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, t: number, c: number) {
        for (let x = x0; x < x1; x++)
            for (let y = y0; y < y1; y++)
                for (let z = z0; z < z1; z++) {
                    const ex = x < x0 + t || x >= x1 - t;
                    const ey = y < y0 + t || y >= y1 - t;
                    const ez = z < z0 + t || z >= z1 - t;
                    if ((ex ? 1 : 0) + (ey ? 1 : 0) + (ez ? 1 : 0) >= 2) this.set(x, y, z, c);
                }
        return this;
    }

    /**
     * Cylinder along `axis`. (ca, cb) is the centre on the two other axes (x,z for y; y,z for x; x,y for z),
     * in voxel coordinates where a voxel's centre is v + 0.5. a0..a1 is the half-open range along the axis.
     * `inner` leaves a hole (a ring or a tube).
     */
    cyl(axis: Axis, ca: number, cb: number, r: number, a0: number, a1: number, c: number, inner = -1) {
        const [ia, ib, iax] = PERP[axis];
        const p = [0, 0, 0];
        for (let a = Math.floor(ca - r - 1); a <= Math.ceil(ca + r + 1); a++)
            for (let b = Math.floor(cb - r - 1); b <= Math.ceil(cb + r + 1); b++) {
                const dist = Math.hypot(a + 0.5 - ca, b + 0.5 - cb);
                if (dist > r || dist < inner) continue;
                for (let t = a0; t < a1; t++) {
                    p[ia] = a;
                    p[ib] = b;
                    p[iax] = t;
                    this.set(p[0], p[1], p[2], c);
                }
            }
        return this;
    }

    /** A spur gear along `axis`: solid to rRoot, teeth out to rTip. `hole` leaves an axle hole. */
    gear(axis: Axis, ca: number, cb: number, rRoot: number, rTip: number, teeth: number, a0: number, a1: number, c: number, o: { hole?: number; spokes?: number; rim?: number; phase?: number; hub?: number } = {}) {
        const [ia, ib, iax] = PERP[axis];
        const p = [0, 0, 0];
        const ph = o.phase ?? 0;
        for (let a = Math.floor(ca - rTip - 1); a <= Math.ceil(ca + rTip + 1); a++)
            for (let b = Math.floor(cb - rTip - 1); b <= Math.ceil(cb + rTip + 1); b++) {
                const da = a + 0.5 - ca;
                const db = b + 0.5 - cb;
                const dist = Math.hypot(da, db);
                if (dist > rTip) continue;
                if (o.hole !== undefined && dist < o.hole) continue;
                const ang = Math.atan2(db, da);
                let on = dist <= rRoot;
                if (!on) {
                    const f = (((ang / (Math.PI * 2)) * teeth + ph) % 1 + 1) % 1;
                    on = f < 0.5;
                }
                // Spoked wheel: a rim and a hub joined by spokes, open between them.
                if (on && o.spokes && o.rim !== undefined && dist < rRoot - o.rim && dist > (o.hub ?? 2)) {
                    const sf = (((ang / (Math.PI * 2)) * o.spokes) % 1 + 1) % 1;
                    const half = 0.9 / Math.max(dist, 1) / ((Math.PI * 2) / o.spokes);
                    if (sf > half && sf < 1 - half) on = false;
                }
                if (!on) continue;
                for (let t = a0; t < a1; t++) {
                    p[ia] = a;
                    p[ib] = b;
                    p[iax] = t;
                    this.set(p[0], p[1], p[2], c);
                }
            }
        return this;
    }

    /** Spoked flywheel: a gear with no teeth, a rim, spokes and a hub. */
    wheel(axis: Axis, ca: number, cb: number, r: number, a0: number, a1: number, c: number, spokes = 4, rim = 2) {
        return this.gear(axis, ca, cb, r, r, 1, a0, a1, c, { spokes, rim, hub: 1.6 });
    }

    sphere(cx: number, cy: number, cz: number, r: number, c: number, yMin = -1e9) {
        for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++)
            for (let y = Math.max(Math.floor(cy - r - 1), yMin); y <= Math.ceil(cy + r + 1); y++)
                for (let z = Math.floor(cz - r - 1); z <= Math.ceil(cz + r + 1); z++)
                    if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy, z + 0.5 - cz) <= r) this.set(x, y, z, c);
        return this;
    }

    /** Tapered column along y from radius r0 at y0 to r1 at y1. */
    taper(cx: number, cz: number, r0: number, r1: number, y0: number, y1: number, c: number) {
        for (let y = y0; y < y1; y++) {
            const t = (y - y0) / Math.max(1, y1 - y0 - 1);
            this.cyl("y", cx, cz, r0 + (r1 - r0) * t, y, y + 1, c);
        }
        return this;
    }

    /** A rod of square section from p to q (voxel centres), `t` voxels thick. */
    rod(p: [number, number, number], q: [number, number, number], t: number, c: number) {
        const n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) * 2) + 1;
        const h = Math.floor(t / 2);
        for (let i = 0; i <= n; i++) {
            const f = i / n;
            const x = Math.round(p[0] + (q[0] - p[0]) * f);
            const y = Math.round(p[1] + (q[1] - p[1]) * f);
            const z = Math.round(p[2] + (q[2] - p[2]) * f);
            for (let a = -h; a < t - h; a++) for (let b = -h; b < t - h; b++) for (let e = -h; e < t - h; e++) this.set(x + a, y + b, z + e, c);
        }
        return this;
    }

    /** Recolour every voxel of the current part inside a box that matches `from` (or any colour if from < 0). */
    paint(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number, from = -1) {
        for (let x = x0; x < x1; x++)
            for (let y = y0; y < y1; y++)
                for (let z = z0; z < z1; z++) {
                    const k = key(x, y, z);
                    const v = this.cur.grid.get(k);
                    if (v !== undefined && (from < 0 || v === from)) this.cur.grid.set(k, c);
                }
        return this;
    }

    /** Brass rivets: single light voxels on a face, every `step` voxels. */
    rivets(x0: number, x1: number, y: number, z: number, step: number, c: number) {
        for (let x = x0; x < x1; x += step) this.set(x, y, z, c);
        return this;
    }

    input(cx: number, cz: number, side: Rot) {
        this.ports.in.push({ cell: { x: cx, z: cz }, side });
        return this;
    }

    output(cx: number, cz: number, side: Rot) {
        this.ports.out.push({ cell: { x: cx, z: cz }, side });
        return this;
    }

    /** pos in cells (model units); stored in voxels as the format wants. */
    light(pos: [number, number, number], color: number, intensity: number, distance: number, when: ModelLight["when"] = "working") {
        this.lights.push({ pos: [pos[0] * VOX, pos[1] * VOX, pos[2] * VOX], color, intensity, distance, when });
        return this;
    }

    /** Swap palette colours across every part, e.g. to give a machine family its own body tone. */
    retone(map: Record<number, number>) {
        for (const p of this.parts) for (const [k, c] of p.grid) if (map[c] !== undefined) p.grid.set(k, map[c]);
        return this;
    }

    /**
     * Pack into the shared format. Pivots are snapped down to whole voxels (pos is Int16 relative to the
     * pivot), so author spinning parts with their centre on a voxel grid line across the spin axis.
     * Every voxel is stored; the loader culls faces between neighbours.
     */
    build(): VoxelModel {
        const parts: ModelPart[] = [];
        let top = 0;
        const lo = [1e9, 1e9, 1e9];
        const hi = [-1e9, -1e9, -1e9];
        for (const p of this.parts) {
            const keys = [...p.grid.keys()].sort((a, b) => a - b);
            if (!keys.length) continue;
            const pv: [number, number, number] = [Math.floor(p.pivot[0]), Math.floor(p.pivot[1]), Math.floor(p.pivot[2])];
            if (p.anim && (p.anim.kind === "spin" || p.anim.kind === "swing")) {
                const ax = "xyz".indexOf(p.anim.axis);
                for (let a = 0; a < 3; a++)
                    if (a !== ax && p.pivot[a] !== pv[a]) throw new Error(`${this.id}/${p.id}: turning part needs a whole-voxel pivot across its axis, got ${p.pivot}`);
            }
            const pos = new Int16Array(keys.length * 3);
            const colors = new Uint8Array(keys.length);
            const tags = new Uint8Array(keys.length);
            let anyGlow = false;
            keys.forEach((k, i) => {
                const v = unkey(k);
                for (let a = 0; a < 3; a++) {
                    pos[i * 3 + a] = v[a] - pv[a];
                    lo[a] = Math.min(lo[a], v[a]);
                    hi[a] = Math.max(hi[a], v[a] + 1);
                }
                if (v[1] + 1 > top) top = v[1] + 1;
                const c = p.grid.get(k)!;
                colors[i] = c;
                const glow = !!p.glow || GLOW_COLORS.includes(c);
                tags[i] = glow ? TAG.GLOW : TAG.SOLID;
                if (glow) anyGlow = true;
            });
            const part: ModelPart = { id: p.id, pivot: pv, pos, colors };
            if (anyGlow) part.tags = tags;
            if (p.anim) part.anim = p.anim;
            parts.push(part);
        }
        return {
            id: this.id,
            voxel: VOXEL_SIZE,
            size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
            footprint: { w: this.w, d: this.d },
            palette: [...PALETTE],
            parts,
            ports: this.ports,
            lights: this.lights,
        };
    }
}
