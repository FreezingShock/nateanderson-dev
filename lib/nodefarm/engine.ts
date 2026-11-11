// Node Farm engine: pure game rules, no React and no imports, so the pacing sim (scripts/nodefarm/sim.mjs) can run it
// directly in Node. Numbers are plain doubles; a full run stays far below 1e308.

/** Producer materials in chain order. Each is paid in the one before it (Copper in Bytes) and boosts that one in turn. */
export const MATS = ["copper", "silicon", "quartz", "aether", "runes", "starglass", "voidsteel", "chrono"] as const;
export type MatId = (typeof MATS)[number];
export type StatId = "bytes" | "mult" | "reboot" | MatId;
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
    { id: "runes", name: "Runes", short: "RN", role: "Carved signal. Boosts Aether.", pays: "aether", color: "#ffc53a" },
    { id: "starglass", name: "Starglass", short: "SG", role: "Fused starlight. Boosts Runes.", pays: "runes", color: "#bfeaff" },
    { id: "voidsteel", name: "Voidsteel", short: "VS", role: "Metal from an empty place. Boosts Starglass.", pays: "starglass", color: "#9a7bff" },
    { id: "chrono", name: "Chrono", short: "CH", role: "Held time. Boosts Voidsteel and everything a little.", pays: "voidsteel", color: "#ff7a4a" },
];

export const statDef = (id: StatId) => STATS.find((s) => s.id === id)!;

// ---- tuning (see docs/node-farm.md). Every number lives here so pacing can be changed in one place.
export const TUNE = {
    // button price = base * ratio^tier * growth^timesBought
    cost: {
        mult: { base: 8, ratio: 8, growth: 1.08 },
        copper: { base: 2000, ratio: 10, growth: 1.12 },
        silicon: { base: 200, ratio: 10, growth: 1.12 },
        quartz: { base: 900, ratio: 10, growth: 1.12 },
        aether: { base: 3500, ratio: 10, growth: 1.12 },
        runes: { base: 30, ratio: 10, growth: 1.12 },
        starglass: { base: 40, ratio: 10, growth: 1.12 },
        voidsteel: { base: 50, ratio: 10, growth: 1.12 },
        chrono: { base: 60, ratio: 10, growth: 1.12 },
    } as Record<string, { base: number; ratio: number; growth: number }>,
    // how much one press of tier k adds (Multipliers, or producers for materials)
    gainBase: { mult: 1, copper: 1, silicon: 1, quartz: 1, aether: 1, runes: 1, starglass: 1, voidsteel: 1, chrono: 1 } as Record<string, number>,
    gainRatio: 5,
    // reboot tier k: costs rebootBase * rebootRatio^k * rebootGrowth^R Multipliers, adds rebootGainRatio^k Reboots
    rebootBase: 100,
    rebootRatio: 4.5,
    rebootGrowth: 1.12,
    rebootGainRatio: 2.6,
    rebootStrength: 0.7, // each Reboot adds this much to Multiplier button gains
    perProducer: { copper: 0.05, silicon: 0.03, quartz: 0.016, aether: 0.008, runes: 0.0025, starglass: 0.0012, voidsteel: 0.0006, chrono: 0.0003 } as Record<string, number>,
    boostK: { cuReboot: 0.09, cuBytes: 0.02, siCu: 0.2, qzSi: 0.2, aeQz: 0.2, ruAe: 0.12, sgRu: 0.12, vsSg: 0.12, chVs: 0.12, chAll: 0.03 },
    boostPow: 0.38,
    unlockAt: { copper: 1, silicon: 150, quartz: 300, aether: 500, runes: 150, starglass: 200, voidsteel: 250, chrono: 300 } as Record<string, number>, // copper: Reboots; the rest: amount of the stat below
    overclockMult: 6,
    overclockSecs: 20,
    offlineCapHours: 8,
    ascendAether: 400,
    apPerAether: 60, // AP = floor((aether / apPerAether)^apPow + (runes / apPer.runes)^apPow + ...)
    apPer: { runes: 90, starglass: 45, voidsteel: 27, chrono: 14 } as Record<string, number>,
    apPow: 0.3, // AP grows with amount^apPow; a low power stops Ascends from snowballing
    apBonus: 0.3,
    achBonus: 0.02,
    tierBonus: 0.08, // extra global bonus for each fully completed goal tier
    // Drones: one per button tier, bought with Aether. Each level presses that tier's button on every armed stat, droneRate times a second.
    drone: { max: 10, base: 25, ratio: 6, growth: 1.7, rate: 0.25, offline: 0.5, burst: 200 },
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
    { id: "auto", name: "Autoloader", blurb: "Auto-buys for you, one stat per level (Multipliers, then Copper up to Chrono).", max: 9, cost: (l) => 3 + l * 2 },
    { id: "overclock", name: "Overclock coils", blurb: "Intrusion boosts last +5 s per level.", max: 6, cost: (l) => 2 + l * 2 },
    { id: "offline", name: "Standby cells", blurb: "Offline time banks +4 hours per level.", max: 6, cost: (l) => 2 + l * 2 },
    { id: "start", name: "Cold cache", blurb: "Start each Reboot with 10 seconds of Bytes per level.", max: 10, cost: (l) => 1 + Math.floor(l / 2) },
];

