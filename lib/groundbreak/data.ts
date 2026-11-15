// Groundbreak data tables. Everything the balance depends on lives here, so the spec's final numbers, materials, jobs and
// perks can be dropped in without touching engine.ts. Pure TypeScript: no React, no DOM.
// Source of truth for the design: /mnt/project-files/portfolio/groundbreak/SPEC.md.

export const N = 12; // materials
export const TIERS = 3; // I crew, II equipment, III method

export const TIER_NAMES = ["I", "II", "III"] as const;
export const TIER_LABELS = ["Crew", "Equipment", "Method"] as const;

export interface Material {
    id: string;
    name: string;
    sym: string;
    /** equipment the tier II button buys */
    equip: string;
    /** tier III (one-time) */
    method: string;
    /** small side effect of the method, shown in its tooltip */
    methodFx: Partial<Record<FxKey, number>>;
    methodNote: string;
}

export const MATS: Material[] = [
    { id: "gravel", name: "Gravel", sym: "G", equip: "Wheel loader", method: "Crushed base", methodFx: { permit: 0.03 }, methodNote: "permits 3% faster" },
    { id: "sand", name: "Sand", sym: "S", equip: "Screening plant", method: "Wash plant", methodFx: { speed: 1.03 }, methodNote: "jobs build 3% faster" },
    { id: "cement", name: "Cement", sym: "C", equip: "Rotary kiln", method: "Dry kiln", methodFx: { crewCost: 0.02 }, methodNote: "crews 2% cheaper" },
    { id: "concrete", name: "Concrete", sym: "K", equip: "Drum mixer", method: "Ready-mix trucks", methodFx: { speed: 1.04 }, methodNote: "jobs build 4% faster" },
    { id: "rebar", name: "Rebar", sym: "R", equip: "Bar bender", method: "Prefab cages", methodFx: { score: 0.05 }, methodNote: "inspections +0.05" },
    { id: "steel", name: "Steel beams", sym: "B", equip: "Rolling mill", method: "Bolted frames", methodFx: { pay: 1.03 }, methodNote: "payouts +3%" },
    { id: "glass", name: "Glass panels", sym: "P", equip: "Float line", method: "Tempered line", methodFx: { score: 0.05 }, methodNote: "inspections +0.05" },
    { id: "wire", name: "Copper wire", sym: "W", equip: "Wire drawer", method: "Pre-pulled runs", methodFx: { permit: 0.04 }, methodNote: "permits 4% faster" },
    { id: "duct", name: "Ductwork", sym: "D", equip: "Sheet brake", method: "Prefab duct", methodFx: { crewCost: 0.03 }, methodNote: "crews 3% cheaper" },
    { id: "precast", name: "Precast panels", sym: "T", equip: "Precast yard", method: "Slipform core", methodFx: { speed: 1.05 }, methodNote: "jobs build 5% faster" },
    { id: "curtain", name: "Curtain wall", sym: "U", equip: "Glazing rig", method: "Unitized curtain wall", methodFx: { pay: 1.05 }, methodNote: "payouts +5%" },
    { id: "floors", name: "Floors", sym: "F", equip: "Tower crane", method: "Modular floors", methodFx: { repGain: 1.05 }, methodNote: "reputation +5%" },
];

/** Geometric ladder: first value times ratio^i, rounded to 3 significant digits. */
const geo = (first: number, ratio: number, n = N) => Array.from({ length: n }, (_, i) => Number((first * Math.pow(ratio, i)).toPrecision(3)));

/** Spend to unlock material n (paid in material n-1). The first is free (gravel). */
export const UNLOCK_COST = [0, 20, 90, 6e3, 6.2e4, 3.3e5, 5.2e5, 5.2e5, 5.6e5, 7.3e5, 3.7e6, 5e6];
/**
 * What a material eats while it is made, per unit: [material, units]. Only Floors run as a true pipeline (SPEC section 1);
 * the other eleven are made from nothing and paid for by the hires, so ratios do not multiply down the chain.
 */
export const RECIPE: [number, number][][] = [[], [], [], [], [], [], [], [], [], [], [], [[3, 3], [5, 1], [6, 1]]];
/** Output per crew per second before any boost. */
export const BASE_RATE = geo(1, 0.98);
/** Tier I crew: first price, in the material before it (gravel crews cost gravel); each hire costs crewGrowth more. */
export const CREW_COST = geo(35, 0.9);
/** Tier II equipment: first price, in the material before it; each level costs equipGrowth x more and doubles the row. */
export const EQUIP_COST = geo(77, 3.7);
/** Tier III method: one-time cash price; needs equipNeed equipment levels in the row first. */
export const METHOD_COST = geo(300, 3);

