// Starwright session care: loading a save without losing it, backups, time credit for stalls and time away, and the
// welcome-back report. Pure TypeScript (storage and clocks are passed in), so the tests run it under node.
import { ELEMENTS, PLANETS, STAGE_NAMES } from "./data";
import { SAVE_KEY, STARWRIGHT_SAVE, answer, canSupernova, catchUp, collapse, effects, eventOf, fmt, fmtAge, heaviest, levels, offlineCapS, planetStage, stageOf, step, supernova, type State } from "./engine";
import { encodeSave, loadSave, readSaveKey } from "../saves/core";

export const BACKUP_KEY = `${SAVE_KEY}-backup`;
export const CORRUPT_KEY = `${SAVE_KEY}-corrupt`;
export const AWAY_KEY = "sw-away-v1";

type Store = Pick<Storage, "getItem" | "setItem"> | null | undefined;

const read = (st: Store, k: string): string | null => {
    try { return st ? st.getItem(k) : null; } catch { return null; }
};
const write = (st: Store, k: string, v: string): boolean => {
    try { if (!st) return false; st.setItem(k, v); return true; } catch { return false; }
};

// ---- loading and backups ----------------------------------------------------------------------------------------------
// The save goes through lib/saves/core.ts: envelope, migrations, the damaged copy under CORRUPT_KEY and the rolling backup.

/** new: nothing saved. ok: loaded (an older save is migrated on the way). restored: the main save was damaged, the backup was used. lost: damaged and no backup (a copy is kept). */
export type LoadStatus = "new" | "ok" | "restored" | "lost";
export interface Loaded { state: State | null; status: LoadStatus; note: string }

const ago = (ms: number) => fmtAge(Math.max(0, ms) / 1000);

/**
 * Read the save. A save that will not load is never dropped silently: its text is kept under CORRUPT_KEY, the rolling
 * backup is tried next, and the caller gets a note to show the player.
 */
export function loadSession(st: Store, now = Date.now()): Loaded {
    const r = loadSave(st, STARWRIGHT_SAVE, now);
    if (r.status === "new") return { state: null, status: "new", note: "" };
    if (r.status === "ok" || r.status === "migrated") return { state: r.state, status: "ok", note: "" };
    if (r.status === "restored") return { state: r.state, status: "restored", note: `Your save was damaged, so Starwright loaded its backup from ${ago(now - r.savedAt)} ago. The damaged file is kept.` };
    return { state: null, status: "lost", note: "Your save could not be read, so a new star was lit. The damaged file is kept: type sw corrupt in the console to see it." };
}

export function readBackup(st: Store): State | null {
    return readSaveKey(st, STARWRIGHT_SAVE, BACKUP_KEY);
}

/** Keep one rolling backup. Unless `force`, it never replaces a backup that has more play in it (so a reset does not wipe it). */
export function writeBackup(st: Store, s: State, force = false): boolean {
    if (!force) {
        const old = readBackup(st);
        if (old && old.totalAge > s.totalAge) return false;
    }
    const now = Date.now();
    return write(st, BACKUP_KEY, encodeSave(STARWRIGHT_SAVE, { ...s, savedAt: now }, now));
}

// ---- time ----------------------------------------------------------------------------------------------------------

/** Gaps up to this long are one ordinary step. Longer ones are caught up like time away, so a stalled frame loses nothing. */
export const STALL_MAX = 2;
/** A catch-up this long gets a welcome-back report. */
export const REPORT_MIN = 30;

/** Move the star forward by `gap` real seconds. Returns the seconds that counted (time away is capped by the Long watch perk). */
export function advance(s: State, gap: number): number {
    if (!(gap > 0)) return 0;
    if (gap <= STALL_MAX) { step(s, gap); return gap; }
    return catchUp(s, gap);
}

/** Most supernovas one absence can pay with auto supernova on, and the shortest star it assumes (seconds). Nate's pick 2026-11-15: "cap a few per absence". */
export const AWAY_NOVA_CAP = 3;
export const AWAY_NOVA_MIN_S = 300;

export interface AutoCfg { autoNova: number; autoVisitor: "off" | "lump" | "boost" }
export interface AutoResult { secs: number; novas: number; dust: number; answered: boolean }

/**
 * Like `advance`, but with the opt-in automations on: a visitor already waiting is answered, and the star goes supernova by
 * itself each time its core passes `autoNova` of the collapse. Visitors never arrive during time away, so only the waiting
 * one can be answered. Only used for long gaps; short ones are ordinary steps and the game's own timer does the rest.
 */
export function advanceAuto(s: State, gap: number, cfg: AutoCfg): AutoResult {
    const none = { novas: 0, dust: 0, answered: false };
    if (!(gap > 0)) return { secs: 0, ...none };
    if (gap <= STALL_MAX || (!cfg.autoNova && cfg.autoVisitor === "off")) return { secs: advance(s, gap), ...none };
    let answered = false;
    const ev = eventOf(s);
    if (ev && cfg.autoVisitor !== "off") { answered = answer(s, autoAnswer(ev, cfg.autoVisitor)) !== null; }
    const secs = Math.max(0, Math.min(gap, offlineCapS(effects(s))));
    if (secs < 2) return { secs: 0, novas: 0, dust: 0, answered };
    const steps = Math.min(7200, Math.max(1, Math.ceil(secs / 2)));
    const dt = secs / steps;
    let novas = 0, dust = 0, lastGain = 0, left = 0;
    for (let i = 0; i < steps; i++) {
        const f = effects(s);
        step(s, dt, f);
        if (cfg.autoNova && canSupernova(s, f) && collapse(s, f) >= cfg.autoNova) {
            lastGain = supernova(s); dust += lastGain; novas++;
            left = secs - (i + 1) * dt;
        }
    }
    // Away time buys nothing, so a restarted star would idle. Instead, each further star the absence had room for pays what the last one
    // paid, one per `awayNovaSecs` (the fastest star you have ever had, never under 5 minutes), up to AWAY_NOVA_CAP supernovas in all.
    if (novas > 0 && lastGain > 0) {
        const each = Math.max(AWAY_NOVA_MIN_S, s.fastest || 0);
        const extra = Math.min(AWAY_NOVA_CAP - novas, Math.floor(left / each));
        for (let k = 0; k < extra; k++) {
            s.stardust += lastGain; s.sdLayer += lastGain; s.sdAll += lastGain;
            s.novas++; s.novasAll++;
            dust += lastGain; novas++;
        }
    }
    return { secs, novas, dust, answered };
}