// ---- prestige tree: bought with AP, kept through every Ascend. Nodes need all of their `req` nodes first.
export interface TreeFx {
    bytes?: number; // +x to Bytes per second
    global?: number; // +x to everything
    reboot?: number; // +x to Reboot power
    discount?: number; // cheaper buttons, as a fraction off (stacks multiplicatively)
    mats?: Partial<Record<MatId, number>>; // +x to one material's output
    start?: number; // extra seconds of Bytes kept on a Reboot
    offline?: number; // extra hours of offline banking
    overclock?: number; // extra seconds on an intrusion boost
    ap?: number; // +x to AP earned on Ascend
}
export interface TreeNode {
    id: string;
    branch: "signal" | "forge" | "systems";
    name: string;
    blurb: string;
    cost: number;
    req: string[];
    fx: TreeFx;
}
export const BRANCHES: { id: TreeNode["branch"]; name: string; blurb: string; color: string }[] = [
    { id: "signal", name: "Signal", blurb: "Bytes, Reboots and prices.", color: "#2fd8e8" },
    { id: "forge", name: "Forge", blurb: "Materials, from Copper to Chrono.", color: "#ffc53a" },
    { id: "systems", name: "Systems", blurb: "Time away, Overclock and AP.", color: "#6bffc9" },
];
const N = (id: string, branch: TreeNode["branch"], name: string, blurb: string, cost: number, req: string[], fx: TreeFx): TreeNode => ({ id, branch, name, blurb, cost, req, fx });
export const TREE: TreeNode[] = [
    N("sg1", "signal", "Line coding", "+20% Bytes.", 6, [], { bytes: 0.2 }),
    N("sg2", "signal", "Gain staging", "+25% Reboot power.", 10, ["sg1"], { reboot: 0.25 }),
    N("sg3", "signal", "Warm cache", "Reboots keep 30 more seconds of Bytes.", 10, ["sg1"], { start: 30 }),
    N("sg4", "signal", "Bus widening", "All buttons cost 10% less.", 20, ["sg2"], { discount: 0.1 }),
    N("sg5", "signal", "Feedback loop", "+50% Bytes.", 32, ["sg3", "sg4"], { bytes: 0.5 }),
    N("sg6", "signal", "Overdrive", "+30% to everything.", 60, ["sg5"], { global: 0.3 }),
    N("fg1", "forge", "Furnace tuning", "Copper and Silicon +25%.", 6, [], { mats: { copper: 0.25, silicon: 0.25 } }),
    N("fg2", "forge", "Clean room", "Quartz and Aether +25%.", 12, ["fg1"], { mats: { quartz: 0.25, aether: 0.25 } }),
    N("fg3", "forge", "Rune etching", "Runes +40%.", 16, ["fg2"], { mats: { runes: 0.4 } }),
    N("fg4", "forge", "Star cutting", "Starglass +40%.", 28, ["fg3"], { mats: { starglass: 0.4 } }),
    N("fg5", "forge", "Void forging", "Voidsteel +40%.", 44, ["fg4"], { mats: { voidsteel: 0.4 } }),
    N("fg6", "forge", "Time dilation", "Chrono +40%.", 68, ["fg5"], { mats: { chrono: 0.4 } }),
    N("sy1", "systems", "Standby plus", "Offline time banks +4 hours.", 6, [], { offline: 4 }),
    N("sy2", "systems", "Overclock plating", "Intrusion boosts last +10 s.", 10, ["sy1"], { overclock: 10 }),
    N("sy3", "systems", "Cache lines", "Reboots keep 20 more seconds of Bytes.", 12, ["sy1"], { start: 20 }),
    N("sy4", "systems", "Echo storage", "Offline time banks +8 hours.", 24, ["sy2"], { offline: 8 }),
    N("sy5", "systems", "Efficient mesh", "All buttons cost 10% less.", 28, ["sy3"], { discount: 0.1 }),
    N("sy6", "systems", "Singularity", "+20% AP on every Ascend.", 48, ["sy4", "sy5"], { ap: 0.2 }),
];
export const treeNode = (id: string) => TREE.find((n) => n.id === id)!;
export const hasNode = (s: State, id: string) => s.tree.includes(id);
export const nodeOpen = (s: State, n: TreeNode) => n.req.every((r) => s.tree.includes(r));
export function buyNode(s: State, id: string): boolean {
    const n = TREE.find((x) => x.id === id);
    if (!n || s.tree.includes(id) || !nodeOpen(s, n) || s.ap < n.cost) return false;
    s.ap -= n.cost;
    s.tree.push(id);
    return true;
}
/** Sum of everything the owned tree nodes give. */
export function treeFx(s: State) {
    const o = { bytes: 0, global: 0, reboot: 0, discount: 1, start: 0, offline: 0, overclock: 0, ap: 0, mats: {} as Record<string, number> };
    for (const id of s.tree) {
        const f = TREE.find((n) => n.id === id)?.fx;
        if (!f) continue;
        o.bytes += f.bytes ?? 0;
        o.global += f.global ?? 0;
        o.reboot += f.reboot ?? 0;
        o.discount *= 1 - (f.discount ?? 0);
        o.start += f.start ?? 0;
        o.offline += f.offline ?? 0;
        o.overclock += f.overclock ?? 0;
        o.ap += f.ap ?? 0;
        for (const [m, v] of Object.entries(f.mats ?? {})) o.mats[m] = (o.mats[m] ?? 0) + v;
    }
    return o;
}

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
    runes: number;
    starglass: number;
    voidsteel: number;
    chrono: number;
    prod: Record<MatId, number>;
    bought: Record<ButtonStat, number[]>;
    ap: number;
    perks: Record<PerkDef["id"], number>;
    ach: string[];
    /** when each goal or secret was done, ms epoch (for the goal log) */
    achAt: Record<string, number>;
    /** Drone levels per button tier (reset on Ascend) */
    drones: number[];
    /** fractional presses waiting to fire, per tier */
    droneAcc: number[];
    /** stats the Drones are allowed to press (kept through Ascend) */
    armed: string[];
    /** owned prestige-tree node ids (bought with AP, kept through Ascend) */
    tree: string[];
    // lifetime counters (survive Ascend)
    life: { bytes: number; taps: number; reboots: number; ascends: number; intrusions: number; secs: number; presses: number; capped: number; peakBps: number; apTotal: number };
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
        runes: 0,
        starglass: 0,
        voidsteel: 0,
        chrono: 0,
        prod: Object.fromEntries(MATS.map((m) => [m, 0])) as Record<MatId, number>,
        bought: Object.fromEntries((["mult", "reboot", ...MATS] as ButtonStat[]).map((k) => [k, Array(TIERS).fill(0)])) as Record<ButtonStat, number[]>,
        ap: 0,
        perks: { scanner: 0, auto: 0, overclock: 0, offline: 0, start: 0, power: 0 },
        ach: [],
        achAt: {},
        drones: Array(TIERS).fill(0),
        droneAcc: Array(TIERS).fill(0),
        armed: [],
        tree: [],
        life: { bytes: 0, taps: 0, reboots: 0, ascends: 0, intrusions: 0, secs: 0, presses: 0, capped: 0, peakBps: 0, apTotal: 0 },
        overclock: 0,
    };
}

