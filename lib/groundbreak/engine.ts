// Groundbreak engine. Pure TypeScript: no React, no DOM, so the sim script and the tests run it under node.
// A construction firm: twelve materials unlock one after another, each boosting the next, and the last three feed back
// down the chain. Jobs pull materials phase by phase, wait out a timed inspection, then pay cash and reputation and add a
// building to the skyline. Incorporate starts a new firm in a new city and keeps Charter points and the skyline.
import {
    BASE_RATE, CITIES, CREW_COST, EQUIP_COST, FX_KEYS, JOBS, JOB_BY, MATS, METHOD_COST, MUL_FX, N, PERKS, PHASES, RECIPE, STAGES, TUNE,
    UNLOCK_COST, cityLoop, cityOf, jobAt, type FxKey, type JobDef, type PhaseId,
} from "./data";

export const SAVE_KEY = "gb-save-v1";
export const SAVE_VERSION = 2;

export interface ActiveJob {
    /** position in the campaign (JOBS order, then the last three looping) */
    index: number;
    id: string;
    /** permit: waiting to start, build: pulling materials, inspect: timed inspection */
    step: "permit" | "build" | "inspect";
    /** seconds left in the permit or the inspection */
    left: number;
    /** inspection length this job was given (shows a bar) */
    inspectTotal: number;
    /** index into the job's plan of the phase being built */
    phase: number;
    /** units delivered so far this phase, per material */
    got: number[];
    /** extra units a change order added to this phase, per material */
    extra: number[];
    /** payout bonus from accepted change orders, as a fraction of the cash */
    bonus: number;
    /** a repeat order: the firm rebuilds a job it already handed over, while the next campaign job waits for a material. Pays a share, adds no building. */
    rerun?: boolean;
    /** cash already paid out as progress draws (one per finished phase); the handover pays the rest */
    drawn?: number;
    /** inspection score the accepted change orders add to what the job asks for */
    harder?: number;
}

/** A change order: the client asks for more mid-build. Accept it for extra materials and a bigger payout, or let it lapse. */
/** `secs`: build time the extra work adds to the phase at full supply; `score`: how much harder the inspection gets if accepted. */
export interface ChangeOrder { job: number; left: number; extra: [number, number][]; bonus: number; secs: number; score: number }

export interface Building { id: string; city: number; firm: number; at: number }

export interface State {
    v: number;
    amt: number[];
    /** materials opened so far; material n is open when n < open */
    open: number;
    crews: number[];
    equip: number[];
    method: boolean[];
    cash: number;
    rep: number;
    /** reputation earned this firm (drives Charter) */
    repFirm: number;
    cashFirm: number;
    cashAll: number;
    /** the job being built, or null while the next one waits for its stage to open */
    job: ActiveJob | null;
    change: ChangeOrder | null;
    built: number;
    /** repeat orders finished (all firms) */
    reruns: number;
    /** jobs handed over this firm = the campaign position of the next job */
    builtThisFirm: number;
    skyline: Building[];
    /** firms started so far (0 = the first) */
    firm: number;
    charter: number;
    charterAll: number;
    perks: string[];
    /** autobuy switches the player turned off: 1 crews, 2 equipment, 3 change orders */
    autoOff: number[];
    ending: boolean;
    age: number;
    totalAge: number;
    savedAt: number;
    seen: string[];
    /** per-second change of each material from the last tick. Not saved. */
    flow?: number[];
}

export function fresh(now = Date.now()): State {
    const s: State = {
        v: SAVE_VERSION, amt: Array(N).fill(0), open: 1, crews: Array(N).fill(0), equip: Array(N).fill(0), method: Array(N).fill(false),
        cash: TUNE.startCash, rep: 0, repFirm: 0, cashFirm: 0, cashAll: 0, job: null, change: null, built: 0, reruns: 0, builtThisFirm: 0, skyline: [],
        firm: 0, charter: 0, charterAll: 0, perks: [], autoOff: [], ending: false, age: 0, totalAge: 0, savedAt: now, seen: [],
    };
    s.amt[0] = TUNE.startGravel;
    s.crews[0] = 1;
    return s;
}

const clamp = (x: number) => (Number.isFinite(x) ? Math.min(TUNE.cap, Math.max(0, x)) : x > 0 ? TUNE.cap : 0);

// ---- effects ------------------------------------------------------------------------------------------------------

export type Fx = Record<FxKey, number>;

