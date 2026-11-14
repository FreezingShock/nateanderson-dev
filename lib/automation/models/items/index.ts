// Brasswork belt models: a tiny voxel model per item, a handful of voxels each, so thousands can ride the belts.
// Format: lib/automation/models/format.ts (VoxelModel, 0.1 voxels). Each model is one static part.
//
// Authoring: layers go bottom (y = 0) to top; each layer lists rows from back (-z) to front (+z); each row is
// characters along +x. "." is empty, any other character is a key into the model's palette. Keys in `glow` render
// unlit (TAG.GLOW). Colours are look-spec palette values (/mnt/project-files/portfolio/automation-game/LOOK-SPEC.md).
//
// Items have no footprint. The part pivot is the model's bottom centre, so the renderer places an item by putting the
// pivot on the belt surface; voxel positions are relative to it (x and z centred, y from 0 up).
// Icons for the same items: lib/automation/icons/index.ts (scripts/brasswork/build-icons.py).
import type { VoxelModel } from "../format";

// TAG.SOLID and TAG.GLOW from ../format. Kept as literals so this file has only type imports and also loads in plain
// Node for the tests (tests/automation/item-art.test.mjs checks they still match).
const SOLID = 0;
const GLOW = 1;

type Key = string;
interface ItemArt {
    palette: Record<Key, number>;
    layers: string[][];
    glow?: string;
}

/** Turn layer strings into a one-part VoxelModel centred on the bottom middle. */
export function fromLayers(id: string, art: ItemArt): VoxelModel {
    const keys = Object.keys(art.palette);
    const h = art.layers.length;
    const d = art.layers[0].length;
    const w = art.layers[0][0].length;
    const ox = Math.floor(w / 2);
    const oz = Math.floor(d / 2);
    const pos: number[] = [];
    const colors: number[] = [];
    const tags: number[] = [];
    art.layers.forEach((layer, y) =>
        layer.forEach((row, z) =>
            [...row].forEach((ch, x) => {
                if (ch === ".") return;
                const k = keys.indexOf(ch);
                if (k < 0) throw new Error(`item model ${id}: no palette key "${ch}"`);
                pos.push(x - ox, y, z - oz);
                colors.push(k);
                tags.push(art.glow?.includes(ch) ? GLOW : SOLID);
            }),
        ),
    );
    return {
        id: `item-${id}`,
        voxel: 0.1,
        size: [w, h, d],
        palette: keys.map((k) => art.palette[k]),
        parts: [
            {
                id: "body",
                pivot: [0, 0, 0],
                pos: new Int16Array(pos),
                colors: new Uint8Array(colors),
                tags: new Uint8Array(tags),
            },
        ],
    };
}

// Look-spec colours used by the items.
const C = {
    iron: 0x7f8ca3,
    iron_d: 0x4e5a6e,
    iron_l: 0xa6b2c4,
    cu: 0xc4682f,
    cu_d: 0x7a3a18,
    cu_l: 0xe08a48,
    brass: 0xd29a3c,
    brass_d: 0x8a5a1e,
    brass_l: 0xf6d688,
    steel: 0x545c68,
    steel_d: 0x3a3128,
    al: 0xcdd6e0,
    al_d: 0x87919c,
    al_l: 0xeef3f8,
    rock: 0x6b625a,
    rock_d: 0x544840,
    rust: 0xb04a22,
    ironore: 0x8e3b28,
    ironore_d: 0x55231a,
    nodule: 0x8d9bb3,
    patina: 0x58b09a,
    coal: 0x25252b,
    coal_l: 0x4a4a58,
    qz: 0xf2cfe0,
    qz_d: 0xc996b4,
    si: 0x3f5576,
    si_l: 0x7e98c0,
    baux: 0xd4c4a0,
    baux_d: 0xb8a47e,
    board: 0x2e5c42,
    cell: 0x2c4080,
    cell_l: 0x6a8ad0,
    glass: 0x94d0d8,
    mirror: 0xece0c4,
    cream: 0xf0dfb8,
    glow: 0xffb347,
} as const;

