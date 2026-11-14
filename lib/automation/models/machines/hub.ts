// Hub, 3x3. The heart of the workshop, where every delivery lands. Built to read as the centre of the factory
// from any distance:
//   - a stepped stone dais with cream intake chevrons painted on it, pointing into every intake
//   - a round copper counting hall ringed with lit gauge windows, a brass counting ring that turns as items land
//   - a clock tower above it
// It grows with the milestones (stage 0..3), so the player sees the workshop come up around them:
//   0  hall and a short clock tower with a pyramid cap
//   1  taller tower, open belfry and a bell that swings on a delivery
//   2  two brass smokestacks on the front corners with ember tops, pennant masts
//   3  patina dome, a turning armillary vane and a beacon lamp on top
// Footprint and ports never change: three intakes at the back, one each side and a wide intake at the front.

import { Builder, spin, swing } from "./builder";
import { C } from "./palette";
import { hopperBack, hopperLeft, hopperRight, statusLamp, speckle } from "./common";

export const HUB_MAX_STAGE = 3;

/** Hub stage from finished milestones: one step per two milestones, capped. */
export function hubStageFor(milestonesDone: number): number {
    return Math.max(0, Math.min(HUB_MAX_STAGE, Math.floor(milestonesDone / 2)));
}

function chevron(b: Builder, x: number, z: number, dx: number, dz: number) {
    // A three-voxel cream arrow on the dais top (y = 3), pointing along (dx, dz).
    const px = -dz,
        pz = dx;
    b.set(x, 3, z, C.cream);
    b.set(x - dx + px, 3, z - dz + pz, C.cream);
    b.set(x - dx - px, 3, z - dz - pz, C.cream);
}

