# Brasswork scenery props

Natural scenery and the workshop's non-machine structures, generated as voxel
data (no three.js import). Everything is deterministic from a seed.

## Files
- `vox.ts` – builder (`Vox`), noise, `PropModel`, `downsample` (LOD), `meshData` (face-culled mesh with a `sway` attribute).
- `trees.ts` – oak, maple, pine, birch, willow, dead snag, stump.
- `plants.ts` – bushes (plain, berry, blossom), fern, wildflowers, lupin spikes, reeds, lily pads, mushrooms, moss.
- `rocks.ts` – boulders, pebbles, layered cliff chunks, slabs; shore: driftwood, shells, rowboat, jetty.
- `structures.ts` – starting workshop (3 x 3 cells, door +z, lit windows, clock gable), lamp posts (3 styles), fences, stone wall, path tiles, yard clutter.
- `life.ts` – gull, butterflies, fish and ripple as short frame lists.
- `scatter.ts` – `scatterProps()` places scenery by height, slope, shoreline and forest/meadow noise.
- `adapter.ts` – `toVoxelModel()` converts a prop into the shared format (`../format.ts`); `propModels()` feeds the registry.

## Contract with the renderer
- Ids: `CATALOG["tree.oak.3"]()` returns a cached model. Placements carry the same ids.
- Origin is the base centre, y up, voxel 0.1. In the shared format the part pivot is the base centre.
- Colours carry baked ambient occlusion; the loader adds the LOOK-SPEC +-7% jitter.
- Wind: per-voxel `sway` 0..255. Use the grass wind from LOOK-SPEC (`sw(t, ph)`, `ph` from the instance position) and offset x by `sw * 1.4 * sway`, z by `sw * 0.8 * sway`.
- Glow voxels (lamp glass, windows) are tagged `TAG.GLOW`. Lamps and the workshop carry a `light` anchor (`lights` in the shared format).
- Far placements (past `LOD_DISTANCE`) can use `model.lod` (voxel 0.2), which the shared format doesn't hold, so take it from the `PropModel`.
- `scatterProps({ heightAt, isFree, waterLevel, bounds, factoryDistance, clearRadius, density })`: nothing taller than flowers within `clearRadius` of the factory so trees never hide machines. `density` 0.5 for low-fx.

Preview harness (screenshots for Nate): /mnt/project-files/portfolio/automation-game/art/props/tools/.
