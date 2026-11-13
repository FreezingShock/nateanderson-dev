// Starwright data: the element ladder, the constellation and pulsar trees, planets and every tuning number.
// Numbers live here, never in the engine. Pure data, no React and no DOM, so the sim script and the tests load it under node.

export const ELEMENTS = [
    { sym: "H", name: "Hydrogen", w: 1, color: "#5fb4ff" },
    { sym: "He", name: "Helium", w: 4, color: "#ffc94d" },
    { sym: "C", name: "Carbon", w: 12, color: "#b4b9c4" },
    { sym: "O", name: "Oxygen", w: 16, color: "#3fe0a0" },
    { sym: "Ne", name: "Neon", w: 20, color: "#ff5fc8" },
    { sym: "Mg", name: "Magnesium", w: 24, color: "#ff9a4d" },
    { sym: "Si", name: "Silicon", w: 28, color: "#a98bff" },
    { sym: "Fe", name: "Iron", w: 56, color: "#e8e2d6" },
    { sym: "Au", name: "Gold", w: 197, color: "#ffd75e" },
    { sym: "U", name: "Uranium", w: 238, color: "#9dff6a" },
] as const;

export const N = ELEMENTS.length; // 10
export const ROWS = N - 1; // 9 fusion rows; element i is fused into i + 1
export const TIERS = 3;
/** Levels each tier button adds (the tiers are the bulk buy; there is no x10 or max). */
export const TIER_LEVELS = [1, 10, 100] as const;
export const TIER_NAMES = ["I", "II", "III"] as const;

/** What one unit of element i + 1 costs: [element, amount]. */
export const RECIPE: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
    [[0, 4]], // 4 H -> He
    [[1, 3]], // 3 He -> C (triple alpha)
    [[2, 1], [1, 1]], // C + He -> O
    [[3, 1], [1, 1]], // O + He -> Ne
    [[4, 1], [1, 1]], // Ne + He -> Mg
    [[5, 1], [1, 1]], // Mg + He -> Si
    [[6, 2]], // 2 Si -> Fe
    [[7, 3]], // 3 Fe -> Au (neutron star only)
    [[8, 2]], // 2 Au -> U (neutron star only)
];

/** Core heat (million kelvin) each fusion needs. */
export const GATE_MK = [10, 40, 150, 300, 500, 800, 1200, 4000, 10000];

/** Price of the first level of each row, paid in the element being burned. */
export const BASE_COST = [18, 45, 160, 700, 3000, 14000, 70000, 2e7, 1e9];
export const TIER_COST_X = 9;
export const COST_GROWTH = 1.12;
/** Output of one level, in units of the next element per second. */
export const BASE_RATE = [0.9, 0.5, 0.32, 0.22, 0.16, 0.12, 0.09, 0.03, 0.012];

export const TUNE = {
    inflowBase: 2,
    inflowK: 3,
    inflowExp: 0.6,
    heatK: 3,
    heatExp: 0.4,
    heatEase: 5, // seconds for heat to close most of the gap to its target
    needGrow: 1.5,
    feNeed: 1500, // Iron for a 100% collapse
    seedK: 60, // stardust at 100% collapse
    seedExp: 0.5,
    neutronAt: 3000, // stardust earned in one neutron layer before a neutron star can form
    neutronDiv: 300,
    horizonU: 250000, // Uranium for a black hole
    offlineH: 8,
    offlineStepCap: 7200,
    milestone: 25,
    cap: 1e300,
    autoCost: 0.2, // autoburn only spends this share of the stock
};

export type FxKey =
    | "inflow"
    | "fuse"
    | "heat"
    | "stardust"
    | "global"
    | "heavy"
    | "planet"
    | "gate"
    | "need"
    | "auto"
    | "offline"
    | "keepPlanets"
    | "startH"
    | "keepStardust"
    | "horizon";

export interface Perk {
    id: string;
    name: string;
    desc: string;
    cost: number;
    req: string[];
    at: [number, number]; // percent of the star chart
    con: string;
    fx: Partial<Record<FxKey, number>>;
}

