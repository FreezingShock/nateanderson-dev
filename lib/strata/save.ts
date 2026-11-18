// Strata's live save: the round in progress in each mode, so a reload mid-round restores the board. Pure: the storage is
// passed in (lib/saves/core), so the tests run it under node. Stats and the Unlimited unlock are kept by the guess kit
// (useGuessProgress), not here.
import { SAVE_SLOTS } from "../saves/keys";
import type { SaveDef } from "../saves/core";
import { ANSWERS, ALLOWED } from "./words";
import { MAX_GUESSES, outcome, type Outcome } from "./engine";

export type StrataMode = "daily" | "unlimited";

/** One round. `date` is the Pacific date for a daily round and "" for an unlimited one. Rows are the guesses, in order. */
export interface Round {
    date: string;
    answer: string;
    rows: string[];
}

export interface StrataSave {
    mode: StrataMode;
    daily: Round | null;
    unlimited: Round | null;
}

const slot = SAVE_SLOTS.strata;
const ANSWER_SET = new Set<string>(ANSWERS);
const ALLOWED_SET = new Set<string>(ALLOWED);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A stored round, checked field by field. A bad round is dropped; the rest of the save still loads. */
function reviveRound(raw: unknown, daily: boolean): Round | null {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    const answer = typeof r.answer === "string" ? r.answer : "";
    const date = typeof r.date === "string" ? r.date : "";
    if (!ANSWER_SET.has(answer)) return null;
    if (daily ? !DATE.test(date) : date !== "") return null;
    if (!Array.isArray(r.rows) || r.rows.length > MAX_GUESSES) return null;
    const rows: string[] = [];
    for (const w of r.rows) {
        if (typeof w !== "string" || !ALLOWED_SET.has(w)) return null;
        rows.push(w);
    }
    return { date, answer, rows };
}

/** The save definition. Version 1. Migrations go in `migrations` as { 1: ... } when the shape changes; keep old ones forever. */
export const STRATA_SAVE: SaveDef<StrataSave> = {
    app: slot.app,
    key: slot.key,
    version: slot.version,
    migrations: {},
    revive(d: unknown) {
        if (!d || typeof d !== "object" || Array.isArray(d)) return null;
        const v = d as Record<string, unknown>;
        const mode: StrataMode = v.mode === "unlimited" ? "unlimited" : "daily";
        return {
            mode,
            daily: reviveRound(v.daily, true),
            unlimited: reviveRound(v.unlimited, false),
        };
    },
    dump: (s: StrataSave) => s,
};

/** The round's outcome, from its own rows (the stored state is never trusted for this). */
export function roundOutcome(r: Round): Outcome {
    return outcome(r.rows, r.answer);
}
