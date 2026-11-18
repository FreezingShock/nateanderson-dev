// Golden save: tests/automation/fixtures/save-v1.json was written by SAVE_VERSION 1 after 90 simulated seconds of the opening
// (drill, kiln, windmill, belts). A change to World that breaks old saves fails here. If you must change the save format,
// bump SAVE_VERSION, keep this file, and add a migration so it still loads.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const S = await import(pathToFileURL(resolve(root, "lib/automation/sim/index.ts")).href);
const CAT = S.DEFAULT_CATALOG;
const text = readFileSync(resolve(root, "tests/automation/fixtures/save-v1.json"), "utf8");

test("the v1 golden save still loads with its buildings, deposits and progress", () => {
    const w = S.deserialize(text);
    assert.equal(JSON.parse(text).version, 1);
    assert.equal(Object.keys(w.buildings).length, 9);
    assert.ok(w.buildings[w.hubId].input.iron_ingot > 0, "hub stock came through");
    assert.ok(Object.keys(w.deposits).length >= 5, "deposits came through");
    assert.ok(w.time > 80, "clock came through");
});

test("the v1 golden save keeps playing for 60 simulated seconds without NaN or negative stock", () => {
    const w = S.deserialize(text);
    const hub = w.buildings[w.hubId];
    const before = hub.input.iron_ingot ?? 0;
    S.advance(w, 60, 0.1, CAT);
    assert.ok((hub.input.iron_ingot ?? 0) > before, "the old save still delivers ingots to the hub");
    for (const b of Object.values(w.buildings)) {
        for (const v of [...Object.values(b.input), ...Object.values(b.output)]) assert.ok(Number.isFinite(v) && v >= 0, `building ${b.id} holds a valid count`);
    }
    assert.ok(Number.isFinite(w.time) && w.time > 140);
});

test("the golden save round-trips through serialize and gives HUD data in a known shape", () => {
    const w = S.deserialize(text);
    const again = S.deserialize(S.serialize(w));
    assert.deepEqual(Object.keys(again.buildings), Object.keys(w.buildings));
    const hud = S.hudData(w, CAT);
    for (const k of ["resources", "machines", "milestones", "hub", "research", "stats", "nextStep"]) assert.ok(k in hud, `hud has ${k}`);
    assert.ok(JSON.stringify(hud).indexOf("NaN") < 0 && !JSON.stringify(hud).includes("null,null"), "hud has no NaN");
});
