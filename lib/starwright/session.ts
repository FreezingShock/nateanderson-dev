// Starwright session care: loading a save without losing it, backups, time credit for stalls and time away, and the
// welcome-back report. Pure TypeScript (storage and clocks are passed in), so the tests run it under node.
import { ELEMENTS, PLANETS, STAGE_NAMES } from "./data";
import { SAVE_KEY, catchUp, collapse, effects, fmt, fmtAge, heaviest, levels, offlineCapS, parse, planetStage, serialize, stageOf, step, type State } from "./engine";

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

// ---- loading --------------------------------------------------------------------------------------------------------

/** new: nothing saved. ok: loaded. restored: the main save was damaged, the backup was used. lost: damaged and no backup (a copy is kept). */
export type LoadStatus = "new" | "ok" | "restored" | "lost";
export interface Loaded { state: State | null; status: LoadStatus; note: string }

const ago = (ms: number) => fmtAge(Math.max(0, ms) / 1000);

/**
 * Read the save. A save that will not parse is never dropped silently: its text is kept under CORRUPT_KEY, the rolling
 * backup is tried next, and the caller gets a note to show the player.
 */
export function loadSession(st: Store, now = Date.now()): Loaded {
    const raw = read(st, SAVE_KEY);
    if (!raw) return { state: null, status: "new", note: "" };
    try {
        const s = parse(JSON.parse(raw));
        if (s) return { state: s, status: "ok", note: "" };
    } catch { /* fall through to recovery */ }
    write(st, CORRUPT_KEY, raw);
    const back = readBackup(st);
    if (back) return { state: back, status: "restored", note: `Your save was damaged, so Starwright loaded its backup from ${ago(now - back.savedAt)} ago. The damaged file is kept.` };
    return { state: null, status: "lost", note: "Your save could not be read, so a new star was lit. The damaged file is kept: type sw corrupt in the console to see it." };
}

// ---- backups --------------------------------------------------------------------------------------------------------

export function readBackup(st: Store): State | null {
    const raw = read(st, BACKUP_KEY);
    if (!raw) return null;
    try { return parse(JSON.parse(raw)); } catch { return null; }
}

/** Keep one rolling backup. Unless `force`, it never replaces a backup that has more play in it (so a reset does not wipe it). */
export function writeBackup(st: Store, s: State, force = false): boolean {
    if (!force) {
        const old = readBackup(st);
        if (old && old.totalAge > s.totalAge) return false;
    }
    return write(st, BACKUP_KEY, serialize({ ...s, savedAt: Date.now() }));
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

// ---- welcome back ---------------------------------------------------------------------------------------------------

export interface Snap { amt: number[]; mass: number; heavy: number; stage: number; col: number; levels: number; ages: Record<string, number>; stages: Record<string, number> }

export function snap(s: State): Snap {
    return {
        amt: s.amt.slice(), mass: s.mass, heavy: heaviest(s), stage: stageOf(s), col: collapse(s, effects(s)),
        levels: s.bought.reduce((n, _, i) => n + levels(s, i), 0), ages: { ...s.planetAge },
        stages: Object.fromEntries(s.planets.map((id) => [id, planetStage(s, id)])),
    };
}

export interface AwayReport { at: number; secs: number; gap: number; capped: boolean; capH: number; lines: string[] }

/** What happened while the star ran on its own. `secs` counted, `gap` was the real time away. */
export function awayReport(before: Snap, s: State, secs: number, gap: number, now = Date.now()): AwayReport {
    const f = effects(s);
    const capH = Math.round(offlineCapS(f) / 3600);
    const capped = gap > offlineCapS(f);
    const lines: string[] = [];
    lines.push(`The star burned on for ${fmtAge(secs)}.${capped ? ` It only keeps ${capH} hours; a Long watch perk raises that.` : ""}`);
    const gains = ELEMENTS.map((e, i) => ({ e, d: s.amt[i] - before.amt[i], r: (s.amt[i] + 1) / (before.amt[i] + 1) }))
        .filter((g, i) => i > 0 && g.d >= 1)
        .sort((a, b) => b.r - a.r)
        .slice(0, 3);
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
    return { at: now, secs, gap, capped, capH, lines };
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
