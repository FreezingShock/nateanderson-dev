// Sky orrery, the megaproject. A staged build that grows as deliveries land, 6x6 cells.
//   stage 0: foundation (the site, before any part arrives)
//   stage 1: orrery struts raise four arched legs and the crown ring
//   stage 2: the relay core column turns, gear stacks and a glowing core
//   stage 3: mirror rings ride on orbit arms round the column, each at its own pace, carrying the light
//   stage 4: a crown of lens arrays turns under a glowing sky sun. Complete.
// orreryModel(stage) returns the model with everything up to that stage. Stages under way show a timber
// scaffold where the next stage will go.

import { Builder, spin, pulse } from "./builder";
import { C } from "./palette";
import { plinth, hopperBack, speckle } from "./common";
import type { VoxelModel } from "../format";

export const ORRERY_STAGES = ["Foundation", "Orrery struts", "Relay core", "Mirror rings", "Lens arrays"] as const;
export const ORRERY_MAX_STAGE = ORRERY_STAGES.length - 1;

const X = 30; // centre, voxels
const Z = 30;

function scaffold(b: Builder, y0: number, y1: number, r: number) {
    for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const x = Math.floor(X + Math.cos(a) * r);
        const z = Math.floor(Z + Math.sin(a) * r);
        b.box(x, y0, z, x + 1, y1, z + 1, C.wood);
    }
    for (let y = y0 + 4; y < y1; y += 6) b.cyl("y", X, Z, r + 0.6, y, y + 1, C.wood, r - 0.6);
}

