// Brasswork machine models, in the shared voxel format (lib/automation/models/format.ts).
// Built from code on first use and cached.
//   import { getMachineModel, MACHINE_IDS, getOrreryModel } from "@/lib/automation/models/machines";
// Ids match the recipe tree (lib/automation/data/tree.ts); hub and spring_store are engine buildings.

import type { VoxelModel } from "../format";
import { drill } from "./drill";
import { kiln } from "./kiln";
import { furnace } from "./furnace";
import { press } from "./press";
import { lathe } from "./lathe";
import { drawer } from "./drawer";
import { assembler } from "./assembler";
import { fabricator } from "./fabricator";
import { windmill } from "./windmill";
import { winder } from "./winder";
import { springStore } from "./springstore";
import { hub } from "./hub";
import { orrery, orreryModel, ORRERY_STAGES, ORRERY_MAX_STAGE } from "./orrery";

const MAKERS: Record<string, () => VoxelModel> = {
    drill,
    kiln,
    furnace,
    press,
    lathe,
    drawer,
    assembler,
    fabricator,
    hub,
    windmill,
    spring_winder: winder,
    spring_store: springStore,
    orrery_4: orrery,
};

export const MACHINE_IDS = Object.keys(MAKERS);

/** Display names for the models that are not in the recipe tree. */
export const MACHINE_NAMES: Record<string, string> = {
    drill: "Drill",
    kiln: "Kiln",
    furnace: "Furnace",
    press: "Stamp press",
    lathe: "Lathe",
    drawer: "Wire drawer",
    assembler: "Assembler",
    fabricator: "Fabricator",
    hub: "Hub",
    windmill: "Windmill",
    spring_winder: "Spring winder",
    spring_store: "Spring store",
    orrery_4: "Sky orrery",
};

const cache = new Map<string, VoxelModel>();

export function getMachineModel(id: string): VoxelModel | undefined {
    let m = cache.get(id);
    if (!m && MAKERS[id]) {
        m = MAKERS[id]();
        cache.set(id, m);
    }
    return m;
}

/** The Sky orrery at a build stage (0 = foundation .. ORRERY_MAX_STAGE = complete). Cached per stage. */
export function getOrreryModel(stage: number): VoxelModel {
    const s = Math.max(0, Math.min(ORRERY_MAX_STAGE, Math.floor(stage)));
    const k = "orrery@" + s;
    const hit = cache.get(k);
    if (hit) return hit;
    const m = orreryModel(s);
    cache.set(k, m);
    return m;
}

/** Every machine model plus each orrery stage, for the registry and the preview. */
export function allMachineModels(): VoxelModel[] {
    const out = MACHINE_IDS.map((id) => getMachineModel(id)!);
    for (let s = 0; s < ORRERY_MAX_STAGE; s++) out.push(getOrreryModel(s));
    return out;
}

/** Exposed faces across all parts (faces between voxels of the same part are culled): the draw cost. */
export function faceCount(model: VoxelModel): number {
    let n = 0;
    for (const p of model.parts) {
        const occ = new Set<number>();
        const k = (x: number, y: number, z: number) => ((x + 512) << 20) | ((y + 512) << 10) | (z + 512);
        const c = p.colors.length;
        for (let i = 0; i < c; i++) occ.add(k(p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2]));
        for (let i = 0; i < c; i++) {
            const x = p.pos[i * 3], y = p.pos[i * 3 + 1], z = p.pos[i * 3 + 2];
            n += +!occ.has(k(x + 1, y, z)) + +!occ.has(k(x - 1, y, z)) + +!occ.has(k(x, y + 1, z)) + +!occ.has(k(x, y - 1, z)) + +!occ.has(k(x, y, z + 1)) + +!occ.has(k(x, y, z - 1));
        }
    }
    return n;
}

export { ORRERY_STAGES, ORRERY_MAX_STAGE };
export { poseAt, wave, type PartPose } from "../anim";
export { PALETTE, C as PAL } from "./palette";
