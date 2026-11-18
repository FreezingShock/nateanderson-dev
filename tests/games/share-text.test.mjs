// Share text for a finished guesser round (lib/outline-game formatShareText). Run with npm run test:nodefarm.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// lib/outline-game.ts imports "@/..." and a JSON file; map the alias to the repo root and hand JSON over as a module.
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
const { formatShareText, MAX_GUESSES } = await import(pathToFileURL(resolve(root, "lib/outline-game.ts")).href);

const URL_OUTLINE = "https://nateanderson.dev/creations/games/outline-guesser";
const URL_FLAG = "https://nateanderson.dev/creations/games/flag-guesser";

test("daily won, streak 1: no streak line", () => {
  const text = formatShareText({
    game: "Outline Guesser",
    mode: "daily",
    puzzleNumber: 12,
    won: true,
    used: 3,
    max: MAX_GUESSES,
    streak: 1,
    url: URL_OUTLINE,
  });
  assert.equal(text, `Outline Guesser daily #12 - 3/6 won\n${URL_OUTLINE}`);
});

test("daily won, streak above 1: streak line between result and URL", () => {
  const text = formatShareText({
    game: "Flag Guesser",
    mode: "daily",
    puzzleNumber: 40,
    won: true,
    used: 1,
    max: 6,
    streak: 4,
    url: URL_FLAG,
  });
  assert.equal(text, `Flag Guesser daily #40 - 1/6 won\nStreak 4\n${URL_FLAG}`);
});

test("daily lost: missed, and no streak line even if a stale streak is passed", () => {
  const text = formatShareText({
    game: "Outline Guesser",
    mode: "daily",
    puzzleNumber: 7,
    won: false,
    used: 6,
    max: 6,
    streak: 0,
    url: URL_OUTLINE,
  });
  assert.equal(text, `Outline Guesser daily #7 - missed\n${URL_OUTLINE}`);
  const stale = formatShareText({
    game: "Flag Guesser",
    mode: "daily",
    puzzleNumber: 7,
    won: false,
    used: 6,
    max: 6,
    streak: 5,
    url: URL_FLAG,
  });
  assert.equal(stale, `Flag Guesser daily #7 - missed\n${URL_FLAG}`);
});

test("unlimited won, streak 1: no streak line, no puzzle number", () => {
  const text = formatShareText({
    game: "Flag Guesser",
    mode: "unlimited",
    won: true,
    used: 5,
    max: 6,
    streak: 1,
    url: URL_FLAG,
  });
  assert.equal(text, `Flag Guesser unlimited - 5/6 won\n${URL_FLAG}`);
});

test("unlimited won, streak above 1: streak line", () => {
  const text = formatShareText({
    game: "Outline Guesser",
    mode: "unlimited",
    won: true,
    used: 2,
    max: 6,
    streak: 9,
    url: URL_OUTLINE,
  });
  assert.equal(text, `Outline Guesser unlimited - 2/6 won\nStreak 9\n${URL_OUTLINE}`);
});

test("unlimited lost: missed", () => {
  const text = formatShareText({
    game: "Outline Guesser",
    mode: "unlimited",
    won: false,
    used: 6,
    max: 6,
    streak: 0,
    url: URL_OUTLINE,
  });
  assert.equal(text, `Outline Guesser unlimited - missed\n${URL_OUTLINE}`);
});

test("share text has no emoji, no trailing newline, and only the URL as its last line", () => {
  const cases = [
    { game: "Flag Guesser", mode: "daily", puzzleNumber: 3, won: true, used: 2, max: 6, streak: 2, url: URL_FLAG },
    { game: "Outline Guesser", mode: "unlimited", won: false, used: 6, max: 6, streak: 0, url: URL_OUTLINE },
  ];
  for (const c of cases) {
    const text = formatShareText(c);
    assert.doesNotMatch(text, /\p{Extended_Pictographic}/u, text);
    assert.equal(text.endsWith("\n"), false);
    assert.equal(text.split("\n").at(-1), c.url);
  }
});
