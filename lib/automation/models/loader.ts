// Bakes a VoxelModel part into a face-culled BufferGeometry. One geometry per part, so the
// machine, belt or prop can be instanced: one InstancedMesh per part, one matrix per instance.
// Vertex attributes: position (model units, voxel size applied), normal, color (palette colour with
// a +-7% per-voxel jitter), aMotion, aSway (0..1) and aTag (0 solid, 1 glow, 2 glint).
import * as THREE from "three";
import {
    MOTION,
    TAG,
    type ModelPart,
    type ModelState,
    type VoxelModel,
} from "./format";

const FACES: [number, number, number][] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
];

/** Stable hash in 0..1 for jitter. Matches the terrain mesher's jitter so the palette reads the same. */
function jitterOf(x: number, y: number, z: number): number {
    let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Returns true if the part is drawn in the given state. */
export function partVisible(part: ModelPart, state: ModelState): boolean {
    if (!part.when) return true;
    return state === "always" || part.when.includes(state);
}

/**
 * Bakes one part. Voxels are placed at pivot + pos, in voxel units, then scaled to world units.
 * Faces shared with another voxel of the same part are culled. `mode` picks which voxels are kept:
 * "solid" for lit voxels, "glow" for GLOW-tagged ones (drawn unlit). Every voxel still counts for
 * culling, so glow faces are hidden against solid neighbours. Returns null when nothing is left.
 */
export function bakePart(
    model: VoxelModel,
    part: ModelPart,
    mode: "solid" | "glow" = "solid"
): THREE.BufferGeometry | null {
    const count = part.colors.length;
    if (count === 0) return null;
    const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
    const occupied = new Set<string>();
    const px = part.pivot[0];
    const py = part.pivot[1];
    const pz = part.pivot[2];
    for (let v = 0; v < count; v++) {
        occupied.add(
            key(
                part.pos[v * 3] + px,
                part.pos[v * 3 + 1] + py,
                part.pos[v * 3 + 2] + pz
            )
        );
    }

    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const motion: number[] = [];
    const sway: number[] = [];
    const tag: number[] = [];
    const indices: number[] = [];
    const s = model.voxel;

    for (let v = 0; v < count; v++) {
        const x = part.pos[v * 3] + px;
        const y = part.pos[v * 3 + 1] + py;
        const z = part.pos[v * 3 + 2] + pz;
        const hex = model.palette[part.colors[v]];
        const base = new THREE.Color(hex);
        const jitter = 1 + (jitterOf(x, y, z) - 0.5) * 0.14;
        const mo = part.motion ? part.motion[v] : MOTION.STATIC;
        const sw = part.sway ? part.sway[v] / 255 : 0;
        const tg = part.tags ? part.tags[v] : TAG.SOLID;
        const isGlow = tg === TAG.GLOW;
        if (isGlow !== (mode === "glow")) continue;

        for (const [nx, ny, nz] of FACES) {
            if (occupied.has(key(x + nx, y + ny, z + nz))) continue;
            const start = positions.length / 3;
            // Face corners on the unit cube, wound counter-clockwise from outside.
            const corners = faceCorners(nx, ny, nz);
            for (const [ox, oy, oz] of corners) {
                positions.push((x + ox) * s, (y + oy) * s, (z + oz) * s);
                normals.push(nx, ny, nz);
                colors.push(base.r * jitter, base.g * jitter, base.b * jitter);
                motion.push(mo);
                sway.push(sw);
                tag.push(tg);
            }
            indices.push(
                start,
                start + 1,
                start + 2,
                start,
                start + 2,
                start + 3
            );
        }
    }
    if (indices.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3)
    );
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute("aMotion", new THREE.Float32BufferAttribute(motion, 1));
    geo.setAttribute("aSway", new THREE.Float32BufferAttribute(sway, 1));
    geo.setAttribute("aTag", new THREE.Float32BufferAttribute(tag, 1));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    return geo;
}

/** Corners of a voxel face in counter-clockwise order seen from outside. */
function faceCorners(
    nx: number,
    ny: number,
    nz: number
): [number, number, number][] {
    if (nx === 1)
        return [
            [1, 0, 0],
            [1, 1, 0],
            [1, 1, 1],
            [1, 0, 1],
        ];
    if (nx === -1)
        return [
            [0, 0, 0],
            [0, 0, 1],
            [0, 1, 1],
            [0, 1, 0],
        ];
    if (ny === 1)
        return [
            [0, 1, 0],
            [0, 1, 1],
            [1, 1, 1],
            [1, 1, 0],
        ];
    if (ny === -1)
        return [
            [0, 0, 0],
            [1, 0, 0],
            [1, 0, 1],
            [0, 0, 1],
        ];
    if (nz === 1)
        return [
            [0, 0, 1],
            [1, 0, 1],
            [1, 1, 1],
            [0, 1, 1],
        ];
    return [
        [0, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
        [1, 0, 0],
    ];
}

/**
 * Bakes every part visible in `state`, split into lit and glow geometry. Draw glow pieces unlit
 * (MeshBasicMaterial) and lit pieces with the block material.
 */
export function bakeModel(
    model: VoxelModel,
    state: ModelState = "always"
): { part: ModelPart; glow: boolean; geometry: THREE.BufferGeometry }[] {
    const out: {
        part: ModelPart;
        glow: boolean;
        geometry: THREE.BufferGeometry;
    }[] = [];
    for (const part of model.parts) {
        if (!partVisible(part, state)) continue;
        for (const glow of [false, true]) {
            const geometry = bakePart(model, part, glow ? "glow" : "solid");
            if (geometry) out.push({ part, glow, geometry });
        }
    }
    return out;
}
