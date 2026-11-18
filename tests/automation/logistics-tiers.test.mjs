// Higher logistics tiers cost only their extra items; brass keeps the full recipe. Every id still exists so saves load.
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const S = await import(pathToFileURL(resolve(root, "lib/automation/sim/index.ts")).href);
const E = S.DEFAULT_CATALOG.engine;

test("copper and steel logistics cost only their extra items", () => {
    for (const k of ["splitter", "merger", "underground-in", "underground-out", "loader", "unloader"]) {
        assert.ok(E[`belt-${k}`].cost.length > 0, `${k} brass keeps its recipe`);
        for (const suffix of ["-copper", "-steel"]) {
            const cost = E[`belt-${k}${suffix}`].cost;
            assert.ok(cost.every((s) => ["copper_wire", "steel_ingot"].includes(s.item)), `${k}${suffix} costs ${cost.map((s) => s.item).join(", ")}`);
        }
    }
});
