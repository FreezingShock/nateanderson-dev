// Three.js side of the logistics kit: geometry cache, materials with the GPU
// animation patch, and instanced meshes. One InstancedMesh per (piece kind, tier),
// so a whole factory's belts cost about one draw call per kind in use.

import * as THREE from "three";
import { meshVoxels, type MeshData } from "./vox";
import { PIECES, PIECE_KINDS, type PieceKind } from "./pieces";
import { BELT_TIERS } from "./palette";
import { BELT_Y, ITEM_Y, framePoint, pathLen, pathPoint, type PathPoint } from "./paths";
import { BELT_BEGIN, BELT_BEGIN_DEPTH, BELT_EMISSIVE, BELT_FRAGMENT_HEAD, BELT_NORMAL, BELT_VERTEX_HEAD } from "./shader";

/** A placed piece. Matches a sim Building: (x, z) is the min corner cell, rot 0..3 as in types.ts. */
export interface PiecePlacement {
    kind: PieceKind;
    tier?: number;
    x: number;
    z: number;
    rot: 0 | 1 | 2 | 3;
    /** Ground height of the cell (floors). Default 0. */
    y?: number;
}

export interface BeltKitOptions {
    castShadow?: boolean;
    receiveShadow?: boolean;
    /** Starting capacity per mesh; grows by doubling. */
    initialCapacity?: number;
}

export interface BeltKit {
    /** Add this to the scene. */
    readonly object: THREE.Group;
    /** Replace every placed piece. Cheap enough to call on each build or removal. */
    setPieces(list: readonly PiecePlacement[]): void;
    /** Advance belt animation. Call once per frame with seconds since the last frame. */
    update(dt: number): void;
    /** Cells per second for a tier. 0 stops it (no power). */
    setSpeed(tier: number, cellsPerSecond: number): void;
    getSpeed(tier: number): number;
    /** Cells travelled so far by a tier (drives slats and gears). */
    getPhase(tier: number): number;
    setPhase(tier: number, phase: number): void;
    /**
     * Matrix for an item riding a placed piece. `t` is BeltItem.pos (0..1 over the cell);
     * `path` picks one of the piece's paths (PIECES[kind].paths), default the first.
     * The item's origin sits on top of the slats, facing along the belt.
     */
    itemMatrix(p: PiecePlacement, t: number, out: THREE.Matrix4, path?: number): THREE.Matrix4;
    /** Triangles per piece kind, for the perf budget. */
    stats(): { drawCalls: number; instances: number; triangles: number };
    dispose(): void;
}

// ---------- geometry ----------

const geoCache = new Map<string, THREE.BufferGeometry>();

function restSlat(slat: { path: number; rest: number; len: number }, off: [number, number, number]): [number, number, number] {
    return framePoint(slat.path, slat.rest / slat.len, off);
}

/** Drop cached geometry, e.g. after changing BELT_STYLE. Existing kits keep their meshes until setPieces runs on a new kit. */
export function clearGeometryCache(): void {
    for (const g of geoCache.values()) g.dispose();
    geoCache.clear();
}

export function meshPiece(kind: PieceKind, tier = 0): MeshData {
    return meshVoxels(PIECES[kind].build(BELT_TIERS[PIECES[kind].tiered ? tier : 0]), { restSlat });
}

/** Cached merged geometry for a piece and tier. */
export function pieceGeometry(kind: PieceKind, tier = 0): THREE.BufferGeometry {
    const t = PIECES[kind].tiered ? tier : 0;
    const k = `${kind}:${t}`;
    let g = geoCache.get(k);
    if (g) return g;
    const m = meshPiece(kind, t);
    g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(m.position, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(m.normal, 3));
    g.setAttribute("color", new THREE.BufferAttribute(m.color, 3));
    g.setAttribute("aMo", new THREE.BufferAttribute(m.motion, 1));
    g.setAttribute("aA", new THREE.BufferAttribute(m.a, 3));
    g.setAttribute("aB", new THREE.BufferAttribute(m.b, 4));
    g.setIndex(new THREE.BufferAttribute(m.index, 1));
    // Moving parts never leave the footprint by more than a voxel or two.
    const fp = PIECES[kind].footprint;
    g.boundingBox = new THREE.Box3(new THREE.Vector3(-0.1, -0.1, -0.1), new THREE.Vector3(fp.w + 0.1, 3, fp.d + 0.1));
    g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
    geoCache.set(k, g);
    return g;
}

// ---------- materials ----------

