// Touch layer rules: things on the board that are worth tapping. Nothing here needs speed or repeated presses.
// - Caches: every few minutes of online play a cache drops into one open zone's art and waits there, never expiring
//   (at most POKE_TUNE.cacheMax wait at once; while that many wait, no more drop, so an idle player loses nothing that was
//   already there). Tapping one pays a lump of that zone's own output.
// - Core vent: the reactor core charges over POKE_TUNE.ventCharge seconds of online play and then waits. Tapping it when
//   full pays a lump of every output. Tapping it early only shows the readout.
// Rewards are lumps at the plain rate (never at Overclock rate), like the Dead drop. State is `s.poke` (PokeState in
// engine.ts), repaired by `poke(s)`. Registers itself in TICK_HOOKS when imported. Time away (ticks over 5 s) does not
// charge or drop anything.
import { MATS, STATS, TICK_HOOKS, derive, isUnlocked, overclockMult, statDef, fmt, type MatId, type PokeState, type State, type StatId } from "./engine";

export const POKE_TUNE = {
    /** online seconds before the first cache of a save */
    first: 180,
    /** online seconds between caches, [min, max] */
    gap: [360, 600] as [number, number],
    /** caches that may wait at once */
    cacheMax: 3,
    /** a cache pays this many seconds of its zone's plain output */
    cacheSecs: 60,
    /** the vent fills over this many online seconds */
    ventCharge: 600,
    /** a full vent pays this many seconds of every output */
    ventSecs: 45,
};

const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const STAT_IDS = new Set<string>(STATS.map((x) => x.id));

/** The touch state, created or repaired in place (old saves have none; a hand-edited save may have junk). */
export function poke(s: State): PokeState {
    const o = s.poke as Partial<PokeState> | undefined;
    if (o && Array.isArray(o.c) && typeof o.next === "number") return o as PokeState;
    const c = Array.isArray(o?.c) ? o!.c.filter((x) => x && STAT_IDS.has(x.z) && Number.isFinite(x.id)).map((x) => ({ id: x.id, z: x.z, x: Math.min(1, Math.max(0, num(x.x, 0.5))) })) : [];
    s.poke = { c, next: num(o?.next, POKE_TUNE.first), vent: Math.min(POKE_TUNE.ventCharge, num(o?.vent)), got: num(o?.got), vents: num(o?.vents), n: num(o?.n, c.length) };
    return s.poke;
}

const openZones = (s: State) => STATS.filter((x) => isUnlocked(s, x.id)).map((x) => x.id);

/** Drop a cache into a random open zone that has none waiting (the admin panel and tests call this too). */
export function dropCache(s: State, rnd: () => number = Math.random, zone?: StatId): boolean {
    const p = poke(s);
    if (p.c.length >= POKE_TUNE.cacheMax && !zone) return false;
    const taken = new Set(p.c.map((x) => x.z));
    const pool = openZones(s).filter((z) => !taken.has(z));
    const z = zone ?? pool[Math.floor(rnd() * pool.length) % Math.max(1, pool.length)];
    if (!z) return false;
    p.n += 1;
    p.c.push({ id: p.n, z, x: 0.18 + rnd() * 0.6 });
    return true;
}

/** One tick: charge the vent and count down to the next cache, online only. Caches in zones that closed again (Ascend,
 *  Handover) move to the Uplink rack, so nothing that dropped is ever lost. */
export function pokeStep(s: State, dt: number, rnd: () => number = Math.random) {
    const p = poke(s);
    for (const c of p.c) if (!isUnlocked(s, c.z)) c.z = "bytes";
    if (dt <= 0 || dt > 5) return;
    p.vent = Math.min(POKE_TUNE.ventCharge, p.vent + dt);
    if (p.c.length >= POKE_TUNE.cacheMax) return;
    p.next -= dt;
    if (p.next > 0) return;
    const [lo, hi] = POKE_TUNE.gap;
    p.next = lo + rnd() * (hi - lo);
    dropCache(s, rnd);
}
TICK_HOOKS.push((s, dt) => pokeStep(s, dt));

