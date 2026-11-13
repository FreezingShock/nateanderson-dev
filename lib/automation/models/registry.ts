// Models the preview page can render, by id. Art threads add one import line and one entry each in
// their folder's list, then list them here.
import type { VoxelModel } from "./format";
import { EXAMPLE_BLOCK } from "./examples";
import { ITEM_MODEL_LIST } from "./items";
import { resourceModel, resourcePreviewModels } from "./resources";

export const MODEL_REGISTRY: VoxelModel[] = [
    EXAMPLE_BLOCK,
    ...resourcePreviewModels(),
    ...ITEM_MODEL_LIST,
];

export function findModel(id: string): VoxelModel | undefined {
    // Resource ids beyond the preview set (other variants, fill levels) are built on demand.
    return MODEL_REGISTRY.find((m) => m.id === id) ?? resourceModel(id);
}
