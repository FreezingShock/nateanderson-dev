// Undergrowth: bushes, ferns, flower clumps, reeds and lily pads.
import { FLOWER, LEAF, STONE } from "./palette";
import { Vox, clamp, hash3, mix, noise3, rng, smooth, type PropModel } from "./vox";

const lowSway = (h: number) => (_i: number, j: number) => smooth(0, h, j) * 0.8;

/** Round bush; optional berries or blossoms dotted on the outside. */
export function bush(seed: number, dots?: "berry" | "blossom"): PropModel {
    const R = rng(seed * 19 + 4);
    const v = new Vox(`plant.bush${dots ? "." + dots : ""}.${seed}`);
    const r = 5.5 + R() * 3;
    const pal = seed % 3 === 0 ? LEAF.bush : LEAF.bushFall;
    const paint = (i: number, j: number, k: number) => pal[clamp(Math.floor(noise3(i * 0.3, j * 0.3, k * 0.3, seed) * 4.4 - 0.2), 0, 3)];
    const lobes = 2 + Math.floor(R() * 3);
    for (let n = 0; n < lobes; n++) {
        const a = R() * Math.PI * 2, d = n === 0 ? 0 : r * 0.6;
        const rr = n === 0 ? r : r * (0.6 + R() * 0.25);
        v.ellipsoid(Math.cos(a) * d, rr * 0.75, Math.sin(a) * d, rr, rr * 0.8, rr, paint, 0.3, seed + n, { keep: true });
    }
    // Light tops, darker skirt, and dots on the outer shell.
    const dot = dots === "berry" ? [0xc4362f, 0xa82a2a] : [FLOWER.rose, FLOWER.white, 0xf0b8c8];
    v.forEach((i, j, k, c) => {
        if (!v.has(i, j + 1, k)) c.c = mix(c.c, pal === LEAF.bush ? 0x8cbc52 : 0xe0a050, 0.3 + hash3(i, j, k, seed) * 0.25);
        const open = !v.has(i + 1, j, k) || !v.has(i - 1, j, k) || !v.has(i, j, k + 1) || !v.has(i, j, k - 1) || !v.has(i, j + 1, k);
        if (dots && open && j > 1 && hash3(i, j, k, seed + 5) < (dots === "berry" ? 0.07 : 0.12)) c.c = dot[Math.floor(hash3(k, i, j, seed) * dot.length)];
    });
    return v.build({ sway: (_i, j) => smooth(0, r * 2, j) * 0.45 });
}

/** Fern: arched fronds radiating from a crown, sits in shade under trees. */
export function fern(seed: number): PropModel {
    const R = rng(seed * 23 + 8);
    const v = new Vox(`plant.fern.${seed}`);
    const n = 6 + Math.floor(R() * 4);
    for (let f = 0; f < n; f++) {
        const a = (f / n) * Math.PI * 2 + R() * 0.5;
        const len = 9 + R() * 4, rise = 6 + R() * 3;
        const col = [0x4f8236, 0x5f9440, 0x3f6e2c][Math.floor(R() * 3)];
        for (let s = 0; s <= len * 2; s++) {
            const t = s / (len * 2);
            const x = Math.cos(a) * len * t, z = Math.sin(a) * len * t;
            const y = rise * Math.sin(t * Math.PI * 0.85) + 0.5;
            v.set(x, y, z, col, { keep: true });
            // Leaflets on both sides, shorter toward the tip.
            if (s % 2 === 0 && t > 0.15) {
                const w = Math.round((1 - t) * 3.2);
                for (let l = 1; l <= w; l++) {
                    v.set(x - Math.sin(a) * l, y - l * 0.3, z + Math.cos(a) * l, mix(col, 0x7bb04c, 0.25), { keep: true });
                    v.set(x + Math.sin(a) * l, y - l * 0.3, z - Math.cos(a) * l, mix(col, 0x7bb04c, 0.25), { keep: true });
                }
            }
        }
    }
    return v.build({ sway: (i, j, k) => clamp(Math.hypot(i, k) / 12, 0, 1) * 0.7 + smooth(0, 9, j) * 0.2, ao: 0.3 });
}

