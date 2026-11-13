// Starwright engine. Pure TypeScript: no React, no DOM, so the sim script and the tests run it under node.
// A star fuses hydrogen up the periodic table. Core heat (set by the star's mass) gates each fusion. Iron cannot fuse, so
// it collapses: a supernova pays Stardust for the constellation map. Stardust piles into a neutron star (Neutrons, a
// pulsar map, and the r-process rows: gold, uranium), and uranium piles into a black hole (a Singularity).
import {
    BASE_COST, BASE_RATE, COST_GROWTH, ELEMENTS, GATE_MK, N, PERKS, PLANETS, PULSAR_PERKS, RECIPE, ROWS, STARNAMES, TIERS,
    TIER_COST_X, TIER_LEVELS, TUNE, type FxKey, type Perk,
} from "./data";

export const SAVE_KEY = "sw-save-v1";
export const SAVE_VERSION = 1;

export interface State {
    v: number;
    /** amount of each element in the star */
    amt: number[];
    /** times each tier button was bought this star, per row */
    bought: number[][];
    /** gas this star has pulled in; never falls when you spend it, so heat only rises */
    mass: number;
    heat: number;
    /** seconds this star has burned, and in total */
    age: number;
    totalAge: number;
    name: string;
    stardust: number;
    /** stardust earned in this neutron layer, and ever */
    sdLayer: number;
    sdAll: number;
    perks: string[];
    novas: number;
    novasAll: number;
    neutrons: number;
    neutronsAll: number;
    pulsar: string[];
    neutronStars: number;
    sing: number;
    planets: string[];
    /** best collapse seen this star, and highest Fe this star */
    ending: boolean;
    savedAt: number;
    /** first-time moments already shown, as ids */
    seen: string[];
    /** net change per second of each element from the last tick (inflow and fusion, not purchases). Not saved. */
    flow?: number[];
}

export function fresh(now = Date.now()): State {
    const s: State = {
        v: SAVE_VERSION,
        amt: Array(N).fill(0),
        bought: Array.from({ length: ROWS }, () => Array(TIERS).fill(0)),
        mass: 30,
        heat: 0,
        age: 0,
        totalAge: 0,
        name: STARNAMES[0],
        stardust: 0,
        sdLayer: 0,
        sdAll: 0,
        perks: [],
        novas: 0,
        novasAll: 0,
        neutrons: 0,
        neutronsAll: 0,
        pulsar: [],
        neutronStars: 0,
        sing: 0,
        planets: [],
        ending: false,
        savedAt: now,
        seen: [],
    };
    s.amt[0] = 30;
    return s;
}

const clamp = (x: number) => (Number.isFinite(x) ? Math.min(TUNE.cap, Math.max(0, x)) : x > 0 ? TUNE.cap : 0);

// ---- effects ------------------------------------------------------------------------------------------------------

export type Fx = Record<FxKey, number>;
const MUL: FxKey[] = ["inflow", "fuse", "heat", "stardust", "global", "heavy"];

function blank(): Fx {
    const o = {} as Fx;
    for (const k of ["inflow", "fuse", "heat", "stardust", "global", "heavy", "planet", "gate", "need", "auto", "offline", "keepPlanets", "startH", "keepStardust", "horizon"] as FxKey[]) o[k] = MUL.includes(k) ? 1 : 0;
    return o;
}

function addPerks(f: Fx, list: Perk[], owned: string[]) {
    for (const p of list) {
        if (!owned.includes(p.id)) continue;
        for (const [k, v] of Object.entries(p.fx) as [FxKey, number][]) {
            if (MUL.includes(k)) f[k] *= v;
            else f[k] += v;
        }
    }
}

export function effects(s: State): Fx {
    const f = blank();
    addPerks(f, PERKS, s.perks);
    addPerks(f, PULSAR_PERKS, s.pulsar);
    const pp = 1 + f.planet;
    let gateP = 0;
    for (const id of s.planets) {
        const pl = PLANETS.find((p) => p.id === id);
        if (!pl) continue;
        for (const [k, v] of Object.entries(pl.fx) as [FxKey, number][]) {
            if (MUL.includes(k)) f[k] *= 1 + (v - 1) * pp;
            else if (k === "gate") gateP += v * pp;
        }
    }
    f.gate = Math.min(0.75, f.gate + gateP);
    f.need = Math.min(0.9, f.need);
    f.global *= Math.pow(2, s.sing);
    if (f.horizon === 0) f.horizon = 0;
    return f;
}

