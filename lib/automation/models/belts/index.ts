// Brasswork logistics kit: belts, junctions, tunnels, machine ports, loaders, storage and the delivery dock.
// See README.md in this folder for how the renderer uses it.
export { createBeltKit, placementMatrix, pieceGeometry, meshPiece, clearGeometryCache, type BeltKit, type BeltKitOptions, type PiecePlacement } from "./kit";
export { PIECES, PIECE_KINDS, BELT_STYLE, buildPiece, type PieceDef, type PieceKind } from "./pieces";
export { BELT_TIERS, type BeltTier } from "./palette";
export { PathId, pathPoint, pathLen, BELT_Y, ITEM_Y, RAMP_RISE, SLATS_PER_CELL, type PathPoint } from "./paths";
export { pickBeltTile, leftOf, rightOf, type BeltNeighbours } from "./tiles";
export { BELT_MODELS, toVoxelModel, beltModelId } from "./models";
