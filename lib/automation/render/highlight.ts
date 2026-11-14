// Selection outline: brass frame bars around each highlighted board cell. One instanced mesh with
// four bars per cell, so a whole belt run or a building costs a single draw call. The outline sits
// a little above the ground and gently pulses so it reads on top of belts and machines.
import * as THREE from "three";

export interface HighlightCell {
    x: number;
    z: number;
}

const BAR = 0.07; // bar thickness in world units
const LIFT = 0.05; // height above the ground under each cell
const TOP = 0.16; // bar height
const BRASS = new THREE.Color(0xd9a441);
const BRASS_HOT = new THREE.Color(0xffe0a0);
const MAX_CELLS = 512;

export class SelectionOutline {
    readonly mesh: THREE.InstancedMesh;
    private count = 0;
    private readonly m = new THREE.Matrix4();
    private readonly q = new THREE.Quaternion();
    private readonly p = new THREE.Vector3();
    private readonly s = new THREE.Vector3();
    private readonly c = new THREE.Color();
    private readonly mat: THREE.MeshBasicMaterial;
    private time = 0;

    constructor(scene: THREE.Scene) {
        const geo = new THREE.BoxGeometry(1, 1, 1);
        this.mat = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
        });
        this.mesh = new THREE.InstancedMesh(geo, this.mat, MAX_CELLS * 4);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.frustumCulled = false;
        this.mesh.count = 0;
        this.mesh.renderOrder = 10;
        scene.add(this.mesh);
    }

    /** Outline these board cells (same frame as setBelts). Empty clears it. */
    setCells(cells: readonly HighlightCell[], heightAt: (x: number, z: number) => number): void {
        const n = Math.min(cells.length, MAX_CELLS);
        let k = 0;
        for (let i = 0; i < n; i++) {
            const { x, z } = cells[i];
            const y = heightAt(x + 0.5, z + 0.5) + LIFT;
            // Four edges: north, south, west, east. Each runs the full cell edge.
            this.bar(k++, x + 0.5, y, z, 1, BAR, false);
            this.bar(k++, x + 0.5, y, z + 1, 1, BAR, false);
            this.bar(k++, x, y, z + 0.5, BAR, 1, true);
            this.bar(k++, x + 1, y, z + 0.5, BAR, 1, true);
        }
        this.count = k;
        this.mesh.count = k;
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    /** Pulses the outline. Call once per frame with the frame delta. */
    update(dt: number): void {
        if (this.count === 0) return;
        this.time += dt;
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
        this.c.copy(BRASS).lerp(BRASS_HOT, pulse);
        this.mat.color.copy(this.c);
    }

    dispose(): void {
        this.mesh.geometry.dispose();
        this.mat.dispose();
        this.mesh.dispose();
        this.mesh.removeFromParent();
    }

    private bar(i: number, cx: number, y: number, cz: number, sx: number, sz: number, alongZ: boolean): void {
        // Bars run along x for north and south edges, and along z for west and east edges.
        const len = 1;
        this.s.set(alongZ ? sx : len, TOP, alongZ ? len : sz);
        this.p.set(cx, y + TOP / 2, cz);
        this.m.compose(this.p, this.q, this.s);
        this.mesh.setMatrixAt(i, this.m);
    }
}
