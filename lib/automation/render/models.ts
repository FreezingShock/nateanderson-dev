// Placed voxel models: animated machines and the placement ghost. Models are baked with the shared
// loader, one mesh per part, so each part can pivot and glow on its own.
//
// Frame: a board cell is one world unit square. A model's footprint (default 1x1 cells) sits on
// its cell, and its geometry is in world units with the origin at the footprint corner. The root
// group rotates about the footprint centre in quarter turns.
import * as THREE from "three";
import { bakePart, partVisible } from "../models/loader";
import { poseAt } from "../models/anim";
import type { ModelPart, ModelState, Rot, VoxelModel } from "../models/format";

export interface ModelCell {
    x: number;
    z: number;
}

export interface PlaceOptions {
    cell: ModelCell;
    rot?: Rot;
    /** Which parts are visible, by machine state. Default "always". */
    state?: ModelState;
}

/** Per-machine state the simulation pushes each tick. */
export interface ObjectState {
    /** Whether the machine is working. Parts with `when: "working"` only run then. */
    working?: boolean;
    /** The machine's own working clock, in seconds. Parts stop where they are when it stops. */
    t?: number;
    /** 0..1 charge. Scales the brightness of glow parts. Default 1. */
    charge?: number;
}

interface PartRig {
    part: ModelPart;
    pivot: THREE.Group;
    glow: THREE.MeshBasicMaterial | null;
}

interface Placed {
    root: THREE.Group;
    rigs: PartRig[];
    meshes: THREE.Mesh[];
    working: boolean;
    t: number;
    charge: number;
}

const HALF_TURN = Math.PI / 2;

/** Pivot of a part in world units, where the baked geometry is at pivot + pos. */
function pivotOf(model: VoxelModel, part: ModelPart): THREE.Vector3 {
    return new THREE.Vector3(
        part.pivot[0] * model.voxel,
        part.pivot[1] * model.voxel,
        part.pivot[2] * model.voxel
    );
}

/**
 * Builds the root group for a model on a cell. The body inside it carries the footprint offset,
 * so rotation turns the model about the footprint centre.
 */
function makeRoot(
    model: VoxelModel,
    cell: ModelCell,
    rot: Rot,
    heightAt: (x: number, z: number) => number
): { root: THREE.Group; body: THREE.Group } {
    const fw = model.footprint?.w ?? 1;
    const fd = model.footprint?.d ?? 1;
    const root = new THREE.Group();
    root.position.set(
        cell.x + fw / 2,
        heightAt(cell.x + 0.5, cell.z + 0.5),
        cell.z + fd / 2
    );
    root.rotation.set(0, -rot * HALF_TURN, 0);
    const body = new THREE.Group();
    body.position.set(-fw / 2, 0, -fd / 2);
    root.add(body);
    return { root, body };
}

export class ModelRenderer {
    private readonly placed = new Map<string, Placed>();
    private readonly solidMat: THREE.MeshStandardMaterial;
    private readonly ghostMat: THREE.MeshBasicMaterial;
    private readonly ghostRoot: THREE.Group;
    private ghostBody: THREE.Group;
    private ghostKey = "";

