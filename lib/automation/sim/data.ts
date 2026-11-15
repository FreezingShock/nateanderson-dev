// Engine data and a small placeholder tree for tests. The real tree is RECIPE_TREE in lib/automation/data/tree.ts (Recipe thread).
// Engine numbers live here (belts, hub, costs, power, tuning), never in the engine code.
import type { Catalog, EngineDef, LogisticsKind, RecipeTree, Stack, Tune } from "../types";
import { RECIPE_TREE } from "../data/tree";

export const PLACEHOLDER_TREE: RecipeTree = {
    items: [
        { id: "ore-a", name: "Ore A", stage: 0, kind: "raw" },
        { id: "ore-b", name: "Ore B", stage: 0, kind: "raw" },
        { id: "plate-a", name: "Plate A", stage: 1, kind: "material" },
        { id: "plate-b", name: "Plate B", stage: 1, kind: "material" },
        { id: "part-x", name: "Part X", stage: 2, kind: "part" },
    ],
    machines: [
        { id: "drill", name: "Node drill", unlockStage: 0, speed: 1, footprint: { w: 1, d: 1 }, powerKw: 30, buildCost: [{ item: "plate-a", qty: 4 }] },
        { id: "smelter", name: "Smelter", unlockStage: 1, speed: 1, footprint: { w: 2, d: 2 }, powerKw: 60, buildCost: [{ item: "plate-a", qty: 6 }] },
        { id: "press", name: "Press", unlockStage: 2, speed: 1, footprint: { w: 2, d: 2 }, powerKw: 90, buildCost: [{ item: "plate-a", qty: 8 }, { item: "plate-b", qty: 4 }] },
        { id: "windmill", name: "Windmill", unlockStage: 0, speed: 1, footprint: { w: 2, d: 2 }, powerKw: 0, generatesKw: 30, supplyRange: 6, buildCost: [{ item: "plate-a", qty: 10 }] },
        { id: "spring_winder", name: "Spring winder", unlockStage: 0, speed: 1, footprint: { w: 2, d: 2 }, powerKw: 0, generatesKw: 60, supplyRange: 6, buildCost: [{ item: "plate-a", qty: 10 }, { item: "plate-b", qty: 5 }] },
    ],
    recipes: [
        { id: "smelt-a", machine: "smelter", inputs: [{ item: "ore-a", qty: 2 }], output: { item: "plate-a", qty: 1 }, craftSeconds: 3 },
        { id: "smelt-b", machine: "smelter", inputs: [{ item: "ore-b", qty: 2 }], output: { item: "plate-b", qty: 1 }, craftSeconds: 3 },
        { id: "press-x", machine: "press", inputs: [{ item: "plate-a", qty: 1 }, { item: "plate-b", qty: 1 }], output: { item: "part-x", qty: 1 }, craftSeconds: 2 },
    ],
    nodes: [
        { item: "ore-a", baseRatePerMin: 30 },
        { item: "ore-b", baseRatePerMin: 30 },
    ],
    research: [],
    milestones: [],
    prestige: { name: "Open a new workshop", keeps: ["blueprints", "research", "routes"], resets: ["machines", "stock"] },
};

// Logistics pieces. Ids match the belt model ids in #325: belt-<kind> for brass, belt-<kind>-copper and belt-<kind>-steel for the other tiers.
const TIER_NAMES = ["Brass", "Copper", "Steel"];
const TIER_SUFFIX = ["", "-copper", "-steel"];
const TIER_RATE = [2, 4, 8]; // items per second: what a belt of the same tier carries (speed divided by item spacing)
const TIER_EXTRA: Stack[][] = [[], [{ item: "copper_wire", qty: 2 }], [{ item: "steel_ingot", qty: 2 }]];

const LOGISTICS_TIERED: { kind: LogisticsKind; slug: string; label: string; cost: Stack[] }[] = [
    { kind: "splitter", slug: "splitter", label: "Splitter", cost: [{ item: "iron_plate", qty: 2 }, { item: "iron_gear", qty: 1 }] },
    { kind: "merger", slug: "merger", label: "Merger", cost: [{ item: "iron_plate", qty: 2 }, { item: "iron_gear", qty: 1 }] },
    { kind: "tunnel-in", slug: "underground-in", label: "Tunnel entrance", cost: [{ item: "iron_plate", qty: 3 }] },
    { kind: "tunnel-out", slug: "underground-out", label: "Tunnel exit", cost: [{ item: "iron_plate", qty: 3 }] },
    { kind: "loader", slug: "loader", label: "Loader", cost: [{ item: "iron_plate", qty: 2 }, { item: "iron_gear", qty: 2 }] },
    { kind: "unloader", slug: "unloader", label: "Unloader", cost: [{ item: "iron_plate", qty: 2 }, { item: "iron_gear", qty: 2 }] },
];