function blank(): Fx {
    const o = {} as Fx;
    for (const k of FX_KEYS) o[k] = MUL_FX.includes(k) ? 1 : 0;
    return o;
}
function add(f: Fx, fx: Partial<Record<FxKey, number>>) {
    for (const [k, v] of Object.entries(fx) as [FxKey, number][]) {
        if (MUL_FX.includes(k)) f[k] *= v;
        else f[k] += v;
    }
}

/** Everything the state grants that does not depend on stock: perks, methods, the city. */
export function effects(s: State): Fx {
    const f = blank();
    for (const p of PERKS) if (s.perks.includes(p.id)) add(f, p.fx);
    for (let n = 0; n < N; n++) if (s.method[n]) add(f, MATS[n].methodFx);
    const c = cityOf(s.firm);
    if (c.fx) add(f, c.fx);
    const loop = cityLoop(s.firm);
    f.pay *= 1 + loop * 0.5;
    f.permit = Math.min(0.9, f.permit);
    f.inspect = Math.min(0.8, f.inspect);
    f.crewCost = Math.min(0.5, f.crewCost);
    f.auto = Math.floor(f.auto);
    return f;
}

export const offlineCapS = (f: Fx) => (TUNE.offlineH + f.offlineH) * 3600;

const logAmt = (s: State, n: number) => Math.log10(1 + s.amt[n]);

/** Stock-dependent chain boosts. fwd[n] lifts n from n-1; back[n] lifts n from n+1; the last three also give a global extra. */
export interface Chain { fwd: number[]; back: number[]; crew: number; pay: number; rep: number }
export function chain(s: State): Chain {
    const fwd = Array(N).fill(1), back = Array(N).fill(1);
    for (let n = 1; n < N; n++) if (n < s.open) fwd[n] = 1 + logAmt(s, n - 1) * TUNE.fwd;
    for (let n = TUNE.backFrom; n < N; n++) if (n < s.open) back[n - 1] = 1 + logAmt(s, n) * TUNE.back;
    const ex = (n: number) => (n < s.open ? 1 + logAmt(s, n) * TUNE.extra : 1);
    return { fwd, back, crew: ex(9), pay: ex(10), rep: ex(11) };
}

// ---- derived numbers ----------------------------------------------------------------------------------------------

export const isOpen = (s: State, n: number) => n < s.open;
/** The next material to open, or -1. */
export const nextOpen = (s: State) => (s.open < N ? s.open : -1);
export const unlockCost = (s: State, n: number) => Math.max(0, UNLOCK_COST[n]);
export const canUnlock = (s: State, n: number) => n === s.open && n < N && s.amt[n - 1] >= UNLOCK_COST[n];
export function unlock(s: State, n: number): boolean {
    if (!canUnlock(s, n)) return false;
    s.amt[n - 1] -= UNLOCK_COST[n];
    s.open = n + 1;
    s.crews[n] = Math.max(s.crews[n], 1);
    return true;
}

export const rowMult = (s: State, n: number) => Math.pow(2, Math.floor(s.crews[n] / TUNE.milestone));
export const equipMult = (s: State, n: number) => Math.pow(TUNE.equipMult, s.equip[n]);
export const methodMult = (s: State, n: number) => (s.method[n] ? TUNE.methodMult : 1);
export const cityMat = (s: State, n: number) => cityOf(s.firm).mat?.[n] ?? 1;
export const repMult = (s: State) => 1 + s.rep * TUNE.repBoost;

/** Per-second output of material n, before it is limited by its inputs. */
export function rawRate(s: State, n: number, f: Fx, c: Chain): number {
    if (n >= s.open) return 0;
    return s.crews[n] * BASE_RATE[n] * equipMult(s, n) * methodMult(s, n) * rowMult(s, n) * c.fwd[n] * c.back[n] * cityMat(s, n)
        * f.crew * c.crew * repMult(s);
}

/** Crews are hired with the material before: sand crews cost gravel. Gravel crews cost gravel. */
export const crewSrc = (n: number) => Math.max(0, n - 1);
export const crewCost = (s: State, n: number, f: Fx) => CREW_COST[n] * Math.pow(TUNE.crewGrowth, s.crews[n]) * (1 - f.crewCost);
export const equipCost = (s: State, n: number) => EQUIP_COST[n] * Math.pow(TUNE.equipGrowth, s.equip[n]);
export const methodCost = (n: number) => METHOD_COST[n];
export const methodReady = (s: State, n: number) => !s.method[n] && s.equip[n] >= TUNE.equipNeed;

