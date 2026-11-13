// Voxel ore deposits, one board cell each (10 x 10 voxels at 0.1 units).
//
// Every deposit reads by hue and by shape, from orbit and from top-down:
//   iron_ore       rust-red rounded boulders with steel-blue nodules
//   copper_ore     grey rock streaked teal, with bright copper nuggets
//   coal           black angular slabs stacked on dark rock
//   quartz         pink-white crystal spires with glinting tips
//   aluminium_ore  tan bauxite shelves with ochre bands and silver flecks
//
// Purity (0.5 impure, 1 normal, 2 pure, as in the sim) sets the size and how
// much ore shows. `remaining` (1 full, 0 worked out) gives the depleted look.

import { RESOURCE_COLORS, type ResourceId } from "./palette";
import {
    CELL,
    Tag,
    VoxelBuilder,
    hash3,
    mix,
    rng,
    scale,
    type VoxelData,
} from "./voxel";

export interface DepositOptions {
    /** Sim purity: 0.5 impure, 1 normal, 2 pure. */
    purity?: number;
    /** 1 untouched, 0 worked out. Below about 0.15 the deposit shows its depleted look. */
    remaining?: number;
    /** Layout variant, 0..DEPOSIT_VARIANTS-1. Neighbouring cells should differ. */
    variant?: number;
    /** Extra seed for rotation and fine detail; use the cell coordinates. */
    seed?: number;
}

/** Number of hand-tuned layouts per resource. Rotation and mirroring add more. */
export const DEPOSIT_VARIANTS = 3;

const HALF = CELL / 2; // footprint is x, z in -5..4

interface Ctx {
    b: VoxelBuilder;
    r: () => number;
    /** Size factor from purity (0.95 impure .. 1.3 pure). */
    size: number;
    /** Ore richness from purity and remaining, 0..1. */
    amt: number;
    depleted: boolean;
    variant: number;
    seed: number;
}

/** Variant cluster centres, in voxels, laid out so the rock fills the cell without touching its edges. */
const LAYOUTS: [number, number][][] = [
    [
        [-1.5, -1],
        [1.8, 1.4],
        [-1.2, 2.3],
        [2, -2.2],
    ],
    [
        [0.3, 0.2],
        [-2.4, 1.6],
        [2.2, -1.8],
        [-2, -2.4],
    ],
    [
        [-1, 1.4],
        [1.6, -0.6],
        [-2.4, -1.8],
        [1.4, 2.6],
    ],
];

function count(ctx: Ctx, impure: number, normal: number, pure: number): number {
    if (ctx.depleted) return Math.max(1, impure - 1);
    return ctx.size < 1 ? impure : ctx.size < 1.2 ? normal : pure;
}

/** Loose grit around the rocks so the deposit sits in the ground instead of on it. */
function bed(
    ctx: Ctx,
    ore: number,
    oreDark: number,
    host: number,
    hostDark: number,
    oreShare: number
): void {
    const { b, seed } = ctx;
    for (let x = -HALF; x < HALF; x++)
        for (let z = -HALF; z < HALF; z++) {
            const d = Math.hypot(x + 0.5, z + 0.5);
            const h = hash3(x, 0, z, seed);
            if (h > 0.95 - d * 0.1) continue;
            if (d > 4.9) continue;
            const o = hash3(x, 1, z, seed);
            const c =
                o < oreShare
                    ? o < oreShare / 2
                        ? ore
                        : oreDark
                    : o < 0.75
                      ? host
                      : hostDark;
            b.add(x, 0, z, c);
        }
}

/** Top-surface test: nothing directly above. */
const exposed = (b: VoxelBuilder, x: number, y: number, z: number) =>
    !b.has(x, y + 1, z);

// ---------------------------------------------------------------- iron

