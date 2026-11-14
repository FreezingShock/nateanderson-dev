// Node drill, 2x2. A riveted iron derrick over the resource node on a skid frame. Moving parts that read as
// working: the auger and a toothed cutting ring turn in the well, the crosshead rides up and down on two rams, the
// crown gear spins, a twin-cylinder engine at the back left pumps and drives a side flywheel by a belt, and a
// pressure needle rocks on the gauge. Output chute on the front right.

import { Builder, spin, slide, swing } from "./builder";
import { C } from "./palette";
import { plinth, chuteFront, statusLamp, speckle } from "./common";

export function drill() {
    const b = new Builder("drill", "Node drill", 2, 2);
    plinth(b);
    // Skid frame: two steel rails along the sides with brass bolts, and a cross sill at the back.
    b.box(1, 2, 1, 3, 4, 15, C.steelD);
    b.box(17, 2, 1, 19, 4, 12, C.steelD);
    b.box(3, 2, 1, 17, 3, 3, C.steelD);
    for (let z = 2; z < 15; z += 3) b.set(1, 4, z, C.brassL);
    for (let z = 2; z < 12; z += 3) b.set(18, 4, z, C.brassL);

    // Well collar with hazard stripes, ore-stained, and a dark bore.
    b.cyl("y", 10, 10, 4.8, 2, 5, C.steel);
    for (let a = 0; a < 16; a++) {
        const t = (a / 16) * Math.PI * 2;
        if (a % 2) b.paint(Math.floor(10 + Math.cos(t) * 4.4), 4, Math.floor(10 + Math.sin(t) * 4.4), Math.floor(10 + Math.cos(t) * 4.4) + 1, 5, Math.floor(10 + Math.sin(t) * 4.4) + 1, C.brass);
    }
    b.cyl("y", 10, 10, 3.2, 2, 5, C.soot);
    speckle(b, 5, 2, 5, 15, 5, 15, C.steel, C.ironD, 4);

    // Tower: four straight iron posts with X braces on each face and brass collars at two heights.
    const posts: [number, number][] = [
        [5, 5],
        [14, 5],
        [5, 14],
        [14, 14],
    ];
    for (const [x, z] of posts) {
        b.box(x, 4, z, x + 2, 27, z + 2, C.iron);
        b.box(x - 1, 4, z - 1, x + 3, 6, z + 3, C.steelD); // foot plate
        b.set(x, 12, z, C.brassL);
        b.set(x + 1, 20, z + 1, C.brassL);
    }
    b.frame(5, 12, 5, 16, 13, 16, 1, C.brass);
    b.frame(5, 20, 5, 16, 21, 16, 1, C.brass);
    // X braces on the left, right and back faces (the front stays open so the auger shows).
    b.rod([5, 6, 5], [5, 12, 15], 1, C.ironD);
    b.rod([5, 6, 15], [5, 12, 5], 1, C.ironD);
    b.rod([15, 6, 5], [15, 12, 15], 1, C.ironD);
    b.rod([15, 6, 15], [15, 12, 5], 1, C.ironD);
    b.rod([5, 13, 5], [15, 20, 5], 1, C.ironD);
    b.rod([15, 13, 5], [5, 20, 5], 1, C.ironD);
    // Ladder up the front left post.
    for (let y = 6; y < 26; y += 2) b.box(3, y, 15, 5, y + 1, 16, C.brassD);
    b.box(3, 5, 15, 4, 26, 16, C.steelD);
    // Gearbox at mid height with a gauge on the front.
    b.box(7, 13, 7, 14, 17, 14, C.steelD);
    b.box(6, 13, 6, 15, 14, 15, C.steel);
    b.cyl("z", 10, 15, 2.3, 15, 16, C.brass);
    b.cyl("z", 10, 15, 1.8, 16, 17, C.cream);
    // Crown housing on top, riveted.
    b.box(5, 27, 5, 16, 29, 16, C.brass);
    b.box(6, 29, 6, 15, 30, 15, C.brassL);
    b.rivets(5, 16, 28, 16, 2, C.brassD);

    // Auger: a double spiral of flighting round a shaft, turning with the drill.
    b.part("auger", [10, 0, 10], spin("y", 0.9));
    b.cyl("y", 10, 10, 1.2, 1, 27, C.iron);
    for (let y = 5; y < 26; y++) {
        for (let s = 0; s < 2; s++) {
            const a = y * 0.8 + s * Math.PI;
            for (const r of [1.8, 2.6]) {
                const x = Math.floor(10 + Math.cos(a) * r);
                const z = Math.floor(10 + Math.sin(a) * r);
                b.set(x, y, z, s ? C.ironD : C.steel);
            }
        }
    }
    // Cutting ring at the bottom of the bore: steel with bright teeth, turning the other way.
    b.part("bit", [10, 3, 10], spin("y", -1.4));
    b.gear("y", 10, 10, 2.2, 3.4, 8, 2, 4, C.steel, { hole: 1.2 });
    for (let a = 0; a < 8; a++) {
        const t = (a / 8) * Math.PI * 2;
        b.set(Math.floor(10 + Math.cos(t) * 3), 4, Math.floor(10 + Math.sin(t) * 3), C.brassL);
    }

    // Crosshead: a brass yoke riding up and down on two rams beside the tower.
    b.body();
    b.box(4, 13, 9, 5, 21, 12, C.steelD); // ram cylinders
    b.box(16, 13, 9, 17, 21, 12, C.steelD);
    b.part("crosshead", [10, 22, 10], slide("y", 1.5, 0.45, { wave: "crank" }));
    b.box(3, 22, 9, 18, 24, 12, C.brass);
    b.box(3, 24, 9, 18, 25, 12, C.brassL);
    b.box(4, 18, 10, 5, 22, 11, C.steel); // piston rods
    b.box(16, 18, 10, 17, 22, 11, C.steel);

    // Crown gear turning on the roof.
    b.part("crown", [10, 30, 10], spin("y", -0.45));
    b.gear("y", 10, 10, 4, 5.5, 10, 30, 32, C.brass, { hole: 1.5, spokes: 4 });
    b.cyl("y", 10, 10, 1.5, 30, 33, C.steelD);

    // Engine at the back left: a finned block with two pumping cylinders and an exhaust stack.
    b.body();
    b.box(0, 3, 0, 5, 11, 5, C.steel);
    for (let y = 4; y < 11; y += 2) b.box(0, y, 0, 5, y + 1, 5, C.steelD); // cooling fins
    b.box(0, 11, 0, 5, 12, 5, C.brassD);
    b.part("pistonA", [1.5, 12, 2.5], slide("y", 1.5, 1.6, { wave: "crank" }));
    b.box(1, 12, 1, 3, 16, 4, C.iron);
    b.box(1, 16, 1, 3, 17, 4, C.brass);
    b.part("pistonB", [3.5, 12, 2.5], slide("y", 1.5, 1.6, { wave: "crank", phase: 0.5 }));
    b.box(3, 12, 1, 5, 16, 4, C.iron);
    b.box(3, 16, 1, 5, 17, 4, C.brass);
    b.body();
    b.cyl("y", 1.5, 6.5, 1, 4, 22, C.steelD); // exhaust stack
    b.cyl("y", 1.5, 6.5, 1.6, 21, 23, C.brass);
    b.set(1, 22, 6, C.soot);

    // Flywheel on the right side, belt-driven from the gearbox.
    b.box(14, 15, 9, 18, 17, 11, C.iron); // drive axle housing
    b.box(17, 4, 6, 19, 10, 9, C.steelD); // bearing stand
    b.part("flywheel", [18, 11, 8], spin("x", 0.9));
    b.wheel("x", 11, 8, 5, 17, 19, C.brass, 6, 1.5);
    b.cyl("x", 11, 8, 1.2, 16, 20, C.brassD);

    // Pressure needle on the gauge.
    b.part("needle", [10, 15, 15], swing("z", 0.5, 0.7));
    b.box(10, 15, 15, 11, 18, 16, C.red);

    b.body();
    chuteFront(b, 1);
    // Ore spill on the chute lip.
    b.box(13, 8, 15, 17, 9, 17, C.ironD);
    speckle(b, 1, 0, 1, 19, 2, 19, C.steel, C.steelD, 6);
    statusLamp(b, 7, 30, 15);
    // Forming family: iron and steel bodies, brass kept for trim and moving parts.
    b.retone({ [C.brassD]: C.ironD, [C.brassM]: C.iron });
    return b.build();
}
