// Horizon: a ring of far voxel islands and sea stacks out past the water, drawn as hazy silhouettes
// so the island no longer floats in an empty sea. One of them carries a small brass lighthouse whose
// lamp sweeps at night. Everything is unlit (MeshBasic) and mixed toward the live fog colour by
// distance, so the silhouettes follow the day and night palette without any extra lights.
import * as THREE from "three";
import { SKY_SUN_DIR, WATER_LEVEL } from "./config";
import { fogUniforms } from "./fog";
import { VoxelGrid } from "./grid";
import { BlockRegistry, ChunkMesher } from "./mesher";
import { makeRandom } from "./noise";

const CELL = 1.4;
const ROCK = [0x5e4f44, 0x6d5c4e, 0x4f4339];
const CLIFF_BAND = 0x8a6f52;
const TOP = [0x55703c, 0x4a6334, 0x667a40];
const SAND = 0xc9a86c;

interface IslandSpec {
    az: number;
    dist: number;
    radius: number;
    height: number;
    /** 0 rolling island, 1 flat-topped mesa, 2 cluster of thin sea stacks. */
    kind: 0 | 1 | 2;
}

export interface Horizon {
    readonly group: THREE.Group;
    /** night 0..1 lights the lighthouse; `motion` false holds the beam still. */
    update(time: number, night: number, motion: boolean): void;
    dispose(): void;
}

