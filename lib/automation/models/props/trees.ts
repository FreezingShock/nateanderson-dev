// Tree species for the island. Each generator takes a seed and returns a
// unique variant, so a forest never repeats the same silhouette.
import { BARK, LEAF } from "./palette";
import { Vox, clamp, hash3, mix, noise3, rng, smooth, type PropModel, type Vec3 } from "./vox";

type Leaves = readonly number[];

/** Leaf colour: broad noise patches across the species' greens. */
function leafPaint(pal: Leaves, seed: number) {
    return (i: number, j: number, k: number) => {
        const n = noise3(i * 0.18, j * 0.18, k * 0.18, seed);
        const idx = clamp(Math.floor(n * pal.length * 1.2 - 0.1 * pal.length), 0, pal.length - 1);
        const fleck = hash3(i, j, k, seed + 3);
        return fleck < 0.08 ? pal[(idx + 1) % pal.length] : pal[idx];
    };
}

function barkPaint(a: number, b: number, seed: number, moss = 0) {
    return (i: number, j: number, k: number) => {
        // Vertical streaks with a little moss at the foot.
        const streak = noise3(i * 0.9, j * 0.15, k * 0.9, seed) > 0.62;
        if (moss && j < moss && hash3(i, j, k, seed) < 0.55 - j * 0.12) return BARK.moss;
        return streak ? b : a;
    };
}

/** Post pass on leaf cells: lighten sun-facing tops, break up the outline. */
function finishLeaves(v: Vox, leafSet: Set<number>, lit: number, seed: number, thin = 0.3) {
    const toDel: Vec3[] = [];
    v.forEach((i, j, k, c) => {
        if (!leafSet.has(c.c)) return;
        const open = +!v.has(i + 1, j, k) + +!v.has(i - 1, j, k) + +!v.has(i, j, k + 1) + +!v.has(i, j, k - 1) + +!v.has(i, j + 1, k) + +!v.has(i, j - 1, k);
        if (open >= 3 && hash3(i, j, k, seed + 7) < thin) toDel.push([i, j, k]);
    });
    for (const [i, j, k] of toDel) v.del(i, j, k);
    v.forEach((i, j, k, c) => {
        if (!leafSet.has(c.c)) return;
        if (!v.has(i, j + 1, k)) c.c = mix(c.c, lit, 0.35 + hash3(i, j, k, seed + 9) * 0.35);
        else if (!v.has(i, j - 1, k)) c.c = mix(c.c, 0x1c2a14, 0.18);
    });
}

/** Shared tree wind: trunk base is rooted, the crown and outer leaves move most. */
function treeSway(height: number, reach: number) {
    return (i: number, j: number, k: number) => {
        const h = smooth(0, height, j);
        const r = clamp(Math.hypot(i + 0.5, k + 0.5) / Math.max(1, reach), 0, 1);
        return h * h * (0.55 + 0.45 * r);
    };
}

function trunk(v: Vox, height: number, r0: number, r1: number, paint: (i: number, j: number, k: number) => number, lean: [number, number] = [0, 0], roots = 4, seed = 0) {
    const R = rng(seed);
    for (let j = 0; j < height; j++) {
        const t = j / height;
        const r = r0 + (r1 - r0) * Math.sqrt(t);
        v.cyl(lean[0] * t * t, lean[1] * t * t, j, j + 1, r, paint);
    }
    // Root flare.
    for (let n = 0; n < roots; n++) {
        const a = (n / roots) * Math.PI * 2 + R() * 0.8;
        const len = r0 + 1.5 + R() * 2;
        v.line([0, 1.5, 0], [Math.cos(a) * len, 0, Math.sin(a) * len], r0 * 0.55, 0.5, paint);
    }
}

const leafKeys = (v: Vox, before: Set<number>) => {
    const s = new Set<number>();
    v.forEach((_i, _j, _k, c) => { if (!before.has(c.c)) s.add(c.c); });
    return s;
};

