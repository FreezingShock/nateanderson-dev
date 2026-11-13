// Stockpiles for storage areas: an open wooden crate with brass corners and a
// heap of the material inside that rises with `fill`. One board cell.

import { RESOURCE_COLORS, WORKSHOP, type StockId } from "./palette";
import {
    CELL,
    Tag,
    VoxelBuilder,
    hash3,
    mix,
    scale,
    type VoxelData,
} from "./voxel";

const HALF = CELL / 2;
/** Crate walls run x, z in -4..3, so a one-voxel gap stays between neighbouring crates. */
const IN = 3; // inner half-width: -3..2
const WALL = 3; // crate wall height in voxels

export interface StockpileOptions {
    /** 0 empty, 1 heaped full. */
    fill?: number;
    /** Fine variation; use the cell coordinates. */
    seed?: number;
}

function crate(b: VoxelBuilder): void {
    const W = WORKSHOP;
    // floor boards and walls; planks alternate light and dark
    for (let x = -4; x <= 3; x++)
        for (let z = -4; z <= 3; z++) {
            b.set(x, 0, z, (x & 1) === 0 ? W.wood : W.woodLight);
            const edge = x === -4 || x === 3 || z === -4 || z === 3;
            if (!edge) continue;
            for (let y = 1; y <= WALL; y++)
                b.set(x, y, z, y === 2 ? W.wood : W.woodLight);
        }
    // iron corner posts with brass caps, and a dark brass rim band
    for (const [x, z] of [
        [-4, -4],
        [-4, 3],
        [3, -4],
        [3, 3],
    ])
        for (let y = 0; y <= WALL; y++)
            b.set(x, y, z, y === WALL ? W.brass : W.steelDark);
    for (let x = -3; x <= 2; x++) {
        b.set(x, WALL, -4, W.brassDark);
        b.set(x, WALL, 3, W.brassDark);
        b.set(-4, WALL, x, W.brassDark);
        b.set(3, WALL, x, W.brassDark);
    }
}

/** Height of the heap at (x, z) for a fill level, as a dome that peaks above the rim when full. */
function heap(x: number, z: number, fill: number): number {
    const d = Math.hypot(x + 0.5, z + 0.5) / (IN + 0.2);
    const peak = 1.5 + fill * (WALL + 4);
    return Math.round(peak * Math.max(0, 1 - d * d * 0.7));
}

type Piece = (x: number, y: number, z: number, top: boolean) => number;

function pile(b: VoxelBuilder, fill: number, piece: Piece): void {
    if (fill <= 0) return;
    for (let x = -IN; x < IN; x++)
        for (let z = -IN; z < IN; z++) {
            const h = heap(x, z, fill);
            for (let y = 1; y <= h; y++)
                b.set(x, y, z, piece(x, y, z, y === h));
        }
}

const STOCK: Record<
    StockId,
    (b: VoxelBuilder, fill: number, seed: number) => void
> = {
    iron_ore(b, fill, s) {
        const C = RESOURCE_COLORS.iron_ore;
        pile(b, fill, (x, y, z, top) => {
            const h = hash3(x, y, z, s);
            return h < 0.12
                ? C.accent
                : h < 0.5
                  ? C.main
                  : top
                    ? scale(C.main, 1.08)
                    : C.dark;
        });
    },
    copper_ore(b, fill, s) {
        const C = RESOURCE_COLORS.copper_ore;
        pile(b, fill, (x, y, z) => {
            const h = hash3(x, y, z, s);
            return h < 0.18
                ? C.accent
                : h < 0.6
                  ? C.main
                  : h < 0.8
                    ? C.dark
                    : C.host;
        });
    },
    coal(b, fill, s) {
        const C = RESOURCE_COLORS.coal;
        pile(b, fill, (x, y, z, top) => {
            const h = hash3(x, y, z, s);
            return top && h < 0.15 ? C.accent : h < 0.5 ? C.main : C.dark;
        });
        b.retag((x, y, z, c) =>
            c === C.accent && hash3(x, y, z, 3) < 0.4 ? Tag.Glint : null
        );
    },
    quartz(b, fill, s) {
        const C = RESOURCE_COLORS.quartz;
        // shards stacked upright: a lower heap with crystals poking out
        pile(b, fill * 0.7, (x, y, z) =>
            hash3(x, y, z, s) < 0.5 ? C.main : C.dark
        );
        if (fill <= 0) return;
        const n = Math.round(2 + fill * 5);
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + hash3(i, 0, 0, s) * 0.9;
            const r = i === 0 ? 0 : 1.2 + hash3(i, 1, 0, s) * 1.2;
            const bx = Math.cos(a) * r - 0.5,
                bz = Math.sin(a) * r - 0.5;
            const base = heap(Math.round(bx), Math.round(bz), fill * 0.7);
            const h = Math.round(2 + fill * 4 + hash3(i, 2, 0, s) * 2);
            b.crystal(
                bx + 0.5,
                base,
                bz + 0.5,
                h,
                0.8,
                Math.cos(a) * 0.12,
                Math.sin(a) * 0.12,
                (t) => (t > 0.75 ? C.accent : mix(C.dark, C.main, t * 1.6))
            );
        }
    },
    aluminium_ore(b, fill, s) {
        const C = RESOURCE_COLORS.aluminium_ore;
        // flat slabs stacked in layers, alternating silver and cream
        if (fill <= 0) return;
        const layers = Math.max(1, Math.round(fill * (WALL + 2)));
        for (let y = 1; y <= layers; y++) {
            const off = hash3(y, 0, 0, s) < 0.5 ? 0 : 1;
            const shrink = y > WALL ? 1 : 0;
            for (let x = -IN + shrink; x < IN - shrink - off; x++)
                for (let z = -IN + shrink + off; z < IN - shrink; z++)
                    b.set(x, y, z, y % 2 ? C.main : C.accent);
        }
        b.paint(
            (x, y, z) =>
                !b.has(x, y + 1, z) && hash3(x, y, z, 31) < 0.06
                    ? 0xf6f9fc
                    : null,
            Tag.Glint
        );
    },
    silicon(b, fill, s) {
        const C = RESOURCE_COLORS.silicon;
        // stacked wafers in two racks with pale edges
        if (fill <= 0) return;
        const layers = Math.max(1, Math.round(fill * (WALL + 2)));
        for (const [x0, x1] of [
            [-3, -1],
            [0, 2],
        ])
            for (let y = 1; y <= layers; y++)
                for (let x = x0; x <= x1; x++)
                    for (let z = -3; z <= 2; z++) {
                        const edge =
                            x === x0 || x === x1 || z === -3 || z === 2;
                        b.set(
                            x,
                            y,
                            z,
                            edge ? (y % 2 ? C.accent : C.dark) : C.main
                        );
                    }
        b.paint(
            (x, y, z, c) =>
                c === C.main && !b.has(x, y + 1, z) && hash3(x, y, z, s) < 0.12
                    ? C.accent
                    : null,
            Tag.Glint
        );
    },
};

export function buildStockpile(
    item: StockId,
    opts: StockpileOptions = {}
): VoxelData {
    const fill = Math.max(0, Math.min(1, opts.fill ?? 1));
    const seed = (opts.seed ?? 0) * 13 + 5;
    const b = new VoxelBuilder();
    crate(b);
    STOCK[item](b, fill, seed);
    b.clip(-HALF, HALF - 1, -HALF, HALF - 1);
    return b.build();
}
