// __NAME__ engine: the rules as plain functions over a plain object. No DOM and no React, so the node tests run it
// directly (npm run test:__SLUG__). The panel in components/__SLUG__ owns the clock and the storage.
//
// This is the incremental starter the template ships with: tap to gather __RESOURCE__, buy generators that gather on
// their own, buy one-time upgrades that multiply everything, collect offline progress, and reset for prestige points.
// The numbers are placeholders for the real design. Every balance change also gets a file in docs/rule-changes/.

export const SAVE_KEY = "__SLUG__-save-v1";
export const SAVE_VERSION = 1;

export const TAP_GAIN = 1;
/** Away time that counts. Anything longer earns nothing extra. */
export const OFFLINE_CAP_SECONDS = 8 * 60 * 60;

export type Generator = {
    name: string;
    /** Price of the first copy. Each copy after costs `growth` times the one before. */
    baseCost: number;
    growth: number;
    /** __RESOURCE__ per second from one copy, before multipliers. */
    baseRate: number;
};

export type Upgrade = {
    name: string;
    cost: number;
    /** Multiplies all production, once. */
    multiplier: number;
};

/** Generators in unlock order: each one is bought with __RESOURCE__ like everything else. */
export const GENERATORS: readonly Generator[] = [
    { name: "Runner", baseCost: 10, growth: 1.15, baseRate: 0.5 },
    { name: "Rig", baseCost: 120, growth: 1.2, baseRate: 4 },
    { name: "Plant", baseCost: 1500, growth: 1.25, baseRate: 30 },
];

export const UPGRADES: readonly Upgrade[] = [
    { name: "Better tools", cost: 60, multiplier: 2 },
    { name: "Shift pattern", cost: 900, multiplier: 2 },
];

/** A run earns prestige points for the square root of what it gathered, once it passes PRESTIGE_UNIT. */
export const PRESTIGE_UNIT = 10_000;
/** Each prestige point adds this much to all production, for good. */
export const PRESTIGE_BONUS = 0.1;

export type State = {
    /** __RESOURCE__ on hand. Spent by buying. */
    amount: number;
    /** __RESOURCE__ gathered this run. Drives prestige. */
    earned: number;
    /** Lifetime taps. */
    tapped: number;
    /** Copies owned of each generator, same order as GENERATORS. */
    owned: number[];
    /** Whether each upgrade is bought, same order as UPGRADES. */
    bought: boolean[];
    /** Prestige points, kept across resets. */
    points: number;
    /** Completed resets. */
    runs: number;
    /** Epoch milliseconds up to which production has been counted. */
    savedAt: number;
};

export function fresh(now: number): State {
    return {
        amount: 0,
        earned: 0,
        tapped: 0,
        owned: GENERATORS.map(() => 0),
        bought: UPGRADES.map(() => false),
        points: 0,
        runs: 0,
        savedAt: now,
    };
}

export function generatorCost(s: State, i: number): number {
    const g = GENERATORS[i];
    return Math.ceil(g.baseCost * g.growth ** s.owned[i]);
}

/** All production multipliers together: prestige points, then every bought upgrade. */
export function multiplier(s: State): number {
    let m = 1 + PRESTIGE_BONUS * s.points;
    UPGRADES.forEach((u, i) => {
        if (s.bought[i]) m *= u.multiplier;
    });
    return m;
}

/** Production per second across every generator. */
export function rate(s: State): number {
    let base = 0;
    GENERATORS.forEach((g, i) => {
        base += s.owned[i] * g.baseRate;
    });
    return base * multiplier(s);
}

export function tap(s: State): State {
    return { ...s, amount: s.amount + TAP_GAIN, earned: s.earned + TAP_GAIN, tapped: s.tapped + 1 };
}

export function buyGenerator(s: State, i: number): State {
    if (i < 0 || i >= GENERATORS.length) return s;
    const cost = generatorCost(s, i);
    if (s.amount < cost) return s;
    const owned = s.owned.slice();
    owned[i] += 1;
    return { ...s, amount: s.amount - cost, owned };
}

export function canBuyUpgrade(s: State, j: number): boolean {
    return j >= 0 && j < UPGRADES.length && !s.bought[j] && s.amount >= UPGRADES[j].cost;
}

export function buyUpgrade(s: State, j: number): State {
    if (!canBuyUpgrade(s, j)) return s;
    const bought = s.bought.slice();
    bought[j] = true;
    return { ...s, amount: s.amount - UPGRADES[j].cost, bought };
}

/** Counts production from savedAt up to now. Time only moves forward, and a long gap stops at the offline cap. */
export function advance(s: State, now: number): State {
    if (now <= s.savedAt) return s;
    const seconds = Math.min((now - s.savedAt) / 1000, OFFLINE_CAP_SECONDS);
    const gained = rate(s) * seconds;
    return { ...s, amount: s.amount + gained, earned: s.earned + gained, savedAt: now };
}

/** Points a reset would earn now. Zero until the run has gathered PRESTIGE_UNIT. */
export function prestigeGain(s: State): number {
    if (s.earned < PRESTIGE_UNIT) return 0;
    return Math.floor(Math.sqrt(s.earned / PRESTIGE_UNIT));
}

/** Resets the run for points. Keeps points, runs and lifetime taps. Does nothing when there is no gain. */
export function prestige(s: State, now: number): State {
    const gain = prestigeGain(s);
    if (gain < 1) return s;
    return { ...fresh(now), tapped: s.tapped, points: s.points + gain, runs: s.runs + 1 };
}

export function serialize(s: State): string {
    return JSON.stringify(s);
}

/** Rebuilds a state from a stored object. Anything it cannot rebuild gives null, so the caller can keep the old save. */
export function parse(data: unknown): State | null {
    if (!data || typeof data !== "object") return null;
    const o = data as Record<string, unknown>;
    const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
    const amount = num(o.amount);
    const earned = num(o.earned);
    const tapped = num(o.tapped);
    const points = num(o.points);
    const runs = num(o.runs);
    const savedAt = num(o.savedAt);
    if (amount === null || earned === null || tapped === null || points === null || runs === null || savedAt === null) return null;

    if (!Array.isArray(o.owned) || o.owned.length !== GENERATORS.length) return null;
    const owned: number[] = [];
    for (const v of o.owned) {
        const n = num(v);
        if (n === null) return null;
        owned.push(Math.floor(n));
    }

    if (!Array.isArray(o.bought) || o.bought.length !== UPGRADES.length) return null;
    const bought: boolean[] = [];
    for (const v of o.bought) {
        if (typeof v !== "boolean") return null;
        bought.push(v);
    }

    return { amount, earned, tapped: Math.floor(tapped), owned, bought, points: Math.floor(points), runs: Math.floor(runs), savedAt };
}

const UNITS = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

/** Short display form: 999 stays whole, then 1.50K, 42.0M and so on. Rounding never shows 1000 of a unit. */
export function formatAmount(n: number): string {
    if (!Number.isFinite(n) || n <= 0) return "0";
    if (n < 1000) return String(Math.floor(n));
    let v = n;
    let u = 0;
    while (v >= 999.5 && u < UNITS.length - 1) {
        v /= 1000;
        u += 1;
    }
    const text = v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0);
    return `${text}${UNITS[u]}`;
}
