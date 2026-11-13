// Seeded random and the smooth height function that shapes the island.

export function makeRandom(seed: number): () => number {
    // Park-Miller, same generator the design thread's reference uses, so layouts match its look.
    let s = Math.max(1, Math.floor(seed)) % 2147483647;
    return () => {
        s = (s * 16807) % 2147483647;
        return s / 2147483647;
    };
}

/** Cheap deterministic hash in 0..1 for a cell, used for per-block color jitter. */
export function cellHash(i: number, j: number, k: number): number {
    let h = (i * 374761393 + j * 668265263 + k * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Gentle rolling noise used for the coastline and the hills. */
export function rollingNoise(x: number, z: number): number {
    return (
        Math.sin(x * 0.31) * Math.cos(z * 0.27) * 0.5 +
        Math.sin(x * 0.73 + z * 0.41) * 0.25 +
        Math.sin(z * 0.9 - x * 0.5) * 0.12
    );
}
