// Regression for the hand-built stage 2 layout (scripts/automation/stage2-hand-layout.mjs): every belt, machine and
// recipe must place, and the four milestone 2 targets must complete in ten simulated minutes.
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { runStage2Layout } = await import(resolve(root, "scripts/automation/stage2-hand-layout.mjs"));

test("the stage 2 layout places every piece", () => {
    const { log } = runStage2Layout(0);
    assert.deepEqual(log, [], log.join("\n"));
});

test("the stage 2 layout completes all four milestone 2 targets in ten minutes", () => {
    const { stock, targets, log } = runStage2Layout(10);
    assert.deepEqual(log, [], log.join("\n"));
    for (const [item, need] of Object.entries(targets)) {
        assert.ok(stock[item] >= need, `${item}: ${stock[item]} of ${need}`);
    }
});
