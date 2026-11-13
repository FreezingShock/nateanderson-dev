// Instanced scenery: trees, plants, rocks and workshop props from the props catalog.
// One InstancedMesh per model id and LOD level, so a whole forest is a handful of draw calls.
// Wind sways each instance from its own position (same gust as the grass), weighted per voxel.
import * as THREE from "three";
import {
    CATALOG,
    LOD_DISTANCE,
    downsample,
    meshData,
    type MeshData,
    type Placement,
    type PropModel,
} from "../models/props";
import { applyHeightFog } from "./fog";
import { animUniforms } from "./grass";

/** Camera must move this far (world units) before LOD choices are recomputed. */
const LOD_REFRESH = 2;
/** Jitter matches LOOK-SPEC: +-7% per-voxel brightness. */
const JITTER = 0.07;

const windHook = (sh: { vertexShader: string }) => {
    sh.vertexShader = sh.vertexShader
        .replace(
            "#include <common>",
            "#include <common>\nattribute float aSway;\nuniform float uTime;\nuniform float uWind;"
        )
        .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
            float phase = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 1.3;
            float gust = (sin(uTime * 1.9 + phase) * 0.09 + sin(uTime * 3.3 + phase * 2.1) * 0.03) * uWind;
            transformed.x += gust * aSway * 1.4;
            transformed.z += gust * aSway * 0.8;`
        );
};

/** Deterministic 0..1 per placement, so density keeps the same trees as it drops. */
function keepRoll(i: number): number {
    const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return v - Math.floor(v);
}

function solidGeometry(d: MeshData): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(d.position, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(d.normal, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(d.color, 3));
    geo.setAttribute("aSway", new THREE.BufferAttribute(d.sway, 1));
    geo.setIndex(new THREE.BufferAttribute(d.index, 1));
    geo.computeBoundingSphere();
    return geo;
}

function glowGeometry(d: MeshData): THREE.BufferGeometry | null {
    if (d.glow.index.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(d.glow.position, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(d.glow.color, 3));
    // Lamp glass and windows stay put; only solid voxels sway.
    geo.setAttribute(
        "aSway",
        new THREE.BufferAttribute(
            new Float32Array(d.glow.position.length / 3),
            1
        )
    );
    geo.setIndex(new THREE.BufferAttribute(d.glow.index, 1));
    geo.computeBoundingSphere();
    return geo;
}

interface Level {
    /** Instance transforms, shared by the solid and glow meshes of this level. */
    matrices: THREE.InstancedBufferAttribute;
    solid: THREE.InstancedMesh | null;
    glow: THREE.InstancedMesh | null;
    count: number;
}

interface Bundle {
    full: Level;
    lod: Level;
}

interface GeoSet {
    full: THREE.BufferGeometry | null;
    fullGlow: THREE.BufferGeometry | null;
    lod: THREE.BufferGeometry | null;
    lodGlow: THREE.BufferGeometry | null;
}

export class Scenery {
    readonly group = new THREE.Group();
    private placements: Placement[] = [];
    private density = 1;
    private bundles = new Map<string, Bundle>();
    private readonly geos = new Map<string, GeoSet>();
    private readonly solidMat: THREE.MeshStandardMaterial;
    private readonly glowMat: THREE.MeshBasicMaterial;
    private readonly lastCam = new THREE.Vector3(Infinity, 0, 0);
    private readonly tmpMat = new THREE.Matrix4();
    private readonly tmpPos = new THREE.Vector3();
    private readonly tmpQuat = new THREE.Quaternion();
    private readonly tmpScale = new THREE.Vector3();
    private readonly yAxis = new THREE.Vector3(0, 1, 0);

    constructor(scene: THREE.Scene) {
        this.solidMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.9,
            metalness: 0,
        });
        applyHeightFog(this.solidMat, "scenery-wind", {
            uniforms: animUniforms,
            vertex: windHook,
        });
        this.glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
        this.glowMat.customProgramCacheKey = () => "scenery-glow-wind";
        this.glowMat.onBeforeCompile = (sh) => {
            Object.assign(sh.uniforms, animUniforms);
            windHook(sh);
        };
        scene.add(this.group);
    }

    /** Replaces every placement. Unknown model ids are skipped. */
    setPlacements(list: readonly Placement[]): void {
        this.placements = list.filter((p) => CATALOG[p.model] !== undefined);
        this.disposeBundles();
        this.lastCam.set(Infinity, 0, 0);
        this.rebuild(null);
    }

    /** 0..1. Keeps a stable subset of placements, so low fx drops the same trees each time. */
    setDensity(d: number): void {
        const next = Math.max(0, Math.min(1, d));
        if (next === this.density) return;
        this.density = next;
        this.lastCam.set(Infinity, 0, 0);
        this.rebuild(null);
    }

    /** Re-picks LOD when the camera has moved far enough. Call once per frame. */
    update(camera: THREE.Vector3): void {
        const moved = Math.hypot(
            camera.x - this.lastCam.x,
            camera.z - this.lastCam.z
        );
        if (moved < LOD_REFRESH) return;
        this.lastCam.copy(camera);
        this.rebuild(camera);
    }

    dispose(): void {
        this.disposeBundles();
        for (const g of this.geos.values()) {
            g.full?.dispose();
            g.fullGlow?.dispose();
            g.lod?.dispose();
            g.lodGlow?.dispose();
        }
        this.geos.clear();
        this.solidMat.dispose();
        this.glowMat.dispose();
    }

    private geometriesFor(id: string): GeoSet {
        let g = this.geos.get(id);
        if (!g) {
            const full: PropModel = CATALOG[id]();
            const lod: PropModel = full.lod ?? downsample(full);
            const fullData = meshData(full, JITTER);
            const lodData = meshData(lod, JITTER);
            g = {
                full: fullData.index.length ? solidGeometry(fullData) : null,
                fullGlow: glowGeometry(fullData),
                lod: lodData.index.length ? solidGeometry(lodData) : null,
                lodGlow: glowGeometry(lodData),
            };
            this.geos.set(id, g);
        }
        return g;
    }

    private rebuild(camera: THREE.Vector3 | null): void {
        // Count visible instances per id first, so each buffer is sized to fit.
        const counts = new Map<string, number>();
        for (let i = 0; i < this.placements.length; i++) {
            if (keepRoll(i) >= this.density) continue;
            const id = this.placements[i].model;
            counts.set(id, (counts.get(id) ?? 0) + 1);
        }
        for (const id of [...this.bundles.keys()]) {
            if (!counts.has(id)) this.removeBundle(id);
        }
        for (const [id, total] of counts) {
            const existing = this.bundles.get(id);
            if (existing && existing.full.matrices.count >= total) continue;
            // Missing or too small: rebuild with room to spare.
            this.removeBundle(id);
            this.bundles.set(
                id,
                this.makeBundle(this.geometriesFor(id), Math.max(16, total * 2))
            );
        }

        const cursor = new Map<string, { full: number; lod: number }>();
        for (let i = 0; i < this.placements.length; i++) {
            const p = this.placements[i];
            if (keepRoll(i) >= this.density) continue;
            const b = this.bundles.get(p.model);
            if (!b) continue;
            const far = camera
                ? Math.hypot(p.x - camera.x, p.z - camera.z) > LOD_DISTANCE
                : false;
            const c = cursor.get(p.model) ?? { full: 0, lod: 0 };
            cursor.set(p.model, c);
            const level = far ? b.lod : b.full;
            const slot = far ? c.lod++ : c.full++;
            this.tmpPos.set(p.x, p.y, p.z);
            this.tmpQuat.setFromAxisAngle(this.yAxis, p.rotY);
            this.tmpScale.setScalar(p.scale);
            this.tmpMat.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
            this.tmpMat.toArray(
                level.matrices.array as Float32Array,
                slot * 16
            );
        }

        for (const [id, b] of this.bundles) {
            const c = cursor.get(id) ?? { full: 0, lod: 0 };
            for (const [level, n] of [
                [b.full, c.full],
                [b.lod, c.lod],
            ] as const) {
                level.count = n;
                level.matrices.needsUpdate = true;
                if (level.solid) level.solid.count = n;
                if (level.glow) level.glow.count = n;
            }
        }
    }

    private makeBundle(g: GeoSet, cap: number): Bundle {
        const level = (
            solid: THREE.BufferGeometry | null,
            glow: THREE.BufferGeometry | null
        ): Level => {
            const matrices = new THREE.InstancedBufferAttribute(
                new Float32Array(cap * 16),
                16
            );
            matrices.setUsage(THREE.DynamicDrawUsage);
            const mk = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
                const m = new THREE.InstancedMesh(geo, mat, cap);
                m.instanceMatrix = matrices;
                m.frustumCulled = false;
                m.count = 0;
                this.group.add(m);
                return m;
            };
            return {
                matrices,
                solid: solid ? mk(solid, this.solidMat) : null,
                glow: glow ? mk(glow, this.glowMat) : null,
                count: 0,
            };
        };
        return {
            full: level(g.full, g.fullGlow),
            lod: level(g.lod, g.lodGlow),
        };
    }

    private removeBundle(id: string): void {
        const b = this.bundles.get(id);
        if (!b) return;
        for (const lv of [b.full, b.lod]) {
            if (lv.solid) this.group.remove(lv.solid);
            if (lv.glow) this.group.remove(lv.glow);
        }
        this.bundles.delete(id);
    }

    private disposeBundles(): void {
        for (const id of [...this.bundles.keys()]) this.removeBundle(id);
    }
}
