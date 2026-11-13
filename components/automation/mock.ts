import type {
  HudData,
  MachineDetail,
  MachineView,
  ResourceView,
} from "@/lib/automation/types";

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
    { id: "gear", name: "Gear cutting", glyph: "GC", note: "Iron gear", unlocks: ["Iron gear"], blueprintCost: 3, column: 0, row: 0, requires: [], state: "done" },
    { id: "alloy", name: "Alloy furnaces", glyph: "AF", note: "Aluminium and steel ingot", unlocks: ["Aluminium and steel ingot"], blueprintCost: 4, column: 0, row: 1, requires: [], state: "done" },
    { id: "sheet", name: "Sheet rolling", glyph: "SR", note: "Aluminium sheet", unlocks: ["Aluminium sheet"], blueprintCost: 4, column: 0, row: 2, requires: [], state: "done" },
    { id: "frames", name: "Frames", glyph: "FR", note: "Frame", unlocks: ["Frame"], blueprintCost: 4, column: 0, row: 3, requires: [], state: "done" },
    { id: "motor", name: "Motors", glyph: "MO", note: "Motor", unlocks: ["Motor"], blueprintCost: 6, column: 1, row: 0, requires: ["gear"], state: "done" },
    { id: "si", name: "Silicon wafers", glyph: "SW", note: "Silicon", unlocks: ["Silicon"], blueprintCost: 6, column: 1, row: 1, requires: ["alloy"], state: "done" },
    { id: "beam", name: "Beam forming", glyph: "BF", note: "Steel beam", unlocks: ["Steel beam"], blueprintCost: 5, column: 1, row: 2, requires: ["alloy", "sheet"], state: "available" },
    { id: "cas", name: "Aluminium casings", glyph: "AC", note: "Aluminium casing", unlocks: ["Aluminium casing"], blueprintCost: 5, column: 1, row: 3, requires: ["sheet"], state: "done" },
    { id: "circ", name: "Circuit boards", glyph: "CB", note: "Circuit board", unlocks: ["Circuit board"], blueprintCost: 8, column: 2, row: 1, requires: ["si"], state: "available" },
    { id: "photo", name: "Photocells", glyph: "PC", note: "Photocell recipe", unlocks: ["Photocell recipe"], blueprintCost: 8, column: 2, row: 2, requires: ["si", "cas"], state: "available" },
    { id: "opt", name: "Quartz optics", glyph: "QO", note: "Quartz lens", unlocks: ["Quartz lens"], blueprintCost: 6, column: 2, row: 3, requires: ["cas"], state: "available" },
    { id: "lat", name: "Lattice struts", glyph: "LS", note: "Lattice strut", unlocks: ["Lattice strut"], blueprintCost: 10, column: 2, row: 4, requires: ["beam", "frames"], state: "locked" },
    { id: "servo", name: "Servos", glyph: "SV", note: "Servo", unlocks: ["Servo"], blueprintCost: 8, column: 3, row: 0, requires: ["motor", "circ"], state: "locked" },
    { id: "sail", name: "Sail panels", glyph: "SP", note: "Sail panel", unlocks: ["Sail panel"], blueprintCost: 10, column: 3, row: 2, requires: ["photo", "frames"], state: "locked" },
    { id: "mirror", name: "Mirror cells", glyph: "MC", note: "Mirror cell", unlocks: ["Mirror cell"], blueprintCost: 10, column: 3, row: 3, requires: ["photo", "opt"], state: "locked" },
    { id: "relay", name: "Relay cores", glyph: "RC", note: "Relay core", unlocks: ["Relay core"], blueprintCost: 12, column: 4, row: 0, requires: ["servo", "circ"], state: "locked" },
  ],
  prestige: {
    ready: false,
    requirement: "Reach 1 M iron made",
    gain: "+5% speed per workshop kept",
    keeps: ["Blueprints and research", "Unlocked designs", "Routes found", "One free machine of each kind", "Records"],
    leaves: ["Machines and belts", "Stored stock", "Fleets on expedition"],
    sites: ["Workshop 3, The Quarry Flats", "Workshop 2, The East Shore", "Workshop 4, The High Pass"],
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
