// Picks the visual tile for a plain belt cell from its neighbours, so the sim
// only needs "belt, facing rot". Three-free.

import type { PieceKind } from "./pieces";

export interface BeltNeighbours {
    /** Something feeds this belt from behind (the cell opposite its facing). */
    back: boolean;
    /** Something feeds this belt from its left side. */
    left: boolean;
    /** Something feeds this belt from its right side. */
    right: boolean;
    /** The cell in front accepts items (a belt, machine or crate). */
    front: boolean;
    /** The cell in front is a machine input (draw the docking collar). */
    frontIsMachine?: boolean;
    /** The cell behind is a machine output. */
    backIsMachine?: boolean;
}

/**
 * Left and right are relative to travel: for a belt facing +z (rot 0), left is -x.
 * Rules, in order: machine docking beats everything; a belt fed only from one side
 * is a corner; fed from behind plus a side is a tee; two sides and no back is a
 * corner from the first side (the sim merges them in order); nothing behind and
 * nothing beside is a start cap; nothing in front is an end cap.
 */
export function pickBeltTile(n: BeltNeighbours): PieceKind {
    if (n.frontIsMachine) return "portIn";
    if (n.backIsMachine) return "portOut";
    if (!n.back && n.left && !n.right) return "cornerL";
    if (!n.back && n.right && !n.left) return "cornerR";
    if (n.back && n.left) return "teeL";
    if (n.back && n.right) return "teeR";
    if (!n.back && n.left && n.right) return "cornerL";
    if (!n.back && !n.left && !n.right) return "capStart";
    if (!n.front) return "capEnd";
    return "straight";
}

/** Rot 0..3 to the (dx, dz) it faces, matching DIR_DX / DIR_DZ in lib/automation/types.ts. */
export const FACING: readonly (readonly [number, number])[] = [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
];

/** The cell on a belt's left, relative to travel. For rot 0 (+z) that is -x. */
export function leftOf(rot: number): readonly [number, number] {
    return FACING[(rot + 3) % 4];
}

export function rightOf(rot: number): readonly [number, number] {
    return FACING[(rot + 1) % 4];
}
