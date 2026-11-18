// Countdown clock shared by the Outline and Flag Guessers (lib/outline-game formatCountdown). Run with npm run test:nodefarm.
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
const { formatCountdown } = await import(pathToFileURL(resolve(root, "lib/outline-game.ts")).href);

// The inline formatter both guessers shipped before the shared hook (copied verbatim, so drift shows up here).
const oldFmtCountdown = (n) =>
  [Math.floor(n / 3600), Math.floor((n % 3600) / 60), n % 60]
    .map((x) => String(x).padStart(2, "0"))
    .join(":");

test("formatCountdown matches the inline formatter for every second of a day", () => {
  for (let n = 0; n <= 86_400; n++) assert.equal(formatCountdown(n), oldFmtCountdown(n), `n=${n}`);
});

test("formatCountdown pads each part to two digits", () => {
  assert.equal(formatCountdown(0), "00:00:00");
  assert.equal(formatCountdown(5), "00:00:05");
  assert.equal(formatCountdown(59), "00:00:59");
  assert.equal(formatCountdown(60), "00:01:00");
  assert.equal(formatCountdown(3599), "00:59:59");
  assert.equal(formatCountdown(3600), "01:00:00");
  assert.equal(formatCountdown(86_399), "23:59:59");
});
