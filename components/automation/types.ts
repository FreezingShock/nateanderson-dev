// Typed props for Brasswork's 2D interface (the HUD around the 3D view).
// HudData is the contract: the simulation's hudData() returns it.

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
  /** Theoretical rates at full buffers and current power, not measured. */
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
  /** Placeholder code for the node icon. */
  glyph: string;
  /** Plain line on what the node unlocks, e.g. "Photocell recipe". */
  unlocks: string;
  blueprintCost: number;
  /** Grid position: column 0..4 (stage), row 0..4 within the grid. */
  column: number;
  row: number;
  /** Ids of nodes that must be researched first. */
  requires: string[];
  state: "done" | "available" | "locked";
};

/** One of the island sites a prestige can move the workshop to. */
export type PrestigeSite = {
  id: string;
  name: string;
  floor: string;
  /** Plain line on the site's ore, e.g. "3 in range, 1 pure". */
  ore: string;
  /** Plain line on the bonus, e.g. "+12 BP, x1.9 speed". */
  bonus: string;
};

export type PrestigeView = {
  ready: boolean;
  /** Plain line on what is needed, e.g. "Reach 1 M iron made". */
  requirement: string;
  /** Things kept across the move. */
  keeps: string[];
  /** Things left behind on the old site. */
  leaves: string[];
  /** Sites to choose from. The player picks one, then holds to confirm. */
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

export type HudActions = {
  onBuild: (machineId: string) => void;
  onSelect: (machineId: string | null) => void;
  onNextStep?: (actionId: string) => void;
  onSelectArea?: (areaId: string) => void;
  onResearch?: (nodeId: string) => void;
  /** Called once the player has picked a site and held to confirm. */
  onPrestige?: (siteId: string) => void;
  onSettings: (patch: Partial<HudSettings>) => void;
};
