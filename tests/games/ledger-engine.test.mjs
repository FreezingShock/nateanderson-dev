// Ledger engine (lib/ledger/engine.ts): determinism, solvability of every daily, illegal moves, scoring, the solver and
// reviving a stored round. Run with npm run test:nodefarm.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// lib/ledger/engine.ts imports lib/outline-game.ts for the Pacific date helpers, which import "@/..." and a JSON file.
registerHooks({
    resolve(spec, ctx, next) {
        if (spec.startsWith("@/")) return next(pathToFileURL(resolve(root, spec.slice(2))).href, ctx);
        try {
            return next(spec, ctx);
        } catch (e) {
            if (spec.startsWith(".")) return next(spec + ".ts", ctx);
            throw e;
        }
    },
    load(url, ctx, next) {
        if (url.endsWith(".json")) {
            const source = `export default ${readFileSync(new URL(url), "utf8")};`;
            return { format: "module", source, shortCircuit: true };
        }
        return next(url, ctx);
    },
});
const E = await import(pathToFileURL(resolve(root, "lib/ledger/engine.ts")).href);

const LARGE = [25, 50, 75, 100];
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
/** The calendar date `n` days after the epoch, YYYY-MM-DD (UTC arithmetic, same as dayNumber). */
function dateAfterEpoch(n) {
    const [y, m, d] = E.LEDGER_EPOCH.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// ---- Determinism ----

test("the same seed always gives the same puzzle and solution", () => {
    for (const seed of [1, 42, 2026, 987654321]) {
        const a = E.generate(seed);
        const b = E.generate(seed);
        assert.deepEqual(a, b, `seed ${seed}`);
    }
});

test("the daily puzzle for a date is the same every time it is asked for", () => {
    const first = E.dailyPuzzle("2026-12-01");
    const again = E.dailyPuzzle("2026-12-01");
    assert.deepEqual(first, again);
    assert.equal(E.dailyNumber("2026-11-17"), 1, "the epoch day is #1");
    assert.equal(E.dailyNumber("2026-11-18"), 2);
});

test("neighbouring days get different puzzles", () => {
    const seen = new Set();
    for (let i = 0; i < 30; i++) seen.add(JSON.stringify(E.dailyPuzzle(dateAfterEpoch(i)).puzzle));
    assert.ok(seen.size >= 28, `expected almost all of 30 days to differ, got ${seen.size}`);
});

// ---- Shape of every puzzle ----

test("every puzzle has four small numbers, two large ones and a target from 101 to 999", () => {
    for (let i = 0; i < 40; i++) {
        const { puzzle } = E.generate(1000 + i);
        const { numbers, target } = puzzle;
        assert.equal(numbers.length, 6);
        const small = numbers.filter((n) => n <= 10);
        const large = numbers.filter((n) => n > 10);
        assert.equal(small.length, 4, JSON.stringify(numbers));
        assert.equal(large.length, 2, JSON.stringify(numbers));
        assert.ok(small.every((n) => Number.isInteger(n) && n >= 1 && n <= 10));
        assert.ok(large.every((n) => LARGE.includes(n)));
        assert.ok(large[0] !== large[1], "the two large numbers are different");
        assert.ok(Number.isInteger(target) && target >= 101 && target <= 999, `target ${target}`);
    }
});

// ---- Solvability ----

test("every one of 365 consecutive daily puzzles is solvable, and the stored solution replays to the target", () => {
    const started = Date.now();
    for (let i = 0; i < 365; i++) {
        const date = dateAfterEpoch(i);
        assert.ok(isDate(date));
        const { puzzle, solution } = E.generate(E.dailySeed(i));
        assert.deepEqual(puzzle, E.dailyPuzzle(date).puzzle, `day ${i} is the daily for its date`);
        const check = E.evaluateSteps(puzzle, solution);
        assert.ok(check.ok, `day ${i} solution is legal: ${check.ok ? "" : check.message}`);
        assert.ok(check.tape.values.includes(puzzle.target), `day ${i} reaches ${puzzle.target}`);
    }
    console.log(`  365 dailies generated and checked in ${Date.now() - started} ms`);
});

test("the solver finds the target for an arbitrary puzzle and the answer replays exactly", () => {
    const puzzle = { numbers: [3, 6, 25, 50, 75, 100], target: 952 }; // 100 + 75 ... any reachable target works
    const steps = E.solve(puzzle);
    assert.ok(steps, "952 is reachable from 3 6 25 50 75 100");
    const check = E.evaluateSteps(puzzle, steps);
    assert.ok(check.ok);
    assert.ok(check.tape.values.includes(952));
});

test("an unreachable target is reported as null, not guessed", () => {
    // Six ones can make at most 6 (1 + 1 + ... ), so 999 is out of reach.
    assert.equal(E.solve({ numbers: [1, 1, 1, 1, 1, 1], target: 999 }), null);
});

// ---- Illegal moves ----

const P = { numbers: [7, 2, 3, 4, 25, 100], target: 500 };

test("a division that does not divide exactly is rejected", () => {
    const r = E.applyStep(E.newRound(P), { a: 0, op: "/", b: 1 }); // 7 / 2
    assert.equal(r.ok, false);
    assert.equal(r.reason, "not-whole");
    assert.match(r.message, /not a whole number/);
});

test("a result that is not above zero is rejected", () => {
    const r = E.applyStep(E.newRound(P), { a: 1, op: "-", b: 0 }); // 2 - 7
    assert.equal(r.ok, false);
    assert.equal(r.reason, "not-positive");
    const same = E.applyStep(E.newRound(P), { a: 0, op: "-", b: 0 });
    assert.equal(same.reason, "same-tile");
});

test("reusing a number that is already on a step is rejected", () => {
    let round = E.newRound(P);
    const first = E.applyStep(round, { a: 0, op: "+", b: 1 }); // 7 + 2 = 9, uses tiles 0 and 1
    assert.equal(first.ok, true);
    round = first.round;
    const again = E.applyStep(round, { a: 0, op: "*", b: 2 }); // tile 0 is gone
    assert.equal(again.ok, false);
    assert.equal(again.reason, "unknown-tile");
});

test("a step with a tile that never existed is rejected", () => {
    const r = E.applyStep(E.newRound(P), { a: 0, op: "+", b: 9 });
    assert.equal(r.reason, "unknown-tile");
});

test("a legal step puts its result on the tape and removes the two used tiles", () => {
    const r = E.applyStep(E.newRound(P), { a: 4, op: "*", b: 3 }); // 25 x 4 = 100
    assert.equal(r.ok, true);
    assert.equal(r.message, "25 × 4 = 100. New tile 100 on the tape.");
    const t = E.tapeOf(P, r.round.steps);
    assert.ok(t.ok);
    assert.deepEqual(t.tape.available, [0, 1, 2, 5, 6]);
    assert.equal(t.tape.values[6], 100);
});

test("undo removes the last step and clear removes them all", () => {
    let round = E.newRound(P);
    round = E.applyStep(round, { a: 0, op: "+", b: 1 }).round; // 9 (tile 6)
    round = E.applyStep(round, { a: 6, op: "*", b: 2 }).round; // 27 (tile 7)
    const back = E.undo(round);
    assert.equal(back.ok, true);
    assert.equal(back.round.steps.length, 1);
    const cleared = E.clearTape(back.round);
    assert.equal(cleared.round.steps.length, 0);
    assert.equal(E.undo(E.newRound(P)).reason, "nothing-to-undo");
    assert.equal(E.clearTape(E.newRound(P)).reason, "nothing-to-clear");
});

test("a finished round takes no more steps or submissions", () => {
    const won = { ...E.newRound(P), status: "won" };
    assert.equal(E.applyStep(won, { a: 0, op: "+", b: 1 }).reason, "round-over");
    assert.equal(E.submit(won, 0).reason, "round-over");
    assert.equal(E.undo(won).reason, "round-over");
});

// ---- Submissions and scoring ----

test("submissions report how far off they are, and an exact one wins the round", () => {
    // Target 28: 7 x 2 = 14 (tile 6), then 14 + 4 = 18 (tile 7), then 18 + 10 would need a 10 we do not have, so use 25 + 3.
    const P28 = { numbers: [7, 2, 3, 4, 25, 100], target: 28 };
    const far = E.submit(E.newRound(P28), 0); // 7
    assert.equal(far.ok, true);
    assert.equal(far.round.submissions[0].off, 21);
    assert.equal(far.round.status, "playing");
    assert.match(far.message, /Off by 21/);
    // 25 + 3 = 28 exactly (tiles 4 and 2), submitted as tile 6.
    let round = E.applyStep(E.newRound(P28), { a: 4, op: "+", b: 2 }).round;
    const hit = E.submit(round, 6);
    assert.equal(hit.ok, true);
    assert.equal(hit.round.status, "won");
    assert.equal(hit.round.submissions[0].off, 0);
    assert.match(hit.message, /Exact/);
    // A near miss does not end the round.
    round = E.applyStep(E.newRound(P28), { a: 0, op: "*", b: 1 }).round; // 14 (tile 6)
    const near = E.submit(round, 6);
    assert.equal(near.round.status, "playing");
    assert.equal(near.round.submissions[0].off, 14);
});

test("a submission that is already in the list is refused without using a slot", () => {
    const round = E.newRound({ numbers: [7, 2, 3, 4, 25, 100], target: 500 });
    const first = E.submit(round, 0).round;
    const dup = E.submit(first, 0);
    assert.equal(dup.ok, false);
    assert.equal(dup.reason, "duplicate");
});

test("six misses lose the round and show the best result", () => {
    let round = E.newRound({ numbers: [1, 2, 3, 4, 25, 100], target: 500 });
    const values = [1, 2, 3, 4, 25, 100];
    for (let i = 0; i < 6; i++) {
        const out = E.submit(round, i);
        assert.equal(out.ok, true);
        round = out.round;
    }
    assert.equal(round.status, "lost");
    assert.equal(E.scoreRound(round).bestOff, 500 - 100);
    assert.equal(E.scoreRound(round).points, 0);
    assert.deepEqual(round.submissions.map((s) => s.value), values);
});

test("scoring: an exact result scores more the sooner it comes", () => {
    const base = { puzzle: { numbers: [1, 2, 3, 4, 25, 100], target: 100 }, steps: [], status: "won" };
    const first = { ...base, submissions: [{ tile: 5, value: 100, off: 0 }] };
    const sixth = {
        ...base,
        submissions: [
            { tile: 0, value: 1, off: 99 },
            { tile: 1, value: 2, off: 98 },
            { tile: 2, value: 3, off: 97 },
            { tile: 3, value: 4, off: 96 },
            { tile: 4, value: 25, off: 75 },
            { tile: 5, value: 100, off: 0 },
        ],
    };
    assert.equal(E.scoreRound(first).points, 60);
    assert.equal(E.scoreRound(sixth).points, 10);
    assert.equal(E.scoreRound(sixth).used, 6);
    assert.equal(E.scoreRound({ ...base, status: "lost", submissions: [] }).points, 0);
    assert.equal(E.bestOff([]), null);
    assert.equal(E.bestOff([{ off: 5 }, { off: 2 }, { off: 9 }]), 2);
});

// ---- Stored rounds ----

test("a stored round revives when it replays, and is refused when it was edited", () => {
    const { puzzle, solution } = E.generate(E.dailySeed(3));
    const round = { ...E.newRound(puzzle), steps: solution.slice(0, 1) };
    const back = E.reviveRound(JSON.parse(JSON.stringify(round)));
    assert.deepEqual(back, round);
    const edited = JSON.parse(JSON.stringify(round));
    edited.steps = [{ a: 0, op: "/", b: 0 }];
    assert.equal(E.reviveRound(edited), null);
    const badSub = { ...round, submissions: [{ tile: 0, value: 999, off: 0 }] };
    assert.equal(E.reviveRound(badSub), null);
    assert.equal(E.reviveRound(null), null);
});