export function hubModel(stage: number) {
    const s = Math.max(0, Math.min(HUB_MAX_STAGE, Math.floor(stage)));
    const b = new Builder("hub", "Hub", 3, 3);
    // Stepped dais: dark stone footing, brass lip, stone top.
    b.box(1, 0, 1, 29, 1, 29, C.sootD);
    b.box(1, 1, 1, 29, 2, 29, C.brassD);
    b.box(2, 2, 2, 28, 3, 28, C.steelD);
    speckle(b, 2, 2, 2, 28, 3, 28, C.steelD, C.steel, 4);
    for (const [x, z] of [[2, 2], [27, 2], [2, 27], [27, 27]]) b.box(x, 3, z, x + 1, 4, z + 1, C.brassL);
    // Intake chevrons on the dais, one inside each port.
    for (const x of [5, 15, 25]) chevron(b, x, 6, 0, 1);
    chevron(b, 6, 15, 1, 0);
    chevron(b, 24, 15, -1, 0);
    chevron(b, 15, 24, 0, -1);

    // Counting hall: a copper drum with brass bands and a ring of lit gauge windows.
    b.cyl("y", 15, 15, 9.5, 3, 15, C.cu);
    speckle(b, 5, 3, 5, 25, 15, 25, C.cu, C.cuD, 4);
    b.cyl("y", 15, 15, 10, 3, 4, C.brass);
    b.cyl("y", 15, 15, 10, 8, 9, C.brassD);
    b.cyl("y", 15, 15, 10.2, 14, 15, C.brass);
    // Door on the front with a lit fanlight.
    b.box(13, 3, 23, 17, 9, 25, C.sootD);
    b.box(13, 9, 24, 17, 10, 25, C.brassL);
    b.body();
    b.part("windows", [15, 0, 15], undefined, true);
    for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        const x = Math.round(15 + Math.cos(a) * 9.6 - 0.5),
            z = Math.round(15 + Math.sin(a) * 9.6 - 0.5);
        b.box(x, 10, z, x + 1, 13, z + 1, C.glow);
    }
    b.box(14, 10, 24, 16, 11, 25, C.glow);
    // Counting ring: a brass gear round the roof line that turns while deliveries are counted.
    b.part("counter", [15, 15, 15], spin("y", 0.5));
    b.gear("y", 15, 15, 10.5, 12, 24, 15, 16, C.brass, { hole: 9 });
    b.body();
    // Roof deck of the hall.
    b.cyl("y", 15, 15, 9, 15, 16, C.brassD);
    b.cyl("y", 15, 15, 7.5, 16, 17, C.patina);

    // Clock tower; taller from stage 1.
    const top = s >= 1 ? 34 : 28;
    b.box(10, 17, 10, 20, top, 20, C.brassD);
    speckle(b, 10, 17, 10, 20, top, 20, C.brassD, C.brassM, 5);
    b.box(9, 17, 9, 21, 18, 21, C.brass);
    b.box(9, top - 1, 9, 21, top + 1, 21, C.brass);
    for (const [x, z] of [[9, 9], [20, 9], [9, 20], [20, 20]]) b.box(x, 18, z, x + 1, top - 1, z + 1, C.brass);
    // Clock faces and hands on all four sides.
    b.body();
    const cy = top - 6;
    b.cyl("z", 15, cy, 3.6, 20, 21, C.cream);
    b.cyl("z", 15, cy, 3.6, 9, 10, C.cream);
    b.cyl("x", cy, 15, 3.6, 20, 21, C.cream);
    b.cyl("x", cy, 15, 3.6, 9, 10, C.cream);
    const hands = (id: string, axis: "x" | "z", at: number, dir: 1 | -1) => {
        b.part(id + "M", axis === "z" ? [15, cy, at] : [at, cy, 15], spin(axis, 0.08 * dir, { when: "always" }));
        if (axis === "z") b.box(15, cy, at, 16, cy + 3, at + 1, C.sootD);
        else b.box(at, cy, 15, at + 1, cy + 3, 16, C.sootD);
        b.part(id + "H", axis === "z" ? [15, cy, at] : [at, cy, 15], spin(axis, 0.008 * dir, { when: "always" }));
        if (axis === "z") b.box(15, cy - 2, at, 17, cy, at + 1, C.sootD);
        else b.box(at, cy - 2, 15, at + 1, cy, 17, C.sootD);
    };
    hands("front", "z", 21, -1);
    hands("back", "z", 8, 1);
    hands("right", "x", 21, 1);
    hands("left", "x", 8, -1);
    b.body();

    let roofY = top + 1;
    if (s >= 1) {
        // Open belfry on four posts with a swinging bell.
        for (const [x, z] of [[10, 10], [18, 10], [10, 18], [18, 18]]) b.box(x, roofY, z, x + 2, roofY + 6, z + 2, C.brassD);
        b.box(9, roofY + 6, 9, 21, roofY + 7, 21, C.brass);
        b.part("bell", [15, roofY + 6, 15], swing("x", 0.35, 0.8));
        b.sphere(15, roofY + 2.5, 15, 2.6, C.brass, roofY + 1);
        b.box(14, roofY + 5, 14, 16, roofY + 6, 16, C.brassL);
        b.body();
        roofY += 7;
    }
    if (s >= 3) {
        // Patina dome and a turning armillary vane with a beacon.
        for (let y = 0; y < 6; y++) {
            const r = Math.sqrt(Math.max(0, 36 - y * y)) + 0.3;
            b.cyl("y", 15, 15, r, roofY + y, roofY + y + 1, C.patina);
        }
        b.box(14, roofY + 6, 14, 16, roofY + 9, 16, C.brassL);
        b.part("vane", [15, roofY + 12, 15], spin("y", 0.25, { when: "always" }));
        b.cyl("x", roofY + 12, 15, 4, 15, 16, C.brass, 3);
        b.cyl("z", 15, roofY + 12, 4, 15, 16, C.brass, 3);
        b.body();
        b.part("beacon", [15, roofY + 12, 15], undefined, true);
        b.box(14, roofY + 11, 14, 16, roofY + 13, 16, C.glow);
        b.body();
        b.light([1.5, (roofY + 12) / 10, 1.5], 0xffc66a, 1.2, 4, "always");
    } else {
        // Stepped pyramid cap in patina.
        for (let i = 0; i < 6; i++) b.box(9 + i, roofY + i, 9 + i, 21 - i, roofY + i + 1, 21 - i, C.patina);
        b.box(14, roofY + 6, 14, 16, roofY + 9, 16, C.brassL);
    }

    if (s >= 2) {
        // Two brass smokestacks on the front corners with ember tops, and pennant masts on the back corners.
        for (const x of [5, 25]) {
            b.cyl("y", x, 25, 2.2, 3, 22, C.brassD);
            b.cyl("y", x, 25, 2.6, 12, 13, C.brass);
            b.cyl("y", x, 25, 2.8, 22, 24, C.brass);
            b.cyl("y", x, 25, 1.4, 23, 24, C.soot);
        }
        b.part("embers", [15, 23, 25], undefined, true);
        b.box(4, 23, 24, 6, 24, 26, C.ember);
        b.box(24, 23, 24, 26, 24, 26, C.ember);
        b.body();
        for (const x of [4, 25]) {
            b.box(x, 4, 4, x + 1, 26, 5, C.brassD);
            b.box(x + (x < 15 ? 1 : -3), 22, 4, x + (x < 15 ? 4 : 0), 25, 5, C.red);
        }
    }

    // Intakes: three at the back, one each side and a wide intake at the front.
    hopperBack(b, 0);
    hopperBack(b, 1);
    hopperBack(b, 2);
    hopperLeft(b, 1);
    hopperRight(b, 1);
    b.box(11, 2, 26, 19, 8, 30, C.steelD);
    b.box(10, 8, 26, 20, 9, 30, C.patina);
    b.box(12, 2, 29, 18, 6, 30, C.soot);
    b.box(11, 0, 29, 19, 1, 30, C.patina);
    b.input(1, 2, 0);
    // Intake lamps so the ports read at night too.
    statusLamp(b, 6, 4, 22);
    statusLamp(b, 23, 4, 7, "lamp2");
    b.light([1.5, 1.6, 2.2], 0xffb347, 1.5, 2.5, "always");
    return b.build();
}

/** The finished hub, for the palette art and previews. The board uses hubModel(stage). */
export function hub() {
    return hubModel(HUB_MAX_STAGE);
}