// ---- welcome back ---------------------------------------------------------------------------------------------------

export interface Snap { amt: number[]; mass: number; heavy: number; stage: number; col: number; levels: number; ages: Record<string, number>; stages: Record<string, number> }

export function snap(s: State): Snap {
    return {
        amt: s.amt.slice(), mass: s.mass, heavy: heaviest(s), stage: stageOf(s), col: collapse(s, effects(s)),
        levels: s.bought.reduce((n, _, i) => n + levels(s, i), 0), ages: { ...s.planetAge },
        stages: Object.fromEntries(s.planets.map((id) => [id, planetStage(s, id)])),
    };
}

export interface AwayReport { at: number; secs: number; gap: number; capped: boolean; capH: number; lines: string[]; /** Elements that grew most, for the card's chips (`lines[gainAt]` is the same thing as text). */ gains?: { i: number; d: number }[]; gainAt?: number; /** Core collapse share at the end, 0 to 1 */ col?: number }

/** What happened while the star ran on its own. `secs` counted, `gap` was the real time away. */
export function awayReport(before: Snap, s: State, secs: number, gap: number, now = Date.now(), auto?: AutoResult): AwayReport {
    const f = effects(s);
    const capH = Math.round(offlineCapS(f) / 3600);
    const capped = gap > offlineCapS(f);
    const lines: string[] = [];
    lines.push(`The star burned on for ${fmtAge(secs)}.${capped ? ` It only keeps ${capH} hours; a Long watch perk raises that.` : ""}`);
    if (auto && (auto.novas > 0 || auto.answered)) {
        if (auto.answered) lines.push("A visitor was waiting, and it was answered for you.");
        if (auto.novas > 0) {
            lines.push(`Auto supernova fired ${auto.novas} time${auto.novas === 1 ? "" : "s"}: +${fmt(auto.dust)} stardust.`);
            lines.push(`A new star burns now: ${STAGE_NAMES[stageOf(s)].toLowerCase()}, core at ${Math.floor(Math.min(1, collapse(s, f)) * 100)}% of its collapse.`);
            return { at: now, secs, gap, capped, capH, lines };
        }
    }
    const gains = ELEMENTS.map((e, i) => ({ e, i, d: s.amt[i] - before.amt[i], r: (s.amt[i] + 1) / (before.amt[i] + 1) }))
        .filter((g, i) => i > 0 && g.d >= 1)
        .sort((a, b) => b.r - a.r)
        .slice(0, 3);
    const gainAt = gains.length ? lines.length : undefined;
    if (gains.length) lines.push(gains.map((g) => `${g.e.name} +${fmt(g.d, 1)}`).join(" · "));
    const h = heaviest(s);
    if (h > before.heavy) lines.push(`${ELEMENTS[h].name} ignited in the core.`);
    if (stageOf(s) > before.stage) lines.push(`Its stage is now: ${STAGE_NAMES[stageOf(s)].toLowerCase()}.`);
    const lv = s.bought.reduce((n, _, i) => n + levels(s, i), 0) - before.levels;
    if (lv > 0) lines.push(`Autoburn bought ${fmt(lv)} burner level${lv === 1 ? "" : "s"}.`);
    for (const id of s.planets) {
        const a = before.stages[id] ?? 0;
        const b = planetStage(s, id);
        const pl = PLANETS.find((p) => p.id === id);
        if (pl && b > a) lines.push(`${pl.name} grew to ${pl.stages[b].toLowerCase()}.`);
    }
    const col = collapse(s, f);
    lines.push(col >= 1 ? "The core is ready to collapse." : `The core is at ${Math.floor(col * 100)}% of its collapse.`);
    return { at: now, secs, gap, capped, capH, lines, gains: gains.map((g) => ({ i: g.i, d: g.d })), gainAt, col: Math.min(1, col) };
}

export function saveAway(st: Store, r: AwayReport) {
    write(st, AWAY_KEY, JSON.stringify(r));
}

export function lastAway(st: Store): AwayReport | null {
    const raw = read(st, AWAY_KEY);
    if (!raw) return null;
    try {
        const r = JSON.parse(raw) as AwayReport;
        return r && Array.isArray(r.lines) && typeof r.at === "number" ? r : null;
    } catch { return null; }
}

// ---- automation -----------------------------------------------------------------------------------------------------

/** Which answer an automatic visitor choice takes: the option with a lump of output, or the one with a timed boost. */
export function autoAnswer(ev: { opts: ReadonlyArray<{ lump?: number; gas?: number; buffs?: unknown[] }> }, pref: "lump" | "boost"): number {
    const lump = (o: { lump?: number; gas?: number }) => !!(o.lump || o.gas);
    const i = ev.opts.findIndex((o) => (pref === "lump" ? lump(o) : !lump(o)));
    return i < 0 ? 0 : i;
}
