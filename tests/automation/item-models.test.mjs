// Brasswork belt models: every catalog item has a small model that passes the shared format check.
import test from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { RECIPE_TREE } = await import(pathToFileURL(resolve(root, "lib/automation/data/tree.ts")).href);
const { ITEM_MODELS } = await import(pathToFileURL(resolve(root, "lib/automation/models/items/index.ts")).href);
const { validateModel, TAG } = await import(pathToFileURL(resolve(root, "lib/automation/models/format.ts")).href);

test("every item has a valid, small belt model", () => {
    assert.equal(TAG.SOLID, 0);
    assert.equal(TAG.GLOW, 1);
    for (const item of RECIPE_TREE.items) {
        const m = ITEM_MODELS[item.id];
        assert.ok(m, `${item.id} has no belt model`);
        validateModel(m);
        const n = m.parts.reduce((s, p) => s + p.colors.length, 0);
        assert.ok(n > 0 && n <= 200, `${item.id} has ${n} voxels (keep belt items at 200 or fewer)`);
    }
});