export const TUNE = {
    cap: 1e300,
    crewGrowth: 1.15,
    equipGrowth: 8,
    equipMult: 2,
    methodMult: 3,
    equipNeed: 2,
    /** every this many crews in a row doubles it */
    milestone: 25,
    /** forward boost: rate(n+1) x (1 + log10(1 + amount(n)) x fwd) */
    fwd: 0.25,
    /** back boost from the last three materials: rate(n-1) x (1 + log10(1 + amount(n)) x back) */
    back: 0.5,
    backFrom: 9,
    /** extra global effects of the last three: crew speed, payouts, reputation. Each is 1 + log10(1 + amount) x this. */
    extra: 0.05,
    /** change order: seconds it waits, the extra materials as a share of the phase, and the bonus on the payout */
    changeWait: 75,
    changeExtra: 0.6,
    changeBonus: 0.35,
    /** an accepted change order makes the inspection ask for this much more score */
    changeScore: 0.6,
    /** reputation lifts all production by 1 + rep x this */
    repBoost: 0.004,
    startCash: 250,
    startGravel: 40,
    /** seconds a permit takes before a job starts */
    permitSecs: 10,
    /** inspection score: base plus reputation share plus perks; a job asks for `need`; a shortfall stretches the inspection */
    scoreBase: 1,
    scoreRep: 0.0005,
    delayCap: 3,
    /** overtime: cash per remaining inspection second, as a share of the payout over the inspection length */
    overtime: 0.6,
    /** offline catch-up: hours, steps and the length of one step */
    offlineH: 8,
    offlineStepCap: 7200,
    /** Charter points = floor(sqrt(rep earned this firm / charterDiv)) */
    charterDiv: 4,
    charterMinRep: 60,
    /** skyline entries kept (oldest dropped past this) */
    skylineCap: 600,
    /** autobuy only spends this share of what it holds */
    autoShare: 0.25,
    /** repeat orders (the firm rebuilds its latest job while the next campaign job waits on a material): share of the cash and reputation, paid pro rata if the crew is pulled off early */
    /** share of a job's cash paid out as progress draws, a slice per finished phase; the handover pays the rest */
    draw: 0.5,
    /** seconds of the new row's output stocked the moment a material opens */
    unlockGiftSecs: 60,
    repeatCash: 0.5,
    repeatRep: 0.1,
};

// ---- effects ------------------------------------------------------------------------------------------------------

export type FxKey =
    | "crew" | "speed" | "pay" | "repGain" | "charter" | "change"
    | "permit" | "inspect" | "score" | "crewCost"
    | "offlineH" | "auto" | "startCash" | "startRep" | "startUnlock" | "keepMethods";
export const MUL_FX: FxKey[] = ["crew", "speed", "pay", "repGain", "charter", "change"];
export const FX_KEYS: FxKey[] = ["crew", "speed", "pay", "repGain", "charter", "change", "permit", "inspect", "score", "crewCost", "offlineH", "auto", "startCash", "startRep", "startUnlock", "keepMethods"];

// ---- jobs ---------------------------------------------------------------------------------------------------------

export type PhaseId = "prep" | "foundation" | "structure" | "envelope" | "mep" | "fitout";
/** Build order. Each phase pulls the materials listed here; a job only runs the phases it needs materials for. */
export const PHASES: { id: PhaseId; name: string; mats: number[]; share: number }[] = [
    { id: "prep", name: "Site prep", mats: [0, 1], share: 0.1 },
    { id: "foundation", name: "Foundation", mats: [2, 3], share: 0.2 },
    { id: "structure", name: "Structure", mats: [4, 5, 9], share: 0.3 },
    { id: "envelope", name: "Envelope", mats: [6, 10], share: 0.15 },
    { id: "mep", name: "MEP rough-in", mats: [7, 8], share: 0.1 },
    { id: "fitout", name: "Fit-out", mats: [11], share: 0.15 },
];

