// Raw resources in the world: ore deposits on board cells, stockpiles for
// storage, and seams for cliffs off the board. Plain voxel data at 0.1 units
// (seams at 0.2); the renderer turns it into meshes.

export {
    RESOURCE_COLORS,
    RESOURCE_IDS,
    STOCK_IDS,
    WORKSHOP,
    type ResourceId,
    type StockId,
    type ResourceColors,
} from "./palette";
export {
    VOXEL,
    CELL,
    Tag,
    VoxelBuilder,
    glintPhase,
    rng,
    hash3,
    type VoxelData,
    toModel,
} from "./voxel";
export {
    buildDeposit,
    variantForCell,
    DEPOSIT_VARIANTS,
    type DepositOptions,
} from "./deposits";
export { buildStockpile, type StockpileOptions } from "./stockpiles";
export { seamStamp, SEAM_HOME, SEAM_VOXEL, type SeamVoxel } from "./seams";
export {
    depositModel,
    stockpileModel,
    resourceModel,
    resourcePreviewModels,
    allResourceModelIds,
    gradeOf,
    GRADES,
    STOCK_FILLS,
    type Grade,
} from "./models";
