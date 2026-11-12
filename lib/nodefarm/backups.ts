// Node Farm save backups. One list in localStorage (`nf-backups-v1`), newest first. The game keeps it up by itself:
//   auto   every 30 minutes of play, and once when the game opens (the save exactly as the last visit left it, before any
//          migration touches it). The newest 4 are kept.
//   daily  the first auto backup of each calendar day. The newest 3 are kept, so a problem found two days later still has a way back.
//   event  before an import, a wipe, a restore, a Handover or an Ascend. The newest 3 are kept.
//   lost   the text of a save that could not be read, kept so it can be copied out. One at most; it cannot be restored.
// A backup is the save's own JSON text, so a restore goes through parseSave like a load does. No React here; the storage can be
// swapped for tests.
import { parseSave, fmtTime } from "./engine";

export const BACKUPS_KEY = "nf-backups-v1";
/** The single backup slot the game used before this list. Read once, moved into the list, then removed. */
export const LEGACY_BACKUP_KEY = "nf-backup-v1";
export const AUTO_GAP = 30 * 60 * 1000;
const KEEP = { auto: 4, daily: 3, event: 3, lost: 1 } as const;

export type BackupKind = "auto" | "event" | "lost";
export interface Backup {
    at: number;
    kind: BackupKind;
    /** the first auto backup of its calendar day, kept for longer */
    daily?: boolean;
    why: string;
    /** the save as JSON text (or, for `lost`, whatever text could not be read) */
    code: string;
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const store = (): Store | null => {
    try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
};

const valid = (b: unknown): b is Backup => {
    const x = b as Backup;
    return !!x && typeof x.code === "string" && typeof x.at === "number" && Number.isFinite(x.at) && (x.kind === "auto" || x.kind === "event" || x.kind === "lost") && typeof x.why === "string";
};

export function readBackups(st: Store | null = store()): Backup[] {
    if (!st) return [];
    let list: Backup[] = [];
    try {
        const raw = JSON.parse(st.getItem(BACKUPS_KEY) ?? "[]");
        if (Array.isArray(raw)) list = raw.filter(valid);
    } catch {}
    // move the old single slot in, once
    try {
        const old = JSON.parse(st.getItem(LEGACY_BACKUP_KEY) ?? "null");
        if (old && typeof old.code === "string" && typeof old.at === "number") {
            // it held a base64 code or JSON; both parse the same way
            list.push({ at: old.at, kind: "event", why: String(old.why ?? "backup"), code: old.code });
            list.sort((a, b) => b.at - a.at);
            if (write(list, st)) st.removeItem(LEGACY_BACKUP_KEY);
        }
    } catch {}
    return list.sort((a, b) => b.at - a.at);
}

/** What stays after pruning: per kind, the newest few. Input is newest first. */
export function prune(list: Backup[]): Backup[] {
    const n = { auto: 0, daily: 0, event: 0, lost: 0 };
    return list.filter((b) => {
        const group = b.kind === "auto" ? (b.daily ? "daily" : "auto") : b.kind;
        return ++n[group] <= KEEP[group];
    });
}

/** Writes the list; when the browser is short of room, the oldest entries go first until it fits. */
function write(list: Backup[], st: Store): boolean {
    const l = [...list];
    for (;;) {
        try {
            st.setItem(BACKUPS_KEY, JSON.stringify(l));
            return true;
        } catch {
            const i = [...l].reverse().findIndex((b) => b.kind !== "event");
            if (i < 0 || l.length <= 1) return false;
            l.splice(l.length - 1 - i, 1);
        }
    }
}

const dayOf = (at: number) => { const d = new Date(at); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
/** The save text without its `at` stamp, so "nothing has changed since the last backup" can be told. */
const sameSave = (a: string, b: string) => {
    try {
        const x = JSON.parse(a), y = JSON.parse(b);
        delete x.at; delete y.at;
        return JSON.stringify(x) === JSON.stringify(y);
    } catch { return false; }
};

/**
 * Adds a backup and returns the new list. `auto` backups are skipped when the newest backup is under AUTO_GAP old or the save has
 * not changed since it; pass `force` (before an Ascend, say) to take one anyway. Never throws.
 */
export function addBackup(kind: BackupKind, why: string, code: string, opt: { force?: boolean; now?: number; st?: Store | null } = {}): Backup[] {
    const st = opt.st === undefined ? store() : opt.st;
    if (!st) return [];
    try {
        const now = opt.now ?? Date.now();
        const list = readBackups(st);
        const last = list[0];
        if (kind === "auto" && !opt.force && last && (now - last.at < AUTO_GAP || (last.kind !== "lost" && sameSave(last.code, code)))) return list;
        if (kind === "lost") {
            if (list.some((b) => b.kind === "lost" && b.code === code)) return list;
        }
        const daily = kind === "auto" && !list.some((b) => b.daily && dayOf(b.at) === dayOf(now));
        const next = prune([{ at: now, kind, why, code, ...(daily ? { daily: true } : {}) }, ...list]);
        write(next, st);
        return next;
    } catch {
        return [];
    }
}

/** One line for a backup row: when, what kind, and how far that save had got. */
export function backupLine(b: Backup): { when: string; what: string; how: string } {
    const when = new Date(b.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const s = b.kind === "lost" ? null : parseSave(b.code);
    const how = s ? `${fmtTime(s.life.secs)} played, ${s.life.ascends} Ascend${s.life.ascends === 1 ? "" : "s"}` : "cannot be read";
    return { when, what: b.why, how };
}
