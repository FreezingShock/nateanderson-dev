// Strata: the word engine (no React). A hidden five-letter word, six tries, and a mark for every tile.
// Daily words come from a seeded permutation of ANSWERS, so every browser gets the same word for a date and no word
// repeats until the list is used up. Everything here is integer maths, so the schedule is the same on every device.
import { ALLOWED, ANSWERS } from "./words";

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

/** Day 0 of the daily word schedule (Pacific calendar date). Puzzle #1 is this day. */
export const STRATA_EPOCH = "2026-11-17";

export type Mark = "correct" | "present" | "absent";
export type Outcome = "playing" | "won" | "lost";
export type GuessCheck = { ok: true } | { ok: false; reason: "short" | "letters" | "unknown" };

const ALLOWED_SET = new Set<string>(ALLOWED);

/** Checks a typed guess: five letters a-z, and on the allowed list. Case is folded first. */
export function checkGuess(word: string): GuessCheck {
    const w = word.toLowerCase();
    if (w.length !== WORD_LENGTH) return { ok: false, reason: "short" };
    if (!/^[a-z]+$/.test(w)) return { ok: false, reason: "letters" };
    if (!ALLOWED_SET.has(w)) return { ok: false, reason: "unknown" };
    return { ok: true };
}

export function isAllowed(word: string): boolean {
    return checkGuess(word).ok;
}

/**
 * Marks one guess against the answer, with duplicate letters handled the usual way: exact matches are
 * taken first, then each leftover guess letter is "present" only while the answer still has an unmatched copy.
 * speed vs erase -> present, absent, present, present, absent.
 */
export function scoreGuess(guess: string, answer: string): Mark[] {
    const g = guess.toLowerCase();
    const a = answer.toLowerCase();
    const marks: Mark[] = Array.from({ length: g.length }, () => "absent");
    const spare: Record<string, number> = {};
    for (let i = 0; i < g.length; i++) {
        if (g[i] === a[i]) marks[i] = "correct";
        else spare[a[i]] = (spare[a[i]] ?? 0) + 1;
    }
    for (let i = 0; i < g.length; i++) {
        if (marks[i] === "correct") continue;
        if ((spare[g[i]] ?? 0) > 0) {
            marks[i] = "present";
            spare[g[i]] -= 1;
        }
    }
    return marks;
}

export function outcome(guesses: readonly string[], answer: string, max = MAX_GUESSES): Outcome {
    if (guesses.length && guesses[guesses.length - 1].toLowerCase() === answer.toLowerCase()) return "won";
    if (guesses.length >= max) return "lost";
    return "playing";
}

// Seeded shuffle: mulberry32 on an integer seed. Pure integer maths, so every platform agrees.
function rngFor(seed: number) {
    let s = seed | 0;
    return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function permutationFor(cycle: number): string[] {
    const rand = rngFor(Math.imul(cycle + 1, 0x9e3779b1) ^ 0x5157a7a);
    const a = [...ANSWERS];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

let cached: { cycle: number; list: string[] } | null = null;

/**
 * The daily answer for a day index (days since STRATA_EPOCH; 0 is the epoch day).
 * Each cycle through ANSWERS is one fixed permutation, so a word appears once per cycle.
 */
export function dailyAnswer(index: number): string {
    const n = ANSWERS.length;
    const cycle = Math.floor(index / n);
    const pos = index - cycle * n;
    if (!cached || cached.cycle !== cycle) cached = { cycle, list: permutationFor(cycle) };
    return cached.list[pos];
}

/** A word from any random source in [0, 1). Unlimited mode passes Math.random. */
export function randomAnswer(rng: () => number, list: readonly string[] = ANSWERS): string {
    const i = Math.min(list.length - 1, Math.floor(rng() * list.length));
    return list[i];
}

/** Best mark seen for each letter across the guesses so far, for the on-screen keyboard. */
export function keyStates(rows: readonly { guess: string; marks: readonly Mark[] }[]): Record<string, Mark> {
    const rank: Record<Mark, number> = { absent: 1, present: 2, correct: 3 };
    const out: Record<string, Mark> = {};
    for (const row of rows) {
        row.guess.split("").forEach((ch, i) => {
            const m = row.marks[i];
            const prev = out[ch];
            if (!prev || rank[m] > rank[prev]) out[ch] = m;
        });
    }
    return out;
}

export const ANSWER_COUNT = ANSWERS.length;
export const GUESS_COUNT = ALLOWED.length;
