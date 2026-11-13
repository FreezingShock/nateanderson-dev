// Windmill, 2x2. Power from wind. A tapering timber-and-brass tower carries a cap with a patina roof,
// four canvas sails on wooden stocks facing front, and a tail vane at the back. A drive shaft runs down
// the tower to a ground gearbox whose gear turns with the sails.

import { Builder, spin } from "./builder";
import { C } from "./palette";
import { plinth, statusLamp } from "./common";

export function windmill() {
    const b = new Builder("windmill", "Windmill", 2, 2);
    plinth(b);
    // Tower: four timber legs leaning in, brass rings, cross braces.
    const legs: [number, number][] = [
        [3, 3],
        [16, 3],
        [3, 16],
        [16, 16],
    ];
    for (const [x, z] of legs) {
        const tx = x < 10 ? 7 : 12;
        const tz = z < 10 ? 7 : 12;
        b.rod([x, 2, z], [tx, 50, tz], 2, C.wood);
        b.box(x - 1, 2, z - 1, x + 2, 4, z + 2, C.brassD);
    }
    for (const [y, i] of [
        [14, 4],
        [27, 5],
        [40, 6],
    ] as const)
        b.frame(i, y, i, 20 - i, y + 1, 20 - i, 1, C.brass);
    // Ground gearbox and drive shaft.
    b.box(7, 2, 7, 13, 7, 13, C.brassD);
    b.box(6, 7, 6, 14, 8, 14, C.brass);
    b.part("shaft", [10, 0, 10], spin("y", 0.5, { when: "always" }));
    b.cyl("y", 10, 10, 1, 8, 50, C.iron);
    b.gear("y", 10, 10, 3, 4.5, 8, 8, 9, C.brassL, { hole: 1 });
    // Cap house on top.
    b.body();
    b.box(5, 50, 5, 15, 57, 16, C.wood);
    b.box(4, 50, 4, 16, 51, 17, C.brass);
    for (let y = 57; y < 62; y++) {
        const i = y - 57;
        b.box(4 + i, y, 4, 16 - i, y + 1, 17, C.patina);
    }
    b.box(9, 62, 4, 11, 63, 17, C.brassL);
    // Tail vane at the back.
    b.box(9, 53, -6, 11, 54, 5, C.wood);
    b.box(10, 51, -12, 11, 59, -5, C.cream);
    b.box(9, 50, -12, 11, 51, -5, C.wood);
    // Hub and sails, facing +z.
    b.box(9, 52, 16, 11, 55, 19, C.iron);
    b.part("sails", [10, 54, 19.5], spin("z", -0.22, { when: "always" }));
    b.cyl("z", 10, 54, 2.4, 18, 22, C.brass);
    b.cyl("z", 10, 54, 1, 22, 23, C.brassL);
    // Stocks and canvas, filled cell by cell in the rotor plane so there are no gaps.
    for (let x = -16; x < 37; x++)
        for (let y = 28; y < 80; y++) {
            const dx = x + 0.5 - 10;
            const dy = y + 0.5 - 54;
            const r = Math.hypot(dx, dy);
            if (r < 2 || r > 24) continue;
            const ang = Math.atan2(dy, dx) - 0.3;
            const q = ((ang % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2); // angle inside this quarter
            const along = Math.cos(q) * r; // distance along the stock
            const across = Math.sin(q) * r; // distance to the stock's leading side
            if (across < 1) b.set(x, y, 20, C.wood); // stock
            else if (along > 6 && along < 23.5 && across < 6) {
                const edge = across > 5 || along > 22.5 || along < 7 || Math.floor(along) % 4 === 0;
                b.set(x, y, 19, edge ? C.wood : C.cream);
            }
        }
    b.body();
    statusLamp(b, 15, 8, 15);
    return b.build();
}