const boost = (amount: number, k: number) => 1 + k * Math.pow(Math.max(0, amount), TUNE.boostPow);

export interface Derived {
    global: number;
    bytesPerSec: number;
    rebootStrength: number;
    multGainMult: number;
    rates: Record<MatId, number>;
    offlineCap: number; // seconds
    boosts: { cuReboot: number; cuBytes: number; siCu: number; qzSi: number; aeQz: number; ruAe: number; sgRu: number; vsSg: number; chVs: number; chAll: number };
}

export function derive(s: State): Derived {
    const k = TUNE.boostK;
    const boosts = {
        cuReboot: boost(s.copper, k.cuReboot),
        cuBytes: boost(s.copper, k.cuBytes),
        siCu: boost(s.silicon, k.siCu),
        qzSi: boost(s.quartz, k.qzSi),
        aeQz: boost(s.aether, k.aeQz),
        ruAe: boost(s.runes, k.ruAe),
        sgRu: boost(s.starglass, k.sgRu),
        vsSg: boost(s.voidsteel, k.vsSg),
        chVs: boost(s.chrono, k.chVs),
        chAll: boost(s.chrono, k.chAll),
    };
    const tf = treeFx(s);
    const global = (1 + s.perks.power * 0.15 + tf.global) * (1 + s.ap * TUNE.apBonus) * (1 + s.ach.length * TUNE.achBonus) * (1 + tiersDone(s) * TUNE.tierBonus) * boosts.chAll * (s.overclock > 0 ? TUNE.overclockMult : 1);
    const rebootStrength = TUNE.rebootStrength * boosts.cuReboot * (1 + tf.reboot);
    const multGainMult = 1 + rebootStrength * s.reboot;
    const bytesPerSec = s.mult * boosts.cuBytes * global * (1 + tf.bytes);
    // each material is boosted by the one after it in the chain
    const boostedBy: Record<MatId, number> = { copper: boosts.siCu, silicon: boosts.qzSi, quartz: boosts.aeQz, aether: boosts.ruAe, runes: boosts.sgRu, starglass: boosts.vsSg, voidsteel: boosts.chVs, chrono: 1 };
    const rates = {} as Record<MatId, number>;
    for (const m of MATS) rates[m] = s.prod[m] * TUNE.perProducer[m] * boostedBy[m] * (1 + (tf.mats[m] ?? 0)) * global;
    return { global, bytesPerSec, rebootStrength, multGainMult, rates, offlineCap: (TUNE.offlineCapHours + s.perks.offline * 4 + tf.offline) * 3600, boosts };
}

