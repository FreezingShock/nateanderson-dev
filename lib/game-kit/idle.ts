// Game kit: the math of an idle game. Generators with growing costs, upgrades and milestone multipliers, production
// chains, and prestige. Pure and DOM-free, numbers only, so a new game's engine stays testable under node.
//
// The usual loop: each generator tier makes the resource (or the tier below it) at `count * base * multipliers` per
// second; buying one raises the next cost by `growth`; milestones at owned counts double output; prestige converts
// lifetime earnings into a permanent currency and resets the run.

// ---- costs -------------------------------------------------------------------------------------------------------

/** Cost of the next one after owning `owned`: base * growth^owned. */
export const costAt = (base: number, growth: number, owned: number) => base * Math.pow(growth, owned);

/** Total cost of buying `n` more after owning `owned` (geometric sum). */
export function costOfMany(base: number, growth: number, owned: number, n: number): number {
    if (n <= 0) return 0;
    if (growth === 1) return base * n;
    return (base * Math.pow(growth, owned) * (Math.pow(growth, n) - 1)) / (growth - 1);
}

/** How many can be bought with `money` after owning `owned`. */
export function affordable(base: number, growth: number, owned: number, money: number): number {
    if (money <= 0 || base <= 0) return 0;
    if (growth === 1) return Math.floor(money / base);
    const first = costAt(base, growth, owned);
    if (money < first) return 0;
    const n = Math.floor(Math.log((money * (growth - 1)) / first + 1) / Math.log(growth));
    // floating point can land one over at huge counts
    return costOfMany(base, growth, owned, n) > money ? Math.max(0, n - 1) : n;
}

/** Seconds until `need` is reached at `rate` per second from `have` (0 when already there, Infinity when not growing). */
export function timeTo(need: number, have: number, rate: number): number {
    if (have >= need) return 0;
    return rate > 0 ? (need - have) / rate : Infinity;
}

// ---- multipliers ---------------------------------------------------------------------------------------------------

/**
 * Milestone multiplier: x`factor` for each threshold in `at` that `owned` has reached. With `every`, also x`factor` for
 * each further step of that size past the last threshold. Example: milestoneMult(230, [10, 25, 50, 100], 2, 100) = 2^5 (four thresholds, one step of 100 past the last).
 */
export function milestoneMult(owned: number, at: readonly number[], factor = 2, every = 0): number {
    let k = at.filter((t) => owned >= t).length;
    const last = at[at.length - 1] ?? 0;
    if (every > 0 && owned >= last + every) k += Math.floor((owned - last) / every);
    return Math.pow(factor, k);
}

/** The next milestone above `owned`, or null. Uses the same rule as milestoneMult. */
export function nextMilestone(owned: number, at: readonly number[], every = 0): number | null {
    const t = at.find((x) => x > owned);
    if (t !== undefined) return t;
    if (every <= 0) return null;
    const last = at[at.length - 1] ?? 0;
    return last + (Math.floor((owned - last) / every) + 1) * every;
}

export type Upgrade<Id extends string = string> = {
    id: Id;
    /** What it multiplies: a generator id, a resource id, or "all". */
    target: string;
    mult: number;
};

/** Product of the bought upgrades' multipliers for `target` (and those aimed at "all"). */
export function upgradeMult<Id extends string>(upgrades: readonly Upgrade<Id>[], owned: ReadonlySet<Id> | readonly Id[], target: string): number {
    const has = (id: Id) => (Array.isArray(owned) ? (owned as readonly Id[]).includes(id) : (owned as ReadonlySet<Id>).has(id));
    return upgrades.reduce((m, u) => (has(u.id) && (u.target === target || u.target === "all") ? m * u.mult : m), 1);
}

// ---- generators --------------------------------------------------------------------------------------------------

export type Generator = {
    id: string;
    /** Units made per second by one owned, before multipliers. */
    rate: number;
    baseCost: number;
    growth: number;
};

/**
 * One step of a generator chain: tier i makes tier i-1 (tier 0 makes the main resource). `counts` are owned amounts
 * (they may grow, which is what makes a chain explode), `mults` the final multiplier per tier. Returns how much the
 * main resource gained. Mutates `counts` for tiers 0..n-2.
 */
export function stepChain(gens: readonly Generator[], counts: number[], mults: readonly number[], dt: number): number {
    let gained = 0;
    for (let i = 0; i < gens.length; i++) {
        const made = counts[i] * gens[i].rate * (mults[i] ?? 1) * dt;
        if (i === 0) gained += made;
        else counts[i - 1] += made;
    }
    return gained;
}

/** Per-second output of each generator tier with its multiplier. */
export const rates = (gens: readonly Generator[], counts: readonly number[], mults: readonly number[]) => gens.map((g, i) => counts[i] * g.rate * (mults[i] ?? 1));

// ---- prestige ----------------------------------------------------------------------------------------------------

/**
 * Prestige currency for lifetime earnings `earned`: floor((earned / scale)^power), the usual square-root curve at
 * power 0.5. Minus what was already claimed this run (`claimed`), never below 0.
 */
export function prestigeGain(earned: number, scale: number, power = 0.5, claimed = 0): number {
    if (!(earned > 0) || !(scale > 0)) return 0;
    return Math.max(0, Math.floor(Math.pow(earned / scale, power)) - claimed);
}

/** Lifetime earnings needed to reach `total` prestige currency (the inverse of prestigeGain). */
export const prestigeNeed = (total: number, scale: number, power = 0.5) => scale * Math.pow(Math.max(0, total), 1 / power);

/** Progress (0 to 1) toward the next prestige point. */
export function prestigeProgress(earned: number, scale: number, power = 0.5): number {
    const have = Math.floor(Math.pow(Math.max(0, earned) / scale, power));
    const a = prestigeNeed(have, scale, power), b = prestigeNeed(have + 1, scale, power);
    return b > a ? Math.min(1, Math.max(0, (earned - a) / (b - a))) : 0;
}

/**
 * A prestige reset: a fresh run from `fresh()` that keeps the listed fields of `state`. Keeps lifetime stats,
 * unlocks and the prestige currency without the engine hand-copying each one.
 */
export function resetKeeping<S extends object, K extends keyof S>(state: S, fresh: () => S, keep: readonly K[]): S {
    const next = fresh();
    for (const k of keep) next[k] = state[k];
    return next;
}
