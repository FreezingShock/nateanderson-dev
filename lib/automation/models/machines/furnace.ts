// Furnace, 2x3. A tall copper blast furnace on a firebox: two hoppers at the back (ore and coal),
// a banded tapering stack, a glowing tap hole that runs molten metal to the front chute, a blower
// flywheel on the right and twin bellows pistons on the left that pump out of step.

import { Builder, spin, slide, pulse } from "./builder";
import { C } from "./palette";
import { plinth, hopperBack, chuteFront, statusLamp, speckle, band } from "./common";

export function furnace() {
    const b = new Builder("furnace", "Furnace", 2, 3);
    plinth(b);
    // Firebox: dark steel block with brass corner posts.
    b.box(3, 2, 7, 17, 11, 24, C.steelD);
    for (const [x, z] of [
        [3, 7],
        [15, 7],
        [3, 22],
        [15, 22],
    ])
        b.box(x, 2, z, x + 2, 12, z + 2, C.brass);
    b.box(2, 11, 6, 18, 12, 25, C.brassD);
    // Tower: tapering copper shaft with brass bands and hammered texture.
    b.taper(10, 15.5, 7, 5, 12, 31, C.cu);
    speckle(b, 2, 12, 8, 18, 31, 24, C.cu, C.cuD, 4);
    for (const y of [14, 20, 26, 30]) {
        band(b, y, C.brass, C.cu);
        band(b, y, C.brass, C.cuD);
    }
    // Charging ring and stack on top.
    b.cyl("y", 10, 15.5, 5.5, 31, 33, C.brassD);
    b.cyl("y", 10, 15.5, 4, 31, 33, C.soot);
    b.cyl("y", 10, 15.5, 2.3, 31, 40, C.steelD);
    b.cyl("y", 10, 15.5, 3, 39, 41, C.steel);
    b.cyl("y", 10, 15.5, 1.4, 40, 41, C.soot);
    // Charging chute from the back hoppers up the tower.
    b.rod([5, 9, 4], [8, 30, 10], 2, C.steel);
    b.rod([15, 9, 4], [12, 30, 10], 2, C.steel);
    // Tap hole: an arch in the firebox front with the fire behind, and a molten runner to the chute.
    b.box(6, 2, 23, 14, 10, 25, C.brassD);
    b.carve(7, 3, 22, 13, 8, 25);
    b.carve(8, 8, 22, 12, 9, 25);
    b.part("fire", [10, 5, 22], pulse(1.6, 0.6), true);
    b.box(7, 3, 21, 13, 8, 22, C.glow);
    b.box(8, 8, 21, 12, 9, 22, C.glow);
    b.box(7, 3, 22, 13, 4, 24, C.ember);
    b.part("runner", [11, 3, 26], pulse(0.9, 0.4, { phase: 0.3 }), true);
    b.box(10, 2, 24, 13, 3, 26, C.ember);
    b.box(11, 2, 26, 13, 3, 27, C.ember);
    b.body();
    b.box(9, 1, 24, 14, 2, 27, C.steelD);
    // Blower on the right: bearing stand and a spoked flywheel.
    b.box(17, 2, 13, 19, 9, 18, C.steelD);
    b.box(16, 8, 15, 19, 9, 16, C.iron);
    b.part("blower", [18, 9, 15], spin("x", 1.4));
    b.wheel("x", 9, 15, 5.5, 17, 19, C.brass, 6, 1.5);
    b.cyl("x", 9, 15, 1.3, 16, 20, C.brassD);
    // Twin bellows pistons on the left.
    b.body();
    for (const [z, ph] of [
        [10, 0],
        [17, 0.5],
    ] as const) {
        b.box(0, 2, z, 3, 10, z + 4, C.steel);
        b.box(0, 10, z, 3, 11, z + 4, C.brass);
        b.part("piston" + z, [1.5, 11, z + 2], slide("y", 2, 1.1, { wave: "crank", phase: ph }));
        b.box(1, 11, z + 1, 2, 16, z + 3, C.iron);
        b.box(0, 16, z, 3, 17, z + 4, C.brassD);
        b.body();
    }
    hopperBack(b, 0, 10);
    hopperBack(b, 1, 10);
    // Coal heaped in the right hopper so the fuel input reads.
    b.box(12, 9, 1, 17, 10, 3, C.coal);
    chuteFront(b, 1);
    statusLamp(b, 4, 12, 26);
    b.light([1.0, 0.55, 2.55], 0xff8a2a, 10, 4, "working");
    return b.build();
}
