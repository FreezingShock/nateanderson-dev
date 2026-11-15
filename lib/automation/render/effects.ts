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
    kind: 0 | 1 | 2 | 3 | 4; // 0 smoke, 1 spark, 2 steam, 3 dust, 4 rubble
    /** Ground height for rubble bounces. */
    gy: number;
    /** Per-particle colour start (dust and rubble vary). */
    tint: number;
}

const POOL = 480;
export type BurstKind = "place" | "remove" | "milestone";
const BURST_COUNT: Record<BurstKind, number> = { place: 30, remove: 20, milestone: 60 };
/** Dust ring voxels per burst, and rubble chunks thrown by a removal. */
const RING_COUNT = 22;
const RUBBLE_COUNT = 16;
const DUST_HEX = [0xc9a878, 0xb08a5c, 0xd8bc8c];
const RUBBLE_HEX = [0x6b5238, 0x8a6a44, 0xb5793a, 0x5e5650, 0xd4a24c];
const DUST_END = new THREE.Color(0x8a7458);
const SMOKE_RATE = 5; // puffs per second per working smoking machine, at full density
const SPARK_RATE = 7;
const STEAM_RATE = 1.6; // light white puffs from every other working machine, so a busy island reads at default zoom
const STEAM_COLOR = new THREE.Color(0xf4efe2);
const STEAM_COLOR_END = new THREE.Color(0xb9b3a6);
const SMOKE_COLOR = new THREE.Color(0x8a8078);
const SMOKE_COLOR_END = new THREE.Color(0x4a4440);
const SPARK_COLOR = new THREE.Color(0xffc060);
const SPARK_COLOR_END = new THREE.Color(0xff6a2a);

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
            steam: boolean;
            working: boolean;
            acc: number;
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
                gy: 0,
                tint: 0,
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
    setEmitter(id: string, x: number, y: number, z: number, sparks: boolean, steam = false): void {
        this.emitters.set(id, { x, y, z, sparks, steam, working: false, acc: 0 });
    }

    removeEmitter(id: string): void {
        this.emitters.delete(id);
    }

    clearEmitters(): void {
        this.emitters.clear();
    }

    /** Set working state for an emitter. Idle emitters stop spawning; live puffs finish. */
    setWorking(id: string, working: boolean): void {
        const e = this.emitters.get(id);
        if (e) e.working = working;
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
        // A dust ring rolls out across the ground under every place and remove.
        if (kind !== "milestone") {
            for (let i = 0; i < RING_COUNT; i++) {
                const a = (i / RING_COUNT) * Math.PI * 2 + Math.random() * 0.2;
                const sp = kind === "remove" ? 1.5 : 1.9;
                const p = this.take();
                if (!p) break;
                p.kind = 3;
                p.x = x + Math.cos(a) * 0.35;
                p.z = z + Math.sin(a) * 0.35;
                p.y = y - 0.08;
                p.vx = Math.cos(a) * sp * (0.8 + Math.random() * 0.4);
                p.vz = Math.sin(a) * sp * (0.8 + Math.random() * 0.4);
                p.vy = 0.12 + Math.random() * 0.1;
                p.life = 0.75 + Math.random() * 0.3;
                p.size = 0.07 + Math.random() * 0.04;
                p.tint = DUST_HEX[i % DUST_HEX.length];
            }
        }
        // Removal throws chunks of the building that bounce once and settle.
        if (kind === "remove") {
            for (let i = 0; i < RUBBLE_COUNT; i++) {
                const a = Math.random() * Math.PI * 2;
                const sp = 0.6 + Math.random() * 1.1;
                const p = this.take();
                if (!p) break;
                p.kind = 4;
                p.x = x + (Math.random() - 0.5) * 0.5;
                p.z = z + (Math.random() - 0.5) * 0.5;
                p.y = y + 0.2 + Math.random() * 0.4;
                p.gy = y - 0.1;
                p.vx = Math.cos(a) * sp;
                p.vz = Math.sin(a) * sp;
                p.vy = 1.6 + Math.random() * 1.4;
                p.life = 1.2 + Math.random() * 0.4;
                p.size = 0.05 + Math.random() * 0.05;
                p.tint = RUBBLE_HEX[Math.floor(Math.random() * RUBBLE_HEX.length)];
            }
        }
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
                p.size = 0.2;
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
                const rate = e.steam ? STEAM_RATE : e.sparks ? SPARK_RATE : SMOKE_RATE;
                while (e.acc >= 1 / rate) {
                    e.acc -= 1 / rate;
                    this.spawn(e);
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
            else if (p.kind === 3) {
                // Dust slows as it rolls out.
                const drag = Math.exp(-dt * 3.2);
                p.vx *= drag;
                p.vz *= drag;
                p.vy *= drag;
            } else if (p.kind === 4) {
                p.vy -= 7.5 * dt;
                if (p.y < p.gy && p.vy < 0) {
                    // One bounce, then it skids to rest.
                    p.y = p.gy;
                    p.vy = Math.abs(p.vy) > 1.2 ? -p.vy * 0.35 : 0;
                    p.vx *= 0.5;
                    p.vz *= 0.5;
                }
            } else p.vx += drift * dt; // smoke drifts with the wind
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            const k = p.age / p.life;
            const grow =
                p.kind === 1
                    ? 1 - k * 0.7
                    : p.kind === 4
                      ? k > 0.75 ? (1 - k) * 4 : 1 // rubble shrinks away at the end
                      : p.kind === 3
                        ? 1 + k * 1.2 - k * k
                        : 1 + k * 1.6;
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

    /** Claims a free particle and resets its clock, or null when the pool is full. */
    private take(): Particle | null {
        const slot = this.parts.findIndex((p) => !p.alive);
        if (slot < 0) return null;
        const p = this.parts[slot];
        p.alive = true;
        p.age = 0;
        return p;
    }

    private spawn(e: { x: number; y: number; z: number; sparks: boolean; steam: boolean }): void {
        const slot = this.parts.findIndex((p) => !p.alive);
        if (slot < 0) return;
        const p = this.parts[slot];
        // Kind 2 is steam: rises and grows like smoke, but white.
        const kind: 0 | 1 | 2 = e.steam ? 2 : e.sparks && Math.random() < 0.6 ? 1 : 0;
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
        if (p.kind === 3) this.c.setHex(p.tint).lerp(DUST_END, k);
        else if (p.kind === 4) this.c.setHex(p.tint);
        else if (p.kind === 1) this.c.copy(SPARK_COLOR).lerp(SPARK_COLOR_END, k);
        else if (p.kind === 2) this.c.copy(STEAM_COLOR).lerp(STEAM_COLOR_END, k);
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
