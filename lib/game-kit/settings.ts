// Game kit: a per-device settings store. Settings live in their own storage key, apart from the save, so an import
// or a reset never changes them. The game supplies `parse`, which turns anything (missing, old, damaged) into a full,
// valid settings object, so readers never see a half-filled one. React reads it with useSettings (components/game-kit).

type Store = Pick<Storage, "getItem" | "setItem">;

export type SettingsStore<T> = {
    /** Current settings. Reads storage once, then serves the cached copy. */
    get: () => T;
    /** Merges a patch, re-parses, writes and notifies. Returns the new settings. */
    set: (patch: Partial<T>) => T;
    /** Back to defaults (parse of nothing), written and notified. */
    reset: () => T;
    /** Calls `fn` after every change. Returns the unsubscribe. */
    subscribe: (fn: () => void) => () => void;
    /** The storage key, for consoles and docs. */
    key: string;
};

export type SettingsOptions<T> = {
    /** Storage key, e.g. "sw-settings-v1". */
    key: string;
    /** Builds valid settings from anything. Unknown or wrong fields fall back to defaults. */
    parse: (raw: unknown) => T;
    /** Defaults to window.localStorage. Tests pass a fake. */
    storage?: () => Store | null;
};

const browserStorage = (): Store | null => {
    try {
        return typeof window === "undefined" ? null : window.localStorage;
    } catch {
        return null;
    }
};

export function createSettingsStore<T>(opts: SettingsOptions<T>): SettingsStore<T> {
    const storage = opts.storage ?? browserStorage;
    let cache: T | null = null;
    const listeners = new Set<() => void>();

    const get = (): T => {
        if (cache) return cache;
        let raw: unknown = null;
        try {
            raw = JSON.parse(storage()?.getItem(opts.key) ?? "null");
        } catch {
            /* none yet, or damaged: parse(null) gives the defaults */
        }
        cache = opts.parse(raw);
        return cache;
    };

    const write = (next: T): T => {
        cache = next;
        try {
            storage()?.setItem(opts.key, JSON.stringify(cache));
        } catch {
            /* private mode or full: the setting still works until the tab closes */
        }
        listeners.forEach((f) => f());
        return cache;
    };

    return {
        key: opts.key,
        get,
        set: (patch) => write(opts.parse({ ...get(), ...patch })),
        reset: () => write(opts.parse(null)),
        subscribe: (fn) => {
            listeners.add(fn);
            return () => {
                listeners.delete(fn);
            };
        },
    };
}

/** Step to the next value of a list, wrapping. For settings that cycle on one button. */
export const cycle = <T,>(list: readonly T[], cur: T): T => list[(list.indexOf(cur) + 1) % list.length];

/** Field helpers for parse functions: a boolean, a member of a list, or a number in range, each with a fallback. */
export const pick = {
    bool: (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d),
    oneOf: <T,>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d),
    num: (v: unknown, d: number, min = -Infinity, max = Infinity) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d),
};
