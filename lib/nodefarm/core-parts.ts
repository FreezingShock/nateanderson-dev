// The structures that bolt onto the reactor core, shared by the renderer (core-art.ts) and the game side (core-look.ts).

/** Structures around the core. Each one bolts on when its part of the game opens (see coreLook in core-look.ts). */
export const PART = {
    clamps: 1, // first Reboot
    socket: 2, // Copper open
    masts: 4, // Exploit Lab open
    docks: 8, // first Drone
    ring1: 16, // first Ascend
    glyphs: 32, // first Script learned
    ring2: 64, // Nebula open
    corona: 128, // Engrams open
    ring3: 256, // Origin open
} as const;
export const PART_ORDER = ["clamps", "socket", "masts", "docks", "ring1", "glyphs", "ring2", "corona", "ring3"] as const;
export type PartId = (typeof PART_ORDER)[number];
