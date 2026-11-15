// Starwright engine. Pure TypeScript: no React, no DOM, so the sim script and the tests run it under node.
// A star fuses hydrogen up the periodic table. Core heat (set by the star's mass) gates each fusion. Iron cannot fuse, so
// it collapses: a supernova pays Stardust for the constellation map. Stardust piles into a neutron star (Neutrons, a
// pulsar map, and the r-process rows: gold, uranium), and uranium piles into a black hole (a Singularity).
import {
    ACHIEVEMENTS, ACH_BONUS, CLOUDS, ELEMENTS as EL, EVENTS, EVENT_FIRST, EVENT_GAP, EVENT_STAY, type Buff, type StarEvent,
    BASE_COST, BASE_RATE, COST_GROWTH, ELEMENTS, GATE_MK, N, PERKS, PLANETS, PULSAR_PERKS, RECIPE, ROWS, STARNAMES, TIERS,
    PLANET_STAGE_AT, PLANET_STAGE_BONUS, TIER_COST_X, TIER_NAMES, TIER_LEVELS, TUNE, type FxKey, type Perk,
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
    neutronStarsAll: number;
    sing: number;
    planets: string[];
    /** seconds each planet has been in orbit, by id */
    planetAge: Record<string, number>;
    /** best collapse seen this star, and highest Fe this star */
    ending: boolean;
    savedAt: number;
    /** first-time moments already shown, as ids */
    seen: string[];
    /** the visitor waiting at the star (id of the event and seconds left), and seconds until the next one */
    event: { id: string; left: number } | null;
    evIn: number;
    /** timed boosts from visitors */
    buffs: Array<Buff & { name: string; left: number }>;
    /** birth cloud of this star, and the three on offer (empty once chosen) */
    cloud: string;
    offer: string[];
    cloudsPicked: number;
    visitors: number;
    /** shortest star life that ended in a supernova, seconds (0 = none yet) */
    fastest: number;
    ach: string[];
    /** elements that have ever existed in a star, by symbol (the codex) */
    found: string[];
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
        neutronStarsAll: 0,
        sing: 0,
        planets: [],
        planetAge: {},
        ending: false,
        savedAt: now,
        seen: [],
        event: null,
        evIn: EVENT_FIRST,
        buffs: [],
        cloud: "",
        offer: [],
        cloudsPicked: 0,
        visitors: 0,
        fastest: 0,
        ach: [],
        found: ["H"],
    };
    s.amt[0] = 30;
    return s;
}

const clamp = (x: number) => (Number.isFinite(x) ? Math.min(TUNE.cap, Math.max(0, x)) : x > 0 ? TUNE.cap : 0);

// ---- effects ------------------------------------------------------------------------------------------------------

export type Fx = Record<FxKey, number>;
const MUL: FxKey[] = ["inflow", "fuse", "heat", "stardust", "global", "heavy", "events"];

