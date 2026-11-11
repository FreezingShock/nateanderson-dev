// Node Farm engine: pure game rules, no React and no imports, so the pacing sim (scripts/nodefarm/sim.mjs) can run it
// directly in Node. Numbers are plain doubles; a full run stays far below 1e308.

export type StatId = "bytes" | "mult" | "reboot" | "copper" | "silicon" | "quartz" | "aether";
export type ButtonStat = Exclude<StatId, "bytes">;

export const TIERS = 6;

export interface StatDef {
    id: StatId;
    name: string;
    short: string;
    /** one line on what the stat does, shown on the row */
    role: string;
    /** the stat that pays for this one's buttons */
    pays?: StatId;
    color: string;
}

export const STATS: StatDef[] = [
    { id: "bytes", name: "Bytes", short: "B", role: "The base stat. Earned every second.", color: "#2fd8e8" },
    { id: "mult", name: "Multipliers", short: "MUL", role: "Each one adds to your Bytes per second.", pays: "bytes", color: "#b6f04a" },
    { id: "reboot", name: "Reboots", short: "RBT", role: "Resets Bytes and Multipliers. Makes every Multiplier button hit harder.", pays: "mult", color: "#ff2d8a" },
    { id: "copper", name: "Copper", short: "CU", role: "Trace lines. Boosts Reboots and adds a little to Bytes.", pays: "bytes", color: "#f08a3c" },
    { id: "silicon", name: "Silicon", short: "SI", role: "Wafers. Boosts Copper.", pays: "copper", color: "#7aa2ff" },
    { id: "quartz", name: "Quartz", short: "QZ", role: "Resonators. Boosts Silicon.", pays: "silicon", color: "#e08cff" },
    { id: "aether", name: "Aether", short: "AE", role: "Raw signal. Boosts Quartz, and unlocks Ascend.", pays: "quartz", color: "#6bffc9" },
];

export const statDef = (id: StatId) => STATS.find((s) => s.id === id)!;

// ---- tuning (see docs/node-farm.md). Every number lives here so pacing can be changed in one place.
export const TUNE = {
    // button price = base * ratio^tier * growth^timesBought
    cost: {
        mult: { base: 12, ratio: 8, growth: 1.09 },
        copper: { base: 600_000, ratio: 10, growth: 1.12 },
        silicon: { base: 1500, ratio: 10, growth: 1.12 },
        quartz: { base: 9000, ratio: 10, growth: 1.12 },
        aether: { base: 60_000, ratio: 10, growth: 1.12 },
    } as Record<string, { base: number; ratio: number; growth: number }>,
    // how much one press of tier k adds (Multipliers, or producers for materials)
    gainBase: { mult: 1, copper: 1, silicon: 1, quartz: 1, aether: 1 } as Record<string, number>,
    gainRatio: 5,
    // reboot tier k: costs rebootBase * rebootRatio^k * rebootGrowth^R Multipliers, adds rebootGainRatio^k Reboots
    rebootBase: 260,
    rebootRatio: 4.5,
    rebootGrowth: 1.14,
    rebootGainRatio: 2.6,
    rebootStrength: 0.45, // each Reboot adds this much to Multiplier button gains
    perProducer: { copper: 0.012, silicon: 0.004, quartz: 0.0015, aether: 0.0005 } as Record<string, number>,
    boostK: { cuReboot: 0.09, cuBytes: 0.02, siCu: 0.12, qzSi: 0.12, aeQz: 0.12 },
    boostPow: 0.38,
    unlockAt: { copper: 1, silicon: 150, quartz: 300, aether: 500 } as Record<string, number>, // copper: Reboots; the rest: amount of the stat below
    overclockMult: 6,
    overclockSecs: 20,
    intrusionEvery: [55, 110] as [number, number],
    intrusionLife: 9,
    offlineCapHours: 8,
    ascendAether: 400,
    apPerAether: 60, // AP = floor(sqrt(aether / apPerAether))
    apBonus: 0.25,
    achBonus: 0.02,
    tierBonus: 0.08, // extra global bonus for each fully completed goal tier
    autoReserve: 10, // the Autoloader only buys when the balance is at least this many times the price
};

export interface PerkDef {
    id: "scanner" | "auto" | "overclock" | "offline" | "start" | "power";
    name: string;
    blurb: string;
    max: number;
    cost: (lvl: number) => number;
}

