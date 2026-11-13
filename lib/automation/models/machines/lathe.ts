// Lathe, 1x2. A long bed along the belt line: headstock at the back with a spinning chuck and workpiece,
// a tool carriage that runs up and down the ways, a tailstock at the front and an overhead drive pulley.

import { Builder, spin, slide } from "./builder";
import { C } from "./palette";
import { plinth, hopperBack, chuteFront, statusLamp } from "./common";

export function lathe() {
    const b = new Builder("lathe", "Lathe", 1, 2);
    plinth(b);
    // Legs and bed.
    b.box(2, 2, 4, 8, 8, 6, C.steelD);
    b.box(2, 2, 14, 8, 8, 16, C.steelD);
    b.box(1, 8, 3, 9, 10, 17, C.steel);
    b.box(2, 10, 3, 4, 11, 17, C.iron);
    b.box(6, 10, 3, 8, 11, 17, C.iron);
    // Headstock.
    b.box(1, 10, 3, 9, 19, 8, C.brassD);
    b.box(1, 18, 3, 9, 19, 8, C.brass);
    b.box(2, 12, 2, 8, 17, 3, C.brass); // gear cover plate
    b.set(5, 15, 1, C.brassL);
    // Tailstock.
    b.box(2, 11, 15, 8, 16, 18, C.brassD);
    b.box(4, 13, 13, 6, 15, 15, C.steel);
    // Chuck and workpiece, spinning along z.
    b.part("chuck", [5, 14, 8], spin("z", 2.2));
    b.cyl("z", 5, 14, 3.2, 8, 10, C.iron);
    b.box(4, 17, 8, 6, 18, 10, C.ironD); // jaws
    b.box(4, 10, 8, 6, 11, 10, C.ironD);
    b.cyl("z", 5, 14, 1.2, 10, 13, C.al);
    // Tool carriage running along the ways.
    b.part("carriage", [5, 11, 11], slide("z", 1.5, 0.5));
    b.box(1, 11, 10, 9, 12, 13, C.brass);
    b.box(7, 12, 10, 9, 14, 12, C.steelD);
    b.box(6, 13, 11, 7, 14, 12, C.cream); // cutter tip
    // Overhead pulley on a gantry.
    b.body();
    b.box(1, 19, 4, 2, 25, 6, C.steelD);
    b.box(8, 19, 4, 9, 25, 6, C.steelD);
    b.box(1, 24, 4, 9, 25, 6, C.steel);
    b.part("pulley", [5, 22, 5], spin("z", 1.1));
    b.wheel("z", 5, 22, 2.6, 4, 6, C.brass, 4, 1);
    b.body();
    hopperBack(b, 0, 9);
    chuteFront(b, 0);
    statusLamp(b, 8, 20, 7);
    return b.build();
}
