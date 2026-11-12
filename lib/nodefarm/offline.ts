// Time away: runs the engine's catch-up and reads what each system did meanwhile, for the standby report (components/nodefarm/away.tsx).
// What runs while you are away: production, Drones (at their away speed), Scripts (all but ascend.sh, which needs the game open), rig meters,
// Exploit Lab Intel and the compile queue, and the clocks of zone events and deployed payloads. What does not: quick-time events, new
// zone events (a running one only runs out), and anything that needs a decision (buying, deploying, Ascending, Handover).
import { POSTABLE, fmt, offline, statDef, zoneRank, type ButtonStat, type State, type StatId } from "./engine";
import { SCRIPT_BY } from "./scripts";
import { ZONE_EVENTS } from "./zoneevents";

export interface SysLine { label: string; value: string }
export interface SysGroup { id: "scripts" | "drones" | "rigs" | "lab" | "events"; title: string; lines: SysLine[] }
export interface AwayCore {
    secs: number;
    capped: boolean;
    drones: number;
    gain: Record<string, number>;
    sys: SysGroup[];
}

const n = (v: number) => Math.round(v).toLocaleString("en-US");
const ranks = (s: State) => Object.fromEntries(POSTABLE.map((m) => [m, zoneRank(s, m)])) as Record<ButtonStat, number>;

/** Run `offline` and describe what the systems did. Everything is already in the state when this returns. */
export function catchUp(s: State, seconds: number): AwayCore {
    const a0 = s.auto ? { ran: { ...s.auto.ran }, presses: s.auto.presses } : null;
    const parts0 = s.dr.parts;
    const rank0 = ranks(s);
    const svc0 = { ...s.dr.svc };
    const intel0 = s.lab.intel;
    const compiled0 = s.life.compiled;
    const deployed0 = s.life.deployed;
    const r0 = s.rig ? { dust: s.rig.dust, fired: s.rig.fired, cache: s.rig.cache, casts: s.rig.casts } : null;
    const ev0 = (s.ze?.act ?? []).filter((e) => e.left > 0).map((e) => ({ kind: e.kind, zone: e.zone, left: e.left }));

    const r = offline(s, seconds);
    const sys: SysGroup[] = [];

    // Scripts
    if (s.auto && a0) {
        const lines: SysLine[] = [];
        for (const id of Object.keys(s.auto.ran) as (keyof typeof s.auto.ran)[]) {
            const d = (s.auto.ran[id] ?? 0) - (a0.ran[id] ?? 0);
            const def = SCRIPT_BY.get(id);
            if (d > 0 && def) lines.push({ label: def.file, value: id === "reboot" ? `${n(d)} Reboots` : id === "drop" ? `${n(d)} Dead drop${d === 1 ? "" : "s"} opened` : `${n(d)} runs` });
        }
        const pr = s.auto.presses - a0.presses;
        if (pr > 0) lines.push({ label: "Buttons pressed by scripts", value: n(pr) });
        if (lines.length) sys.push({ id: "scripts", title: "Scripts", lines });
    }

    // Drones (presses by Drones only; scripts count above)
    const scriptPresses = s.auto && a0 ? s.auto.presses - a0.presses : 0;
    const dronePresses = Math.max(0, r.drones - scriptPresses);
    {
        const lines: SysLine[] = [];
        if (dronePresses > 0) lines.push({ label: "Drone presses", value: n(dronePresses) });
        const parts = s.dr.parts - parts0;
        if (parts > 0) lines.push({ label: "Parts salvaged", value: n(parts) });
        const rank1 = ranks(s);
        for (const m of POSTABLE) {
            if (rank1[m] > rank0[m]) lines.push({ label: `${statDef(m).name} mastery`, value: `rank ${rank1[m]} reached` });
        }
        if (!lines.some((l) => l.label.endsWith("mastery"))) {
            const grew = POSTABLE.filter((m) => (s.dr.svc[m] ?? 0) > (svc0[m] ?? 0)).length;
            if (grew) lines.push({ label: "Zones serviced by posted Drones", value: n(grew) });
        }
        if (lines.length) sys.push({ id: "drones", title: "Drone hangar", lines });
    }

    // Zone rigs
    if (s.rig && r0) {
        const lines: SysLine[] = [];
        if (s.rig.dust > r0.dust + 0.005) lines.push({ label: "Fab Cleanroom dust", value: `${Math.round(r0.dust * 100)}% to ${Math.round(s.rig.dust * 100)}% (Silicon is slowed)` });
        else if (s.rig.dust < r0.dust - 0.005) lines.push({ label: "Fab Cleanroom dust", value: `${Math.round(r0.dust * 100)}% to ${Math.round(s.rig.dust * 100)}%` });
        if (s.rig.fired > r0.fired) lines.push({ label: "Beacon discharges", value: n(s.rig.fired - r0.fired) });
        if (s.rig.cache > r0.cache + 1) lines.push({ label: "Packet cache", value: `${fmtShort(s.rig.cache)} Bytes waiting for the next Reboot` });
        if (lines.length) sys.push({ id: "rigs", title: "Zone rigs", lines });
    }

    // Exploit Lab
    {
        const lines: SysLine[] = [];
        const intel = s.lab.intel - intel0;
        if (intel > 0) lines.push({ label: "Intel", value: `+${fmtShort(intel)}` });
        if (s.life.compiled > compiled0) lines.push({ label: "Payloads compiled", value: n(s.life.compiled - compiled0) });
        if (s.life.deployed > deployed0) lines.push({ label: "Payloads deployed", value: n(s.life.deployed - deployed0) });
        if (lines.length) sys.push({ id: "lab", title: "Exploit Lab", lines });
    }

    // Zone events: only one that was running when you left, and it only runs down
    if (ev0.length) {
        const lines = ev0.map((e) => {
            const def = ZONE_EVENTS.find((d) => d.kind === e.kind);
            const ran = Math.min(e.left, r.secs);
            return { label: `${def?.title ?? e.kind} in ${statDef(e.zone as StatId).name}`, value: e.left <= r.secs ? `ran out after ${mins(ran)}` : `${mins(e.left - r.secs)} left` };
        });
        sys.push({ id: "events", title: "Zone events", lines });
    }

    return { secs: r.secs, capped: r.capped, drones: r.drones, gain: r.gain, sys };
}

const mins = (sec: number) => (sec >= 90 ? `${Math.round(sec / 60)} min` : `${Math.round(sec)} s`);
const fmtShort = (v: number) => fmt(v);