export type Cur = "mat" | "cash";
/** What tier k of material n costs, and in what. */
export function tierCost(s: State, n: number, k: number, f: Fx = effects(s)): { cur: Cur; mat: number; amount: number } {
    if (k === 0) return { cur: "mat", mat: crewSrc(n), amount: crewCost(s, n, f) };
    if (k === 1) return { cur: "mat", mat: crewSrc(n), amount: equipCost(s, n) };
    return { cur: "cash", mat: -1, amount: methodCost(n) };
}

export function canBuy(s: State, n: number, k: number, f: Fx = effects(s)): boolean {
    if (n >= s.open) return false;
    if (k === 2 && !methodReady(s, n)) return false;
    const c = tierCost(s, n, k, f);
    return c.cur === "mat" ? s.amt[c.mat] >= c.amount : s.cash >= c.amount;
}
export function buy(s: State, n: number, k: number, f: Fx = effects(s)): boolean {
    if (!canBuy(s, n, k, f)) return false;
    const c = tierCost(s, n, k, f);
    if (c.cur === "mat") s.amt[c.mat] -= c.amount;
    else s.cash -= c.amount;
    if (k === 0) s.crews[n]++;
    else if (k === 1) s.equip[n]++;
    else s.method[n] = true;
    return true;
}

/** Stage 1..5: the highest stage whose materials are all open. */
export const stageOf = (s: State) => {
    let st = 0;
    for (const g of STAGES) if (s.open >= g.mats) st = g.id;
    return Math.max(1, st);
};

// ---- jobs ---------------------------------------------------------------------------------------------------------

/** How fast jobs build: the speed perks, and a share of the crew perks (better crews also frame faster, with diminishing returns). */
export const jobSpeed = (f: Fx) => f.speed * Math.sqrt(f.crew);

export interface PhasePlan { id: PhaseId; name: string; needs: [number, number][]; secs: number }
/** The phases a job runs, with the units each asks for and how long it takes at full supply. */
export function plan(job: JobDef, f: Fx): PhasePlan[] {
    const used = PHASES.map((p) => ({ p, needs: job.needs.filter(([m]) => p.mats.includes(m)) })).filter((x) => x.needs.length);
    const tot = used.reduce((a, x) => a + x.p.share, 0) || 1;
    return used.map(({ p, needs }) => ({ id: p.id, name: p.name, needs, secs: (job.secs * p.share) / tot / jobSpeed(f) }));
}

/** Lap bonus once the firm is past the bridge: each extra lap of the last three jobs pays 15% more. */
export const lap = (index: number) => Math.max(0, Math.floor((index - JOBS.length + 3) / 3));
/** The job the firm builds next (campaign order). */
export const nextJob = (s: State): JobDef => jobAt(s.builtThisFirm);
/** How many materials a job needs open: its last material, counted from 1. A job starts as soon as these are open, not when its whole stage is. */
export const jobNeed = (j: JobDef) => j.needs.reduce((a, [m]) => Math.max(a, m + 1), 1);
/** The material that has to be open before the job can start. */
export const jobMat = (j: JobDef) => jobNeed(j) - 1;
export const jobReady = (s: State, j: JobDef) => s.open >= jobNeed(j);
/** True while a campaign job (not a repeat order) is being built. */
export const onCampaign = (s: State) => !!s.job && !s.job.rerun;
/** Why the next campaign job is not running yet, or null. Also says what the crews do meanwhile. */
export const waitingFor = (s: State): string | null => {
    if (onCampaign(s)) return null;
    const j = nextJob(s);
    if (jobReady(s, j)) return null;
    const m = s.open;
    return `${j.name} needs ${MATS[jobMat(j)].name}. Gathering ${fmt(UNLOCK_COST[m])} ${MATS[m - 1].name} to open ${MATS[m].name}.`;
};
/** The job the firm repeats while the next one waits: the last one it handed over, as a repeat order. Null on a fresh firm. */
export function repeatJob(s: State): JobDef | null {
    if (s.builtThisFirm < 1) return null;
    const j = jobAt(s.builtThisFirm - 1);
    return jobReady(s, j) ? j : null;
}
/** The next few jobs, read-only, for the NEXT JOBS panel. */
export const queue = (s: State, n = 3): { job: JobDef; index: number; ready: boolean }[] =>
    Array.from({ length: n }, (_, i) => {
        const index = s.builtThisFirm + (onCampaign(s) ? 1 : 0) + i;
        const job = jobAt(index);
        return { job, index, ready: jobReady(s, job) };
    });

