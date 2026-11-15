// Spring winder, 2x2. Turns wind power into wound springs: a big flat mainspring coils in a brass
// frame (front face shows the spiral), driven by a reduction gear train, with a ratchet pawl that clicks.

import { Builder, spin, swing, slide } from "./builder";
import { C } from "./palette";
import { plinth, statusLamp } from "./common";

export function winder() {
    const b = new Builder("spring_winder", "Spring winder", 2, 2);
    plinth(b);
    // Frame: two brass cheeks with the arbor between them.
    b.box(3, 2, 6, 17, 4, 15, C.steelD);
    b.box(3, 4, 6, 5, 22, 9, C.brassD);
    b.box(15, 4, 6, 17, 22, 9, C.brassD);
    b.box(3, 21, 6, 17, 23, 9, C.brass);
    b.box(3, 4, 12, 5, 22, 15, C.brassD);
    b.box(15, 4, 12, 17, 22, 15, C.brassD);
    b.box(3, 21, 12, 17, 23, 15, C.brass);
    b.cyl("z", 10, 13, 1, 6, 16, C.iron); // arbor
    // Mainspring: a flat spiral on the front, winding.
    b.part("spring", [10, 13, 15], spin("z", 0.15));
    for (let t = 0; t < Math.PI * 2 * 3.6; t += 0.04) {
        const r = 1.6 + t * 0.32;
        if (r > 8.2) break;
        const x = Math.floor(10 + Math.cos(t) * r);
        const y = Math.floor(13 + Math.sin(t) * r);
        b.set(x, y, 15, C.steel);
        b.set(x, y, 16, C.iron);
    }
    b.cyl("z", 10, 13, 1.6, 15, 17, C.brassL);
    // Barrel behind the spring.
    b.part("barrel", [10, 13, 10.5], spin("z", 0.15));
    b.cyl("z", 10, 13, 6, 9, 12, C.cu);
    b.cyl("z", 10, 13, 6, 10, 11, C.cuD, 5);
    // Drive gears on the right: pinion and wheel.
    b.body();
    b.box(17, 2, 3, 19, 18, 6, C.steelD);
    b.part("pinion", [18, 16, 5], spin("x", 1.2));
    b.gear("x", 16, 5, 1.6, 2.6, 6, 17, 19, C.brassL);
    b.part("wheel", [18, 10, 5], spin("x", -0.3));
    b.gear("x", 10, 5, 3.8, 5, 16, 17, 19, C.brass, { spokes: 4, rim: 1, hub: 1.2 });
    // Ratchet pawl at the top of the front.
    b.body();
    b.box(13, 22, 15, 15, 24, 17, C.steelD);
    b.part("pawl", [14, 23, 16], swing("z", 0.25, 1.2));
    b.box(11, 22, 16, 15, 23, 17, C.iron);
    b.set(11, 21, 16, C.iron);
    b.body();
    // Input shaft from the wind line at the back, brass coupling.
    b.box(9, 6, 0, 11, 8, 6, C.iron);
    b.box(8, 5, 1, 12, 9, 3, C.brass);
    // Counterweight on a chain at the left, rising and falling as the spring takes up.
    b.box(0, 2, 8, 3, 26, 10, C.steelD);
    b.box(0, 25, 8, 6, 26, 10, C.steelD);
    b.part("weight", [1, 12, 11], slide("y", 3, 0.25));
    b.box(0, 9, 10, 3, 14, 13, C.iron);
    b.box(1, 14, 11, 2, 22, 12, C.steel);
    // Tension gauge on the top bar.
    b.body();
    b.box(7, 23, 12, 13, 26, 15, C.brass);
    b.cyl("z", 10, 24, 1.4, 15, 16, C.cream);
    b.part("needle", [10, 24, 16], swing("z", 0.5, 0.35));
    b.box(10, 24, 16, 11, 26, 17, C.red);
    b.body();
    statusLamp(b, 4, 4, 17);
    // Power family: timber frames with brass fittings.
    b.retone({ [C.brassD]: C.wood, [C.brassM]: C.wood });
    return b.build();
}
