// Shared save helpers for the web game shell. Pure and DOM-free except for the optional download helper,
// so every game can use the same export/import rules and the engine tests can run them under node.
// A save file is a small JSON envelope: { app, version, savedAt, data }. Anything else is refused with a reason
// the player can read, and nothing is written until the whole file has passed.

export const MAX_SAVE_BYTES = 2_000_000;

export type SaveEnvelope<T> = { app: string; version: number; savedAt: string; data: T };

export type ImportResult<T> = { ok: true; data: T; savedAt: string } | { ok: false; error: string };

export type SaveTools<T> = {
    exportText: (data: T, now?: Date) => string;
    importText: (text: string) => ImportResult<T>;
    fileName: (now?: Date) => string;
};

export type SaveToolsOptions<T> = {
    /** Short id for the game, used in the file name and checked on import, e.g. "node-farm". */
    app: string;
    /** Current save version. Files from a newer version are refused, older ones are passed to validate as-is. */
    version: number;
    /** Type guard for the data inside the envelope. Return false to refuse the file. */
    validate: (value: unknown) => value is T;
};

export function createSaveTools<T>(opts: SaveToolsOptions<T>): SaveTools<T> {
    const exportText = (data: T, now: Date = new Date()): string => {
        const envelope: SaveEnvelope<T> = { app: opts.app, version: opts.version, savedAt: now.toISOString(), data };
        return JSON.stringify(envelope, null, 2);
    };

    const importText = (text: string): ImportResult<T> => {
        if (typeof text !== "string" || text.trim() === "") return { ok: false, error: "The file is empty." };
        if (text.length > MAX_SAVE_BYTES) return { ok: false, error: "That file is too large to be a save." };
        let parsed: unknown;
        try {
            parsed = JSON.parse(text);
        } catch {
            return { ok: false, error: "That file is not valid JSON." };
        }
        if (!parsed || typeof parsed !== "object") return { ok: false, error: "That file is not a save." };
        const env = parsed as Partial<SaveEnvelope<unknown>>;
        if (env.app !== opts.app) return { ok: false, error: `That save is for ${String(env.app ?? "another game")}, not ${opts.app}.` };
        if (typeof env.version !== "number" || !Number.isInteger(env.version) || env.version < 1) {
            return { ok: false, error: "That save has no usable version." };
        }
        if (env.version > opts.version) return { ok: false, error: "That save is from a newer version of the game." };
        if (!opts.validate(env.data)) return { ok: false, error: "That save is damaged and cannot be loaded." };
        return { ok: true, data: env.data, savedAt: typeof env.savedAt === "string" ? env.savedAt : "" };
    };

    const fileName = (now: Date = new Date()): string => {
        const stamp = now.toISOString().slice(0, 10);
        return `${opts.app}-save-${stamp}.json`;
    };

    return { exportText, importText, fileName };
}

/** Minimal storage shape, so tests can pass a fake and the game can pass window.localStorage. */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

/** Reads a stored string. Returns null when storage is blocked, missing or throws. Never throws. */
export function readStored(storage: KeyValueStorage | null | undefined, key: string): string | null {
    try {
        return storage ? storage.getItem(key) : null;
    } catch {
        return null;
    }
}

/** Writes a stored string. Returns false when the browser refuses (full, blocked, private mode). Never throws. */
export function writeStored(storage: KeyValueStorage | null | undefined, key: string, value: string): boolean {
    try {
        if (!storage) return false;
        storage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

/** Downloads text as a file. No-op outside the browser. */
export function downloadText(name: string, text: string): void {
    if (typeof document === "undefined" || typeof URL === "undefined") return;
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reads a picked file as text, refusing anything over the save size limit before reading it. */
export async function readPickedFile(file: Blob): Promise<ImportResult<string>> {
    if (file.size > MAX_SAVE_BYTES) return { ok: false, error: "That file is too large to be a save." };
    try {
        return { ok: true, data: await file.text(), savedAt: "" };
    } catch {
        return { ok: false, error: "The file could not be read." };
    }
}