function iron(ctx: Ctx): void {
    const C = RESOURCE_COLORS.iron_ore;
    const { b, r, size, amt, depleted } = ctx;
    const n = count(ctx, 2, 3, 4);
    const pts = LAYOUTS[ctx.variant % LAYOUTS.length].slice(0, n);
    pts.forEach(([cx, cz], i) => {
        const big = i === 0 ? 1.25 : 0.85 + r() * 0.25;
        const rx = (2.1 + r() * 0.8) * size * big;
        const rz = (1.9 + r() * 0.8) * size * big;
        const ry = depleted ? 0.9 + r() * 0.5 : (1.9 + r() * 0.9) * size * big;
        const top = ry * 1.6;
        b.blob(cx, depleted ? -0.2 : ry * 0.6, cz, rx, ry, rz, (x, y, z) => {
            const h = hash3(x, y, z, ctx.seed);
            if (depleted)
                return h < 0.22 ? C.main : h < 0.6 ? C.host : C.hostDark;
            // rust red over dark red toward the base, with steel nodules
            if (h < 0.1 * amt + 0.02) return C.accent;
            const t = Math.min(1, y / top);
            return mix(C.dark, C.main, 0.35 + 0.65 * t);
        });
    });
    // nodules stand proud on the upper surfaces of rich deposits
    if (!depleted) {
        const add: [number, number, number][] = [];
        b.each((x, y, z, c) => {
            if (
                c === C.accent &&
                exposed(b, x, y, z) &&
                hash3(x, y, z, 5) < 0.35 * amt
            )
                add.push([x, y + 1, z]);
        });
        for (const [x, y, z] of add)
            b.set(x, y, z, scale(C.accent, 1.12), Tag.Glint);
    }
    bed(
        ctx,
        C.main,
        C.dark,
        C.host,
        C.hostDark,
        depleted ? 0.2 : 0.35 * amt + 0.1
    );
}

// ---------------------------------------------------------------- copper

function copper(ctx: Ctx): void {
    const C = RESOURCE_COLORS.copper_ore;
    const { b, r, size, amt, depleted } = ctx;
    const n = count(ctx, 2, 3, 3);
    const pts = LAYOUTS[(ctx.variant + 1) % LAYOUTS.length].slice(0, n);
    const k = 0.3 + r() * 0.4;
    // streak bands run on a slant through every rock in the cell
    const streak = (x: number, y: number, z: number) => {
        const v = (x * 0.55 + y * 0.95 + z * k + ctx.seed) / 2.6;
        return v - Math.floor(v);
    };
    pts.forEach(([cx, cz], i) => {
        const big = i === 0 ? 1.2 : 0.85 + r() * 0.2;
        // copper rock is flatter and blockier than iron: a squashed, wide blob with a cut top
        const rx = (2.4 + r() * 0.8) * size * big;
        const rz = (2.1 + r() * 0.6) * size * big;
        const ry = depleted ? 0.8 : (1.7 + r() * 0.6) * size * big;
        const cut = Math.round(ry * 1.25);
        b.blob(cx, depleted ? -0.3 : ry * 0.5, cz, rx, ry, rz, (x, y, z) => {
            if (depleted)
                return hash3(x, y, z, ctx.seed) < 0.2
                    ? C.main
                    : hash3(x, y, z, 2) < 0.5
                      ? C.host
                      : C.hostDark;
            const s = streak(x, y, z);
            const share = 0.3 + 0.32 * amt;
            if (s < share) return s < share * 0.4 ? C.dark : C.main;
            return y < 1 ? C.hostDark : C.host;
        });
        if (!depleted)
            for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
                for (let z = Math.floor(cz - rz); z <= cz + rz; z++)
                    for (let y = cut + 1; y < 12; y++) b.del(x, y, z);
    });
    if (!depleted) {
        // the flat tops read teal from above
        b.paint((x, y, z, c) =>
            exposed(b, x, y, z) &&
            y > 0 &&
            c !== C.main &&
            hash3(x, y, z, 9) < 0.55 * amt + 0.1
                ? C.main
                : null
        );
        // bright copper nuggets, some standing proud
        const add: [number, number, number][] = [];
        b.each((x, y, z) => {
            if (
                y > 0 &&
                exposed(b, x, y, z) &&
                hash3(x, y, z, 11) < 0.07 + 0.08 * amt
            )
                add.push([x, y, z]);
        });
        for (const [x, y, z] of add) {
            b.set(x, y, z, C.accent);
            if (hash3(x, y, z, 12) < 0.45)
                b.set(x, y + 1, z, scale(C.accent, 1.1), Tag.Glint);
        }
    }
    bed(
        ctx,
        C.main,
        C.accent,
        C.host,
        C.hostDark,
        depleted ? 0.15 : 0.3 * amt + 0.08
    );
}

