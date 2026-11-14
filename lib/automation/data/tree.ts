// Brasswork: the resource and recipe tree. Every number here is a first-pass
// balance value for the design thread to tune. Rates are per minute.
// Balance notes and open taste calls live in /mnt/project-files/portfolio/automation-game/recipes.md.
import type { MachineDef, RecipeTree, Stage, StructureDef, Stack } from "../types";

export const STAGE_NAMES: Record<Stage, string> = {
    0: "Raw",
    1: "Smelting",
    2: "Forming",
    3: "Components",
    4: "Clockworks",
    5: "Sky orrery",
};

/** Output multipliers for drills on each node purity. */
export const PURITY = { impure: 0.5, normal: 1, pure: 2 } as const;

const MACHINES: MachineDef[] = [
    { id: "drill", name: "Drill", unlockStage: 0, speed: 1, footprint: { w: 2, d: 2 }, powerKw: 6, note: "Sits on a resource node." },
    { id: "kiln", name: "Kiln", unlockStage: 0, speed: 1, footprint: { w: 2, d: 2 }, powerKw: 12, note: "Smelts ore into ingots." },
    { id: "furnace", name: "Furnace", unlockStage: 1, speed: 1, footprint: { w: 2, d: 3 }, powerKw: 36, note: "Alloys and high-heat work. Coal is an input." },
    { id: "press", name: "Stamp press", unlockStage: 2, speed: 1, footprint: { w: 2, d: 3 }, powerKw: 18, note: "Stamps plates, sheets and beams." },
    { id: "lathe", name: "Lathe", unlockStage: 2, speed: 1, footprint: { w: 1, d: 2 }, powerKw: 10, note: "Cuts rods, screws and gears." },
    { id: "drawer", name: "Wire drawer", unlockStage: 2, speed: 1, footprint: { w: 1, d: 2 }, powerKw: 8, note: "Draws ingots into wire." },
    { id: "assembler", name: "Assembler", unlockStage: 3, speed: 1, footprint: { w: 3, d: 3 }, powerKw: 24, note: "Builds components and clockworks." },
    { id: "fabricator", name: "Fabricator", unlockStage: 5, speed: 1, footprint: { w: 4, d: 4 }, powerKw: 90, note: "Builds Sky orrery parts." },
    {
        id: "windmill",
        name: "Windmill",
        unlockStage: 0,
        speed: 1,
        footprint: { w: 2, d: 2 },
        powerKw: 0,
        generatesKw: 30,
        supplyRange: 6,
        buildCost: [{ item: "iron_plate", qty: 8 }],
        note: "Wind power. Strong in open ground, reaches 6 cells.",
    },
    {
        id: "spring_winder",
        name: "Spring winder",
        unlockStage: 3,
        speed: 1,
        footprint: { w: 2, d: 2 },
        powerKw: 0,
        generatesKw: 60,
        supplyRange: 4,
        buildCost: [{ item: "iron_gear", qty: 4 }, { item: "copper_wire", qty: 6 }, { item: "steel_ingot", qty: 4 }],
        note: "Stored spring power. More output, reaches 4 cells.",
    },
    {
        id: "spring_store",
        name: "Spring store",
        unlockStage: 3,
        speed: 1,
        footprint: { w: 2, d: 2 },
        powerKw: 0,
        storageKj: 600,
        generatesKw: 120,
        supplyRange: 4,
        buildCost: [{ item: "iron_gear", qty: 2 }, { item: "steel_ingot", qty: 2 }, { item: "copper_wire", qty: 4 }],
        note: "The battery. Stores spare power in a wound spring and gives it back when demand outruns supply.",
    },
];

/** Structures that are not crafting machines. Ids match the voxel models. */
const STRUCTURES: StructureDef[] = [
    { id: "hub", name: "Hub", footprint: { w: 3, d: 3 }, note: "The workshop core. Receives deliveries and holds stock." },
    { id: "orrery_0", name: "Orrery, foundation", footprint: { w: 6, d: 6 }, stage: 0 },
    { id: "orrery_1", name: "Orrery, frame", footprint: { w: 6, d: 6 }, stage: 1 },
    { id: "orrery_2", name: "Orrery, rings", footprint: { w: 6, d: 6 }, stage: 2 },
    { id: "orrery_3", name: "Orrery, lenses", footprint: { w: 6, d: 6 }, stage: 3 },
    { id: "orrery_4", name: "Orrery, complete", footprint: { w: 6, d: 6 }, stage: 4 },
    // Logistics. Ids match the sim engine and the belt models. Costs and unlocks are a first pass.
    ...logisticsPieces(),
];

