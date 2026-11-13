import type {
  HudData,
  MachineDetail,
  MachineView,
  ResourceView,
} from "./types";

// Mock data for the HUD. Numbers are placeholders, not balance.

export const mockResources: ResourceView[] = [
  { id: "iron", name: "Iron", group: "raw", glyph: "FE", amount: 640, perSecond: 4.8 },
  { id: "copper", name: "Copper", group: "raw", glyph: "CU", amount: 212, perSecond: 1.6 },
  { id: "coal", name: "Coal", group: "raw", glyph: "CO", amount: 1290, perSecond: 6 },
  { id: "quartz", name: "Quartz", group: "raw", glyph: "QZ", amount: 38, perSecond: 0.2 },
  { id: "silicon", name: "Silicon", group: "raw", glyph: "SI", amount: 0, perSecond: 0 },
  { id: "aluminium", name: "Aluminium", group: "raw", glyph: "AL", amount: 0, perSecond: 0 },
  { id: "plates", name: "Plates", group: "part", glyph: "PL", amount: 96, perSecond: 1.4 },
  { id: "screws", name: "Screws", group: "part", glyph: "SC", amount: 310, perSecond: 2.1 },
  { id: "wire", name: "Wire", group: "part", glyph: "WI", amount: 44, perSecond: 0.5 },
  { id: "frames", name: "Frames", group: "part", glyph: "FR", amount: 12, perSecond: 0.1 },
  { id: "motors", name: "Motors", group: "part", glyph: "MO", amount: 0, perSecond: 0 },
  { id: "circuits", name: "Circuits", group: "part", glyph: "CI", amount: 0, perSecond: 0 },
  { id: "clockworks", name: "Clockworks", group: "part", glyph: "CK", amount: 0, perSecond: 0 },
];

export const mockMachines: MachineView[] = [
  {
    id: "drill",
    name: "Coal drill",
    glyph: "CD",
    unlocked: true,
    count: 4,
    cost: [{ resourceId: "iron", amount: 20 }],
    status: "running",
  },
  {
    id: "smelter",
    name: "Iron smelter",
    glyph: "IS",
    unlocked: true,
    count: 3,
    cost: [
      { resourceId: "iron", amount: 60 },
      { resourceId: "coal", amount: 25 },
    ],
    status: "running",
  },
  {
    id: "press",
    name: "Plate press",
    glyph: "PP",
    unlocked: true,
    count: 2,
    cost: [
      { resourceId: "iron", amount: 35 },
      { resourceId: "screws", amount: 6 },
    ],
    status: "starved",
  },
  {
    id: "wiremill",
    name: "Wire mill",
    glyph: "WM",
    unlocked: true,
    count: 0,
    cost: [
      { resourceId: "copper", amount: 120 },
      { resourceId: "plates", amount: 40 },
    ],
    status: "idle",
  },
  {
    id: "frame",
    name: "Frame bench",
    glyph: "FB",
    unlocked: false,
    lockedReason: "Needs a milestone blueprint",
    count: 0,
    cost: [
      { resourceId: "plates", amount: 80 },
      { resourceId: "screws", amount: 120 },
    ],
    status: "idle",
  },
];