/** Broadleaf oak: thick trunk, 3 to 5 limbs, a crown of lumpy leaf clusters. */
export function oak(seed: number, autumn = false): PropModel {
    const R = rng(seed * 31 + 1);
    const v = new Vox(`tree.${autumn ? "maple" : "oak"}.${seed}`);
    const H = 14 + Math.floor(R() * 6);
    const r0 = 2.4 + R() * 0.7;
    const bark = barkPaint(BARK.oak, BARK.oakD, seed, 3);
    trunk(v, H, r0, 1.5, bark, [0, 0], 4 + Math.floor(R() * 2), seed);
    const limbs = 3 + Math.floor(R() * 3);
    const ends: Vec3[] = [[0, H + 4, 0]];
    for (let n = 0; n < limbs; n++) {
        const a = (n / limbs) * Math.PI * 2 + R() * 0.9;
        const y0 = H * (0.6 + R() * 0.35);
        const len = 7 + R() * 5;
        const e: Vec3 = [Math.cos(a) * len * (autumn ? 0.6 : 1), y0 + 5 + R() * 5 + (autumn ? 4 : 0), Math.sin(a) * len * (autumn ? 0.6 : 1)];
        v.line([0, y0, 0], e, 1.3, 0.6, bark);
        ends.push(e);
    }
    const pal = autumn ? LEAF.maple : LEAF.oak;
    const before = new Set<number>([BARK.oak, BARK.oakD, BARK.moss]);
    const paint = leafPaint(pal, seed);
    const reach = 6.5 + R() * 2.5;
    for (const [n, e] of ends.entries()) {
        const r = n === 0 ? reach + 1.5 : reach * (0.75 + R() * 0.4);
        const tall = autumn ? 1.15 : 0.7;
        const pull = autumn ? 0.55 : 1;
        v.ellipsoid(e[0] * pull, e[1] + 1 + (autumn ? 3 : 0), e[2] * pull, r * (autumn ? 0.85 : 1), r * (tall + R() * 0.15), r * (autumn ? 0.85 : 0.9 + R() * 0.2), paint, 0.28, seed + n, { keep: true });
    }
    // A few small satellite clusters so the crown isn't a perfect ball.
    for (let n = 0; n < 3; n++) {
        const a = R() * Math.PI * 2, d = reach + 2 + R() * 2;
        v.ellipsoid(Math.cos(a) * d, H + 2 + R() * 7, Math.sin(a) * d, 3.2, 2.6, 3.2, paint, 0.3, seed + 40 + n, { keep: true });
    }
    finishLeaves(v, leafKeys(v, before), autumn ? LEAF.mapleLit : LEAF.oakLit, seed);
    return v.build({ sway: treeSway(H + reach * 2, reach * 2 + 4) });
}

export const maple = (seed: number) => oak(seed, true);

/** Conifer: straight trunk with drooping tiers of needles and a spire. */
export function pine(seed: number): PropModel {
    const R = rng(seed * 17 + 5);
    const v = new Vox(`tree.pine.${seed}`);
    const H = 34 + Math.floor(R() * 10);
    const bark = barkPaint(BARK.pine, BARK.pineD, seed);
    trunk(v, H, 2.0, 0.7, bark, [0, 0], 4, seed);
    const tiers = 6 + Math.floor(R() * 2);
    const base = 6 + Math.floor(R() * 3);
    const Rmax = 13 + R() * 3;
    const leaves = leafPaint(LEAF.pine, seed);
    for (let t = 0; t < tiers; t++) {
        const f = t / (tiers - 1);
        const y = base + (H - base) * f;
        const rad = Math.max(2.6, Rmax * (1 - f * 0.8) + R() * 1.0);
        const rot = R() * 6;
        for (let i = -Math.ceil(rad + 2); i <= Math.ceil(rad + 2); i++)
            for (let k = -Math.ceil(rad + 2); k <= Math.ceil(rad + 2); k++) {
                const d = Math.hypot(i + 0.5, k + 0.5);
                const ang = Math.atan2(k, i) + rot;
                // Scalloped edge: branch tips poke out between gaps.
                const edge = rad * (0.82 + 0.18 * Math.cos(ang * 7)) + (noise3(i * 0.4, y * 0.3, k * 0.4, seed) - 0.5) * 2;
                if (d > edge) continue;
                const droop = Math.pow(d / Math.max(1, rad), 1.5) * (3 + rad * 0.3);
                const top = Math.round(y + 4 - droop - d * 0.25);
                const thick = d < 2.5 ? 5 : 2 + (hash3(i, t, k, seed) < 0.5 ? 1 : 0);
                for (let j = top - thick; j < top; j++) v.set(i, j, k, j === top - thick && d > 2 ? (p => (q: number, w: number, e: number) => mix(p(q, w, e), 0x14200f, 0.35))(leaves) : leaves);
            }
    }
    // Spire.
    v.cyl(0, 0, H + 1, H + 7, 1.6, leaves, 0.4);
    finishLeaves(v, new Set(LEAF.pine), LEAF.pineLit, seed, 0.18);
    return v.build({ sway: treeSway(H + 7, Rmax) });
}