/** Brass pieces at stage 2, copper at stage 3, steel at stage 4 (each tier adds its own wire or steel). */
function logisticsPieces(): StructureDef[] {
    const junction = { w: 1, d: 1 };
    const brass: { id: string; name: string; cost: { item: string; qty: number }[]; note: string }[] = [
        { id: "belt-splitter", name: "Splitter", cost: [{ item: "iron_rod", qty: 2 }, { item: "iron_plate", qty: 2 }], note: "Sends items front and both sides." },
        { id: "belt-merger", name: "Merger", cost: [{ item: "iron_rod", qty: 2 }, { item: "iron_plate", qty: 2 }], note: "Joins belts; pushes forward only." },
        { id: "belt-underground-in", name: "Tunnel entrance", cost: [{ item: "iron_plate", qty: 3 }, { item: "iron_rod", qty: 3 }], note: "Sends items up to 5 cells under other belts." },
        { id: "belt-underground-out", name: "Tunnel exit", cost: [{ item: "iron_plate", qty: 3 }, { item: "iron_rod", qty: 3 }], note: "Where a tunnel comes back up." },
        { id: "belt-loader", name: "Loader", cost: [{ item: "iron_plate", qty: 2 }, { item: "iron_rod", qty: 2 }], note: "Fills storage, the dock or the hub from belts." },
        { id: "belt-unloader", name: "Unloader", cost: [{ item: "iron_plate", qty: 2 }, { item: "iron_rod", qty: 2 }], note: "Pulls from storage or the hub onto belts." },
    ];
    const tierExtra: Record<"copper" | "steel", { item: string; qty: number }> = {
        copper: { item: "copper_wire", qty: 4 },
        steel: { item: "steel_ingot", qty: 4 },
    };
    const tierStage: Record<"copper" | "steel", Stage> = { copper: 3, steel: 4 };
    const tierRate: Record<"brass" | "copper" | "steel", number> = { brass: 1, copper: 2, steel: 4 };
    const out: StructureDef[] = [];
    for (const p of brass) {
        out.push({ id: p.id, name: p.name, footprint: junction, unlockStage: 2, tier: "brass", rate: tierRate.brass, buildCost: p.cost, note: p.note });
        for (const t of ["copper", "steel"] as const) {
            out.push({
                id: `${p.id}-${t}`,
                name: `${p.name} (${t})`,
                footprint: junction,
                unlockStage: tierStage[t],
                tier: t,
                rate: tierRate[t],
                buildCost: [...p.cost.map((s) => ({ ...s })), { ...tierExtra[t] }],
                note: p.note,
            });
        }
    }
    out.push(
        { id: "belt-crate", name: "Crate", footprint: { w: 1, d: 1 }, unlockStage: 2, capacity: 200, buildCost: [{ item: "iron_plate", qty: 8 }, { item: "iron_screw", qty: 8 }], note: "Holds 200 of each item." },
        { id: "belt-strongbox", name: "Strongbox", footprint: { w: 2, d: 2 }, unlockStage: 3, capacity: 1000, buildCost: [{ item: "aluminium_casing", qty: 4 }, { item: "iron_plate", qty: 8 }], note: "Holds 1000 of each item." },
        { id: "belt-dock", name: "Dock", footprint: { w: 3, d: 3 }, unlockStage: 2, buildCost: [{ item: "iron_plate", qty: 12 }, { item: "iron_screw", qty: 12 }, { item: "copper_wire", qty: 6 }], note: "A delivery sink, like the hub." },
    );
    return out;
}

