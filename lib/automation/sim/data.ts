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
        { id: "spring_winder", name: "Spring winder", unlockStage: 0, speed: 1, footprint: { w: 2, d: 2 }, powerKw: 0, generatesKw: 60, supplyRange: 4, buildCost: [{ item: "plate-a", qty: 10 }, { item: "plate-b", qty: 5 }] },
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
const TIER_RATE = [1, 2, 4]; // items per second, the same ladder as the belts
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
                cost: [...p.cost, ...TIER_EXTRA[t]],
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
        belt: { kind: "belt", name: "Brass belt", footprint: { w: 1, d: 1 }, cost: [{ item: "plate-a", qty: 1 }], belt: { speed: 1, spacing: 0.25 } },
        "belt-copper": { kind: "belt", name: "Copper belt", footprint: { w: 1, d: 1 }, cost: [{ item: "plate-a", qty: 2 }, { item: "plate-b", qty: 1 }], belt: { speed: 2, spacing: 0.25 } },
        "belt-steel": { kind: "belt", name: "Steel belt", footprint: { w: 1, d: 1 }, cost: [{ item: "plate-a", qty: 3 }, { item: "plate-b", qty: 2 }], belt: { speed: 4, spacing: 0.25 } },
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

export const DEFAULT_CATALOG: Catalog = {
    tree: RECIPE_TREE,
    engine: ENGINE_DATA.engine,
    tune: ENGINE_DATA.tune,
};

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

export const SITES: SiteDef[] = [
    { id: "ridge", name: "Iron ridge", blurb: "Open ground with iron close to the surface.", width: 56, depth: 56, hub: { x: 26, z: 26 }, nodes: [{ x: 8, z: 26, item: "ore-a", purity: 1 }, { x: 12, z: 30, item: "ore-b", purity: 1 }], bonus: { miner: 1.15, power: 1 } },
    { id: "cove", name: "Copper cove", blurb: "A sheltered cove with strong wind power.", width: 64, depth: 48, hub: { x: 30, z: 20 }, nodes: [{ x: 6, z: 10, item: "ore-a", purity: 2 }, { x: 6, z: 14, item: "ore-b", purity: 0.5 }], bonus: { miner: 1, power: 1.2 } },
    { id: "high-bank", name: "High bank", blurb: "A tall bank with two rich seams.", width: 72, depth: 72, hub: { x: 34, z: 34 }, nodes: [{ x: 14, z: 34, item: "ore-a", purity: 1 }, { x: 20, z: 40, item: "ore-b", purity: 1 }, { x: 14, z: 40, item: "ore-a", purity: 0.5 }], bonus: { miner: 1, power: 1.1 } },
    { id: "quarry", name: "Old quarry", blurb: "A worked-out quarry with dense, pure ore.", width: 48, depth: 48, hub: { x: 22, z: 22 }, nodes: [{ x: 6, z: 22, item: "ore-b", purity: 2 }], bonus: { miner: 1.25, power: 0.9 } },
];
