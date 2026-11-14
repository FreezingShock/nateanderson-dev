// Belt stroke ghost: one glowing path over the cells of a pencil stroke. Each cell gets a plate, a
// direction arrow on straight runs, a corner dot where the path turns, and end caps at both ends.
// Refused cells use the red treatment. One instanced mesh, one draw call for the whole stroke.
import * as THREE from "three";

export interface PathCell {
    x: number;
    z: number;
    /** Quarter turn the belt faces (toward the next cell). Same convention as placed models. */
    rot: number;
    valid: boolean;
}

export type JoinDir = "n" | "e" | "s" | "w";

/** A join where the stroke meets an existing belt or a machine port, on one edge of a board cell. */
export interface GhostJoin {
    cell: { x: number; z: number };
    dir: JoinDir;
    kind: "belt" | "port";
}

const MAX_CELLS = 384;
const MAX_JOINS = 128;
const PORT_JOIN = new THREE.Color(0x9fe8ff);
const PARTS_PER_CELL = 5; // plate, arrow shaft, arrow head, corner or cap
const BRASS = new THREE.Color(0xffc24a);
const BRASS_HOT = new THREE.Color(0xfff6d0);
const RED = new THREE.Color(0xff3a2a);
const RED_HOT = new THREE.Color(0xffb8a0);
const ARROW = new THREE.Color(0xffffff);
const HALF_TURN = Math.PI / 2;

export class GhostPath {
    readonly mesh: THREE.InstancedMesh;
    private count = 0;
    private time = 0;
    private pulsing = true;
    private readonly mat: THREE.MeshBasicMaterial;
    private readonly m = new THREE.Matrix4();
    private readonly q = new THREE.Quaternion();
    private readonly p = new THREE.Vector3();
    private readonly s = new THREE.Vector3();
    private readonly up = new THREE.Vector3(0, 1, 0);
    private readonly c = new THREE.Color();
    private readonly colors: Float32Array;
    private readonly joinMesh: THREE.InstancedMesh;
    private readonly joinMat: THREE.MeshBasicMaterial;
    private joinCount = 0;