/** What a stat's zone produces per second at the plain rate (no Overclock). Multipliers and Reboots have no stock that
 *  flows, so their caches pay Bytes. */
export function zoneRate(s: State, zone: StatId): { stat: StatId; rate: number } {
    const d = derive(s);
    const oc = s.overclock > 0 ? overclockMult(s) : 1;
    if ((MATS as readonly string[]).includes(zone)) return { stat: zone, rate: d.rates[zone as MatId] / oc };
    return { stat: "bytes", rate: d.bytesPerSec / oc };
}

/** What a cache would pay right now. */
export function cachePay(s: State, zone: StatId): { stat: StatId; amount: number } {
    const r = zoneRate(s, zone);
    return { stat: r.stat, amount: r.rate * POKE_TUNE.cacheSecs };
}

/** Open a waiting cache. Returns what it paid, or null if there is no such cache. */
export function openCache(s: State, id: number): { zone: StatId; stat: StatId; amount: number } | null {
    const p = poke(s);
    const c = p.c.find((x) => x.id === id);
    if (!c) return null;
    const pay = cachePay(s, c.z);
    if (pay.stat === "bytes") { s.bytes += pay.amount; s.life.bytes += pay.amount; } else s[pay.stat as MatId] += pay.amount;
    p.c = p.c.filter((x) => x !== c);
    p.got += 1;
    return { zone: c.z, ...pay };
}

export const ventFrac = (s: State) => Math.min(1, poke(s).vent / POKE_TUNE.ventCharge);
export const ventReady = (s: State) => poke(s).vent >= POKE_TUNE.ventCharge;

/** What a full vent pays right now: seconds of Bytes and every open material, at the plain rate. */
export function ventPay(s: State): Partial<Record<StatId, number>> {
    const d = derive(s);
    const oc = s.overclock > 0 ? overclockMult(s) : 1;
    const out: Partial<Record<StatId, number>> = { bytes: (d.bytesPerSec / oc) * POKE_TUNE.ventSecs };
    for (const m of MATS) { const v = (d.rates[m] / oc) * POKE_TUNE.ventSecs; if (v > 0) out[m] = v; }
    return out;
}

/** Vent the core if it is full. Returns what it paid, or null. */
export function vent(s: State): Partial<Record<StatId, number>> | null {
    const p = poke(s);
    if (p.vent < POKE_TUNE.ventCharge) return null;
    const got = ventPay(s);
    for (const [k, v] of Object.entries(got) as [StatId, number][]) {
        if (k === "bytes") { s.bytes += v; s.life.bytes += v; } else s[k as MatId] += v;
    }
    p.vent = 0;
    p.vents += 1;
    return got;
}

/** A one-line summary of a lump for the feed and the pop: the two biggest parts by share of their own stock. */
export function lumpText(got: Partial<Record<StatId, number>>): string {
    const parts = (Object.entries(got) as [StatId, number][]).filter(([, v]) => v > 0);
    const main = parts.slice(-1).concat(parts.slice(0, 1)).filter((x, i, a) => a.indexOf(x) === i);
    const more = parts.length - main.length;
    return main.map(([k, v]) => `+${fmt(v)} ${statDef(k).short}`).join(" · ") + (more > 0 ? ` · +${more} more` : "");
}

/** The stat a zone feeds (the one below it in the chain) and the one that feeds it (above). */
export function neighbours(zone: StatId): { feeds?: StatId; fedBy?: StatId } {
    const i = STATS.findIndex((x) => x.id === zone);
    return { feeds: i > 0 ? STATS[i - 1].id : undefined, fedBy: i >= 0 && i < STATS.length - 1 ? STATS[i + 1].id : undefined };
}