/** Cash and reputation the job pays now. */
export const payout = (s: State, j: JobDef, f: Fx, c: Chain = chain(s), index = s.builtThisFirm) =>
    Math.round(j.cash * f.pay * c.pay * (1 + 0.15 * lap(index)));
export const repPay = (s: State, j: JobDef, f: Fx, c: Chain = chain(s)) => Math.round(j.repGain * f.repGain * c.rep);
export const permitSecs = (j: JobDef, f: Fx) => j.permit * (1 - f.permit);

/** Inspection: the score the firm brings against what the job asks. A shortfall stretches the inspection, never fails it. */
export const inspectScore = (s: State, f: Fx) => TUNE.scoreBase + s.rep * TUNE.scoreRep + f.score;
export const inspectSecs = (s: State, j: JobDef, f: Fx, harder = 0) => {
    const delay = Math.min(TUNE.delayCap, Math.max(1, (j.need + harder) / Math.max(0.1, inspectScore(s, f))));
    return Math.max(1, j.inspect * delay * (1 - f.inspect));
};

/** When the job after the one being built is waiting on a material, the foreman opens it as soon as the stock to pay for it is in. No click, so a new player (or time away) never stalls on it. */
export function openForWaitingJob(s: State): boolean {
    const j = jobAt(s.builtThisFirm + (onCampaign(s) ? 1 : 0));
    return !jobReady(s, j) && unlock(s, s.open);
}

/** Repeat orders pay a share of the job and give a trickle of reputation. `frac` is how much of it the crew finished. */
export const repeatPay = (s: State, j: JobDef, f: Fx, c: Chain = chain(s), frac = 1) => Math.round(j.cash * f.pay * c.pay * TUNE.repeatCash * frac);
export const repeatRep = (s: State, j: JobDef, f: Fx, c: Chain = chain(s), frac = 1) => Math.round(j.repGain * f.repGain * c.rep * TUNE.repeatRep * frac * 100) / 100;

const blankJob = (index: number, id: string, left: number, rerun?: boolean): ActiveJob =>
    ({ index, id, step: left > 0 ? "permit" : "build", left, inspectTotal: 0, phase: 0, got: Array(N).fill(0), extra: Array(N).fill(0), bonus: 0, ...(rerun ? { rerun } : {}) });

/** Pay a repeat order, in full or pro rata, and clear it. */
function settleRerun(s: State, f: Fx, c: Chain, frac: number) {
    const aj = s.job;
    const def = aj && JOB_BY.get(aj.id);
    s.job = null;
    s.change = null;
    if (!def || frac <= 0) return;
    const cash = repeatPay(s, def, f, c, frac), r = repeatRep(s, def, f, c, frac);
    s.cash = clamp(s.cash + cash);
    s.cashFirm = clamp(s.cashFirm + cash);
    s.cashAll = clamp(s.cashAll + cash);
    s.rep = clamp(s.rep + r);
    s.repFirm = clamp(s.repFirm + r);
    s.reruns++;
}

/** Start the next campaign job as soon as the materials it needs are open (pulling the crew off a repeat order, paid for the work done); otherwise keep the crew busy on a repeat order. Called every tick. */
export function startNext(s: State, f: Fx, c: Chain = chain(s)): boolean {
    const j = nextJob(s);
    if (s.job && !(s.job.rerun && jobReady(s, j))) return false;
    if (s.job) {
        const aj = s.job;
        settleRerun(s, f, c, aj.step === "inspect" ? 1 : jobProgress(aj, f));
    }
    if (jobReady(s, j)) {
        s.job = blankJob(s.builtThisFirm, j.id, permitSecs(j, f));
        s.change = null;
        return true;
    }
    const r = repeatJob(s);
    if (!r) return false;
    s.job = blankJob(s.builtThisFirm - 1, r.id, 0, true);
    return true;
}

/** Needs of the phase being built, with change-order extras added. */
export const phaseNeeds = (aj: ActiveJob, p: PhasePlan): [number, number][] => p.needs.map(([m, q]) => [m, q + aj.extra[m]] as [number, number]);

