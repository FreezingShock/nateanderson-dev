// Port arrows: one arrow in each tile just outside a machine where items go in or come out.
// Input tiles (the back edge) are verdigris green with a bar across the tail and the arrow pointing into the machine.
// Output tiles (the front edge) are brass with a solid, wider arrow pointing away from it. Both lie flat on the ground.
// One instanced mesh, one draw call. `rot` is the machine's facing (0 +z, 1 +x, 2 -z, 3 -x); every arrow points that way.
import * as THREE from "three";

export interface PortArrow {
    x: number;
    z: number;
    /** The machine's facing, which is the way items travel through the port. */
    rot: number;
    kind: "in" | "out";
}

const MAX_ARROWS = 48;
const PARTS = 4; // plate, shaft, head, tail bar (inputs only)
const IN = new THREE.Color(0x1f9e78);
const IN_HOT = new THREE.Color(0x7dffd0);
const OUT = new THREE.Color(0xb86a10);
const OUT_HOT = new THREE.Color(0xffc040);
const HALF_TURN = Math.PI / 2;

export class PortArrows {
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

    constructor(scene: THREE.Scene) {
        this.mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 1, depthWrite: false, depthTest: false });
        this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.mat, MAX_ARROWS * PARTS);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_ARROWS * PARTS * 3), 3);
        this.mesh.frustumCulled = false;
        this.mesh.count = 0;
        this.mesh.renderOrder = 12;
        scene.add(this.mesh);
    }

    set(arrows: readonly PortArrow[], heightAt: (x: number, z: number) => number): void {
        const n = Math.min(arrows.length, MAX_ARROWS);
        let k = 0;
        for (let i = 0; i < n; i++) {
            const a = arrows[i];
            const cx = a.x + 0.5;
            const cz = a.z + 0.5;
            const y = heightAt(cx, cz) + 0.07;
            const isIn = a.kind === "in";
            const tint = isIn ? IN : OUT;
            const hot = isIn ? IN_HOT : OUT_HOT;
            this.put(k++, cx, cz, y, 0.9, 0.05, 0.9, a.rot, 0, tint, 0.15); // tile plate
            // Inputs are a slim shaft and a narrow head; outputs are a thick shaft and a wide head, so they never look alike.
            this.put(k++, cx, cz, y + 0.06, isIn ? 0.14 : 0.26, 0.07, isIn ? 0.5 : 0.5, a.rot, isIn ? -0.04 : -0.06, hot, 1);
            this.put(k++, cx, cz, y + 0.07, isIn ? 0.4 : 0.7, 0.08, isIn ? 0.2 : 0.26, a.rot, isIn ? 0.3 : 0.28, hot, 1);
            if (isIn) this.put(k++, cx, cz, y + 0.06, 0.6, 0.08, 0.08, a.rot, -0.36, tint, 1); // stop bar behind the tail
            else this.hide(k++);
        }
        this.count = k;
        this.mesh.count = n === 0 ? 0 : k;
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }

    update(dt: number): void {
        if (this.count === 0) return;
        if (!this.pulsing) {
            this.mat.opacity = 0.85;
            return;
        }
        this.time += dt;
        this.mat.opacity = 0.75 + 0.25 * (0.5 + 0.5 * Math.sin(this.time * 4));
    }

    setPulsing(on: boolean): void {
        this.pulsing = on;
    }

    dispose(): void {
        this.mesh.geometry.dispose();
        this.mat.dispose();
        this.mesh.dispose();
        this.mesh.removeFromParent();
    }

    /** Places one box. (dx, dz) is a shift along the facing, in cells; `mix` blends the tint toward white-hot. */
    private put(i: number, x: number, z: number, y: number, sx: number, sy: number, sz: number, rot: number, along: number, tint: THREE.Color, mix: number): void {
        const ang = -rot * HALF_TURN;
        this.q.setFromAxisAngle(this.up, ang);
        this.p.set(x + Math.sin(ang) * along, y, z + Math.cos(ang) * along);
        this.s.set(sx, sy, sz);
        this.m.compose(this.p, this.q, this.s);
        this.mesh.setMatrixAt(i, this.m);
        this.c.copy(tint);
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
