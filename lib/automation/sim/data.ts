// Engine data and a small placeholder tree for tests. The real tree is RECIPE_TREE in lib/automation/data/tree.ts (Recipe thread).
// Engine numbers live here (belts, hub, costs, power, tuning), never in the engine code.
import type { Catalog, EngineDef, MachineSpec, RecipeTree, Tune } from "../types";

export const PLACEHOLDER_TREE: RecipeTree = {
    items: [
        { id: "ore-a", name: "Ore A", stage: 0, kind: "raw" },
        { id: "ore-b", name: "Ore B", stage: 0, kind: "raw" },
        { id: "plate-a", name: "Plate A", stage: 1, kind: "material" },
        { id: "plate-b", name: "Plate B", stage: 1, kind: "material" },
        { id: "part-x", name: "Part X", stage: 2, kind: "part" },
    ],
    machines: [
        { id: "drill", name: "Node drill", unlockStage: 0, speed: 1, footprint: { w: 1, d: 1 } },
        { id: "smelter", name: "Smelter", unlockStage: 1, speed: 1, footprint: { w: 2, d: 2 } },
        { id: "press", name: "Press", unlockStage: 2, speed: 1, footprint: { w: 2, d: 2 } },
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

export const ENGINE_DATA: { engine: Record<string, EngineDef>; machine: Record<string, MachineSpec>; tune: Tune } = {
    engine: {
        hub: { kind: "hub", name: "Core hub", footprint: { w: 2, d: 2 }, cost: [], placeable: false },
        belt: { kind: "belt", name: "Brass belt", footprint: { w: 1, d: 1 }, cost: [{ item: "plate-a", qty: 1 }], belt: { speed: 1, spacing: 0.25 } },
        "belt-copper": { kind: "belt", name: "Copper belt", footprint: { w: 1, d: 1 }, cost: [{ item: "plate-a", qty: 2 }, { item: "plate-b", qty: 1 }], belt: { speed: 2, spacing: 0.25 } },
        "belt-steel": { kind: "belt", name: "Steel belt", footprint: { w: 1, d: 1 }, cost: [{ item: "plate-a", qty: 3 }, { item: "plate-b", qty: 2 }], belt: { speed: 4, spacing: 0.25 } },
        "power-plant": { kind: "generator", name: "Power plant", footprint: { w: 2, d: 2 }, cost: [{ item: "plate-a", qty: 10 }, { item: "plate-b", qty: 5 }], supply: 150 },
    },
    machine: {
        drill: { cost: [{ item: "plate-a", qty: 4 }], power: 30 },
        smelter: { cost: [{ item: "plate-a", qty: 6 }], power: 60 },
        press: { cost: [{ item: "plate-a", qty: 8 }, { item: "plate-b", qty: 4 }], power: 90 },
    },
    tune: {
        maxAwaySeconds: 8 * 3600,
        fineWindow: 300,
        fineDt: 0.1,
        coarseDt: 1,
        inputBufferMult: 2,
        defaultOutputCap: 20,
        dayLength: 1200,
    },
};

export const PLACEHOLDER_CATALOG: Catalog = {
    tree: PLACEHOLDER_TREE,
    engine: ENGINE_DATA.engine,
    machine: ENGINE_DATA.machine,
    tune: ENGINE_DATA.tune,
};

export const DEFAULT_CATALOG: Catalog = PLACEHOLDER_CATALOG;