const ITEMS = [
    // Stage 0: raw, pulled from nodes on the island
    { id: "iron_ore", name: "Iron ore", stage: 0, kind: "raw", note: "Dull red grit from the ridge." },
    { id: "copper_ore", name: "Copper ore", stage: 0, kind: "raw", note: "Green-streaked stone from the cove." },
    { id: "coal", name: "Coal", stage: 0, kind: "raw", note: "Fuel and carbon for the furnaces." },
    { id: "quartz", name: "Quartz", stage: 0, kind: "raw", note: "Clear crystal for glass and optics." },
    { id: "aluminium_ore", name: "Aluminium ore", stage: 0, kind: "raw", note: "Pale, light stone from the high bank." },

    // Stage 1: smelted
    { id: "iron_ingot", name: "Iron ingot", stage: 1, kind: "material" },
    { id: "copper_ingot", name: "Copper ingot", stage: 1, kind: "material" },
    { id: "aluminium_ingot", name: "Aluminium ingot", stage: 1, kind: "material" },
    { id: "silicon", name: "Silicon", stage: 1, kind: "material", note: "Refined from quartz with coal." },

    // Stage 2: plates, screws, wire
    { id: "steel_ingot", name: "Steel ingot", stage: 2, kind: "material", note: "Iron hardened with coal." },
    { id: "iron_plate", name: "Iron plate", stage: 2, kind: "material" },
    { id: "iron_rod", name: "Iron rod", stage: 2, kind: "material" },
    { id: "iron_screw", name: "Iron screw", stage: 2, kind: "material" },
    { id: "copper_wire", name: "Copper wire", stage: 2, kind: "material" },
    { id: "aluminium_sheet", name: "Aluminium sheet", stage: 2, kind: "material" },

    // Stage 3: components
    { id: "steel_beam", name: "Steel beam", stage: 3, kind: "part" },
    { id: "iron_gear", name: "Iron gear", stage: 3, kind: "part" },
    { id: "circuit_board", name: "Circuit board", stage: 3, kind: "part" },
    { id: "aluminium_casing", name: "Aluminium casing", stage: 3, kind: "part" },
    { id: "frame", name: "Frame", stage: 3, kind: "part", note: "Bolted iron plate, the basic structure." },

    // Stage 4: clockworks
    { id: "motor", name: "Motor", stage: 4, kind: "module", note: "Geared coil drive." },
    { id: "servo", name: "Servo", stage: 4, kind: "module", note: "Motor with a control board." },
    { id: "photocell", name: "Photocell", stage: 4, kind: "module", note: "Turns light into current." },
    { id: "quartz_lens", name: "Quartz lens", stage: 4, kind: "module", note: "Ground optics for the mirrors." },

    // Stage 5: Sky orrery parts (ids stable, names per the design thread)
    { id: "sail_panel", name: "Lens array", stage: 5, kind: "megaproject", note: "A ring of lenses that gathers light for the orrery." },
    { id: "mirror_cell", name: "Mirror ring", stage: 5, kind: "megaproject", note: "A polished ring that carries light around the orrery." },
    { id: "relay_core", name: "Relay core", stage: 5, kind: "megaproject", note: "The hub that passes power around the orrery." },
    { id: "lattice_strut", name: "Orrery strut", stage: 5, kind: "megaproject", note: "A brass strut that holds the orrery together." },
] as const;