export const PERKS: PerkDef[] = [
    { id: "power", name: "Power core", blurb: "+15% to everything per level.", max: 20, cost: (l) => 1 + l },
    { id: "scanner", name: "Wide-band scanner", blurb: "Intrusions arrive 8% sooner per level.", max: 6, cost: (l) => 1 + l },
    { id: "auto", name: "Autoloader", blurb: "Auto-buys for you, one stat per level (Multipliers, Copper, Silicon, Quartz, Aether).", max: 5, cost: (l) => 3 + l * 2 },
    { id: "overclock", name: "Overclock coils", blurb: "Intrusion boosts last +5 s per level.", max: 6, cost: (l) => 2 + l * 2 },
    { id: "offline", name: "Standby cells", blurb: "Offline time banks +4 hours per level.", max: 6, cost: (l) => 2 + l * 2 },
    { id: "start", name: "Cold cache", blurb: "Start each Reboot with 10 seconds of Bytes per level.", max: 10, cost: (l) => 1 + Math.floor(l / 2) },
];

export interface State {
    v: 1;
    at: number; // last saved/ticked, ms epoch
    started: number;
    bytes: number;
    mult: number;
    reboot: number;
    copper: number;
    silicon: number;
    quartz: number;
    aether: number;
    prod: Record<"copper" | "silicon" | "quartz" | "aether", number>;
    bought: Record<ButtonStat, number[]>;
    ap: number;
    perks: Record<PerkDef["id"], number>;
    ach: string[];
    // lifetime counters (survive Ascend)
    life: { bytes: number; taps: number; reboots: number; ascends: number; intrusions: number; secs: number; presses: number };
    overclock: number; // seconds left
}

export function fresh(now = Date.now()): State {
    return {
        v: 1,
        at: now,
        started: now,
        bytes: 0,
        mult: 1,
        reboot: 0,
        copper: 0,
        silicon: 0,
        quartz: 0,
        aether: 0,
        prod: { copper: 0, silicon: 0, quartz: 0, aether: 0 },
        bought: { mult: Array(TIERS).fill(0), reboot: Array(TIERS).fill(0), copper: Array(TIERS).fill(0), silicon: Array(TIERS).fill(0), quartz: Array(TIERS).fill(0), aether: Array(TIERS).fill(0) },
        ap: 0,
        perks: { scanner: 0, auto: 0, overclock: 0, offline: 0, start: 0, power: 0 },
        ach: [],
        life: { bytes: 0, taps: 0, reboots: 0, ascends: 0, intrusions: 0, secs: 0, presses: 0 },
        overclock: 0,
    };
}

const boost = (amount: number, k: number) => 1 + k * Math.pow(Math.max(0, amount), TUNE.boostPow);

export interface Derived {
    global: number;
    bytesPerSec: number;
    rebootStrength: number;
    multGainMult: number;
    rates: Record<"copper" | "silicon" | "quartz" | "aether", number>;
    offlineCap: number; // seconds
    boosts: { cuReboot: number; cuBytes: number; siCu: number; qzSi: number; aeQz: number };
}

export function derive(s: State): Derived {
    const k = TUNE.boostK;
    const boosts = {
        cuReboot: boost(s.copper, k.cuReboot),
        cuBytes: boost(s.copper, k.cuBytes),
        siCu: boost(s.silicon, k.siCu),
        qzSi: boost(s.quartz, k.qzSi),
        aeQz: boost(s.aether, k.aeQz),
    };
    const global = (1 + s.perks.power * 0.15) * (1 + s.ap * TUNE.apBonus) * (1 + s.ach.length * TUNE.achBonus) * (1 + tiersDone(s) * TUNE.tierBonus) * (s.overclock > 0 ? TUNE.overclockMult : 1);
    const rebootStrength = TUNE.rebootStrength * boosts.cuReboot;
    const multGainMult = 1 + rebootStrength * s.reboot;
    const bytesPerSec = s.mult * boosts.cuBytes * global;
    const rates = {
        copper: s.prod.copper * TUNE.perProducer.copper * boosts.siCu * global,
        silicon: s.prod.silicon * TUNE.perProducer.silicon * boosts.qzSi * global,
        quartz: s.prod.quartz * TUNE.perProducer.quartz * boosts.aeQz * global,
        aether: s.prod.aether * TUNE.perProducer.aether * global,
    };
    return { global, bytesPerSec, rebootStrength, multGainMult, rates, offlineCap: (TUNE.offlineCapHours + s.perks.offline * 4) * 3600, boosts };
}

