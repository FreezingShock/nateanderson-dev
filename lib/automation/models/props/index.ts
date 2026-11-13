// Brasswork scenery props: catalog of every model by id, built lazily and cached.
//
// Ids look like "tree.oak.3" (kind + variant). See README.md in this folder for
// the model data layout, wind, glow, LOD and scatter contract with the renderer.
import { LIFE } from "./life";
import { PLANTS } from "./plants";
import { ROCKS, SHORE } from "./rocks";
import { STRUCTURES } from "./structures";
import { TREES } from "./trees";
import { VARIANTS } from "./scatter";
import type { PropModel } from "./vox";
import type { VoxelModel } from "../format";
import { toVoxelModel } from "./adapter";

export { toVoxelModel } from "./adapter";
export { meshData, downsample, type PropModel, type MeshData } from "./vox";
export { scatterProps, LOD_DISTANCE, VARIANTS, type Placement, type ScatterInput } from "./scatter";

type Factory = () => PropModel;
const cache = new Map<string, PropModel>();
const lazy = (id: string, f: Factory): Factory => () => {
    let m = cache.get(id);
    if (!m) { m = f(); m.id = id; if (m.lod) m.lod.id = id + ":lod"; cache.set(id, m); }
    return m;
};

const gens: Record<string, (seed: number) => PropModel> = {
    "tree.oak": TREES.oak, "tree.maple": TREES.maple, "tree.pine": TREES.pine, "tree.birch": TREES.birch,
    "tree.willow": TREES.willow, "tree.snag": TREES.snag, "tree.stump": TREES.stump,
    "plant.bush": PLANTS.bush, "plant.berryBush": PLANTS.berryBush, "plant.blossomBush": PLANTS.blossomBush,
    "plant.fern": PLANTS.fern, "plant.flowers": PLANTS.flowers, "plant.spikes": PLANTS.spikes, "plant.reeds": PLANTS.reeds,
    "plant.lilies": PLANTS.lilies, "plant.mushrooms": PLANTS.mushrooms, "plant.mossPatch": PLANTS.mossPatch,
    "rock.boulder": ROCKS.boulder, "rock.bigBoulder": ROCKS.bigBoulder, "rock.pebbles": ROCKS.pebbles, "rock.cliff": ROCKS.cliff, "rock.slab": ROCKS.slab,
    "shore.driftwood": SHORE.driftwood, "shore.shells": SHORE.shells,
};

/** Every static model by id. */
export const CATALOG: Record<string, Factory> = {};
for (const [kind, gen] of Object.entries(gens))
    for (let n = 0; n < (VARIANTS[kind] ?? 1); n++) CATALOG[`${kind}.${n}`] = lazy(`${kind}.${n}`, () => gen(n + 1));

const fixed: Record<string, Factory> = {
    "shore.rowboat.0": () => SHORE.rowboat(1),
    "shore.jetty.0": () => SHORE.jetty(1),
    "build.workshop.0": () => STRUCTURES.workshop(1),
    "build.lamp.0": () => STRUCTURES.lamp(0),
    "build.lamp.1": () => STRUCTURES.lamp(1),
    "build.lamp.2": () => STRUCTURES.lamp(2),
    "build.fence.straight": () => STRUCTURES.fence("straight"),
    "build.fence.corner": () => STRUCTURES.fence("corner"),
    "build.fence.end": () => STRUCTURES.fence("end"),
    "build.fence.gate": () => STRUCTURES.fence("gate"),
    "build.stonewall.0": () => STRUCTURES.stoneWall(1),
    "build.stonewall.1": () => STRUCTURES.stoneWall(2),
    "build.path.cobble": () => STRUCTURES.path("cobble"),
    "build.path.gravel": () => STRUCTURES.path("gravel"),
    "build.path.planks": () => STRUCTURES.path("planks"),
    "build.path.steps": () => STRUCTURES.path("steps"),
    "build.path.dirt": () => STRUCTURES.path("dirt"),
    "build.crate.0": () => STRUCTURES.yard("crate", 1),
    "build.crate.1": () => STRUCTURES.yard("crate", 2),
    "build.barrel.0": () => STRUCTURES.yard("barrel"),
    "build.sign.0": () => STRUCTURES.yard("sign"),
    "build.bench.0": () => STRUCTURES.yard("bench"),
    "build.woodpile.0": () => STRUCTURES.yard("woodpile"),
    "build.anvil.0": () => STRUCTURES.yard("anvil"),
};
for (const [id, f] of Object.entries(fixed)) CATALOG[id] = lazy(id, f);

/** Animated creatures: id -> frames. */
export const LIFE_FRAMES: Record<string, () => PropModel[]> = {
    gull: LIFE.gull,
    "butterfly.0": () => LIFE.butterfly(0),
    "butterfly.1": () => LIFE.butterfly(1),
    "butterfly.2": () => LIFE.butterfly(2),
    fish: LIFE.fish,
    ripple: LIFE.ripple,
};

/** Every static prop in the shared VoxelModel format, for the model registry and preview. */
export function propModels(): VoxelModel[] {
    return Object.values(CATALOG).map((f) => toVoxelModel(f()));
}
