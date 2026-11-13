// Kiln, 2x2. A domed copper kiln on a steel plinth: brick-flecked drum, brass bands, a glowing arched mouth
// at the front, a chimney at the back right and a leather bellows on the left that pumps while it works.

import { Builder, spin, slide, pulse } from "./builder";
import { C } from "./palette";
import { plinth, hopperBack, chuteFront, statusLamp, speckle, band } from "./common";

export function kiln() {
    const b = new Builder("kiln", "Kiln", 2, 2);
    plinth(b);
    // Drum and dome.
    b.cyl("y", 10, 10, 7.5, 2, 11, C.cu);
    b.sphere(10, 11, 10, 7.5, C.cu, 11);
    speckle(b, 2, 2, 2, 18, 19, 18, C.cu, C.cuD, 4);
    band(b, 3, C.brass, C.cu);
    band(b, 3, C.brass, C.cuD);
    band(b, 10, C.brass, C.cu);
    band(b, 10, C.brass, C.cuD);
    b.cyl("y", 10, 10, 3, 18, 19, C.brassD); // dome cap
    b.cyl("y", 10, 10, 1.5, 19, 21, C.brassL);
    // Arched mouth at the front with a brass surround.
    b.box(6, 3, 16, 14, 10, 18, C.brassD);
    b.carve(7, 4, 15, 13, 8, 18);
    b.carve(8, 8, 15, 12, 9, 18);
    b.part("fire", [10, 6, 15], pulse(1.3, 0.6), true);
    b.box(7, 4, 15, 13, 5, 16, C.ember);
    b.box(7, 5, 14, 13, 8, 15, C.glow);
    b.box(8, 8, 14, 12, 9, 15, C.glow);
    b.box(8, 4, 14, 12, 6, 15, C.ember);
    b.body();
    // Chimney, back right.
    b.box(13, 9, 2, 18, 12, 7, C.steelD);
    b.cyl("y", 15.5, 4.5, 2, 12, 27, C.steelD);
    b.cyl("y", 15.5, 4.5, 2.6, 26, 28, C.steel);
    b.cyl("y", 15.5, 4.5, 1.2, 27, 28, C.soot);
    band(b, 19, C.brassD, C.steelD, 12, 19, 1, 8);
    // Bellows on the left: wooden boards with a leather middle that squeezes.
    b.box(1, 2, 6, 5, 4, 14, C.wood);
    b.box(1, 4, 7, 5, 6, 13, C.cuD);
    b.box(4, 4, 9, 6, 5, 11, C.brassD); // nozzle into the kiln
    b.part("bellows", [3, 6, 10], slide("y", 1, 1.1, { wave: "sine" }));
    b.box(1, 6, 6, 5, 7, 14, C.wood);
    b.box(2, 7, 9, 4, 9, 11, C.brassD);
    // Drive gear for the bellows, beside it.
    b.body();
    b.box(2, 2, 14, 6, 5, 16, C.steelD);
    b.part("gear", [4, 7, 15], spin("z", 0.55));
    b.gear("z", 4, 7, 2.2, 3.5, 7, 16, 17, C.brass, { hole: 0.8 });
    b.body();
    hopperBack(b, 0);
    chuteFront(b, 1);
    statusLamp(b, 17, 4, 16);
    b.light([1.0, 0.6, 1.85], 0xff8a2a, 8, 3.5, "working");
    return b.build();
}
