// Voxel clouds: flattened ellipsoid blobs grouped into clusters, placed around the sun azimuth on a
// separate grid at CLOUD_CELL. Unlit and unfogged (MeshBasic), colour shifts with height and with
// how close each voxel faces the sun. Colours are quantised so the block palette stays small.
import * as THREE from "three";
import { CLOUD_CELL, SKY_SUN_DIR } from "./config";
import { VoxelGrid } from "./grid";
import { BlockRegistry, ChunkMesher } from "./mesher";
import { makeRandom } from "./noise";

const CLUSTERS = 16;
const HEIGHT_MIN = 34;
const HEIGHT_MAX = 80;
const HEIGHT_STEPS = 6;
const SUN_STEPS = 4;

export interface Clouds {
    readonly group: THREE.Group;
    update(): void;
    dispose(): void;
}

export function buildClouds(blocks: BlockRegistry, seed: number): Clouds {
    const grid = new VoxelGrid(CLOUD_CELL);
    const material = new THREE.MeshBasicMaterial({ vertexColors: true });
    const mesher = new ChunkMesher(grid, blocks, material);
    const rnd = makeRandom(seed + 101);
    const sun = new THREE.Vector3(...SKY_SUN_DIR).normalize();
    const sunAz = Math.atan2(sun.z, sun.x);
    const low = new THREE.Color(0xd2705f);
    const high = new THREE.Color(0xffe2b4);
    const sunTint = new THREE.Color(0xffc27a);
    const mixed = new THREE.Color();

    for (let c = 0; c < CLUSTERS; c++) {
        const az = sunAz + (rnd() * 2 - 1) * 1.3;
        const dist = 230 + rnd() * 260;
        const cx = Math.cos(az) * dist;
        const cz = Math.sin(az) * dist;
        const cy = HEIGHT_MIN + rnd() * (HEIGHT_MAX - HEIGHT_MIN - 12);
        const blobs = 4 + Math.floor(rnd() * 5);
        for (let b = 0; b < blobs; b++) {
            const R = 9 + rnd() * 14;
            const ox = cx + (rnd() - 0.5) * R * 2.2;
            const oy = cy + (rnd() - 0.5) * R * 0.3;
            const oz = cz + (rnd() - 0.5) * R * 2.2;
            const rx = 1.25 * R;
            const ry = 0.38 * R;
            const rz = 0.8 * R;
            const i0 = Math.floor((ox - rx) / CLOUD_CELL);
            const i1 = Math.ceil((ox + rx) / CLOUD_CELL);
            const j0 = Math.floor((oy - ry) / CLOUD_CELL);
            const j1 = Math.ceil((oy + ry) / CLOUD_CELL);
            const k0 = Math.floor((oz - rz) / CLOUD_CELL);
            const k1 = Math.ceil((oz + rz) / CLOUD_CELL);
            for (let i = i0; i <= i1; i++)
                for (let j = j0; j <= j1; j++)
                    for (let k = k0; k <= k1; k++) {
                        const px = (i + 0.5) * CLOUD_CELL;
                        const py = (j + 0.5) * CLOUD_CELL;
                        const pz = (k + 0.5) * CLOUD_CELL;
                        const dx = (px - ox) / rx;
                        const dy = (py - oy) / ry;
                        const dz = (pz - oz) / rz;
                        if (dx * dx + dy * dy + dz * dz > 1) continue;
                        const heightT = Math.min(
                            1,
                            Math.max(
                                0,
                                (py - HEIGHT_MIN) / (HEIGHT_MAX - HEIGHT_MIN)
                            )
                        );
                        const hq =
                            Math.round(heightT * (HEIGHT_STEPS - 1)) /
                            (HEIGHT_STEPS - 1);
                        const toward = Math.max(
                            0,
                            (px * sun.x + py * sun.y + pz * sun.z) /
                                Math.hypot(px, py, pz)
                        );
                        const sq =
                            Math.round(toward * (SUN_STEPS - 1)) /
                            (SUN_STEPS - 1);
                        mixed.copy(low).lerp(high, 0.35 + 0.65 * hq);
                        mixed.lerp(sunTint, 0.35 * sq);
                        grid.set(i, j, k, blocks.id(mixed.getHex()));
                    }
        }
    }
    mesher.update();

    return {
        group: mesher.group,
        update() {
            mesher.update(4);
        },
        dispose() {
            mesher.dispose();
            material.dispose();
        },
    };
}