/** A career has five stages; stage s opens when its last material is unlocked. */
export const STAGES = [
    { id: 1, name: "Patch crew", mats: 3 },
    { id: 2, name: "Site contractor", mats: 5 },
    { id: 3, name: "General contractor", mats: 8 },
    { id: 4, name: "Builder", mats: 10 },
    { id: 5, name: "Megaproject firm", mats: 12 },
];
/** Material units a job asks for per weight point, by stage. */
export const SCALE = [30, 300, 3e3, 3e4, 3e4];
/** Cash per stage; a job multiplies it. */
export const PAY = [60, 700, 1.4e4, 4e5, 1.4e7];
/** Build seconds per stage at full supply. */
export const SECS = [45, 80, 150, 300, 840];
export const REP = [2, 8, 30, 100, 350];
/** Inspection score a stage asks for. */
export const NEED = [0.8, 1, 1.3, 1.8, 2.6];

export interface JobDef {
    id: string;
    name: string;
    stage: number;
    floors: number;
    kind: string;
    /** real build order, for the walkthrough art and the job card */
    notes: string[];
    /** weights over the 12 materials (zero allowed) */
    mix: number[];
    cash: number;
    repGain: number;
    secs: number;
    inspect: number;
    permit: number;
    need: number;
    ending?: boolean;
    needs: [number, number][];
}

type Draft = Omit<JobDef, "needs" | "cash" | "repGain" | "secs" | "inspect" | "permit" | "need"> & { payX?: number; repX?: number; secsX?: number };
const w = (...v: number[]) => Array.from({ length: N }, (_, i) => v[i] ?? 0);

function mkJob(d: Draft): JobDef {
    const st = d.stage - 1;
    const needs = d.mix.map((x, m) => [m, Math.round(x * SCALE[st])] as [number, number]).filter(([, q]) => q > 0);
    const secs = SECS[st] * (d.secsX ?? 1);
    return {
        ...d,
        needs,
        cash: Math.round(PAY[st] * (d.payX ?? 1)),
        repGain: Math.round(REP[st] * (d.repX ?? 1)),
        secs,
        inspect: Math.round(secs * 0.4),
        permit: TUNE.permitSecs * (1 + st * 0.5),
        need: NEED[st],
    };
}

/** The campaign, in the order the firm builds it (SPEC section 4). The next job starts when one is handed over, once its stage is open. */
const DRAFTS: Draft[] = [
    { id: "sidewalk", name: "Sidewalk run", stage: 1, floors: 0, kind: "paving", notes: ["Formwork", "Pour", "Cure"], mix: w(3, 2, 1) },
    { id: "driveway", name: "Driveway", stage: 1, floors: 0, kind: "paving", notes: ["Base gravel", "Pour"], mix: w(4, 1, 2), payX: 1.3 },
    { id: "house", name: "Two-storey house", stage: 2, floors: 2, kind: "housing", notes: ["Slab", "Wood frame", "Roof", "Windows"], mix: w(2, 1, 2, 3), payX: 1.2, repX: 1.2 },
    { id: "firestation", name: "Fire station", stage: 2, floors: 2, kind: "civic", notes: ["Slab", "CMU walls", "Bay doors"], mix: w(1, 1, 2, 3, 2), payX: 0.8, repX: 2 },
    { id: "parking", name: "Parking deck", stage: 3, floors: 4, kind: "civic", notes: ["Precast columns", "Post-tensioned decks"], mix: w(1, 1, 3, 4, 3, 2), payX: 1.5, repX: 0.7 },
    { id: "school", name: "School", stage: 3, floors: 3, kind: "civic", notes: ["Steel frame", "Gym roof trusses"], mix: w(1, 1, 2, 2, 2, 3, 3), payX: 0.8, repX: 2 },
    { id: "clinic", name: "Harbor Clinic", stage: 3, floors: 6, kind: "healthcare", notes: ["Spread footings", "Steel frame", "Skin", "MEP"], mix: w(1, 1, 2, 3, 2, 4, 3, 1), payX: 1.3, repX: 1.2 },
    { id: "midrise", name: "Mid-rise office", stage: 4, floors: 12, kind: "office", notes: ["Core first", "Floor cycle", "Curtain wall"], mix: w(1, 1, 2, 3, 3, 4, 2, 2, 2), payX: 1.2, repX: 1.2 },
    { id: "watertower", name: "Water tower", stage: 4, floors: 0, kind: "utility", notes: ["Pile cap", "Steel legs", "Tank welds"], mix: w(2, 1, 3, 3, 2, 6, 1, 0, 1, 2), payX: 0.8, repX: 2 },
    { id: "footbridge", name: "Cable footbridge", stage: 4, floors: 0, kind: "civil", notes: ["Piers", "Cable stays", "Deck"], mix: w(2, 1, 3, 3, 4, 5, 1, 1, 1, 4), payX: 1, repX: 1.6 },
    { id: "stadium", name: "Stadium", stage: 5, floors: 4, kind: "arena", notes: ["Bowl rakers", "Roof truss lift"], mix: w(2, 2, 4, 6, 4, 6, 2, 3, 2, 8, 3), payX: 1.8, repX: 1.6 },
    { id: "tower", name: "40-storey tower", stage: 5, floors: 40, kind: "tower", notes: ["Piles", "Slipform core", "Floor cycle x40", "Crown"], mix: w(1, 1, 2, 4, 4, 5, 3, 3, 3, 5, 6, 8), payX: 1.6, repX: 1.2 },
    { id: "bridge", name: "Suspension bridge", stage: 5, floors: 0, kind: "landmark", notes: ["Caissons", "Towers", "Cables spun", "Deck lifted"], mix: w(2, 2, 4, 6, 6, 8, 2, 4, 2, 8, 3, 3), payX: 3, repX: 3, secsX: 1.5, ending: true },
];

