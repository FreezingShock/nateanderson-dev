// Natural placement of scenery on the island terrain.
// The renderer gives terrain height and a free-space test; we return a list of
// placements it can instance (one InstancedMesh per model id).
import { noise3, rng } from "./vox";

export interface Placement {
    /** CATALOG id, e.g. "tree.oak.3". */
    model: string;
    x: number;
    y: number;
    z: number;
    rotY: number;
    scale: number;
}

export interface ScatterInput {
    /** Terrain top surface height (world units) at x, z. */
    heightAt: (x: number, z: number) => number;
    /** False where props must not go (factory plateau, buildings, paths). */
    isFree: (x: number, z: number) => boolean;
    waterLevel: number;
    /** World rectangle to fill. */
    minX: number; maxX: number; minZ: number; maxZ: number;
    seed?: number;
    /** 1 = full scenery, 0.5 = low-fx, 0 = only trees. */
    density?: number;
    /**
     * Distance (world units) from the factory, e.g. from the plateau edge. Inside
     * `clearRadius` only low plants grow, so trees never hide the machines.
     */
    factoryDistance?: (x: number, z: number) => number;
    clearRadius?: number;
}

/** Past this camera distance, draw a model's `lod` copy. */
export const LOD_DISTANCE = 22;

/** Variant counts per kind; keep in step with CATALOG in index.ts. */
export const VARIANTS: Record<string, number> = {
    "tree.oak": 6, "tree.maple": 4, "tree.pine": 6, "tree.birch": 4, "tree.willow": 3, "tree.snag": 2, "tree.stump": 2,
    "plant.bush": 4, "plant.berryBush": 2, "plant.blossomBush": 2, "plant.fern": 3, "plant.flowers": 8, "plant.spikes": 3,
    "plant.reeds": 4, "plant.lilies": 3, "plant.mushrooms": 2, "plant.mossPatch": 2,
    "rock.boulder": 5, "rock.bigBoulder": 2, "rock.pebbles": 3, "rock.cliff": 3, "rock.slab": 2,
    "shore.driftwood": 3, "shore.shells": 2,
};

const SPACING: Record<string, number> = { tree: 1.5, big: 1.2, plant: 0.55, rock: 0.9, shore: 0.9, small: 0.4 };

