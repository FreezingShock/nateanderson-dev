// Machine effects: smoke puffs and sparks from working machines. One instanced mesh, one pool,
// no allocations per frame. Density follows the quality level, and low fx turns it off.
import * as THREE from "three";

interface Particle {
    alive: boolean;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    age: number;
    life: number;
    size: number;
    kind: 0 | 1 | 2; // 0 smoke, 1 spark, 2 item (a brass piece leaving a machine's chute)
}

const POOL = 320;
export type BurstKind = "place" | "remove" | "milestone";
const BURST_COUNT: Record<BurstKind, number> = { place: 14, remove: 10, milestone: 60 };
const SMOKE_RATE = 5; // puffs per second per working smoking machine, at full density
const SPARK_RATE = 7;
const SMOKE_COLOR = new THREE.Color(0x8a8078);
const SMOKE_COLOR_END = new THREE.Color(0x4a4440);
const SPARK_COLOR = new THREE.Color(0xffc060);
const SPARK_COLOR_END = new THREE.Color(0xff6a2a);
const ITEM_RATE = 4; // brass pieces per second while a machine works
const ITEM_COLOR = new THREE.Color(0xffc84a);
const ITEM_COLOR_END = new THREE.Color(0xffe39a);

export class MachineEffects {
    readonly mesh: THREE.InstancedMesh;
    private readonly parts: Particle[] = [];
    private readonly emitters = new Map<
        string,
        {
            x: number;
            y: number;
            z: number;
            sparks: boolean;
            working: boolean;
            acc: number;
            dx?: number;
            dz?: number;
            item?: boolean;
        }
    >();
    private density = 1;
    private enabled = true;
    private wind = 0.5;
    private readonly m = new THREE.Matrix4();
    private readonly c = new THREE.Color();
    private readonly q = new THREE.Quaternion();
    private readonly p = new THREE.Vector3();
    private readonly s = new THREE.Vector3();

    constructor(scene: THREE.Scene) {
        for (let i = 0; i < POOL; i++) {
            this.parts.push({
                alive: false,
                x: 0,
                y: 0,
                z: 0,
                vx: 0,
                vy: 0,
                vz: 0,
                age: 0,
                life: 1,
                size: 0.1,
                kind: 0,
            });
        }
        const geo = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshBasicMaterial({ vertexColors: false });
        this.mesh = new THREE.InstancedMesh(geo, mat, POOL);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.frustumCulled = false;
        this.mesh.count = POOL;
        this.mesh.instanceColor = new THREE.InstancedBufferAttribute(
            new Float32Array(POOL * 3),
            3
        );
        this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        for (let i = 0; i < POOL; i++) this.hide(i);
        scene.add(this.mesh);
    }

    /** Register a working machine's chimney point (world units). Sparks come from furnace-type machines. */
    setEmitter(id: string, x: number, y: number, z: number, sparks: boolean): void {
        this.emitters.set(id, { x, y, z, sparks, working: false, acc: 0 });
    }

    /** Output chute: while working, brass pieces leave the front of the machine along (dx, dz). */
    setItemEmitter(id: string, x: number, y: number, z: number, dx: number, dz: number): void {
        this.emitters.set(id, { x, y, z, sparks: false, working: false, acc: 0, dx, dz, item: true });
    }

    removeEmitter(id: string): void {
        this.emitters.delete(id);
        // Drop the item chutes too, so a removed machine stops emitting.
        for (const key of [...this.emitters.keys()]) {
            if (key.startsWith(`${id}#`)) this.emitters.delete(key);
        }
    }

    clearEmitters(): void {
        this.emitters.clear();
    }

    /** Set working state for an emitter. Idle emitters stop spawning; live puffs finish. */
    setWorking(id: string, working: boolean): void {
        const e = this.emitters.get(id);
        if (e) e.working = working;
        // Item chutes register as `${id}#<n>`, one per declared out port.
        for (const [key, e2] of this.emitters) {
            if (key.startsWith(`${id}#`)) e2.working = working;
        }
    }

    /** Live particle count and registered emitters, for the debug stats. */
    stats(): { live: number; emitters: number; working: number; points: string[] } {
        let live = 0;
        for (const p of this.parts) if (p.alive) live++;
        let working = 0;
        const points: string[] = [];
        for (const [key, e] of this.emitters) {
            if (e.working) working++;
            points.push(`${key}:${e.item ? "item" : e.sparks ? "spark" : "smoke"}@${e.x.toFixed(2)},${e.y.toFixed(2)},${e.z.toFixed(2)}`);
        }
        return { live, emitters: this.emitters.size, working, points };
    }

    /** Whether an emitter is registered under this id (machines that smoke, not every placed model). */
    hasEmitter(id: string): boolean {
        return this.emitters.has(id);
    }

    setDensity(d: number): void {
        this.density = Math.max(0, Math.min(1, d));
    }

    setEnabled(on: boolean): void {
        this.enabled = on;
    }

    setWind(strength: number): void {
        this.wind = strength;
    }

