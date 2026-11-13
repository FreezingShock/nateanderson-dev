// Ore seams for cliff faces and the hillsides off the board, so the island
// hints where each ore comes from. Terrain-scale voxels (0.2 units).
//
// A stamp is a flat lens of voxels in the x-y plane, one or two voxels deep
// (z = 0 sits on the face, z = 1 pokes out). The terrain generator rotates it
// to the face normal and either recolours the rock it lands on or adds the
// z = 1 voxels on top.

import { RESOURCE_COLORS, type ResourceId } from "./palette";
import { hash3, rng } from "./voxel";

export const SEAM_VOXEL = 0.2;

export interface SeamVoxel {
    dx: number;
    dy: number;
    dz: number;
    color: number;
    /** True for the few voxels that should twinkle (quartz, aluminium). */
    glint: boolean;
}

/** Where each ore shows on the island, from the recipe notes. For the terrain generator. */
export const SEAM_HOME: Record<ResourceId, string> = {
    iron_ore: "ridge",
    copper_ore: "cove",
    coal: "lowland cliffs",
    quartz: "rocky outcrops",
    aluminium_ore: "high bank",
};

export function seamStamp(item: ResourceId, seed = 0): SeamVoxel[] {
    const C = RESOURCE_COLORS[item];
    const r = rng(seed * 977 + item.length * 131 + 3);
    const out: SeamVoxel[] = [];
    // a slanted lens: longer than tall, with a ragged edge
    const len = 4 + Math.floor(r() * 4),
        tall = 1.6 + r() * 1.2,
        slant = (r() - 0.5) * 0.7;
    for (let dx = -len; dx <= len; dx++)
        for (let dy = -3; dy <= 3; dy++) {
            const y = dy - dx * slant;
            const w = tall * (1 - (dx / (len + 1)) ** 2);
            if (Math.abs(y) > w + (hash3(dx, dy, 0, seed) - 0.5) * 0.9)
                continue;
            const h = hash3(dx, dy, 1, seed);
            let color = C.main;
            if (item === "copper_ore") color = h < 0.2 ? C.accent : C.main;
            else if (item === "iron_ore")
                color = h < 0.15 ? C.accent : h < 0.5 ? C.dark : C.main;
            else color = h < 0.35 ? C.dark : C.main;
            out.push({ dx, dy, dz: 0, color, glint: false });
            // a few pieces stand proud of the face
            if (h > 0.82)
                out.push({
                    dx,
                    dy,
                    dz: 1,
                    color: item === "quartz" ? C.accent : color,
                    glint: item === "quartz" || item === "aluminium_ore",
                });
        }
    return out;
}
