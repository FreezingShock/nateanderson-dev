// Models the preview page can render, by id. Art threads add one import line and one entry each in
// their folder's list, then list them here.
import type { VoxelModel } from "./format";
import { EXAMPLE_BLOCK } from "./examples";

export const MODEL_REGISTRY: VoxelModel[] = [EXAMPLE_BLOCK];

export function findModel(id: string): VoxelModel | undefined {
    return MODEL_REGISTRY.find((m) => m.id === id);
}