const RECIPES: Record<string, Pick<MachineDetail, "recipe" | "rates" | "buffers">> = {
  drill: {
    recipe: {
      name: "Dig coal",
      inputs: [],
      outputs: [{ resourceId: "coal", amount: 2 }],
      seconds: 1,
    },
    rates: [
      { label: "Output", value: "2 coal / s each" },
      { label: "Running", value: "4 of 4" },
    ],
    buffers: [{ resourceId: "coal", have: 38, max: 60 }],
  },
  smelter: {
    recipe: {
      name: "Smelt iron",
      inputs: [
        { resourceId: "iron", amount: 2 },
        { resourceId: "coal", amount: 1 },
      ],
      outputs: [{ resourceId: "iron", amount: 3 }],
      seconds: 3,
    },
    rates: [
      { label: "Output", value: "1 iron / s each" },
      { label: "Running", value: "3 of 3" },
    ],
    buffers: [
      { resourceId: "iron", have: 9, max: 20 },
      { resourceId: "coal", have: 0, max: 8 },
    ],
  },
  press: {
    recipe: {
      name: "Press plates",
      inputs: [
        { resourceId: "iron", amount: 3 },
        { resourceId: "screws", amount: 1 },
      ],
      outputs: [{ resourceId: "plates", amount: 1 }],
      seconds: 4,
    },
    rates: [
      { label: "Output", value: "0.25 plates / s each" },
      { label: "Waiting on", value: "screws" },
    ],
    buffers: [
      { resourceId: "iron", have: 9, max: 12 },
      { resourceId: "screws", have: 0, max: 6 },
    ],
  },
  wiremill: {
    recipe: {
      name: "Draw wire",
      inputs: [{ resourceId: "copper", amount: 2 }],
      outputs: [{ resourceId: "wire", amount: 3 }],
      seconds: 3,
    },
    rates: [{ label: "Output", value: "locked until built" }],
    buffers: [{ resourceId: "copper", have: 0, max: 20 }],
  },
  frame: {
    recipe: {
      name: "Brace frames",
      inputs: [
        { resourceId: "plates", amount: 4 },
        { resourceId: "screws", amount: 8 },
      ],
      outputs: [{ resourceId: "frames", amount: 1 }],
      seconds: 6,
    },
    rates: [{ label: "Output", value: "locked" }],
    buffers: [{ resourceId: "plates", have: 0, max: 16 }],
  },
};

/** Builds the inspector view for one machine from the recipe table above. */
export function detailFor(machine: MachineView): MachineDetail {
  const r = RECIPES[machine.id];
  return { ...machine, ...r };
}

export const mockHud: HudData = {
  resources: mockResources,
  machines: mockMachines,
  selected: null,
  areas: [
    { id: "floor", name: "Workshop floor", note: "Drills, smelters, presses", state: "current" },
    { id: "quarry", name: "Quarry shelf", note: "Quartz seams, first expedition", state: "open" },
    { id: "foundry", name: "Copper ridge", note: "Opens after the first milestone", state: "locked" },
  ],
  milestones: [
    { id: "m1", name: "First shelf", goal: "Deliver 100 plates", progress: 0.96, blueprintReward: 1, done: false },
    { id: "m2", name: "Wired up", goal: "Deliver 50 wire", progress: 0.88, blueprintReward: 1, done: false },
    { id: "m3", name: "Steady hands", goal: "Run 3 presses for 10 min", progress: 1, blueprintReward: 2, done: true },
  ],
  blueprints: 3,
  research: [
    { id: "r-belt", name: "Belt lines", note: "Moves parts without a Scripts run", blueprintCost: 1, requires: [], state: "done" },
    { id: "r-silicon", name: "Silicon refining", note: "Unlocks silicon from quartz", blueprintCost: 2, requires: [], state: "available" },
    { id: "r-alu", name: "Aluminium casting", note: "Unlocks aluminium from ore", blueprintCost: 3, requires: ["r-silicon"], state: "locked" },
    { id: "r-motor", name: "Motor windings", note: "Unlocks motors from wire and frames", blueprintCost: 3, requires: ["r-belt"], state: "available" },
  ],
  prestige: {
    ready: false,
    requirement: "Reach 1 M iron made",
    gain: "+5% speed per workshop kept",
  },
  stats: [
    { label: "Iron made", value: "12,406" },
    { label: "Plates made", value: "3,118" },
    { label: "Wire made", value: "892" },
    { label: "Machines built", value: "9" },
    { label: "Time in workshop", value: "2 h 14 m" },
  ],
  nextStep: {
    text: "Build a Wire mill. Milestone two needs 50 wire.",
    actionLabel: "Inspect wire mill",
    actionId: "wiremill",
  },
  settings: {
    sound: true,
    reduceMotion: false,
    lowFx: false,
    numberFormat: "short",
    showRates: true,
  },
};