export const gainFor = (stat: ButtonStat, tier: number) => TUNE.gainBase[stat] * Math.pow(TUNE.gainRatio, tier);

/** What pressing one button costs and gives right now. */
export function button(s: State, stat: ButtonStat, tier: number) {
    if (stat === "reboot") {
        const cost = TUNE.rebootBase * Math.pow(TUNE.rebootRatio, tier) * Math.pow(TUNE.rebootGrowth, s.reboot) * treeFx(s).discount;
        return { cost, gain: Math.max(1, Math.round(Math.pow(TUNE.rebootGainRatio, tier))), pays: "mult" as StatId };
    }
    const c = TUNE.cost[stat];
    const cost = c.base * Math.pow(c.ratio, tier) * Math.pow(c.growth, s.bought[stat][tier]) * treeFx(s).discount;
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
    const i = MATS.indexOf(id as MatId);
    const below = MATS[i - 1];
    // after your first Ascend a stat opens at a quarter of the usual amount
    return s.prod[id as MatId] > 0 || amount(s, below) >= TUNE.unlockAt[id] || (s.life.ascends > 0 && s.life.reboots >= TUNE.unlockAt.copper && amount(s, below) >= TUNE.unlockAt[id] / 4);
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
        s.bytes = derive(s).bytesPerSec * (10 * s.perks.start + treeFx(s).start);
        return true;
    }
    (s[b.pays] as number) = amount(s, b.pays) - b.cost;
    s.life.presses += 1;
    s.bought[stat][tier] += 1;
    if (stat === "mult") s.mult += b.gain;
    else s.prod[stat] += b.gain;
    return true;
}

