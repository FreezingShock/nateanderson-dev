// Ledger: a daily number puzzle. Pure (no React), so the tests run it under node.
//
// Six whole numbers go on the tape: four small (1 to 10) and two large (25, 50, 75, 100). A target from 101 to 999 is
// shown. Combine tiles with + - x / until a tile reaches the target. Division only when it divides exactly, every
// result stays a positive whole number, and each given number is used at most once. Up to six submissions per round;
// each one reports how far it is off, and the best result so far is what the player sees.
//
// A tile's id is fixed by its place in the round: the six given numbers are ids 0 to 5, and step k makes tile 6 + k.
// Undo removes the last step, so the ids of the steps before it never change.
import { dayNumber } from "../outline-game";

export const LEDGER_EPOCH = "2026-11-17";
export const GIVEN_COUNT = 6;
export const MAX_SUBMISSIONS = 6;
export const TARGET_MIN = 101;
export const TARGET_MAX = 999;
export const SMALL_MAX = 10;
export const LARGE_NUMBERS = [25, 50, 75, 100] as const;
export const OPS = ["+", "-", "*", "/"] as const;
export type Op = (typeof OPS)[number];
/** How an operator is written on the tape. */
export const OP_SIGN: Record<Op, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };
export const OP_WORD: Record<Op, string> = { "+": "Add", "-": "Subtract", "*": "Multiply", "/": "Divide" };

export interface Puzzle {
    numbers: number[];
    target: number;
}
export interface Step {
    /** Tile id on the left of the operator. */
    a: number;
    op: Op;
    /** Tile id on the right of the operator. */
    b: number;
}
export interface Submission {
    tile: number;
    value: number;
    off: number;
}
export type RoundStatus = "playing" | "won" | "lost";
export interface Round {
    puzzle: Puzzle;
    steps: Step[];
    submissions: Submission[];
    status: RoundStatus;
}

export type Reason =
    | "unknown-tile"
    | "same-tile"
    | "bad-op"
    | "not-whole"
    | "not-positive"
    | "round-over"
    | "nothing-to-undo"
    | "nothing-to-clear"
    | "duplicate"
    | "damaged";
export interface Fail {
    ok: false;
    reason: Reason;
    message: string;
}
export interface Ok {
    ok: true;
    value: number;
    message: string;
}
export type Outcome = { ok: true; round: Round; message: string } | Fail;

const fail = (reason: Reason, message: string): Fail => ({ ok: false, reason, message });

// ---- Arithmetic ----

/** One operation on two positive whole numbers. Fails unless the result is a positive whole number. */
export function combine(a: number, op: Op, b: number): Ok | Fail {
    switch (op) {
        case "+":
            return { ok: true, value: a + b, message: `${a} + ${b} = ${a + b}` };
        case "*":
            return { ok: true, value: a * b, message: `${a} × ${b} = ${a * b}` };
        case "-":
            if (a - b <= 0) {
                return fail("not-positive", `${a} − ${b} is not above zero. Tap the larger number first.`);
            }
            return { ok: true, value: a - b, message: `${a} − ${b} = ${a - b}` };
        case "/":
            if (b === 0 || a % b !== 0) {
                return fail("not-whole", `${a} ÷ ${b} is not a whole number.`);
            }
            return { ok: true, value: a / b, message: `${a} ÷ ${b} = ${a / b}` };
        default:
            return fail("bad-op", "Pick + , − , × or ÷.");
    }
}

// ---- Tape ----

export function newRound(puzzle: Puzzle): Round {
    return { puzzle, steps: [], submissions: [], status: "playing" };
}

export interface Tape {
    /** Value of every tile ever made, indexed by tile id. */
    values: number[];
    /** Tile ids still on the tape, in tape order (remaining given numbers, then step results). */
    available: number[];
    /** One line per step, e.g. "25 + 3 = 28". */
    lines: string[];
}