export const JOBS: JobDef[] = [];
export const JOB_BY = new Map<string, JobDef>();
/** Rebuild JOBS from the drafts and the per-stage tables (the balance sim edits SCALE, PAY and SECS first). */
export function rebuildJobs() {
    JOBS.splice(0, JOBS.length, ...DRAFTS.map(mkJob));
    JOB_BY.clear();
    for (const j of JOBS) JOB_BY.set(j.id, j);
}
rebuildJobs();

/** After the bridge, a firm keeps building the last three jobs in a loop (harder each lap) until it incorporates. */
export const LOOP_FROM = JOBS.length - 3;
export const jobAt = (i: number): JobDef => (i < JOBS.length ? JOBS[i] : JOBS[LOOP_FROM + ((i - LOOP_FROM) % 3)]);

// ---- regions (one per firm; they repeat with a growing scale) ------------------------------------------------------------

export interface City {
    id: string;
    name: string;
    blurb: string;
    /** a site for each of the five stages (the real Bay Area; the art hangs a backdrop on each) */
    sites: [string, string, string, string, string];
    /** palette hint for the art: sky tone at golden hour */
    sky: string;
    /** multiplies production of the listed materials (index -> factor) */
    mat?: Record<number, number>;
    fx?: Partial<Record<FxKey, number>>;
}
export const CITIES: City[] = [
    { id: "eastbay", name: "East Bay", blurb: "Oakland to Fremont. Flat ground and cheap gravel.", sites: ["Oakland waterfront", "San Leandro", "Fremont", "Emeryville", "East span"], sky: "amber", mat: { 0: 1.5, 1: 1.5 } },
    { id: "peninsula", name: "Peninsula", blurb: "Daly City to Palo Alto. Glass and steel come in by ship.", sites: ["Daly City", "San Mateo", "Palo Alto", "Redwood City", "Dumbarton crossing"], sky: "rose", mat: { 5: 1.6, 6: 1.6 } },
    { id: "southbay", name: "South Bay", blurb: "San Jose and the valley. Fast permits, big contracts.", sites: ["Milpitas", "Santa Clara", "San Jose", "Sunnyvale", "Alviso crossing"], sky: "copper", fx: { permit: 0.3, pay: 1.2 } },
    { id: "northbay", name: "North Bay", blurb: "Marin and Sonoma hills. Quarry country, strict inspectors.", sites: ["San Rafael", "Novato", "Santa Rosa", "Sausalito", "Richmond-San Rafael crossing"], sky: "dusk", mat: { 2: 1.6, 3: 1.6 }, fx: { score: -0.1 } },
    { id: "sanfrancisco", name: "San Francisco", blurb: "A tall city. Floors and curtain wall run hot.", sites: ["Bayview", "Mission Bay", "SoMa", "Financial District", "Golden Gate approach"], sky: "violet", mat: { 10: 1.5, 11: 1.5 } },
    { id: "deltabay", name: "Delta and Tri-Valley", blurb: "The long game. Everything you have learned counts.", sites: ["Pittsburg", "Livermore", "Dublin", "Walnut Creek", "Carquinez crossing"], sky: "gold", fx: { crew: 1.15, repGain: 1.15 } },
];
export const cityOf = (firm: number): City => CITIES[firm % CITIES.length];
export const cityLoop = (firm: number) => Math.floor(firm / CITIES.length);

