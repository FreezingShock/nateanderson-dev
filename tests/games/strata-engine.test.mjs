// Strata engine: scoring with duplicate letters, the daily word schedule, guess validation, keyboard state, outcome.
// Pure engine (lib/strata/engine.ts), so it runs under node. Run with npm run test:nodefarm.
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

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
});

const E = await import(pathToFileURL(resolve(root, "lib/strata/engine.ts")).href);
const W = await import(pathToFileURL(resolve(root, "lib/strata/words.ts")).href);

const C = "correct";
const P = "present";
const A = "absent";

test("scoring: all correct and all absent", () => {
  assert.deepEqual(E.scoreGuess("crane", "crane"), [C, C, C, C, C]);
  assert.deepEqual(E.scoreGuess("pilot", "crane"), [A, A, A, A, A]);
});

test("scoring: right letter in the wrong place is present, in the right place is correct", () => {
  assert.deepEqual(E.scoreGuess("cater", "crane"), [C, P, A, P, P]);
});

test("scoring: a guess with two Es against an answer with two Es (speed vs erase)", () => {
  assert.deepEqual(E.scoreGuess("speed", "erase"), [P, A, P, P, A]);
});

test("scoring: the reverse, erase against speed", () => {
  assert.deepEqual(E.scoreGuess("erase", "speed"), [P, A, A, P, P]);
});

test("scoring: an exact match takes the copy, so the second E is correct (allee vs erase)", () => {
  assert.deepEqual(E.scoreGuess("allee", "erase"), [P, A, A, P, C]);
});

test("scoring: an extra copy of a letter in the guess is absent (speed vs abide)", () => {
  assert.deepEqual(E.scoreGuess("speed", "abide"), [A, A, P, A, P]);
});

test("scoring: letters match case-insensitively", () => {
  assert.deepEqual(E.scoreGuess("SPEED", "erase"), E.scoreGuess("speed", "erase"));
});

test("checkGuess rejects short, non-letter and unknown words, and accepts an allowed word in any case", () => {
  assert.deepEqual(E.checkGuess("spee"), { ok: false, reason: "short" });
  assert.deepEqual(E.checkGuess("sp3ed"), { ok: false, reason: "letters" });
  assert.deepEqual(E.checkGuess("zzzzz"), { ok: false, reason: "unknown" });
  assert.deepEqual(E.checkGuess("speed"), { ok: true });
  assert.deepEqual(E.checkGuess("SPEED"), { ok: true });
});

test("every answer is a valid guess", () => {
  for (const w of W.ANSWERS) assert.equal(E.checkGuess(w).ok, true, w);
});

test("daily word is deterministic for a day index (pinned values, same on every device)", () => {
  assert.equal(E.dailyAnswer(0), "until");
  assert.equal(E.dailyAnswer(1), "apple");
  assert.equal(E.dailyAnswer(2), "virus");
  assert.equal(E.dailyAnswer(500), "realm");
  assert.equal(E.dailyAnswer(E.ANSWER_COUNT), "zebra");
});

test("daily word is always an answer", () => {
  const answers = new Set(W.ANSWERS);
  for (let i = -5; i < 300; i++) assert.ok(answers.has(E.dailyAnswer(i)), `day ${i}`);
});

test("no daily word repeats within one cycle through the answer list", () => {
  const n = E.ANSWER_COUNT;
  for (const cycle of [0, 1, 2]) {
    const seen = new Set();
    for (let i = 0; i < n; i++) seen.add(E.dailyAnswer(cycle * n + i));
    assert.equal(seen.size, n, `cycle ${cycle} repeats a word`);
  }
});

test("the cycle covers the whole answer list (a permutation, not a sample)", () => {
  const seen = new Set();
  for (let i = 0; i < E.ANSWER_COUNT; i++) seen.add(E.dailyAnswer(i));
  assert.deepEqual([...seen].sort(), [...W.ANSWERS].sort());
});

test("negative day indexes fall in the previous cycle and stay answers", () => {
  assert.ok(W.ANSWERS.includes(E.dailyAnswer(-1)));
  assert.equal(E.dailyAnswer(-1), E.dailyAnswer(-1));
});

test("randomAnswer picks deterministically from a given random source", () => {
  assert.equal(E.randomAnswer(() => 0), W.ANSWERS[0]);
  assert.equal(E.randomAnswer(() => 0.999999), W.ANSWERS[W.ANSWERS.length - 1]);
});

test("keyStates keeps the strongest mark for each letter", () => {
  const rows = [
    { guess: "speed", marks: E.scoreGuess("speed", "erase") },
    { guess: "allee", marks: E.scoreGuess("allee", "erase") },
  ];
  const k = E.keyStates(rows);
  assert.equal(k.e, C);
  assert.equal(k.s, P);
  assert.equal(k.p, A);
  assert.equal(k.l, A);
  assert.equal(k.z, undefined);
});

test("outcome: won on the answer, lost after six misses, otherwise playing", () => {
  assert.equal(E.outcome(["crane"], "crane"), "won");
  assert.equal(E.outcome(["pilot"], "crane"), "playing");
  const six = ["pilot", "mound", "tiger", "glass", "north", "stove"];
  assert.equal(E.outcome(six, "crane"), "lost");
  assert.equal(E.outcome(six.slice(0, 5), "crane"), "playing");
});

test("the epoch and limits are fixed constants", () => {
  assert.equal(E.WORD_LENGTH, 5);
  assert.equal(E.MAX_GUESSES, 6);
  assert.equal(E.STRATA_EPOCH, "2026-11-17");
});
