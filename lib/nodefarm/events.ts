// Loot for zone events. Rogue process (pick one of three offers) and Cold storage (hold to decrypt rows) are zone events now
// (lib/nodefarm/zoneevents.ts); the quick-time scheduler and the Relay, Packet and Traffic spike events are gone.
// Pure data, numbers and payout maths here; the card lives in components/nodefarm/zone-event.tsx.

import { MATS, derive, fmt, isUnlocked, statDef, type MatId, type State, type StatId } from "./engine";

export const EVENT_TUNE = {
    /** an event counts as a win (Overclock + tree nodes) from this much done */
    winAt: 0.25,
    /** Cold storage: rows, and holding time per row in ms */
    vaultRows: 6,
    vaultRowMs: 750,
};

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
    s.life.bytes += v;
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
