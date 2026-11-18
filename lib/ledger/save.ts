// Ledger's save: the round in progress for today's daily and for unlimited. Pure data, no React, so it runs under node.
// Stored through lib/saves/core like every game (versioned, migration-ready, a damaged copy is kept, never wiped).
import type { SaveDef } from "../saves/core";
import { SAVE_SLOTS } from "../saves/keys";
import { newRound, reviveRound, type Round } from "./engine";

export interface LedgerSave {
    mode: "daily" | "unlimited";
    /** Today's daily round (its date is the Pacific calendar date it was started on). */
    daily: { date: string; round: Round } | null;
    /** The unlimited round in progress. */
    unlimited: Round | null;
}

export const emptyLedgerSave = (): LedgerSave => ({ mode: "daily", daily: null, unlimited: null });

const slot = SAVE_SLOTS.ledger;

/**
 * Revive keeps whatever part still checks out: a damaged daily round does not throw away a good unlimited one. A save
 * from a newer version is refused by lib/saves/core before revive runs.
 */
export const LEDGER_SAVE: SaveDef<LedgerSave> = {
    app: slot.app,
    key: slot.key,
    version: slot.version,
    revive: (d) => {
        if (!d || typeof d !== "object") return null;
        const mode = d.mode === "unlimited" ? "unlimited" : "daily";
        let daily: LedgerSave["daily"] = null;
        if (d.daily && typeof d.daily === "object" && typeof d.daily.date === "string") {
            const round = reviveRound(d.daily.round);
            if (round) daily = { date: d.daily.date, round };
        }
        const unlimited = reviveRound(d.unlimited) ?? null;
        return { mode, daily, unlimited };
    },
    dump: (s) => s,
};

/** A fresh daily round for a puzzle, used when nothing is stored for the date. */
export const freshDaily = (date: string, puzzle: Round["puzzle"]) => ({ date, round: newRound(puzzle) });