/** Replays a step list from a fresh round. Fails on the first illegal step. */
export function tapeOf(puzzle: Puzzle, steps: Step[]): { ok: true; tape: Tape } | Fail {
    const values = [...puzzle.numbers];
    let available = values.map((_, i) => i);
    const lines: string[] = [];
    for (const step of steps) {
        if (!available.includes(step.a) || !available.includes(step.b)) {
            return fail("unknown-tile", "A step uses a number that is not on the tape.");
        }
        if (step.a === step.b) return fail("same-tile", "A step uses the same number twice.");
        const r = combine(values[step.a], step.op, values[step.b]);
        if (!r.ok) return r;
        values.push(r.value);
        lines.push(r.message);
        available = available.filter((id) => id !== step.a && id !== step.b).concat(values.length - 1);
    }
    return { ok: true, tape: { values, available, lines } };
}

/** Evaluates a whole step list against a puzzle. Returns the final tiles, or the first illegal step. */
export function evaluateSteps(puzzle: Puzzle, steps: Step[]) {
    return tapeOf(puzzle, steps);
}

/** Adds one step to a round, if it is legal. The step's result becomes a new tile on the tape. */
export function applyStep(round: Round, step: Step): Outcome {
    if (round.status !== "playing") return fail("round-over", "This round is over. Start a new one.");
    const t = tapeOf(round.puzzle, round.steps);
    if (!t.ok) return t;
    const { values, available } = t.tape;
    if (!available.includes(step.a) || !available.includes(step.b)) {
        return fail("unknown-tile", "That number is already used. Pick one still on the tape.");
    }
    if (step.a === step.b) return fail("same-tile", "Pick two different numbers.");
    if (!OPS.includes(step.op)) return fail("bad-op", "Pick + , − , × or ÷.");
    const r = combine(values[step.a], step.op, values[step.b]);
    if (!r.ok) return r;
    return {
        ok: true,
        round: { ...round, steps: [...round.steps, step] },
        message: `${r.message}. New tile ${r.value} on the tape.`,
    };
}

export function undo(round: Round): Outcome {
    if (round.status !== "playing") return fail("round-over", "This round is over. Start a new one.");
    const last = round.steps[round.steps.length - 1];
    if (!last) return fail("nothing-to-undo", "Nothing to undo.");
    const t = tapeOf(round.puzzle, round.steps);
    const line = t.ok ? t.tape.lines[round.steps.length - 1] : "last step";
    return { ok: true, round: { ...round, steps: round.steps.slice(0, -1) }, message: `Undid ${line}.` };
}

export function clearTape(round: Round): Outcome {
    if (round.status !== "playing") return fail("round-over", "This round is over. Start a new one.");
    if (round.steps.length === 0) return fail("nothing-to-clear", "The tape is already clear.");
    return { ok: true, round: { ...round, steps: [] }, message: "Tape cleared. The six numbers are back." };
}

/** Submits a tile on the tape as the answer. Each submission counts once; the round ends on exact or after six. */
export function submit(round: Round, tile: number): Outcome {
    if (round.status !== "playing") return fail("round-over", "This round is over. Start a new one.");
    const t = tapeOf(round.puzzle, round.steps);
    if (!t.ok) return t;
    if (!t.tape.available.includes(tile)) {
        return fail("unknown-tile", "That number is already used. Pick one still on the tape.");
    }
    const value = t.tape.values[tile];
    if (round.submissions.some((s) => s.value === value)) {
        return fail("duplicate", `You already submitted ${value}.`);
    }
    const off = Math.abs(round.puzzle.target - value);
    const submissions = [...round.submissions, { tile, value, off }];
    const status: RoundStatus = off === 0 ? "won" : submissions.length >= MAX_SUBMISSIONS ? "lost" : "playing";
    const best = bestOff(submissions) as number;
    const message =
        off === 0
            ? `${value}. Exact. The ledger balances.`
            : status === "lost"
              ? `${value}. Off by ${off}. No entries left. Best was off by ${best}.`
              : `${value}. Off by ${off}. Best so far: off by ${best}.`;
    return { ok: true, round: { ...round, submissions, status }, message };
}

