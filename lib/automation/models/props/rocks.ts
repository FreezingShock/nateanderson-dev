// Rocks, cliffs and shoreline debris.
import { BARK, LOOK, STONE } from "./palette";
import { Vox, hash3, mix, noise3, rng, type PropModel } from "./vox";

function stonePaint(seed: number, base: number[] = [STONE.a, STONE.b, STONE.c, STONE.d]) {
    return (i: number, j: number, k: number) => {
        const n = noise3(i * 0.22, j * 0.22, k * 0.22, seed);
        const c = base[Math.min(base.length - 1, Math.floor(n * base.length))];
        return hash3(i, j, k, seed) < 0.06 ? mix(c, 0x2a2420, 0.35) : c;
    };
}

/** Moss on upward faces, lichen flecks on the sides. */
function weather(v: Vox, seed: number, moss = 0.6) {
    v.forEach((i, j, k, c) => {
        const up = !v.has(i, j + 1, k);
        if (up && noise3(i * 0.3, j * 0.3, k * 0.3, seed + 5) < moss * 0.75) c.c = hash3(i, j, k, seed) < 0.5 ? STONE.moss : STONE.mossD;
        else if (up) c.c = mix(c.c, STONE.light, 0.35);
        else if (hash3(i, j, k, seed + 2) < 0.04) c.c = STONE.lichen;
    });
}

/** Boulder: a lumpy, squashed stone half sunk in the ground. */
export function boulder(seed: number, size = 1): PropModel {
    const R = rng(seed * 59 + 3);
    const v = new Vox(`rock.boulder.${seed}${size !== 1 ? "." + size : ""}`);
    const r = (3 + R() * 3) * size;
    v.ellipsoid(0, r * 0.35, 0, r * (1 + R() * 0.3), r * (0.65 + R() * 0.2), r * (0.85 + R() * 0.3), stonePaint(seed), 0.35, seed);
    if (R() < 0.6) v.ellipsoid(r * 0.7, r * 0.15, r * 0.4, r * 0.5, r * 0.4, r * 0.5, stonePaint(seed + 1), 0.3, seed + 1, { keep: true });
    // Sink into the ground: drop everything below y 0.
    const below: [number, number, number][] = [];
    v.forEach((i, j, k) => { if (j < 0) below.push([i, j, k]); });
    for (const [i, j, k] of below) v.del(i, j, k);
    weather(v, seed, R() * 0.8);
    return v.build({ ao: 0.6 });
}

/** A scatter of small stones, nice along paths and the shore. */
export function pebbles(seed: number): PropModel {
    const R = rng(seed * 61 + 5);
    const v = new Vox(`rock.pebbles.${seed}`);
    for (let n = 0; n < 7 + Math.floor(R() * 6); n++) {
        const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 6;
        const x = Math.cos(a) * d, z = Math.sin(a) * d, r = 0.8 + R() * 1.4;
        v.ellipsoid(x, 0, z, r * 1.2, r * 0.7, r, stonePaint(seed + n, [STONE.a, STONE.c, STONE.light, STONE.b]), 0.2, seed + n, { keep: true });
    }
    const below: [number, number, number][] = [];
    v.forEach((i, j, k) => { if (j < 0) below.push([i, j, k]); });
    for (const [i, j, k] of below) v.del(i, j, k);
    return v.build({ ao: 0.3 });
}

/**
 * Cliff chunk: a tall, layered outcrop with ledges, for steep hill sides and
 * the sea edge. Strata bands give it a geological read.
 */