function logisticsEngine(): Record<string, EngineDef> {
    const out: Record<string, EngineDef> = {};
    for (const p of LOGISTICS_TIERED) {
        for (let t = 0; t < TIER_NAMES.length; t++) {
            out[`belt-${p.slug}${TIER_SUFFIX[t]}`] = {
                kind: p.kind,
                name: `${TIER_NAMES[t]} ${p.label.toLowerCase()}`,
                footprint: { w: 1, d: 1 },
                // Brass pieces cost the full recipe; copper and steel pieces cost only their extra items, so they read as cheap upgrades.
                cost: t === 0 ? p.cost : TIER_EXTRA[t],
                rate: TIER_RATE[t],
                capacity: 8,
            };
        }
    }
    out["belt-crate"] = { kind: "storage", name: "Storage crate", footprint: { w: 1, d: 1 }, cost: [{ item: "iron_plate", qty: 4 }, { item: "iron_gear", qty: 2 }], capacity: 200 };
    out["belt-strongbox"] = { kind: "storage", name: "Strongbox", footprint: { w: 1, d: 1 }, cost: [{ item: "iron_plate", qty: 4 }, { item: "steel_ingot", qty: 4 }], capacity: 1000 };
    out["belt-dock"] = { kind: "dock", name: "Delivery dock", footprint: { w: 3, d: 3 }, cost: [{ item: "iron_plate", qty: 12 }, { item: "copper_wire", qty: 6 }] };
    return out;
}

export const ENGINE_DATA: { engine: Record<string, EngineDef>; tune: Tune } = {
    engine: {
        ...logisticsEngine(),
        hub: { kind: "hub", name: "Core hub", footprint: { w: 3, d: 3 }, cost: [], placeable: false },
        belt: { kind: "belt", name: "Brass belt", footprint: { w: 1, d: 1 }, cost: [{ item: "plate-a", qty: 1 }], belt: { speed: 1, spacing: 0.5 } },
        "belt-copper": { kind: "belt", name: "Copper belt", footprint: { w: 1, d: 1 }, cost: [{ item: "plate-a", qty: 2 }, { item: "plate-b", qty: 1 }], belt: { speed: 2, spacing: 0.5 } },
        "belt-steel": { kind: "belt", name: "Steel belt", footprint: { w: 1, d: 1 }, cost: [{ item: "plate-a", qty: 3 }, { item: "plate-b", qty: 2 }], belt: { speed: 4, spacing: 0.5 } },
    },
    tune: {
        maxAwaySeconds: 8 * 3600,
        fineWindow: 300,
        fineDt: 0.1,
        coarseDt: 1,
        inputBufferMult: 2,
        defaultOutputCap: 20,
        dayLength: 1200,
        springSeconds: 120,
    },
};

// The engine runs on the real tree. Tests and the placeholder run use PLACEHOLDER_CATALOG.
export const PLACEHOLDER_CATALOG: Catalog = {
    tree: PLACEHOLDER_TREE,
    engine: ENGINE_DATA.engine,
    tune: ENGINE_DATA.tune,
};

// The three plain belts cost placeholder plates in ENGINE_DATA (the tests and the placeholder run use them).
// On the real tree brass belts are free and copper and steel cost real items.
const REAL_BELT_COST: Record<string, Stack[]> = {
    belt: [], // brass belts are free, so a new player can run smelter to hub at once
    "belt-copper": [{ item: "iron_plate", qty: 1 }, { item: "copper_wire", qty: 1 }],
    "belt-steel": [{ item: "iron_plate", qty: 1 }, { item: "copper_wire", qty: 1 }, { item: "steel_ingot", qty: 1 }],
};

export const DEFAULT_CATALOG: Catalog = {
    tree: RECIPE_TREE,
    engine: {
        ...ENGINE_DATA.engine,
        ...Object.fromEntries(Object.entries(REAL_BELT_COST).map(([id, cost]) => [id, { ...ENGINE_DATA.engine[id], cost }])),
    },
    tune: ENGINE_DATA.tune,
};

// Where the first workshop's resource nodes sit on the 18 x 12 board, one per ore in tree order. The host, the
// opening tests and the pacing bot all import this; never copy the array.
export const START_NODE_SPOTS: readonly (readonly [number, number])[] = [[2, 2], [2, 8], [15, 2], [15, 8], [8, 1]];

// Island sites offered at "Open a new workshop". Each has its own nodes, floor size, hub spot and one bonus.
export interface SiteDef {
    id: string;
    name: string;
    blurb: string;
    width: number;
    depth: number;
    hub: { x: number; z: number };
    nodes: { x: number; z: number; item: string; purity: number }[];
    bonus: { miner: number; power: number };
}

