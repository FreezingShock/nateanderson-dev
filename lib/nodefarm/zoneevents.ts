// Zone events: now and then one zone you have unlocked gets a short event that changes it for a few minutes. Nothing here asks
// for reflexes. You notice it and either enjoy it or answer one plain question (Mine the vein now or let it run, Patch the fault
// or wait it out). Nothing ever takes stock from you, and time away just lets an event run out. Pure rules, no React: the numbers
// live in ZE_TUNE (engine.ts, because the engine reads them), the strip on the zone panel is components/nodefarm/zone-event.tsx.
import {
    addLifeBytes,
    MATS, STATS, TICK_HOOKS, TIERS, ZE_TUNE, chOff, derive, droneEventPace, droneRate, isUnlocked, overclockMult, postOf, press, resonancePair, statDef, zeOut, fwFieldOp, fwZeGap, fwZeLong,
    type ButtonStat, type MatId, type State, type StatId, type ZoneEvActive, type ZoneEvKind, type ZoneEvState,
} from "./engine";
import { LORE } from "./lore";
import { RIGS, muls } from "./rigs";
import { arcOf } from "./arcs";

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
    { kind: "convoy", code: "CONVOY", title: "Drone convoy", color: "#ffa23a", good: true },
    { kind: "tune", code: "RIG TUNE", title: "Rig tune", color: "#6bffc9", good: true },
];
export const zoneEvDef = (k: ZoneEvKind) => ZONE_EVENTS.find((e) => e.kind === k)!;

/** Each arc names the same events in its own voice (the rules do not change). Zones past these arcs use the plain titles above. */
const ARC_TITLES: Record<string, Record<ZoneEvKind, string>> = {
    rack: { surge: "Packet storm", clearance: "Surplus stock", resonance: "Feedback loop", vein: "Open channel", fault: "Short circuit", convoy: "Courier run", tune: "Overclocked rig" },
    fab: { surge: "Clean run", clearance: "Bulk order", resonance: "Matched wafers", vein: "Crystal seam", fault: "Dust leak", convoy: "Cart run", tune: "Calibrated line" },
    hollow: { surge: "Glyph flare", clearance: "Open vault", resonance: "Echoing halls", vein: "Buried seam", fault: "Stuck hour", convoy: "Torchbearers", tune: "Aligned carvings" },
    deep: { surge: "Solar wind", clearance: "Salvage drift", resonance: "Gravity lens", vein: "Dense cloud", fault: "Debris field", convoy: "Probe fleet", tune: "Dish alignment" },
    overgrowth: { surge: "Spore burst", clearance: "Seed swap", resonance: "Cross-pollination", vein: "Rich loam", fault: "Blight", convoy: "Gardeners' round", tune: "Grafted rig" },
    descent: { surge: "Magma surge", clearance: "Rockfall sale", resonance: "Deep echo", vein: "Geode pocket", fault: "Cave-in", convoy: "Mining crew", tune: "Tempered rig" },
    origin: { surge: "Memory flood", clearance: "Old prices", resonance: "Reflection", vein: "Buried archive", fault: "Stale index", convoy: "Recall", tune: "Rewritten rig" },
};
/** The name shown on the card and the log: the arc's own, or the plain one. */
export const zeTitle = (kind: ZoneEvKind, zone: StatId) => ARC_TITLES[arcOf(zone)?.id ?? ""]?.[kind] ?? zoneEvDef(kind).title;

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
    if (s.life.secs >= ZE_TUNE.faultFrom && !fwFieldOp(s)) out.push("fault"); // Field operator (Firmware): no Faults
    // Drone convoy needs Drones that actually press this zone (armed, or posted to it)
    if (zone !== "bytes" && zone !== "reboot" && s.drones.some((n, k) => n > 0 && (postOf(s, k) === zone || (!postOf(s, k) && s.armed.includes(zone))))) out.push("convoy");
    // Rig tune needs a rig bonus on that zone to double
    if ((muls(s)[zone] ?? 1) > 1) out.push("tune");
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
    const secs = ZE_TUNE.secs[kind] * fwZeLong(s); // Lightning rod (Firmware)
    const e: ZoneEvActive = { id: z.seen + 1, kind, zone, left: secs, total: secs };
    z.act.push(e);
    (z.log ??= []).push({ kind, zone, at: s.life.secs });
    if (z.log.length > ZE_TUNE.logMax) z.log.splice(0, z.log.length - ZE_TUNE.logMax);
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
        if (e.zone === "bytes") { s.bytes += v; addLifeBytes(s, v); } else s[e.zone as MatId] += v;
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

/** Drone convoy: the Drones that press this zone press it ZE_TUNE.convoy times as often. This adds the extra presses (online only). */
function convoyStep(s: State, e: ZoneEvActive, dt: number) {
    const acc = (e.acc ??= Array(TIERS).fill(0));
    for (let k = 0; k < TIERS; k++) {
        if (s.drones[k] <= 0) continue;
        const post = postOf(s, k);
        if (post ? post !== e.zone : !s.armed.includes(e.zone)) continue;
        acc[k] = Math.min(acc[k] + droneRate(s, k) * dt * (ZE_TUNE.convoy - 1), 40);
        const n = Math.floor(acc[k]);
        if (n < 1) continue;
        acc[k] -= n;
        for (let i = 0; i < n; i++) if (!press(s, e.zone as ButtonStat, k)) break;
    }
}

/** The tick hook. Online ticks (a few seconds at most) may start an event; time away only runs the clocks down. */
export function zeStep(s: State, dt: number) {
    const z = ensureZe(s);
    if (z.act.length) {
        if (dt <= 5) for (const e of z.act) if (e.kind === "convoy" && e.left > 0) convoyStep(s, e, dt);
        for (const e of z.act) e.left -= dt * droneEventPace(s, e.zone, e.kind !== "fault"); // a posted Drone stretches good events and patches faults
        if (z.act.some((e) => e.left <= 0)) z.act = z.act.filter((e) => e.left > 0);
    }
    if (z.act.length) return;
    z.wait = Math.max(0, z.wait - dt);
    if (z.wait > 0 || dt > 5 || chOff(s, "events")) return;
    const r = rollEvent(s);
    z.wait = (ZE_TUNE.gap[0] + Math.random() * (ZE_TUNE.gap[1] - ZE_TUNE.gap[0])) * fwZeGap(s); // Weather eye (Firmware)
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
        case "fault": return `${nm} output ×${ZE_TUNE.fault}`;
        case "convoy": return `Drones press ${nm} ×${ZE_TUNE.convoy} as often`;
        case "tune": return `${RIGS.find((r) => r.zone === e.zone)?.name ?? "Rig"} bonus counts ×${ZE_TUNE.tune}`;
    }
}
