// Spring store, 2x2. Holds wound springs: three stacked brass barrels on a column, each with a slit that
// shows the coil, and a big gauge on the front. The gauge needle part ("needle") should be driven by the
// renderer from the stored charge; the default swing is only a placeholder.

import { Builder, spin, swing } from "./builder";
import { C } from "./palette";
import { plinth, statusLamp, speckle } from "./common";

export function springStore() {
    const b = new Builder("spring_store", "Spring store", 2, 2);
    plinth(b);
    b.cyl("y", 10, 10, 2, 2, 36, C.steelD);
    for (let k = 0; k < 3; k++) {
        const y0 = 3 + k * 10;
        b.cyl("y", 10, 10, 7.5, y0, y0 + 8, C.brassD);
        speckle(b, 2, y0, 2, 18, y0 + 8, 18, C.brassD, C.brassM, 5);
        b.cyl("y", 10, 10, 8, y0, y0 + 1, C.brass);
        b.cyl("y", 10, 10, 8, y0 + 7, y0 + 8, C.brass);
        // Slit on the right showing the coil.
        b.box(16, y0 + 2, 8, 19, y0 + 6, 13, C.soot);
        for (let z = 8; z < 13; z += 2) b.box(16, y0 + 2, z, 17, y0 + 6, z + 1, C.steel);
    }
    // Top cap with a winding key.
    b.cyl("y", 10, 10, 6, 33, 35, C.brass);
    b.cyl("y", 10, 10, 3, 35, 36, C.brassL);
    b.part("key", [10, 36, 10], spin("y", 0.2));
    b.box(9, 36, 9, 11, 40, 11, C.iron);
    b.box(6, 39, 9, 14, 41, 11, C.brass);
    b.box(5, 38, 9, 7, 42, 11, C.brassL);
    b.box(13, 38, 9, 15, 42, 11, C.brassL);
    // Gauge on the front.
    b.body();
    b.box(6, 17, 16, 14, 25, 18, C.brass);
    b.cyl("z", 10, 21, 3.6, 18, 19, C.cream);
    for (const [x, y, c] of [
        [7, 21, C.patina],
        [8, 23, C.patina],
        [10, 24, C.brassD],
        [12, 23, C.red],
        [13, 21, C.red],
    ] as const)
        b.set(x, y, 19, c);
    b.part("needle", [10, 21, 19], swing("z", 1.1, 0.05, { when: "always" }));
    b.box(10, 21, 19, 11, 24, 20, C.sootD);
    b.body();
    statusLamp(b, 16, 2, 16);
    return b.build();
}
