// Kiln, 2x2. A domed copper kiln on a brick firebox: riveted bands and ribs on the drum, a glowing firebox behind
// grate bars with its door swung open, a chimney at the back right with a turning cowl, a leather bellows on the
// left driven by a geared crank, and a temperature dial with a rocking needle on the right.

import { Builder, spin, slide, swing, pulse } from "./builder";
import { C } from "./palette";
import { plinth, hopperBack, chuteFront, statusLamp, speckle, band } from "./common";

export function kiln() {
    const b = new Builder("kiln", "Kiln", 2, 2);
    plinth(b);
    // Brick firebox course: red brick with dark mortar lines.
    b.cyl("y", 10, 10, 8.3, 2, 6, C.red);
    for (let y = 2; y < 6; y++) band(b, y, (y % 2 ? C.cuD : C.red), C.red);
    band(b, 4, C.sootD, -1, -64, 128, -64, 128);
    b.paint(-64, 2, -64, 128, 6, 128, C.red, C.sootD);
    speckle(b, 1, 2, 1, 19, 6, 19, C.red, C.cuD, 3);
    b.paint(-64, 3, -64, 128, 4, 128, C.sootD, C.cuD);
    // Drum and dome.
    b.cyl("y", 10, 10, 7.5, 6, 13, C.cu);
    b.sphere(10, 13, 10, 7.5, C.cu, 13);
    speckle(b, 2, 6, 2, 18, 21, 18, C.cu, C.cuD, 5);
    // Riveted brass bands and eight vertical ribs.
    for (const y of [6, 12]) {
        band(b, y, C.brass, C.cu);
        band(b, y, C.brass, C.cuD);
    }
    for (let a = 0; a < 8; a++) {
        const t = (a / 8) * Math.PI * 2 + 0.2;
        const x = Math.floor(10 + Math.cos(t) * 7.6);
        const z = Math.floor(10 + Math.sin(t) * 7.6);
        b.box(x, 7, z, x + 1, 12, z + 1, C.brassD);
        b.set(x, 9, z, C.brassL);
    }
    b.cyl("y", 10, 10, 3, 20, 21, C.brassD); // dome cap
    b.cyl("y", 10, 10, 1.5, 21, 23, C.brassL);

    // Firebox mouth at the front: brass surround, grate bars in front of the fire.
    b.box(5, 2, 16, 15, 11, 19, C.brassD);
    b.box(5, 10, 16, 15, 11, 19, C.brass);
    b.carve(6, 3, 15, 14, 9, 19);
    b.carve(7, 9, 15, 13, 10, 19);
    for (let x = 6; x < 14; x += 2) b.box(x, 3, 18, x + 1, 9, 19, C.soot);
    b.box(6, 2, 18, 14, 3, 19, C.steelD); // ash lip
    // The door, hinged on the left and swung open.
    b.box(3, 3, 18, 5, 10, 19, C.steelD);
    b.box(2, 3, 17, 3, 10, 19, C.steel);
    b.set(2, 6, 19, C.brassL);
    b.part("fire", [10, 6, 16], pulse(1.3, 0.6), true);
    b.box(6, 3, 16, 14, 4, 17, C.ember);
    b.box(6, 4, 15, 14, 9, 16, C.glow);
    b.box(7, 9, 15, 13, 10, 16, C.glow);
    b.box(7, 3, 17, 13, 5, 18, C.ember);
    b.body();

    // Chimney, back right, banded, with a turning cowl on top.
    b.box(13, 6, 1, 19, 13, 7, C.steelD);
    b.cyl("y", 16, 4, 2, 13, 28, C.steelD);
    b.cyl("y", 16, 4, 2.6, 27, 29, C.steel);
    for (const y of [16, 22]) band(b, y, C.brassD, C.steelD, 13, 20, 1, 8);
    b.part("cowl", [16, 29, 4], spin("y", 0.35));
    b.box(14, 29, 2, 19, 30, 7, C.brass);
    b.box(14, 30, 2, 15, 32, 7, C.brassD);
    b.box(15, 32, 2, 19, 33, 7, C.brass);
    b.body();

    // Bellows on the left: wooden boards with a leather middle that squeezes, a nozzle into the firebox.
    b.box(0, 2, 6, 5, 4, 14, C.wood);
    b.box(0, 4, 7, 5, 6, 13, C.cuD);
    b.box(4, 3, 9, 6, 4, 11, C.brassD);
    b.part("bellows", [2, 6, 10], slide("y", 1, 1.1, { wave: "sine" }));
    b.box(0, 6, 6, 5, 7, 14, C.wood);
    b.box(1, 7, 9, 3, 9, 11, C.brassD);
    b.box(1, 9, 9, 2, 13, 11, C.steel); // crank rod
    // Crank gear that drives it.
    b.body();
    b.box(0, 2, 14, 4, 12, 16, C.steelD);
    b.part("gear", [4, 13, 15], spin("z", 0.55));
    b.gear("z", 4, 13, 2.2, 3.5, 7, 16, 17, C.brass, { hole: 0.8 });

    // Temperature dial on the right with a rocking needle.
    b.body();
    b.box(16, 7, 9, 18, 13, 13, C.steelD);
    b.cyl("x", 10, 11, 2, 18, 19, C.cream);
    b.part("needle", [19, 10, 11], swing("x", 0.6, 0.4));
    b.box(19, 10, 11, 20, 12, 12, C.red);

    b.body();
    hopperBack(b, 0);
    chuteFront(b, 1);
    statusLamp(b, 17, 4, 16);
    b.light([1.0, 0.6, 1.85], 0xff8a2a, 8, 3.5, "working");
    return b.build();
}
