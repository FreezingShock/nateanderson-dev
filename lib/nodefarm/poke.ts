// Touch layer rules: helpers for the figure tips, links and the zone quick menu (components/nodefarm/windows/poke.tsx).
// Caches and the core vent were cut on 2026-11-12 (systems audit: tap-for-a-lump overlapped the Dead drop). Saves that still
// carry `poke` just ignore it.
import { MATS, STATS, derive, overclockMult, type MatId, type State, type StatId } from "./engine";

/** What a stat's zone produces per second at the plain rate (no Overclock). Multipliers and Reboots have no stock that
 *  flows, so they read as Bytes. */
export function zoneRate(s: State, zone: StatId): { stat: StatId; rate: number } {
    const d = derive(s);
    const oc = s.overclock > 0 ? overclockMult(s) : 1;
    if ((MATS as readonly string[]).includes(zone)) return { stat: zone, rate: d.rates[zone as MatId] / oc };
    return { stat: "bytes", rate: d.bytesPerSec / oc };
}

/** The stat a zone feeds (the one below it in the chain) and the one that feeds it (above). */
export function neighbours(zone: StatId): { feeds?: StatId; fedBy?: StatId } {
    const i = STATS.findIndex((x) => x.id === zone);
    return { feeds: i > 0 ? STATS[i - 1].id : undefined, fedBy: i >= 0 && i < STATS.length - 1 ? STATS[i + 1].id : undefined };
}