// ---------------------------------------------------------------- coal

/** A tilted rectangular slab. Angles in radians. */
function slab(
    b: VoxelBuilder,
    cx: number,
    cy: number,
    cz: number,
    a: number,
    bb: number,
    c: number,
    yaw: number,
    tilt: number,
    paint: (x: number, y: number, z: number) => number
): void {
    const cy_ = Math.cos(yaw),
        sy = Math.sin(yaw),
        ct = Math.cos(tilt),
        st = Math.sin(tilt);
    const R = Math.ceil(Math.hypot(a, bb, c)) + 1;
    for (let x = Math.floor(cx - R); x <= cx + R; x++)
        for (let y = Math.max(0, Math.floor(cy - R)); y <= cy + R; y++)
            for (let z = Math.floor(cz - R); z <= cz + R; z++) {
                const dx = x + 0.5 - cx,
                    dy = y + 0.5 - cy,
                    dz = z + 0.5 - cz;
                // yaw around y, then tilt around the slab's own x axis
                const u = dx * cy_ + dz * sy;
                const w0 = -dx * sy + dz * cy_;
                const v = dy * ct - w0 * st;
                const w = dy * st + w0 * ct;
                if (Math.abs(u) <= a && Math.abs(v) <= bb && Math.abs(w) <= c)
                    b.set(x, y, z, paint(x, y, z));
            }
}

function coal(ctx: Ctx): void {
    const C = RESOURCE_COLORS.coal;
    const { b, r, size, amt, depleted } = ctx;
    // a low dark-rock base; the coal itself is big flat slabs with clean faces
    b.blob(
        0,
        -0.8,
        0,
        3.4 * size,
        depleted ? 1.4 : 1.5,
        3.1 * size,
        (x, y, z) => (hash3(x, y, z, 3) < 0.5 ? C.host : C.hostDark)
    );
    const n = depleted ? 2 : count(ctx, 2, 3, 4);
    const pts = LAYOUTS[(ctx.variant + 2) % LAYOUTS.length];
    for (let i = 0; i < n; i++) {
        const [px, pz] = pts[i % pts.length];
        const a = (2.5 + r() * 0.9) * size * (i === 0 ? 1.1 : 0.85);
        const bb = depleted ? 0.6 : (0.6 + r() * 0.3) * size;
        const c = (1.6 + r() * 0.7) * size * (i === 0 ? 1.1 : 0.9);
        const h = depleted
            ? 0.6
            : 1.4 + i * 0.5 + r() * 0.8 * size + (i === 0 ? 1 : 0);
        // slabs lean like broken strata, tipped the same way within a deposit
        const tilt = depleted ? 0.1 : 0.35 + r() * 0.3;
        slab(
            b,
            px * 0.7,
            h,
            pz * 0.7,
            a,
            bb,
            c,
            ctx.seed * 0.7 + i * 0.5,
            tilt,
            (x, y, z) => {
                const t = hash3(x, y, z, ctx.seed);
                if (depleted) return t < 0.4 ? C.main : C.host;
                return t < 0.18 ? C.dark : C.main;
            }
        );
    }
    // a faint blue sheen on the upward faces, a few of which glint
    b.paint((x, y, z, c) => {
        if (c !== C.main && c !== C.dark) return null;
        if (!exposed(b, x, y, z)) return null;
        return hash3(x, y, z, 21) < (depleted ? 0.06 : 0.3 + 0.15 * amt)
            ? C.accent
            : null;
    });
    if (!depleted)
        b.retag((x, y, z, c) =>
            c === C.accent && hash3(x, y, z, 22) < 0.25 ? Tag.Glint : null
        );
    bed(ctx, C.main, C.dark, C.host, C.hostDark, depleted ? 0.25 : 0.45);
}

