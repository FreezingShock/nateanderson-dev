// A fixed-size particle pool drawn as one InstancedMesh of unit cubes. Each live particle has a
// position, velocity, age, size curve and colour. Dead slots are scaled to zero, so a pool always
// costs exactly one draw call no matter how many particles are alive.
import * as THREE from "three";

export interface PoolOptions {
    capacity: number;
    /** Added to velocity each second (y only). */
    gravity?: number;
    /** Velocity kept per second, 0..1 (1 is no drag). */
    drag?: number;
    additive?: boolean;
    opacity?: number;
    /** How size changes over life: shrink to 0, grow to 2.4x, or twinkle in and out. */
    curve?: "shrink" | "grow" | "pulse" | "const";
    /** Stretch on y (rain streaks). */
    stretchY?: number;
    renderOrder?: number;
}

export class ParticlePool {
    readonly mesh: THREE.InstancedMesh;
    readonly capacity: number;
    private pos: Float32Array;
    private vel: Float32Array;
    private age: Float32Array;
    private life: Float32Array;
    private size: Float32Array;
    private spin: Float32Array;
    private next = 0;
    private alive = 0;
    private opts: Required<Omit<PoolOptions, "capacity">>;
    private m = new THREE.Matrix4();
    private q = new THREE.Quaternion();
    private e = new THREE.Euler();
    private v = new THREE.Vector3();
    private s = new THREE.Vector3();
    private c = new THREE.Color();
    /** Multiplies every colour on write, for day and night tinting. */
    tint = 1;

    constructor(opts: PoolOptions) {
        this.capacity = opts.capacity;
        this.opts = {
            gravity: opts.gravity ?? 0,
            drag: opts.drag ?? 1,
            additive: opts.additive ?? false,
            opacity: opts.opacity ?? 1,
            curve: opts.curve ?? "shrink",
            stretchY: opts.stretchY ?? 1,
            renderOrder: opts.renderOrder ?? 2,
        };
        const n = opts.capacity;
        this.pos = new Float32Array(n * 3);
        this.vel = new Float32Array(n * 3);
        this.age = new Float32Array(n);
        this.life = new Float32Array(n).fill(0);
        this.size = new Float32Array(n);
        this.spin = new Float32Array(n);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: this.opts.opacity < 1 || this.opts.additive,
            opacity: this.opts.opacity,
            depthWrite: !(this.opts.opacity < 1 || this.opts.additive),
            blending: this.opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
            fog: false,
        });
        this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, n);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = this.opts.renderOrder;
        this.mesh.castShadow = false;
        this.mesh.receiveShadow = false;
        const zero = new THREE.Matrix4().makeScale(0, 0, 0);
        for (let i = 0; i < n; i++) {
            this.mesh.setMatrixAt(i, zero);
            this.mesh.setColorAt(i, this.c.set(0xffffff));
        }
        this.mesh.count = n;
    }

    get liveCount(): number {
        return this.alive;
    }

    /** Starts a particle in the next slot, overwriting the oldest when the pool is full. */
    spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: number): number {
        const i = this.next;
        this.next = (this.next + 1) % this.capacity;
        const p = i * 3;
        this.pos[p] = x;
        this.pos[p + 1] = y;
        this.pos[p + 2] = z;
        this.vel[p] = vx;
        this.vel[p + 1] = vy;
        this.vel[p + 2] = vz;
        this.age[i] = 0;
        this.life[i] = life;
        this.size[i] = size;
        this.spin[i] = Math.random() * 6.28;
        this.mesh.setColorAt(i, this.c.set(color).multiplyScalar(this.tint));
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
        return i;
    }

    /** Pushes every live particle by (dx, dy, dz) per second this frame (wind). */
    update(dt: number, push?: (i: number, p: Float32Array, out: THREE.Vector3) => void): void {
        const { gravity, drag, curve, stretchY } = this.opts;
        const keep = drag === 1 ? 1 : Math.pow(drag, dt);
        let alive = 0;
        let dirty = false;
        for (let i = 0; i < this.capacity; i++) {
            if (this.life[i] <= 0) continue;
            dirty = true;
            this.age[i] += dt;
            const p = i * 3;
            if (this.age[i] >= this.life[i]) {
                this.life[i] = 0;
                this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
                continue;
            }
            alive++;
            this.vel[p + 1] += gravity * dt;
            this.vel[p] *= keep;
            this.vel[p + 1] *= keep;
            this.vel[p + 2] *= keep;
            let ax = 0, ay = 0, az = 0;
            if (push) {
                this.v.set(0, 0, 0);
                push(i, this.pos, this.v);
                ax = this.v.x;
                ay = this.v.y;
                az = this.v.z;
            }
            this.pos[p] += (this.vel[p] + ax) * dt;
            this.pos[p + 1] += (this.vel[p + 1] + ay) * dt;
            this.pos[p + 2] += (this.vel[p + 2] + az) * dt;
            const k = this.age[i] / this.life[i];
            let sc = this.size[i];
            if (curve === "shrink") sc *= 1 - k * k;
            else if (curve === "grow") sc *= (0.4 + 2 * k) * (k > 0.8 ? (1 - k) / 0.2 : 1);
            else if (curve === "pulse") sc *= Math.sin(Math.PI * k);
            this.spin[i] += dt * 2;
            this.e.set(this.spin[i], this.spin[i] * 0.7, 0);
            this.q.setFromEuler(stretchY === 1 ? this.e : this.e.set(0, 0, 0));
            this.s.set(sc, sc * stretchY, sc);
            this.v.set(this.pos[p], this.pos[p + 1], this.pos[p + 2]);
            this.mesh.setMatrixAt(i, this.m.compose(this.v, this.q, this.s));
        }
        this.alive = alive;
        if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
    }

    /** Age of a live particle in 0..1, or -1 when the slot is dead. */
    progress(i: number): number {
        return this.life[i] > 0 ? this.age[i] / this.life[i] : -1;
    }

    clear(): void {
        this.life.fill(0);
        const zero = this.m.makeScale(0, 0, 0);
        for (let i = 0; i < this.capacity; i++) this.mesh.setMatrixAt(i, zero);
        this.mesh.instanceMatrix.needsUpdate = true;
        this.alive = 0;
    }

    dispose(): void {
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
    }
}
