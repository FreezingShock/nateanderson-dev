// Groundbreak local engine. THIN STAND-IN for lib/groundbreak (owned by the engine thread): same shape of idea (materials chain,
// tiered crew/equipment/method, jobs with phases, inspection payout, Incorporate), kept small so the screen is playable.
// The UI only talks to the functions exported here, so swapping in the real engine means changing this one file's imports.

export const SAVE_KEY = "gb-save-v1";
export const SAVE_VERSION = 1;

export interface Mat {
    id: string; name: string; unit: string; color: string;
    unlockMat: number; unlockAmt: number; base: number; crewCost: number;
    equip: string; method: string; boosts: string;
}
const M = (id: string, name: string, unit: string, color: string, unlockAmt: number, base: number, crewCost: number, equip: string, method: string): Mat =>
    ({ id, name, unit, color, unlockMat: -1, unlockAmt, base, crewCost, equip, method, boosts: "" });

export const MATS: Mat[] = [
    M("gravel", "Gravel", "t", "#c9b79a", 0, 1.2, 12, "Loader", "Ready-mix trucks"),
    M("sand", "Sand", "t", "#e6c07a", 200, 0.9, 90, "Screen plant", "Wet washing"),
    M("cement", "Cement", "t", "#a9adb3", 1e3, 0.7, 600, "Rotary kiln", "Pre-heater tower"),
    M("concrete", "Concrete", "m³", "#8f98a6", 5e3, 0.55, 4e3, "Drum mixer", "Slipform core"),
    M("rebar", "Rebar", "t", "#d9742f", 2e4, 0.45, 3e4, "Bender", "Mesh welding"),
    M("steel", "Steel beams", "t", "#7e8fb0", 8e4, 0.35, 2.4e5, "Rolling mill", "Bolted splices"),
    M("glass", "Glass panels", "m²", "#7fc7d9", 3e5, 0.28, 2e6, "Float line", "Low-e coating"),
    M("wire", "Copper wire", "km", "#d98f52", 1.2e6, 0.22, 1.6e7, "Wire drawer", "Bundled runs"),
    M("duct", "Ductwork", "m", "#9ab0a0", 5e6, 0.18, 1.3e8, "Sheet brake", "Spiral seams"),
    M("precast", "Precast panels", "pcs", "#b7a99a", 2e7, 0.14, 1e9, "Precast yard", "Hollow-core"),
    M("curtain", "Curtain wall", "bays", "#8fb3c2", 8e7, 0.11, 8e9, "Glazing rig", "Unitized frames"),
    M("floors", "Floors", "fl", "#f0b04a", 3e8, 0.09, 6e10, "Tower crane", "Jump forms"),
];
MATS.forEach((m, i) => { m.unlockMat = i - 1; if (i < MATS.length - 1) m.boosts = MATS[i + 1].name; });
export const NMAT = MATS.length;