function blank(): Fx {
    const o = {} as Fx;
    for (const k of ["inflow", "fuse", "heat", "stardust", "global", "heavy", "events", "planet", "gate", "need", "auto", "offline", "keepPlanets", "startH", "keepStardust", "horizon"] as FxKey[]) o[k] = MUL.includes(k) ? 1 : 0;
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

/** 0 to 3: how far a planet in orbit has come. Older planets pay more. */
export function planetStage(s: State, id: string): number {
    const age = s.planetAge[id] ?? 0;
    let st = 0;
    for (let i = 1; i < PLANET_STAGE_AT.length; i++) if (age >= PLANET_STAGE_AT[i]) st = i;
    return st;
}

export function effects(s: State): Fx {
    const f = blank();
    addPerks(f, PERKS, s.perks);
    addPerks(f, PULSAR_PERKS, s.pulsar);
    const cl = CLOUDS.find((c) => c.id === s.cloud);
    if (cl) for (const [k, v] of Object.entries(cl.fx) as [FxKey, number][]) { if (MUL.includes(k)) f[k] *= v; else f[k] += v; }
    for (const b of s.buffs) { if (MUL.includes(b.k)) f[b.k] *= b.v; else f[b.k] += b.v; }
    const pp = 1 + f.planet;
    let gateP = 0;
    for (const id of s.planets) {
        const pl = PLANETS.find((p) => p.id === id);
        if (!pl) continue;
        const grow = 1 + PLANET_STAGE_BONUS * planetStage(s, id);
        for (const [k, v] of Object.entries(pl.fx) as [FxKey, number][]) {
            if (MUL.includes(k)) f[k] *= 1 + (v - 1) * pp * grow;
            else if (k === "gate") gateP += v * pp * grow;
        }
    }
    f.gate = Math.min(0.75, f.gate + gateP);
    f.need = Math.min(0.9, f.need);
    f.global *= Math.pow(2, s.sing) * (1 + ACH_BONUS * s.ach.length);
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

/** Seconds until the core reaches the collapse line at the iron flow of the last tick, 0 if it is there, null while iron is not growing. */
export function collapseEta(s: State, f: Fx): number | null {
    const left = feNeed(s, f) - s.amt[7];
    if (left <= 0) return 0;
    const flow = s.flow?.[7] ?? 0;
    return flow > 0.001 ? left / flow : null;
}

/** The one line that tells a player what to do next. Never empty, and never the same line for twenty minutes: it names the
 *  next unopened row, then the row nearest iron that can be bought now, then how long the iron has left. */
export function guide(s: State, f: Fx): string {
    for (let r = 0; r < ROWS; r++) {
        if (!rowOpen(s, r)) break; // gold and uranium wait for a neutron star; the lines below carry the player meanwhile
        if (levels(s, r) === 0) {
            const gate = gateMK(r, f);
            const heat = s.heat >= gate ? "" : ` and core heat ${fmtHeat(gate)}`;
            return `Next: burn ${ELEMENTS[r].name.toLowerCase()} into ${ELEMENTS[r + 1].name.toLowerCase()}. Needs ${fmt(cost(s, r, 0))} ${ELEMENTS[r].sym}${heat}.`;
        }
    }
    if (canSupernova(s, f)) return `The core is ready. A supernova now seeds ${fmt(seeds(s, f))} stardust, and more iron seeds more.`;
    if (s.neutronStars > 0 && s.amt[7] >= feNeed(s, f) * 0.5 && s.amt[9] > 0) return `A black hole needs ${fmt(horizonNeed(f))} uranium. You hold ${fmt(s.amt[9])}.`;
    // the highest affordable burner below iron: that is the buy that moves the collapse
    for (let i = 6; i >= 0; i--) {
        for (let k = TIERS - 1; k >= 0; k--) {
            if (canBuy(s, i, k) && cost(s, i, k) >= BASE_COST[i] * 2) return `${ELEMENTS[i].name} burner ${TIER_NAMES[k]} is ready. It pushes the chain toward iron.`;
        }
    }
    const eta = collapseEta(s, f);
    const have = `Iron ${fmt(s.amt[7])} of ${fmt(feNeed(s, f))}.`;
    if (eta === null) return `${have} Silicon is not reaching iron yet. Feed it: more magnesium and silicon burners.`;
    return `${have} About ${fmtAge(Math.ceil(eta))} to the collapse at this rate.`;
}

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
    for (const id of s.planets) s.planetAge[id] = (s.planetAge[id] ?? 0) + dt;
    for (let i = 0; i < N; i++) if (s.amt[i] >= 1 && !s.found.includes(EL[i].sym)) s.found.push(EL[i].sym);
    if (s.buffs.length) s.buffs = s.buffs.map((b) => ({ ...b, left: b.left - dt })).filter((b) => b.left > 0);
    // Visitors only come while the game is open (small steps); time away never spawns them.
    if (dt <= 1.5) {
        if (s.event) {
            s.event.left -= dt;
            if (s.event.left <= 0) leave(s, f);
        } else {
            s.evIn -= dt;
            if (s.evIn <= 0) s.event = { id: EVENTS[Math.floor(Math.random() * EVENTS.length)].id, left: EVENT_STAY };
        }
    }
}

const nextVisitor = (f: Fx) => (EVENT_GAP[0] + Math.random() * EVENT_GAP[1]) / f.events;

function leave(s: State, f: Fx) {
    s.event = null;
    s.evIn = nextVisitor(f);
}

export const eventOf = (s: State): StarEvent | null => (s.event ? EVENTS.find((e) => e.id === s.event!.id) ?? null : null);

/** Answer the waiting visitor with option 0 or 1. Returns the option, or null if nobody waits. */
export function answer(s: State, pick: number) {
    const ev = eventOf(s);
    const opt = ev?.opts[pick];
    if (!ev || !opt) return null;
    const f = effects(s);
    if (opt.lump) for (let n = 0; n < 10; n++) step(s, opt.lump / 10, effects(s));
    if (opt.gas) { const g = inflow(s, f) * opt.gas; s.amt[0] = clamp(s.amt[0] + g); s.mass = clamp(s.mass + g); }
    for (const b of opt.buffs ?? []) s.buffs = [...s.buffs.filter((x) => !(x.k === b.k && x.name === opt.label)), { ...b, name: opt.label, left: b.secs }];
    s.visitors++;
    leave(s, effects(s));
    return opt;
}

// ---- almanac ------------------------------------------------------------------------------------------------------

const ACH_TEST: Record<string, (s: State) => boolean> = {
    flame: (s) => s.bought.some((r) => r.some((n) => n > 0)),
    l25: (s) => s.bought.some((_, i) => levels(s, i) >= 25),
    l100: (s) => s.bought.some((_, i) => levels(s, i) >= 100),
    l300: (s) => s.bought.some((_, i) => levels(s, i) >= 300),
    iron: (s) => s.found.includes("Fe"),
    nova1: (s) => s.novasAll >= 1,
    nova10: (s) => s.novasAll >= 10,
    nova40: (s) => s.novasAll >= 40,
    fast: (s) => s.fastest > 0 && s.fastest < 600,
    guest: (s) => s.visitors >= 1,
    guest12: (s) => s.visitors >= 12,
    cloud: (s) => s.cloudsPicked >= 1,
    cloud8: (s) => s.cloudsPicked >= 8,
    world4: (s) => s.planets.length >= 4,
    world8: (s) => s.planets.length >= 8,
    map8: (s) => s.perks.length >= 8,
    pulsar: (s) => s.neutronStarsAll > 0,
    gold: (s) => s.found.includes("Au"),
    uranium: (s) => s.found.includes("U"),
    sing: (s) => s.sing > 0,
    night: (s) => s.totalAge >= 86400,
};

/** Award any achievement now true. Returns the new ones. */
export function checkAch(s: State): string[] {
    const got: string[] = [];
    for (const a of ACHIEVEMENTS) {
        if (s.ach.includes(a.id) || !ACH_TEST[a.id]?.(s)) continue;
        s.ach.push(a.id);
        got.push(a.id);
    }
    return got;
}

// ---- birth clouds -------------------------------------------------------------------------------------------------

function offerClouds(s: State) {
    s.cloud = "";
    const pool = CLOUDS.map((c) => c.id);
    const pick: string[] = [];
    while (pick.length < 3) pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    s.offer = s.novasAll >= 1 ? pick : [];
}

export function chooseCloud(s: State, id: string): boolean {
    if (!s.offer.includes(id)) return false;
    s.cloud = id;
    s.offer = [];
    s.cloudsPicked++;
    return true;
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

/** How the planets come through a collapse: "age" keeps them as they are, "young" keeps them but they grow again from stage 0, "clear" loses them. */
type PlanetFate = "age" | "young" | "clear";

function newStar(s: State, planets: PlanetFate) {
    const f = effects(s);
    s.amt = Array(N).fill(0);
    s.amt[0] = 30 + f.startH;
    s.mass = 30 + f.startH;
    s.bought = Array.from({ length: ROWS }, () => Array(TIERS).fill(0));
    s.heat = 0;
    s.age = 0;
    if (planets === "clear") { s.planets = []; s.planetAge = {}; }
    else if (planets === "young") for (const id of s.planets) s.planetAge[id] = 0;
    s.event = null;
    s.evIn = EVENT_FIRST;
    s.buffs = [];
    s.cloud = "";
    s.offer = [];
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
    if (s.fastest === 0 || s.age < s.fastest) s.fastest = s.age;
    newStar(s, f.keepPlanets > 0 ? "age" : "young");
    offerClouds(s);
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
    s.neutronStarsAll++;
    s.stardust = kept;
    s.sdLayer = 0;
    s.perks = s.pulsar.includes("p5") ? [...EMBER_ROOTS] : [];
    s.novas = 0;
    newStar(s, "clear");
    offerClouds(s);
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
    newStar(s, "clear");
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
    s.planetAge[id] = 0;
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
    s.neutronStarsAll = Math.max(s.neutronStars, Math.floor(num(r.neutronStarsAll)));
    s.sing = Math.max(0, Math.floor(num(r.sing)));
    s.planets = strs(r.planets, (x) => PLANETS.some((p) => p.id === x));
    const pa = (r.planetAge ?? {}) as Record<string, unknown>;
    for (const id of s.planets) s.planetAge[id] = Math.max(0, num(pa[id]));
    s.ending = r.ending === true;
    s.seen = strs(r.seen, () => true).slice(0, 64);
    s.ach = strs(r.ach, (x) => ACHIEVEMENTS.some((a) => a.id === x));
    s.found = strs(r.found, (x) => EL.some((e) => e.sym === x));
    if (!s.found.includes("H")) s.found.unshift("H");
    for (let i = 0; i < N; i++) if (s.amt[i] >= 1 && !s.found.includes(EL[i].sym)) s.found.push(EL[i].sym);
    s.cloud = typeof r.cloud === "string" && CLOUDS.some((c) => c.id === r.cloud) ? r.cloud : "";
    s.offer = strs(r.offer, (x) => CLOUDS.some((c) => c.id === x)).slice(0, 3);
    s.cloudsPicked = Math.max(0, Math.floor(num(r.cloudsPicked)));
    s.visitors = Math.max(0, Math.floor(num(r.visitors)));
    s.fastest = Math.max(0, num(r.fastest));
    s.evIn = Math.max(0, num(r.evIn, EVENT_FIRST));
    const ev = r.event as { id?: unknown; left?: unknown } | null;
    s.event = ev && typeof ev.id === "string" && EVENTS.some((e) => e.id === ev.id) ? { id: ev.id, left: Math.max(1, num(ev.left, EVENT_STAY)) } : null;
    s.buffs = Array.isArray(r.buffs)
        ? (r.buffs as Array<Record<string, unknown>>)
              .filter((b) => b && typeof b.k === "string" && ["inflow", "fuse", "heat", "global"].includes(b.k) && typeof b.name === "string" && num(b.v) > 0 && num(b.left) > 0 && num(b.left) <= 600)
              .slice(0, 8)
              .map((b) => ({ k: b.k as FxKey, v: num(b.v), secs: num(b.secs), name: String(b.name), left: num(b.left) }))
        : [];
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
