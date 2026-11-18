// Power detail for the menus: generators report what they produce, their rating, wind, reach and machines fed;
// consumers report what they need, the share they get, and whether they are fully powered.
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const S = await import(pathToFileURL(resolve(root, "lib/automation/sim/index.ts")).href);
const CAT = S.DEFAULT_CATALOG;

test("a windmill reports what it produces, its rating, wind, reach and machines fed", () => {
    const w = S.createWorld({ width: 20, depth: 20, hub: { x: 8, z: 5 } }, CAT);
    S.addDeposit(w, 2, 2, "iron_ore", 1);
    const mill = S.place(w, "windmill", 4, 6, 0, CAT);
    assert.equal(mill.ok, true, mill.reason);
    const d = S.place(w, "drill", 2, 2, 0, CAT);
    assert.equal(d.ok, true, d.reason);
    w.windPin = 0.5; // step() reads the wind each tick, so pin it
    S.advance(w, 1, 0.5, CAT);
    const det = S.hudData(w, CAT, mill.id).selected;
    assert.equal(det.maxKw, 50);
    assert.equal(det.rangeCells, 8);
    assert.equal(det.windPct, 0.5);
    assert.equal(det.producedKw, 50);
    assert.equal(det.fedCount, 1);
    assert.equal(det.status, "running");
});

test("a drill reports what it needs, what it gets, and whether it is fully powered", () => {
    const w = S.createWorld({ width: 20, depth: 20, hub: { x: 8, z: 5 } }, CAT);
    S.addDeposit(w, 2, 2, "iron_ore", 1);
    const d = S.place(w, "drill", 2, 2, 0, CAT);
    assert.equal(d.ok, true, d.reason);
    S.advance(w, 1, 0.5, CAT);
    const det = S.hudData(w, CAT, d.id).selected;
    assert.equal(det.usedKw, 6);
    assert.equal(det.satisfied, 0);
    assert.equal(det.fullyPowered, false);
});
