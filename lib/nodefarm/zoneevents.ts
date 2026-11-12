// Zone events: now and then one zone you have unlocked gets a short event that changes it for a few minutes. Nothing here asks
// for reflexes. You notice it and either enjoy it or answer one plain question (Mine the vein now or let it run, Patch the fault
// or wait it out). Nothing ever takes stock from you, and time away just lets an event run out. Pure rules, no React: the numbers
// live in ZE_TUNE (engine.ts, because the engine reads them), the strip on the zone panel is components/nodefarm/zone-event.tsx.
import {
    STATS, TICK_HOOKS, ZE_TUNE, derive, droneEventPace, isUnlocked, overclockMult, resonancePair, statDef, zeOut,
    type State, type StatId, type ZoneEvActive, type ZoneEvKind, type ZoneEvState, MATS, type MatId,
} from "./engine";
import { LORE } from "./lore";

export interface ZoneEvDef {
    kind: ZoneEvKind;
    /** the short tag in the readout, e.g. "SURGE" */
    code: string;
    title: string;
    color: string;
    /** the icon used for the banner */
    good: boolean;
}
export const ZONE_EVENTS: ZoneEvDef[] = [
    { kind: "surge", code: "SURGE", title: "Power surge", color: "#2fd8e8", good: true },
    { kind: "clearance", code: "CLEARANCE", title: "Clearance", color: "#b6f04a", good: true },
    { kind: "resonance", code: "RESONANCE", title: "Resonance", color: "#b46bff", good: true },
    { kind: "vein", code: "RICH VEIN", title: "Rich vein", color: "#ffc53a", good: true },
    { kind: "fault", code: "FAULT", title: "Fault", color: "#ff5a4a", good: false },
];
export const zoneEvDef = (k: ZoneEvKind) => ZONE_EVENTS.find((e) => e.kind === k)!;

const ZONE_NO = (id: StatId) => STATS.findIndex((x) => x.id === id) + 1;
/** "05 Fab Cleanroom" */
export const zoneName = (id: StatId) => LORE[id].zone;
export const zoneLabel = (id: StatId) => `${String(ZONE_NO(id)).padStart(2, "0")} ${zoneName(id)}`;

export const freshZe = (): ZoneEvState => ({ act: [], wait: ZE_TUNE.first, seen: 0, kinds: {} });
export const ensureZe = (s: State): ZoneEvState => (s.ze ??= freshZe());

const hasButtons = (id: StatId) => id !== "bytes";
const hasStock = (id: StatId) => id === "bytes" || (MATS as readonly string[]).includes(id);
/** Which kinds suit a zone: Bytes has no buttons to discount, Multipliers and Reboots have no stock to mine. */
export function kindsFor(s: State, zone: StatId): ZoneEvKind[] {
    const out: ZoneEvKind[] = ["surge", "resonance"];
    if (hasButtons(zone)) out.push("clearance");
    if (hasStock(zone)) out.push("vein");
    if (s.life.secs >= ZE_TUNE.faultFrom) out.push("fault");
    return out;
}

/** What a Rich vein pays if you mine it now, without the event's own boost and without Overclock. */
export function mineAmount(s: State, zone: StatId): number {
    const d = derive(s);
    const oc = s.overclock > 0 ? overclockMult(s) : 1;
    const v = zone === "bytes" ? d.bytesPerSec / zeOut(s, "bytes") : (d.rates[zone as MatId] ?? 0) / zeOut(s, zone);
    return (v / oc) * ZE_TUNE.mine;
}
/** What a Patch costs, in Bytes. */
export function patchCost(s: State): number {
    const oc = s.overclock > 0 ? overclockMult(s) : 1;
    return (ZE_TUNE.patch * derive(s).bytesPerSec) / zeOut(s, "bytes") / oc;
}

/** Start an event on a zone (the scheduler and the admin panel both call this). Replaces nothing: events stack only when started by hand. */
export function zeStart(s: State, kind: ZoneEvKind, zone: StatId): ZoneEvActive {
    const z = ensureZe(s);
    const e: ZoneEvActive = { id: z.seen + 1, kind, zone, left: ZE_TUNE.secs[kind], total: ZE_TUNE.secs[kind] };
    z.act.push(e);
    z.seen += 1;
    z.kinds[kind] = (z.kinds[kind] ?? 0) + 1;
    z.last = zone;
    return e;
}

