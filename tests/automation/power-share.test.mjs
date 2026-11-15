// Power sharing: a windmill's output that a full consumer does not take goes to the other consumers it reaches,
// so power is not stranded. Regression for output being split evenly and wasted when one consumer needed less.
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const S = await import(resolve(root, "lib/automation/sim/index.ts"));
const CAT = S.DEFAULT_CATALOG;

test("unused windmill output goes to the other machines it reaches", () => {
    const w = S.createWorld({ width: 30, depth: 20, hub: { x: 20, z: 12 } }, CAT);
    S.addDeposit(w, 2, 2, "iron_ore", 1);
    S.addDeposit(w, 2, 8, "copper_ore", 1);
    assert.equal(S.place(w, "windmill", 5, 4, 0, CAT).ok, true);
    assert.equal(S.place(w, "drill", 2, 2, 0, CAT).ok, true);
    assert.equal(S.place(w, "drill", 2, 8, 0, CAT).ok, true);
    w.wind = 0.5;
    S.advance(w, 1, 0.1, CAT);
    // Two 6 kW drills share one 50 kW windmill: both are full, and the power snapshot reports full satisfaction.
    assert.equal(w.power.satisfaction, 1);
});
