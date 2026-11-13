// Machine palette. Values come from LOOK-SPEC.md (Nate-approved 2026-11-13), plus a few trims in the same family.

export const PALETTE = [
    0xd29a3c, // 0 brass
    0x8a5a1e, // 1 brass dark
    0xe6b860, // 2 brass light (polished edges, rivets)
    0xc4682f, // 3 copper body
    0x7a3a18, // 4 copper dark
    0xf0dfb8, // 5 cream
    0x5e5348, // 6 steel
    0x3a3128, // 7 steel dark
    0x7f8ca3, // 8 iron
    0x4e5a6e, // 9 iron dark
    0x25252b, // 10 coal
    0xeed9e4, // 11 quartz
    0x3f5576, // 12 silicon
    0xcdd6e0, // 13 aluminium
    0x58b09a, // 14 patina (input marks)
    0x1c140c, // 15 belt / soot
    0xffb347, // 16 glow (rendered unlit)
    0x6b4a2a, // 17 wood
    0xb5552b, // 18 copper (raw)
    0xff8a2a, // 19 hot ember (rendered unlit)
    0x2a201a, // 20 soot dark
    0x9a6a2a, // 21 brass mid (bands)
    0xc4562f, // 22 signal red
    0xa8d8c8, // 23 glass
] as const;

export const C = {
    brass: 0,
    brassD: 1,
    brassL: 2,
    cu: 3,
    cuD: 4,
    cream: 5,
    steel: 6,
    steelD: 7,
    iron: 8,
    ironD: 9,
    coal: 10,
    quartz: 11,
    si: 12,
    al: 13,
    patina: 14,
    soot: 15,
    glow: 16,
    wood: 17,
    cuRaw: 18,
    ember: 19,
    sootD: 20,
    brassM: 21,
    red: 22,
    glass: 23,
} as const;

/** Palette indices that render unlit. A part made only of these is a glow part. */
export const GLOW_COLORS: readonly number[] = [C.glow, C.ember];
