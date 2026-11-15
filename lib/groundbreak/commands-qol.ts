// More `gb` commands: the guidance cue, automation switches, rates, and an admin switch for testing the late game. Kept apart from
// commands.ts so the rule commands and these do not collide. commands.ts calls qolCommand() before it prints its help.
import { MATS, PERKS } from "./data";
import { catchUp, chain, effects, fmt, fmtAge, fmtCash, rawRate, type State } from "./engine";
import { doCue, nextCue } from "./guide";
import type { GbLine, GbResult } from "./commands";

export const GB_QOL_SUBS = ["next", "go", "auto", "rate", "admin", "give", "warp"];
const AUTOS: [number, string, string][] = [[1, "crews", "o2"], [2, "equipment", "o4"], [3, "change orders", "l9"]];
let admin = false;

const l = (t: string, k?: GbLine["k"]): GbLine => ({ t, k });
const out = (lines: GbLine[], changed = false): GbResult => ({ lines, changed });
const matIndex = (q: string) => (!q ? -1 : MATS.findIndex((m) => m.id === q || m.sym.toLowerCase() === q || m.name.toLowerCase().startsWith(q)));

/** "90", "90s", "15m", "2h", "1d" to seconds. */
export function parseDuration(q: string): number {
    const m = /^(\d+(?:\.\d+)?)([smhd]?)$/.exec(q.trim().toLowerCase());
    if (!m) return NaN;
    return parseFloat(m[1]) * ({ "": 1, s: 1, m: 60, h: 3600, d: 86400 }[m[2]] as number);
}

export function qolCommand(s: State, args: string[]): GbResult | null {
    const sub = (args[0] ?? "").toLowerCase();
    if (sub === "next") {
        const c = nextCue(s);
        return out([l(c.text, "hi"), l(c.why, "dim"), l(c.doable ? "gb go does it." : "Nothing to press yet.", "dim")]);
    }
    if (sub === "go") {
        const c = nextCue(s);
        const done = doCue(s, c);
        if (!done) return out([l(`${c.text}: ${c.why}`, "dim")]);
        return out([l(done, "hi"), l(`next: ${nextCue(s).text}`, "dim")], true);
    }
    if (sub === "auto") {
        const f = effects(s);
        const which = (args[1] ?? "").toLowerCase();
        const row = AUTOS.find(([, name]) => name.startsWith(which)) ?? (which === "change" ? AUTOS[2] : undefined);
        const has = (n: number) => (n === 3 ? f.auto >= 2 : f.auto >= n);
        if (row && which) {
            if (!has(row[0])) return out([l(`${row[1]} automation is not unlocked yet (perk ${row[2]}: ${PERKS.find((p) => p.id === row[2])?.name}).`, "err")]);
            const want = (args[2] ?? "").toLowerCase();
            const off = want ? want === "off" : !s.autoOff.includes(row[0]);
            s.autoOff = off ? [...new Set([...s.autoOff, row[0]])] : s.autoOff.filter((v) => v !== row[0]);
            return out([l(`${row[1]} automation ${off ? "off" : "on"}.`)], true);
        }
        return out([l("gb auto <crews|equipment|change> [on|off]", "dim"), ...AUTOS.map(([n, name, perk]) => l(`${name}: ${has(n) ? (s.autoOff.includes(n) ? "off" : "on") : `locked (perk ${perk})`}`, has(n) ? undefined : "dim"))]);
    }
    if (sub === "rate") {
        const f = effects(s), c = chain(s);
        return out(MATS.slice(0, s.open).map((m, i) => l(`${m.name.padEnd(12)} ${fmt(rawRate(s, i, f, c))}/s · ${fmt(s.amt[i])} held · ${s.crews[i]} crews · eq ${s.equip[i]}${s.method[i] ? " · method" : ""}`)));
    }
    if (sub === "admin") {
        const on = (args[1] ?? "").toLowerCase();
        if (on === "on" || on === "off") admin = on === "on";
        return out([l(`admin ${admin ? "on: give and warp work until you reload." : "off."}`, admin ? "hi" : "dim")]);
    }
    if (sub === "give" || sub === "warp") {
        if (!admin) return out([l("type gb admin on first. It only lasts until you reload the page.", "err")]);
        if (sub === "warp") {
            const secs = parseDuration(args[1] ?? "");
            if (!Number.isFinite(secs) || secs <= 0) return out([l("gb warp <time>, for example 30m or 2h. It runs the offline catch-up (capped at the offline limit).", "dim")]);
            const did = catchUp(s, secs);
            return out([l(`${fmtAge(did)} passed.`, "hi")], true);
        }
        const what = (args[1] ?? "").toLowerCase();
        const amount = parseFloat(args[2] ?? "");
        if (!(amount > 0)) return out([l(`gb give <cash|rep|charter|${MATS.map((m) => m.id).join("|")}> <amount>`, "dim")]);
        if (what === "cash") s.cash += amount;
        else if (what === "rep") { s.rep += amount; s.repFirm += amount; }
        else if (what === "charter") { s.charter += Math.floor(amount); s.charterAll += Math.floor(amount); }
        else {
            const n = matIndex(what);
            if (n < 0 || n >= s.open) return out([l("that material is not open yet.", "err")]);
            s.amt[n] += amount;
        }
        return out([l(`added ${what === "cash" ? fmtCash(amount) : fmt(amount)} ${what}.`)], true);
    }
    return null;
}
