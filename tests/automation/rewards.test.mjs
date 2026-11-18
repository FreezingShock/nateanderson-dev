// The reward moment's events: what counts as a fresh fill, and what the card shows for it.
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const S = await import(pathToFileURL(resolve(root, "lib/automation/sim/index.ts")).href);
const R = await import(pathToFileURL(resolve(root, "lib/brasswork/rewards.ts")).href);
const CAT = S.DEFAULT_CATALOG;
const fresh = () => S.createWorld({ width: 20, depth: 14, hub: { x: 8, z: 5 } }, CAT);

test("the first look is the saved game, not news", () => {
    const w = fresh();
    w.progress.requestsDone = [CAT.tree.requests[0].id];
    const { events, memory } = R.diffRewards(null, S.hudData(w, CAT).hub);
    assert.equal(events.length, 0);
    assert.deepEqual(memory.done, [CAT.tree.requests[0].id]);
});

test("filling an order gives one event with its crate and what it opened", () => {
    const w = fresh();
    const first = R.diffRewards(null, S.hudData(w, CAT).hub);
    w.progress.requestsDone = [CAT.tree.requests[1].id];
    const next = R.diffRewards(first.memory, S.hudData(w, CAT).hub);
    assert.equal(next.events.length, 1);
    const e = next.events[0];
    assert.equal(e.kind, "order");
    assert.equal(e.title, "A stamp press");
    assert.deepEqual(e.crate, [{ item: "iron_plate", qty: 8, name: "Iron plate" }]);
    assert.ok(e.opened.some((u) => u.id === "press"));
    assert.equal(R.diffRewards(next.memory, S.hudData(w, CAT).hub).events.length, 0, "the same fill is never announced twice");
});

test("a milestone reports its blueprints and crate", () => {
    const w = fresh();
    const first = R.diffRewards(null, S.hudData(w, CAT).hub);
    w.progress.milestonesDone.push("ms_smelting");
    const e = R.diffRewards(first.memory, S.hudData(w, CAT).hub).events[0];
    assert.equal(e.kind, "milestone");
    assert.equal(e.blueprints, 12);
    assert.equal(e.crate.length, 2);
    assert.equal(e.crate[0].qty, 20);
});

test("a commission is announced when the next one opens, with its own payout", () => {
    const w = fresh();
    w.progress.milestonesDone = CAT.tree.milestones.map((m) => m.id);
    S.checkMilestones(w, CAT);
    const first = R.diffRewards(null, S.hudData(w, CAT).hub);
    assert.ok(first.memory.commission, "the commission is open once every milestone is done");
    w.progress.commissions = 1;
    const e = R.diffRewards(first.memory, S.hudData(w, CAT).hub).events;
    assert.equal(e.length, 1);
    assert.equal(e[0].kind, "commission");
    assert.ok(e[0].blueprints > 0);
});