export function scatterProps(inp: ScatterInput): Placement[] {
    const seed = inp.seed ?? 7;
    const dens = inp.density ?? 1;
    const R = rng(seed);
    const WL = inp.waterLevel;
    const out: Placement[] = [];
    const grid = new Map<string, { x: number; z: number; r: number }[]>();
    const cellKey = (x: number, z: number) => `${Math.floor(x / 2)},${Math.floor(z / 2)}`;
    const roomFor = (x: number, z: number, r: number) => {
        const cx = Math.floor(x / 2), cz = Math.floor(z / 2);
        for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
            for (const p of grid.get(`${cx + a},${cz + b}`) || []) if (Math.hypot(p.x - x, p.z - z) < Math.max(r, p.r)) return false;
        }
        return true;
    };
    const variant = (kind: string) => `${kind}.${Math.floor(R() * (VARIANTS[kind] ?? 1))}`;
    const put = (kind: string, x: number, z: number, r: number, scale = 1, sink = 0.02) => {
        if (!roomFor(x, z, r)) return false;
        const k = cellKey(x, z);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k)!.push({ x, z, r });
        out.push({ model: variant(kind), x, y: Math.max(inp.heightAt(x, z), kind === "plant.lilies" ? WL : -1e9) - sink, z, rotY: R() * Math.PI * 2, scale });
        return true;
    };
    const step = 0.6;
    for (let x = inp.minX; x < inp.maxX; x += step)
        for (let z = inp.minZ; z < inp.maxZ; z += step) {
            const px = x + (R() - 0.5) * step, pz = z + (R() - 0.5) * step;
            if (!inp.isFree(px, pz)) continue;
            const h = inp.heightAt(px, pz);
            const e = 0.25;
            const slope = Math.max(Math.abs(inp.heightAt(px + e, pz) - inp.heightAt(px - e, pz)), Math.abs(inp.heightAt(px, pz + e) - inp.heightAt(px, pz - e))) / (2 * e);
            const forest = noise3(px * 0.11, 0, pz * 0.11, seed);
            const meadow = noise3(px * 0.35, 3, pz * 0.35, seed + 1);
            const roll = R();
            // Water: lily pads in calm shallows.
            if (h < WL - 0.12) {
                if (h > WL - 0.6 && meadow > 0.62 && roll < 0.05 * dens) put("plant.lilies", px, pz, 0.9, 1, 0);
                continue;
            }
            // Shoreline band.
            if (h < WL + 0.3) {
                if (roll < 0.035 * dens && meadow > 0.45) put("plant.reeds", px, pz, SPACING.plant, 0.55 + R() * 0.3);
                else if (roll < 0.045) put("shore.driftwood", px, pz, 1.4, 0.9 + R() * 0.3, 0.06);
                else if (roll < 0.07 * dens) put("shore.shells", px, pz, SPACING.small);
                else if (roll < 0.085) put(R() < 0.5 ? "rock.slab" : "rock.pebbles", px, pz, SPACING.rock, 0.8 + R() * 0.4);
                continue;
            }
            const fd = inp.factoryDistance ? inp.factoryDistance(px, pz) : 1e9;
            const clear = fd < (inp.clearRadius ?? 3.5);
            // Steep ground: rock faces.
            if (slope > 0.75 && h > WL + 0.8 && !clear) {
                if (roll < 0.06) put("rock.cliff", px, pz, 1.8, 0.8 + R() * 0.4, 0.3);
                else if (roll < 0.12) put("rock.boulder", px, pz, SPACING.rock, 0.9 + R() * 0.5, 0.1);
                continue;
            }
            const high = h > 0.9;
            const nearShore = h < WL + 0.9;
            // Trees, denser in forest patches.
            const treeChance = (forest > 0.58 ? 0.16 : forest > 0.45 ? 0.05 : 0.008);
            if (roll < treeChance && !clear) {
                let kind: string;
                const s = R();
                if (high) kind = s < 0.75 ? "tree.pine" : s < 0.9 ? "tree.birch" : "tree.snag";
                else if (nearShore && s < 0.3) kind = "tree.willow";
                else kind = s < 0.45 ? "tree.oak" : s < 0.62 ? "tree.birch" : s < 0.74 ? "tree.maple" : s < 0.92 ? "tree.pine" : s < 0.96 ? "tree.stump" : "tree.snag";
                if (put(kind, px, pz, SPACING.tree, 0.62 + R() * 0.34 + Math.min(0.15, Math.max(0, fd - 6) * 0.02), 0.08)) continue;
            }
            if (dens <= 0) continue;
            const r2 = R();
            if (forest > 0.55) {
                // Understory.
                if (r2 < 0.05 * dens) put("plant.fern", px, pz, SPACING.plant, 0.8 + R() * 0.4);
                else if (r2 < 0.065 * dens) put("plant.mushrooms", px, pz, SPACING.small);
                else if (r2 < 0.085 * dens && !clear) put(R() < 0.7 ? "plant.bush" : "plant.berryBush", px, pz, SPACING.big, 0.8 + R() * 0.4);
                else if (r2 < 0.095) put("rock.boulder", px, pz, SPACING.rock, 0.6 + R() * 0.6, 0.1);
            } else {
                // Meadow: flowers in drifts, scattered bushes and stones.
                if (meadow > 0.55 && r2 < 0.12 * dens) put(R() < 0.75 ? "plant.flowers" : "plant.spikes", px, pz, SPACING.plant, 0.9 + R() * 0.3);
                else if (r2 < 0.015 * dens) put(R() < 0.6 ? "plant.bush" : "plant.blossomBush", px, pz, SPACING.big, 0.8 + R() * 0.4);
                else if (r2 < 0.02) put(R() < 0.8 ? "rock.boulder" : "rock.bigBoulder", px, pz, 1.2, 0.6 + R() * 0.6, 0.1);
                else if (r2 < 0.026 * dens) put("plant.mossPatch", px, pz, SPACING.small);
            }
        }
    return out;
}
