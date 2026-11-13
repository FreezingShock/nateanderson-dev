// Shape of the Brasswork content data.
// Type-only on purpose: the data files only use `import type`, so the same
// files load in the browser (Next), in tsc, and in plain Node via
// `node --experimental-strip-types` for the checks and tests.

/** Progression stage. 0 = raw, 5 = megaproject. */
export type Stage = 0 | 1 | 2 | 3 | 4 | 5;

export type ItemKind = "raw" | "material" | "part" | "module" | "megaproject";

export type Purity = "impure" | "normal" | "pure";

export interface ItemDef {
    id: string;
    name: string;
    stage: Stage;
    kind: ItemKind;
    /** One short line for the codex and tooltips. */
    note?: string;
}

export interface MachineDef {
    id: string;
    name: string;
    /** First stage where the machine can be built. */
    unlockStage: Stage;
    /** Speed multiplier. 1 is the base machine. */
    speed: number;
    /** Footprint on the voxel island grid, in cells. */
    footprint: { w: number; d: number };
    note?: string;
}

export interface Stack {
    item: string;
    qty: number;
}

/**
 * One recipe per item (v1). A recipe makes exactly one output stack.
 * craftSeconds is the time for one craft at speed 1.
 */
export interface RecipeDef {
    id: string;
    machine: string;
    inputs: Stack[];
    output: Stack;
    craftSeconds: number;
}

/** A raw resource. A drill on a `normal` node produces baseRatePerMin at speed 1. */
export interface ResourceNodeDef {
    item: string;
    baseRatePerMin: number;
}

/**
 * Research is paid in blueprints. Recipes listed here stay locked until the
 * node is bought. Recipes not listed in any node are base recipes, free from the start.
 */
export interface ResearchDef {
    id: string;
    name: string;
    /** Blueprints to buy the node. */
    cost: number;
    /** Node ids that must be bought first. */
    requires: string[];
    /** Recipe ids this node unlocks. */
    recipes: string[];
    note?: string;
}

/**
 * A milestone delivery: a cumulative batch of items shipped to the hub.
 * Completing it grants blueprints.
 */
export interface MilestoneDef {
    id: string;
    name: string;
    stage: Stage;
    deliver: Stack[];
    blueprints: number;
}

/** The one prestige. Keeps blueprints, research, routes and unlocked designs. Resets machines and stock. */
export interface PrestigeDef {
    name: string;
    keeps: string[];
    resets: string[];
}

export interface RecipeTree {
    items: ItemDef[];
    machines: MachineDef[];
    recipes: RecipeDef[];
    nodes: ResourceNodeDef[];
    research: ResearchDef[];
    milestones: MilestoneDef[];
    prestige: PrestigeDef;
}

// ---- Engine types (Simulation thread). Content above is owned by the Recipe thread; the engine below is owned by Simulation. ----

/** Grid cell on the island. Cell (x, z) covers [x, x+1) by [z, z+1). */
export interface Cell {
    x: number;
    z: number;
}

/** Rotation: 0 is +z, 1 is +x, 2 is -z, 3 is -x. */
export type Rot = 0 | 1 | 2 | 3;
export const DIR_DX: readonly number[] = [0, 1, 0, -1];
export const DIR_DZ: readonly number[] = [1, 0, -1, 0];

export interface Footprint {
    w: number; // along x before rotation
    d: number; // along z before rotation
}

export interface BeltSpec {
    speed: number; // cells per second
    spacing: number; // minimum gap between items, in cells (0.25 at speed 1 is 4 items per second)
}

/** Engine-only buildings: belts, the hub and generators. Machines from the tree are not listed here. */
export interface EngineDef {
    kind: "hub" | "belt" | "generator";
    name: string;
    footprint: Footprint;
    cost: Stack[]; // paid from the hub stock; half comes back on removal
    placeable?: boolean; // default true
    belt?: BeltSpec;
    supply?: number; // kW, generators only
}

/** Cost and power for a machine from the tree. Machines not listed here cost nothing and draw no power. */
export interface MachineSpec {
    cost: Stack[];
    power: number; // kW drawn while running
}

export interface Tune {
    maxAwaySeconds: number;
    fineWindow: number;
    fineDt: number;
    coarseDt: number;
    inputBufferMult: number; // a crafter holds this many batches' worth of each input
    defaultOutputCap: number; // per item
    dayLength: number; // seconds for one full day-night cycle
}

export interface Catalog {
    tree: RecipeTree;
    engine: Record<string, EngineDef>;
    machine: Record<string, MachineSpec>;
    tune: Tune;
}

export interface BeltItem {
    item: string;
    pos: number; // 0 at the entry, 1 at the exit; ordered lead first
}

export interface Building {
    id: number;
    type: string; // a tree machine id or an engine id
    x: number;
    z: number;
    rot: Rot;
    recipe: string | null;
    crafting: boolean;
    progress: number;
    input: Record<string, number>; // crafter input buffer; the hub keeps its stock here
    output: Record<string, number>; // miner and crafter output buffer
    acc: number;
    lane: BeltItem[];
    rr: number;
}

export interface Deposit {
    item: string;
    purity: number; // impure 0.5, normal 1, pure 2 (see PURITY)
}

export interface PowerSnapshot {
    supply: number;
    demand: number;
    satisfaction: number;
}

export interface Progress {
    blueprints: number;
    researched: string[]; // research node ids
    milestonesDone: string[];
    delivered: Record<string, number>; // cumulative items that reached the hub
    prestiges: number;
}

export interface World {
    version: number;
    time: number;
    width: number;
    depth: number;
    nextId: number;
    hubId: number;
    deposits: Record<string, Deposit>; // keyed "x,z"
    buildings: Record<number, Building>;
    power: PowerSnapshot;
    progress: Progress;
}

export type PlaceResult = { ok: true; id: number } | { ok: false; reason: string };
export type ActionResult = { ok: true } | { ok: false; reason: string };
