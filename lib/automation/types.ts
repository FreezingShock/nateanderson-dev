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
    /** Power made, in kW. Only generators set this (windmill, spring winder). */
    generatesKw?: number;
    /** Generators only: how far power reaches, in grid cells. Zones are range-based, no pipes. */
    supplyRange?: number;
    /** Items spent to place the machine. Missing means free. */
    buildCost?: Stack[];
    /** Storage capacity in kJ. Only batteries set this (spring store). */
    storageKj?: number;
    note?: string;
}

/** A placed structure that is not a crafting machine: the hub, and the Sky orrery's build stages. */
export interface StructureDef {
    id: string;
    name: string;
    footprint: { w: number; d: number };
    /** Build stage for multi-stage structures (the orrery is 0 to 4). Absent for single-stage ones. */
    stage?: number;
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
    /** Non-machine structures (hub, orrery stages). Optional so placeholder catalogs still typecheck. */
    structures?: StructureDef[];
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
export type LogisticsKind = "splitter" | "merger" | "tunnel-in" | "tunnel-out" | "loader" | "unloader";

export interface EngineDef {
    kind: "hub" | "belt" | "generator" | "dock" | "storage" | LogisticsKind;
    name: string;
    footprint: Footprint;
    cost: Stack[]; // paid from the hub stock; half comes back on removal
    placeable?: boolean; // default true
    belt?: BeltSpec;
    supply?: number; // kW, generators only
    /** Logistics pieces: items moved per second (brass 1, copper 2, steel 4). */
    rate?: number;
    /** Storage: items kept per item type. Logistics pieces: items held in their buffer. */
    capacity?: number;
}

export interface Tune {
    maxAwaySeconds: number;
    fineWindow: number;
    fineDt: number;
    coarseDt: number;
    inputBufferMult: number; // a crafter holds this many batches' worth of each input
    defaultOutputCap: number; // per item
    dayLength: number; // seconds for one full day-night cycle
    springSeconds: number; // a wound spring stores this many seconds of its own output
}

export interface Catalog {
    tree: RecipeTree;
    engine: Record<string, EngineDef>; // hub and belts only; machines, power and costs come from tree
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
    charge: number; // wound spring: stored energy in kJ (battery); 0 for other buildings
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
    site: string | null; // island site picked at the last prestige
    bonus: { miner: number; power: number }; // multipliers from the site
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
    wind: number; // 0 to 1, rises and falls in gusts; read by the renderer (sway, windmill speed)
    windPin: number | null; // a fixed wind for still-air play and tests; null follows the gusts
}

export type PlaceResult = { ok: true; id: number } | { ok: false; reason: string };
export type ActionResult = { ok: true } | { ok: false; reason: string };

export type NumberFormat = "short" | "full";

export type ResourceGroup = "raw" | "part";

export type ResourceView = {
  id: string;
  name: string;
  group: ResourceGroup;
  /** Placeholder code shown inside the icon until the design thread supplies art. */
  glyph: string;
  amount: number;
  /** Net change per second. Negative values show as a drain. */
  perSecond: number;
};

export type Line = { resourceId: string; amount: number };

export type MachineStatus = "running" | "idle" | "starved" | "blocked";

export type MachineView = {
  id: string;
  name: string;
  glyph: string;
  unlocked: boolean;
  /** Shown in place of the cost line while the machine is locked. */
  lockedReason?: string;
  /** How many of this machine the player owns. */
  count: number;
  /** Cost to build one more. */
  cost: Line[];
  status: MachineStatus;
};

export type MachineDetail = MachineView & {
  recipe: {
    name: string;
    inputs: Line[];
    outputs: Line[];
    seconds: number;
  };
  rates: { label: string; value: string }[];
  buffers: { resourceId: string; have: number; max: number }[];
};

/** Expedition areas, shown in the expedition drawer. */
export type AreaView = {
  id: string;
  name: string;
  note: string;
  state: "current" | "open" | "locked";
};

/** A milestone delivery. Completing one grants blueprints. */
export type MilestoneView = {
  id: string;
  name: string;
  /** Plain line, e.g. "Deliver 500 plates". */
  goal: string;
  progress: number; // 0..1
  blueprintReward: number;
  done: boolean;
};

/** A research node, unlocked by spending blueprints. */
export type ResearchNode = {
  id: string;
  name: string;
  /** Two-letter glyph for the node icon. */
  glyph: string;
  note: string;
  blueprintCost: number;
  requires: string[];
  /** Names of the items this node unlocks recipes for, e.g. "Iron gear". */
  unlocks: string[];
  /** Layout on the research board: column is depth in the requires graph, row is the slot within that column. */
  column: number;
  row: number;
  state: "done" | "available" | "locked";
};

/** One island site offered at prestige: what it is and what it changes. */
export type PrestigeSite = {
  id: string;
  name: string;
  blurb: string;
  /** Plain lines on the bonus, e.g. "Miners +15%". */
  modifiers: string[];
};

export type PrestigeView = {
  ready: boolean;
  /** Plain line on what is needed, e.g. "Reach 1 M brass made". */
  requirement: string;
  /** What the player keeps or gains, e.g. "+5% speed per workshop". */
  gain: string;
  /** Things that carry over a workshop, from the tree. */
  keeps: string[];
  /** Things that reset on a workshop, from the tree. */
  leaves: string[];
  /** The island sites the player can move to. */
  sites: PrestigeSite[];
};

export type StatLine = { label: string; value: string };

export type NextStepView = {
  text: string;
  /** Optional button that acts on the hint, such as selecting the next machine. */
  actionLabel?: string;
  actionId?: string;
};

export type HudSettings = {
  sound: boolean;
  reduceMotion: boolean;
  /** Low-fx: turns off the animated extras (scramble, dither shimmer, drawer slides). */
  lowFx: boolean;
  numberFormat: NumberFormat;
  showRates: boolean;
};

export type HudData = {
  resources: ResourceView[];
  machines: MachineView[];
  selected: MachineDetail | null;
  areas: AreaView[];
  milestones: MilestoneView[];
  blueprints: number;
  research: ResearchNode[];
  prestige: PrestigeView;
  stats: StatLine[];
  nextStep: NextStepView;
  settings: HudSettings;
};
