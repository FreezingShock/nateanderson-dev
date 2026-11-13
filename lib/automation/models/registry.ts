// Models the preview page can render, by id. Art threads add one import line and one entry each in
// their folder's list, then list them here.
import type { VoxelModel } from "./format";
import { EXAMPLE_BLOCK } from "./examples";
import { BELT_MODELS } from "./belts/models";
import { allMachineModels } from "./machines";
import { propModels } from "./props";
import { resourceModel, resourcePreviewModels } from "./resources";

export const MODEL_REGISTRY: VoxelModel[] = [
    EXAMPLE_BLOCK,
    ...allMachineModels(),
    ...resourcePreviewModels(),
    ...BELT_MODELS,
    ...propModels(),
];

export function findModel(id: string): VoxelModel | undefined {
    // Resource ids beyond the preview set (other variants, fill levels) are built on demand.
    return MODEL_REGISTRY.find((m) => m.id === id) ?? resourceModel(id);
}
