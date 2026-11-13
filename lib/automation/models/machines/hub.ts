// Hub, 3x3. Where deliveries go. A brick-and-brass depot with intake hoppers on all four sides and a
// clock tower with a patina roof. The clock hands turn on all four faces, and the bell swings while
// a delivery is counted.

import { Builder, spin, swing } from "./builder";
import { C } from "./palette";
import { plinth, hopperBack, hopperLeft, hopperRight, statusLamp, speckle } from "./common";

export function hub() {
    const b = new Builder("hub", "Hub", 3, 3);
    plinth(b);
    // Depot block.
    b.box(4, 2, 4, 26, 12, 26, C.cu);
    speckle(b, 4, 2, 4, 26, 12, 26, C.cu, C.cuD, 3);
    b.box(3, 12, 3, 27, 14, 27, C.brass);
    b.box(3, 2, 3, 27, 3, 27, C.brassD);
    // Tower.
    b.box(9, 14, 9, 21, 36, 21, C.brassD);
    speckle(b, 9, 14, 9, 21, 36, 21, C.brassD, C.brassM, 5);
    b.box(8, 26, 8, 22, 27, 22, C.brass);
    b.box(8, 35, 8, 22, 37, 22, C.brass);
    // Belfry and roof.
    b.box(9, 37, 9, 11, 42, 11, C.brassD);
    b.box(19, 37, 9, 21, 42, 11, C.brassD);
    b.box(9, 37, 19, 11, 42, 21, C.brassD);
    b.box(19, 37, 19, 21, 42, 21, C.brassD);
    for (let y = 42; y < 50; y++) {
        const i = y - 42;
        b.box(8 + i, y, 8 + i, 22 - i, y + 1, 22 - i, C.patina);
    }
    b.box(14, 50, 14, 16, 55, 16, C.brassL);
    b.part("bell", [15, 42, 15], swing("x", 0.35, 0.8));
    b.sphere(15, 38.5, 15, 3, C.brass, 37);
    b.box(13, 37, 13, 17, 38, 17, C.brassL);
    // Clock faces and hands on four sides at y 30.5.
    b.body();
    const cy = 31;
    b.cyl("z", 15, cy, 4.2, 21, 22, C.cream);
    b.cyl("z", 15, cy, 4.2, 8, 9, C.cream);
    b.cyl("x", cy, 15, 4.2, 21, 22, C.cream);
    b.cyl("x", cy, 15, 4.2, 8, 9, C.cream);
    const hands = (id: string, axis: "x" | "z", at: number, dir: 1 | -1) => {
        b.part(id + "M", axis === "z" ? [15, cy, at] : [at, cy, 15], spin(axis, 0.08 * dir, { when: "always" }));
        if (axis === "z") b.box(15, 31, at, 16, 34, at + 1, C.sootD);
        else b.box(at, 31, 15, at + 1, 34, 16, C.sootD);
        b.part(id + "H", axis === "z" ? [15, cy, at] : [at, cy, 15], spin(axis, 0.008 * dir, { when: "always" }));
        if (axis === "z") b.box(15, 28, at, 17, 31, at + 1, C.sootD);
        else b.box(at, 28, 15, at + 1, 31, 17, C.sootD);
    };
    hands("front", "z", 22, -1);
    hands("back", "z", 7, 1);
    hands("right", "x", 22, 1);
    hands("left", "x", 7, -1);
    // Intakes: three at the back, one each side, and a wide intake at the front.
    b.body();
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
    // Door lamps.
    statusLamp(b, 6, 14, 6);
    statusLamp(b, 23, 14, 23, "lamp2");
    b.light([1.5, 1.6, 2.2], 0xffb347, 1.5, 2.5, "always");
    return b.build();
}
