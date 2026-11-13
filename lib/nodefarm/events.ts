// Quick-time events: short, optional naOS moments that pop up in the middle of the screen now and then.
// None of them test reflexes, memory or guessing. Every one you engage pays out: the timed Overclock (so the Anomaly tree
// nodes keep working) plus a loot roll whose rarity climbs with how much of the event you did.
// Pure data, numbers and payout maths here; the UI lives in components/nodefarm/events.tsx.

import { MATS, addLifeBytes, derive, fmt, isUnlocked, statDef, type MatId, type State, type StatId } from "./engine";

export type EventKind = "spike" | "rogue" | "vault" | "relay" | "packet";

export interface EventDef {
    kind: EventKind;
    code: string;
    title: string;
    /** one plain line shown before you engage */
    brief: string;
    /** the hint shown during the event, for both touch and keyboard */
    hint: string;
    /** hard limit once engaged, in seconds; when it runs out you are paid for what you did */
    secs: number;
    /** unlocks once Multipliers + Reboots reach this, so the first minutes stay quiet */
    from: number;
    /** accent colour */
    color: string;
}

export const EVENTS: EventDef[] = [
    { kind: "spike", code: "NET // TRAFFIC SPIKE", title: "Traffic spike", brief: "A wave of traffic is passing through. Press buy buttons on the board while it lasts; every press grows the payout.", hint: "Press any buy button on the board.", secs: 30, from: 5, color: "#2fd8e8" },
    { kind: "rogue", code: "PROC // ROGUE PROCESS", title: "Rogue process", brief: "Something unknown is squatting on node-01. Choose what to do with it. Every outcome is shown.", hint: "Pick one, or press 1 to 3.", secs: 20, from: 5, color: "#b46bff" },
    { kind: "vault", code: "VAULT // COLD STORAGE", title: "Cold storage", brief: "An old vault answered the ping. Hold to decrypt it row by row and keep every row you open.", hint: "Hold the button or hold Space. Cash out any time.", secs: 14, from: 5, color: "#5be37d" },
    { kind: "relay", code: "GRID // RELAY CASCADE", title: "Relay cascade", brief: "Five relays are charging one after another. Press each one once it is full. Full relays wait for you.", hint: "Press the full relay, or press Space.", secs: 20, from: 8, color: "#ffb02e" },
    { kind: "packet", code: "DROP // DEAD PACKET", title: "Dead packet", brief: "A lost packet fell onto the node. Crack it open and see what is inside.", hint: "Press Crack three times, or press Space.", secs: 15, from: 5, color: "#ff4fa3" },
];
export const eventDef = (k: EventKind) => EVENTS.find((e) => e.kind === k)!;

export const EVENT_TUNE = {
    /** gap between events in seconds, [min, max], before the Wide-band scanner perk shortens it */
    every: [180, 300] as [number, number],
    /** how long the incoming card waits for you before it gives up, in seconds */
    waitSecs: 15,
    /** controls stay locked this long after anything appears so a stray tap can't trigger one */
    armMs: 650,
    /** how long the result card stays up */
    resultMs: 3200,
    /** an event counts as a win (Overclock + tree nodes) from this much done */
    winAt: 0.25,
    /** Traffic spike: presses for a full payout */
    spikePresses: 15,
    /** Cold storage: rows, and holding time per row in ms */
    vaultRows: 6,
    vaultRowMs: 750,
    /** Relay cascade: relays, charge time each, and the window after full that keeps the chain going */
    relays: 5,
    relayChargeMs: 1100,
    relayChainMs: 900,
    /** Dead packet: presses to crack */
    packetHits: 3,
};

/** `haste` is the fraction taken off the gap (engine `eventHaste`: Wide-band scanner perk and the Static node). */
export const nextGapMs = (haste: number, rnd = Math.random()) =>
    (EVENT_TUNE.every[0] + rnd * (EVENT_TUNE.every[1] - EVENT_TUNE.every[0])) * 1000 * (1 - haste);

/** Pick a kind that is unlocked and not the one just shown (unless it is the only one). */
export function pickEvent(progress: number, last: EventKind | null, rnd = Math.random()): EventDef | null {
    const open = EVENTS.filter((e) => progress >= e.from);
    if (!open.length) return null;
    const pool = open.length > 1 ? open.filter((e) => e.kind !== last) : open;
    return pool[Math.floor(rnd * pool.length) % pool.length];
}

// ---- loot

/** The board's six rarity colours (button tiers), reused for loot. */
export const RARITY = [
    { name: "Common", color: "#9aa7ad" },
    { name: "Uncommon", color: "#5be37d" },
    { name: "Rare", color: "#4aa8ff" },
    { name: "Epic", color: "#b46bff" },
    { name: "Legendary", color: "#ffb02e" },
    { name: "Mythic", color: "#ff4fa3" },
] as const;

