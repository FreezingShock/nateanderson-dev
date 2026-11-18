// Shared helpers for the launch and exit flow between the Games hub and each game route.
// Reads each game's own save key (read only, never written here) and remembers the last game played.
// Browser storage is wrapped in try/catch: private mode, blocked storage and damaged JSON all fall back to "nothing saved".

export const LAST_GAME_KEY = "gl-last-game-v1";
export const HUB_PATH = "/creations/games";

export type SaveInfo = {
    /** "save" for games with one progress save; "stats" for the guessers, which keep played counts */
    kind: "save" | "stats";
    savedAt?: number;
    detail?: string;
};

type Reader = (o: Record<string, unknown>) => { savedAt?: number; detail?: string } | null;

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Stats keys hold one object per mode, or a single object. Sum the played counts. */
const statsReader: Reader = (o) => {
    const modes = typeof o.played === "number" ? [o] : Object.values(o);
    let played = 0;
    for (const m of modes) {
        if (m && typeof m === "object" && typeof (m as { played?: unknown }).played === "number") {
            played += (m as { played: number }).played;
        }
    }
    return played > 0 ? { detail: `${played} played` } : null;
};

/** Route segment -> the save key that game already writes, and how to read a line from it. */
export const GAME_SAVES: Record<string, { key: string; kind: SaveInfo["kind"]; read: Reader }> = {
    starwright: {
        key: "sw-save-v1",
        kind: "save",
        read: (o) => ({ savedAt: num(o.savedAt), detail: str(o.name) ? `Star ${str(o.name)}` : undefined }),
    },
    groundbreak: {
        key: "gb-save-v1",
        kind: "save",
        read: (o) => ({ savedAt: num(o.savedAt), detail: num(o.built) !== undefined ? `${o.built} jobs built` : undefined }),
    },
    brasswork: {
        key: "brasswork-save-v1",
        kind: "save",
        read: (o) => ({ savedAt: num(o.savedAt) }),
    },
    "node-farm": {
        key: "nf-save-v1",
        kind: "save",
        read: (o) => ({ savedAt: num(o.savedAt) }),
    },
    "outline-guesser": { key: "outline-stats-v1", kind: "stats", read: statsReader },
    "flag-guesser": { key: "flag-stats-v1", kind: "stats", read: statsReader },
    ledger: { key: "ledger-stats-v1", kind: "stats", read: statsReader },
    // gen-anchor: saves
};

/** The route segment of a game URL, e.g. "/creations/games/node-farm?x=1" -> "node-farm". Null for the hub. */
export function routeSlugOf(pathOrHref: string): string | null {
    const path = pathOrHref.split("?")[0].split("#")[0];
    const m = /^\/creations\/games\/([a-z0-9-]+)\/?$/.exec(path);
    return m ? m[1] : null;
}

/** The save line for one game, or null when nothing is stored (or storage is blocked). Client only. */
export function readSaveInfo(slug: string): SaveInfo | null {
    const game = GAME_SAVES[slug];
    if (!game || typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(game.key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== "object") return null;
        const info = game.read(parsed as Record<string, unknown>);
        if (!info) return null;
        if (game.kind === "stats" && !info.detail) return null;
        return { kind: game.kind, ...info };
    } catch {
        return null;
    }
}

export function readLastGame(): string | null {
    try {
        return window.localStorage.getItem(LAST_GAME_KEY);
    } catch {
        return null;
    }
}

export function writeLastGame(slug: string): void {
    try {
        window.localStorage.setItem(LAST_GAME_KEY, slug);
    } catch {
        /* private mode: the hub just won't remember this visit */
    }
}

/** "3 min", "2 hr", "5 days": how long ago a save was written. */
export function agoLabel(savedAt: number, now = Date.now()): string {
    const s = Math.max(0, (now - savedAt) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
    const d = Math.floor(s / 86400);
    return d === 1 ? "1 day ago" : `${d} days ago`;
}