// ---- derived numbers ----------------------------------------------------------------------------------------------

export const mass = (s: State) => s.mass;

export const heatTarget = (s: State, f: Fx) => TUNE.heatK * Math.pow(mass(s) + 1, TUNE.heatExp) * f.heat;

export const inflow = (s: State, f: Fx) => (TUNE.inflowBase + TUNE.inflowK * Math.pow(mass(s), TUNE.inflowExp)) * f.inflow * f.global;

/** Fuse levels of a row: tier I adds 1, II adds 10, III adds 100 per press. */
export const levels = (s: State, i: number) => {
    const b = s.bought[i];
    if (!b) return 0;
    let n = 0;
    for (let k = 0; k < TIERS; k++) n += b[k] * TIER_LEVELS[k];
    return n;
};

export const gateMK = (i: number, f: Fx) => GATE_MK[i] * (1 - f.gate);

/** Rows 7 and 8 (Iron to Gold to Uranium) are the r-process and only run once a neutron star has formed. */
export const rowOpen = (s: State, i: number) => i < 7 || s.neutronStars > 0;

/** Every MILESTONE levels in a row doubles that row. */
export const rowMult = (s: State, i: number) => Math.pow(2, Math.floor(levels(s, i) / TUNE.milestone));

export const rowRate = (s: State, i: number, f: Fx) => levels(s, i) * rowMult(s, i) * BASE_RATE[i] * f.fuse * f.global * (i >= 7 ? f.heavy : 1);

export const cost = (s: State, i: number, k: number) => BASE_COST[i] * Math.pow(TIER_COST_X, k) * Math.pow(COST_GROWTH, s.bought[i][k]);

/** A row shows once its fuel has been seen. */
export const rowSeen = (s: State, i: number) => s.amt[i] >= 1 || levels(s, i) > 0 || (i > 0 && s.amt[i - 1] >= BASE_COST[i - 1] * 0.5);

export function canBuy(s: State, i: number, k: number): boolean {
    return rowOpen(s, i) && s.amt[i] >= cost(s, i, k);
}

export function buy(s: State, i: number, k: number): boolean {
    if (!canBuy(s, i, k)) return false;
    s.amt[i] -= cost(s, i, k);
    s.bought[i][k]++;
    return true;
}

/** Iron for a collapse. It rises with every supernova in this neutron layer, so a run never collapses faster than the last by luck alone. */
export const feNeed = (s: State, f: Fx) => TUNE.feNeed * Math.pow(TUNE.needGrow, s.novas) * (1 - f.need);
export const collapse = (s: State, f: Fx) => s.amt[7] / feNeed(s, f);
export const seeds = (s: State, f: Fx) => Math.floor(TUNE.seedK * Math.pow(Math.max(0, s.amt[7] / TUNE.feNeed), TUNE.seedExp) * f.stardust);
export const canSupernova = (s: State, f: Fx) => collapse(s, f) >= 1;

export const neutronGain = (s: State) => Math.floor(Math.sqrt(s.sdLayer / TUNE.neutronDiv));
export const canNeutron = (s: State) => s.sdLayer >= TUNE.neutronAt;

export const horizonNeed = (f: Fx) => TUNE.horizonU * (1 - f.horizon);
export const canBlackHole = (s: State, f: Fx) => s.neutronStars > 0 && s.amt[9] >= horizonNeed(f);

/** Index of the heaviest element the star holds, for its look. */
export const heaviest = (s: State) => {
    for (let i = N - 1; i >= 0; i--) if (s.amt[i] >= 1) return i;
    return 0;
};

/** Star stage for the look: 0 protostar, 1 dwarf, 2 giant, 3 blue giant, 4 supergiant, 5 iron core. */
export const stageOf = (s: State) => {
    const h = heaviest(s);
    return h < 1 ? 0 : h === 1 ? 1 : h < 4 ? 2 : h < 6 ? 3 : h === 6 ? 4 : 5;
};