export function bestOff(submissions: Submission[]): number | null {
    if (submissions.length === 0) return null;
    return Math.min(...submissions.map((s) => s.off));
}

/** Points for a finished round. A win scores 60 on the first submission and 10 on the sixth; a loss scores 0. */
export function scoreRound(round: Round) {
    const won = round.status === "won";
    const used = round.submissions.length;
    return {
        won,
        used,
        bestOff: bestOff(round.submissions),
        points: won ? (MAX_SUBMISSIONS + 1 - used) * 10 : 0,
    };
}

/** Checks a round loaded from storage. Returns null when it cannot be a round this engine made. */
export function reviveRound(data: unknown): Round | null {
    if (!data || typeof data !== "object") return null;
    const d = data as Record<string, unknown>;
    const p = d.puzzle as Record<string, unknown> | undefined;
    if (!p || !Array.isArray(p.numbers) || p.numbers.length !== GIVEN_COUNT) return null;
    if (!p.numbers.every((n) => Number.isInteger(n) && n >= 1)) return null;
    if (!Number.isInteger(p.target)) return null;
    const puzzle: Puzzle = { numbers: p.numbers as number[], target: p.target as number };
    if (!Array.isArray(d.steps) || !Array.isArray(d.submissions)) return null;
    const steps = d.steps as Step[];
    const t = tapeOf(puzzle, steps);
    if (!t.ok) return null;
    const submissions: Submission[] = [];
    for (const s of d.submissions as Submission[]) {
        if (!s || !Number.isInteger(s.tile) || !t.tape.available.includes(s.tile)) return null;
        const value = t.tape.values[s.tile];
        if (s.value !== value) return null;
        submissions.push({ tile: s.tile, value, off: Math.abs(puzzle.target - value) });
    }
    const status: RoundStatus = submissions.some((s) => s.off === 0)
        ? "won"
        : submissions.length >= MAX_SUBMISSIONS
          ? "lost"
          : "playing";
    return { puzzle, steps, submissions, status };
}

// ---- Solver ----
//
// Every tile is a set of given numbers combined in some order. For each subset of the six numbers (a bit mask) the
// solver keeps every value that subset can make, with one way to make it. Two disjoint subsets combine into a new value
// with each operator. Every tile on any tape is one of these values, so the table is the full set of reachable targets.

type Link = { leaf: number } | { op: Op; ma: number; va: number; mb: number; vb: number };
export interface SolveTable {
    numbers: number[];
    maps: Map<number, Link>[];
}

/** combine() without the messages, for the solver's inner loop. 0 means the step is not legal. */
function fastOp(a: number, op: Op, b: number): number {
    if (op === "+") return a + b;
    if (op === "*") return a * b;
    if (op === "-") return a > b ? a - b : 0;
    return b !== 0 && a % b === 0 ? a / b : 0;
}

export function buildTable(numbers: number[]): SolveTable {
    const n = numbers.length;
    const maps: Map<number, Link>[] = Array.from({ length: 1 << n }, () => new Map<number, Link>());
    for (let i = 0; i < n; i++) maps[1 << i].set(numbers[i], { leaf: i });
    for (let mask = 1; mask < 1 << n; mask++) {
        if ((mask & (mask - 1)) === 0) continue;
        const out = maps[mask];
        // Every split of mask into two non-empty halves, in both orders (subtraction and division are not symmetric).
        for (let A = (mask - 1) & mask; A > 0; A = (A - 1) & mask) {
            const B = mask ^ A;
            const left = [...maps[A].keys()];
            const right = [...maps[B].keys()];
            for (const va of left) {
                for (const vb of right) {
                    for (const op of OPS) {
                        const v = fastOp(va, op, vb);
                        if (v > 0 && !out.has(v)) out.set(v, { op, ma: A, va, mb: B, vb });
                    }
                }
            }
        }
    }
    return { numbers, maps };
}