const HEADS = [FLOWER.cream, FLOWER.gold, FLOWER.ember, FLOWER.lavender, FLOWER.sky, FLOWER.rose, FLOWER.white];

/** A clump of wildflowers: stems, a few leaves and small heads. One or two colours per clump. */
export function flowers(seed: number): PropModel {
    const R = rng(seed * 29 + 6);
    const v = new Vox(`plant.flowers.${seed}`);
    const c1 = HEADS[Math.floor(R() * HEADS.length)], c2 = R() < 0.4 ? HEADS[Math.floor(R() * HEADS.length)] : c1;
    const n = 9 + Math.floor(R() * 9);
    for (let s = 0; s < n; s++) {
        const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 6;
        const x = Math.round(Math.cos(a) * d), z = Math.round(Math.sin(a) * d);
        const h = 6 + Math.floor(R() * 4);
        for (let j = 0; j < h; j++) v.set(x, j, z, j < 1 ? FLOWER.stemD : FLOWER.stem);
        if (R() < 0.7) { const sx = R() < 0.5 ? 1 : -1; v.set(x + sx, 2, z, FLOWER.stem); v.set(x + sx * 2, 3, z, FLOWER.stem); }
        const col = R() < 0.7 ? c1 : c2;
        const centre = col === FLOWER.white || col === FLOWER.cream ? FLOWER.gold : mix(col, 0x3a2010, 0.4);
        v.set(x, h, z, centre, { keep: false });
        if (R() < 0.75) {
            v.set(x + 1, h, z, col); v.set(x - 1, h, z, col); v.set(x, h, z + 1, col); v.set(x, h, z - 1, col);
        } else v.set(x, h + 1, z, col);
    }
    return v.build({ sway: lowSway(10), ao: 0.2 });
}

/** Lupin-like spikes: taller stalks crowded with small florets, good for meadow edges. */
export function spikes(seed: number): PropModel {
    const R = rng(seed * 37 + 2);
    const v = new Vox(`plant.spikes.${seed}`);
    const col = [FLOWER.lavender, FLOWER.sky, FLOWER.rose, FLOWER.gold][Math.floor(R() * 4)];
    const n = 4 + Math.floor(R() * 4);
    for (let s = 0; s < n; s++) {
        const x = Math.round((R() - 0.5) * 8), z = Math.round((R() - 0.5) * 8);
        const h = 9 + Math.floor(R() * 5);
        for (let j = 0; j < h; j++) v.set(x, j, z, FLOWER.stem);
        for (let j = h - 6; j < h + 1; j++) {
            const c = j === h ? mix(col, 0xffffff, 0.3) : hash3(x, j, z, seed) < 0.3 ? mix(col, 0x000000, 0.2) : col;
            v.set(x, j, z, c);
            if (j < h - 1) { v.set(x + 1, j, z, c, { keep: true }); v.set(x, j, z + 1, c, { keep: true }); }
        }
        v.set(x - 1, 1, z, FLOWER.stem); v.set(x + 1, 1, z + 1, FLOWER.stem);
    }
    return v.build({ sway: lowSway(14), ao: 0.2 });
}

/** Reeds and cattails for the shoreline; they lean and swing a lot. */
export function reeds(seed: number): PropModel {
    const R = rng(seed * 41 + 3);
    const v = new Vox(`plant.reeds.${seed}`);
    const n = 10 + Math.floor(R() * 10);
    for (let s = 0; s < n; s++) {
        const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 6;
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        const h = 12 + Math.floor(R() * 12);
        const lx = (R() - 0.5) * 3, lz = (R() - 0.5) * 3;
        const col = [0x6f8a3a, 0x7f9a44, 0x5e7a32, 0x98a050][Math.floor(R() * 4)];
        const cat = R() < 0.4;
        for (let j = 0; j < h; j++) {
            const t = j / h;
            v.set(x + lx * t * t, j, z + lz * t * t, cat && j >= h - 3 && j < h - 0 ? (j === h - 1 ? 0x6a4a28 : 0x5a3a20) : t > 0.85 ? mix(col, 0xc8b070, 0.5) : col);
        }
        if (cat) v.set(x + lx, h, z + lz, col);
    }
    return v.build({ sway: (_i, j) => smooth(0, 22, j) ** 1.3 * 1.0, ao: 0.15 });
}