// ---------- shape builder ----------
// Items are drawn with a few solid helpers (boxes, discs, rings, cylinders) on a small grid instead of layer strings,
// so each one can carry real detail: bevels, rivets, threads, teeth, coils. The belt layer draws them at half scale
// (BELT_ITEM_SCALE), so a 6-voxel item is 0.3 cells across and still clears the 0.25-cell belt spacing.

type Axis3 = "x" | "y" | "z";
interface Shape {
    put(x: number, y: number, z: number, key: Key): void;
    box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, key: Key): void;
    /** Filled disc of radius r (in voxels) around (cx, cz) across the given axis, from a0 to a1 inclusive. */
    cyl(axis: Axis3, cu: number, cv: number, r: number, a0: number, a1: number, key: Key | ((u: number, v: number, a: number) => Key | null)): void;
    has(x: number, y: number, z: number): boolean;
    del(x: number, y: number, z: number): void;
}

function shape(id: string, palette: Record<Key, number>, draw: (s: Shape) => void, glow = ""): VoxelModel {
    const cells = new Map<string, [number, number, number, Key]>();
    const k = (x: number, y: number, z: number) => `${x},${y},${z}`;
    const s: Shape = {
        put(x, y, z, key) {
            cells.set(k(x, y, z), [x, y, z, key]);
        },
        box(x0, y0, z0, x1, y1, z1, key) {
            for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) s.put(x, y, z, key);
        },
        cyl(axis, cu, cv, r, a0, a1, key) {
            const R = Math.ceil(r);
            for (let a = a0; a <= a1; a++)
                for (let u = -R; u <= R; u++)
                    for (let v = -R; v <= R; v++) {
                        if (u * u + v * v > r * r + 0.01) continue;
                        const kk = typeof key === "function" ? key(u, v, a) : key;
                        if (!kk) continue;
                        const U = cu + u, V = cv + v;
                        if (axis === "y") s.put(U, a, V, kk);
                        else if (axis === "x") s.put(a, U, V, kk);
                        else s.put(U, V, a, kk);
                    }
        },
        has: (x, y, z) => cells.has(k(x, y, z)),
        del: (x, y, z) => void cells.delete(k(x, y, z)),
    };
    draw(s);
    const keys = Object.keys(palette);
    const list = [...cells.values()];
    // Centre x and z on the bottom middle, y from 0 up.
    const xs = list.map((c) => c[0]), ys = list.map((c) => c[1]), zs = list.map((c) => c[2]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const ox = Math.floor((minX + maxX + 1) / 2), oz = Math.floor((minZ + maxZ + 1) / 2);
    const pos: number[] = [], colors: number[] = [], tags: number[] = [];
    for (const [x, y, z, key] of list) {
        const i = keys.indexOf(key);
        if (i < 0) throw new Error(`item model ${id}: no palette key "${key}"`);
        pos.push(x - ox, y - minY, z - oz);
        colors.push(i);
        tags.push(glow.includes(key) ? GLOW : SOLID);
    }
    return {
        id: `item-${id}`,
        voxel: 0.1,
        size: [maxX - minX + 1, maxY - minY + 1, maxZ - minZ + 1],
        palette: keys.map((q) => palette[q]),
        parts: [{ id: "body", pivot: [0, 0, 0], pos: new Int16Array(pos), colors: new Uint8Array(colors), tags: new Uint8Array(tags) }],
    };
}

