// Shared details so every machine reads as one family: the plinth, input hoppers (patina rim),
// output chutes (brass with a cream arrow on top), status lamps and texture passes.

import { Builder, VOX, pulse } from "./builder";
import { C } from "./palette";

/** Steel plinth inset one voxel from the footprint edge, two voxels tall, with brass corner bolts. */
export function plinth(b: Builder, h = 2) {
    const { W, D } = b;
    b.box(1, 0, 1, W - 1, h - 1, D - 1, C.steelD);
    b.box(1, h - 1, 1, W - 1, h, D - 1, C.steel);
    for (const [x, z] of [
        [2, 2],
        [W - 3, 2],
        [2, D - 3],
        [W - 3, D - 3],
    ])
        b.set(x, h, z, C.brassL);
}

/**
 * Input hopper on the back edge (-z) of footprint column `cx`: a steel funnel with a patina rim,
 * open toward the belt. Registers the port.
 */
export function hopperBack(b: Builder, cx: number, top = 9) {
    const x0 = cx * VOX + 2;
    const x1 = cx * VOX + 8;
    b.box(x0, 2, 0, x1, top - 1, 4, C.steelD);
    b.box(x0 - 1, top - 1, 0, x1 + 1, top, 4, C.patina); // rim, read from above
    b.box(x0 + 1, 2, 0, x1 - 1, 6, 1, C.soot); // mouth
    b.carve(x0 + 1, top - 1, 1, x1 - 1, top, 3);
    b.box(x0 + 1, top - 2, 1, x1 - 1, top - 1, 3, C.soot);
    b.box(x0, 0, 0, x1, 1, 1, C.patina); // floor mark on the belt edge
    b.input(cx, 0, 2);
}

/** Input hopper on the left (-x) side of footprint row `cz`. */
export function hopperLeft(b: Builder, cz: number, top = 9) {
    const z0 = cz * VOX + 2;
    const z1 = cz * VOX + 8;
    b.box(0, 2, z0, 4, top - 1, z1, C.steelD);
    b.box(0, top - 1, z0 - 1, 4, top, z1 + 1, C.patina);
    b.box(0, 2, z0 + 1, 1, 6, z1 - 1, C.soot);
    b.carve(1, top - 1, z0 + 1, 3, top, z1 - 1);
    b.box(1, top - 2, z0 + 1, 3, top - 1, z1 - 1, C.soot);
    b.box(0, 0, z0, 1, 1, z1, C.patina);
    b.input(0, cz, 3);
}

/** Input hopper on the right (+x) side of footprint row `cz`. */
export function hopperRight(b: Builder, cz: number, top = 9) {
    const z0 = cz * VOX + 2;
    const z1 = cz * VOX + 8;
    const { W } = b;
    b.box(W - 4, 2, z0, W, top - 1, z1, C.steelD);
    b.box(W - 4, top - 1, z0 - 1, W, top, z1 + 1, C.patina);
    b.box(W - 1, 2, z0 + 1, W, 6, z1 - 1, C.soot);
    b.carve(W - 3, top - 1, z0 + 1, W - 1, top, z1 - 1);
    b.box(W - 3, top - 2, z0 + 1, W - 1, top - 1, z1 - 1, C.soot);
    b.box(W - 1, 0, z0, W, 1, z1, C.patina);
    b.input(b.w - 1, cz, 1);
}

/**
 * Output chute on the front edge (+z) of footprint column `cx`: a brass spout sloping to the belt,
 * with a cream arrow on top that points out. Registers the port.
 * `span` widens it across several columns (for the big machines).
 */
export function chuteFront(b: Builder, cx: number, span = 1) {
    const { D } = b;
    const x0 = cx * VOX + 2;
    const x1 = (cx + span) * VOX - 2;
    b.box(x0, 2, D - 5, x1, 7, D, C.brass);
    b.box(x0, 7, D - 5, x1, 8, D - 2, C.brassD);
    b.box(x0, 1, D - 5, x1, 2, D, C.brassD);
    b.box(x0 + 1, 2, D - 1, x1 - 1, 6, D, C.soot); // mouth
    b.carve(x0, 5, D - 1, x1, 8, D);
    b.box(x0, 5, D - 2, x1, 6, D - 1, C.brassD);
    // Arrow pointing +z, read from orbit and top-down.
    const cxm = Math.floor((x0 + x1) / 2);
    for (let i = 0; i < 3; i++) {
        b.set(cxm - 1 - i, 8, D - 3 - i, C.cream);
        b.set(cxm + i, 8, D - 3 - i, C.cream);
    }
    b.box(x0, 0, D - 1, x1, 1, D, C.brassL); // floor mark
    for (let c = cx; c < cx + span; c++) b.output(c, b.d - 1, 0);
}

/** Small status lamp: amber while working, dim when idle. */
export function statusLamp(b: Builder, x: number, y: number, z: number, id = "lamp") {
    b.box(x - 1, y - 1, z - 1, x + 2, y, z + 2, C.steelD);
    b.part(id, [x + 0.5, y + 0.5, z + 0.5], pulse(0.5, 0.35), true);
    b.box(x, y, z, x + 1, y + 2, z + 1, C.glow);
    b.body();
}

/** Speckle: swap a share of `from` voxels in the box to `to` with a stable hash, for brick and hammered metal. */
export function speckle(b: Builder, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, from: number, to: number, every = 5) {
    for (let x = x0; x < x1; x++)
        for (let y = y0; y < y1; y++)
            for (let z = z0; z < z1; z++) {
                const h = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
                if ((h >>> 0) % every === 0) b.paint(x, y, z, x + 1, y + 1, z + 1, to, from);
            }
}

/** Horizontal band of `c` around whatever is in the box at height y (recolours existing voxels). */
export function band(b: Builder, y: number, c: number, from = -1, x0 = -64, x1 = 128, z0 = -64, z1 = 128) {
    b.paint(x0, y, z0, x1, y + 1, z1, c, from);
}
