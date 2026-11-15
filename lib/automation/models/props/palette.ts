// Scenery colours. Shared ones are copied from LOOK-SPEC.md (palette section);
// the rest are new scenery tones picked to sit inside the warm brass sunset light.

export const LOOK = {
    brass: 0xd29a3c, brassD: 0x8a5a1e, copper: 0xb5552b, cream: 0xf0dfb8,
    steel: 0x5e5348, steelD: 0x3a3128, iron: 0x7f8ca3, ironD: 0x4e5a6e, patina: 0x58b09a,
    grass: [0x5f9440, 0x6da345, 0x4f8236, 0x7bb04c],
    sand: 0xd9b97a, sandD: 0xbf9f62, dirt: 0x6b4a2a, rock: 0x7a7068, rockD: 0x6b625a,
    glow: 0xffb347,
} as const;

export const BARK = { oak: 0x5e4026, oakD: 0x47301c, pine: 0x6a4428, pineD: 0x4e3020, birch: 0xdcd8cc, birchMark: 0x2e2620, drift: 0xb9aa90, driftD: 0x8f8170, dead: 0x8a7a68, moss: 0x5a7a34 };

export const LEAF = {
    oak: [0x4f8236, 0x5f9440, 0x6da345, 0x3f6e2c],
    oakLit: 0x8cbc52,
    pine: [0x2f6a3a, 0x3b7a43, 0x285c33, 0x356f3c],
    pineLit: 0x4f8c4a,
    birch: [0x86b04a, 0x9cc25a, 0x74a040, 0xa9c868],
    birchLit: 0xc4d878,
    maple: [0xd2702a, 0xc4562f, 0xe0a030, 0xb8452a],
    mapleLit: 0xf0b848,
    willow: [0x6f9a48, 0x7fa852, 0x5e8a3e, 0x8cb45e],
    willowLit: 0xa8c870,
    bush: [0x4a7c34, 0x568a3a, 0x3f6c2e, 0x62953f],
    // Autumn (Nate's pick 2026-11-13: full autumn for broadleaf trees; pines stay green).
    oakFall: [0xb8602a, 0xa04a24, 0xc8803a, 0x8a5a28],
    oakFallLit: 0xe0a050,
    birchFall: [0xe0b040, 0xd09a30, 0xf0c850, 0xc8a038],
    birchFallLit: 0xf8e078,
    willowFall: [0xc8a840, 0xb89838, 0xd8b850, 0xa89040],
    willowFallLit: 0xe8d070,
    bushFall: [0xa85a2a, 0x8a6a30, 0xb8782e, 0x6a7a34],
} as const;

/** Oak variant seeds that keep summer leaves, so the forest isn't one flat orange. */
export const EVERGREEN_OAK_SEEDS = [6];

export const FLOWER = {
    cream: 0xf0dfb8, gold: 0xe0a030, ember: 0xc4562f, lavender: 0xb88adf, sky: 0x7b9be0, rose: 0xe07a8a, white: 0xf6f0e2,
    stem: 0x4f8236, stemD: 0x3f6c2e,
} as const;

export const STONE = {
    a: 0x7a7068, b: 0x6b625a, c: 0x8a8076, d: 0x5e554e, light: 0x9a9086, lichen: 0xb8a060, moss: 0x5a7a34, mossD: 0x48662a,
    strataA: 0x8a7462, strataB: 0x7a6656, strataC: 0x9a8470,
} as const;

export const WOOD = { plank: 0x8a5a32, plankD: 0x6b4426, plankL: 0xa06c3c, beam: 0x4a3020, post: 0x5a3a22 } as const;

export const BUILD = {
    plaster: 0xe8d4a8, plasterD: 0xd4bc8e, timber: 0x4a2e1c, stone: 0x7a7068, stoneD: 0x625850, brick: 0x9a4a30, brickD: 0x7c3a26,
    roof: 0x58b09a, roofD: 0x3f8a76, roofL: 0x6cc2aa, window: 0xffc060, door: 0x6b3a20, doorD: 0x52301a,
} as const;