/** Base odds per rarity (sum 1). Quality (0 to 1, how much of the event you did) shifts the roll up. */
const ODDS = [0.44, 0.28, 0.15, 0.08, 0.04, 0.01];
/** Seconds of production a loot lump is worth at each rarity. Tuned so engaging every event adds roughly what the old
 *  Overclock-only win did again (about +40% at the default 3 to 5 minute gap), not a new layer of income. */
const CACHE_SECS = [20, 45, 90, 180, 360, 720];
/** Extra Overclock seconds per rarity (Exploit and overtime loot). */
const OVERTIME_SECS = [5, 8, 12, 18, 25, 35];

/** Roll a rarity. A full clear moves the roll up by about one step on average. */
export function rollRarity(quality: number, rnd = Math.random): number {
    const q = Math.max(0, Math.min(1, quality));
    let r = rnd();
    r = Math.pow(r, 1 + q * 0.5); // quality pushes r toward 0, and small r reads as rare (the loop starts at Mythic)
    let acc = 0;
    for (let i = ODDS.length - 1; i >= 0; i--) {
        acc += ODDS[i];
        if (r < acc) return i;
    }
    return 0;
}

export type LootKind = "burst" | "cache" | "overtime";
export interface Loot {
    kind: LootKind;
    rarity: number;
    /** what it pays in, for the icon */
    stat: StatId | "spark";
    /** the headline, e.g. "+4.2K Bytes" */
    label: string;
    /** the small line under it, e.g. "45 s of output" */
    note: string;
    /** seconds of production (burst, cache) or extra Overclock seconds (overtime) */
    secs: number;
    mat?: MatId;
}

/** The newest material the player is producing, if any. */
export function newestMat(s: State): MatId | null {
    let best: MatId | null = null;
    for (const m of MATS) if (isUnlocked(s, m) && s.prod[m] > 0) best = m;
    return best;
}

const fmtSecs = (sec: number) => (sec >= 3600 ? `${Math.round(sec / 360) / 10} h` : sec >= 120 ? `${Math.round(sec / 60)} min` : `${Math.round(sec)} s`);

/** Describe a loot of a given kind and rarity for this save (nothing is paid yet). */
export function makeLoot(s: State, kind: LootKind, rarity: number): Loot {
    const secs = CACHE_SECS[rarity];
    const r = plainRates(s);
    if (kind === "cache") {
        const mat = newestMat(s);
        if (mat) return { kind, rarity, stat: mat, mat, secs: secs * 1.5, label: `+${fmt(r.rates[mat] * secs * 1.5)} ${statDef(mat).name}`, note: `${fmtSecs(secs * 1.5)} of ${statDef(mat).name} output` };
        kind = "burst";
    }
    if (kind === "overtime") {
        const extra = OVERTIME_SECS[rarity];
        return { kind, rarity, stat: "spark", secs: extra, label: `Overclock +${extra} s`, note: "on top of the win" };
    }
    return { kind: "burst", rarity, stat: "bytes", secs, label: `+${fmt(r.bytesPerSec * secs)} Bytes`, note: `${fmtSecs(secs)} of output` };
}

/** The loot a won event pays, rolled from how well it went. */
export function rollLoot(s: State, quality: number, rnd = Math.random): Loot {
    const rarity = rollRarity(quality, rnd);
    const k = rnd();
    const kind: LootKind = k < 0.5 ? "burst" : k < 0.8 ? "cache" : "overtime";
    return makeLoot(s, kind, rarity);
}

/** Pay a loot into the save. Returns the amount paid (0 for overtime). */
export function payLoot(s: State, loot: Loot): number {
    if (loot.kind === "overtime") {
        s.overclock += loot.secs;
        return 0;
    }
    const d = plainRates(s);
    if (loot.kind === "cache" && loot.mat) {
        const v = d.rates[loot.mat] * loot.secs;
        s[loot.mat] += v;
        return v;
    }
    const v = d.bytesPerSec * loot.secs;
    s.bytes += v;
    addLifeBytes(s, v);
    return v;
}

/** Rates without the Overclock, so a lump is never paid (or promised) at Overclock rate. */
const plainRates = (s: State) => derive({ ...s, overclock: 0 });

/** Rogue process: the choices (three once a material is running, two before), all at one rolled rarity so the pick is about kind, not luck. */
export function rogueChoices(s: State, rnd = Math.random): Loot[] {
    const rarity = rollRarity(0.5, rnd);
    const out = [makeLoot(s, "burst", rarity), makeLoot(s, "overtime", rarity)];
    if (newestMat(s)) out.push(makeLoot(s, "cache", rarity));
    return out;
}
