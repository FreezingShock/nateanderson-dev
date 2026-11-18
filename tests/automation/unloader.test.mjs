// The unloader pulls only the item it is set to. Unset (new or old saves) it stays idle with a reason.
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const S = await import(pathToFileURL(resolve(root, "lib/automation/sim/index.ts")).href);
const CAT = S.DEFAULT_CATALOG;
const HUB = { x: 8, z: 5 };

function setup() {
    const world = S.createWorld({ width: 18, depth: 12, hub: HUB }, CAT);
    world.buildings[world.hubId].input = { iron_rod: 10, iron_plate: 50, copper_wire: 30 };
    const u = S.place(world, "belt-unloader", 7, 5, 0, CAT);
    assert.equal(u.ok, true, u.reason);
    const belt = S.place(world, "belt", 6, 5, 3, CAT);
    assert.equal(belt.ok, true, belt.reason);
    return { world, unloader: world.buildings[u.id], belt: world.buildings[belt.id], rods: world.buildings[world.hubId].input.iron_rod };
}

test("an unloader with no item chosen stays idle and says why", () => {
    const { world, unloader, belt, rods } = setup();
    for (let t = 0; t < 20; t++) S.advance(world, 1, 0.1, CAT);
    assert.equal(belt.lane.length, 0, "nothing reaches the belt");
    assert.equal(world.buildings[world.hubId].input.iron_rod, rods, "the hub keeps its stock");
    assert.equal(S.unloaderIdleReason(unloader), "choose an item");
});

test("a filtered unloader pulls only its item and leaves the rest in the hub", () => {
    const { world, unloader, belt, rods } = setup();
    assert.equal(S.setFilter(world, unloader.id, "copper_wire", CAT).ok, true);
    for (let t = 0; t < 20; t++) S.advance(world, 1, 0.1, CAT);
    assert.ok(belt.lane.length > 0, "copper wire reaches the belt");
    assert.ok(belt.lane.every((l) => l.item === "copper_wire"), "only copper wire is on the belt");
    assert.equal(world.buildings[world.hubId].input.iron_rod, rods, "iron rods stay in the hub");
    assert.equal(S.unloaderIdleReason(unloader), null);
});

test("an unloader saved before filters existed loads as idle, not as a filter", () => {
    const { world, unloader, belt } = setup();
    delete unloader.filter; // an old save has no field at all
    for (let t = 0; t < 20; t++) S.advance(world, 1, 0.1, CAT);
    assert.equal(belt.lane.length, 0);
    assert.equal(S.unloaderIdleReason(unloader), "choose an item");
});

test("clearing the filter idles the unloader again, and bad targets are refused", () => {
    const { world, unloader } = setup();
    S.setFilter(world, unloader.id, "iron_plate", CAT);
    assert.equal(S.setFilter(world, unloader.id, null, CAT).ok, true);
    assert.equal(S.unloaderIdleReason(unloader), "choose an item");
    assert.equal(S.setFilter(world, unloader.id, "not_an_item", CAT).ok, false);
    const hub = world.hubId;
    assert.equal(S.setFilter(world, hub, "iron_plate", CAT).ok, false, "only an unloader takes a filter");
});