/** 0..1 across the whole job. */
export function jobProgress(aj: ActiveJob, f: Fx): number {
    const def = JOB_BY.get(aj.id);
    if (!def || aj.step === "permit") return 0;
    const ph = plan(def, f);
    const tot = ph.reduce((a, p) => a + p.secs, 0) || 1;
    let done = 0;
    for (let i = 0; i < ph.length; i++) {
        if (aj.step === "inspect" || i < aj.phase) done += ph[i].secs;
        else if (i === aj.phase) {
            const needs = phaseNeeds(aj, ph[i]);
            const need = needs.reduce((a, [, q]) => a + q, 0) || 1;
            done += ph[i].secs * (needs.reduce((a, [m, q]) => a + Math.min(aj.got[m], q), 0) / need);
        }
    }
    return Math.min(1, done / tot);
}
/** Floors topped out so far, for the staged art. */
export function jobFloors(aj: ActiveJob, f: Fx): number {
    const def = JOB_BY.get(aj.id);
    if (!def || !def.floors || aj.step === "permit") return 0;
    const ph = plan(def, f);
    const si = ph.findIndex((p) => p.id === "structure");
    if (si < 0) return 0;
    if (aj.step === "inspect" || aj.phase > si) return def.floors;
    if (aj.phase < si) return 0;
    const needs = phaseNeeds(aj, ph[si]);
    const need = needs.reduce((a, [, q]) => a + q, 0) || 1;
    return Math.floor((needs.reduce((a, [m, q]) => a + Math.min(aj.got[m], q), 0) / need) * def.floors);
}
/** Name of the phase being built, for the job card. */
export function jobPhaseName(aj: ActiveJob, f: Fx): string {
    const def = JOB_BY.get(aj.id);
    if (!def) return "";
    if (aj.step === "permit") return "Permit";
    if (aj.step === "inspect") return "Inspection";
    return plan(def, f)[aj.phase]?.name ?? "Handover";
}

/** Pay to cut the inspection short. Returns the cost, or 0 when it cannot. */
export function overtimeCost(s: State): number {
    const aj = s.job;
    const def = aj && JOB_BY.get(aj.id);
    if (!aj || !def || aj.rerun || aj.step !== "inspect" || aj.left <= 0) return 0;
    return Math.ceil(aj.left * TUNE.overtime * (def.cash / Math.max(1, aj.inspectTotal || def.inspect)));
}
export function overtime(s: State): boolean {
    const c = overtimeCost(s);
    if (!s.job || c <= 0 || s.cash < c) return false;
    s.cash -= c;
    s.job.left = 0;
    return true;
}

// ---- change orders -------------------------------------------------------------------------------------------------

/** The phase a change order lands in: Structure, or the middle one for a job without it (the early houses). */
const changePhase = (ph: PhasePlan[]) => {
    const i = ph.findIndex((p) => p.id === "structure");
    return i >= 0 ? i : Math.floor(ph.length / 2);
};
/** One change order per job after the stage 1 jobs, offered as the structure phase begins. */
function maybeChange(s: State, aj: ActiveJob, def: JobDef, f: Fx) {
    if (s.change || aj.rerun || def.stage < 2 || aj.bonus > 0) return;
    const ph = plan(def, f);
    if (aj.phase !== changePhase(ph)) return;
    const extra = ph[aj.phase].needs.map(([m, q]) => [m, Math.ceil(q * TUNE.changeExtra)] as [number, number]);
    s.change = { job: aj.index, left: TUNE.changeWait, extra, bonus: TUNE.changeBonus * f.change, secs: Math.round(ph[aj.phase].secs * TUNE.changeExtra), score: TUNE.changeScore };
    if (!s.autoOff.includes(3) && f.auto >= 2) acceptChange(s);
}
export function acceptChange(s: State): boolean {
    const c = s.change, aj = s.job;
    if (!c || !aj || aj.index !== c.job || aj.step !== "build") return false;
    for (const [m, q] of c.extra) aj.extra[m] += q;
    aj.bonus += c.bonus;
    aj.harder = (aj.harder ?? 0) + c.score;
    s.change = null;
    return true;
}
export function declineChange(s: State): boolean {
    if (!s.change) return false;
    s.change = null;
    return true;
}