export interface Phase { name: string; mat: number }
export interface JobDef { id: string; name: string; stage: number; floors: number; scale: number; pay: number; rep: number; repReq: number; blurb: string; phases: Phase[] }
const P = (name: string, mat: number): Phase => ({ name, mat });
const SITE = P("Site prep", 0), FOUND = P("Foundation", 3), FRAME = P("Structure", 5), SKIN = P("Envelope", 6), MEP = P("MEP rough-in", 8), FIT = P("Fit-out", 10);
export const JOBS: JobDef[] = [
    { id: "sidewalk", name: "Sidewalk run", stage: 1, floors: 1, scale: 0.12, pay: 140, rep: 2, repReq: 0, blurb: "Forms, pour, cure", phases: [P("Formwork", 0), P("Pour", 2)] },
    { id: "driveway", name: "Driveway", stage: 1, floors: 1, scale: 0.35, pay: 520, rep: 4, repReq: 0, blurb: "Base gravel, pour", phases: [P("Base gravel", 0), P("Pour", 2)] },
    { id: "house", name: "Two-storey house", stage: 2, floors: 2, scale: 1.2, pay: 4.8e3, rep: 12, repReq: 0, blurb: "Slab, frame, roof", phases: [SITE, P("Slab", 3), P("Frame", 4), P("Roof", 4)] },
    { id: "firehouse", name: "Fire station", stage: 2, floors: 2, scale: 2.6, pay: 1.1e4, rep: 22, repReq: 0, blurb: "Slab, block walls, bay doors", phases: [SITE, P("Slab", 3), P("Block walls", 4), P("Bay doors", 5)] },
    { id: "clinic", name: "Harbor Clinic", stage: 3, floors: 6, scale: 6, pay: 9.2e4, rep: 40, repReq: 0, blurb: "Steel frame, skin, MEP", phases: [FOUND, FRAME, SKIN, FIT] },
    { id: "deck", name: "Parking deck", stage: 3, floors: 5, scale: 9, pay: 1.4e5, rep: 36, repReq: 0, blurb: "Precast columns, post-tensioned decks", phases: [FOUND, P("Columns", 5), P("Decks", 3), P("Rails", 5)] },
    { id: "school", name: "School", stage: 3, floors: 3, scale: 12, pay: 1.9e5, rep: 80, repReq: 0, blurb: "Steel frame, gym roof trusses", phases: [FOUND, FRAME, SKIN, FIT] },
    { id: "office", name: "Mid-rise office", stage: 4, floors: 14, scale: 38, pay: 1.6e6, rep: 160, repReq: 0, blurb: "Core first, floor cycle, curtain wall", phases: [FOUND, FRAME, SKIN, MEP, FIT] },
    { id: "tower", name: "Water tower", stage: 4, floors: 8, scale: 55, pay: 2.4e6, rep: 220, repReq: 0, blurb: "Pile cap, steel legs, tank welds", phases: [FOUND, FRAME, P("Tank welds", 5), MEP] },
    { id: "bridge", name: "Footbridge", stage: 4, floors: 3, scale: 90, pay: 4e6, rep: 280, repReq: 0, blurb: "Piers, cable stays, deck", phases: [FOUND, P("Stays", 7), P("Deck", 9)] },
    { id: "highrise", name: "40-storey tower", stage: 5, floors: 40, scale: 900, pay: 9e7, rep: 900, repReq: 0, blurb: "Piles, slipform core, 40 floors, crown", phases: [FOUND, FRAME, P("Floor cycle", 11), SKIN, MEP, FIT] },
    { id: "stadium", name: "Stadium", stage: 5, floors: 6, scale: 1500, pay: 1.6e8, rep: 1200, repReq: 0, blurb: "Bowl rakers, roof truss lift", phases: [FOUND, P("Rakers", 9), FRAME, P("Roof lift", 5)] },
    { id: "suspension", name: "Suspension bridge", stage: 5, floors: 4, scale: 3000, pay: 4e8, rep: 2400, repReq: 0, blurb: "Caissons, towers, cables, deck", phases: [FOUND, FRAME, P("Cables", 7), P("Deck lift", 10)] },
];

export const REP_TO_INCORPORATE = 500;
const PHASE_BASE = 30; // units of the phase's material per scale point, times 4^mat
export const phaseNeed = (j: JobDef, p: Phase) => PHASE_BASE * j.scale * Math.pow(4, p.mat) * (p.mat === 0 ? 0.2 : 1);

export interface Active { jobId: string; phase: number; prog: number; inspect: number; fail: number; started: number }
export interface Built { id: string; at: number; firm: number }
export interface State {
    v: number; cash: number; rep: number; amt: number[]; crews: number[]; equip: number[]; method: boolean[]; open: number;
    job: Active | null; bids: string[]; built: Built[]; done: Record<string, number>; charter: number; firm: number; savedAt: number;
    totalRep: number; hired: number;
}

export function fresh(now: number): State {
    return { v: SAVE_VERSION, cash: 60, rep: 0, amt: Array(NMAT).fill(0), crews: Array(NMAT).fill(0), equip: Array(NMAT).fill(0),
        method: Array(NMAT).fill(false), open: 1, job: null, bids: [], built: [], done: {}, charter: 0, firm: 1, savedAt: now, totalRep: 0, hired: 0 };
}

export function isSave(x: unknown): x is State {
    const s = x as State;
    return !!s && typeof s === "object" && s.v === SAVE_VERSION && Array.isArray(s.amt) && s.amt.length === NMAT && Array.isArray(s.crews) && s.crews.length === NMAT
        && Array.isArray(s.equip) && Array.isArray(s.method) && typeof s.cash === "number" && Array.isArray(s.built) && Array.isArray(s.bids);
}