// Every site carries one node for each raw ore in the real tree (iron, copper, coal, quartz, aluminium), so the
// megaproject can be built on any of them. The old placeholder ids (ore-a, ore-b) never mined anything after a prestige.
export const SITES: SiteDef[] = [
    {
        id: "ridge", name: "Iron ridge", blurb: "Open ground with iron close to the surface.", width: 56, depth: 56, hub: { x: 26, z: 26 },
        nodes: [
            { x: 8, z: 26, item: "iron_ore", purity: 2 },
            { x: 12, z: 32, item: "coal", purity: 1 },
            { x: 8, z: 38, item: "copper_ore", purity: 1 },
            { x: 46, z: 12, item: "quartz", purity: 1 },
            { x: 46, z: 42, item: "aluminium_ore", purity: 1 },
        ],
        bonus: { miner: 1.15, power: 1 },
    },
    {
        id: "cove", name: "Copper cove", blurb: "A sheltered cove with strong wind power.", width: 64, depth: 48, hub: { x: 30, z: 20 },
        nodes: [
            { x: 6, z: 10, item: "copper_ore", purity: 2 },
            { x: 6, z: 18, item: "aluminium_ore", purity: 1 },
            { x: 6, z: 26, item: "iron_ore", purity: 1 },
            { x: 6, z: 34, item: "coal", purity: 1 },
            { x: 44, z: 12, item: "quartz", purity: 1 },
        ],
        bonus: { miner: 1, power: 1.2 },
    },
    {
        id: "high-bank", name: "High bank", blurb: "A tall bank with two rich seams.", width: 72, depth: 72, hub: { x: 34, z: 34 },
        nodes: [
            { x: 14, z: 34, item: "quartz", purity: 2 },
            { x: 20, z: 40, item: "aluminium_ore", purity: 1 },
            { x: 58, z: 14, item: "iron_ore", purity: 1 },
            { x: 58, z: 58, item: "copper_ore", purity: 1 },
            { x: 14, z: 58, item: "coal", purity: 1 },
        ],
        bonus: { miner: 1, power: 1.1 },
    },
    {
        id: "quarry", name: "Old quarry", blurb: "A worked-out quarry with dense, pure ore.", width: 48, depth: 48, hub: { x: 22, z: 22 },
        nodes: [
            { x: 6, z: 22, item: "iron_ore", purity: 2 },
            { x: 6, z: 30, item: "copper_ore", purity: 1 },
            { x: 6, z: 38, item: "coal", purity: 1 },
            { x: 40, z: 8, item: "quartz", purity: 1 },
            { x: 40, z: 40, item: "aluminium_ore", purity: 1 },
        ],
        bonus: { miner: 1.25, power: 0.9 },
    },
];

// Stock a new world starts with when the caller gives none: enough for two drills, a kiln and a run of belts.
// Drill and kiln have no build cost in the Recipe tree yet, so this covers them and the belts; see STATUS.md.
export const STARTER_KIT: Stack[] = [
    { item: "iron_plate", qty: 80 }, // windmills cost 8 plates each and the press is not open until milestone 1
    { item: "copper_wire", qty: 20 },
    { item: "iron_gear", qty: 6 },
];

// What the hub holds when a new workshop opens. Prestige empties the hub, and every power source costs items, so without a
// kit the new floor could never run a machine. Each workshop already opened adds a little more, so a later floor starts faster.
export function workshopKit(opened: number): Stack[] {
    const extra = Math.min(opened, 5);
    return [
        { item: "iron_plate", qty: 80 + 20 * extra },
        { item: "copper_wire", qty: 20 + 10 * extra },
        { item: "iron_gear", qty: 6 + 2 * extra },
        { item: "steel_ingot", qty: 10 + 5 * extra },
    ];
}

// Workshop commissions: after the Sky orrery's first light the hub keeps asking for work, one order at a time.
// Each pays blueprints (for mastery research) and a supply crate. Orders past the list repeat the last one with more parts.
export interface CommissionDef {
    name: string;
    deliver: Stack[];
    blueprints: number;
    reward: Stack[];
}

const COMMISSIONS: CommissionDef[] = [
    {
        name: "Spare circuits",
        deliver: [{ item: "circuit_board", qty: 20 }, { item: "frame", qty: 15 }, { item: "steel_beam", qty: 8 }],
        blueprints: 8,
        reward: [{ item: "iron_plate", qty: 30 }, { item: "copper_wire", qty: 30 }],
    },
    {
        name: "Clockwork order",
        deliver: [{ item: "motor", qty: 12 }, { item: "servo", qty: 6 }, { item: "photocell", qty: 10 }, { item: "quartz_lens", qty: 4 }],
        blueprints: 10,
        reward: [{ item: "steel_ingot", qty: 30 }, { item: "iron_gear", qty: 12 }],
    },
    {
        name: "Orrery spares",
        deliver: [{ item: "sail_panel", qty: 2 }, { item: "mirror_cell", qty: 2 }, { item: "relay_core", qty: 2 }, { item: "lattice_strut", qty: 2 }],
        blueprints: 12,
        reward: [{ item: "steel_ingot", qty: 30 }, { item: "copper_wire", qty: 30 }],
    },
];

export function commissionDef(n: number): CommissionDef {
    if (n < COMMISSIONS.length) return COMMISSIONS[n];
    const more = n - COMMISSIONS.length + 1;
    const last = COMMISSIONS[COMMISSIONS.length - 1];
    return {
        name: `Grand commission ${more}`,
        deliver: last.deliver.map((s) => ({ item: s.item, qty: s.qty + more })),
        blueprints: last.blueprints + 2 * more,
        reward: last.reward.map((s) => ({ item: s.item, qty: s.qty + 10 * more })),
    };
}