function finish(s: State, f: Fx, c: Chain) {
    const aj = s.job!;
    const def = JOB_BY.get(aj.id);
    if (aj.rerun) { settleRerun(s, f, c, 1); return; }
    s.job = null;
    s.change = null;
    if (!def) return;
    const cash = Math.max(0, Math.round(payout(s, def, f, c, aj.index) * (1 + aj.bonus)) - (aj.drawn ?? 0));
    s.cash = clamp(s.cash + cash);
    s.cashFirm = clamp(s.cashFirm + cash);
    s.cashAll = clamp(s.cashAll + cash);
    const r = repPay(s, def, f, c);
    s.rep = clamp(s.rep + r);
    s.repFirm = clamp(s.repFirm + r);
    s.built++;
    s.builtThisFirm++;
    s.skyline.push({ id: def.id, city: s.firm % CITIES.length, firm: s.firm, at: s.totalAge });
    if (s.skyline.length > TUNE.skylineCap) s.skyline.splice(0, s.skyline.length - TUNE.skylineCap);
    if (def.ending) s.ending = true;
}

function stepJob(s: State, dt: number, f: Fx, c: Chain) {
    const aj = s.job!;
    const def = JOB_BY.get(aj.id);
    if (!def) { s.job = null; return; }
    if (aj.step === "permit") {
        aj.left -= dt;
        if (aj.left <= 0) { aj.step = "build"; aj.left = 0; aj.phase = 0; aj.got = Array(N).fill(0); aj.extra = Array(N).fill(0); }
        else return;
    }
    if (aj.step === "build") {
        const ph = plan(def, f);
        const p = ph[aj.phase];
        if (!p) { aj.step = "inspect"; aj.left = aj.inspectTotal = inspectSecs(s, def, f, aj.harder); return; }
        maybeChange(s, aj, def, f);
        let allDone = true;
        const base = new Map(p.needs);
        for (const [m, q] of phaseNeeds(aj, p)) {
            if (aj.got[m] >= q - 1e-9) continue;
            // The pace is set by the planned quantity, so change-order extras add build time, not just materials.
            const pull = Math.min(((base.get(m) ?? q) / p.secs) * dt, q - aj.got[m], s.amt[m]);
            if (pull > 0) { s.amt[m] -= pull; aj.got[m] += pull; }
            if (aj.got[m] < q - 1e-9) allDone = false;
        }
        if (allDone) {
            if (!aj.rerun) {
                // A progress draw: the client pays part of the job as each phase is handed over, so long jobs pay all the way through.
                const tot = ph.reduce((a, x) => a + x.secs, 0) || 1;
                const draw = Math.round(payout(s, def, f, c, aj.index) * TUNE.draw * (p.secs / tot));
                aj.drawn = (aj.drawn ?? 0) + draw;
                s.cash = clamp(s.cash + draw);
                s.cashFirm = clamp(s.cashFirm + draw);
                s.cashAll = clamp(s.cashAll + draw);
            }
            aj.phase++;
            aj.got = Array(N).fill(0);
            aj.extra = Array(N).fill(0);
            if (aj.phase - 1 === changePhase(ph)) s.change = null;
            if (aj.phase >= ph.length) { aj.step = "inspect"; aj.left = aj.inspectTotal = inspectSecs(s, def, f, aj.harder); }
        }
        return;
    }
    aj.left -= dt;
    if (aj.left <= 0) finish(s, f, c);
}

// ---- the tick -----------------------------------------------------------------------------------------------------

/** Advance by dt seconds (keep dt <= 5; catchUp chops long gaps). */
export function step(s: State, dt: number, f: Fx = effects(s)): void {
    if (dt <= 0) return;
    const c = chain(s);
    const before = s.amt.slice();
    for (let n = s.open - 1; n >= 0; n--) {
        let want = rawRate(s, n, f, c) * dt;
        if (want <= 0) continue;
        for (const [m, q] of RECIPE[n]) want = Math.min(want, s.amt[m] / q);
        if (want <= 0) continue;
        for (const [m, q] of RECIPE[n]) s.amt[m] -= want * q;
        s.amt[n] = clamp(s.amt[n] + want);
    }
    s.flow = s.amt.map((v, i) => (v - before[i]) / dt);
    openForWaitingJob(s);
    startNext(s, f, c);
    if (s.job) stepJob(s, dt, f, c);
    if (s.change) { s.change.left -= dt; if (s.change.left <= 0) s.change = null; }
    s.age += dt;
    s.totalAge += dt;
    auto(s, f);
}