// ---- rules ---------------------------------------------------------------------------------------------------------------
export const crewCost = (s: State, i: number) => Math.ceil(MATS[i].crewCost * Math.pow(1.15, s.crews[i]));
export const equipCost = (s: State, i: number) => Math.ceil(MATS[i].crewCost * 6 * Math.pow(8, s.equip[i]));
export const methodCost = (i: number) => Math.ceil(MATS[i].crewCost * 60);
export const stageOf = (s: State) => (s.open <= 3 ? 1 : s.open <= 5 ? 2 : s.open <= 8 ? 3 : s.open <= 10 ? 4 : 5);
export const charterMult = (s: State) => 1 + s.charter * 0.15;

export function rate(s: State, i: number): number {
    if (i >= s.open || s.crews[i] === 0) return 0;
    let r = s.crews[i] * MATS[i].base * Math.pow(2, s.equip[i]) * (s.method[i] ? 3 : 1) * charterMult(s);
    if (i > 0) r *= 1 + Math.log10(1 + s.amt[i - 1]) * 0.25;
    if (i >= 9 && i < NMAT - 1 && s.crews[i + 1] > 0) r *= 1 + Math.log10(1 + s.amt[i + 1]) * 0.5; // late tiers boost the one before
    return r;
}
export const builderSpeed = (s: State) => 1 + s.crews.reduce((a, c) => a + c, 0) * 0.08 + s.equip[11] * 0.5;
export const inspectLen = () => 40;

export function unlockable(s: State): boolean { return s.open < NMAT && s.amt[s.open - 1] >= MATS[s.open].unlockAmt; }
export function unlockNext(s: State): boolean {
    if (!unlockable(s)) return false;
    s.amt[s.open - 1] -= MATS[s.open].unlockAmt;
    s.open += 1;
    refreshBids(s);
    return true;
}
export type Tier = 0 | 1 | 2;
export function tierCost(s: State, i: number, t: Tier): number { return t === 0 ? crewCost(s, i) : t === 1 ? equipCost(s, i) : methodCost(i); }
export function canBuy(s: State, i: number, t: Tier): boolean {
    if (i >= s.open) return false;
    if (t === 1 && s.crews[i] === 0) return false;
    if (t === 2 && (s.method[i] || s.equip[i] < 2)) return false;
    return s.cash >= tierCost(s, i, t);
}
export function buy(s: State, i: number, t: Tier): boolean {
    if (!canBuy(s, i, t)) return false;
    s.cash -= tierCost(s, i, t);
    if (t === 0) { s.crews[i] += 1; s.hired += 1; } else if (t === 1) s.equip[i] += 1; else s.method[i] = true;
    return true;
}
export function whyLocked(s: State, i: number, t: Tier): string {
    if (i >= s.open) return "Not unlocked yet";
    if (t === 1 && s.crews[i] === 0) return "Hire a crew first";
    if (t === 2 && s.method[i]) return "Method adopted";
    if (t === 2 && s.equip[i] < 2) return "Needs equipment level 2";
    return "";
}

/** The campaign runs in a fixed order: the next job is the first one not yet finished this run. bids holds that one job. */
export const nextJob = (s: State): JobDef | null => JOBS.find((j) => !(s.done[j.id] > 0) && s.job?.jobId !== j.id) ?? null;
export const campaignDone = (s: State) => JOBS.filter((j) => s.done[j.id] > 0).length;
export const jobReady = (s: State, j: JobDef) => j.stage <= stageOf(s);
export function refreshBids(s: State) { const j = s.job ? null : nextJob(s); s.bids = j ? [j.id] : []; }
export const bond = (j: JobDef) => Math.floor(j.pay * 0.04);
export function lockedJobs(s: State): JobDef[] { const n = nextJob(s); return JOBS.filter((j) => !(s.done[j.id] > 0) && j.id !== n?.id && j.id !== s.job?.jobId).slice(0, 3); }
export function bid(s: State, id: string): boolean {
    const j = JOBS.find((x) => x.id === id);
    if (!j || s.job || !s.bids.includes(id) || !jobReady(s, j) || s.cash < bond(j)) return false;
    s.cash -= bond(j);
    s.job = { jobId: id, phase: 0, prog: 0, inspect: 0, fail: 0, started: Date.now() };
    s.bids = s.bids.filter((b) => b !== id);
    refreshBids(s);
    return true;
}
export const jobOf = (s: State) => (s.job ? JOBS.find((j) => j.id === s.job!.jobId) ?? null : null);

