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
    /** Power drawn while running, in kW. 0 for none. */
    powerKw: number;
    /** Power made, in kW. Only generators set this (wind, spring). */
    generatesKw?: number;
    /** Generators only: how far power reaches, in grid cells. Zones are range-based, no pipes. */
    supplyRange?: number;
    /** Items spent to place the machine. Missing means free. */
    buildCost?: Stack[];
    note?: string;
}

export interface Stack {
    item: string;
    qty: number;
}

/**
 * A recipe makes exactly one output stack. craftSeconds is the time for one craft at speed 1.
 * Each item has one base recipe. Alternates (alternate: true) are unlocked by a research node and
 * are only used when a caller picks them with solve()'s choice map.
 */
export interface RecipeDef {
    id: string;
    machine: string;
    inputs: Stack[];
    output: Stack;
    craftSeconds: number;
    /** Optional recipe, unlocked by research and only used when chosen. Default false (base). */
    alternate?: boolean;
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