// ---------------------------------------------------------------- quartz

function quartz(ctx: Ctx): void {
    const C = RESOURCE_COLORS.quartz;
    const { b, r, size, amt, depleted } = ctx;
    const pts = LAYOUTS[ctx.variant % LAYOUTS.length];
    // each variant has one main cluster and a smaller second one
    const clusters: [number, number, number][] = [
        [pts[0][0] * 0.6, pts[0][1] * 0.6, 1],
        [pts[1][0], pts[1][1], 0.5],
    ];
    for (const [qx, qz, w] of clusters) {
        b.blob(
            qx,
            -0.4,
            qz,
            2.6 * size * (0.6 + w * 0.4),
            1.5,
            2.4 * size * (0.6 + w * 0.4),
            (x, y, z) => (hash3(x, y, z, 4) < 0.5 ? C.host : C.hostDark)
        );
        const n = Math.round((depleted ? 2 : count(ctx, 3, 4, 5)) * w + 0.4);
        for (let i = 0; i < n; i++) {
            const ang = (i / n) * Math.PI * 2 + r() * 0.8;
            const rad = i === 0 ? 0 : 2.0 + r() * 1.1;
            const bx = qx + Math.cos(ang) * rad,
                bz = qz + Math.sin(ang) * rad;
            const lean = i === 0 ? 0.03 : 0.16 + r() * 0.14;
            const h = depleted
                ? 1 + Math.round(r() * 2)
                : Math.round(
                      (i === 0 ? 8.5 : 3.5 + r() * 5) *
                          size *
                          (0.75 + 0.25 * amt) *
                          (0.7 + 0.3 * w)
                  );
            const rr =
                (i === 0 ? 1.0 : 0.5 + r() * 0.3) *
                (depleted ? 0.9 : Math.min(size, 1.15));
            b.crystal(
                bx,
                0,
                bz,
                h,
                rr,
                Math.cos(ang) * lean,
                Math.sin(ang) * lean,
                (t, x, y, z) => {
                    if (depleted)
                        return hash3(x, y, z, 6) < 0.5 ? C.dark : C.main;
                    // shaded base, bright body, near-white tip; one face a touch darker for facets
                    const facet = (x + z) & 1 ? 1 : 0.94;
                    if (t > 0.82) return C.accent;
                    return scale(
                        mix(C.dark, C.main, Math.min(1, t * 1.8)),
                        facet
                    );
                },
                !depleted
            );
        }
    }
    // loose shards on the ground
    bed(
        ctx,
        C.main,
        C.dark,
        C.host,
        C.hostDark,
        depleted ? 0.12 : 0.2 * amt + 0.06
    );
}

// ---------------------------------------------------------------- aluminium