// Base recipes (one per item, not in any research node) come first in each group.
// Alternates are at the bottom and are unlocked by research.
const RECIPES = [
    // Smelting
    { id: "r_iron_ingot", machine: "kiln", inputs: [{ item: "iron_ore", qty: 1 }], output: { item: "iron_ingot", qty: 1 }, craftSeconds: 2 },
    { id: "r_copper_ingot", machine: "kiln", inputs: [{ item: "copper_ore", qty: 1 }], output: { item: "copper_ingot", qty: 1 }, craftSeconds: 2 },
    { id: "r_aluminium_ingot", machine: "furnace", inputs: [{ item: "aluminium_ore", qty: 3 }, { item: "coal", qty: 1 }], output: { item: "aluminium_ingot", qty: 2 }, craftSeconds: 6 },
    { id: "r_silicon", machine: "furnace", inputs: [{ item: "quartz", qty: 2 }, { item: "coal", qty: 1 }], output: { item: "silicon", qty: 1 }, craftSeconds: 5 },
    { id: "r_steel_ingot", machine: "furnace", inputs: [{ item: "iron_ingot", qty: 3 }, { item: "coal", qty: 1 }], output: { item: "steel_ingot", qty: 2 }, craftSeconds: 4 },

    // Forming
    { id: "r_iron_plate", machine: "press", inputs: [{ item: "iron_ingot", qty: 3 }], output: { item: "iron_plate", qty: 2 }, craftSeconds: 3 },
    { id: "r_iron_rod", machine: "lathe", inputs: [{ item: "iron_ingot", qty: 1 }], output: { item: "iron_rod", qty: 1 }, craftSeconds: 4 },
    { id: "r_iron_screw", machine: "lathe", inputs: [{ item: "iron_rod", qty: 1 }], output: { item: "iron_screw", qty: 4 }, craftSeconds: 2 },
    { id: "r_copper_wire", machine: "drawer", inputs: [{ item: "copper_ingot", qty: 1 }], output: { item: "copper_wire", qty: 2 }, craftSeconds: 2 },
    { id: "r_aluminium_sheet", machine: "press", inputs: [{ item: "aluminium_ingot", qty: 3 }], output: { item: "aluminium_sheet", qty: 2 }, craftSeconds: 3 },

    // Components
    { id: "r_steel_beam", machine: "press", inputs: [{ item: "steel_ingot", qty: 4 }], output: { item: "steel_beam", qty: 1 }, craftSeconds: 6 },
    { id: "r_iron_gear", machine: "lathe", inputs: [{ item: "iron_rod", qty: 2 }], output: { item: "iron_gear", qty: 1 }, craftSeconds: 2 },
    { id: "r_circuit_board", machine: "assembler", inputs: [{ item: "silicon", qty: 1 }, { item: "copper_wire", qty: 3 }], output: { item: "circuit_board", qty: 2 }, craftSeconds: 4 },
    { id: "r_aluminium_casing", machine: "assembler", inputs: [{ item: "aluminium_sheet", qty: 2 }, { item: "iron_screw", qty: 4 }], output: { item: "aluminium_casing", qty: 1 }, craftSeconds: 4 },
    { id: "r_frame", machine: "assembler", inputs: [{ item: "iron_plate", qty: 2 }, { item: "iron_screw", qty: 6 }], output: { item: "frame", qty: 1 }, craftSeconds: 6 },

    // Clockworks (copper is in the mid tier: wire in motors and photocells)
    { id: "r_motor", machine: "assembler", inputs: [{ item: "iron_gear", qty: 2 }, { item: "copper_wire", qty: 3 }], output: { item: "motor", qty: 1 }, craftSeconds: 4 },
    { id: "r_servo", machine: "assembler", inputs: [{ item: "motor", qty: 1 }, { item: "circuit_board", qty: 1 }, { item: "iron_gear", qty: 2 }], output: { item: "servo", qty: 1 }, craftSeconds: 5 },
    { id: "r_photocell", machine: "assembler", inputs: [{ item: "silicon", qty: 2 }, { item: "aluminium_casing", qty: 1 }, { item: "copper_wire", qty: 2 }], output: { item: "photocell", qty: 1 }, craftSeconds: 5 },
    { id: "r_quartz_lens", machine: "assembler", inputs: [{ item: "quartz", qty: 6 }, { item: "aluminium_sheet", qty: 2 }], output: { item: "quartz_lens", qty: 1 }, craftSeconds: 6 },

    // Sky orrery
    { id: "r_sail_panel", machine: "fabricator", inputs: [{ item: "frame", qty: 2 }, { item: "photocell", qty: 2 }], output: { item: "sail_panel", qty: 1 }, craftSeconds: 12 },
    { id: "r_mirror_cell", machine: "fabricator", inputs: [{ item: "photocell", qty: 2 }, { item: "quartz_lens", qty: 1 }, { item: "aluminium_casing", qty: 1 }], output: { item: "mirror_cell", qty: 1 }, craftSeconds: 10 },
    { id: "r_relay_core", machine: "fabricator", inputs: [{ item: "servo", qty: 1 }, { item: "circuit_board", qty: 2 }, { item: "copper_wire", qty: 2 }], output: { item: "relay_core", qty: 1 }, craftSeconds: 8 },
    { id: "r_lattice_strut", machine: "fabricator", inputs: [{ item: "steel_beam", qty: 2 }, { item: "frame", qty: 2 }], output: { item: "lattice_strut", qty: 1 }, craftSeconds: 10 },

    // Alternates (research only). Each trades speed, yield or ore for another input.
    { id: "r_silicon_quartz", machine: "furnace", inputs: [{ item: "quartz", qty: 3 }], output: { item: "silicon", qty: 1 }, craftSeconds: 8 },
    { id: "r_iron_plate_hammer", machine: "press", inputs: [{ item: "iron_ingot", qty: 2 }], output: { item: "iron_plate", qty: 1 }, craftSeconds: 2 },
    { id: "r_copper_wire_thin", machine: "drawer", inputs: [{ item: "copper_ingot", qty: 1 }], output: { item: "copper_wire", qty: 3 }, craftSeconds: 3 },
    { id: "r_iron_screw_bulk", machine: "lathe", inputs: [{ item: "iron_rod", qty: 1 }], output: { item: "iron_screw", qty: 6 }, craftSeconds: 3 },
    { id: "r_steel_quick", machine: "furnace", inputs: [{ item: "iron_ingot", qty: 2 }, { item: "coal", qty: 1 }], output: { item: "steel_ingot", qty: 1 }, craftSeconds: 2 },
    { id: "r_frame_fast", machine: "assembler", inputs: [{ item: "iron_plate", qty: 3 }, { item: "iron_screw", qty: 4 }], output: { item: "frame", qty: 1 }, craftSeconds: 4 },
] as const;