/** Foreman and Fleet manager (the second also takes change orders): each only spends a small share of what it holds, so it never starves a job or the chain. */
export function auto(s: State, f: Fx) {
    if (f.auto <= 0) return;
    const on = (k: number) => !s.autoOff.includes(k);
    if (f.auto >= 1 && on(1)) {
        for (let n = 0; n < s.open; n++) {
            for (let i = 0; i < 4; i++) {
                const c = crewCost(s, n, f);
                if (c > s.amt[crewSrc(n)] * TUNE.autoShare) break;
                s.amt[crewSrc(n)] -= c;
                s.crews[n]++;
            }
        }
    }
    if (f.auto >= 2 && on(2)) {
        for (let n = 0; n < s.open; n++) {
            const c = equipCost(s, n);
            if (c <= s.amt[crewSrc(n)] * TUNE.autoShare) { s.amt[crewSrc(n)] -= c; s.equip[n]++; }
        }
    }
}

/** Catch up after time away. Returns the seconds simulated. */
export function catchUp(s: State, away: number): number {
    const f = effects(s);
    const secs = Math.max(0, Math.min(away, offlineCapS(f)));
    if (secs < 2) return 0;
    const steps = Math.min(TUNE.offlineStepCap, Math.max(1, Math.ceil(secs / 2)));
    const dt = secs / steps;
    for (let i = 0; i < steps; i++) step(s, dt, f);
    return secs;
}

// ---- prestige -----------------------------------------------------------------------------------------------------

export const charterGain = (s: State, f: Fx = effects(s)) =>
    s.repFirm < TUNE.charterMinRep ? 0 : Math.floor(Math.sqrt(s.repFirm / TUNE.charterDiv) * f.charter);
export const canIncorporate = (s: State, f: Fx = effects(s)) => charterGain(s, f) >= 1;

export function incorporate(s: State): number {
    const f = effects(s);
    if (!canIncorporate(s, f)) return 0;
    const gain = charterGain(s, f);
    s.charter += gain;
    s.charterAll += gain;
    const keep = f.keepMethods > 0 ? s.method.slice() : Array(N).fill(false);
    s.firm++;
    const g = effects(s);
    s.amt = Array(N).fill(0);
    s.amt[0] = TUNE.startGravel;
    s.crews = Array(N).fill(0);
    s.crews[0] = 1;
    s.equip = Array(N).fill(0);
    s.method = keep;
    s.open = 1 + Math.floor(g.startUnlock);
    for (let n = 1; n < s.open; n++) s.crews[n] = 1;
    s.cash = TUNE.startCash + g.startCash;
    s.rep = g.startRep;
    s.repFirm = 0;
    s.cashFirm = 0;
    s.job = null;
    s.change = null;
    s.builtThisFirm = 0;
    s.ending = false;
    s.age = 0;
    return gain;
}

export const perkReady = (owned: string[], p: (typeof PERKS)[number]) => !owned.includes(p.id) && p.req.every((r) => owned.includes(r));
export function buyPerk(s: State, id: string): boolean {
    const p = PERKS.find((x) => x.id === id);
    if (!p || !perkReady(s.perks, p) || s.charter < p.cost) return false;
    s.charter -= p.cost;
    s.perks.push(p.id);
    return true;
}

// ---- saves --------------------------------------------------------------------------------------------------------

const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0) => Math.max(0, Math.floor(num(v, d)));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown, ok: (x: string) => boolean) => [...new Set(arr(v).filter((x): x is string => typeof x === "string" && ok(x)))];

export function isSave(v: unknown): v is State {
    return !!v && typeof v === "object" && Array.isArray((v as State).amt) && Array.isArray((v as State).crews);
}