export const droneCost = (s: State, tier: number) => TUNE.drone.base * Math.pow(TUNE.drone.ratio, tier) * Math.pow(TUNE.drone.growth, s.drones[tier]);
export const dronesOpen = (s: State) => s.aether > 0 || s.prod.aether > 0 || s.life.ascends > 0;
export function buyDrone(s: State, tier: number): boolean {
    const c = droneCost(s, tier);
    if (!dronesOpen(s) || s.drones[tier] >= TUNE.drone.max || s.aether < c) return false;
    s.aether -= c;
    s.drones[tier] += 1;
    return true;
}
export const droneRate = (s: State, tier: number) => s.drones[tier] * TUNE.drone.rate;
export function toggleArm(s: State, stat: string) {
    s.armed = s.armed.includes(stat) ? s.armed.filter((x) => x !== stat) : [...s.armed, stat];
}
/** Let the Drones press for dt seconds. eff scales their speed (time away runs slower). Returns presses made. */
export function droneStep(s: State, dt: number, eff = 1): number {
    if (!s.armed.length) return 0;
    let made = 0;
    for (let k = 0; k < TIERS; k++) {
        if (s.drones[k] <= 0) continue;
        s.droneAcc[k] = Math.min(s.droneAcc[k] + droneRate(s, k) * dt * eff, TUNE.drone.burst);
        let n = Math.floor(s.droneAcc[k]);
        if (n < 1) continue;
        s.droneAcc[k] -= n;
        for (const st of STATS) {
            if (st.id === "bytes" || st.id === "reboot" || !s.armed.includes(st.id) || !isUnlocked(s, st.id)) continue;
            for (let i = 0; i < n; i++) {
                if (!press(s, st.id as ButtonStat, k)) break;
                made++;
            }
        }
    }
    return made;
}

export function tick(s: State, dt: number, eff = 1) {
    const d = derive(s);
    s.bytes += d.bytesPerSec * dt;
    s.life.bytes += d.bytesPerSec * dt;
    s.copper += d.rates.copper * dt;
    s.silicon += d.rates.silicon * dt;
    s.quartz += d.rates.quartz * dt;
    s.aether += d.rates.aether * dt;
    s.runes += d.rates.runes * dt;
    s.starglass += d.rates.starglass * dt;
    s.voidsteel += d.rates.voidsteel * dt;
    s.chrono += d.rates.chrono * dt;
    if (s.overclock > 0) s.overclock = Math.max(0, s.overclock - dt);
    s.life.secs += dt;
    if (d.bytesPerSec > s.life.peakBps) s.life.peakBps = d.bytesPerSec;
    droneStep(s, dt, eff);
}

/** Hit the intrusion target: a timed boost. */
export function breach(s: State) {
    s.overclock = TUNE.overclockSecs + s.perks.overclock * 5 + treeFx(s).overclock;
    s.life.intrusions += 1;
}