export const gainFor = (stat: ButtonStat, tier: number) => TUNE.gainBase[stat] * Math.pow(TUNE.gainRatio, tier);

/** What pressing one button costs and gives right now. */
export function button(s: State, stat: ButtonStat, tier: number) {
    if (stat === "reboot") {
        const cost = TUNE.rebootBase * Math.pow(TUNE.rebootRatio, tier) * Math.pow(TUNE.rebootGrowth, s.reboot);
        return { cost, gain: Math.max(1, Math.round(Math.pow(TUNE.rebootGainRatio, tier))), pays: "mult" as StatId };
    }
    const c = TUNE.cost[stat];
    const cost = c.base * Math.pow(c.ratio, tier) * Math.pow(c.growth, s.bought[stat][tier]);
    let gain = gainFor(stat, tier);
    if (stat === "mult") gain *= derive(s).multGainMult;
    return { cost, gain, pays: statDef(stat).pays as StatId };
}

export const amount = (s: State, id: StatId) => s[id] as number;
export const canAfford = (s: State, stat: ButtonStat, tier: number) => {
    const b = button(s, stat, tier);
    return amount(s, b.pays) >= b.cost;
};

export function isUnlocked(s: State, id: StatId): boolean {
    if (id === "bytes" || id === "mult") return true;
    if (id === "reboot") return s.life.bytes >= 600 || s.reboot > 0 || s.mult >= 40;
    if (id === "copper") return s.life.reboots >= TUNE.unlockAt.copper;
    const below: Record<string, StatId> = { silicon: "copper", quartz: "silicon", aether: "quartz" };
    return s.prod[id] > 0 || (amount(s, below[id]) >= TUNE.unlockAt[id]) || s.life.ascends > 0 && s.life.reboots >= TUNE.unlockAt.copper && amount(s, below[id]) >= TUNE.unlockAt[id] / 4;
}

/** Press a button. Returns false when it can't be afforded. A Reboot press also resets Bytes and Multipliers. */
export function press(s: State, stat: ButtonStat, tier: number): boolean {
    const b = button(s, stat, tier);
    if (amount(s, b.pays) < b.cost) return false;
    if (stat === "reboot") {
        s.reboot += b.gain;
        s.life.presses += 1;
        s.life.reboots += b.gain;
        s.mult = 1;
        s.bought.mult.fill(0);
        s.bytes = derive(s).bytesPerSec * 10 * s.perks.start;
        return true;
    }
    (s[b.pays] as number) = amount(s, b.pays) - b.cost;
    s.life.presses += 1;
    s.bought[stat][tier] += 1;
    if (stat === "mult") s.mult += b.gain;
    else s.prod[stat] += b.gain;
    return true;
}

export function tick(s: State, dt: number) {
    const d = derive(s);
    s.bytes += d.bytesPerSec * dt;
    s.life.bytes += d.bytesPerSec * dt;
    s.copper += d.rates.copper * dt;
    s.silicon += d.rates.silicon * dt;
    s.quartz += d.rates.quartz * dt;
    s.aether += d.rates.aether * dt;
    if (s.overclock > 0) s.overclock = Math.max(0, s.overclock - dt);
    s.life.secs += dt;
}

/** Hit the intrusion target: a timed boost. */
export function breach(s: State) {
    s.overclock = TUNE.overclockSecs + s.perks.overclock * 5;
    s.life.intrusions += 1;
}

export const apOnAscend = (s: State) => (s.aether >= TUNE.ascendAether ? Math.floor(Math.sqrt(s.aether / TUNE.apPerAether)) : 0);
export const canAscend = (s: State) => apOnAscend(s) >= 1;

export function ascend(s: State) {
    const gain = apOnAscend(s);
    if (gain < 1) return 0;
    const keep = { ap: s.ap + gain, perks: s.perks, ach: s.ach, life: { ...s.life, ascends: s.life.ascends + 1 }, started: s.started };
    const n = fresh(s.at);
    Object.assign(n, keep);
    Object.assign(s, n);
    return gain;
}

export function buyPerk(s: State, id: PerkDef["id"]): boolean {
    const p = PERKS.find((x) => x.id === id)!;
    const lvl = s.perks[id];
    if (lvl >= p.max || s.ap < p.cost(lvl)) return false;
    s.ap -= p.cost(lvl);
    s.perks[id] += 1;
    return true;
}

