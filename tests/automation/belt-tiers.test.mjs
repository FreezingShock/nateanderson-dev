// Belt tiers matter: a brass belt carries 2 items a second, copper 4, steel 8, and a junction keeps pace with its own tier.
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const S = await import(resolve(root, "lib/automation/sim/index.ts"));
const CAT = S.DEFAULT_CATALOG;

test("belt throughput is speed over spacing: 2, 4 and 8 items a second", () => {
    for (const [id, perSec] of [["belt", 2], ["belt-copper", 4], ["belt-steel", 8]]) {
        const r = S.resolve(CAT, id);
        assert.equal(r.beltSpeed / r.spacing, perSec, id);
    }
});

test("a junction's rate equals the belt of its tier, so no junction throttles its own belt", () => {
    const belts = { "": "belt", "-copper": "belt-copper", "-steel": "belt-steel" };
    for (const [suffix, beltId] of Object.entries(belts)) {
        const b = S.resolve(CAT, beltId);
        for (const k of ["splitter", "merger", "underground-in", "loader", "unloader"]) {
            assert.equal(S.resolve(CAT, `belt-${k}${suffix}`).rate, b.beltSpeed / b.spacing, `${k}${suffix}`);
        }
    }
});

test("a pure-ore drill with mastery overruns a brass belt, and copper carries it", () => {
    const run = (beltId) => {
        const w = S.createWorld({ width: 20, depth: 8, hub: { x: 12, z: 2 }, startStock: [{ item: "iron_plate", qty: 100 }, { item: "copper_wire", qty: 50 }] }, CAT);
        S.addDeposit(w, 1, 3, "iron_ore", 2);
        S.place(w, "drill", 1, 3, 1, CAT);
        S.place(w, "windmill", 1, 6, 0, CAT);
        w.progress.bonus = { miner: 1.3, power: 1.3, craft: 1 };
        w.windPin = 1;
        for (let x = 3; x < 12; x++) assert.equal(S.place(w, beltId, x, 3, 1, CAT).ok, true, `${beltId} at ${x}`);
        S.advance(w, 60, 0.1, CAT);
        return w.progress.delivered.iron_ore ?? 0;
    };
    const brass = run("belt");
    const copper = run("belt-copper");
    assert.ok(brass < 2 * 60 * 1.02, `brass is capped near 2 a second, got ${brass}`);
    assert.ok(copper > brass * 1.1, `copper carries more (${copper} vs ${brass})`);
});