export const apOnAscend = (s: State) => {
    if (s.aether < TUNE.ascendAether) return 0;
    let raw = Math.pow(s.aether / TUNE.apPerAether, TUNE.apPow);
    for (const m of ["runes", "starglass", "voidsteel", "chrono"] as const) raw += Math.pow(s[m] / TUNE.apPer[m], TUNE.apPow);
    return Math.floor(raw * (1 + treeFx(s).ap));
};
export const canAscend = (s: State) => apOnAscend(s) >= 1;

export function ascend(s: State) {
    const gain = apOnAscend(s);
    if (gain < 1) return 0;
    const keep = { ap: s.ap + gain, perks: s.perks, ach: s.ach, achAt: s.achAt, tree: s.tree, armed: s.armed, life: { ...s.life, ascends: s.life.ascends + 1, apTotal: s.life.apTotal + gain }, started: s.started };
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
    const before = { bytes: s.bytes, copper: s.copper, silicon: s.silicon, quartz: s.quartz, aether: s.aether, runes: s.runes, starglass: s.starglass, voidsteel: s.voidsteel, chrono: s.chrono };
    const steps = Math.min(600, Math.max(1, Math.ceil(secs / 20)));
    const dt = secs / steps;
    const oc = s.overclock;
    s.overclock = 0; // an intrusion boost doesn't carry through time away
    const pressesBefore = s.life.presses;
    for (let i = 0; i < steps; i++) tick(s, dt, TUNE.drone.offline);
    s.overclock = Math.max(0, oc - secs);
    return { secs, capped: seconds > cap, drones: s.life.presses - pressesBefore, gain: { bytes: s.bytes - before.bytes, copper: s.copper - before.copper, silicon: s.silicon - before.silicon, quartz: s.quartz - before.quartz, aether: s.aether - before.aether, runes: s.runes - before.runes, starglass: s.starglass - before.starglass, voidsteel: s.voidsteel - before.voidsteel, chrono: s.chrono - before.chrono } };
}

// ---- goals. Five tiers of six. Each goal gives a small permanent boost (TUNE.achBonus) and a full tier gives a bigger one (TUNE.tierBonus).
export interface Goal {
    id: string;
    name: string;
    hint: string;
    tier: number; // 1..GOAL_TIERS
    icon: "bytes" | "mult" | "reboot" | "copper" | "silicon" | "quartz" | "aether" | "runes" | "starglass" | "voidsteel" | "chrono" | "alert" | "ascend" | "spark" | "lock";
    cur: (s: State) => number;
    target: number;
}
export const GOAL_TIERS = 7;
export const TIER_NAMES = ["", "Access", "Operator", "Admin", "Root", "Kernel", "Deep", "Zero"];
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
    // VI DEEP: the materials past Aether, and the prestige tree
    G("ru1", "Carved", "Gather your first Runes.", 6, "runes", 1e-9, (s) => s.runes),
    G("sg1", "Starlight", "Gather your first Starglass.", 6, "starglass", 1e-9, (s) => s.starglass),
    G("vs1", "Cold metal", "Gather your first Voidsteel.", 6, "voidsteel", 1e-9, (s) => s.voidsteel),
    G("ch1", "Borrowed time", "Gather your first Chrono.", 6, "chrono", 1e-9, (s) => s.chrono),
    G("tr1", "Branching", "Buy a node in the prestige tree.", 6, "ascend", 1, (s) => s.tree.length),
    G("ap10", "Tenfold", "Earn 10 Ascension Points in total.", 6, "ascend", 10, life("apTotal")),
    // VII ZERO
    G("b1qi", "Astronomical", "Earn 1 quintillion Bytes.", 7, "bytes", 1e18, life("bytes")),
    G("p100k", "Stuck key", "Press 100,000 buttons.", 7, "spark", 100000, life("presses")),
    G("r2k", "Reboot loop", "Reach 2,500 Reboots.", 7, "reboot", 2500, life("reboots")),
    G("ch1k", "Spare hours", "Hold 1,000 Chrono.", 7, "chrono", 1e3, (s) => s.chrono),
    G("asc20", "Habit of leaving", "Ascend 20 times.", 7, "ascend", 20, life("ascends")),
    G("tr18", "Whole tree", "Own every node in the prestige tree.", 7, "ascend", TREE.length, (s) => s.tree.length),
];