/** Recipes that are alternates to a base recipe. Unlocked by research, only used when chosen. */
const ALTERNATE_RECIPES: string[] = [
    "r_silicon_quartz",
    "r_iron_plate_hammer",
    "r_copper_wire_thin",
    "r_iron_screw_bulk",
    "r_steel_quick",
    "r_frame_fast",
];

const RAW_NODES = [
    { item: "iron_ore", baseRatePerMin: 60 },
    { item: "copper_ore", baseRatePerMin: 60 },
    { item: "coal", baseRatePerMin: 60 },
    { item: "quartz", baseRatePerMin: 60 },
    { item: "aluminium_ore", baseRatePerMin: 60 },
] as const;

// Recipes not listed here are base recipes, free from the start.
const RESEARCH = [
    { id: "gears", name: "Gear cutting", cost: 3, requires: [], recipes: ["r_iron_gear"] },
    { id: "furnace_alloys", name: "Alloy furnaces", cost: 4, requires: [], recipes: ["r_aluminium_ingot", "r_steel_ingot"] },
    { id: "sheet_rolling", name: "Sheet rolling", cost: 4, requires: [], recipes: ["r_aluminium_sheet"] },
    { id: "frames", name: "Frames", cost: 4, requires: [], recipes: ["r_frame"] },
    { id: "silicon", name: "Silicon wafers", cost: 6, requires: ["furnace_alloys"], recipes: ["r_silicon"] },
    { id: "steel_beams", name: "Beam forming", cost: 5, requires: ["furnace_alloys", "sheet_rolling"], recipes: ["r_steel_beam"] },
    { id: "casings", name: "Aluminium casings", cost: 5, requires: ["sheet_rolling"], recipes: ["r_aluminium_casing"] },
    { id: "circuits", name: "Circuit boards", cost: 8, requires: ["silicon"], recipes: ["r_circuit_board"] },
    { id: "motors", name: "Motors", cost: 6, requires: ["gears"], recipes: ["r_motor"] },
    { id: "quartz_optics", name: "Quartz optics", cost: 6, requires: ["casings"], recipes: ["r_quartz_lens"] },
    { id: "servos", name: "Servos", cost: 8, requires: ["motors", "circuits"], recipes: ["r_servo"] },
    { id: "photocells", name: "Photocells", cost: 8, requires: ["silicon", "casings"], recipes: ["r_photocell"] },
    { id: "lens_arrays", name: "Lens arrays", cost: 10, requires: ["photocells", "frames"], recipes: ["r_sail_panel"] },
    { id: "mirror_rings", name: "Mirror rings", cost: 10, requires: ["photocells", "quartz_optics"], recipes: ["r_mirror_cell"] },
    { id: "relay_cores", name: "Relay cores", cost: 12, requires: ["servos", "circuits"], recipes: ["r_relay_core"] },
    { id: "orrery_struts", name: "Orrery struts", cost: 10, requires: ["steel_beams", "frames"], recipes: ["r_lattice_strut"] },
    // Alternates: optional, not on the megaproject's path.
    { id: "quartz_silicon", name: "Quartz-only silicon", cost: 5, requires: ["silicon"], recipes: ["r_silicon_quartz"], note: "Silicon from quartz alone. Slower, no coal." },
    { id: "hammered_plates", name: "Hammered plates", cost: 3, requires: [], recipes: ["r_iron_plate_hammer"], note: "Faster plates, more ingot per plate." },
    { id: "thin_wire", name: "Thin wire", cost: 3, requires: [], recipes: ["r_copper_wire_thin"], note: "More wire per ingot, slower draw." },
    { id: "bulk_screws", name: "Bulk screws", cost: 3, requires: [], recipes: ["r_iron_screw_bulk"], note: "Six screws per rod, slower cut." },
    { id: "quick_steel", name: "Quick steel", cost: 4, requires: ["furnace_alloys"], recipes: ["r_steel_quick"], note: "Fast steel, no coal bonus." },
    { id: "fast_frames", name: "Fast frames", cost: 5, requires: ["frames"], recipes: ["r_frame_fast"], note: "Frames from plates and screws, quicker." },
] as const;

