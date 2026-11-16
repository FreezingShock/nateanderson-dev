// Save export and import for every game, on top of lib/saves/core.ts. A save file is the shared envelope { app, version, savedAt,
// data }, and the live save in the browser is that same envelope, so a file and the stored save read the same way.
//
// Export runs the game's own migrations and writes the current version. Import checks the file, runs the game's own revive on
// it (after migrating an older file), and stages the file in sessionStorage. The page then reloads, and applyPendingImports()
// runs when the shell module loads, before any game reads its save. That order matters: games write their save on pagehide,
// so writing first would let the old state overwrite the import.
import { createSaveTools, downloadText, readPickedFile, readStored, writeStored, type SaveTools } from "@/lib/games/save";
import type { GameId } from "@/lib/games/registry";
import { SAVE_SLOTS as SLOTS } from "@/lib/saves/keys";
import { loadSave, migrateData, type SaveDef } from "@/lib/saves/core";

export type SaveSlot = { key: string; app: string; version: number };

/** The slot of every game that keeps a save file. Node Farm exports its own code text (lib/nodefarm/engine.ts exportSave). */
export const SAVE_SLOTS: Partial<Record<GameId, SaveSlot>> = {
    brasswork: SLOTS.brasswork,
    starwright: SLOTS.starwright,
    groundbreak: SLOTS.groundbreak,
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

/** The game's save definition. Loaded on demand so no engine is pulled into every game route. */
async function defFor(game: GameId): Promise<SaveDef<unknown> | null> {
    if (game === "brasswork") return (await import("@/lib/automation/sim/save")).BRASSWORK_SAVE as SaveDef<unknown>;
    if (game === "starwright") return (await import("@/lib/starwright/engine")).STARWRIGHT_SAVE as SaveDef<unknown>;
    if (game === "groundbreak") return (await import("@/lib/groundbreak/engine")).GROUNDBREAK_SAVE as SaveDef<unknown>;
    return null;
}

function toolsFor(slot: SaveSlot): SaveTools<unknown> {
    return createSaveTools<unknown>({
        app: slot.app,
        version: slot.version,
        validate: (v: unknown): v is unknown => typeof v === "object" && v !== null,
    });
}

export type SaveResult = { ok: true; message: string } | { ok: false; error: string };

/** Downloads the game's current save as a file, migrated to the current version. */
export async function exportSave(game: GameId, now: Date = new Date()): Promise<SaveResult> {
    const slot = SAVE_SLOTS[game];
    const def = await defFor(game);
    if (!slot || !def) return { ok: false, error: "This game has no save to export." };
    if (!readStored(local(), slot.key)) return { ok: false, error: "There is no save in this browser yet. Play a little, then export." };
    const r = loadSave(local(), def, now.getTime());
    if (!r.state) return { ok: false, error: "The save in this browser could not be read, so there is nothing to export. A copy is kept for recovery." };
    const tools = toolsFor(slot);
    downloadText(tools.fileName(now), tools.exportText(def.dump(r.state), now));
    return { ok: true, message: "Save file downloaded." };
}

/**
 * Checks a picked file and stages it. The caller reloads the page after an ok result.
 * Refuses files that are not this game's save, newer than the game, damaged, or too large. A file from an older version is
 * accepted when its data migrates and revives.
 */
export async function importSave(game: GameId, file: Blob): Promise<SaveResult> {
    const slot = SAVE_SLOTS[game];
    const def = await defFor(game);
    if (!slot || !def) return { ok: false, error: "This game has no save to import." };
    const picked = await readPickedFile(file);
    if (!picked.ok) return { ok: false, error: picked.error };
    const parsed = toolsFor(slot).importText(picked.data);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const fileVersion = (JSON.parse(picked.data) as { version: number }).version;
    try {
        const m = migrateData(def, parsed.data, fileVersion);
        if (def.revive(m.data) === null) throw new Error("not usable");
    } catch {
        return { ok: false, error: "That save is damaged and cannot be loaded." };
    }
    const current = readStored(local(), slot.key);
    if (current) writeStored(local(), slot.key + ":before-import", current);
    try {
        const s = session();
        if (!s) throw new Error("no session storage");
        // the file itself is stored: it is already the envelope, so the game's own load migrates it on the next start
        s.setItem(PENDING(slot.key), picked.data);
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