/** Catch up for time away. Production only; nothing is bought for you. Returns what was gained. */
export function offline(s: State, seconds: number) {
    const cap = derive(s).offlineCap;
    const secs = Math.min(Math.max(0, seconds), cap);
    const before = { bytes: s.bytes, copper: s.copper, silicon: s.silicon, quartz: s.quartz, aether: s.aether };
    const steps = Math.min(600, Math.max(1, Math.ceil(secs / 20)));
    const dt = secs / steps;
    const oc = s.overclock;
    s.overclock = 0; // an intrusion boost doesn't carry through time away
    for (let i = 0; i < steps; i++) tick(s, dt);
    s.overclock = Math.max(0, oc - secs);
    return { secs, capped: seconds > cap, gain: { bytes: s.bytes - before.bytes, copper: s.copper - before.copper, silicon: s.silicon - before.silicon, quartz: s.quartz - before.quartz, aether: s.aether - before.aether } };
}

// ---- goals. Five tiers of six. Each goal gives a small permanent boost (TUNE.achBonus) and a full tier gives a bigger one (TUNE.tierBonus).
export interface Goal {
    id: string;
    name: string;
    hint: string;
    tier: number; // 1..5
    icon: "bytes" | "mult" | "reboot" | "copper" | "silicon" | "quartz" | "aether" | "alert" | "ascend" | "spark";
    cur: (s: State) => number;
    target: number;
}
export const TIER_NAMES = ["", "Access", "Operator", "Admin", "Root", "Kernel"];
const G = (id: string, name: string, hint: string, tier: number, icon: Goal["icon"], target: number, cur: (s: State) => number): Goal => ({ id, name, hint, tier, icon, cur, target });
const life = (k: keyof State["life"]) => (s: State) => s.life[k];
export const GOALS: Goal[] = [
    // I  ACCESS
    G("tap10", "First contact", "Press 10 buttons.", 1, "spark", 10, life("presses")),
    G("b1k", "Packet storm", "Earn 1,000 Bytes.", 1, "bytes", 1e3, life("bytes")),
    G("m100", "Stacked", "Hold 100 Multipliers.", 1, "mult", 100, (s) => s.mult),
    G("r1", "Cold boot", "Reboot once.", 1, "reboot", 1, life("reboots")),
    G("cu1", "Trace lines", "Mine your first Copper.", 1, "copper", 1e-9, (s) => s.copper),
    G("int1", "Counter-hack", "Win an intrusion.", 1, "alert", 1, life("intrusions")),
    // II OPERATOR
    G("tap500", "Calloused", "Press 500 buttons.", 2, "spark", 500, life("presses")),
    G("b1m", "Bandwidth", "Earn 1 million Bytes.", 2, "bytes", 1e6, life("bytes")),
    G("m10k", "Overstacked", "Hold 10,000 Multipliers.", 2, "mult", 1e4, (s) => s.mult),
    G("r25", "Habit", "Reach 25 Reboots.", 2, "reboot", 25, life("reboots")),
    G("cu1k", "Spool", "Hold 1,000 Copper.", 2, "copper", 1e3, (s) => s.copper),
    G("si1", "Wafer thin", "Mine your first Silicon.", 2, "silicon", 1e-9, (s) => s.silicon),
    // III ADMIN
    G("tap5k", "Keycap fatigue", "Press 5,000 buttons.", 3, "spark", 5000, life("presses")),
    G("b1b", "Backbone", "Earn 1 billion Bytes.", 3, "bytes", 1e9, life("bytes")),
    G("r100", "Triple digits", "Reach 100 Reboots.", 3, "reboot", 100, life("reboots")),
    G("si1k", "Fab line", "Hold 1,000 Silicon.", 3, "silicon", 1e3, (s) => s.silicon),
    G("qz1", "Resonance", "Mine your first Quartz.", 3, "quartz", 1e-9, (s) => s.quartz),
    G("int25", "Watchdog", "Win 25 intrusions.", 3, "alert", 25, life("intrusions")),
    // IV ROOT
    G("p25k", "Muscle memory", "Press 25,000 buttons.", 4, "spark", 25000, life("presses")),
    G("b1t", "Whole network", "Earn 1 trillion Bytes.", 4, "bytes", 1e12, life("bytes")),
    G("r500", "Uptime is a myth", "Reach 500 Reboots.", 4, "reboot", 500, life("reboots")),
    G("qz1k", "Clean cut", "Hold 1,000 Quartz.", 4, "quartz", 1e3, (s) => s.quartz),
    G("ae1", "Signal in the noise", "Gather your first Aether.", 4, "aether", 1e-9, (s) => s.aether),
    G("asc1", "Ascended", "Ascend once.", 4, "ascend", 1, life("ascends")),
    // V  KERNEL
    G("b1qa", "Past the index", "Earn 1 quadrillion Bytes.", 5, "bytes", 1e15, life("bytes")),
    G("cu1m", "Mother lode", "Hold 1 million Copper.", 5, "copper", 1e6, (s) => s.copper),
    G("si1m", "Silicon valley", "Hold 1 million Silicon.", 5, "silicon", 1e6, (s) => s.silicon),
    G("ae1k", "Open channel", "Hold 1,000 Aether.", 5, "aether", 1e3, (s) => s.aether),
    G("ae10k", "Beyond the veil", "Hold 10,000 Aether.", 5, "aether", 1e4, (s) => s.aether),
    G("asc5", "Fifth floor", "Ascend 5 times.", 5, "ascend", 5, life("ascends")),
];

