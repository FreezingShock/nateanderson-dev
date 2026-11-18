// One save system for every game. Pure: the storage is passed in and the clock is a parameter, so the tests run it under node.
//
// What is stored: the shared envelope { app, version, savedAt, data }, the same shape a player exports (lib/games/save.ts).
// `data` is what the game's def.dump returns, plain JSON.
//
// Older saves: before this system a save was stored bare (the game's own JSON, no envelope, or the {text, savedAt} wrapper
// Brasswork used). Those still load. Their version comes from def.bareVersion, then def.migrations run in order from that
// version up to def.version, so a save from any earlier build reaches the current shape before revive() reads it.
//
// Damage is never silent: a save that will not parse, migrate or revive is copied to "<key>-corrupt" (the copy before it moves
// to "-corrupt-prev"), then each fallback key (rolling backups) is tried in order. A save from a newer version of the game is
// treated the same way, so a rollback never overwrites it.

export type Migration = (data: unknown) => unknown;

export interface SaveDef<T> {
    /** Envelope app id. The same id the export file carries, so an export and a live save read the same way. */
    app: string;
    /** localStorage key of the live save. */
    key: string;
    /** Current save version. */
    version: number;
    /** Version of a save stored without an envelope. Defaults to 1. */
    bareVersion?: (data: unknown) => number;
    /** migrations[v] turns data at version v into data at version v + 1. Keep every migration forever: old saves stay in browsers. */
    migrations?: Partial<Record<number, Migration>>;
    /** Builds the live state from migrated data. Return null for a save that is not usable. May throw. */
    revive: (data: unknown) => T | null;
    /** The plain JSON to store for a live state. */
    dump: (state: T) => unknown;
    /** Rolling backups, newest first. Tried in order when the live save is damaged. */
    fallbacks?: readonly string[];
}

export type Store = (Pick<Storage, "getItem"> & Partial<Pick<Storage, "setItem">>) | null | undefined;

export type LoadStatus = "new" | "ok" | "migrated" | "restored" | "lost";

export interface Loaded<T> {
    state: T | null;
    status: LoadStatus;
    /** When the stored save was written (ms since the epoch), or 0 when it is unknown. */
    savedAt: number;
    /** The version the stored save was written at, before any migration. */
    from: number | null;
    /** A short line for the player when a save was restored or lost. Empty otherwise. */
    note: string;
}

type Attempt<T> = { ok: true; state: T; from: number; savedAt: number } | { ok: false; reason: "newer" | "damaged"; why: string };

const read = (st: Store, k: string): string | null => {
    try {
        return st ? st.getItem(k) : null;
    } catch {
        return null;
    }
};
const write = (st: Store, k: string, v: string): boolean => {
    try {
        if (!st || !st.setItem) return false;
        st.setItem(k, v);
        return true;
    } catch {
        return false;
    }
};

/** A parsed JSON object (not null, not an array): the shape every save check below reads. */
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Text for "from N minutes ago" in a restore note. */
export function agoText(ms: number): string {
    if (!(ms > 0)) return "earlier";
    const m = Math.round(ms / 60000);
    if (m < 1) return "a moment ago";
    if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
    const h = Math.round(m / 60);
    if (h < 48) return `${h} hour${h === 1 ? "" : "s"} ago`;
    const d = Math.round(h / 24);
    return `${d} days ago`;
}

/** Encodes a live state as the stored envelope. */
export function encodeSave<T>(def: SaveDef<T>, state: T, now: number = Date.now()): string {
    return JSON.stringify({ app: def.app, version: def.version, savedAt: new Date(now).toISOString(), data: def.dump(state) });
}

/** Encodes plain data at a given version as an envelope. Used for imports, where the file's own version is kept. */
export function encodeData(app: string, version: number, data: unknown, now: number = Date.now()): string {
    return JSON.stringify({ app, version, savedAt: new Date(now).toISOString(), data });
}

/**
 * Parses stored text and brings its data up to def.version. Throws on anything that cannot be a save of this game.
 * A save from a newer version is refused (not migrated backwards).
 */
export function upgrade<T>(def: SaveDef<T>, raw: string): { data: unknown; from: number; savedAt: number } {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) throw new Error("not a save object");
    if (typeof parsed.app === "string" && "data" in parsed) {
        if (parsed.app !== def.app) throw new Error(`save is for ${parsed.app}, not ${def.app}`);
        const savedAt = typeof parsed.savedAt === "string" ? Date.parse(parsed.savedAt) || 0 : 0;
        // migrateData checks that the version is a usable whole number, so the stored value is passed through as it is
        return { ...migrateData(def, parsed.data, parsed.version as number), savedAt };
    }
    const savedAt = typeof parsed.savedAt === "number" && Number.isFinite(parsed.savedAt) ? parsed.savedAt : 0;
    return { ...migrateData(def, parsed, def.bareVersion ? def.bareVersion(parsed) : 1), savedAt };
}

/** Brings plain data saved at `from` up to def.version by running each migration in order. Refuses data from a newer version. */
export function migrateData<T>(def: SaveDef<T>, data: unknown, from: number): { data: unknown; from: number } {
    if (!Number.isInteger(from) || from < 1) throw new Error("save has no usable version");
    if (from > def.version) throw new Error(`save is version ${from}, newer than ${def.version}`);
    let out = data;
    for (let v = from; v < def.version; v++) {
        const m = def.migrations?.[v];
        if (m) out = m(out);
    }
    return { data: out, from };
}