/** Roll the next event: a zone you have unlocked (not the last one), then a kind that suits it, weighted by ZE_TUNE.odds. */
export function rollEvent(s: State, rnd: () => number = Math.random): { kind: ZoneEvKind; zone: StatId } | null {
    const open = STATS.filter((x) => isUnlocked(s, x.id)).map((x) => x.id);
    if (!open.length) return null;
    const last = s.ze?.last;
    const pool = open.length > 1 ? open.filter((x) => x !== last) : open;
    const zone = pool[Math.floor(rnd() * pool.length) % pool.length];
    const kinds = kindsFor(s, zone);
    const total = kinds.reduce((a, k) => a + ZE_TUNE.odds[k], 0);
    let r = rnd() * total;
    for (const k of kinds) { r -= ZE_TUNE.odds[k]; if (r <= 0) return { kind: k, zone }; }
    return { kind: kinds[0], zone };
}

export type ZeChoice = "mine" | "run" | "patch" | "wait";
export interface ZeResult { ok: boolean; paid?: number; stat?: StatId }
/** Answer a vein or a fault. Mine pays the lump and ends the vein; Patch costs Bytes and ends the fault; Let it run and Wait it out just settle the question. */
export function zeChoose(s: State, id: number, choice: ZeChoice): ZeResult {
    const z = s.ze;
    const e = z?.act.find((x) => x.id === id);
    if (!z || !e || e.left <= 0 || e.picked) return { ok: false };
    if (e.kind === "vein" && choice === "mine") {
        const v = mineAmount(s, e.zone);
        if (e.zone === "bytes") { s.bytes += v; s.life.bytes += v; } else s[e.zone as MatId] += v;
        z.act = z.act.filter((x) => x !== e);
        return { ok: true, paid: v, stat: e.zone };
    }
    if (e.kind === "vein" && choice === "run") { e.picked = true; return { ok: true }; }
    if (e.kind === "fault" && choice === "patch") {
        const c = patchCost(s);
        if (s.bytes < c) return { ok: false };
        s.bytes -= c;
        z.act = z.act.filter((x) => x !== e);
        return { ok: true, paid: c, stat: "bytes" };
    }
    if (e.kind === "fault" && choice === "wait") { e.picked = true; return { ok: true }; }
    return { ok: false };
}

/** End every running event at once (admin and Ascend). */
export function zeClear(s: State) {
    if (s.ze) s.ze.act = [];
}

/** The tick hook. Online ticks (a few seconds at most) may start an event; time away only runs the clocks down. */
export function zeStep(s: State, dt: number) {
    const z = ensureZe(s);
    if (z.act.length) {
        for (const e of z.act) e.left -= dt * droneEventPace(s, e.zone, e.kind !== "fault"); // a posted Drone stretches good events and patches faults
        if (z.act.some((e) => e.left <= 0)) z.act = z.act.filter((e) => e.left > 0);
    }
    if (z.act.length) return;
    z.wait = Math.max(0, z.wait - dt);
    if (z.wait > 0 || dt > 5) return;
    const r = rollEvent(s);
    z.wait = ZE_TUNE.gap[0] + Math.random() * (ZE_TUNE.gap[1] - ZE_TUNE.gap[0]);
    if (r) zeStart(s, r.kind, r.zone);
}
if (!TICK_HOOKS.includes(zeStep)) TICK_HOOKS.push(zeStep);

/** Is this zone touched by a running event (the zone itself, or the pair of a Resonance)? */
export function eventsFor(s: State, zone: StatId): ZoneEvActive[] {
    return (s.ze?.act ?? []).filter((e) => e.left > 0 && (e.zone === zone || (e.kind === "resonance" && resonancePair(e.zone) === zone)));
}

/** One plain line on what the event does right now. */
export function zeEffect(s: State, e: ZoneEvActive): string {
    const nm = statDef(e.zone).name;
    switch (e.kind) {
        case "surge": return `${nm} output ×${ZE_TUNE.surge}`;
        case "clearance": return `${nm} buttons cost ${Math.round((1 - ZE_TUNE.clearance) * 100)}% less`;
        case "resonance": return `${nm} and ${statDef(resonancePair(e.zone)).name} output ×${ZE_TUNE.resonance}`;
        case "vein": return `${nm} output ×${ZE_TUNE.vein}`;
        case "fault": return `${nm} output halved`;
    }
}
