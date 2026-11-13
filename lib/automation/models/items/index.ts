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

/** Item art keyed by the item ids in lib/automation/data/tree.ts. */
const ART: Record<string, ItemArt> = {
    iron_ore: {
        palette: { r: C.ironore, d: C.ironore_d, x: C.nodule },
        layers: [
            [".rd.", "rxrd", "drrx", ".xr."],
            ["....", ".rx.", ".dxr", "...."],
            ["....", "..r.", "....", "...."],
        ],
    },
    copper_ore: {
        palette: { r: C.rock, d: C.rock_d, g: C.patina, c: C.cu },
        layers: [
            [".rg.", "rcrd", "dgrc", ".rg."],
            ["....", ".gr.", ".rcg", "...."],
            ["....", "..c.", "....", "...."],
        ],
    },
    coal: {
        palette: { k: C.coal, l: C.coal_l },
        layers: [
            [".kk.", "kkkk", "kkkk", ".kk."],
            ["....", ".kl.", ".kkk", "...."],
            ["....", "..l.", "....", "...."],
        ],
    },
    quartz: {
        palette: { r: C.rock, q: C.qz, d: C.qz_d },
        layers: [
            ["....", ".rr.", "rrrr", ".rr."],
            ["....", ".q..", "..d.", "...."],
            ["....", ".q..", "..d.", "...."],
            ["....", ".q..", "....", "...."],
        ],
    },
    aluminium_ore: {
        palette: { b: C.baux, d: C.baux_d, w: C.al_l },
        layers: [
            [".bd.", "bbwb", "dbbb", ".wb."],
            ["....", ".bb.", ".dwb", "...."],
            ["....", "..b.", "....", "...."],
        ],
    },
    iron_ingot: {
        palette: { i: C.iron, d: C.iron_d, l: C.iron_l },
        layers: [
            ["ddddd", "iiiii", "ddddd"],
            [".lll.", ".lll.", "....."],
        ],
    },
    copper_ingot: {
        palette: { i: C.cu, d: C.cu_d, l: C.cu_l },
        layers: [
            ["ddddd", "iiiii", "ddddd"],
            [".lll.", ".lll.", "....."],
        ],
    },
    aluminium_ingot: {
        palette: { i: C.al, d: C.al_d, l: C.al_l },
        layers: [
            ["dd.dd", "iiiii", "dd.dd"],
            ["ll.ll", "ll.ll", "....."],
        ],
    },
    silicon: {
        palette: { s: C.si, l: C.si_l },
        layers: [
            [".sss.", "sslss", "slsss", "sssls", ".sss."],
        ],
    },
    steel_ingot: {
        palette: { s: C.steel, d: C.steel_d, b: C.brass },
        layers: [
            ["dddd", "ssss", "dddd"],
            ["ssss", "sbss", "ssss"],
        ],
    },
    iron_plate: {
        palette: { i: C.iron, d: C.iron_d },
        layers: [
            ["diiid", "iiiii", "iiiii", "diiid"],
        ],
    },
    iron_rod: {
        palette: { i: C.iron, l: C.iron_l },
        layers: [
            ["iiilii"],
        ],
    },
    iron_screw: {
        palette: { i: C.iron, d: C.iron_d },
        layers: [
            [".....", "iiiid", "....."],
            ["....d", "....d", "....d"],
        ],
    },
    copper_wire: {
        palette: { b: C.brass, c: C.cu, l: C.cu_l },
        layers: [
            ["bcccb", "bcccb", "bcccb"],
            ["bclcb", "bcccb", "bclcb"],
            [".....", "bcccb", "....."],
        ],
    },
    aluminium_sheet: {
        palette: { a: C.al, l: C.al_l },
        layers: [
            ["aaaaa", "aaala", "aalaa", "alaaa"],
        ],
    },
    steel_beam: {
        palette: { s: C.steel },
        layers: [
            ["ssssss", "ssssss", "ssssss"],
            ["......", "ssssss", "......"],
            ["ssssss", "ssssss", "ssssss"],
        ],
    },
    iron_gear: {
        palette: { i: C.iron, d: C.iron_d },
        layers: [
            [".i.i.", "iiiii", "iidii", "iiiii", ".i.i."],
        ],
    },
    circuit_board: {
        palette: { g: C.board, c: C.cu, k: C.coal },
        layers: [
            ["gcgcg", "ggggg", "cgggc", "gcgcg"],
            [".....", ".kk..", ".kk..", "....."],
        ],
    },
    aluminium_casing: {
        palette: { a: C.al, d: C.al_d },
        layers: [
            ["aaaa", "aaaa", "adda"],
            ["aaaa", "aaaa", "adda"],
            ["aaaa", "aaaa", "aaaa"],
        ],
    },
    frame: {
        palette: { i: C.iron, b: C.brass },
        layers: [
            ["biiib", "i...i", "i...i", "i...i", "biiib"],
        ],
    },
    motor: {
        palette: { i: C.iron_d, c: C.cu, b: C.brass },
        layers: [
            ["iiii.", "iiii.", "iiii."],
            ["icci.", "iccib", "icci."],
            [".ii..", "iiii.", ".ii.."],
        ],
    },
    servo: {
        palette: { b: C.brass, d: C.brass_d, w: C.cream, s: C.steel },
        layers: [
            ["dddd", "bbbb", "bbbb"],
            ["bbbb", "bsbb", "bbbb"],
            ["....", "www.", "...."],
        ],
    },
    photocell: {
        palette: { a: C.al, c: C.cell, l: C.cell_l },
        layers: [
            ["aaaa", "acla", "alca", "aaaa"],
        ],
    },
    quartz_lens: {
        palette: { b: C.brass, q: C.qz, d: C.qz_d },
        layers: [
            [".b."],
            ["bqb"],
            ["bdb"],
            [".b."],
        ],
    },
    sail_panel: {
        palette: { b: C.brass, g: C.glass },
        layers: [
            [".bbb.", "bgbgb", "bbgbb", "bgbgb", ".bbb."],
        ],
    },
    mirror_cell: {
        palette: { b: C.brass, m: C.mirror },
        layers: [
            [".bbb."],
            [".mmm."],
            ["m...m"],
            ["m...m"],
            ["m...m"],
            [".mmm."],
        ],
    },
    relay_core: {
        palette: { s: C.steel, b: C.brass, o: C.glow, c: C.cu },
        glow: "o",
        layers: [
            ["sss", "sss", "sss"],
            ["b.b", ".o.", "b.b"],
            ["cbc", "bob", "cbc"],
            ["...", ".b.", "..."],
        ],
    },
    lattice_strut: {
        palette: { b: C.brass, c: C.cu, d: C.brass_d },
        layers: [
            ["cbbbbbc"],
            [".d.d.d."],
            ["cbbbbbc"],
        ],
    },
};

/** One belt model per item id. */
export const ITEM_MODELS: Record<string, VoxelModel> = Object.fromEntries(
    Object.entries(ART).map(([id, art]) => [id, fromLayers(id, art)]),
);

/** Every item model as a list, for the registry. */
export const ITEM_MODEL_LIST: VoxelModel[] = Object.values(ITEM_MODELS);
