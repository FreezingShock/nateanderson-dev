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
