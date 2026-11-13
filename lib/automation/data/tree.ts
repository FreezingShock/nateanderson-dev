// Brasswork: the resource and recipe tree. Every number here is a first-pass
// balance value for the design thread to tune. Rates are per minute.
// Balance notes and open taste calls live in /mnt/project-files/portfolio/automation-game/recipes.md.
import type { MachineDef, RecipeTree, Stage } from "./types";

export const STAGE_NAMES: Record<Stage, string> = {
    0: "Raw",
    1: "Smelting",
    2: "Forming",
    3: "Components",
    4: "Clockworks",
    5: "Megaproject",
};

/** Output multipliers for drills on each node purity. */
export const PURITY = { impure: 0.5, normal: 1, pure: 2 } as const;

const MACHINES: MachineDef[] = [
    { id: "drill", name: "Node drill", unlockStage: 0, speed: 1, footprint: { w: 2, d: 2 }, note: "Sits on a resource node." },
    { id: "kiln", name: "Kiln", unlockStage: 1, speed: 1, footprint: { w: 2, d: 2 }, note: "Smelts ore into ingots." },
    { id: "furnace", name: "Furnace", unlockStage: 1, speed: 1, footprint: { w: 2, d: 3 }, note: "Alloys and high-heat work. Burns coal as an input." },
    { id: "press", name: "Stamp press", unlockStage: 2, speed: 1, footprint: { w: 2, d: 3 }, note: "Stamps plates, sheets and beams." },
    { id: "lathe", name: "Lathe", unlockStage: 2, speed: 1, footprint: { w: 1, d: 2 }, note: "Cuts rods, screws and gears." },
    { id: "drawer", name: "Wire drawer", unlockStage: 2, speed: 1, footprint: { w: 1, d: 2 }, note: "Draws ingots into wire." },
    { id: "assembler", name: "Assembler", unlockStage: 3, speed: 1, footprint: { w: 3, d: 3 }, note: "Builds components and clockworks." },
    { id: "fabricator", name: "Fabricator", unlockStage: 5, speed: 1, footprint: { w: 4, d: 4 }, note: "Builds megaproject parts." },
];

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

    // Stage 5: megaproject parts
    { id: "sail_panel", name: "Sail panel", stage: 5, kind: "megaproject" },
    { id: "mirror_cell", name: "Mirror cell", stage: 5, kind: "megaproject" },
    { id: "relay_core", name: "Relay core", stage: 5, kind: "megaproject" },
    { id: "lattice_strut", name: "Lattice strut", stage: 5, kind: "megaproject" },
] as const;