/** Revives plain data that came from a file or a backup: migrates it, then builds the state. Null when it is not usable. Never throws. */
export function reviveData<T>(def: SaveDef<T>, data: unknown, from: number): T | null {
    try {
        const m = migrateData(def, data, from);
        return def.revive(m.data) ?? null;
    } catch {
        return null;
    }
}

/** Revives plain data from a file or a backup whose version is read from the data itself (the bare shape). Never throws. */
export function reviveAuto<T>(def: SaveDef<T>, data: unknown): T | null {
    let from = 1;
    try {
        from = def.bareVersion ? def.bareVersion(data) : 1;
    } catch {
        return null;
    }
    return reviveData(def, data, from);
}

/** The game's own savedAt for a stored text (inside its data, or the envelope time). 0 when unknown. Never throws. */
export function rawSavedAt(raw: string | null | undefined): number {
    if (!raw) return 0;
    try {
        const p: unknown = JSON.parse(raw);
        const inner: unknown = isRecord(p) && "data" in p && typeof p.app === "string" ? p.data : p;
        if (isRecord(inner) && typeof inner.savedAt === "number" && Number.isFinite(inner.savedAt)) return inner.savedAt;
        return isRecord(p) && typeof p.savedAt === "string" ? Date.parse(p.savedAt) || 0 : 0;
    } catch {
        return 0;
    }
}

function attempt<T>(def: SaveDef<T>, raw: string): Attempt<T> {
    try {
        const { data, from, savedAt } = upgrade(def, raw);
        const state = def.revive(data);
        if (state === null || state === undefined) return { ok: false, reason: "damaged", why: "not a usable save" };
        return { ok: true, state, from, savedAt };
    } catch (e) {
        const why = e instanceof Error ? e.message : String(e);
        return { ok: false, reason: /newer than/.test(why) ? "newer" : "damaged", why };
    }
}

/** Revives stored text (a live save or a backup, either form) into a state. Null when it is not usable. Never throws. */
export function reviveText<T>(def: SaveDef<T>, raw: string | null | undefined): T | null {
    if (!raw) return null;
    const a = attempt(def, raw);
    return a.ok ? a.state : null;
}

/** Reads one stored key as a state. Null when it is missing or unusable. Never throws. */
export function readSaveKey<T>(st: Store, def: SaveDef<T>, key: string): T | null {
    return reviveText(def, read(st, key));
}

/** Keeps a damaged text under "<key>-corrupt", moving an older different copy to "-corrupt-prev". */
export function keepCorrupt(st: Store, key: string, raw: string): void {
    const corrupt = key + "-corrupt";
    const old = read(st, corrupt);
    if (old === raw) return;
    if (old) write(st, corrupt + "-prev", old);
    write(st, corrupt, raw);
}

/**
 * Reads the live save. Missing: "new". Usable: "ok", or "migrated" when its version was older. Damaged or newer: the text is
 * kept (keepCorrupt), each fallback is tried, and the result is "restored" (a backup loaded) or "lost" (state null, a new game
 * starts). Never throws.
 */
export function loadSave<T>(st: Store, def: SaveDef<T>, now: number = Date.now()): Loaded<T> {
    const raw = read(st, def.key);
    if (!raw) return { state: null, status: "new", savedAt: 0, from: null, note: "" };
    const main = attempt(def, raw);
    if (main.ok) return { state: main.state, status: main.from < def.version ? "migrated" : "ok", savedAt: main.savedAt, from: main.from, note: "" };
    keepCorrupt(st, def.key, raw);
    for (const key of def.fallbacks ?? []) {
        const old = read(st, key);
        if (!old) continue;
        const b = attempt(def, old);
        if (b.ok) {
            const note = `Your save was damaged, so its backup from ${agoText(b.savedAt ? now - b.savedAt : 0)} was loaded. The damaged file is kept.`;
            return { state: b.state, status: "restored", savedAt: b.savedAt, from: b.from, note };
        }
    }
    const note =
        main.reason === "newer"
            ? "Your save is from a newer version of this game, so it could not be loaded. A copy is kept and a new game starts."
            : "Your save could not be read, so a new game started. The damaged file is kept.";
    return { state: null, status: "lost", savedAt: 0, from: null, note };
}

/** Writes the live save. Returns the stored text on success, or null when the browser refused (full, blocked, private mode). */
export function writeSave<T>(st: Store, def: SaveDef<T>, state: T, now: number = Date.now()): string | null {
    const raw = encodeSave(def, state, now);
    return write(st, def.key, raw) ? raw : null;
}

/** Writes a value to a key (a backup or a copy). Returns false when the browser refuses. */
export function writeKey(st: Store, key: string, raw: string): boolean {
    return write(st, key, raw);
}

/** Keeps two rolling copies: the newest copy goes to `newer`, and what `newer` held moves to `older`. */
export function rollCopies(st: Store, newer: string, older: string, raw: string): void {
    const old = read(st, newer);
    if (old) write(st, older, old);
    write(st, newer, raw);
}
