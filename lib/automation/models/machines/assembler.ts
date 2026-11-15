// Assembler, 3x3. A riveted brass workshop cabinet. On the deck, a turntable carries the job between two
// swinging arms. The front face shows its clockwork: a large gear meshing with a small one, beside a lit
// inspection window. Three hoppers at the back, one chute at the front centre.

import { Builder, spin, swing, slide, pulse } from "./builder";
import { C } from "./palette";
import { plinth, hopperBack, chuteFront, statusLamp, speckle } from "./common";

export function assembler() {
    const b = new Builder("assembler", "Assembler", 3, 3);
    plinth(b);
    // Cabinet.
    b.box(2, 2, 4, 28, 16, 25, C.brassD);
    speckle(b, 2, 2, 4, 28, 16, 25, C.brassD, C.brassM, 5);
    b.box(1, 16, 3, 29, 18, 26, C.brass);
    b.box(1, 17, 3, 29, 18, 4, C.brassL);
    b.box(1, 17, 25, 29, 18, 26, C.brassL);
    for (let x = 3; x < 28; x += 3) {
        b.set(x, 15, 25, C.brassL);
        b.set(x, 3, 25, C.brassL);
    }
    // Inspection window, lit from inside.
    b.box(18, 5, 25, 27, 14, 26, C.steelD);
    b.part("window", [22.5, 9.5, 25], pulse(0.7, 0.45), true);
    b.box(19, 6, 25, 26, 13, 26, C.glow);
    b.body();
    b.box(22, 6, 26, 23, 13, 27, C.steelD); // mullion
    b.box(19, 9, 26, 26, 10, 27, C.steelD);
    // Clockwork on the front face: big gear meshing with a small one.
    b.cyl("z", 9, 10, 1, 24, 27, C.steelD);
    b.part("bigGear", [9, 10, 26], spin("z", 0.25));
    b.gear("z", 9, 10, 4.6, 6, 14, 26, 27, C.brass, { spokes: 4, rim: 1.4, hub: 1.3 });
    b.part("smallGear", [17, 10, 26], spin("z", -0.5));
    b.gear("z", 17, 10, 1.9, 3, 7, 26, 27, C.brassL, { hole: 0.7, phase: 0.5 });
    // Turntable on the deck with a work jig.
    b.body();
    b.cyl("y", 15, 15, 3, 18, 19, C.steelD);
    b.part("table", [15, 19, 15], spin("y", 0.18));
    b.cyl("y", 15, 15, 7, 19, 20, C.iron);
    b.cyl("y", 15, 15, 7, 19, 20, C.brass, 6);
    b.box(12, 20, 12, 18, 22, 17, C.steel);
    b.box(13, 22, 13, 17, 23, 16, C.cu);
    // Arm posts and arms.
    b.body();
    b.box(4, 18, 5, 7, 28, 8, C.steelD);
    b.box(23, 18, 21, 26, 28, 24, C.steelD);
    b.part("armA", [6, 27, 7], swing("y", 0.6, 0.35));
    b.box(4, 27, 5, 16, 29, 8, C.brass);
    b.box(13, 23, 5, 15, 27, 8, C.iron);
    b.box(12, 22, 5, 16, 23, 8, C.ironD);
    b.part("armB", [24, 27, 22], swing("y", 0.6, 0.35, { phase: 0.5 }));
    b.box(14, 27, 21, 26, 29, 24, C.brass);
    b.box(15, 23, 21, 17, 27, 24, C.iron);
    b.box(14, 22, 21, 18, 23, 24, C.ironD);
    // Vent stacks at the back corners.
    b.body();
    b.cyl("y", 26, 6, 1.6, 18, 31, C.steelD);
    b.cyl("y", 26, 6, 2.2, 30, 32, C.steel);
    // Welding spark at the jig, flickering while it works.
    b.part("spark", [15, 23, 15], pulse(3.1, 0.8), true);
    b.box(14, 23, 14, 16, 24, 16, C.glow);
    // Parts tray on the left with a feed conveyor of turning rollers.
    b.body();
    b.box(1, 2, 8, 2, 14, 22, C.steelD);
    for (let i = 0; i < 4; i++) {
        b.part("roller" + i, [1, 15, 9 + i * 4], spin("x", 1.1, { phase: i * 0.2 }));
        b.cyl("x", 15, 9 + i * 4, 1, 0, 2, C.iron);
    }
    // Overhead gantry with a hook trolley sliding across the deck.
    b.body();
    b.box(2, 18, 13, 3, 30, 16, C.steelD);
    b.box(27, 18, 13, 28, 30, 16, C.steelD);
    b.box(2, 30, 13, 28, 31, 16, C.brass);
    b.part("hook", [15, 29, 14], slide("x", 6, 0.2));
    b.box(13, 28, 13, 17, 30, 16, C.steelD);
    b.box(14, 25, 14, 16, 28, 15, C.iron);
    // Pressure gauge beside the window.
    b.body();
    b.cyl("z", 14, 4, 1.8, 25, 26, C.cream);
    b.part("needle", [14, 4, 26], swing("z", 0.6, 0.5));
    b.box(14, 4, 26, 15, 6, 27, C.red);
    b.body();
    hopperBack(b, 0);
    hopperBack(b, 1);
    hopperBack(b, 2);
    chuteFront(b, 1);
    statusLamp(b, 4, 18, 23);
    b.light([2.25, 1.0, 2.75], 0xffb347, 5, 3, "working");
    return b.build();
}