export interface Events { built?: JobDef; pay?: number; rep?: number; unlock?: number }
/** Advance the game by dt seconds. Returns notable events for the UI. */
export function step(s: State, dt: number): Events {
    const ev: Events = {};
    for (let i = 0; i < s.open; i++) {
        const r = rate(s, i) * dt;
        if (r <= 0) continue;
        let make = r;
        if (i > 0) { const eat = make * 0.12; if (s.amt[i - 1] < eat) make = (s.amt[i - 1] / eat) * make; s.amt[i - 1] -= make * 0.12; }
        s.amt[i] += make;
    }
    const job = s.job;
    if (job) {
        const def = jobOf(s);
        if (!def) { s.job = null; }
        else if (job.phase < def.phases.length) {
            const ph = def.phases[job.phase];
            const need = phaseNeed(def, ph);
            const speed = builderSpeed(s) * need * 0.018 * dt;
            const take = Math.min(speed, need - job.prog, s.amt[ph.mat]);
            if (take > 0) { s.amt[ph.mat] -= take; job.prog += take; }
            if (job.prog >= need - 1e-9) { job.phase += 1; job.prog = 0; }
        } else {
            job.inspect += dt;
            if (job.inspect >= inspectLen()) {
                const pay = Math.floor(def.pay * charterMult(s));
                s.cash += pay; s.rep += def.rep; s.totalRep += def.rep;
                s.built.push({ id: def.id, at: Date.now(), firm: s.firm });
                s.done[def.id] = (s.done[def.id] ?? 0) + 1;
                s.job = null;
                ev.built = def; ev.pay = pay; ev.rep = def.rep;
                refreshBids(s);
            }
        }
    }
    return ev;
}
/** Catch up on time away in chunks, capped at 8 hours. Returns seconds simulated. */
export function catchUp(s: State, gone: number): number {
    const t = Math.min(Math.max(gone, 0), 8 * 3600);
    let left = t;
    while (left > 0) { const d = Math.min(left, 5); step(s, d); left -= d; }
    return t;
}
export const phaseFrac = (s: State): number => {
    const d = jobOf(s); const j = s.job;
    if (!d || !j) return 0;
    if (j.phase >= d.phases.length) return 1;
    return (j.phase + Math.min(1, j.prog / phaseNeed(d, d.phases[j.phase]))) / d.phases.length;
};

// ---- prestige ------------------------------------------------------------------------------------------------------------
export const charterGain = (s: State) => Math.floor(Math.sqrt(s.totalRep / 100));
export const canIncorporate = (s: State) => s.rep >= REP_TO_INCORPORATE && charterGain(s) > s.charter;
export function incorporate(s: State): boolean {
    if (!canIncorporate(s)) return false;
    const keep = { built: s.built, charter: charterGain(s), firm: s.firm + 1, totalRep: s.totalRep };
    Object.assign(s, fresh(Date.now()), keep, { cash: 60 + keep.charter * 40 });
    refreshBids(s);
    return true;
}

// ---- formatting and storage ----------------------------------------------------------------------------------------------
const SUF = ["", "K", "M", "B", "T", "Qa", "Qi"];
export function fmt(n: number, d = 1): string {
    if (!isFinite(n)) return "0";
    if (Math.abs(n) < 1000) return n < 10 && n % 1 !== 0 ? n.toFixed(d) : Math.floor(n).toString();
    const e = Math.min(SUF.length - 1, Math.floor(Math.log10(Math.abs(n)) / 3));
    return (n / Math.pow(1000, e)).toFixed(d).replace(/\.0$/, "") + SUF[e];
}
export const money = (n: number) => "$" + fmt(n);
export function fmtTime(sec: number): string { const s = Math.max(0, Math.ceil(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
export function load(store: Storage): State | null {
    try { const t = store.getItem(SAVE_KEY); if (!t) return null; const x = JSON.parse(t); return isSave(x) ? x : null; } catch { return null; }
}
export const serialize = (s: State) => JSON.stringify(s);