export const CONSTELLATIONS = [
    { id: "lantern", name: "The Lantern", blurb: "Gas and light. Pull in more hydrogen.", color: "#5fb4ff" },
    { id: "kiln", name: "The Kiln", blurb: "Heat and pressure. Fuse faster, at lower heat.", color: "#ff9a4d" },
    { id: "anvil", name: "The Anvil", blurb: "Iron and fallout. A harder collapse pays more.", color: "#e8e2d6" },
    { id: "loom", name: "The Loom", blurb: "Hands off. Automation, planets and long nights.", color: "#a98bff" },
] as const;

export const PERKS: Perk[] = [
    { id: "l1", con: "lantern", name: "Open aperture", desc: "Hydrogen inflow x2.", cost: 3, req: [], at: [10, 24], fx: { inflow: 2 } },
    { id: "l2", con: "lantern", name: "Gas stream", desc: "Hydrogen inflow x2.", cost: 12, req: ["l1"], at: [22, 13], fx: { inflow: 2 } },
    { id: "l3", con: "lantern", name: "Halo", desc: "Planets are 25% stronger.", cost: 30, req: ["l2"], at: [36, 21], fx: { planet: 0.25 } },
    { id: "l4", con: "lantern", name: "Veil", desc: "Hydrogen inflow x3.", cost: 120, req: ["l3"], at: [47, 11], fx: { inflow: 3 } },
    { id: "k1", con: "kiln", name: "Ignition", desc: "Every fusion x2.", cost: 6, req: [], at: [9, 50], fx: { fuse: 2 } },
    { id: "k2", con: "kiln", name: "Deep core", desc: "Core heat x1.3.", cost: 18, req: ["k1"], at: [22, 60], fx: { heat: 1.3 } },
    { id: "k3", con: "kiln", name: "Pressure well", desc: "Every fusion needs 15% less heat.", cost: 54, req: ["k2"], at: [35, 51], fx: { gate: 0.15 } },
    { id: "k4", con: "kiln", name: "Fusion bloom", desc: "Every fusion x2.", cost: 180, req: ["k3"], at: [47, 61], fx: { fuse: 2 } },
    { id: "k5", con: "kiln", name: "Cold ignition", desc: "Every fusion needs another 20% less heat.", cost: 600, req: ["k4"], at: [58, 51], fx: { gate: 0.2 } },
    { id: "a1", con: "anvil", name: "Heavy seeds", desc: "Stardust from a supernova x1.5.", cost: 9, req: [], at: [74, 22], fx: { stardust: 1.5 } },
    { id: "a2", con: "anvil", name: "Dense core", desc: "The core collapses with 25% less iron.", cost: 36, req: ["a1"], at: [86, 33], fx: { need: 0.25 } },
    { id: "a3", con: "anvil", name: "Remnant", desc: "Each star begins with 100,000 hydrogen.", cost: 75, req: ["a2"], at: [73, 44], fx: { startH: 1e5 } },
    { id: "a4", con: "anvil", name: "Supershell", desc: "Stardust from a supernova x1.5.", cost: 270, req: ["a2"], at: [88, 55], fx: { stardust: 1.5 } },
    { id: "w1", con: "loom", name: "Spindle", desc: "Autoburn: Hydrogen and Helium buy their own tier I.", cost: 24, req: [], at: [20, 80], fx: { auto: 2 } },
    { id: "w2", con: "loom", name: "Shuttle", desc: "Autoburn reaches up to Oxygen.", cost: 90, req: ["w1"], at: [34, 89], fx: { auto: 2 } },
    { id: "w3", con: "loom", name: "Survivors", desc: "Planets survive a supernova.", cost: 150, req: ["w2"], at: [49, 80], fx: { keepPlanets: 1 } },
    { id: "w4", con: "loom", name: "Long watch", desc: "Away time counts for 24 hours, not 8.", cost: 240, req: ["w2"], at: [62, 90], fx: { offline: 16 } },
    { id: "w5", con: "loom", name: "Full loom", desc: "Autoburn runs every row.", cost: 750, req: ["w3"], at: [76, 80], fx: { auto: 5 } },
];

