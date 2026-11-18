// Strata's live save: round trip, a bad round dropped without losing the rest, damaged and newer saves kept, not wiped.
// Run with npm run test:nodefarm.
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

const { STRATA_SAVE } = await import(pathToFileURL(resolve(root, "lib/strata/save.ts")).href);
const { loadSave, writeSave } = await import(pathToFileURL(resolve(root, "lib/saves/core.ts")).href);
const { SAVE_SLOTS } = await import(pathToFileURL(resolve(root, "lib/saves/keys.ts")).href);

function memoryStore(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    _m: m,
  };
}

const key = SAVE_SLOTS.strata.key;

const round = { date: "2026-11-17", answer: "until", rows: ["crane", "pilot"] };
const state = { mode: "daily", daily: round, unlimited: null };

test("the slot is versioned and named like the other saves", () => {
  assert.equal(SAVE_SLOTS.strata.app, "strata");
  assert.equal(SAVE_SLOTS.strata.key, "strata-save-v1");
  assert.equal(SAVE_SLOTS.strata.version, 1);
});

test("a saved round loads back as it was", () => {
  const st = memoryStore();
  assert.ok(writeSave(st, STRATA_SAVE, state));
  const loaded = loadSave(st, STRATA_SAVE);
  assert.equal(loaded.status, "ok");
  assert.deepEqual(loaded.state, state);
});

test("nothing stored is a new game", () => {
  assert.equal(loadSave(memoryStore(), STRATA_SAVE).status, "new");
});

test("an unknown answer drops that round only; the other round and the mode still load", () => {
  const st = memoryStore();
  writeSave(st, STRATA_SAVE, { mode: "unlimited", daily: { date: "2026-11-17", answer: "zzzzz", rows: [] }, unlimited: { date: "", answer: "crane", rows: ["pilot"] } });
  const loaded = loadSave(st, STRATA_SAVE);
  assert.equal(loaded.status, "ok");
  assert.equal(loaded.state.daily, null);
  assert.equal(loaded.state.mode, "unlimited");
  assert.deepEqual(loaded.state.unlimited, { date: "", answer: "crane", rows: ["pilot"] });
});

test("a guess that is not on the allowed list is dropped with its round", () => {
  const st = memoryStore();
  writeSave(st, STRATA_SAVE, { mode: "daily", daily: { date: "2026-11-17", answer: "until", rows: ["zzzzz"] }, unlimited: null });
  assert.equal(loadSave(st, STRATA_SAVE).state.daily, null);
});

test("a damaged save is kept as a -corrupt copy, not wiped", () => {
  const st = memoryStore({ [key]: "{not json" });
  const loaded = loadSave(st, STRATA_SAVE);
  assert.equal(loaded.status, "lost");
  assert.equal(st._m.get(`${key}-corrupt`), "{not json");
});

test("a save from a newer version is refused and left in place", () => {
  const newer = JSON.stringify({ app: "strata", version: 9, savedAt: 0, data: state });
  const st = memoryStore({ [key]: newer });
  const loaded = loadSave(st, STRATA_SAVE);
  assert.equal(loaded.status, "lost");
  assert.equal(st._m.get(key), newer);
});
