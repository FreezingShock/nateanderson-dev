// Wire drawer, 1x2. Copper is pulled from the back through a brass die block and wound onto a big
// flanged drum at the front. A capstan turns on the die and a gear pair turns on the side.

import { Builder, spin } from "./builder";
import { C } from "./palette";
import { plinth, hopperBack, chuteFront, statusLamp } from "./common";

export function drawer() {
    const b = new Builder("drawer", "Wire drawer", 1, 2);
    plinth(b);
    b.box(1, 2, 4, 9, 8, 17, C.steelD);
    b.box(1, 8, 4, 9, 9, 17, C.steel);
    // Die block.
    b.box(2, 9, 7, 8, 14, 10, C.brassD);
    b.box(2, 13, 7, 8, 14, 10, C.brass);
    b.cyl("z", 5, 11.5, 1, 6, 11, C.soot);
    // Wire run: from the feed to the die, die to drum.
    b.box(4, 11, 3, 6, 12, 7, C.cuRaw);
    b.box(5, 11, 10, 6, 12, 13, C.cu);
    // Drum stands.
    b.box(0, 9, 13, 1, 17, 16, C.steelD);
    b.box(9, 9, 13, 10, 17, 16, C.steelD);
    // Drum with wound wire and brass flanges.
    b.part("drum", [5, 15, 15], spin("x", 0.8));
    b.cyl("x", 15, 15, 3.4, 2, 8, C.cu);
    for (let x = 2; x < 8; x += 2) b.cyl("x", 15, 15, 3.4, x, x + 1, C.cuD);
    b.cyl("x", 15, 15, 4.6, 1, 2, C.brass);
    b.cyl("x", 15, 15, 4.6, 8, 9, C.brass);
    b.cyl("x", 15, 15, 1, 0, 10, C.brassD);
    for (const [y, z] of [
        [18, 14],
        [12, 15],
    ])
        b.set(1, y, z, C.brassL);
    // Capstan on top of the die.
    b.part("capstan", [5, 14, 9], spin("y", -1.2));
    b.gear("y", 5, 9, 2, 3, 6, 14, 15, C.brass);
    b.cyl("y", 5, 9, 1, 15, 17, C.brassL);
    // Gear pair on the right face.
    b.part("gearA", [9.5, 5, 7], spin("x", 0.9));
    b.gear("x", 5, 7, 2, 3, 8, 9, 10, C.brassD, { hole: 0.6 });
    b.part("gearB", [9.5, 5, 12], spin("x", -0.9));
    b.gear("x", 5, 12, 2, 3, 8, 9, 10, C.brass, { hole: 0.6, phase: 0.5 });
    b.body();
    hopperBack(b, 0, 8);
    chuteFront(b, 0);
    statusLamp(b, 2, 9, 5);
    return b.build();
}