export function buildHorizon(blocks: BlockRegistry, seed: number): Horizon {
    const grid = new VoxelGrid(CELL);
    const material = new THREE.MeshBasicMaterial({ vertexColors: true });
    // Aerial perspective: mix toward the fog colour by distance, more at the waterline than the peaks.
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uFogColor = fogUniforms.uFogColor;
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nvarying vec3 vHz;")
            .replace(
                "#include <project_vertex>",
                "#include <project_vertex>\nvHz = (modelMatrix * vec4(transformed, 1.0)).xyz;"
            );
        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                "#include <common>\nuniform vec3 uFogColor;\nvarying vec3 vHz;"
            )
            .replace(
                "#include <opaque_fragment>",
                `float hzDist = length(vHz.xz);
        float hzHaze = clamp(0.38 + (hzDist - 150.0) / 420.0 - clamp(vHz.y / 60.0, 0.0, 0.18), 0.3, 0.86);
        outgoingLight = mix(outgoingLight, uFogColor, hzHaze);
        #include <opaque_fragment>`
            );
    };
    material.customProgramCacheKey = () => "bw-horizon";
    const mesher = new ChunkMesher(grid, blocks, material);
    const rnd = makeRandom(seed + 404);
    const sunAz = Math.atan2(SKY_SUN_DIR[2], SKY_SUN_DIR[0]);

    // Most islands sit in the default view (toward the sun); a few fill the rest of the ring for orbiting.
    const specs: IslandSpec[] = [
        { az: sunAz - 0.55, dist: 230, radius: 22, height: 12, kind: 0 },
        { az: sunAz - 0.18, dist: 300, radius: 15, height: 15, kind: 1 },
        { az: sunAz + 0.12, dist: 215, radius: 7, height: 10, kind: 2 },
        { az: sunAz + 0.5, dist: 280, radius: 26, height: 9, kind: 0 },
        { az: sunAz + 0.95, dist: 250, radius: 11, height: 13, kind: 1 },
        { az: sunAz + 1.9, dist: 215, radius: 18, height: 12, kind: 0 },
        { az: sunAz + 2.8, dist: 185, radius: 8, height: 11, kind: 2 },
        { az: sunAz - 1.6, dist: 240, radius: 22, height: 16, kind: 0 },
        { az: sunAz - 2.5, dist: 200, radius: 12, height: 14, kind: 1 },
    ];

    const pick = (list: number[], h: number) => list[Math.floor(h * list.length) % list.length];
    const hash = (i: number, k: number) => {
        const v = Math.sin(i * 127.1 + k * 311.7 + seed) * 43758.5453;
        return v - Math.floor(v);
    };
    const base = Math.floor((WATER_LEVEL - 1) / CELL);
    let lighthouse: THREE.Vector3 | null = null;

    specs.forEach((sp, n) => {
        const cx = Math.cos(sp.az) * sp.dist;
        const cz = Math.sin(sp.az) * sp.dist;
        const R = sp.radius;
        // Sea stacks: a handful of thin pillars instead of one landmass.
        const stacks =
            sp.kind === 2
                ? Array.from({ length: 4 }, () => ({
                      x: cx + (rnd() - 0.5) * R * 2.2,
                      z: cz + (rnd() - 0.5) * R * 2.2,
                      r: 2 + rnd() * 2.5,
                      h: sp.height * (0.55 + rnd() * 0.5),
                  }))
                : [];
        const i0 = Math.floor((cx - R * 1.6) / CELL);
        const i1 = Math.ceil((cx + R * 1.6) / CELL);
        const k0 = Math.floor((cz - R * 1.6) / CELL);
        const k1 = Math.ceil((cz + R * 1.6) / CELL);
        let peak = { h: -1, x: 0, z: 0 };
        for (let i = i0; i <= i1; i++)
            for (let k = k0; k <= k1; k++) {
                const x = (i + 0.5) * CELL;
                const z = (k + 0.5) * CELL;
                let h = -99;
                if (sp.kind === 2) {
                    for (const s of stacks) {
                        const d = Math.hypot(x - s.x, z - s.z) / s.r;
                        if (d < 1) h = Math.max(h, s.h * (1 - d * d * 0.35));
                    }
                } else {
                    const ang = Math.atan2(z - cz, x - cx);
                    const wob = 1 + 0.18 * Math.sin(ang * 3 + n) + 0.1 * Math.sin(ang * 7 + n * 2);
                    const d = Math.hypot(x - cx, z - cz) / (R * wob);
                    if (d < 1) {
                        h =
                            sp.kind === 1
                                ? sp.height * Math.min(1, (1 - d) * 1.7) * (0.85 + 0.15 * Math.sin(x * 0.3 + z * 0.23))
                                : sp.height * Math.pow(1 - d * d, 1.6) *
                                  (0.8 + 0.2 * Math.sin(x * 0.21 + z * 0.17));
                    }
                }
                if (h < 0) continue;
                const top = Math.round(h / CELL);
                if (h > peak.h) peak = { h, x, z };
                for (let j = base; j <= top; j++) {
                    const y = j * CELL;
                    let hex: number;
                    if (j === top && h > 2.2 && sp.kind !== 2) hex = pick(TOP, hash(i, k));
                    else if (y < WATER_LEVEL + 1.2) hex = SAND;
                    else if (j % 5 === 0) hex = CLIFF_BAND;
                    else hex = pick(ROCK, hash(i, j * 3 + k));
                    grid.set(i, j, k, blocks.id(hex));
                }
            }
        // Lighthouse on the nearest rolling island facing the default view.
        if (n === 0) {
            const bi = Math.floor(peak.x / CELL);
            const bk = Math.floor(peak.z / CELL);
            const bj = Math.round(peak.h / CELL) + 1;
            for (let j = 0; j < 7; j++) {
                const stripe = j % 2 === 0 ? 0xe8dcc0 : 0xb5793a;
                grid.set(bi, bj + j, bk, blocks.id(stripe));
            }
            grid.set(bi, bj + 7, bk, blocks.id(0x3c3028));
            lighthouse = new THREE.Vector3((bi + 0.5) * CELL, (bj + 7.5) * CELL, (bk + 0.5) * CELL);
        }
    });
    mesher.update();

    const group = new THREE.Group();
    group.add(mesher.group);

    // Lamp: a glowing core plus a long thin beam that sweeps around once every few seconds.
    const lampMat = new THREE.MeshBasicMaterial({
        color: 0xffd27a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
    });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(CELL * 1.3, CELL * 1.3, CELL * 1.3), lampMat);
    const beamMat = new THREE.MeshBasicMaterial({
        color: 0xffc46a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
    });
    const beamGeo = new THREE.PlaneGeometry(70, 3.2);
    beamGeo.translate(35, 0, 0);
    const beam = new THREE.Mesh(beamGeo, beamMat);
    const pivot = new THREE.Group();
    pivot.add(beam);
    if (lighthouse) {
        lamp.position.copy(lighthouse);
        pivot.position.copy(lighthouse);
        group.add(lamp, pivot);
    }

    return {
        group,
        update(time, night, motion) {
            // Silhouettes darken with the sky at night.
            material.color.setRGB(1 - night * 0.62, 1 - night * 0.6, 1 - night * 0.45);
            const on = Math.max(0, Math.min(1, (night - 0.2) / 0.6));
            lamp.visible = beam.visible = on > 0.01;
            if (!lamp.visible) return;
            const spin = motion ? time * 0.9 : 0.6;
            pivot.rotation.y = spin;
            // Brightest when the beam swings toward the island.
            const facing = 0.5 + 0.5 * Math.cos(spin - Math.atan2(lighthouse ? lighthouse.z : 0, lighthouse ? -lighthouse.x : 0));
            lampMat.opacity = on * (0.55 + 0.45 * facing);
            beamMat.opacity = on * 0.16;
        },
        dispose() {
            mesher.dispose();
            material.dispose();
            lamp.geometry.dispose();
            lampMat.dispose();
            beamGeo.dispose();
            beamMat.dispose();
        },
    };
}