export const goalDone = (s: State, g: Goal) => s.ach.includes(g.id);
/** Number of fully completed tiers. */
export function tiersDone(s: State): number {
    let n = 0;
    for (let t = 1; t <= 5; t++) if (GOALS.filter((g) => g.tier === t).every((g) => s.ach.includes(g.id))) n++;
    return n;
}

/** Returns goals newly completed (and records them). */
export function checkGoals(s: State): Goal[] {
    const out: Goal[] = [];
    for (const g of GOALS) if (!s.ach.includes(g.id) && g.cur(s) >= g.target) (s.ach.push(g.id), out.push(g));
    return out;
}

/** Autoloader perk: each level unlocks auto-buying for one stat. Buys at most one button per stat per call. */
export function autoBuy(s: State): number {
    const order: ButtonStat[] = ["mult", "copper", "silicon", "quartz", "aether"];
    let n = 0;
    for (let i = 0; i < Math.min(order.length, s.perks.auto); i++) {
        const st = order[i];
        if (!isUnlocked(s, st)) continue;
        for (let k = TIERS - 1; k >= 0; k--) {
            const b = button(s, st, k);
            if (amount(s, b.pays) >= b.cost * TUNE.autoReserve) {
                if (press(s, st, k)) n++;
                break;
            }
        }
    }
    return n;
}

// ---- saving
export function exportSave(s: State): string {
    return btoa(JSON.stringify({ ...s, at: Date.now() }));
}
export function parseSave(raw: string): State | null {
    try {
        const o = JSON.parse(raw.trim().startsWith("{") ? raw : atob(raw.trim()));
        if (!o || o.v !== 1 || typeof o.bytes !== "number") return null;
        const base = fresh();
        const n = { ...base, ...o, prod: { ...base.prod, ...o.prod }, perks: { ...base.perks, ...o.perks }, life: { ...base.life, ...o.life }, bought: { ...base.bought, ...o.bought } } as State;
        for (const k of Object.keys(n.bought) as ButtonStat[]) if (!Array.isArray(n.bought[k]) || n.bought[k].length !== TIERS) n.bought[k] = Array(TIERS).fill(0);
        for (const k of ["bytes", "mult", "reboot", "copper", "silicon", "quartz", "aether", "ap"] as const) if (!Number.isFinite(n[k])) n[k] = base[k];
        return n;
    } catch {
        return null;
    }
}

// ---- number formatting
const SUF = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
export function fmt(n: number, digits = 2): string {
    if (!Number.isFinite(n)) return "∞";
    if (n < 0) return "-" + fmt(-n, digits);
    if (n < 1000) return n < 10 && n % 1 ? n.toFixed(digits) : n < 100 && n % 1 ? n.toFixed(Math.max(0, digits - 1)) : Math.floor(n).toString();
    const e = Math.floor(Math.log10(n) / 3);
    if (e >= SUF.length) return n.toExponential(2).replace("+", "");
    const v = n / Math.pow(1000, e);
    return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0)) + SUF[e];
}
export function fmtTime(sec: number): string {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), x = sec % 60;
    return h ? `${h}h ${m}m` : m ? `${m}m ${x}s` : `${x}s`;
}
