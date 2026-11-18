// Machine detail data for the menus: drills show what they mine, crafters list their recipes before one is chosen,
// preview works for a machine type that is not placed yet, and blocked or idle machines give a plain reason.
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const S = await import(pathToFileURL(resolve(root, "lib/automation/sim/index.ts")).href);
const CAT = S.DEFAULT_CATALOG;

test("a placed drill reports what it mines and at what rate, not an empty recipe", () => {
    const w = S.createWorld({ width: 20, depth: 20, hub: { x: 8, z: 5 } }, CAT);
    S.addDeposit(w, 2, 2, "iron_ore", 2);
    const d = S.place(w, "drill", 2, 2, 0, CAT);
    assert.equal(d.ok, true, d.reason);
    S.advance(w, 1, 0.5, CAT); // power is read on a step, so run one before reading the status
    const detail = S.hudData(w, CAT, d.id).selected;
    assert.ok(detail.mines.length === 1 && detail.mines[0].resourceId === "iron_ore");
    assert.equal(detail.mines[0].purity, "pure");
    assert.ok(detail.mines[0].perMin > 0);
    assert.notEqual(detail.recipe.name, "No recipe");
    assert.match(detail.reason, /^No power/);
});

test("a crafter with no recipe lists its available recipes with inputs, outputs and time", () => {
    const w = S.createWorld({ width: 20, depth: 20, hub: { x: 8, z: 5 } }, CAT);
    const k = S.place(w, "kiln", 5, 2, 0, CAT);
    assert.equal(k.ok, true, k.reason);
    S.setRecipe(w, k.id, null, CAT);
    const detail = S.hudData(w, CAT, k.id).selected;
    assert.ok(detail.recipeChoices.length > 0);
    const iron = detail.recipeChoices.find((r) => r.id === "r_iron_ingot");
    assert.ok(iron, "iron ingot recipe is listed");
    assert.equal(iron.inputs[0].resourceId, "iron_ore");
    assert.equal(iron.outputs[0].resourceId, "iron_ingot");
    assert.equal(iron.seconds, 2);
    assert.equal(detail.reason, "No recipe chosen");
});

test("a machine type that is not placed yet has a preview with its name, cost and power", () => {
    const w = S.createWorld({ width: 20, depth: 20, hub: { x: 8, z: 5 } }, CAT);
    const p = S.previewMachine(w, CAT, "drill");
    assert.ok(p, "drill preview exists");
    assert.equal(p.name, "Drill");
    assert.ok(p.mines.length > 0, "drill preview lists what it can mine");
    assert.equal(typeof p.powerKw, "number");
    const k = S.previewMachine(w, CAT, "kiln");
    assert.ok(k.recipeChoices.length > 0, "kiln preview lists its recipes");
    assert.equal(S.previewMachine(w, CAT, "no-such-machine"), null);
});