/** Lily pads with an occasional flower. Base sits on the water surface. */
export function lilies(seed: number): PropModel {
    const R = rng(seed * 43 + 1);
    const v = new Vox(`plant.lilies.${seed}`);
    const n = 3 + Math.floor(R() * 4);
    for (let p = 0; p < n; p++) {
        const a = R() * Math.PI * 2, d = R() * 6;
        const cx = Math.cos(a) * d, cz = Math.sin(a) * d, r = 1.4 + R() * 1.3;
        const notch = R() * Math.PI * 2;
        const col = [0x4f8236, 0x5f9440, 0x3f6e2c][Math.floor(R() * 3)];
        for (let i = Math.floor(cx - r - 1); i <= Math.ceil(cx + r); i++)
            for (let k = Math.floor(cz - r - 1); k <= Math.ceil(cz + r); k++) {
                const dx = i + 0.5 - cx, dz = k + 0.5 - cz;
                if (Math.hypot(dx, dz) > r) continue;
                let da = Math.atan2(dz, dx) - notch;
                da = Math.atan2(Math.sin(da), Math.cos(da));
                if (Math.abs(da) < 0.35 && Math.hypot(dx, dz) > 0.6) continue;
                v.set(i, 0, k, Math.hypot(dx, dz) > r - 0.8 ? mix(col, 0x8cbc52, 0.3) : col);
            }
        if (R() < 0.45) {
            const fc = R() < 0.5 ? FLOWER.rose : FLOWER.white;
            v.set(cx, 1, cz, FLOWER.gold); v.set(cx + 1, 1, cz, fc); v.set(cx - 1, 1, cz, fc); v.set(cx, 1, cz + 1, fc); v.set(cx, 1, cz - 1, fc);
        }
    }
    return v.build({ sway: () => 0.25, ao: 0, lod: false });
}

/** Little mushroom ring for shady spots under trees. */
export function mushrooms(seed: number): PropModel {
    const R = rng(seed * 47 + 9);
    const v = new Vox(`plant.mushrooms.${seed}`);
    const cap = R() < 0.5 ? 0xc4562f : 0xd8b890;
    for (let n = 0; n < 3 + Math.floor(R() * 4); n++) {
        const x = Math.round((R() - 0.5) * 7), z = Math.round((R() - 0.5) * 7), h = 3 + Math.floor(R() * 3);
        v.box(x, 0, z, x + 1 + (h > 4 ? 1 : 0), h, z + 1 + (h > 4 ? 1 : 0), 0xe8dcc0);
        v.box(x - 1, h, z - 1, x + 3, h + 1, z + 3, cap);
        v.box(x, h + 1, z, x + 2, h + 2, z + 2, cap);
        if (cap === 0xc4562f) v.set(x + 1, h, z, 0xf6f0e2);
    }
    return v.build({ ao: 0.2, lod: false });
}

/** Moss-and-stone patch used to break up open lawns. */
export function mossPatch(seed: number): PropModel {
    const R = rng(seed * 53 + 7);
    const v = new Vox(`plant.moss.${seed}`);
    for (let n = 0; n < 40; n++) {
        const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 5;
        v.set(Math.cos(a) * d, 0, Math.sin(a) * d, R() < 0.2 ? STONE.c : R() < 0.5 ? STONE.moss : STONE.mossD);
    }
    return v.build({ ao: 0, lod: false });
}

export const PLANTS = {
    bush: (s: number) => bush(s),
    berryBush: (s: number) => bush(s, "berry"),
    blossomBush: (s: number) => bush(s, "blossom"),
    fern, flowers, spikes, reeds, lilies, mushrooms, mossPatch,
} as const;