export function orreryModel(stage = ORRERY_MAX_STAGE): VoxelModel {
    const st = Math.max(0, Math.min(ORRERY_MAX_STAGE, Math.floor(stage)));
    const b = new Builder(`orrery_${st}`, "Sky orrery", 6, 6);
    // Stage 0: stepped round foundation with a brass track and four anchor blocks.
    plinth(b, 2);
    b.cyl("y", X, Z, 27, 2, 4, C.steelD);
    b.cyl("y", X, Z, 22, 4, 6, C.steel);
    b.cyl("y", X, Z, 22, 5, 6, C.brass, 20.5);
    b.cyl("y", X, Z, 14, 6, 7, C.brassD);
    speckle(b, 3, 2, 3, 57, 4, 57, C.steelD, C.steel, 6);
    const feet: [number, number][] = [
        [8, 8],
        [48, 8],
        [8, 48],
        [48, 48],
    ];
    for (const [x, z] of feet) b.box(x, 2, z, x + 4, 7, z + 4, C.brassD);
    for (let c = 1; c < 5; c++) hopperBack(b, c, 9);

    if (st === 0) scaffold(b, 6, 30, 12);
    if (st >= 1) {
        // Lattice legs: four arches from the feet up to a crown ring.
        for (const [x, z] of feet) {
            const fx = x + 2;
            const fz = z + 2;
            for (let i = 0; i <= 36; i++) {
                const t = i / 36;
                const y = 7 + t * 63;
                const lx = fx + (X - fx) * (0.62 * Math.sin((t * Math.PI) / 2));
                const lz = fz + (Z - fz) * (0.62 * Math.sin((t * Math.PI) / 2));
                const c = i % 4 === 0 ? C.brassL : C.brass;
                b.box(Math.floor(lx) - 1, Math.floor(y), Math.floor(lz) - 1, Math.floor(lx) + 1, Math.floor(y) + 2, Math.floor(lz) + 1, c);
                if (i % 4 === 2) b.box(Math.floor(lx) - 2, Math.floor(y), Math.floor(lz) - 2, Math.floor(lx) + 2, Math.floor(y) + 1, Math.floor(lz) + 2, C.brassD);
            }
        }
        b.cyl("y", X, Z, 13, 70, 73, C.brass, 11);
        b.cyl("y", X, Z, 13, 72, 73, C.brassL, 12);
        if (st === 1) scaffold(b, 7, 50, 6);
    }
    if (st >= 2) {
        // Relay core: a column of drums and gear stacks with a glowing core.
        b.cyl("y", X, Z, 4, 7, 66, C.steelD);
        for (let y = 12; y < 64; y += 8) b.cyl("y", X, Z, 5, y, y + 1, C.brass);
        b.cyl("y", X, Z, 6, 7, 12, C.brassD);
        b.part("gears", [X, 0, Z], spin("y", 0.1, { when: "always" }));
        for (const [y, r] of [
            [14, 8],
            [22, 7],
            [48, 7],
        ])
            b.gear("y", X, Z, r - 1.2, r, 20, y, y + 2, C.brass, { hole: 4.5 });
        b.part("core", [X, 31, Z], pulse(0.6, 0.4, { when: "always" }), true);
        b.sphere(X, 31, Z, 5, C.glow);
        b.body();
        b.cyl("y", X, Z, 6.5, 27, 28, C.brassL, 5);
        b.cyl("y", X, Z, 6.5, 35, 36, C.brassL, 5);
        if (st === 2) scaffold(b, 36, 66, 16);
    }
    if (st >= 3) {
        // Mirror rings on orbit arms, each arm its own part turning at its own pace.
        const arms: [number, number, number, number][] = [
            // radius, height, speed (turns/s), ring size
            [12, 40, 0.11, 4],
            [18, 47, -0.07, 5],
            [24, 55, 0.05, 5.5],
        ];
        arms.forEach(([r, y, sp, g], i) => {
            b.part("orbit" + i, [X, y, Z], spin("y", sp, { when: "always" }));
            b.cyl("y", X, Z, 5.5, y, y + 2, C.brassD, 4.2);
            b.box(X + 4, y, Z - 1, X + r, y + 1, Z + 1, C.brass);
            b.box(X + r - 1, y - 3, Z - 1, X + r + 1, y, Z + 1, C.brassD);
            // Polished ring standing upright, quartz light at its heart.
            const cy = y - 3 - g;
            b.cyl("z", X + r, cy, g, Z - 1, Z + 1, C.al, g - 1.4);
            b.cyl("z", X + r, cy, g + 0.6, Z - 1, Z + 1, C.brassL, g);
            b.sphere(X + r, cy, Z, 1.6, i === 1 ? C.glass : C.quartz);
        });
        b.body();
        if (st === 3) scaffold(b, 66, 76, 10);
    }
    if (st >= 4) {
        // Lens arrays: a turning crown of brass frames, each holding a row of quartz lenses.
        b.part("lenses", [X, 74, Z], spin("y", 0.03, { when: "always" }));
        for (let k = 0; k < 12; k++) {
            const a = (k / 12) * Math.PI * 2;
            for (let r = 9; r < 27; r += 0.5)
                for (let s = -2.5; s <= 2.5; s += 0.5) {
                    const x = Math.floor(X + Math.cos(a) * r - Math.sin(a) * s);
                    const z = Math.floor(Z + Math.sin(a) * r + Math.cos(a) * s);
                    const y = Math.floor(74 + (r - 9) * 0.28);
                    const edge = Math.abs(s) > 2 || r > 26 || Math.floor(r) % 4 === 0;
                    b.set(x, y, z, edge ? C.brass : Math.floor(r) % 4 === 2 ? C.glass : C.quartz);
                }
        }
        b.body();
        b.cyl("y", X, Z, 2, 73, 80, C.brassD);
        b.part("sun", [X, 84, Z], pulse(0.25, 0.3, { when: "always" }), true);
        b.sphere(X, 84, Z, 4.5, C.glow);
        b.body();
        b.light([3, 8.4, 3], 0xffc27a, 20, 12, "always");
    }
    b.light([3, 3.1, 3], 0xffb347, st >= 2 ? 10 : 0.01, 6, "always");
    return b.build();
}

export const orrery = () => orreryModel(ORRERY_MAX_STAGE);
