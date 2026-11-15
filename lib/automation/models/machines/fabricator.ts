// Fabricator, 4x4. The grand machine: four lamp-capped brass pillars joined by a gantry, a stepped dais,
// and an armillary of three rings turning on different axes round a glowing core. A trolley runs on the
// front beam. Four hoppers at the back, a wide chute out the front.

import { Builder, spin, slide, swing, pulse } from "./builder";
import { C } from "./palette";
import { plinth, hopperBack, chuteFront, statusLamp, speckle } from "./common";

export function fabricator() {
    const b = new Builder("fabricator", "Fabricator", 4, 4);
    plinth(b, 3);
    // Dais.
    b.cyl("y", 20, 20, 13, 3, 5, C.steelD);
    b.cyl("y", 20, 20, 13, 4, 5, C.steel, 12);
    b.cyl("y", 20, 20, 9, 5, 8, C.brassD);
    b.cyl("y", 20, 20, 9, 7, 8, C.brass, 8);
    b.cyl("y", 20, 20, 2, 8, 12, C.steelD);
    // Pillars with lamp caps.
    const P: [number, number][] = [
        [3, 3],
        [33, 3],
        [3, 33],
        [33, 33],
    ];
    for (const [x, z] of P) {
        b.box(x - 1, 3, z - 1, x + 5, 5, z + 5, C.brass);
        b.box(x, 5, z, x + 4, 38, z + 4, C.brassD);
        speckle(b, x, 5, z, x + 4, 38, z + 4, C.brassD, C.brassM, 4);
        for (const y of [12, 22, 32]) b.box(x - 1, y, z - 1, x + 5, y + 1, z + 5, C.brass);
        b.box(x - 1, 38, z - 1, x + 5, 40, z + 5, C.brassL);
    }
    // Gantry beams along the four top edges.
    b.box(4, 36, 3, 36, 38, 7, C.brass);
    b.box(4, 36, 33, 36, 38, 37, C.brass);
    b.box(3, 36, 4, 7, 38, 36, C.brass);
    b.box(33, 36, 4, 37, 38, 36, C.brass);
    for (let x = 6; x < 35; x += 4) {
        b.set(x, 37, 2, C.brassL);
        b.set(x, 37, 37, C.brassL);
    }
    // Pillar lamps.
    let n = 0;
    for (const [x, z] of P) {
        b.part("lamp" + n, [x + 2, 41, z + 2], pulse(0.4, 0.5, { phase: n * 0.25 }), true);
        b.box(x + 1, 40, z + 1, x + 3, 42, z + 3, C.glow);
        b.body();
        b.box(x + 1, 42, z + 1, x + 3, 43, z + 3, C.brassD);
        n++;
    }
    // Armillary rings round the core at (20, 22, 20).
    const cy = 22;
    b.part("ringOuter", [20, cy, 20], spin("y", 0.12));
    b.cyl("x", cy, 20, 13, 19, 21, C.brass, 11.6);
    b.part("ringMid", [20, cy, 20], spin("x", 0.2));
    b.cyl("z", 20, cy, 10, 19, 21, C.brassL, 8.6);
    b.part("ringInner", [20, cy, 20], spin("z", -0.3));
    b.cyl("y", 20, 20, 7, cy - 1, cy + 1, C.cu, 5.6);
    b.part("core", [20, cy, 20], pulse(0.9, 0.5), true);
    b.sphere(20, cy, 20, 3.4, C.glow);
    // Trolley on the front beam.
    b.part("trolley", [20, 35, 35], slide("x", 8, 0.12));
    b.box(17, 34, 33, 23, 36, 38, C.steelD);
    b.box(19, 28, 34, 21, 34, 36, C.iron);
    b.box(18, 27, 34, 22, 28, 36, C.ironD);
    // Weld glow under the trolley tool.
    b.part("weld", [20, 26, 35], pulse(2.8, 0.8), true);
    b.box(19, 26, 34, 21, 27, 36, C.glow);
    // Side feed arms on the dais that reach in and back.
    b.part("feedL", [9, 9, 20], swing("y", 0.4, 0.3));
    b.box(8, 8, 19, 14, 10, 22, C.brass);
    b.box(13, 8, 19, 14, 12, 22, C.iron);
    b.part("feedR", [31, 9, 20], swing("y", 0.4, 0.3, { phase: 0.5 }));
    b.box(26, 8, 19, 32, 10, 22, C.brass);
    b.box(26, 8, 19, 27, 12, 22, C.iron);
    // Control lectern at the front left with a gauge and a lit valve.
    b.body();
    b.box(6, 3, 30, 12, 12, 34, C.steelD);
    b.box(5, 12, 29, 13, 13, 35, C.brass);
    b.cyl("z", 9, 9, 2, 34, 35, C.cream);
    b.part("needle", [9, 9, 35], swing("z", 0.7, 0.35));
    b.box(9, 9, 35, 10, 11, 36, C.red);
    b.part("valve", [7, 14, 32], spin("y", 0.6));
    b.cyl("y", 7, 32, 1.5, 13, 14, C.brassL);
    b.body();
    for (let c = 0; c < 4; c++) hopperBack(b, c, 10);
    chuteFront(b, 1, 2);
    statusLamp(b, 36, 5, 34);
    b.light([2.0, 2.2, 2.0], 0xffb347, 12, 5, "working");
    return b.build();
}