export function cliff(seed: number): PropModel {
    const R = rng(seed * 67 + 1);
    const v = new Vox(`rock.cliff.${seed}`);
    const w = 10 + R() * 6, d = 7 + R() * 4, h = 14 + R() * 10;
    const strata = (_i: number, j: number, k: number) => {
        const band = Math.floor((j + noise3(_i * 0.1, 0, k * 0.1, seed) * 3) / 3) % 3;
        const c = [STONE.strataA, STONE.strataB, STONE.strataC][band < 0 ? band + 3 : band];
        return hash3(_i, j, k, seed) < 0.07 ? mix(c, 0x2a2420, 0.3) : c;
    };
    for (let j = 0; j < h; j++) {
        const t = j / h;
        // Ledges: every few bands the face steps in.
        const step = Math.floor(j / 4) * 0.7;
        const rx = w * (1 - t * 0.45) - step * 0.4, rz = d * (1 - t * 0.35) - step * 0.3;
        for (let i = Math.floor(-rx - 2); i <= Math.ceil(rx + 2); i++)
            for (let k = Math.floor(-rz - 2); k <= Math.ceil(rz + 2); k++) {
                const e = Math.pow(Math.abs(i + 0.5) / rx, 2.5) + Math.pow(Math.abs(k + 0.5) / rz, 2.5);
                const lim = 1 + (noise3(i * 0.25, j * 0.12, k * 0.25, seed) - 0.5) * 0.7;
                if (e <= lim) v.set(i, j, k, strata);
            }
    }
    weather(v, seed, 0.9);
    // Grass tufts and a little shrub on the top ledge.
    v.forEach((i, j, k, c) => {
        if (!v.has(i, j + 1, k) && j > h * 0.5 && hash3(i, j, k, seed + 8) < 0.12) c.c = LOOK.grass[Math.floor(hash3(k, i, j, seed) * 4)];
    });
    return v.build({ ao: 0.7 });
}

/** Flat slab rock, good as a stepping stone or a sitting stone by the water. */
export function slab(seed: number): PropModel {
    const R = rng(seed * 71 + 4);
    const v = new Vox(`rock.slab.${seed}`);
    const rx = 4 + R() * 3, rz = 3 + R() * 2;
    v.ellipsoid(0, 0.5, 0, rx, 1.6, rz, stonePaint(seed, [STONE.c, STONE.a, STONE.light]), 0.25, seed);
    const below: [number, number, number][] = [];
    v.forEach((i, j, k) => { if (j < 0) below.push([i, j, k]); });
    for (const [i, j, k] of below) v.del(i, j, k);
    weather(v, seed, 0.3);
    return v.build({ ao: 0.4 });
}

/** Bleached driftwood log with a root end and broken branch stubs. */
export function driftwood(seed: number): PropModel {
    const R = rng(seed * 73 + 6);
    const v = new Vox(`shore.driftwood.${seed}`);
    const len = 14 + R() * 10, a = R() * 0.6 - 0.3;
    const paint = (i: number, j: number, k: number) => (noise3(i * 0.15, j * 0.8, k * 0.8, seed) > 0.6 ? BARK.driftD : hash3(i, j, k, seed) < 0.05 ? 0xd8ccb4 : BARK.drift);
    const x0 = -len / 2, x1 = len / 2;
    v.line([x0, 1.4, -Math.sin(a) * len / 2], [x1, 1.1, Math.sin(a) * len / 2], 1.5, 1.0, paint);
    // Root ball at one end.
    for (let n = 0; n < 6; n++) {
        const ang = R() * Math.PI * 2;
        v.line([x0, 1.4, -Math.sin(a) * len / 2], [x0 - 1.5 - R() * 2, 1.4 + Math.cos(ang) * 3, -Math.sin(a) * len / 2 + Math.sin(ang) * 3], 0.7, 0.4, paint);
    }
    for (let n = 0; n < 2 + Math.floor(R() * 2); n++) {
        const t = 0.2 + R() * 0.6, x = x0 + (x1 - x0) * t;
        v.line([x, 2, (t - 0.5) * Math.sin(a) * len], [x + R() * 2, 4 + R() * 2, (t - 0.5) * Math.sin(a) * len + (R() - 0.5) * 3], 0.6, 0.4, paint);
    }
    return v.build({ ao: 0.3 });
}

