// Regression for the hand-built stage 2 layout (scripts/automation/stage2-hand-layout.mjs): every belt, machine and
// recipe must place, the research must be bought in order, and milestones 1 and 2 must complete in fifteen simulated minutes.
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { runStage2Layout } = await import(pathToFileURL(resolve(root, "scripts/automation/stage2-hand-layout.mjs")).href);

test("the stage 2 layout places every piece", () => {
    const { log } = runStage2Layout(0);
    assert.deepEqual(log, [], log.join("\n"));
});

test("the stage 2 layout buys its research, completes milestones 1 and 2 in fifteen minutes", () => {
    const { stock, targets, log, world, researchLog } = runStage2Layout(15);
    assert.deepEqual(log, [], log.join("\n"));
    assert.deepEqual(researchLog.map((r) => r.split(" ")[0]), ["furnace_alloys", "sheet_rolling"]);
    assert.deepEqual(world.progress.milestonesDone, ["ms_smelting", "ms_forming"]);
    for (const [item, need] of Object.entries(targets)) {
        assert.ok(stock[item] >= need, `${item}: ${stock[item]} of ${need}`);
    }
});
