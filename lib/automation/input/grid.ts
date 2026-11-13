// Board grid helpers. Cells are integer squares: cell (x, z) covers [x, x+1) by [z, z+1) on the ground.
// Rotation 0 points +z, 1 points +x, 2 points -z, 3 points -x (matches DIRS below).

export type Rot = 0 | 1 | 2 | 3;

export interface Cell {
    x: number;
    z: number;
}

export interface BoardSize {
    width: number;
    depth: number;
}

export const DIRS: readonly { dx: number; dz: number }[] = [
    { dx: 0, dz: 1 },
    { dx: 1, dz: 0 },
    { dx: 0, dz: -1 },
    { dx: -1, dz: 0 },
];

export const cellKey = (c: Cell): string => `${c.x},${c.z}`;

export function cellInBoard(c: Cell, board: BoardSize): boolean {
    return c.x >= 0 && c.z >= 0 && c.x < board.width && c.z < board.depth;
}

export function rotate(rot: Rot, quarterTurns = 1): Rot {
    return ((((rot + quarterTurns) % 4) + 4) % 4) as Rot;
}

export function rotFromDelta(dx: number, dz: number, fallback: Rot): Rot {
    if (dx === 0 && dz === 0) return fallback;
    if (Math.abs(dx) >= Math.abs(dz)) return dx > 0 ? 1 : 3;
    return dz > 0 ? 0 : 2;
}

// Straight, axis-aligned run from a to b. The dominant axis wins, so a drag snaps to a straight line.
// The returned rot is the direction of travel, so belts face the way the line was drawn.
export function lineCells(a: Cell, b: Cell, fallback: Rot): { cells: Cell[]; rot: Rot } {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    if (dx === 0 && dz === 0) return { cells: [{ x: a.x, z: a.z }], rot: fallback };
    const cells: Cell[] = [];
    if (Math.abs(dx) >= Math.abs(dz)) {
        const step = Math.sign(dx);
        for (let i = 0; i <= Math.abs(dx); i++) cells.push({ x: a.x + step * i, z: a.z });
    } else {
        const step = Math.sign(dz);
        for (let i = 0; i <= Math.abs(dz); i++) cells.push({ x: a.x, z: a.z + step * i });
    }
    return { cells, rot: rotFromDelta(dx, dz, fallback) };
}