// ---- the tick -----------------------------------------------------------------------------------------------------

export function step(s: State, dt: number, f: Fx = effects(s)): void {
    if (dt <= 0) return;
    const before = s.amt.slice();
    const target = heatTarget(s, f);
    s.heat += (target - s.heat) * (1 - Math.exp(-dt / TUNE.heatEase));
    const gain = inflow(s, f) * dt;
    s.amt[0] = clamp(s.amt[0] + gain);
    s.mass = clamp(s.mass + gain);
    for (let i = ROWS - 1; i >= 0; i--) {
        if (!rowOpen(s, i)) continue;
        if (s.heat < gateMK(i, f)) continue;
        const want = rowRate(s, i, f) * dt;
        if (want <= 0) continue;
        let n = want;
        for (const [e, q] of RECIPE[i]) n = Math.min(n, s.amt[e] / q);
        if (n <= 0) continue;
        for (const [e, q] of RECIPE[i]) s.amt[e] -= n * q;
        s.amt[i + 1] = clamp(s.amt[i + 1] + n);
    }
    s.flow = s.amt.map((v, i) => (v - before[i]) / dt);
    s.age += dt;
    s.totalAge += dt;
    autoburn(s, f);
}

/** Autoburn (Loom perks): buys tier I of the first rows, but only ever with a small share of the stock. */
export function autoburn(s: State, f: Fx) {
    const rows = Math.min(ROWS, Math.floor(f.auto));
    for (let i = 0; i < rows; i++) {
        if (!rowOpen(s, i)) continue;
        for (let n = 0; n < 6; n++) {
            const c = cost(s, i, 0);
            if (c > s.amt[i] * TUNE.autoCost) break;
            s.amt[i] -= c;
            s.bought[i][0]++;
        }
    }
}

export const offlineCapS = (f: Fx) => (TUNE.offlineH + f.offline) * 3600;

/** Catch up after time away. Returns the seconds simulated. Capped by the Long watch perk. */
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

function newStar(s: State, keepPlanets: boolean) {
    const f = effects(s);
    s.amt = Array(N).fill(0);
    s.amt[0] = 30 + f.startH;
    s.mass = 30 + f.startH;
    s.bought = Array.from({ length: ROWS }, () => Array(TIERS).fill(0));
    s.heat = 0;
    s.age = 0;
    if (!keepPlanets) s.planets = [];
    s.name = STARNAMES[(s.novasAll + s.neutronStars * 3 + s.sing * 5) % STARNAMES.length];
}

export function supernova(s: State): number {
    const f = effects(s);
    if (!canSupernova(s, f)) return 0;
    const gain = seeds(s, f);
    s.stardust += gain;
    s.sdLayer += gain;
    s.sdAll += gain;
    s.novas++;
    s.novasAll++;
    newStar(s, f.keepPlanets > 0);
    return gain;
}

const EMBER_ROOTS = ["l1", "k1", "a1", "w1"];

export function neutronStar(s: State): number {
    if (!canNeutron(s)) return 0;
    const gain = neutronGain(s);
    const f = effects(s);
    const kept = Math.floor(s.stardust * f.keepStardust);
    s.neutrons += gain;
    s.neutronsAll += gain;
    s.neutronStars++;
    s.stardust = kept;
    s.sdLayer = 0;
    s.perks = s.pulsar.includes("p5") ? [...EMBER_ROOTS] : [];
    s.novas = 0;
    newStar(s, false);
    return gain;
}

export function blackHole(s: State): boolean {
    const f = effects(s);
    if (!canBlackHole(s, f)) return false;
    s.sing++;
    s.ending = true;
    s.neutrons = 0;
    s.pulsar = [];
    s.neutronStars = 0;
    s.stardust = 0;
    s.sdLayer = 0;
    s.perks = [];
    s.novas = 0;
    newStar(s, false);
    return true;
}

// ---- constellations, pulsar map, planets --------------------------------------------------------------------------

export const perkReady = (list: Perk[], owned: string[], p: Perk) => !owned.includes(p.id) && p.req.every((r) => owned.includes(r));