// Blueprints granted per stage: 10 + 20 + 30 + 35 + 40 = 135. The megaproject's path needs 109 of it.
const MILESTONES = [
    { id: "ms_smelting", name: "First smelt run", stage: 1, deliver: [{ item: "iron_ingot", qty: 50 }, { item: "copper_ingot", qty: 30 }], blueprints: 10 },
    { id: "ms_forming", name: "Plate line online", stage: 2, deliver: [{ item: "iron_plate", qty: 60 }, { item: "copper_wire", qty: 60 }, { item: "steel_ingot", qty: 30 }, { item: "aluminium_sheet", qty: 20 }], blueprints: 20 },
    { id: "ms_components", name: "Components crate", stage: 3, deliver: [{ item: "iron_gear", qty: 30 }, { item: "circuit_board", qty: 20 }, { item: "aluminium_casing", qty: 20 }, { item: "frame", qty: 20 }, { item: "steel_beam", qty: 10 }], blueprints: 30 },
    { id: "ms_clockworks", name: "Clockwork shipment", stage: 4, deliver: [{ item: "motor", qty: 10 }, { item: "servo", qty: 6 }, { item: "photocell", qty: 10 }, { item: "quartz_lens", qty: 4 }], blueprints: 35 },
    { id: "ms_megaproject", name: "Sky orrery, first light", stage: 5, deliver: [{ item: "sail_panel", qty: 3 }, { item: "mirror_cell", qty: 3 }, { item: "relay_core", qty: 3 }, { item: "lattice_strut", qty: 3 }], blueprints: 40 },
] as const;

export const RECIPE_TREE: RecipeTree = {
    items: ITEMS.map((i) => ({ ...i })),
    machines: MACHINES.map((m) => ({
        ...m,
        footprint: { ...m.footprint },
        buildCost: m.buildCost?.map((s) => ({ ...s })),
    })),
    recipes: RECIPES.map((r) => ({
        id: r.id,
        machine: r.machine,
        inputs: r.inputs.map((s) => ({ ...s })),
        output: { ...r.output },
        craftSeconds: r.craftSeconds,
        alternate: ALTERNATE_RECIPES.includes(r.id),
    })),
    nodes: RAW_NODES.map((n) => ({ ...n })),
    research: RESEARCH.map((n) => ({ ...n, requires: [...n.requires], recipes: [...n.recipes] })),
    milestones: MILESTONES.map((m) => ({ ...m, deliver: m.deliver.map((s) => ({ ...s })) })),
    prestige: {
        name: "Open a new workshop",
        keeps: ["blueprints", "research", "routes", "unlocked designs"],
        resets: ["machines", "stock"],
    },
    structures: STRUCTURES.map((st) => ({ ...st, footprint: { ...st.footprint } })),
};
