// Recent searches and recently opened places for the "/" search. Stored in this browser only. Every read and write is
// wrapped, because storage can be blocked (private windows, strict settings) and the search must still work without it.

const KEY = "naos.search.recent";
const KEEP = 6;

export interface RecentSearch {
    /** Queries the visitor pressed Enter on or opened a result from, newest first. */
    queries: string[];
    /** Hrefs of places opened from the search, newest first. */
    places: string[];
}

const EMPTY: RecentSearch = { queries: [], places: [] };

const clean = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.length > 0 && s.length < 200).slice(0, KEEP) : [];

export function readRecent(): RecentSearch {
    try {
        const raw = window.localStorage.getItem(KEY);
        if (!raw) return EMPTY;
        const v = JSON.parse(raw) as Partial<RecentSearch> | null;
        return { queries: clean(v?.queries), places: clean(v?.places) };
    } catch {
        return EMPTY;
    }
}

/** Moves `value` to the front of the list, without duplicates. */
export function rememberRecent(kind: keyof RecentSearch, value: string): void {
    const v = value.trim();
    if (!v) return;
    try {
        const cur = readRecent();
        const next: RecentSearch = { ...cur, [kind]: [v, ...cur[kind].filter((x) => x !== v)].slice(0, KEEP) };
        window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
        // Storage is blocked or full: the search still works, it just does not remember.
    }
}