    constructor(
        private readonly scene: THREE.Scene,
        private readonly heightAt: (x: number, z: number) => number
    ) {
        this.solidMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.85,
            metalness: 0.05,
        });
        this.ghostMat = new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.45,
            depthWrite: false,
        });
        this.ghostRoot = new THREE.Group();
        this.ghostRoot.visible = false;
        this.ghostBody = new THREE.Group();
        this.ghostRoot.add(this.ghostBody);
        scene.add(this.ghostRoot);
    }

    /** Places (or re-places) a model under `id`. Replaces whatever was there. */
    place(id: string, model: VoxelModel, opts: PlaceOptions): void {
        this.remove(id);
        const state = opts.state ?? "always";
        const { root, body } = makeRoot(
            model,
            opts.cell,
            opts.rot ?? 0,
            this.heightAt
        );
        const rigs: PartRig[] = [];
        const meshes: THREE.Mesh[] = [];

        for (const part of model.parts) {
            if (!partVisible(part, state)) continue;
            const pivot = new THREE.Group();
            const at = pivotOf(model, part);
            pivot.position.copy(at);
            body.add(pivot);
            let glow: THREE.MeshBasicMaterial | null = null;
            for (const isGlow of [false, true]) {
                const geo = bakePart(model, part, isGlow ? "glow" : "solid");
                if (!geo) continue;
                // Baked voxels sit at pivot + pos, so shift back to pivot-local space.
                geo.translate(-at.x, -at.y, -at.z);
                let mat: THREE.Material = this.solidMat;
                if (isGlow) {
                    glow = new THREE.MeshBasicMaterial({ vertexColors: true });
                    mat = glow;
                }
                const mesh = new THREE.Mesh(geo, mat);
                pivot.add(mesh);
                meshes.push(mesh);
            }
            rigs.push({ part, pivot, glow });
        }

        this.scene.add(root);
        const entry: Placed = {
            root,
            rigs,
            meshes,
            working: false,
            t: 0,
            charge: 1,
        };
        this.placed.set(id, entry);
        this.applyPose(entry);
    }

    /** Sets the state a placed model animates from. Unknown ids are ignored. */
    setState(id: string, next: ObjectState): void {
        const p = this.placed.get(id);
        if (!p) return;
        if (next.working !== undefined) p.working = next.working;
        if (next.t !== undefined) p.t = next.t;
        if (next.charge !== undefined)
            p.charge = Math.max(0, Math.min(1, next.charge));
        this.applyPose(p);
    }

    remove(id: string): void {
        const p = this.placed.get(id);
        if (!p) return;
        this.scene.remove(p.root);
        for (const m of p.meshes) {
            m.geometry.dispose();
            if (m.material !== this.solidMat)
                (m.material as THREE.Material).dispose();
        }
        this.placed.delete(id);
    }

    clear(): void {
        for (const id of [...this.placed.keys()]) this.remove(id);
    }

    /** Shows a translucent preview of `model` on `cell`. Tints green when valid, red when not. */
    setGhost(
        model: VoxelModel,
        cell: ModelCell,
        rot: Rot,
        valid: boolean
    ): void {
        const key = `${model.id}:${model.parts.length}`;
        if (key !== this.ghostKey) this.rebuildGhost(model, key);
        const { root, body } = makeRoot(model, cell, rot, this.heightAt);
        // Reuse the ghost root: copy the transform from the fresh root, keep the built body.
        this.ghostRoot.position.copy(root.position);
        this.ghostRoot.rotation.copy(root.rotation);
        this.ghostBody.position.copy(body.position);
        this.ghostMat.color.set(valid ? 0x7fe89a : 0xff6b6b);
        this.ghostRoot.visible = true;
    }

    clearGhost(): void {
        this.ghostRoot.visible = false;
    }

    /** Advances every animated model to its current state. Call once per frame. */
    update(): void {
        for (const p of this.placed.values()) {
            if (p.rigs.some((r) => r.part.anim)) this.applyPose(p);
        }
    }

    dispose(): void {
        this.clear();
        this.clearGhostBody();
        this.scene.remove(this.ghostRoot);
        this.solidMat.dispose();
        this.ghostMat.dispose();
    }

    private applyPose(p: Placed): void {
        for (const rig of p.rigs) {
            const pose = poseAt(rig.part.anim, p.t, p.working);
            const base = rig.pivot.userData.base as THREE.Vector3 | undefined;
            const origin = base ?? rig.pivot.position.clone();
            if (!base) rig.pivot.userData.base = origin;
            rig.pivot.rotation.set(0, 0, 0);
            rig.pivot.position.copy(origin);
            // Offset runs along the animation axis, in voxels.
            rig.pivot.rotation[pose.axis] = pose.angle;
            rig.pivot.position[pose.axis] += pose.offset * 0.1;
            if (rig.glow) rig.glow.color.setScalar(pose.glow * p.charge);
        }
    }

    private rebuildGhost(model: VoxelModel, key: string): void {
        this.clearGhostBody();
        const body = new THREE.Group();
        for (const part of model.parts) {
            for (const isGlow of [false, true]) {
                const geo = bakePart(model, part, isGlow ? "glow" : "solid");
                if (!geo) continue;
                body.add(new THREE.Mesh(geo, this.ghostMat));
            }
        }
        this.ghostRoot.remove(this.ghostBody);
        this.ghostBody = body;
        this.ghostRoot.add(body);
        this.ghostKey = key;
    }

    private clearGhostBody(): void {
        for (const child of [...this.ghostBody.children]) {
            (child as THREE.Mesh).geometry.dispose();
        }
        this.ghostBody.clear();
        this.ghostKey = "";
    }
}
