// Save export and import for every game, in one place. A save file is the shared envelope from lib/games/save.ts:
// { app, version, savedAt, data }, where data is the game's own stored save object. Files the games' own menus export
// use the same envelope, so either side can read the other's file.
//
// Import never writes straight to storage. It validates the file, keeps the current save as a backup under
// "<key>:before-import", and stages the new save in sessionStorage. The page then reloads, and applyPendingImports()
// runs when the shell module loads, before any game reads its save. That order matters: games write their save on
// pagehide, so writing first would let the old state overwrite the import.
import { createSaveTools, downloadText, readPickedFile, readStored, writeStored } from "@/lib/games/save";
import type { GameId } from "@/lib/games/registry";

export type SaveSlot = {
    /** localStorage key the game reads. Must match the game's own SAVE_KEY. */
    key: string;
    /** Envelope app id. Must match the game's own createSaveTools app, so its menus accept the file. */
    app: string;
    /** Envelope version. Must match the game's own SAVE_VERSION. */
    version: number;
};

// Duplicated from the engines on purpose: importing them here would pull every engine into every game route.
// checkSaveData below runs each engine's real parse, so a drift shows up as a refused import, not a silent one.
export const SAVE_SLOTS: Partial<Record<GameId, SaveSlot>> = {
    brasswork: { key: "brasswork-save-v1", app: "brasswork", version: 1 },
    starwright: { key: "sw-save-v1", app: "starwright", version: 1 },
    groundbreak: { key: "gb-save-v1", app: "groundbreak", version: 2 },
    // gen-anchor: slots
};

const PENDING = (key: string) => `gs-pending-import:${key}`;

function session(): Storage | null {
    try {
        return typeof window === "undefined" ? null : window.sessionStorage;
    } catch {
        return null;
    }
}

function local(): Storage | null {
    try {
        return typeof window === "undefined" ? null : window.localStorage;
    } catch {
        return null;
    }
}

function toolsFor(slot: SaveSlot) {
    return createSaveTools<unknown>({
        app: slot.app,
        version: slot.version,
        validate: (v: unknown): v is unknown => typeof v === "object" && v !== null,
    });
}

/** Runs the game's own parse on an imported save object. Each engine's parse refuses anything it cannot rebuild. */
export async function checkSaveData(game: GameId, data: unknown): Promise<boolean> {
    try {
        if (game === "brasswork") {
            const { deserialize } = await import("@/lib/automation/sim/save");
            const text = (data as { text?: unknown }).text;
            if (typeof text !== "string") return false;
            deserialize(text);
            return true;
        }
        if (game === "starwright") {
            const { parse } = await import("@/lib/starwright/engine");
            return parse(data) !== null;
        }
        if (game === "groundbreak") {
            const { parse } = await import("@/lib/groundbreak/engine");
            return parse(data) !== null;
        // gen-anchor: checks
        }
    } catch {
        return false;
    }
    return false;
}

export type SaveResult = { ok: true; message: string } | { ok: false; error: string };

/** Downloads the game's current save as a file. */
export function exportSave(game: GameId, now: Date = new Date()): SaveResult {
    const slot = SAVE_SLOTS[game];
    if (!slot) return { ok: false, error: "This game has no save to export." };
    const raw = readStored(local(), slot.key);
    if (!raw) return { ok: false, error: "There is no save in this browser yet. Play a little, then export." };
    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch {
        return { ok: false, error: "The save in this browser could not be read, so there is nothing to export." };
    }
    const tools = toolsFor(slot);
    downloadText(tools.fileName(now), tools.exportText(data, now));
    return { ok: true, message: "Save file downloaded." };
}

/**
 * Checks a picked file and stages it. The caller reloads the page after an ok result.
 * Refuses files that are not this game's save, newer than the game, damaged, or too large.
 */
export async function importSave(game: GameId, file: Blob): Promise<SaveResult> {
    const slot = SAVE_SLOTS[game];
    if (!slot) return { ok: false, error: "This game has no save to import." };
    const picked = await readPickedFile(file);
    if (!picked.ok) return { ok: false, error: picked.error };
    const parsed = toolsFor(slot).importText(picked.data);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    if (!(await checkSaveData(game, parsed.data))) return { ok: false, error: "That save is damaged and cannot be loaded." };
    const current = readStored(local(), slot.key);
    if (current) writeStored(local(), slot.key + ":before-import", current);
    try {
        const s = session();
        if (!s) throw new Error("no session storage");
        s.setItem(PENDING(slot.key), JSON.stringify(parsed.data));
    } catch {
        return { ok: false, error: "This browser would not hold the save while the page reloads. Free some space and try again." };
    }
    return { ok: true, message: "Save imported. Reloading." };
}

/** Moves a staged import into the game's storage key. Runs on every load, before the game reads its save. */
export function applyPendingImports(): void {
    const s = session();
    const l = local();
    if (!s || !l) return;
    for (const slot of Object.values(SAVE_SLOTS)) {
        if (!slot) continue;
        try {
            const staged = s.getItem(PENDING(slot.key));
            if (staged === null) continue;
            s.removeItem(PENDING(slot.key));
            writeStored(l, slot.key, staged);
        } catch {
            /* a blocked session store means nothing is staged */
        }
    }
}