// ---- secrets. They show as ???? until found, with a clue. Console ones are unlocked by commands (components/cm/console.tsx -> lib/nodefarm/records.ts);
// the rest are checked here by `test`. Found secrets count toward the goal bonus like any goal.
export interface Secret {
    id: string;
    name: string;
    clue: string;
    /** shown once found */
    how: string;
    test?: (s: State) => boolean;
}
export const SECRETS: Secret[] = [
    { id: "x_loop", name: "Loopback", clue: "Ask the console to ping home.", how: "Ran `nf ping 127.0.0.1` in the console." },
    { id: "x_sudo", name: "Not in the sudoers file", clue: "Try to take control from the console.", how: "Ran `nf sudo` in the console." },
    { id: "x_self", name: "Self aware", clue: "Ask the node who it is.", how: "Ran `nf whoami` in the console." },
    { id: "x_night", name: "Night shift", clue: "The farm runs at all hours. So do you.", how: "Had Node Farm open between 3 and 4 in the morning.", test: () => new Date().getHours() === 3 },
    { id: "x_haul", name: "Long haul", clue: "Stay a very long time.", how: "Played for 24 hours in total.", test: (s) => s.life.secs >= 86400 },
    { id: "x_tank", name: "Full tank", clue: "Leave it alone until the standby cells are full.", how: "Came back to a full standby report.", test: (s) => s.life.capped >= 1 },
];
export const secretDone = (s: State, x: Secret) => s.ach.includes(x.id);
/** Record a goal or secret as done. False if it already was. */
export function unlock(s: State, id: string): boolean {
    if (s.ach.includes(id)) return false;
    s.ach.push(id);
    s.achAt[id] = Date.now();
    return true;
}

export const goalDone = (s: State, g: Goal) => s.ach.includes(g.id);
/** Number of fully completed tiers. */
export function tiersDone(s: State): number {
    let n = 0;
    for (let t = 1; t <= GOAL_TIERS; t++) if (GOALS.filter((g) => g.tier === t).every((g) => s.ach.includes(g.id))) n++;
    return n;
}

/** Returns goals newly completed (and records them). */
export function checkGoals(s: State): { id: string; name: string; secret?: boolean }[] {
    const out: { id: string; name: string; secret?: boolean }[] = [];
    for (const g of GOALS) if (!s.ach.includes(g.id) && g.cur(s) >= g.target && unlock(s, g.id)) out.push(g);
    for (const x of SECRETS) if (x.test && !s.ach.includes(x.id) && x.test(s) && unlock(s, x.id)) out.push({ id: x.id, name: x.name, secret: true });
    return out;
}

/** Autoloader perk: each level unlocks auto-buying for one stat. Buys at most one button per stat per call. */
export function autoBuy(s: State): number {
    const order: ButtonStat[] = ["mult", "copper", "silicon", "quartz", "aether", "runes", "starglass", "voidsteel", "chrono"];
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
        if (!Array.isArray(n.tree)) n.tree = [];
        if (!Array.isArray(n.ach)) n.ach = [];
        n.achAt = { ...(o.achAt && typeof o.achAt === "object" ? o.achAt : {}) };
        if (!Array.isArray(n.armed)) n.armed = [];
        for (const k of ["drones", "droneAcc"] as const) if (!Array.isArray(n[k]) || n[k].length !== TIERS || n[k].some((x: number) => !Number.isFinite(x))) n[k] = Array(TIERS).fill(0);
        for (const k of ["bytes", "mult", "reboot", "copper", "silicon", "quartz", "aether", "runes", "starglass", "voidsteel", "chrono", "ap"] as const) if (!Number.isFinite(n[k])) n[k] = base[k];
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