/** Every value any tape of these numbers can reach (the given numbers included). */
export function reachable(table: SolveTable): Set<number> {
    const all = new Set<number>();
    for (const m of table.maps) for (const v of m.keys()) all.add(v);
    return all;
}

function emit(table: SolveTable, mask: number, value: number, steps: Step[]): number {
    const link = table.maps[mask].get(value) as Link;
    if ("leaf" in link) return link.leaf;
    const a = emit(table, link.ma, link.va, steps);
    const b = emit(table, link.mb, link.vb, steps);
    steps.push({ a, op: link.op, b });
    return GIVEN_COUNT + steps.length - 1;
}

/** One step list that makes the target, using the fewest numbers, or null when the target is out of reach. */
export function findSolution(table: SolveTable, target: number): Step[] | null {
    const n = table.numbers.length;
    const masks = Array.from({ length: (1 << n) - 1 }, (_, i) => i + 1).sort(
        (x, y) => popcount(x) - popcount(y) || x - y
    );
    for (const mask of masks) {
        if (table.maps[mask].has(target)) {
            const steps: Step[] = [];
            emit(table, mask, target, steps);
            return steps;
        }
    }
    return null;
}

function popcount(x: number) {
    let c = 0;
    for (let v = x; v; v &= v - 1) c++;
    return c;
}

/** Solves one puzzle. Returns null when the target cannot be reached. */
export function solve(puzzle: Puzzle): Step[] | null {
    return findSolution(buildTable(puzzle.numbers), puzzle.target);
}

// ---- Generator ----

function mulberry32(seed: number) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const MAX_ATTEMPTS = 500;

export interface Generated {
    puzzle: Puzzle;
    /** One known solution, replayable with evaluateSteps. */
    solution: Step[];
}

/**
 * Draws numbers and a target from the seed, and keeps drawing until the target is reachable (reject and retry). Same seed,
 * same puzzle, always.
 */
export function generate(seed: number): Generated {
    const rand = mulberry32(seed);
    const pick = (n: number) => Math.floor(rand() * n);
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const numbers: number[] = [];
        for (let i = 0; i < GIVEN_COUNT - 2; i++) numbers.push(1 + pick(SMALL_MAX));
        const first = pick(LARGE_NUMBERS.length);
        let second = pick(LARGE_NUMBERS.length - 1);
        if (second >= first) second++;
        numbers.push(LARGE_NUMBERS[first], LARGE_NUMBERS[second]);
        for (let i = numbers.length - 1; i > 0; i--) {
            const j = pick(i + 1);
            [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
        }
        const target = TARGET_MIN + pick(TARGET_MAX - TARGET_MIN + 1);
        const solution = findSolution(buildTable(numbers), target);
        if (solution) return { puzzle: { numbers, target }, solution };
    }
    throw new Error(`Ledger: no reachable target found for seed ${seed}`);
}

/** Day index from the fixed epoch: 0 on LEDGER_EPOCH. Uses the Pacific calendar date (todayPT). */
export function dailyIndex(date: string): number {
    return dayNumber(date) - dayNumber(LEDGER_EPOCH);
}

/** Puzzle number shown to players: #1 is the epoch day. */
export const dailyNumber = (date: string) => dailyIndex(date) + 1;

/** The seed of a daily index. Fixed, so the same day gives the same puzzle for everyone. */
export function dailySeed(index: number): number {
    return (Math.imul(index + 1, 0x9e3779b1) ^ 0x51ed27) >>> 0;
}

export const dailyPuzzle = (date: string) => generate(dailySeed(dailyIndex(date)));

export const randomSeed = () => Math.floor(Math.random() * 4294967296);

// ---- Names and saves ----

/** The tape lines ("25 + 3 = 28") that a step list prints, for showing a worked answer. */
export function solutionLines(puzzle: Puzzle, steps: Step[]): string[] {
    const t = tapeOf(puzzle, steps);
    return t.ok ? t.tape.lines : [];
}
