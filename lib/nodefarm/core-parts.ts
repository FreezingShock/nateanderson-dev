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
    rigs: 512, // first rig level
    shell: 1024, // first Handover
    vines: 2048, // Spores open (Overgrowth)
    crust: 4096, // Basalt open (Descent)
} as const;
export const PART_ORDER = ["clamps", "socket", "masts", "docks", "ring1", "glyphs", "ring2", "corona", "ring3", "rigs", "shell", "vines", "crust"] as const;

/** Looks the core can wear. 0 follows the zone; the rest unlock (see SKIN_WHY in core-look.ts). */
export const SKINS = ["zone", "chroma", "aurora", "gold", "mono"] as const;
export type SkinId = (typeof SKINS)[number];

/** Zone event kinds, in the order the renderer's event colours use (index + 1; 0 = no event). */
export const CORE_EVENTS = ["surge", "clearance", "resonance", "vein", "fault", "convoy", "tune"] as const;
export type PartId = (typeof PART_ORDER)[number];