function patchVertex(shader: { vertexShader: string }, depth: boolean): void {
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>\n${BELT_VERTEX_HEAD}`);
    if (depth) {
        shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", BELT_BEGIN_DEPTH);
    } else {
        shader.vertexShader = shader.vertexShader
            .replace("#include <beginnormal_vertex>", BELT_NORMAL)
            .replace("#include <begin_vertex>", BELT_BEGIN);
    }
}

function makeMaterials(phase: { value: number }): { color: THREE.MeshStandardMaterial; depth: THREE.MeshDepthMaterial } {
    const color = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.1 });
    color.onBeforeCompile = (shader) => {
        shader.uniforms.uPhase = phase;
        patchVertex(shader, false);
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>\n${BELT_FRAGMENT_HEAD}`)
            .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${BELT_EMISSIVE}`);
    };
    color.customProgramCacheKey = () => "bw-belt";
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    depth.onBeforeCompile = (shader) => {
        shader.uniforms.uPhase = phase;
        patchVertex(shader, true);
    };
    depth.customProgramCacheKey = () => "bw-belt-depth";
    return { color, depth };
}

// ---------- placement maths ----------

const _m = new THREE.Matrix4();
const _r = new THREE.Matrix4();
const _o = new THREE.Matrix4();

/** Rotate about the footprint centre, then move to the cell. Rot 1 turns +z to +x. */
export function placementMatrix(p: PiecePlacement, out: THREE.Matrix4): THREE.Matrix4 {
    const fp = PIECES[p.kind].footprint;
    const odd = p.rot % 2 === 1;
    const w = odd ? fp.d : fp.w,
        d = odd ? fp.w : fp.d;
    _o.makeTranslation(-fp.w / 2, 0, -fp.d / 2);
    _r.makeRotationY((p.rot * Math.PI) / 2);
    _m.makeTranslation(p.x + w / 2, p.y ?? 0, p.z + d / 2);
    return out.copy(_m).multiply(_r).multiply(_o);
}

// ---------- kit ----------

export function createBeltKit(opts: BeltKitOptions = {}): BeltKit {
    const group = new THREE.Group();
    group.name = "belt-kit";
    const tiers = BELT_TIERS.map((t) => ({ speed: t.speed, phase: { value: 0 } }));
    const mats = tiers.map((t) => makeMaterials(t.phase));
    const meshes = new Map<string, THREE.InstancedMesh>();
    const cap0 = opts.initialCapacity ?? 64;

    const meshFor = (kind: PieceKind, tier: number, need: number): THREE.InstancedMesh => {
        const key = `${kind}:${tier}`;
        let m = meshes.get(key);
        if (m && m.instanceMatrix.count >= need) return m;
        let cap = m ? m.instanceMatrix.count : cap0;
        while (cap < need) cap *= 2;
        if (m) {
            group.remove(m);
            m.dispose();
        }
        const mat = mats[tier];
        m = new THREE.InstancedMesh(pieceGeometry(kind, tier), mat.color, cap);
        m.customDepthMaterial = mat.depth;
        m.castShadow = opts.castShadow ?? true;
        m.receiveShadow = opts.receiveShadow ?? true;
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        m.count = 0;
        m.name = `belt:${key}`;
        // Instances are spread over the board; per-instance culling is not worth it.
        m.frustumCulled = false;
        meshes.set(key, m);
        group.add(m);
        return m;
    };

    const tmp = new THREE.Matrix4();
    const pp: PathPoint = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 1 };
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);

    return {
        object: group,
        setPieces(list) {
            const buckets = new Map<string, PiecePlacement[]>();
            for (const p of list) {
                const tier = PIECES[p.kind].tiered ? Math.max(0, Math.min(BELT_TIERS.length - 1, p.tier ?? 0)) : 0;
                const key = `${p.kind}:${tier}`;
                let b = buckets.get(key);
                if (!b) buckets.set(key, (b = []));
                b.push(p);
            }
            for (const [key, m] of meshes) if (!buckets.has(key)) m.count = 0;
            for (const [key, b] of buckets) {
                const [kind, tier] = key.split(":");
                const m = meshFor(kind as PieceKind, Number(tier), b.length);
                for (let n = 0; n < b.length; n++) m.setMatrixAt(n, placementMatrix(b[n], tmp));
                m.count = b.length;
                m.instanceMatrix.needsUpdate = true;
            }
        },
        update(dt) {
            for (const t of tiers) t.phase.value += t.speed * dt;
            // Keep the float precise over long sessions: every path length divides 4.
            for (const t of tiers) if (t.phase.value > 4096) t.phase.value -= 4096;
        },
        setSpeed(tier, s) {
            if (tiers[tier]) tiers[tier].speed = s;
        },
        getSpeed: (tier) => tiers[tier]?.speed ?? 0,
        getPhase: (tier) => tiers[tier]?.phase.value ?? 0,
        setPhase(tier, ph) {
            if (tiers[tier]) tiers[tier].phase.value = ph;
        },
        itemMatrix(p, t, out, path) {
            const id = path ?? PIECES[p.kind].paths[0] ?? 0;
            pathPoint(id, Math.max(0, Math.min(1, t)), pp);
            e.set(-Math.asin(pp.ty), Math.atan2(pp.tx, pp.tz), 0, "YXZ");
            q.setFromEuler(e);
            v.set(pp.x, pp.y + (ITEM_Y - BELT_Y), pp.z);
            out.compose(v, q, one);
            return out.premultiply(placementMatrix(p, tmp));
        },
        stats() {
            let drawCalls = 0,
                instances = 0,
                triangles = 0;
            for (const m of meshes.values()) {
                if (!m.count) continue;
                drawCalls++;
                instances += m.count;
                triangles += m.count * ((m.geometry.index?.count ?? 0) / 3);
            }
            return { drawCalls, instances, triangles };
        },
        dispose() {
            for (const m of meshes.values()) m.dispose();
            for (const mt of mats) {
                mt.color.dispose();
                mt.depth.dispose();
            }
            meshes.clear();
            group.clear();
        },
    };
}

export { PIECES, PIECE_KINDS, pathLen };
