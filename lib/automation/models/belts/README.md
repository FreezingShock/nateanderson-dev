# Brasswork logistics kit

Voxel belts and logistics pieces, built from code at 0.1 voxels (10 x 10 per cell), palette from
`/mnt/project-files/portfolio/automation-game/LOOK-SPEC.md`.

## Pieces

`straight`, `cornerL`, `cornerR`, `rampUp`, `rampDown`, `teeL`, `teeR` (side feed), `merger`, `splitter`,
`undergroundIn`, `undergroundOut` (tunnel), `portIn`, `portOut` (belt end docked to a machine face),
`capStart`, `capEnd`, `loader`, `unloader`, `crate`, `strongbox`, `dock` (3 x 3 delivery dock).
Three belt tiers (brass, copper, steel) in `palette.ts`. Flow is +z at rot 0, like `lib/automation/types.ts`.

## Rendering

```ts
import { createBeltKit, pickBeltTile } from "@/lib/automation/models/belts";
const kit = createBeltKit();
scene.add(kit.object);
kit.setPieces([{ kind: "straight", tier: 0, x: 3, z: 1, rot: 1 }]); // on build or removal
kit.update(dt);                       // every frame
kit.setSpeed(0, 1);                   // cells per second per tier, 0 stops the tier
kit.itemMatrix(piece, item.pos, m);   // place an item instance from BeltItem.pos
```

- Each piece is one merged, face-culled, greedy-merged geometry (about 700 triangles for a belt).
  One `InstancedMesh` per (kind, tier), so the whole network is about one draw call per kind in use.
- Slats and gears move on the GPU (`shader.ts`): the only per-frame work is one `uPhase` uniform per tier.
  Slats follow the piece's path (`paths.ts`), wrap every 0.25 cells, and line up across tiles.
  Items placed with `itemMatrix` move at the same speed as the slats.
- `pickBeltTile(neighbours)` picks straight, corner, tee, end caps or ports for a plain sim belt cell.
- `BELT_STYLE.sideGears` adds a drive gear on every plain belt cell (taste call, off by default).
- `models.ts` exports every piece in the shared `VoxelModel` format; they are in `../registry.ts`
  with ids `belt-<kind>` (and `belt-straight-copper`, `belt-straight-steel`).

Tests: `tests/automation/belts.test.mjs` (budgets, path continuity, slat counts, tile picker, format validation).
Showcase scene and screenshots: `/mnt/project-files/portfolio/automation-game/art/belts/`.