/** Rebuild a state from anything stored. Unknown fields are dropped, missing ones refilled, so old saves keep loading. */
export function parse(raw: unknown): State | null {
    if (!isSave(raw)) return null;
    const r = raw as unknown as Record<string, unknown>;
    const s = fresh(num(r.savedAt, Date.now()));
    const col = (k: string, d = 0) => Array.from({ length: N }, (_, i) => clamp(num(arr(r[k])[i], d)));
    s.amt = col("amt");
    s.crews = col("crews").map(Math.floor);
    s.equip = col("equip").map(Math.floor);
    s.method = Array.from({ length: N }, (_, i) => arr(r.method)[i] === true);
    s.open = Math.min(N, Math.max(1, int(r.open, 1)));
    s.cash = clamp(num(r.cash, TUNE.startCash));
    s.rep = clamp(num(r.rep));
    s.repFirm = clamp(num(r.repFirm));
    s.cashFirm = clamp(num(r.cashFirm));
    s.cashAll = clamp(num(r.cashAll));
    s.firm = int(r.firm);
    s.built = int(r.built);
    s.reruns = int(r.reruns);
    s.builtThisFirm = int(r.builtThisFirm);
    s.charter = clamp(num(r.charter));
    s.charterAll = clamp(num(r.charterAll));
    s.perks = strs(r.perks, (x) => PERKS.some((p) => p.id === x));
    s.autoOff = arr(r.autoOff).filter((x): x is number => typeof x === "number").slice(0, 8);
    s.ending = r.ending === true;
    s.age = num(r.age);
    s.totalAge = num(r.totalAge);
    s.seen = strs(r.seen, () => true).slice(0, 64);
    s.skyline = arr(r.skyline).flatMap((b) => {
        const o = b as Record<string, unknown>;
        return o && typeof o.id === "string" && JOB_BY.has(o.id) ? [{ id: o.id, city: int(o.city), firm: int(o.firm), at: num(o.at) }] : [];
    }).slice(-TUNE.skylineCap);
    // Saves from before the jobs were reordered (v1): the next job is the first one in the new order this firm has not built yet.
    if (num(r.v, 1) < 2 && s.builtThisFirm < JOBS.length) {
        const done = new Set(s.skyline.filter((b) => b.firm === s.firm).map((b) => b.id));
        const k = JOBS.findIndex((j) => !done.has(j.id));
        if (k >= 0) s.builtThisFirm = k;
    }
    const o = (r.job ?? null) as Record<string, unknown> | null;
    if (o && typeof o.id === "string" && JOB_BY.has(o.id)) {
        s.job = {
            index: int(o.index, s.builtThisFirm), id: o.id, step: o.step === "build" || o.step === "inspect" ? o.step : "permit",
            left: Math.max(0, num(o.left)), inspectTotal: Math.max(0, num(o.inspectTotal)), phase: int(o.phase),
            got: Array.from({ length: N }, (_, i) => Math.max(0, num(arr(o.got)[i]))), extra: Array.from({ length: N }, (_, i) => Math.max(0, num(arr(o.extra)[i]))),
            bonus: Math.max(0, num(o.bonus)), drawn: Math.max(0, num(o.drawn)), harder: Math.max(0, num(o.harder)), ...(o.rerun === true ? { rerun: true } : {}),
        };
    }
    const ch = (r.change ?? null) as Record<string, unknown> | null;
    if (ch && s.job) s.change = { job: int(ch.job), left: Math.max(0, num(ch.left)), bonus: Math.max(0, num(ch.bonus)), secs: Math.max(0, num(ch.secs)), score: Math.max(0, num(ch.score)), extra: arr(ch.extra).flatMap((e) => (Array.isArray(e) && e.length === 2 ? [[int(e[0]), Math.max(0, num(e[1]))] as [number, number]] : [])).filter(([m]) => m < N) };
    return s;
}

export const serialize = (s: State) => JSON.stringify({ ...s, flow: undefined });

export function load(storage: Pick<Storage, "getItem"> | null | undefined): State | null {
    try {
        const t = storage?.getItem(SAVE_KEY);
        return t ? parse(JSON.parse(t)) : null;
    } catch {
        return null;
    }
}

// ---- number format ------------------------------------------------------------------------------------------------

export function fmt(n: number, digits = 2): string {
    if (!Number.isFinite(n)) return "0";
    if (n < 0) return "-" + fmt(-n, digits);
    if (n < 1000) return n < 10 && n % 1 !== 0 ? n.toFixed(digits) : Math.floor(n).toString();
    if (n < 1e6) return (n / 1e3).toFixed(n < 1e4 ? 2 : n < 1e5 ? 1 : 0) + "K";
    const sfx = ["M", "B", "T", "Qa", "Qi"];
    const e = Math.floor(Math.log10(n) / 3);
    if (e - 2 < sfx.length) return (n / Math.pow(10, e * 3)).toFixed(digits) + sfx[e - 2];
    const x = Math.floor(Math.log10(n));
    return `${(n / Math.pow(10, x)).toFixed(digits)}e${x}`;
}
export const fmtCash = (n: number) => "$" + fmt(n);
export function fmtAge(sec: number): string {
    if (sec < 90) return `${Math.floor(sec)} s`;
    if (sec < 5400) return `${Math.floor(sec / 60)} min`;
    return `${(sec / 3600).toFixed(1)} h`;
}
export const matName = (n: number) => MATS[n].name;
