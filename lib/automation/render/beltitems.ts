// Items riding belts: one InstancedMesh per item id (lit body plus unlit glow), matrices rebuilt each frame from the
// sim's belt lanes through the belt kit's item path. Hundreds of items cost one or two draw calls per item type.
import * as THREE from "three";
import { bakePart } from "../models/loader";
import { BELT_ITEM_SCALE, ITEM_MODELS } from "../models/items";
import type { PiecePlacement } from "../models/belts";
import { applyHeightFog } from "./fog";

export interface BeltItemSource {
    /** Placement of the belt piece the lane rides on. */
    piece: PiecePlacement;
    lane: readonly { item: string; pos: number }[];
}

interface Bucket {
    meshes: THREE.InstancedMesh[];
    cap: number;
    n: number;
}

export interface BeltItems {
    readonly object: THREE.Group;
    /** Redraws every item. `matrix` is the island's beltItemMatrix. */
    update(belts: Iterable<BeltItemSource>, matrix: (p: PiecePlacement, t: number, out: THREE.Matrix4) => THREE.Matrix4): void;
    count(): number;
    dispose(): void;
}

export function createBeltItems(): BeltItems {
    const group = new THREE.Group();
    group.name = "belt-items";
    const solid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.1 });
    applyHeightFog(solid, "belt-items");
    const glow = new THREE.MeshBasicMaterial({ vertexColors: true });
    const geos = new Map<string, { s: THREE.BufferGeometry | null; g: THREE.BufferGeometry | null }>();
    const buckets = new Map<string, Bucket>();
    const m = new THREE.Matrix4();
    const scale = new THREE.Matrix4().makeScale(BELT_ITEM_SCALE, BELT_ITEM_SCALE, BELT_ITEM_SCALE);
    let total = 0;

    const bucket = (item: string, need: number): Bucket | null => {
        let b = buckets.get(item);
        if (b && b.cap >= need) return b;
        const model = ITEM_MODELS[item];
        if (!model) return null;
        let g = geos.get(item);
        if (!g) {
            g = { s: bakePart(model, model.parts[0], "solid"), g: bakePart(model, model.parts[0], "glow") };
            geos.set(item, g);
        }
        const cap = Math.max(32, need * 2);
        if (b) for (const mesh of b.meshes) { group.remove(mesh); mesh.dispose(); }
        const meshes: THREE.InstancedMesh[] = [];
        for (const [geo, mat] of [[g.s, solid], [g.g, glow]] as const) {
            if (!geo) continue;
            const mesh = new THREE.InstancedMesh(geo, mat, cap);
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.frustumCulled = false;
            mesh.castShadow = true;
            mesh.count = 0;
            group.add(mesh);
            meshes.push(mesh);
        }
        b = { meshes, cap, n: 0 };
        buckets.set(item, b);
        return b;
    };

    return {
        object: group,
        update(belts, matrix) {
            const per = new Map<string, number>();
            const list: [string, PiecePlacement, number][] = [];
            for (const { piece, lane } of belts)
                for (const it of lane) {
                    if (!ITEM_MODELS[it.item]) continue;
                    per.set(it.item, (per.get(it.item) ?? 0) + 1);
                    list.push([it.item, piece, it.pos]);
                }
            for (const b of buckets.values()) b.n = 0;
            for (const [item, n] of per) bucket(item, n);
            for (const [item, piece, pos] of list) {
                const b = buckets.get(item)!;
                matrix(piece, Math.min(1, Math.max(0, pos)), m).multiply(scale);
                for (const mesh of b.meshes) mesh.setMatrixAt(b.n, m);
                b.n++;
            }
            total = list.length;
            for (const b of buckets.values())
                for (const mesh of b.meshes) {
                    mesh.count = b.n;
                    mesh.instanceMatrix.needsUpdate = true;
                }
        },
        count: () => total,
        dispose() {
            for (const b of buckets.values()) for (const mesh of b.meshes) mesh.dispose();
            for (const g of geos.values()) { g.s?.dispose(); g.g?.dispose(); }
            solid.dispose();
            glow.dispose();
        },
    };
}
