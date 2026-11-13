// Brasswork recipe tree: the data is solvable, research is payable, and the solver gives known ratios.
import test from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { RECIPE_TREE, PURITY } = await import(resolve(root, "lib/automation/data/tree.ts"));
const { checkTree, solve } = await import(resolve(root, "lib/automation/data/analyze.ts"));

test("the tree has no errors", () => {
    const errors = checkTree(RECIPE_TREE).filter((i) => i.level === "error");
    assert.deepEqual(errors, []);
});

test("every megaproject part solves down to raw resources with positive machine counts", () => {
    for (const part of RECIPE_TREE.items.filter((i) => i.kind === "megaproject")) {
        const res = solve(RECIPE_TREE, { [part.id]: 1 });
        assert.ok(Object.keys(res.raw).length > 0, `${part.id} needs raw`);
        for (const v of Object.values(res.machineTotals)) assert.ok(v > 0);
        for (const v of Object.values(res.raw)) assert.ok(v > 0);
    }
});

test("known ratio: 40 iron plate per min is one stamp press (3 ingot to 2 plate, 3 s)", () => {
    const res = solve(RECIPE_TREE, { iron_plate: 40 });
    assert.equal(res.machineTotals.press, 1);
    assert.equal(res.raw.iron_ore, 60);
});

test("purity multipliers are the documented values", () => {
    assert.deepEqual(PURITY, { impure: 0.5, normal: 1, pure: 2 });
});

const { baseRecipes, alternateIds, generatorsFor } = await import(resolve(root, "lib/automation/data/analyze.ts"));

test("each item has exactly one base recipe, and alternates are flagged", () => {
    const base = baseRecipes(RECIPE_TREE);
    for (const it of RECIPE_TREE.items.filter((i) => i.kind !== "raw")) assert.ok(base.has(it.id), `${it.id} needs a base recipe`);
    assert.equal(alternateIds(RECIPE_TREE).size, 6);
});

test("an alternate changes the solve; a mismatched choice is refused", () => {
    const plain = solve(RECIPE_TREE, { iron_screw: 24 });
    const bulk = solve(RECIPE_TREE, { iron_screw: 24 }, { iron_screw: "r_iron_screw_bulk" });
    assert.ok(bulk.raw.iron_ore < plain.raw.iron_ore, "bulk screws use less iron");
    assert.throws(() => solve(RECIPE_TREE, { iron_screw: 1 }, { iron_screw: "r_iron_plate_hammer" }));
});

test("power is positive for the orrery and generators need a supply figure", () => {
    const res = solve(RECIPE_TREE, { sail_panel: 1, mirror_cell: 1, relay_core: 1, lattice_strut: 1 });
    assert.ok(res.powerKw > 0);
    assert.ok(generatorsFor(RECIPE_TREE, res.powerKw, "spring_winder") < generatorsFor(RECIPE_TREE, res.powerKw, "windmill"));
    for (const g of RECIPE_TREE.machines.filter((m) => m.generatesKw)) assert.ok(g.supplyRange > 0);
});