// One recipe per item. ids are r_<output>. Inputs are stage-ordered: no input is a later stage than its output.
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

    // Clockworks
    { id: "r_motor", machine: "assembler", inputs: [{ item: "iron_gear", qty: 2 }, { item: "copper_wire", qty: 3 }], output: { item: "motor", qty: 1 }, craftSeconds: 4 },
    { id: "r_servo", machine: "assembler", inputs: [{ item: "motor", qty: 1 }, { item: "circuit_board", qty: 1 }, { item: "iron_gear", qty: 2 }], output: { item: "servo", qty: 1 }, craftSeconds: 5 },
    { id: "r_photocell", machine: "assembler", inputs: [{ item: "silicon", qty: 2 }, { item: "aluminium_casing", qty: 1 }], output: { item: "photocell", qty: 1 }, craftSeconds: 5 },
    { id: "r_quartz_lens", machine: "assembler", inputs: [{ item: "quartz", qty: 6 }, { item: "aluminium_sheet", qty: 2 }], output: { item: "quartz_lens", qty: 1 }, craftSeconds: 6 },

    // Megaproject
    { id: "r_sail_panel", machine: "fabricator", inputs: [{ item: "frame", qty: 2 }, { item: "photocell", qty: 2 }], output: { item: "sail_panel", qty: 1 }, craftSeconds: 12 },
    { id: "r_mirror_cell", machine: "fabricator", inputs: [{ item: "photocell", qty: 2 }, { item: "quartz_lens", qty: 1 }, { item: "aluminium_casing", qty: 1 }], output: { item: "mirror_cell", qty: 1 }, craftSeconds: 10 },
    { id: "r_relay_core", machine: "fabricator", inputs: [{ item: "servo", qty: 1 }, { item: "circuit_board", qty: 2 }, { item: "copper_wire", qty: 2 }], output: { item: "relay_core", qty: 1 }, craftSeconds: 8 },
    { id: "r_lattice_strut", machine: "fabricator", inputs: [{ item: "steel_beam", qty: 2 }, { item: "frame", qty: 2 }], output: { item: "lattice_strut", qty: 1 }, craftSeconds: 10 },
] as const;

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
    { id: "sail_panels", name: "Sail panels", cost: 10, requires: ["photocells", "frames"], recipes: ["r_sail_panel"] },
    { id: "mirror_cells", name: "Mirror cells", cost: 10, requires: ["photocells", "quartz_optics"], recipes: ["r_mirror_cell"] },
    { id: "relay_cores", name: "Relay cores", cost: 12, requires: ["servos", "circuits"], recipes: ["r_relay_core"] },
    { id: "lattice_struts", name: "Lattice struts", cost: 10, requires: ["steel_beams", "frames"], recipes: ["r_lattice_strut"] },
] as const;

// Blueprints granted per stage: 10 + 20 + 30 + 35 + 40 = 135, enough to buy every research node (109).
const MILESTONES = [
    { id: "ms_smelting", name: "First smelt run", stage: 1, deliver: [{ item: "iron_ingot", qty: 50 }, { item: "copper_ingot", qty: 30 }, { item: "silicon", qty: 10 }], blueprints: 10 },
    { id: "ms_forming", name: "Plate line online", stage: 2, deliver: [{ item: "iron_plate", qty: 60 }, { item: "copper_wire", qty: 60 }, { item: "steel_ingot", qty: 30 }, { item: "aluminium_sheet", qty: 20 }], blueprints: 20 },
    { id: "ms_components", name: "Components crate", stage: 3, deliver: [{ item: "iron_gear", qty: 30 }, { item: "circuit_board", qty: 20 }, { item: "aluminium_casing", qty: 20 }, { item: "frame", qty: 20 }, { item: "steel_beam", qty: 10 }], blueprints: 30 },
    { id: "ms_clockworks", name: "Clockwork shipment", stage: 4, deliver: [{ item: "motor", qty: 10 }, { item: "servo", qty: 6 }, { item: "photocell", qty: 10 }, { item: "quartz_lens", qty: 4 }], blueprints: 35 },
    { id: "ms_megaproject", name: "Megaproject, first light", stage: 5, deliver: [{ item: "sail_panel", qty: 3 }, { item: "mirror_cell", qty: 3 }, { item: "relay_core", qty: 3 }, { item: "lattice_strut", qty: 3 }], blueprints: 40 },
] as const;

export const RECIPE_TREE: RecipeTree = {
    items: ITEMS.map((i) => ({ ...i })),
    machines: MACHINES,
    recipes: RECIPES.map((r) => ({
        id: r.id,
        machine: r.machine,
        inputs: r.inputs.map((s) => ({ ...s })),
        output: { ...r.output },
        craftSeconds: r.craftSeconds,
    })),
    nodes: RAW_NODES.map((n) => ({ ...n })),
    research: RESEARCH.map((n) => ({ ...n, requires: [...n.requires], recipes: [...n.recipes] })),
    milestones: MILESTONES.map((m) => ({ ...m, deliver: m.deliver.map((s) => ({ ...s })) })),
    prestige: {
        name: "Open a new workshop",
        keeps: ["blueprints", "research", "routes", "unlocked designs"],
        resets: ["machines", "stock"],
    },
};