    /**
     * One-shot burst at a point (world units). "place" throws brass sparks, "remove" lets out a grey
     * puff, "milestone" throws a tall gold fountain. Uses the same pool, so bursts cost no extra draws.
     */
    burst(x: number, y: number, z: number, kind: BurstKind): void {
        if (!this.enabled) return;
        const n = BURST_COUNT[kind];
        for (let i = 0; i < n; i++) {
            const slot = this.parts.findIndex((p) => !p.alive);
            if (slot < 0) return;
            const p = this.parts[slot];
            const a = Math.random() * Math.PI * 2;
            const spread = kind === "milestone" ? 1.6 : 0.9;
            p.alive = true;
            p.x = x;
            p.y = y;
            p.z = z;
            p.age = 0;
            if (kind === "remove") {
                // Grey puff: slow, wide, rising.
                p.kind = 0;
                p.vx = Math.cos(a) * 0.35;
                p.vz = Math.sin(a) * 0.35;
                p.vy = 0.3 + Math.random() * 0.2;
                p.life = 1.4 + Math.random() * 0.6;
                p.size = 0.12;
            } else {
                // Sparks: fast, fall under gravity, short life.
                p.kind = 1;
                const up = kind === "milestone" ? 2.6 : 1.5;
                p.vx = Math.cos(a) * spread * (0.5 + Math.random() * 0.8);
                p.vz = Math.sin(a) * spread * (0.5 + Math.random() * 0.8);
                p.vy = up * (0.6 + Math.random() * 0.6);
                p.life = (kind === "milestone" ? 1.1 : 0.45) + Math.random() * 0.3;
                p.size = kind === "milestone" ? 0.05 : 0.035;
            }
        }
    }

    update(dt: number): void {
        const live = this.enabled && this.density > 0;
        if (live) {
            for (const e of this.emitters.values()) {
                if (!e.working) continue;
                e.acc += dt * this.density;
                const rate = e.item ? ITEM_RATE : e.sparks ? SPARK_RATE : SMOKE_RATE;
                while (e.acc >= 1 / rate) {
                    e.acc -= 1 / rate;
                    if (e.item) this.spawnItem(e);
                    else this.spawn(e);
                }
            }
        }
        const drift = (this.wind - 0.5) * 0.6;
        for (let i = 0; i < POOL; i++) {
            const p = this.parts[i];
            if (!p.alive) continue;
            p.age += dt;
            if (p.age >= p.life) {
                p.alive = false;
                this.hide(i);
                continue;
            }
            if (p.kind === 1) p.vy -= 3.2 * dt; // sparks fall
            else if (p.kind === 2) p.vy -= 1.2 * dt; // item pieces drop a little as they slide off
            else p.vx += drift * dt; // smoke drifts with the wind
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            const k = p.age / p.life;
            const grow = p.kind === 0 ? 1 + k * 1.6 : 1 - k * 0.7;
            this.writeInstance(i, p, k, grow);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }

    dispose(): void {
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
        this.mesh.dispose();
        this.mesh.removeFromParent();
        this.emitters.clear();
    }

    private spawnItem(e: { x: number; y: number; z: number; dx?: number; dz?: number }): void {
        const slot = this.parts.findIndex((p) => !p.alive);
        if (slot < 0) return;
        const p = this.parts[slot];
        p.alive = true;
        p.kind = 2;
        p.age = 0;
        p.x = e.x;
        p.y = e.y;
        p.z = e.z;
        const speed = 0.9 + Math.random() * 0.3;
        p.vx = (e.dx ?? 0) * speed;
        p.vz = (e.dz ?? 0) * speed;
        p.vy = 0.35;
        p.life = 0.9 + Math.random() * 0.3;
        p.size = 0.16;
    }

    private spawn(e: { x: number; y: number; z: number; sparks: boolean }): void {
        const slot = this.parts.findIndex((p) => !p.alive);
        if (slot < 0) return;
        const p = this.parts[slot];
        const kind: 0 | 1 = e.sparks && Math.random() < 0.6 ? 1 : 0;
        p.alive = true;
        p.kind = kind;
        p.age = 0;
        p.x = e.x + (Math.random() - 0.5) * 0.08;
        p.y = e.y;
        p.z = e.z + (Math.random() - 0.5) * 0.08;
        if (kind === 1) {
            p.vx = (Math.random() - 0.5) * 1.2;
            p.vy = 1.4 + Math.random() * 1.2;
            p.vz = (Math.random() - 0.5) * 1.2;
            p.life = 0.5 + Math.random() * 0.35;
            p.size = 0.035;
        } else {
            p.vx = 0;
            p.vy = 0.35 + Math.random() * 0.15;
            p.vz = 0;
            p.life = 2.2 + Math.random() * 0.8;
            p.size = 0.09;
        }
    }

    private writeInstance(i: number, p: Particle, k: number, grow: number): void {
        const size = p.size * grow;
        this.s.set(size, size, size);
        this.p.set(p.x, p.y, p.z);
        this.m.compose(this.p, this.q, this.s);
        this.mesh.setMatrixAt(i, this.m);
        if (p.kind === 1) this.c.copy(SPARK_COLOR).lerp(SPARK_COLOR_END, k);
        else if (p.kind === 2) this.c.copy(ITEM_COLOR).lerp(ITEM_COLOR_END, k);
        else this.c.copy(SMOKE_COLOR).lerp(SMOKE_COLOR_END, k);
        this.mesh.setColorAt(i, this.c);
    }

    private hide(i: number): void {
        this.s.set(0, 0, 0);
        this.p.set(0, -999, 0);
        this.m.compose(this.p, this.q, this.s);
        this.mesh.setMatrixAt(i, this.m);
    }
}