export const PULSAR_PERKS: Perk[] = [
    { id: "p1", con: "pulsar", name: "Spin", desc: "Everything x2.", cost: 1, req: [], at: [14, 50], fx: { global: 2 } },
    { id: "p2", con: "pulsar", name: "Magnetar field", desc: "Core heat x1.5.", cost: 2, req: ["p1"], at: [30, 30], fx: { heat: 1.5 } },
    { id: "p3", con: "pulsar", name: "Kilonova", desc: "Gold and Uranium fuse x5.", cost: 4, req: ["p1"], at: [30, 70], fx: { heavy: 5 } },
    { id: "p4", con: "pulsar", name: "Afterglow", desc: "Keep 10% of your stardust through a neutron star.", cost: 4, req: ["p2"], at: [48, 18], fx: { keepStardust: 0.1 } },
    { id: "p5", con: "pulsar", name: "Ember sky", desc: "Every star begins with the first perk of each constellation.", cost: 3, req: ["p2"], at: [46, 44], fx: {} },
    { id: "p6", con: "pulsar", name: "Beam", desc: "Stardust x2.", cost: 8, req: ["p5"], at: [64, 32], fx: { stardust: 2 } },
    { id: "p7", con: "pulsar", name: "Horizon sense", desc: "A black hole needs half the uranium.", cost: 12, req: ["p3"], at: [48, 78], fx: { horizon: 0.5 } },
    { id: "p8", con: "pulsar", name: "Echo", desc: "Everything x3.", cost: 20, req: ["p6", "p7"], at: [82, 56], fx: { global: 3 } },
];

export interface Planet {
    id: string;
    name: string;
    kind: string;
    cost: Array<[number, number]>;
    bonus: string;
    fx: Partial<Record<FxKey, number>>;
    /** orbit radius as a share of the scene, period in seconds, size in px of the 160 buffer */
    orbit: number;
    period: number;
    size: number;
    color: string;
}

export const PLANETS: Planet[] = [
    { id: "ember", name: "Ember", kind: "rocky world", cost: [[2, 4000]], bonus: "Hydrogen inflow x1.3", fx: { inflow: 1.3 }, orbit: 0.52, period: 38, size: 3, color: "#c8643c" },
    { id: "cinder", name: "Cinder", kind: "ash world", cost: [[3, 20000]], bonus: "Every fusion x1.25", fx: { fuse: 1.25 }, orbit: 0.6, period: 51, size: 3, color: "#8a8478" },
    { id: "glass", name: "Glass", kind: "silicate world", cost: [[6, 12000]], bonus: "Core heat x1.15", fx: { heat: 1.15 }, orbit: 0.68, period: 66, size: 4, color: "#7fd0e8" },
    { id: "thule", name: "Thule", kind: "ice world", cost: [[4, 15000], [1, 20000]], bonus: "Fusions need 5% less heat", fx: { gate: 0.05 }, orbit: 0.77, period: 88, size: 3, color: "#c9e6ff" },
    { id: "ironclad", name: "Ironclad", kind: "metal world", cost: [[7, 120]], bonus: "Stardust x1.2", fx: { stardust: 1.2 }, orbit: 0.45, period: 29, size: 2, color: "#b9b2a4" },
    { id: "orrery", name: "Orrery", kind: "moon cluster", cost: [[5, 40000], [6, 4000]], bonus: "Every fusion x1.35", fx: { fuse: 1.35 }, orbit: 0.84, period: 104, size: 2, color: "#d9a8ff" },
    { id: "haze", name: "Haze", kind: "gas giant", cost: [[1, 6e6]], bonus: "Hydrogen inflow x1.5", fx: { inflow: 1.5 }, orbit: 0.92, period: 140, size: 6, color: "#e2b86a" },
    { id: "seer", name: "Seer", kind: "ringed giant", cost: [[0, 5e12], [7, 4000]], bonus: "Everything x1.5", fx: { global: 1.5 }, orbit: 1.0, period: 190, size: 7, color: "#f4d29a" },
];

export const STARNAMES = ["Sol-7", "Vesper", "Calder", "Orrin", "Tamsin", "Halcyon", "Ember Gate", "Lyra-9", "Corvid", "Marrow"];

export const STAGE_NAMES = ["Protostar", "Yellow dwarf", "Red giant", "Blue giant", "Blue supergiant", "Iron core"] as const;
