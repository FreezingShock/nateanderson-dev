// Strata word lists: length, letters, duplicates, and that every answer is an allowed guess. Run with npm run test:nodefarm.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

const { ALLOWED, ANSWERS, GUESS_ONLY } = await import(pathToFileURL(resolve(root, "lib/strata/words.ts")).href);

test("answers are five lowercase a-z letters", () => {
  for (const w of ANSWERS) assert.match(w, /^[a-z]{5}$/, `bad answer: ${w}`);
});

test("guess-only words are five lowercase a-z letters", () => {
  for (const w of GUESS_ONLY) assert.match(w, /^[a-z]{5}$/, `bad guess: ${w}`);
});

test("no word appears twice in the allowed list (answers and guesses together)", () => {
  const seen = new Set();
  const dupes = [];
  for (const w of ALLOWED) {
    if (seen.has(w)) dupes.push(w);
    seen.add(w);
  }
  assert.deepEqual(dupes, []);
});

test("every answer is an allowed guess", () => {
  const allowed = new Set(ALLOWED);
  const missing = ANSWERS.filter((w) => !allowed.has(w));
  assert.deepEqual(missing, []);
});

test("list sizes: at least 800 answers and 3000 allowed guesses", () => {
  assert.ok(ANSWERS.length >= 800, `answers: ${ANSWERS.length}`);
  assert.ok(ALLOWED.length >= 3000, `allowed: ${ALLOWED.length}`);
});

test("the word list file has no leftover third-party or placeholder markers", () => {
  const src = readFileSync(resolve(root, "lib/strata/words.ts"), "utf8");
  assert.doesNotMatch(src, /wordle/i);
  assert.doesNotMatch(src, /TODO|lorem/i);
});