/** Birch: slim pale trunks with dark marks and an airy, light crown. */
export function birch(seed: number): PropModel {
    const R = rng(seed * 13 + 9);
    const v = new Vox(`tree.birch.${seed}`);
    const stems = 1 + Math.floor(R() * 3);
    const leaves = leafPaint(LEAF.birch, seed);
    const bark = (i: number, j: number, k: number) => (hash3(0, j, 0, seed + i * 3 + k) < 0.16 || (j % 5 === 0 && hash3(i, j, k, seed) < 0.5) ? BARK.birchMark : BARK.birch);
    let top = 0;
    for (let s = 0; s < stems; s++) {
        const H = 26 + Math.floor(R() * 9);
        top = Math.max(top, H);
        const a = R() * Math.PI * 2;
        const ox = stems > 1 ? Math.cos(a) * 1.6 : 0, oz = stems > 1 ? Math.sin(a) * 1.6 : 0;
        const lx = Math.cos(a) * (2 + R() * 4), lz = Math.sin(a) * (2 + R() * 4);
        v.line([ox, 0, oz], [ox + lx, H, oz + lz], 1.4, 0.7, bark);
        // Thin twigs and clusters along the upper third.
        for (let c = 0; c < 5; c++) {
            const t = 0.5 + c * 0.11;
            const cx = ox + lx * t, cy = H * t, cz = oz + lz * t;
            const ta = R() * Math.PI * 2, tl = 4 + R() * 4;
            v.line([cx, cy, cz], [cx + Math.cos(ta) * tl, cy + 2, cz + Math.sin(ta) * tl], 0.5, 0.4, bark);
            v.ellipsoid(cx + Math.cos(ta) * tl, cy + 2.5, cz + Math.sin(ta) * tl, 4.2 + R() * 1.5, 3.4 + R(), 4.2 + R() * 1.5, leaves, 0.35, seed + c + s * 9, { keep: true });
        }
        v.ellipsoid(ox + lx, H + 1, oz + lz, 5.5, 4.5, 5.5, leaves, 0.35, seed + 70 + s, { keep: true });
    }
    finishLeaves(v, new Set(LEAF.birch), LEAF.birchLit, seed, 0.45);
    return v.build({ sway: treeSway(top + 5, 11) });
}

