// The host runs offline catch-up in slices; slicing must give exactly the world one long advance() gives.
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const S = await import(pathToFileURL(resolve(root, "lib/automation/sim/index.ts")).href);
const { denseFactory } = await import(pathToFileURL(resolve(root, "scripts/automation/perf-sim.mjs")).href);
const CAT = S.DEFAULT_CATALOG;

test("sliced catch-up equals one advance", () => {
    const a = denseFactory();
    const b = S.deserialize(S.serialize(a));
    S.advance(a, 1234.4, 1, CAT);
    let left = 1234.4;
    while (left > 1e-9) {
        const slice = Math.min(left, 37);
        // The host steps one second at a time inside each slice.
        let s = slice;
        while (s > 1e-9) { const h = Math.min(1, s); S.advance(b, h, 1, CAT); s -= h; left -= h; }
    }
    assert.equal(S.serialize(b).length > 0, true);
    assert.deepEqual(b.buildings[b.hubId].input, a.buildings[a.hubId].input);
});

test("a rebuilt world keeps the same belt routing answers after the building set changes", () => {
    const w = denseFactory();
    S.advance(w, 60, 1, CAT);
    const before = JSON.stringify(w.buildings[w.hubId].input);
    const belt = Object.values(w.buildings).find((x) => x.type === "belt-steel");
    S.remove(w, belt.id, CAT);
    S.advance(w, 60, 1, CAT);
    assert.notEqual(JSON.stringify(w.buildings[w.hubId].input), before);
});
