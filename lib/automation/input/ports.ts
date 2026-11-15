import { type Rot } from "./grid";

// Quarter-turn rotation of a footprint-relative cell, using the same convention as the sim:
// rot 0 faces +z, rot 1 faces +x, rot 2 faces -z, rot 3 faces -x. Rotating by one turn maps the
// front vector (0,1) to (1,0), which is (x, z) -> (z, -x).

// Step for a side, indexed by Rot: [dx, dz].
export const SIDE_STEPS: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

function turnVector(dx: number, dz: number, turns: number): [number, number] {
    let x = dx;
    let z = dz;
    for (let i = 0; i < ((turns % 4) + 4) % 4; i++) [x, z] = [z, -x];
    return [x, z];
}

// Where a cell of a machine ends up after it is rotated. (cx, cz) is the cell in the authored footprint of size w by d.
// The result is the cell in the rotated footprint, which is d by w when the turn is odd.
export function rotateCell(cx: number, cz: number, w: number, d: number, rot: Rot): { x: number; z: number } {
    const swap = rot % 2 === 1;
    const W = swap ? d : w;
    const D = swap ? w : d;
    // Work in doubled, centred coordinates so the footprint centre stays on integers.
    const u = 2 * cx + 1 - w;
    const v = 2 * cz + 1 - d;
    const [ru, rv] = turnVector(u, v, rot);
    return { x: (ru + W - 1) / 2, z: (rv + D - 1) / 2 };
}

// The side a port opens to once the machine is rotated.
export function rotateSide(side: Rot, rot: Rot): Rot {
    const [dx, dz] = SIDE_STEPS[side];
    const [rx, rz] = turnVector(dx, dz, rot);
    const i = SIDE_STEPS.findIndex(([sx, sz]) => sx === rx && sz === rz);
    return i as Rot;
}