    constructor(scene: THREE.Scene) {
        const geo = new THREE.BoxGeometry(1, 1, 1);
        this.mat = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 1,
            depthWrite: false,
            // The ghost reads through machines and the hub, so a stroke behind a building still shows.
            depthTest: false,
            blending: THREE.AdditiveBlending,
        });
        this.mesh = new THREE.InstancedMesh(geo, this.mat, MAX_CELLS * PARTS_PER_CELL);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.colors = new Float32Array(MAX_CELLS * PARTS_PER_CELL * 3);
        this.mesh.instanceColor = new THREE.InstancedBufferAttribute(this.colors, 3);
        this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        this.mesh.frustumCulled = false;
        this.mesh.count = 0;
        this.mesh.renderOrder = 11;
        scene.add(this.mesh);

        // Join cues: a bright bar on the shared edge of a cell that meets a belt (brass) or a port (cyan).
        this.joinMat = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 1,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending,
        });
        this.joinMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.joinMat, MAX_JOINS);
        this.joinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.joinMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_JOINS * 3), 3);
        this.joinMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        this.joinMesh.frustumCulled = false;
        this.joinMesh.count = 0;
        this.joinMesh.renderOrder = 12;
        scene.add(this.joinMesh);
    }

    /** Draws the stroke. `cells` is in path order. Empty clears it. */
    set(cells: readonly PathCell[], heightAt: (x: number, z: number) => number): void {
        const n = Math.min(cells.length, MAX_CELLS);
        let k = 0;
        for (let i = 0; i < n; i++) {
            const cell = cells[i];
            const prev = cells[i - 1];
            const next = cells[i + 1];
            const y = heightAt(cell.x + 0.5, cell.z + 0.5) + 0.06;
            const cx = cell.x + 0.5;
            const cz = cell.z + 0.5;
            const tint = cell.valid ? BRASS : RED;
            const hot = cell.valid ? BRASS_HOT : RED_HOT;

            // Plate: a flat glowing square over the cell.
            this.put(k++, cx, y, cz, 0.92, 0.06, 0.92, 0, tint, hot);

            // Corner: the path turns here when the belt in and the belt out face different ways.
            const turns = prev !== undefined && next !== undefined && prev.rot !== cell.rot;
            if (turns) {
                this.put(k++, cx, y + 0.05, cz, 0.36, 0.05, 0.36, 0, hot, hot);
            } else {
                // Arrow on straight runs: a bright shaft and a head, pointing where the belt faces.
                this.put(k++, cx, y + 0.08, cz, 0.2, 0.08, 0.56, cell.rot, ARROW, ARROW, true);
                this.put(k++, cx, y + 0.09, cz, 0.5, 0.09, 0.22, cell.rot, ARROW, ARROW, true, 0.26);
            }

            // End caps where the stroke starts and stops.
            if (i === 0 || i === n - 1) {
                this.put(k++, cx, y + 0.07, cz, 0.44, 0.07, 0.44, 0, hot, hot);
            } else {
                k++; // keep one slot per cell so the index stays stable
                this.hide(k - 1);
            }
        }
        this.count = k;
        this.mesh.count = k;
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
        if (n === 0) this.mesh.count = 0;
    }

    /** Draws join cues on cell edges. Empty clears them. Same board frame as set(). */
    setJoins(joins: readonly GhostJoin[], heightAt: (x: number, z: number) => number): void {
        const n = Math.min(joins.length, MAX_JOINS);
        for (let i = 0; i < n; i++) {
            const j = joins[i];
            const ex = j.dir === "e" ? 0.5 : j.dir === "w" ? -0.5 : 0;
            const ez = j.dir === "s" ? 0.5 : j.dir === "n" ? -0.5 : 0;
            const cx = j.cell.x + 0.5 + ex;
            const cz = j.cell.z + 0.5 + ez;
            const y = heightAt(cx, cz) + 0.1;
            const horizontal = j.dir === "e" || j.dir === "w";
            // Bar runs along the edge: across the x axis for n/s edges, across z for e/w edges.
            this.p.set(cx, y, cz);
            this.q.identity();
            this.s.set(horizontal ? 0.1 : 0.86, 0.1, horizontal ? 0.86 : 0.1);
            this.m.compose(this.p, this.q, this.s);
            this.joinMesh.setMatrixAt(i, this.m);
            this.c.copy(j.kind === "port" ? PORT_JOIN : BRASS_HOT);
            this.joinMesh.setColorAt(i, this.c);
        }
        this.joinCount = n;
        this.joinMesh.count = n;
        this.joinMesh.instanceMatrix.needsUpdate = true;
        if (this.joinMesh.instanceColor) this.joinMesh.instanceColor.needsUpdate = true;
    }

    /** Pulses the glow. Call once per frame. */
    update(dt: number): void {
        if (this.count === 0) return;
        if (!this.pulsing) {
            this.mat.opacity = 0.7;
            return;
        }
        this.time += dt;
        this.mat.opacity = 0.8 + 0.2 * (0.5 + 0.5 * Math.sin(this.time * 4));
        // Join cues pulse faster so they read as live connections.
        this.joinMat.opacity = this.joinCount === 0 ? 0 : 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(this.time * 6));
    }

    setPulsing(on: boolean): void {
        this.pulsing = on;
    }

    clear(): void {
        this.count = 0;
        this.mesh.count = 0;
        this.joinCount = 0;
        this.joinMesh.count = 0;
    }

    dispose(): void {
        this.mesh.geometry.dispose();
        this.mat.dispose();
        this.mesh.dispose();
        this.mesh.removeFromParent();
        this.joinMesh.geometry.dispose();
        this.joinMat.dispose();
        this.joinMesh.dispose();
        this.joinMesh.removeFromParent();
    }

    private put(
        i: number,
        x: number,
        y: number,
        z: number,
        sx: number,
        sy: number,
        sz: number,
        rot: number,
        tint: THREE.Color,
        hot: THREE.Color,
        arrow = false,
        forward = 0.12
    ): void {
        // Arrow shafts run along the belt's facing; plates and caps are square so the turn does not matter.
        this.q.setFromAxisAngle(this.up, -rot * HALF_TURN);
        if (arrow) {
            // Shift the shaft forward so the arrow sits on the cell's leading half.
            const dx = Math.sin(-rot * HALF_TURN) * forward;
            const dz = Math.cos(-rot * HALF_TURN) * forward;
            this.p.set(x + dx, y, z + dz);
        } else {
            this.p.set(x, y, z);
        }
        this.s.set(sx, sy, sz);
        this.m.compose(this.p, this.q, this.s);
        this.mesh.setMatrixAt(i, this.m);
        this.c.copy(tint).lerp(hot, tint === ARROW ? 0 : 0.5);
        this.mesh.setColorAt(i, this.c);
    }

    private hide(i: number): void {
        this.s.set(0, 0, 0);
        this.p.set(0, -999, 0);
        this.q.identity();
        this.m.compose(this.p, this.q, this.s);
        this.mesh.setMatrixAt(i, this.m);
    }
}
