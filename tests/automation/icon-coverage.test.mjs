// Every item a menu can list must resolve to drawn art, never to the two-letter stand-in. Covers the real catalog
// (items, machines, structures, every recipe input and output, every build cost) and the short ids the preview HUD uses.
import test from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { RECIPE_TREE } = await import(pathToFileURL(resolve(root, "lib/automation/data/tree.ts")).href);
const { iconCell } = await import(pathToFileURL(resolve(root, "lib/automation/icons/index.ts")).href);
const mock = await import(pathToFileURL(resolve(root, "components/automation/mock.ts")).href);

const missing = (ids) => [...new Set(ids)].filter((id) => iconCell(id) === undefined);

test("every catalog id a menu can show has an icon", () => {
    const t = RECIPE_TREE;
    const ids = [
        ...t.items.map((i) => i.id),
        ...t.machines.map((m) => m.id),
        ...(t.structures ?? []).map((s) => s.id),
        ...t.recipes.flatMap((r) => [r.output.item, ...(r.inputs ?? []).map((x) => x.item)]),
        ...t.machines.flatMap((m) => (m.buildCost ?? []).map((c) => c.item ?? c.resourceId)),
        ...(t.milestones ?? []).flatMap((m) => m.deliver.map((d) => d.item)),
    ].filter(Boolean);
    assert.deepEqual(missing(ids), [], "these ids would show letters instead of art");
});

test("preview HUD resources and costs resolve to art", () => {
    const ids = [
        ...mock.mockResources.map((r) => r.id),
        ...mock.mockMachines.flatMap((m) => m.cost.map((c) => c.resourceId)),
    ];
    assert.deepEqual(missing(ids), [], "add an alias in scripts/brasswork/build-icons.py or draw the item");
});
