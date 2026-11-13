// Node drill, 2x2. A brass derrick over the resource node: an auger turns inside the tower, the crown gear
// spins on top, a side flywheel drives it and a pump piston nods. Output chute on the front right.

import { Builder, spin, slide } from "./builder";
import { C } from "./palette";
import { plinth, chuteFront, statusLamp, speckle } from "./common";

export function drill() {
    const b = new Builder("drill", "Node drill", 2, 2);
    plinth(b);
    // Collar where the auger meets the ground, ore-stained.
    b.cyl("y", 10, 10, 4.5, 2, 4, C.steelD);
    b.cyl("y", 10, 10, 3, 2, 4, C.soot);
    // Four derrick legs leaning in, with cross braces.
    const legs: [number, number][] = [
        [3, 3],
        [16, 3],
        [3, 16],
        [16, 16],
    ];
    for (const [x, z] of legs) {
        const tx = x < 10 ? 7 : 12;
        const tz = z < 10 ? 7 : 12;
        b.rod([x, 2, z], [tx, 25, tz], 2, C.brassD);
        b.box(x - 1, 2, z - 1, x + 2, 4, z + 2, C.brass); // feet
    }
    b.frame(5, 12, 5, 15, 14, 15, 1, C.brass);
    b.frame(6, 19, 6, 14, 20, 14, 1, C.brass);
    // Gearbox at mid height with a gauge on the front.
    b.box(7, 9, 7, 13, 12, 13, C.brassD);
    b.box(6, 9, 6, 14, 10, 14, C.brass);
    b.cyl("z", 10, 6.5, 1.6, 13, 14, C.cream);
    b.set(10, 6, 13, C.red);
    // Crown housing on top.
    b.box(6, 25, 6, 14, 28, 14, C.brass);
    b.box(6, 27, 6, 14, 28, 14, C.brassL);
    b.box(7, 24, 7, 13, 25, 13, C.brassD);
    // Auger: a spiral of flighting round a shaft, turning with the drill.
    b.part("auger", [10, 0, 10], spin("y", 0.9));
    b.cyl("y", 10, 10, 1.2, 4, 25, C.iron);
    for (let y = 4; y < 24; y++) {
        for (let s = 0; s < 3; s++) {
            const a = y * 0.75 + s * 0.22;
            const x = Math.floor(10 + Math.cos(a) * 2.6);
            const z = Math.floor(10 + Math.sin(a) * 2.6);
            b.set(x, y, z, C.ironD);
        }
    }
    // Crown gear turning on the roof.
    b.part("crown", [10, 28, 10], spin("y", -0.45));
    b.gear("y", 10, 10, 4, 5.5, 10, 28, 30, C.brass, { hole: 1.5 });
    b.cyl("y", 10, 10, 1.5, 28, 31, C.steelD);
    // Flywheel on the right side, on an axle into the gearbox.
    b.body();
    b.box(13, 10, 9, 17, 12, 11, C.iron);
    b.box(17, 2, 9, 19, 9, 12, C.steelD); // bearing stand
    b.part("flywheel", [17, 11, 10], spin("x", 0.9));
    b.wheel("x", 11, 10, 5.5, 17, 19, C.brass, 4, 1.5);
    b.cyl("x", 11, 10, 1.2, 16, 20, C.brassD);
    // Pump piston on the left, nodding in time.
    b.body();
    b.box(1, 2, 8, 5, 10, 13, C.steel);
    b.box(1, 10, 8, 5, 11, 13, C.brass);
    b.part("piston", [3, 11, 10.5], slide("y", 2, 0.9, { wave: "crank" }));
    b.box(2, 11, 9, 4, 17, 12, C.iron);
    b.box(1, 17, 9, 5, 18, 12, C.brassD);
    b.body();
    chuteFront(b, 1);
    // Ore spill on the chute lip.
    b.box(13, 8, 15, 17, 9, 17, C.ironD);
    speckle(b, 1, 0, 1, 19, 2, 19, C.steel, C.steelD, 6);
    statusLamp(b, 4, 4, 16);
    // Forming family: iron and steel bodies, brass kept for trim and moving parts.
    b.retone({ [C.brassD]: C.ironD, [C.brassM]: C.iron });
    return b.build();
}
