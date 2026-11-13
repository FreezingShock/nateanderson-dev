// Island heightfield and terrain voxels. The shape is the same analytic height function the design
// thread's reference uses, so the coastline and hills match what Nate has already approved.
import { BLOCK, PLATEAU_HALF_X, PLATEAU_HALF_Z, TERRAIN_CELL, TERRAIN_HEX, WATER_LEVEL } from "./config";
import { VoxelGrid } from "./grid";
import type { BlockRegistry } from "./mesher";
import { cellHash, rollingNoise } from "./noise";

/** Surface height in world units at (x, z). Flat (0) on the factory plateau. */
export function heightAt(x: number, z: number): number {
  if (Math.abs(x) < PLATEAU_HALF_X && Math.abs(z) < PLATEAU_HALF_Z) return 0;
  const dx = Math.max(Math.abs(x) - PLATEAU_HALF_X, 0);
  const dz = Math.max(Math.abs(z) - PLATEAU_HALF_Z, 0);
  const d = Math.hypot(dx, dz);
  let h = 0;
  if (d > 0) h = -d * 0.2 + rollingNoise(x, z) * Math.min(1, d / 2) * 0.9;
  h += 3.4 * Math.exp(-((x + 13) ** 2 + (z + 15) ** 2) / 42);
  h += 2.5 * Math.exp(-((x - 12) ** 2 + (z + 16) ** 2) / 32);
  h += 1.5 * Math.exp(-((x + 17) ** 2 + (z - 9) ** 2) / 26);
  const r = Math.hypot(x / 1.2, z / 0.95);
  if (r > 15) h -= (r - 15) * 0.55;
  return h;
}

export interface TerrainBuild {
  /** World-space surface points [x, y, z] where grass blades can grow. */
  grassSites: [number, number, number][];
}

/** Fills the terrain grid (cell size TERRAIN_CELL) and reports where grass may grow. */
export function buildTerrain(grid: VoxelGrid, blocks: BlockRegistry): TerrainBuild {
  const c = TERRAIN_CELL;
  for (const [id, hex] of Object.entries(TERRAIN_HEX)) blocks.define(Number(id), hex);
  const grassSites: [number, number, number][] = [];
  const bottomCell = Math.round((WATER_LEVEL - 0.6) / c);

  for (let i = -130; i <= 130; i++) {
    for (let k = -118; k <= 118; k++) {
      const x = (i + 0.5) * c;
      const z = (k + 0.5) * c;
      const h = heightAt(x, z);
      if (h < WATER_LEVEL - 0.5) continue;
      const onPlateau = Math.abs(x) < PLATEAU_HALF_X && Math.abs(z) < PLATEAU_HALF_Z;

      const mn = Math.min(heightAt(x + c, z), heightAt(x - c, z), heightAt(x, z + c), heightAt(x, z - c));
      const slope = h - mn;
      const topCell = Math.round(h / c);
      const bot = Math.max(topCell - 7, Math.min(topCell, Math.round(mn / c) - 1), bottomCell);
      const steep = slope > 0.55;
      const underwater = h < WATER_LEVEL + 0.25;
      const rocky = slope > 0.3;

      for (let j = bot; j < topCell; j++) {
        const isTop = j === topCell - 1;
        let id: number;
        if (onPlateau) {
          id = isTop ? (((i + k) & 1) ? BLOCK.FLOOR_A : BLOCK.FLOOR_B) : BLOCK.SKIRT;
        } else if (underwater) {
          id = isTop ? (h < WATER_LEVEL + 0.25 ? BLOCK.SAND : BLOCK.SAND_SHORE) : BLOCK.SAND_WET;
        } else if (steep) {
          id = j % 2 ? BLOCK.STONE : BLOCK.STONE_DARK;
        } else if (isTop) {
          const pick = Math.floor(cellHash(i, j, k) * 4);
          id = h < WATER_LEVEL + 0.55 ? BLOCK.SAND_SHORE : [BLOCK.GRASS_A, BLOCK.GRASS_B, BLOCK.GRASS_C, BLOCK.GRASS_D][pick];
        } else {
          id = rocky ? BLOCK.STONE : BLOCK.DIRT;
        }
        grid.set(i, j, k, id);
      }

      if (!onPlateau && !underwater && !steep && slope < 0.4 && topCell > 0) {
        grassSites.push([x, topCell * c, z]);
      }
    }
  }
  return { grassSites };
}