// ---- Charter perks (spent after Incorporate) ----------------------------------------------------------------------

export interface Perk { id: string; name: string; desc: string; cost: number; req: string[]; fx: Partial<Record<FxKey, number>>; branch: "ops" | "money" | "logistics" }
export const PERKS: Perk[] = [
    // Operations: crews and equipment
    { id: "o1", name: "Standing crews", desc: "All crews work 2x.", cost: 1, req: [], fx: { crew: 2 }, branch: "ops" },
    { id: "o2", name: "Foreman", desc: "Hires tier I crews for you, a little at a time.", cost: 3, req: ["o1"], fx: { auto: 1 }, branch: "ops" },
    { id: "o3", name: "Cheaper hiring", desc: "Crews cost 15% less.", cost: 4, req: ["o1"], fx: { crewCost: 0.15 }, branch: "ops" },
    { id: "o4", name: "Fleet manager", desc: "Buys equipment for you when it is cheap.", cost: 8, req: ["o2"], fx: { auto: 1 }, branch: "ops" },
    { id: "o5", name: "Second shift", desc: "All crews work 2x.", cost: 14, req: ["o3"], fx: { crew: 2 }, branch: "ops" },
    { id: "o6", name: "Method library", desc: "Keep methods when you incorporate.", cost: 30, req: ["o4", "o5"], fx: { keepMethods: 1 }, branch: "ops" },
    { id: "o7", name: "Round the clock", desc: "All crews work 3x.", cost: 70, req: ["o6"], fx: { crew: 3 }, branch: "ops" },
    // Money: payouts and reputation
    { id: "m1", name: "Better bids", desc: "Payouts +25%.", cost: 1, req: [], fx: { pay: 1.25 }, branch: "money" },
    { id: "m2", name: "Start-up capital", desc: "Each new firm starts with $2,000 and 20 reputation.", cost: 3, req: ["m1"], fx: { startCash: 1750, startRep: 20 }, branch: "money" },
    { id: "m3", name: "Good name", desc: "Reputation gain +50%.", cost: 5, req: ["m1"], fx: { repGain: 1.5 }, branch: "money" },
    { id: "m4", name: "Repeat clients", desc: "Payouts +50%.", cost: 12, req: ["m2"], fx: { pay: 1.5 }, branch: "money" },
    { id: "m5", name: "Holding company", desc: "Charter gain +30%.", cost: 20, req: ["m3"], fx: { charter: 1.3 }, branch: "money" },
    { id: "m6", name: "Landmark portfolio", desc: "Payouts x2.", cost: 60, req: ["m4", "m5"], fx: { pay: 2 }, branch: "money" },
    // Logistics: speed, permits, inspections, QOL
    { id: "l1", name: "Quick permits", desc: "Permits take 40% less.", cost: 2, req: [], fx: { permit: 0.4 }, branch: "logistics" },
    { id: "l2", name: "Night shift", desc: "Jobs build 1.25x faster.", cost: 6, req: ["l1"], fx: { speed: 1.25 }, branch: "logistics" },
    { id: "l3", name: "Night watch", desc: "Offline catch-up up to 16 hours.", cost: 5, req: ["l1"], fx: { offlineH: 8 }, branch: "logistics" },
    { id: "l5", name: "Trusted inspector", desc: "Inspections +0.5 and 30% shorter.", cost: 16, req: ["l3"], fx: { score: 0.5, inspect: 0.3 }, branch: "logistics" },
    { id: "l6", name: "Tower cranes everywhere", desc: "Jobs build 1.5x faster.", cost: 28, req: ["l2", "l5"], fx: { speed: 1.5 }, branch: "logistics" },
    { id: "l8", name: "Head start", desc: "New firms begin with Sand already unlocked.", cost: 24, req: ["l2"], fx: { startUnlock: 1 }, branch: "logistics" },
    { id: "l9", name: "Change-order desk", desc: "Change orders pay 50% more.", cost: 9, req: ["l1"], fx: { change: 1.5 }, branch: "logistics" },
];
