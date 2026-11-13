// Colours for the logistics kit. Base values come from LOOK-SPEC.md (Nate-approved palette).

export const C = {
    brass: 0xd29a3c,
    brassD: 0x8a5a1e,
    copper: 0xc4682f,
    copperD: 0x7a3a18,
    steel: 0x5e5348,
    steelD: 0x3a3128,
    iron: 0x7f8ca3,
    ironD: 0x4e5a6e,
    cream: 0xf0dfb8,
    patina: 0x58b09a,
    coal: 0x25252b,
    belt: 0x1c140c,
    glow: 0xffb347,
    // Wood for crates and the dock deck: the floor checker and dirt tones from the spec.
    wood: 0x7d6044,
    woodD: 0x6b5238,
    woodDD: 0x4a3320,
    hole: 0x0e0905,
} as const;

/** A belt tier: trim colours and the default speed the renderer starts with. */
export interface BeltTier {
    id: number;
    name: string;
    /** Rails and gear rims. */
    trim: number;
    trimD: number;
    /** Slat colours, alternating so motion reads at a distance. */
    slatA: number;
    slatB: number;
    /** Gear hub. */
    hub: number;
    /** Cells per second. The renderer can change it at any time (setSpeed). */
    speed: number;
}

export const BELT_TIERS: readonly BeltTier[] = [
    { id: 0, name: "Brass belt", trim: C.brass, trimD: C.brassD, slatA: C.steel, slatB: 0x6e6152, hub: C.steelD, speed: 1 },
    { id: 1, name: "Copper belt", trim: C.copper, trimD: C.copperD, slatA: 0x4a3a30, slatB: 0x5a463a, hub: C.brassD, speed: 2 },
    { id: 2, name: "Steel belt", trim: C.iron, trimD: C.ironD, slatA: 0x8a93a4, slatB: 0x6b7486, hub: C.brass, speed: 3 },
];
