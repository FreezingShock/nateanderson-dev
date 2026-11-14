// Ambient life and reward moments for the Brasswork island: falling leaves on the wind, birds by
// day, fireflies by night, chimney smoke and steam from working machines, shoreline glints and
// jumping fish, passing drizzle, and celebration bursts for milestones, research, unlocks and hub
// deliveries. Everything is a handful of instanced pools (one draw call each), so the whole layer
// costs about nine draw calls. Machine smoke itself lives in render/index.ts (Visuals thread);
// setEmitters here is for extra sources such as a future workshop chimney.
// (Old note:) costs about nine draw calls.
// the rest of the ambient motion.
//
// Hooks into the renderer: VoxelIsland.scene and VoxelIsland.onFrame (lib/automation/render/index.ts).
import * as THREE from "three";
import { WATER_LEVEL, PLATEAU_HALF_X, PLATEAU_HALF_Z } from "../config";
import { ParticlePool } from "./pool";

export type BurstKind = "milestone" | "research" | "unlock" | "delivery";

export interface Emitter {
    x: number;
    y: number;
    z: number;
    /** smoke: grey coal smoke (kilns, furnaces). steam: white puffs (presses, everything else). */
    kind: "smoke" | "steam";
}

export interface FrameInfo {
    time: number;
    /** 0..1 day clock, 0.5 dusk, 0.75 deep night. */
    timeOfDay: number;
    /** 0..1 wind strength, 0.5 baseline. */
    wind: number;
    lowFx: boolean;
}

export interface LifeHost {
    readonly scene: THREE.Scene;
    onFrame(fn: (dt: number, info: FrameInfo) => void): () => void;
}

export interface IslandLife {
    /** Chimney sources for this frame. Call whenever the working set changes; cheap to call often. */
    setEmitters(list: readonly Emitter[]): void;
    /** A celebration at a world position (board centre is 0, 0). */
    burst(kind: BurstKind, x: number, z: number, y?: number): void;
    /** Force drizzle on (0..1) or hand it back to the slow weather clock with null. */
    setRain(v: number | null): void;
    setLowFx(on: boolean): void;
    /** Live particle counts, for tests and the bench. */
    stats(): Record<string, number>;
    dispose(): void;
}

const LEAF_HEX = [0xc8642a, 0xe0a23a, 0xa8452a, 0xd9822b, 0xb8572c];
const BURST_HEX: Record<BurstKind, number[]> = {
    milestone: [0xffd070, 0xf3b23c, 0xfff1c2, 0xd98f2a],
    research: [0x7fe0c8, 0x58b09a, 0xd8fff4, 0xffd070],
    unlock: [0xfff1c2, 0xffd070, 0xe8c48a],
    delivery: [0xf3b23c, 0xffd070],
};

const smooth = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};
const pick = <T,>(a: readonly T[]) => a[(Math.random() * a.length) | 0];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** 0 at noon, 1 at deep night, from the renderer's day clock. */
export function nightness(t: number): number {
    return 0.5 - 0.5 * Math.cos(2 * Math.PI * (((t % 1) + 1) % 1 - 0.25));
}

