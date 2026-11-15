// The recipe picker lists every recipe a crafter runs, open ones first, with a rate and a plain lock reason.
// The hover note names the recipe a placed machine is making, or says none is set.
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const S = await import(resolve(root, "lib/automation/sim/index.ts"));
const { recipeTagAt } = await import(resolve(root, "lib/automation/sim/recipe-tag.ts"));
const CAT = S.DEFAULT_CATALOG;
const HUB = { x: 8, z: 5 };

function kilnWorld() {
    const world = S.createWorld({ width: 18, depth: 12, hub: HUB }, CAT);
    const k = S.place(world, "kiln", 5, 2, 0, CAT);
    assert.equal(k.ok, true, k.reason);
    return { world, id: k.id };
}

test("a new kiln lists its recipes with none selected and a rate for each", () => {
    const { world, id } = kilnWorld();
    const lib = S.hudData(world, CAT, id).selected.recipeLibrary;
    assert.ok(lib.length >= 2, "kiln lists at least its two base recipes");
    assert.ok(lib.every((e) => e.state !== "selected"), "nothing is selected on a new kiln");
    const iron = lib.find((e) => e.id === "r_iron_ingot");
    assert.equal(iron.state, "open");
    assert.equal(iron.outputs[0].resourceId, "iron_ingot");
    assert.equal(iron.inputs[0].resourceId, "iron_ore");
    assert.ok(iron.perMin > 0, "a rate per minute is given");
});

test("choosing a recipe marks it selected and the picker's rate matches the craft time", () => {
    const { world, id } = kilnWorld();
    const set = S.setRecipe(world, id, "r_iron_ingot", CAT);
    assert.equal(set.ok, true, set.reason);
    const lib = S.hudData(world, CAT, id).selected.recipeLibrary;
    const iron = lib.find((e) => e.id === "r_iron_ingot");
    assert.equal(iron.state, "selected");
    // One ingot every 2 s at speed 1 with no research bonus is 30 a minute.
    assert.equal(Math.round(iron.perMin * 1000) / 1000, 30);
});

test("open recipes sort before locked ones, and every locked recipe says why", () => {
    const locked = [];
    for (const type of ["kiln", "furnace", "press", "lathe", "drawer"]) {
        const world = S.createWorld({ width: 18, depth: 12, hub: HUB }, CAT);
        const p = S.place(world, type, 4, 4, 0, CAT);
        if (!p.ok) continue;
        const lib = S.hudData(world, CAT, p.id).selected.recipeLibrary ?? [];
        const firstLocked = lib.findIndex((e) => e.state === "locked");
        if (firstLocked >= 0) assert.ok(lib.slice(firstLocked).every((e) => e.state === "locked"), `${type}: locked recipes come last`);
        locked.push(...lib.filter((e) => e.state === "locked"));
    }
    assert.ok(locked.length > 0, "at least one recipe is shut at the start, so the picker has something to explain");
    for (const e of locked) assert.ok(typeof e.lockReason === "string" && e.lockReason.length > 0, `${e.id} has a reason`);
});

test("the hover note names the recipe a crafter makes, and says so when none is set", () => {
    const { world, id } = kilnWorld();
    const b = world.buildings[id];
    assert.equal(recipeTagAt(world, b.x, b.z, CAT), "No recipe set. Not running");
    S.setRecipe(world, id, "r_iron_ingot", CAT);
    assert.equal(recipeTagAt(world, b.x, b.z, CAT), "Making Iron ingot, 2 s a craft");
});

test("the hover note is empty on bare ground and for belts", () => {
    const world = S.createWorld({ width: 18, depth: 12, hub: HUB }, CAT);
    assert.equal(recipeTagAt(world, 1, 1, CAT), null);
    const belt = S.place(world, "belt", 6, 5, 3, CAT);
    assert.equal(belt.ok, true, belt.reason);
    assert.equal(recipeTagAt(world, 6, 5, CAT), null);
});