function aluminium(ctx: Ctx): void {
    const C = RESOURCE_COLORS.aluminium_ore;
    const { b, r, size, amt, depleted } = ctx;
    const [ox, oz] = LAYOUTS[ctx.variant % LAYOUTS.length][0];
    const layers = depleted ? 2 : count(ctx, 3, 4, 5);
    // terraced shelves, each smaller and shifted, banded tan / ochre
    const bands = [C.main, C.dark, C.main, C.main, C.dark, C.main];
    let y = 0;
    let cx = ox * 0.5,
        cz = oz * 0.5;
    for (let i = 0; i < layers; i++) {
        const k = 1 - i / (layers + 1.2);
        const rx = (4.3 * k + r() * 0.4) * size,
            rz = (3.8 * k + r() * 0.4) * size;
        const th = i === 0 ? 1 : 1 + (r() < 0.5 ? 1 : 0);
        const col = depleted
            ? i === 0
                ? C.host
                : C.dark
            : bands[(i + ctx.variant) % bands.length];
        for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
            for (let z = Math.floor(cz - rz); z <= cz + rz; z++) {
                const dx = (x + 0.5 - cx) / rx,
                    dz = (z + 0.5 - cz) / rz;
                // a wobbly edge so the shelves don't look stamped
                const edge = 1 - hash3(x, i, z, ctx.seed) * 0.22;
                if (dx * dx + dz * dz > edge) continue;
                for (let j = 0; j < th; j++) {
                    const c = j === th - 1 ? col : C.dark;
                    b.set(
                        x,
                        y + j,
                        z,
                        depleted && hash3(x, y, z, 8) < 0.5 ? C.hostDark : c
                    );
                }
            }
        y += th;
        cx += (r() - 0.5) * 1.6;
        cz += (r() - 0.5) * 1.6;
    }
    if (!depleted) {
        // two loose plates leaning on the stack, and metal flecks that glint
        for (let p = 0; p < 2; p++) {
            const ang = r() * Math.PI * 2;
            const px = Math.round(Math.cos(ang) * 3.6 * size),
                pz = Math.round(Math.sin(ang) * 3.4 * size);
            b.box(px - 1, 0, pz - 1, px, 0, pz + 1, C.main);
            b.add(px, 1, pz, C.accent);
        }
        b.paint(
            (x, yy, z, c) =>
                yy > 0 &&
                exposed(b, x, yy, z) &&
                hash3(x, yy, z, 31) < 0.05 + 0.05 * amt
                    ? 0xf6f9fc
                    : null,
            Tag.Glint
        );
    }
    bed(
        ctx,
        C.main,
        C.dark,
        C.host,
        C.hostDark,
        depleted ? 0.15 : 0.25 * amt + 0.1
    );
}

const BUILDERS: Record<ResourceId, (ctx: Ctx) => void> = {
    iron_ore: iron,
    copper_ore: copper,
    coal,
    quartz,
    aluminium_ore: aluminium,
};

/** Build one deposit cell. Deterministic for the same options. */
export function buildDeposit(
    item: ResourceId,
    opts: DepositOptions = {}
): VoxelData {
    const purity = opts.purity ?? 1;
    const remaining = Math.max(0, Math.min(1, opts.remaining ?? 1));
    const variant =
        (((opts.variant ?? 0) % DEPOSIT_VARIANTS) + DEPOSIT_VARIANTS) %
        DEPOSIT_VARIANTS;
    const seed = (opts.seed ?? 0) * 31 + variant * 7 + 1;
    const depleted = remaining < 0.15;
    const size = purity <= 0.5 ? 0.95 : purity >= 2 ? 1.3 : 1.12;
    const grade = purity <= 0.5 ? 0.45 : purity >= 2 ? 1 : 0.75;
    const ctx: Ctx = {
        b: new VoxelBuilder(),
        r: rng(seed * 2654435761),
        size: depleted ? 1 : size * (0.85 + 0.15 * remaining),
        amt: grade * (0.4 + 0.6 * remaining),
        depleted,
        variant,
        seed,
    };
    BUILDERS[item](ctx);
    const turn = Math.floor(hash3(seed, 3, 7) * 4);
    ctx.b.rotate(turn);
    if (hash3(seed, 9, 2) < 0.5) ctx.b.mirrorX();
    ctx.b.clip(-HALF, HALF - 1, -HALF, HALF - 1);
    return ctx.b.build();
}

/** Pick a variant for a cell so neighbours rarely match. */
export function variantForCell(x: number, z: number): number {
    return (
        (((x * 2 + z * 1) % DEPOSIT_VARIANTS) + DEPOSIT_VARIANTS) %
        DEPOSIT_VARIANTS
    );
}
