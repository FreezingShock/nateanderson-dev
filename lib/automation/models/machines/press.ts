// Stamp press, 2x3. A brass portal frame with a heavy ram that slams onto an iron die, driven by a big
// six-spoke flywheel on the right side. Feed from the back left, plates out the front left.

import { Builder, spin, slide, swing } from "./builder";
import { C } from "./palette";
import { plinth, hopperBack, chuteFront, statusLamp, speckle } from "./common";

export function press() {
    const b = new Builder("press", "Stamp press", 2, 3);
    plinth(b);
    // Feed tray from the hopper to the bed, and the bed itself.
    b.box(3, 2, 3, 9, 4, 10, C.steel);
    b.box(4, 2, 9, 16, 8, 22, C.steelD);
    b.box(5, 8, 11, 15, 9, 20, C.iron);
    b.box(6, 9, 12, 14, 10, 19, C.ironD); // die
    // Stamped plate waiting on the out tray.
    b.box(4, 2, 22, 9, 4, 26, C.steel);
    b.box(5, 4, 22, 8, 5, 25, C.iron);
    // Portal frame.
    b.box(2, 2, 12, 5, 31, 19, C.brassD);
    b.box(15, 2, 12, 18, 31, 19, C.brassD);
    b.box(1, 2, 11, 6, 4, 20, C.brass);
    b.box(14, 2, 11, 19, 4, 20, C.brass);
    b.box(1, 30, 10, 19, 35, 21, C.brass);
    b.box(1, 34, 10, 19, 35, 21, C.brassL);
    speckle(b, 2, 4, 12, 18, 30, 19, C.brassD, C.brassM, 5);
    for (let x = 2; x < 19; x += 3) {
        b.set(x, 32, 9, C.brassL);
        b.set(x, 32, 21, C.brassL);
    }
    // Guide rails on the inner faces of the columns.
    b.box(5, 10, 14, 6, 30, 17, C.iron);
    b.box(14, 10, 14, 15, 30, 17, C.iron);
    // Ram and its rod. Rests up, slams down 6 voxels onto the die.
    b.part("ram", [10, 22, 15.5], slide("y", 3, 0.45, { wave: "stamp", phase: 0 }));
    b.box(6, 16, 11, 14, 24, 20, C.brass);
    b.box(6, 23, 11, 14, 24, 20, C.brassL);
    b.box(6, 15, 12, 14, 16, 19, C.ironD);
    b.box(9, 24, 14, 11, 33, 17, C.iron);
    b.body();
    // Flywheel on the right, axle through the crown.
    b.box(18, 2, 14, 20, 20, 17, C.steelD);
    b.part("flywheel", [19, 21, 15], spin("x", 0.45));
    b.wheel("x", 21, 15, 8.5, 18, 20, C.brass, 6, 2);
    b.cyl("x", 21, 15, 1.5, 17, 20, C.brassD);
    // Drive belt from the flywheel hub down to a motor on the plinth, and the motor's pulley.
    b.body();
    b.box(14, 2, 22, 19, 7, 27, C.steelD);
    for (let y = 3; y < 7; y += 2) b.box(14, y, 22, 19, y + 1, 27, C.soot); // cooling fins
    b.box(19, 7, 23, 20, 21, 24, C.soot); // belt
    b.part("motorPulley", [19, 6, 24], spin("x", 1.8));
    b.wheel("x", 6, 24, 2, 18, 20, C.brass, 4, 1);
    // Feed rollers on the tray, turning as blanks go in.
    b.part("rollerA", [6, 5, 5], spin("x", 1.2));
    b.cyl("x", 5, 5, 1.2, 3, 9, C.iron);
    b.part("rollerB", [6, 5, 8], spin("x", 1.2, { phase: 0.3 }));
    b.cyl("x", 5, 8, 1.2, 3, 9, C.iron);
    // Pressure gauge on the left column with a needle that kicks on each stroke.
    b.body();
    b.cyl("z", 3, 26, 2.2, 20, 21, C.brass);
    b.cyl("z", 3, 26, 1.6, 21, 22, C.cream);
    b.part("needle", [3, 26, 22], swing("z", 0.7, 0.45));
    b.box(3, 26, 22, 4, 28, 23, C.red);
    // Hazard plate on the die bed.
    b.body();
    for (let x = 4; x < 16; x++) b.set(x, 7, 22, x % 2 ? C.brassL : C.soot);
    b.body();
    hopperBack(b, 0);
    chuteFront(b, 0);
    statusLamp(b, 16, 9, 25);
    // Forming family: iron and steel bodies, brass kept for trim and moving parts.
    b.retone({ [C.brassD]: C.ironD, [C.brassM]: C.iron });
    return b.build();
}