/** Willow by the water: leaning trunk, wide dome, hanging strands that swing. */
export function willow(seed: number): PropModel {
    const R = rng(seed * 7 + 3);
    const v = new Vox(`tree.willow.${seed}`);
    const H = 18 + Math.floor(R() * 5);
    const bark = barkPaint(BARK.oak, BARK.oakD, seed, 2);
    const la = R() * Math.PI * 2;
    const lean: [number, number] = [Math.cos(la) * 3.5, Math.sin(la) * 3.5];
    trunk(v, H, 2.8, 1.9, bark, lean, 5, seed);
    const cx = lean[0], cz = lean[1];
    const leaves = leafPaint(LEAF.willow, seed);
    const rx = 10 + R() * 2.5, ry = 7 + R() * 1.5, rz = 10 + R() * 2.5;
    v.ellipsoid(cx, H + 3, cz, rx, ry, rz, leaves, 0.25, seed, { keep: true });
    for (let n = 0; n < 4; n++) {
        const a = (n / 4) * Math.PI * 2 + R();
        v.line([cx, H - 1, cz], [cx + Math.cos(a) * rx * 0.7, H + 2, cz + Math.sin(a) * rz * 0.7], 0.9, 0.5, bark);
    }
    finishLeaves(v, new Set(LEAF.willow), LEAF.willowLit, seed, 0.2);
    // Hanging strands from the underside of the dome; they swing the most.
    const strands = 110 + Math.floor(R() * 40);
    const drapes = 9 + Math.floor(R() * 4);
    for (let n = 0; n < strands; n++) {
        const a = (Math.floor(R() * drapes) + R() * 0.55) / drapes * Math.PI * 2, d = 0.82 + R() * 0.22;
        const x = cx + Math.cos(a) * (rx + 0.5) * d, z = cz + Math.sin(a) * (rz + 0.5) * d;
        const top = Math.floor(H + 3 + ry * (0.2 - d * 0.5) );
        const len = Math.min(Math.floor(H * 0.75), 5 + Math.floor(R() * (6 + d * 10)));
        const col = LEAF.willow[Math.floor(R() * 4)];
        for (let j = 0; j < len; j++) {
            const drift = j * 0.08;
            v.set(x + Math.cos(a) * drift, top - j, z + Math.sin(a) * drift, j === len - 1 ? mix(col, LEAF.willowLit, 0.4) : col, { sway: clamp(0.55 + j / len * 0.45, 0, 1), keep: true });
        }
    }
    return v.build({ sway: treeSway(H + ry * 2, rx + 2) });
}

/** Dead snag: bare grey trunk and a few broken limbs. */
export function snag(seed: number): PropModel {
    const R = rng(seed * 3 + 11);
    const v = new Vox(`tree.snag.${seed}`);
    const H = 18 + Math.floor(R() * 9);
    const bark = barkPaint(BARK.dead, mix(BARK.dead, 0x3a3028, 0.4), seed, 4);
    trunk(v, H, 2.2, 1.0, bark, [R() * 2 - 1, R() * 2 - 1], 4, seed);
    for (let n = 0; n < 3 + Math.floor(R() * 3); n++) {
        const a = R() * Math.PI * 2, y = H * (0.45 + R() * 0.5), len = 3 + R() * 4;
        const e: Vec3 = [Math.cos(a) * len, y + 2 + R() * 4, Math.sin(a) * len];
        v.line([0, y, 0], e, 0.7, 0.4, bark);
        if (R() < 0.6) v.line(e, [e[0] + Math.cos(a + 0.8) * 2, e[1] + 2, e[2] + Math.sin(a + 0.8) * 2], 0.5, 0.4, bark);
    }
    return v.build({ sway: treeSway(H + 6, 6) });
}

/** Cut stump with growth rings, a hint that someone cleared land for the workshop. */
export function stump(seed: number): PropModel {
    const R = rng(seed * 5 + 2);
    const v = new Vox(`tree.stump.${seed}`);
    const h = 2 + Math.floor(R() * 2), r = 2.2 + R() * 0.6;
    const bark = barkPaint(BARK.oak, BARK.oakD, seed, 2);
    v.cyl(0, 0, 0, h, r, bark);
    for (let n = 0; n < 4; n++) {
        const a = (n / 4) * Math.PI * 2 + R();
        v.line([0, 1, 0], [Math.cos(a) * (r + 1.6), 0, Math.sin(a) * (r + 1.6)], 0.9, 0.5, bark);
    }
    v.cyl(0, 0, h, h + 1, r - 0.3, (i, _j, k) => (Math.round(Math.hypot(i + 0.5, k + 0.5)) % 2 ? 0xc89a68 : 0xb08050));
    return v.build({ ao: 0.3 });
}

export const TREES = { oak, maple, pine, birch, willow, snag, stump } as const;
export type TreeKind = keyof typeof TREES;
