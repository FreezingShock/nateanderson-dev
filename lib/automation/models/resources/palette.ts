// Colours for the raw resources. The HUD item icons use the same values,
// so keep this table and the status board in step.
// Each ore reads by hue AND by shape, so it stays readable under the dither.

export type ResourceId =
    "iron_ore" | "copper_ore" | "coal" | "quartz" | "aluminium_ore";
export type StockId = ResourceId | "silicon";

export interface ResourceColors {
    /** The colour that names the resource (HUD icon fill). */
    main: number;
    /** Shadow side of the ore. */
    dark: number;
    /** Second colour that makes the shape read: nodules, streaks, glints. */
    accent: number;
    /** Rock the ore sits in. */
    host: number;
    hostDark: number;
}

export const RESOURCE_IDS: readonly ResourceId[] = [
    "iron_ore",
    "copper_ore",
    "coal",
    "quartz",
    "aluminium_ore",
];
export const STOCK_IDS: readonly StockId[] = [...RESOURCE_IDS, "silicon"];

export const RESOURCE_COLORS: Record<StockId, ResourceColors> = {
    // "Dull red grit from the ridge": rust-red boulders with steel-blue nodules.
    iron_ore: {
        main: 0x8e3b28,
        dark: 0x55231a,
        accent: 0x8d9bb3,
        host: 0x7a7068,
        hostDark: 0x6b625a,
    },
    // "Green-streaked stone from the cove": patina streaks with bright copper nuggets.
    copper_ore: {
        main: 0x58b09a,
        dark: 0x2f6f60,
        accent: 0xc4682f,
        host: 0x7a7068,
        hostDark: 0x6b625a,
    },
    // Black angular slabs with a faint blue sheen on the edges.
    coal: {
        main: 0x25252b,
        dark: 0x141418,
        accent: 0x4a4a58,
        host: 0x4a423c,
        hostDark: 0x3a332e,
    },
    // Pink-white crystal spires that catch the light.
    quartz: {
        main: 0xf2cfe0,
        dark: 0xc996b4,
        accent: 0xfff6fb,
        host: 0x7a7068,
        hostDark: 0x6b625a,
    },
    // "Pale, light stone from the high bank": layered blue-silver shelves. Kept
    // cool on purpose so the warm sun never turns it cream like quartz.
    aluminium_ore: {
        main: 0x98b2d4,
        dark: 0x63748e,
        accent: 0xdde8f5,
        host: 0x7a7068,
        hostDark: 0x6b625a,
    },
    // Refined, so it only appears as a stockpile (stacked wafers).
    silicon: {
        main: 0x3f5576,
        dark: 0x26344a,
        accent: 0x8fa6c8,
        host: 0x7a7068,
        hostDark: 0x6b625a,
    },
};

/** Workshop colours shared with the machines (LOOK-SPEC palette). */
export const WORKSHOP = {
    brass: 0xd29a3c,
    brassDark: 0x8a5a1e,
    wood: 0x4a321d,
    woodLight: 0x5c3f25,
    steel: 0x5e5348,
    steelDark: 0x3a3128,
    gravel: 0x8a7e72,
    dirt: 0x6b4a2a,
} as const;
