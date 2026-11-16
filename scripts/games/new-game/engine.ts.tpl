// __NAME__ engine: the rules as plain functions over a plain object. It runs on the shared game kit (lib/game-kit),
// imported by relative path so the node tests load it (npm run test:__SLUG__). The panel in components/__SLUG__ owns
// the clock, the storage and the markup.
//
// This is the incremental starter the template ships with: tap to gather __RESOURCE__, generators that make the tier
// below them (Plants make Rigs, Rigs make Runners, Runners make __RESOURCE__), upgrades that multiply everything,
// offline progress, big numbers, and a prestige reset. The numbers are placeholders for the real design. Every
// balance change also gets a file in docs/rule-changes/.

import { costAt, prestigeGain, prestigeProgress, rates, resetKeeping, stepChain, upgradeMult, type Generator, type Upgrade } from "../game-kit/idle";
import { catchUp, gapSeconds } from "../game-kit/time";
import { numberFormatter } from "../game-kit/format";

export const SAVE_KEY = "__SLUG__-save-v1";
export const SAVE_VERSION = 1;

export const TAP_GAIN = 1;
/** Away time that counts. Anything longer earns nothing extra. */
export const OFFLINE_CAP_SECONDS = 8 * 60 * 60;
/** Most steps one catch-up may run. Keeps a long absence cheap on the page. */
const MAX_STEPS = 120;

/** A shared-kit generator with a display name. Tier i makes tier i-1; tier 0 makes __RESOURCE__. */
export type Gen = Generator & { name: string };

/** A shared-kit upgrade with a display name and a price. */
export type Up = Upgrade & { name: string; cost: number };

export const GENERATORS: readonly Gen[] = [
    { id: "runner", name: "Runner", rate: 0.5, baseCost: 10, growth: 1.15 },
    { id: "rig", name: "Rig", rate: 0.2, baseCost: 120, growth: 1.2 },
    { id: "plant", name: "Plant", rate: 0.05, baseCost: 1500, growth: 1.25 },
];

/** One-time upgrades. Each one multiplies all production. */
export const UPGRADES: readonly Up[] = [
    { id: "tools", name: "Better tools", target: "all", mult: 2, cost: 60 },
    { id: "shifts", name: "Shift pattern", target: "all", mult: 2, cost: 900 },
];

/** Lifetime __RESOURCE__ a run needs for its first prestige point. Points follow the square root of the run's total. */
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
    /** Copies owned of each generator, same order as GENERATORS. Chains can make these fractional. */
    owned: number[];
    /** Ids of the upgrades bought. */
    bought: string[];
    /** Prestige points, kept across resets. */
    points: number;
    /** Completed resets. */
    runs: number;
    /** Epoch milliseconds up to which production has been counted. */
    savedAt: number;
};

/** Whole-number display of a count: a chained tier can hold 3.7 of something, and the player sees 3. */
export const whole = (n: number) => Math.floor(n + 1e-9);

/** Short display form for amounts: 999, 1.23K, 15.0M and so on. */
export const fmt = numberFormatter("suffix");

export function fresh(now: number): State {
    return {
        amount: 0,
        earned: 0,
        tapped: 0,
        owned: GENERATORS.map(() => 0),
        bought: [],
        points: 0,
        runs: 0,
        savedAt: now,
    };
}

/** Price of the next copy of generator i. */
export function generatorCost(s: State, i: number): number {
    const g = GENERATORS[i];
    return costAt(g.baseCost, g.growth, whole(s.owned[i]));
}

/** Multiplier for every generator: prestige points, then each bought upgrade. */
export function multipliers(s: State): number[] {
    const m = (1 + PRESTIGE_BONUS * s.points) * upgradeMult(UPGRADES, s.bought, "all");
    return GENERATORS.map(() => m);
}

/** __RESOURCE__ per second from the bottom tier, which is what the stage shows. */
export function rate(s: State): number {
    return rates(GENERATORS, s.owned, multipliers(s))[0];
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
    return j >= 0 && j < UPGRADES.length && !s.bought.includes(UPGRADES[j].id) && s.amount >= UPGRADES[j].cost;
}

export function buyUpgrade(s: State, j: number): State {
    if (!canBuyUpgrade(s, j)) return s;
    return { ...s, amount: s.amount - UPGRADES[j].cost, bought: [...s.bought, UPGRADES[j].id] };
}

/** One slice of production: the chain runs for `dt` seconds. */
function step(s: State, dt: number): State {
    const owned = s.owned.slice();
    const gained = stepChain(GENERATORS, owned, multipliers(s), dt);
    return { ...s, owned, amount: s.amount + gained, earned: s.earned + gained };
}

/**
 * Counts production from savedAt up to now. A live tick plays a fraction of a second; time away is caught up in
 * fixed steps and stops at the offline cap. Time only moves forward.
 */
export function advance(s: State, now: number): State {
    const gap = gapSeconds(s.savedAt, now);
    if (gap <= 0) return s;
    let next = s;
    catchUp(gap, { capS: OFFLINE_CAP_SECONDS, stepCap: MAX_STEPS, minS: 0 }, (dt) => {
        next = step(next, dt);
    });
    return { ...next, savedAt: now };
}

/** Points a reset would earn now. Zero until the run has gathered PRESTIGE_UNIT. */
export function prestigeGainNow(s: State): number {
    return prestigeGain(s.earned, PRESTIGE_UNIT);
}

/** 0 to 1: how far the run is toward its next prestige point. */
export function prestigeMeter(s: State): number {
    return prestigeProgress(s.earned, PRESTIGE_UNIT);
}

/** Resets the run for points. Keeps points, resets and lifetime taps. Does nothing when there is no gain. */
export function prestige(s: State, now: number): State {
    const gain = prestigeGainNow(s);
    if (gain < 1) return s;
    const next = resetKeeping(s, () => fresh(now), ["tapped", "points", "runs"]);
    return { ...next, points: s.points + gain, runs: s.runs + 1 };
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
        owned.push(n);
    }

    if (!Array.isArray(o.bought)) return null;
    const known = new Set(UPGRADES.map((u) => u.id));
    const bought: string[] = [];
    for (const v of o.bought) {
        if (typeof v !== "string" || !known.has(v)) return null;
        bought.push(v);
    }

    return { amount, earned, tapped: Math.floor(tapped), owned, bought, points: Math.floor(points), runs: Math.floor(runs), savedAt };
}