/** Deterministic 0..1 noise for lumpy ores. */
function hash(x: number, y: number, z: number, seed: number): number {
    let h = (x * 374761393 + y * 668265263 + z * 1274126177 + seed * 69069) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** A lumpy rock: a squashed ellipsoid with noisy edges. `pick` colours each voxel. */
function lump(s: Shape, seed: number, rx: number, ry: number, rz: number, pick: (x: number, y: number, z: number, top: boolean) => Key) {
    for (let x = -rx; x <= rx; x++)
        for (let y = 0; y <= ry * 2; y++)
            for (let z = -rz; z <= rz; z++) {
                const d = (x / (rx + 0.5)) ** 2 + ((y - ry * 0.7) / (ry + 0.6)) ** 2 + (z / (rz + 0.5)) ** 2;
                if (d > 0.78 + hash(x, y, z, seed) * 0.35) continue;
                s.put(x, y, z, "_");
            }
    // Colour after the solid is known, so top faces can catch light.
    for (let x = -rx; x <= rx; x++)
        for (let y = 0; y <= ry * 2; y++)
            for (let z = -rz; z <= rz; z++) if (s.has(x, y, z)) s.put(x, y, z, pick(x, y, z, !s.has(x, y + 1, z)));
}

/** A bar ingot along x: wide foot, narrower bevelled top, a lighter top face. */
function ingot(s: Shape, len: number, side: Key, top: Key, dark: Key, notch = false) {
    s.box(0, 0, 0, len - 1, 0, 3, dark);
    s.box(0, 1, 0, len - 1, 1, 3, side);
    s.box(1, 2, 1, len - 2, 2, 2, top);
    if (notch) {
        const m = Math.floor(len / 2);
        s.del(m, 2, 1);
        s.del(m, 2, 2);
    }
}

/** Item models keyed by the item ids in lib/automation/data/tree.ts. */
const MODELS: Record<string, VoxelModel> = {
    // Raw ores: each a different silhouette as well as a different colour.
    iron_ore: shape("iron_ore", { _: C.ironore, r: C.ironore, d: C.ironore_d, x: C.nodule, l: C.rust }, (s) =>
        lump(s, 1, 3, 1, 2, (x, y, z, top) => (hash(x, y, z, 9) > 0.8 ? "x" : top ? (hash(x, z, y, 4) > 0.5 ? "l" : "r") : y === 0 ? "d" : "r")),
    ),
    copper_ore: shape("copper_ore", { _: C.rock, r: C.rock, d: C.rock_d, g: C.patina, c: C.cu_l }, (s) =>
        lump(s, 2, 2, 2, 2, (x, y, z, top) => {
            const h = hash(x, y, z, 3);
            return h > 0.82 ? "c" : (top && h > 0.45) || h < 0.18 ? "g" : y === 0 ? "d" : "r";
        }),
    ),
    coal: shape("coal", { _: C.coal, k: C.coal, l: C.coal_l, s: 0x6a6a7c }, (s) => {
        lump(s, 5, 3, 1, 2, (x, y, z, top) => (top ? (hash(x, y, z, 2) > 0.7 ? "s" : "l") : "k"));
        // A broken facet: a sharp shelf cut out of one corner.
        s.del(3, 2, -2);
        s.del(3, 1, -2);
    }),
    quartz: shape("quartz", { r: C.rock, d: C.rock_d, q: C.qz, w: 0xfff2f8, p: C.qz_d }, (s) => {
        s.box(-2, 0, -2, 2, 0, 2, "d");
        s.box(-1, 1, -2, 2, 1, 1, "r");
        // Three crystal points of different heights, white tips.
        const spire = (x: number, z: number, h: number) => {
            for (let y = 1; y <= h; y++) s.put(x, y, z, y === h ? "w" : y % 2 ? "q" : "p");
        };
        spire(-1, 0, 6);
        spire(0, 1, 4);
        spire(1, -1, 5);
        s.put(-2, 2, 0, "q");
        s.put(2, 2, 1, "p");
    }),
    aluminium_ore: shape("aluminium_ore", { _: C.baux, b: C.baux, d: C.baux_d, o: 0xc08a40, w: C.al_l }, (s) =>
        lump(s, 7, 3, 1, 3, (x, y, z, top) => (hash(x, y, z, 5) > 0.85 ? "w" : (y + Math.abs(x)) % 3 === 0 ? "o" : top ? "b" : y === 0 ? "d" : "b")),
    ),

    // Ingots and refined stock.
    iron_ingot: shape("iron_ingot", { i: C.iron, l: C.iron_l, d: C.iron_d }, (s) => ingot(s, 6, "i", "l", "d")),
    copper_ingot: shape("copper_ingot", { i: C.cu, l: C.cu_l, d: C.cu_d }, (s) => ingot(s, 6, "i", "l", "d")),
    aluminium_ingot: shape("aluminium_ingot", { i: C.al, l: C.al_l, d: C.al_d }, (s) => ingot(s, 6, "i", "l", "d", true)),
    steel_ingot: shape("steel_ingot", { s: C.steel, l: 0x707a88, d: C.steel_d, b: C.brass }, (s) => {
        ingot(s, 6, "s", "l", "d");
        s.put(2, 2, 1, "b"); // maker's stamp
        s.put(3, 2, 2, "b");
    }),
    silicon: shape("silicon", { s: C.si, l: C.si_l, g: 0xa8c0e0, e: C.al_d }, (s) => {
        // A wafer on edge-rings: grey rim, blue disc, a lighter grid of cut dies.
        s.cyl("y", 0, 0, 3.2, 0, 0, (u, v) => (u * u + v * v > 7.5 ? "e" : "s"));
        s.cyl("y", 0, 0, 2.6, 1, 1, (u, v) => ((u + 3) % 2 === 0 && (v + 3) % 2 === 0 ? "g" : "l"));
        s.put(0, 1, 3, "e"); // flat notch marker
    }),
    iron_plate: shape("iron_plate", { i: C.iron, d: C.iron_d, l: C.iron_l, r: 0xc8d2e0 }, (s) => {
        s.box(0, 0, 0, 5, 0, 5, "d");
        s.box(0, 1, 0, 5, 1, 5, "i");
        s.box(1, 1, 1, 4, 1, 4, "l");
        for (const [x, z] of [[0, 0], [5, 0], [0, 5], [5, 5]]) s.put(x, 2, z, "r"); // rivets
    }),
    iron_rod: shape("iron_rod", { i: C.iron, l: C.iron_l, d: C.iron_d }, (s) => {
        s.cyl("x", 1, 0, 1, 0, 7, (u, v) => (u > 0 ? "l" : u < 0 ? "d" : "i"));
        s.put(0, 1, 0, "l");
        s.put(7, 1, 0, "l");
    }),
    iron_screw: shape("iron_screw", { i: C.iron, d: C.iron_d, l: C.iron_l, k: 0x2a2e36 }, (s) => {
        // Hex-ish head on the left with a slot, threaded shank to the right.
        s.cyl("x", 2, 0, 2, 0, 1, "i");
        s.put(0, 2, 0, "k");
        s.put(0, 3, 0, "k");
        s.put(0, 1, 0, "k");
        for (let x = 2; x <= 6; x++) {
            s.put(x, 2, 0, x % 2 ? "l" : "d");
            if (x % 2) {
                s.put(x, 3, 0, "l");
                s.put(x, 2, 1, "i");
            }
        }
        s.put(7, 2, 0, "d"); // tip
    }),
    copper_wire: shape("copper_wire", { b: C.brass, d: C.brass_d, c: C.cu, l: C.cu_l }, (s) => {
        // A spool: brass flanges, copper windings with a highlight wrap.
        s.cyl("x", 3, 0, 3, 0, 0, (u, v) => (u * u + v * v < 1.5 ? "d" : "b"));
        s.cyl("x", 3, 0, 3, 5, 5, (u, v) => (u * u + v * v < 1.5 ? "d" : "b"));
        s.cyl("x", 3, 0, 2.2, 1, 4, (u, v, a) => (u * u + v * v < 1.5 ? null : (a + u + v) % 3 === 0 ? "l" : "c"));
    }),
    aluminium_sheet: shape("aluminium_sheet", { a: C.al, l: C.al_l, d: C.al_d }, (s) => {
        // Three thin sheets in a small offset stack, with a glint streak.
        s.box(0, 0, 0, 6, 0, 4, "d");
        s.box(0, 1, 0, 6, 1, 4, "a");
        for (let i = 0; i < 5; i++) s.put(i + 1, 1, 4 - i, "l");
        s.box(1, 2, 1, 5, 2, 3, "a");
        s.put(2, 2, 2, "l");
    }),
    steel_beam: shape("steel_beam", { s: C.steel, d: C.steel_d, l: 0x7a8494, b: C.brass }, (s) => {
        // An I-beam along x: flanges top and bottom, a web, a brass end tag.
        s.box(0, 0, 0, 7, 0, 3, "d");
        s.box(0, 1, 1, 7, 2, 2, "s");
        s.box(0, 3, 0, 7, 3, 3, "l");
        s.put(7, 2, 1, "b");
    }),
    iron_gear: shape("iron_gear", { i: C.iron, d: C.iron_d, l: C.iron_l, k: 0x2a2e36 }, (s) => {
        s.cyl("y", 0, 0, 2.6, 0, 1, (u, v, a) => (u * u + v * v < 1.2 ? (a ? "k" : "d") : a ? "l" : "i"));
        // Eight teeth.
        for (const [x, z] of [[0, 3], [0, -3], [3, 0], [-3, 0], [2, 2], [-2, 2], [2, -2], [-2, -2]]) {
            const tx = Math.abs(x) === 2 ? x + Math.sign(x) * 0 : x;
            s.put(tx, 0, z, "d");
            s.put(tx, 1, z, "i");
        }
        for (const [x, z] of [[2, 2], [-2, 2], [2, -2], [-2, -2]]) {
            s.put(x + Math.sign(x), 1, z + Math.sign(z), "i");
        }
    }),
    circuit_board: shape("circuit_board", { g: C.board, h: 0x3f7a58, c: C.cu_l, k: C.coal, b: C.brass_l, r: 0xb03a2a }, (s) => {
        s.box(0, 0, 0, 6, 0, 4, "g");
        // Copper traces, two black chips, a red capacitor and a gold edge connector.
        for (let x = 0; x <= 6; x++) s.put(x, 1, 2, x % 3 === 0 ? "c" : "h");
        s.put(1, 1, 0, "c"); s.put(1, 1, 1, "c"); s.put(5, 1, 3, "c"); s.put(5, 1, 4, "c");
        s.box(1, 1, 3, 2, 1, 4, "k");
        s.box(4, 1, 0, 5, 1, 1, "k");
        s.put(3, 1, 0, "r"); s.put(3, 2, 0, "r");
        for (let z = 0; z <= 4; z += 2) s.put(-1, 0, z, "b");
    }),
    aluminium_casing: shape("aluminium_casing", { a: C.al, d: C.al_d, l: C.al_l, k: 0x5a636e }, (s) => {
        // A hollow box with a rolled lip, open at the top, and a vent slot.
        s.box(0, 0, 0, 4, 0, 4, "d");
        for (let y = 1; y <= 3; y++) for (let x = 0; x <= 4; x++) for (let z = 0; z <= 4; z++) if (x === 0 || x === 4 || z === 0 || z === 4) s.put(x, y, z, y === 3 ? "l" : "a");
        s.box(0, 1, 1, 0, 0, 3, "d");
        s.put(0, 2, 1, "k"); s.put(0, 2, 2, "k"); s.put(0, 2, 3, "k");
    }),
    frame: shape("frame", { i: C.iron, d: C.iron_d, b: C.brass, l: C.brass_l }, (s) => {
        // A square iron frame, a diagonal brace, brass corner bolts.
        for (let x = 0; x <= 6; x++) for (let z = 0; z <= 6; z++) if (x === 0 || x === 6 || z === 0 || z === 6 || x === z) s.put(x, 0, z, x === z && x > 0 && x < 6 ? "d" : "i");
        for (const [x, z] of [[0, 0], [6, 0], [0, 6], [6, 6]]) { s.put(x, 0, z, "b"); s.put(x, 1, z, "l"); }
    }),
    motor: shape("motor", { i: C.iron_d, m: C.iron, c: C.cu, l: C.cu_l, b: C.brass, k: 0x2a2e36 }, (s) => {
        // A drum on its side with a copper coil band, cooling ribs, feet and a brass shaft.
        s.box(1, 0, -2, 5, 0, -2, "k"); s.box(1, 0, 2, 5, 0, 2, "k");
        s.cyl("x", 3, 0, 2.5, 0, 6, (u, v, a) => (a === 3 ? (u > 0 ? "l" : "c") : a % 2 ? "m" : "i"));
        s.put(7, 3, 0, "b"); s.put(8, 3, 0, "b");
    }),
    servo: shape("servo", { b: C.brass, d: C.brass_d, w: C.cream, s: C.steel, k: 0x2a2e36 }, (s) => {
        // A brass housing with a cream dial face, a needle and a steel output arm.
        s.box(0, 0, 0, 4, 0, 3, "d");
        s.box(0, 1, 0, 4, 2, 3, "b");
        s.cyl("y", 2, 1, 1.5, 3, 3, "w");
        s.put(2, 3, 1, "k"); s.put(3, 3, 1, "k");
        s.box(5, 1, 1, 6, 1, 2, "s");
    }),
    photocell: shape("photocell", { a: C.al, d: C.al_d, c: C.cell, l: C.cell_l }, (s) => {
        s.box(0, 0, 0, 5, 0, 5, "d");
        for (let x = 0; x <= 5; x++) for (let z = 0; z <= 5; z++) s.put(x, 1, z, x === 0 || x === 5 || z === 0 || z === 5 ? "a" : (x + z) % 2 ? "c" : "l");
    }),
    quartz_lens: shape("quartz_lens", { b: C.brass, d: C.brass_d, q: C.qz, w: 0xfff2f8 }, (s) => {
        // A brass ring standing on a little foot, pink glass inside with a highlight.
        s.box(-1, 0, -1, 1, 0, 0, "d");
        s.cyl("z", 0, 4, 3.3, 0, 0, (u, v) => (u * u + v * v > 6 ? "b" : u === -1 && v === 1 ? "w" : "q"));
    }),
    sail_panel: shape("sail_panel", { b: C.brass, d: C.brass_d, g: C.glass, w: 0xd8f0f4 }, (s) => {
        for (let x = 0; x <= 6; x++) for (let z = 0; z <= 6; z++) s.put(x, 0, z, x % 3 === 0 || z % 3 === 0 ? "b" : x === z + 1 ? "w" : "g");
        s.put(3, 1, 3, "d");
    }),
    mirror_cell: shape("mirror_cell", { b: C.brass, d: C.brass_d, m: C.mirror, w: 0xfffaf0 }, (s) => {
        s.cyl("y", 0, 0, 3.2, 0, 0, (u, v) => (u * u + v * v > 7 ? "b" : "d"));
        s.cyl("y", 0, 0, 2.5, 1, 1, (u, v) => (u - v === 1 || u - v === 0 ? "w" : "m"));
    }),
    relay_core: shape("relay_core", { s: C.steel, d: C.steel_d, b: C.brass, c: C.cu, o: C.glow }, (s) => {
        s.box(0, 0, 0, 4, 0, 4, "d");
        s.box(0, 1, 0, 4, 1, 4, "s");
        for (const [x, z] of [[0, 0], [4, 0], [0, 4], [4, 4]]) s.box(x, 2, z, x, 4, z, "b");
        s.box(1, 2, 1, 3, 4, 3, "o");
        s.box(0, 5, 0, 4, 5, 4, "c");
        s.put(2, 6, 2, "b");
    }, "o"),
    lattice_strut: shape("lattice_strut", { b: C.brass, d: C.brass_d, c: C.cu }, (s) => {
        // A truss along x: top and bottom chords and a zigzag web.
        s.box(0, 0, 0, 7, 0, 0, "b");
        s.box(0, 3, 0, 7, 3, 0, "b");
        for (let x = 0; x <= 7; x++) s.put(x, 1 + (Math.floor(x / 1) % 4 < 2 ? x % 2 : 1 - (x % 2)), 0, "d");
        s.put(0, 1, 0, "c"); s.put(0, 2, 0, "c"); s.put(7, 1, 0, "c"); s.put(7, 2, 0, "c");
    }),
};

/** Belt items are drawn at this scale (0.05 world units per voxel). */
export const BELT_ITEM_SCALE = 0.5;

/** One belt model per item id. */
export const ITEM_MODELS: Record<string, VoxelModel> = MODELS;

/** Every item model as a list, for the registry. */
export const ITEM_MODEL_LIST: VoxelModel[] = Object.values(ITEM_MODELS);