export function attachLife(
    host: LifeHost,
    heightAt: (x: number, z: number) => number,
    opts: { lowFx?: boolean } = {}
): IslandLife {
    const group = new THREE.Group();
    group.name = "island-life";
    host.scene.add(group);

    const leaves = new ParticlePool({ capacity: 110, drag: 0.6, curve: "const" });
    const smoke = new ParticlePool({ capacity: 180, drag: 0.7, curve: "grow", opacity: 0.5, renderOrder: 3 });
    const flies = new ParticlePool({ capacity: 70, curve: "pulse", additive: true, renderOrder: 4 });
    const glints = new ParticlePool({ capacity: 90, curve: "pulse", additive: true, renderOrder: 4 });
    const drops = new ParticlePool({ capacity: 120, gravity: -9, curve: "shrink" });
    const rain = new ParticlePool({ capacity: 320, curve: "const", stretchY: 7, opacity: 0.55, renderOrder: 3 });
    const sparks = new ParticlePool({ capacity: 420, gravity: -3.2, drag: 0.35, curve: "shrink", renderOrder: 5 });
    const ring = new ParticlePool({ capacity: 160, drag: 0.15, curve: "shrink", additive: true, renderOrder: 5 });
    const pools = { leaves, smoke, flies, glints, drops, rain, sparks, ring };
    for (const p of Object.values(pools)) group.add(p.mesh);

    // Birds: body plus two wings per bird, flapping as they circle the island.
    const BIRDS = 7;
    const birdMesh = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({ color: 0x2b2622, fog: false }),
        BIRDS * 3
    );
    birdMesh.frustumCulled = false;
    birdMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(birdMesh);
    const birds = Array.from({ length: BIRDS }, (_, i) => ({
        cx: rand(-10, 10),
        cz: rand(-8, 8),
        r: rand(9, 17),
        h: rand(6.5, 10.5),
        speed: rand(0.09, 0.16) * (i % 2 ? 1 : -1),
        phase: rand(0, 6.28),
        flap: rand(6, 9),
    }));

    // Shoreline sample points: where the terrain meets the water, for glints and fish.
    const shore: [number, number][] = [];
    for (let a = 0; a < 360; a += 3) {
        const rad = (a * Math.PI) / 180;
        const dx = Math.cos(rad) * 1.2, dz = Math.sin(rad) * 0.95;
        for (let r = 8; r < 32; r += 0.25) {
            if (heightAt(dx * r, dz * r) < WATER_LEVEL) {
                shore.push([dx * (r + 0.6), dz * (r + 0.6)]);
                break;
            }
        }
    }
    // Grass ring around the plateau where fireflies wander: off the factory floor, above water.
    const meadow: [number, number][] = [];
    for (let i = 0; meadow.length < 140 && i < 4000; i++) {
        const x = rand(-22, 22), z = rand(-17, 17);
        if (Math.abs(x) < PLATEAU_HALF_X + 0.4 && Math.abs(z) < PLATEAU_HALF_Z + 0.4) continue;
        if (heightAt(x, z) < WATER_LEVEL + 0.3) continue;
        meadow.push([x, z]);
    }

    let lowFx = opts.lowFx ?? false;
    let emitters: readonly Emitter[] = [];
    const emitAcc = new Map<number, number>();
    let leafAcc = 0;
    let glintAcc = 0;
    let rainAcc = 0;
    let flyAcc = 0;
    let fishTimer = rand(4, 9);
    let rainOverride: number | null = null;
    let rainLevel = 0;
    let windNow = 0.5;
    let timeNow = 0;
    const pending: { at: number; x: number; z: number; n: number }[] = [];

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();

    const splash = (x: number, z: number, n: number) => {
        for (let i = 0; i < n; i++) {
            const a = rand(0, 6.28), sp = rand(0.4, 1.3);
            drops.spawn(x, WATER_LEVEL + 0.05, z, Math.cos(a) * sp, rand(1.6, 3), Math.sin(a) * sp, rand(0.35, 0.6), rand(0.04, 0.07), 0xdff6ff);
        }
    };

    // Slow weather clock: a drizzle drifts through every few minutes and lasts under a minute.
    const weather = (t: number) => {
        const w = Math.sin(t * 0.021) * 0.6 + Math.sin(t * 0.0137 + 2) * 0.4;
        return smooth(0.62, 0.85, w);
    };

    const off = host.onFrame((dt, info) => {
        timeNow += dt;
        windNow = info.wind;
        const night = nightness(info.timeOfDay);
        const day = 1 - night;
        const calm = lowFx || info.lowFx;
        const wind = windNow;
        const windX = 0.5 + wind * 2.2;
        const windZ = 0.25 + wind * 0.6;

        // Daylight tint: particles that are lit by the sun dim toward blue at night.
        const lit = 0.45 + 0.55 * day;
        leaves.tint = lit;
        smoke.tint = 0.35 + 0.65 * day;
        drops.tint = lit;
        rain.tint = 0.5 + 0.5 * day;

        // Smoke and steam: kept in low fx at half rate, since it reads which machines are working.
        const rate = calm ? 1.4 : 3;
        emitters.forEach((em, i) => {
            const acc = (emitAcc.get(i) ?? rand(0, 1)) + dt * rate;
            const n = Math.floor(acc);
            emitAcc.set(i, acc - n);
            for (let k = 0; k < n; k++) {
                const steam = em.kind === "steam";
                smoke.spawn(
                    em.x + rand(-0.05, 0.05), em.y, em.z + rand(-0.05, 0.05),
                    rand(-0.05, 0.05), steam ? rand(0.9, 1.3) : rand(0.5, 0.8), rand(-0.05, 0.05),
                    steam ? rand(1.2, 1.8) : rand(2.6, 3.6),
                    steam ? rand(0.1, 0.14) : rand(0.12, 0.18),
                    steam ? pick([0xf4efe6, 0xe8e2d6]) : pick([0x6d6660, 0x7d756d, 0x5a544f])
                );
            }
        });
        smoke.update(dt, (_i, p, out) => out.set(windX * 0.35, 0, windZ * 0.35));

        if (!calm) {
            // Leaves shake loose faster in a gust and drift with the wind, fluttering side to side.
            leafAcc += dt * (2 + wind * wind * 22);
            while (leafAcc >= 1) {
                leafAcc -= 1;
                const [x, z] = pick(meadow);
                leaves.spawn(x - 3, heightAt(x, z) + rand(2.4, 4.2), z, rand(0.2, 0.6), rand(-0.6, -0.35), rand(-0.2, 0.2), rand(5, 8), rand(0.06, 0.09), pick(LEAF_HEX));
            }
            leaves.update(dt, (i, p, out) => {
                const ph = timeNow * 3 + i * 1.7;
                out.set(windX * 0.55 + Math.sin(ph) * 0.35, Math.sin(ph * 1.3) * 0.2, windZ * 0.4 + Math.cos(ph * 0.8) * 0.3);
                const x = p[i * 3], z = p[i * 3 + 2];
                const floor = Math.max(heightAt(x, z), WATER_LEVEL) + 0.04;
                if (p[i * 3 + 1] < floor) {
                    p[i * 3 + 1] = floor;
                    out.set(0, 0, 0);
                }
            });

            // Fireflies: a slow swarm over the meadows once dusk falls.
            const flyGoal = smooth(0.5, 0.72, night) * flies.capacity;
            flyAcc += dt * (flyGoal > flies.liveCount ? 10 : 0);
            while (flyAcc >= 1) {
                flyAcc -= 1;
                const [x, z] = pick(meadow);
                flies.spawn(x, heightAt(x, z) + rand(0.25, 1.2), z, 0, 0, 0, rand(3, 6), rand(0.08, 0.12), pick([0xffe37a, 0xfff2a8, 0xd8f07a]));
            }
            flies.update(dt, (i, _p, out) => {
                const ph = timeNow * 0.9 + i * 2.3;
                out.set(Math.sin(ph) * 0.35, Math.sin(ph * 1.7) * 0.18, Math.cos(ph * 0.7) * 0.35);
            });

            // Shoreline glints catch the sun by day and the moon, fainter, by night.
            glintAcc += dt * (5 + 10 * day);
            while (glintAcc >= 1 && shore.length) {
                glintAcc -= 1;
                const [x, z] = pick(shore);
                const out = rand(0, 3);
                const len = Math.hypot(x, z) || 1;
                glints.spawn(x + (x / len) * out, WATER_LEVEL + 0.03, z + (z / len) * out, 0, 0, 0, rand(0.5, 1.1), rand(0.05, 0.1), day > 0.5 ? 0xfff6d8 : 0x8fb4d8);
            }
            glints.update(dt);

            // A fish leaps from the shallows every few seconds by day.
            fishTimer -= dt;
            if (fishTimer <= 0 && shore.length) {
                fishTimer = rand(5, 12);
                if (day > 0.3) {
                    const [sx, sz] = pick(shore);
                    const len = Math.hypot(sx, sz) || 1;
                    const x = sx + (sx / len) * rand(1, 4), z = sz + (sz / len) * rand(1, 4);
                    const a = rand(0, 6.28), sp = rand(0.6, 1);
                    const vy = rand(2.6, 3.4);
                    const air = (2 * vy) / 9;
                    drops.spawn(x, WATER_LEVEL, z, Math.cos(a) * sp, vy, Math.sin(a) * sp, air, 0.13, pick([0x8fa6b0, 0xc9824a, 0xa7b9a0]));
                    splash(x, z, 6);
                    pending.push({ at: timeNow + air, x: x + Math.cos(a) * sp * air, z: z + Math.sin(a) * sp * air, n: 8 });
                }
            }
            for (let i = pending.length - 1; i >= 0; i--) {
                if (pending[i].at <= timeNow) {
                    splash(pending[i].x, pending[i].z, pending[i].n);
                    pending.splice(i, 1);
                }
            }

            // Drizzle over the board, slanted by the wind.
            rainLevel += ((rainOverride ?? weather(info.time)) - rainLevel) * Math.min(1, dt * 0.5);
            rainAcc += dt * rainLevel * 260;
            while (rainAcc >= 1) {
                rainAcc -= 1;
                const x = rand(-16, 14), z = rand(-13, 13);
                rain.spawn(x, rand(9, 12), z, windX * 0.8, -12, windZ * 0.4, 1.1, 0.025, 0xa8c8dc);
            }
            rain.update(dt, (i, p, out) => {
                const x = p[i * 3], z = p[i * 3 + 2];
                if (p[i * 3 + 1] < Math.max(heightAt(x, z), WATER_LEVEL)) {
                    p[i * 3 + 1] = -50; // hidden below the island until its slot recycles
                    if (Math.random() < 0.08) drops.spawn(x, Math.max(heightAt(x, z), WATER_LEVEL) + 0.03, z, rand(-0.3, 0.3), 1.2, rand(-0.3, 0.3), 0.25, 0.035, 0xcfe4f0);
                }
                out.set(0, 0, 0);
            });
            drops.update(dt);

            // Birds: circle by day and roost (shrink away) as night falls.
            const show = smooth(0.75, 0.45, night);
            for (let b = 0; b < BIRDS; b++) {
                const bd = birds[b];
                const ang = bd.phase + timeNow * bd.speed;
                const x = bd.cx + Math.cos(ang) * bd.r;
                const z = bd.cz + Math.sin(ang) * bd.r * 0.8;
                const y = bd.h + Math.sin(timeNow * 0.6 + b) * 0.4;
                const heading = Math.atan2(Math.cos(ang) * 0.8 * Math.sign(bd.speed), -Math.sin(ang) * Math.sign(bd.speed));
                const flap = Math.sin(timeNow * bd.flap + b) * 0.7;
                const sc = show * 0.11;
                e.set(0, heading, 0);
                q.setFromEuler(e);
                v.set(x, y, z);
                birdMesh.setMatrixAt(b * 3, m.compose(v, q, s.set(sc * 0.9, sc * 0.8, sc * 2.2)));
                for (const side of [-1, 1]) {
                    e.set(0, heading, side * flap);
                    q.setFromEuler(e);
                    const ox = Math.cos(heading) * side * sc * 1.6;
                    const oz = -Math.sin(heading) * side * sc * 1.6;
                    v.set(x + ox, y + Math.sin(flap) * side * sc * 0.4, z + oz);
                    birdMesh.setMatrixAt(b * 3 + (side < 0 ? 1 : 2), m.compose(v, q, s.set(sc * 2.6, sc * 0.3, sc * 1.1)));
                }
            }
            birdMesh.instanceMatrix.needsUpdate = true;
            birdMesh.visible = show > 0.01;
        } else {
            birdMesh.visible = false;
        }

        sparks.update(dt);
        ring.update(dt);
    });

    const hideAmbient = () => {
        leaves.clear();
        flies.clear();
        glints.clear();
        drops.clear();
        rain.clear();
        pending.length = 0;
        birdMesh.visible = false;
    };
    if (lowFx) hideAmbient();

    return {
        setEmitters(list) {
            emitters = list.slice(0, 16);
        },
        burst(kind, x, z, y) {
            const base = y ?? Math.max(0, heightAt(x, z)) + 2.2;
            const scale = lowFx ? 0.5 : 1;
            const hex = BURST_HEX[kind];
            const big = kind === "milestone";
            const n = Math.round((big ? 150 : kind === "research" ? 80 : kind === "unlock" ? 60 : 16) * scale);
            // Fountain of brass sparks.
            for (let i = 0; i < n; i++) {
                const a = rand(0, 6.28);
                const sp = kind === "delivery" ? rand(0.3, 0.9) : rand(0.8, big ? 3.2 : 2.2);
                sparks.spawn(x, base, z, Math.cos(a) * sp, kind === "delivery" ? rand(1.2, 2.2) : rand(2.5, big ? 6.5 : 4.5), Math.sin(a) * sp, rand(0.8, big ? 2 : 1.4), rand(0.08, big ? 0.2 : 0.12), pick(hex));
            }
            if (kind === "delivery") return;
            // A flat ring that rolls out across the floor, then a rising column for milestones.
            const rn = Math.round((big ? 64 : 40) * scale);
            for (let i = 0; i < rn; i++) {
                const a = (i / rn) * 6.28;
                const sp = big ? 5.5 : 3.6;
                ring.spawn(x, 0.12, z, Math.cos(a) * sp, 0, Math.sin(a) * sp, big ? 1.3 : 0.9, 0.18, hex[0]);
            }
            if (big)
                for (let i = 0; i < 40 * scale; i++)
                    ring.spawn(x + rand(-0.25, 0.25), base + rand(-0.5, 0.5), z + rand(-0.25, 0.25), 0, rand(3, 7), 0, rand(1, 1.8), rand(0.07, 0.12), pick(hex));
        },
        setRain(r) {
            rainOverride = r === null ? null : Math.min(1, Math.max(0, r));
        },
        setLowFx(on) {
            if (on && !lowFx) hideAmbient();
            lowFx = on;
        },
        stats() {
            const out: Record<string, number> = { birds: birdMesh.visible ? BIRDS : 0, rain: rainLevel };
            for (const [k, p] of Object.entries(pools)) out[k] = p.liveCount;
            return out;
        },
        dispose() {
            off();
            host.scene.remove(group);
            for (const p of Object.values(pools)) p.dispose();
            birdMesh.geometry.dispose();
            (birdMesh.material as THREE.Material).dispose();
        },
    };
}
