// Streak stats for the country guessers (Outline and Flag). Pure, so the tests run it under node. The stats are stored through
// lib/saves/core: the shared envelope, plus a migration for the bare object the games wrote before the envelope existed.
// The keys are unchanged, so an existing player's streak loads as it was.
import type { SaveDef } from "../saves/core";

export type GuessMode = "daily" | "unlimited";
export interface GuessModeStats { played: number; won: number; streak: number; best: number; last: string; dist: number[] }
export type GuessAllStats = Record<GuessMode, GuessModeStats>;

const MODES: GuessMode[] = ["daily", "unlimited"];
const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);

/** Brings streak stats to the current shape: each mode's counters are numbers and the distribution is `maxGuesses` long. */
export function normalizeStats(d: unknown, maxGuesses: number): Partial<GuessAllStats> {
    const out: Partial<GuessAllStats> = {};
    if (!d || typeof d !== "object") return out;
    for (const mode of MODES) {
        const m = (d as Record<string, unknown>)[mode] as Record<string, unknown> | undefined;
        if (!m || typeof m !== "object") continue;
        out[mode] = {
            played: count(m.played),
            won: count(m.won),
            streak: count(m.streak),
            best: count(m.best),
            last: typeof m.last === "string" ? m.last : "",
            dist: Array.from({ length: maxGuesses }, (_, i) => count(Array.isArray(m.dist) ? m.dist[i] : 0)),
        };
    }
    return out;
}

/** The save definition for one game's streak stats under `key`. Version 1 is the bare object; version 2 is normalized. */
export function statsSave(app: string, key: string, maxGuesses: number): SaveDef<Partial<GuessAllStats>> {
    return {
        app,
        key,
        version: 2,
        bareVersion: () => 1,
        migrations: { 1: (d) => normalizeStats(d, maxGuesses) },
        revive: (d) => (d && typeof d === "object" && !Array.isArray(d) ? normalizeStats(d, maxGuesses) : null),
        dump: (s) => s,
    };
}