/** Shells and small stones on the sand. */
export function shells(seed: number): PropModel {
    const R = rng(seed * 79 + 2);
    const v = new Vox(`shore.shells.${seed}`);
    const cols = [0xf0dfb8, 0xf0c8b8, 0xe8d0a8, 0xf6f0e2, STONE.c];
    for (let n = 0; n < 8 + Math.floor(R() * 6); n++) {
        const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 7;
        const x = Math.cos(a) * d, z = Math.sin(a) * d, c = cols[Math.floor(R() * cols.length)];
        v.set(x, 0, z, c);
        if (R() < 0.5) v.set(x + 1, 0, z, mix(c, 0xb08070, 0.3));
    }
    return v.build({ ao: 0, lod: false });
}

/** A small rowboat pulled up on the sand, oars inside. */
export function rowboat(seed: number): PropModel {
    const v = new Vox(`shore.rowboat.${seed}`);
    const L = 9, Wd = 4;
    const plank = (i: number, j: number) => (j % 2 ? 0x8a5a32 : 0x7a4c2a) + (i % 6 === 0 ? 0 : 0);
    for (let i = -L; i <= L; i++) {
        const t = Math.abs(i) / L;
        const w = Wd * Math.sqrt(1 - t * t * 0.9);
        const hull = 3 + (t > 0.7 ? 1 : 0);
        for (let k = Math.floor(-w); k <= Math.ceil(w); k++) {
            const e = Math.abs(k) / w;
            const bot = Math.round(e * e * 2);
            for (let j = bot; j <= hull; j++) {
                const wall = Math.abs(k) >= Math.floor(w) || Math.abs(i) >= L - 1 || j === bot;
                if (wall) v.set(i, j, k, j === hull ? 0x5a3a22 : j <= 1 ? 0x2e5a7a : plank(i, j));
            }
        }
    }
    v.box(-1, 2, -3, 1, 3, 4, 0x6b4426); // seat
    v.line([-6, 2.5, -1], [6, 3, 1], 0.4, 0.4, 0xa06c3c); // oar
    v.box(5, 2, 0, 7, 3, 2, 0xa06c3c);
    return v.build({ ao: 0.4 });
}

/** A short jetty: planks on posts, sized to reach from the sand into shallow water. */
export function jetty(seed: number): PropModel {
    const v = new Vox(`shore.jetty.${seed}`);
    const L = 40, Wd = 8, deck = 14;
    for (let i = 0; i < L; i++)
        for (let k = -Wd / 2; k < Wd / 2; k++) {
            if (hash3(i, 0, k, seed) < 0.03) continue; // missing board
            v.set(k, deck, i, Math.floor(i / 2) % 2 ? 0x8a5a32 : hash3(i >> 1, 0, 0, seed) < 0.5 ? 0x9a6a3a : 0x7a4c2a);
        }
    for (let i = 3; i < L; i += 9)
        for (const k of [-Wd / 2 - 1, Wd / 2]) {
            for (let j = -4; j < deck + 4; j++) v.set(k, j, i, j < 2 ? mix(0x5a3a22, 0x3a4a30, 0.5) : 0x5a3a22);
        }
    v.box(-Wd / 2, deck - 1, 0, -Wd / 2 + 1, deck, L, 0x5a3a22);
    v.box(Wd / 2 - 1, deck - 1, 0, Wd / 2, deck, L, 0x5a3a22);
    // Rope coil and a bollard at the end.
    v.cyl(2, L - 3, deck + 1, deck + 3, 1, 0x5a3a22);
    v.ellipsoid(-2, deck + 1, L - 4, 1.6, 0.6, 1.6, 0xc8b080, 0, 0, { hollow: 0.5 });
    return v.build({ ao: 0.3 });
}

export const ROCKS = {
    boulder: (s: number) => boulder(s),
    bigBoulder: (s: number) => boulder(s, 1.8),
    pebbles, cliff, slab,
} as const;

export const SHORE = { driftwood, shells, rowboat, jetty } as const;
