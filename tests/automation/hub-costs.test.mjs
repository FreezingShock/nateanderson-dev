// Every buildable's cost must be an item the hub can actually receive: starter stock, or an item a milestone delivers.
// Regression for logistics costing iron rods and screws that no milestone delivers, so a factory could not build them.
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const S = await import(pathToFileURL(resolve(root, "lib/automation/sim/index.ts")).href);
const CAT = S.DEFAULT_CATALOG;

const receivable = new Set([
    ...S.STARTER_KIT.map((s) => s.item),
    ...CAT.tree.milestones.flatMap((m) => m.deliver.map((s) => s.item)),
]);

test("every buildable costs only items the hub can receive", () => {
    const bad = [];
    for (const [id, e] of Object.entries(CAT.engine)) {
        for (const s of e.cost ?? []) if (!receivable.has(s.item)) bad.push(`${id} costs ${s.item}`);
    }
    for (const m of CAT.tree.machines) {
        for (const s of m.buildCost ?? []) if (!receivable.has(s.item)) bad.push(`${m.id} costs ${s.item}`);
    }
    for (const st of CAT.tree.structures ?? []) {
        for (const s of st.buildCost ?? []) if (!receivable.has(s.item)) bad.push(`${st.id} costs ${s.item}`);
    }
    assert.deepEqual(bad, [], bad.join("\n"));
});