export function buyPerk(s: State, id: string): boolean {
    const p = PERKS.find((x) => x.id === id);
    if (!p || !perkReady(PERKS, s.perks, p) || s.stardust < p.cost) return false;
    s.stardust -= p.cost;
    s.perks.push(p.id);
    return true;
}

export function buyPulsar(s: State, id: string): boolean {
    const p = PULSAR_PERKS.find((x) => x.id === id);
    if (!p || !perkReady(PULSAR_PERKS, s.pulsar, p) || s.neutrons < p.cost) return false;
    s.neutrons -= p.cost;
    s.pulsar.push(p.id);
    return true;
}

export function canPlanet(s: State, id: string): boolean {
    const pl = PLANETS.find((x) => x.id === id);
    return !!pl && !s.planets.includes(id) && pl.cost.every(([e, q]) => s.amt[e] >= q);
}

export function buyPlanet(s: State, id: string): boolean {
    if (!canPlanet(s, id)) return false;
    const pl = PLANETS.find((x) => x.id === id)!;
    for (const [e, q] of pl.cost) s.amt[e] -= q;
    s.planets.push(id);
    return true;
}

// ---- saves --------------------------------------------------------------------------------------------------------

const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const strs = (v: unknown, ok: (x: string) => boolean) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && ok(x)))] : []);

export function isSave(v: unknown): v is State {
    return !!v && typeof v === "object" && Array.isArray((v as State).amt) && Array.isArray((v as State).bought);
}

/** Rebuild a state from anything stored. Unknown fields are dropped, missing ones refilled, so old saves keep loading. */
export function parse(raw: unknown): State | null {
    if (!isSave(raw)) return null;
    const r = raw as unknown as Record<string, unknown>;
    const s = fresh(num(r.savedAt, Date.now()));
    s.amt = s.amt.map((_, i) => clamp(num((r.amt as unknown[])[i])));
    s.bought = s.bought.map((row, i) => row.map((_, k) => Math.max(0, Math.floor(num(((r.bought as unknown[][])[i] ?? [])[k])))));
    s.mass = Math.max(30, clamp(num(r.mass, 30)));
    s.heat = clamp(num(r.heat));
    s.age = num(r.age);
    s.totalAge = num(r.totalAge);
    s.name = typeof r.name === "string" && r.name.trim() ? r.name.trim().slice(0, 24) : s.name;
    s.stardust = clamp(num(r.stardust));
    s.sdLayer = clamp(num(r.sdLayer));
    s.sdAll = clamp(num(r.sdAll));
    s.perks = strs(r.perks, (x) => PERKS.some((p) => p.id === x));
    s.novas = Math.max(0, Math.floor(num(r.novas)));
    s.novasAll = Math.max(0, Math.floor(num(r.novasAll)));
    s.neutrons = clamp(num(r.neutrons));
    s.neutronsAll = clamp(num(r.neutronsAll));
    s.pulsar = strs(r.pulsar, (x) => PULSAR_PERKS.some((p) => p.id === x));
    s.neutronStars = Math.max(0, Math.floor(num(r.neutronStars)));
    s.sing = Math.max(0, Math.floor(num(r.sing)));
    s.planets = strs(r.planets, (x) => PLANETS.some((p) => p.id === x));
    s.ending = r.ending === true;
    s.seen = strs(r.seen, () => true).slice(0, 64);
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
    if (n < 1e6) return Math.floor(n).toLocaleString("en-US");
    const e = Math.floor(Math.log10(n));
    return `${(n / Math.pow(10, e)).toFixed(digits)}e${e}`;
}

export function fmtHeat(mk: number): string {
    if (mk < 1000) return `${mk >= 100 ? Math.round(mk) : mk.toFixed(1)} MK`;
    return `${(mk / 1000).toFixed(mk < 10000 ? 2 : 1)} GK`;
}

export function fmtAge(sec: number): string {
    if (sec < 90) return `${Math.floor(sec)} s`;
    if (sec < 5400) return `${Math.floor(sec / 60)} min`;
    return `${(sec / 3600).toFixed(1)} h`;
}
