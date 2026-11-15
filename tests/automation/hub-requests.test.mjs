// Hub requests: early deliveries open recipes and machines directly, before blueprints and research take over.
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const S = await import(resolve(root, "lib/automation/sim/index.ts"));
const CAT = S.DEFAULT_CATALOG;
const HUB = { x: 8, z: 5 };
const fresh = () => S.createWorld({ width: 20, depth: 14, hub: HUB }, CAT);
const mach = (hud, id) => hud.machines.find((m) => m.id === id);

test("a new world opens with only the iron ingot recipe and the opening machines", () => {
    const w = fresh();
    const open = S.unlockedRecipes(w, CAT);
    assert.ok(open.includes("r_iron_ingot"));
    for (const r of ["r_copper_ingot", "r_iron_plate", "r_iron_rod", "r_iron_screw", "r_copper_wire"]) assert.ok(!open.includes(r), `${r} should wait for the hub`);
    const hud = S.hudData(w, CAT);
    for (const id of ["drill", "kiln", "windmill"]) assert.equal(mach(hud, id).unlocked, true, id);
    for (const id of ["press", "lathe", "drawer", "belt-splitter", "belt-unloader"]) assert.equal(mach(hud, id).unlocked, false, id);
    assert.match(mach(hud, "press").lockedReason, /Hub request/);
});

test("delivering to the hub fills orders in turn, and each opens what it says", () => {
    const w = fresh();
    const kiln = S.place(w, "kiln", 2, 2, 0, CAT);
    assert.equal(S.setRecipe(w, kiln.id, "r_copper_ingot", CAT).ok, false);
    w.progress.delivered = { iron_ingot: 10 };
    S.advance(w, 0.1, 0.1, CAT);
    assert.equal(S.setRecipe(w, kiln.id, "r_copper_ingot", CAT).ok, true);
    assert.equal(mach(S.hudData(w, CAT), "press").unlocked, false, "press waits for its own order");

    w.progress.delivered = { iron_ingot: 20, copper_ingot: 10 };
    S.advance(w, 0.1, 0.1, CAT);
    const hud = S.hudData(w, CAT);
    assert.equal(mach(hud, "press").unlocked, true);
    assert.ok(S.unlockedRecipes(w, CAT).includes("r_iron_plate"));
    assert.equal(hud.hub.steps.find((s) => s.id === "rq_lathe").state, "now");
});

test("the hub view lists orders then milestones, one open step, with what each opens", () => {
    const w = fresh();
    const hub = S.hudData(w, CAT).hub;
    assert.deepEqual(hub.steps.slice(0, 4).map((s) => s.kind), ["request", "request", "request", "request"]);
    assert.equal(hub.steps.filter((s) => s.state === "now").length, 1);
    assert.equal(hub.steps[0].state, "now");
    assert.deepEqual(hub.steps[0].unlocks.map((u) => u.name), ["Copper ingot"]);
    const ms = hub.steps.find((s) => s.id === "ms_smelting");
    assert.ok(ms.unlocks.some((u) => u.kind === "blueprints"));
    assert.ok(ms.unlocks.some((u) => u.name === "Furnace"), "the first milestone lists the furnace it opens");
    assert.ok(!hub.steps.find((s) => s.id === "ms_forming").unlocks.some((u) => u.id === "press"), "the press belongs to its order, not a milestone");
});

test("the objective line follows the open order, then the milestone", () => {
    const w = fresh();
    S.addDeposit(w, 2, 2, "iron_ore", 1);
    S.place(w, "drill", 2, 2, 0, CAT);
    const kiln = S.place(w, "kiln", 5, 2, 0, CAT);
    S.setRecipe(w, kiln.id, "r_iron_ingot", CAT);
    S.place(w, "windmill", 4, 6, 0, CAT);
    assert.equal(S.hudData(w, CAT).nextStep.title, "Copper at the kiln");
    assert.equal(S.hudData(w, CAT).nextStep.actionId, "hub-menu");
    w.progress.requestsDone = CAT.tree.requests.map((r) => r.id);
    assert.equal(S.hudData(w, CAT).nextStep.title, "First smelt run");
});

test("saves from before hub requests keep every recipe and machine open", () => {
    const w = fresh();
    delete w.progress.requestsDone;
    const back = S.deserialize(S.serialize(w));
    assert.equal(back.progress.requestsDone.length, CAT.tree.requests.length);
    assert.ok(S.unlockedRecipes(back, CAT).includes("r_iron_plate"));
});

test("a played opening fills the first order within three minutes", () => {
    const SPOTS = [[2, 2], [2, 8], [15, 2], [15, 8], [8, 1]];
    const world = S.createWorld({ width: 18, depth: 12, hub: HUB }, CAT);
    CAT.tree.nodes.forEach((n, i) => SPOTS[i] && S.addDeposit(world, SPOTS[i][0], SPOTS[i][1], n.item, 1));
    const must = (r) => assert.equal(r.ok, true, r.reason);
    const belt = (route) => { must(route); route.cells.forEach((c) => must(S.place(world, "belt", c.x, c.z, c.rot, CAT))); };
    must(S.place(world, "drill", 2, 2, 0, CAT));
    must(S.place(world, "windmill", 4, 5, 0, CAT));
    const kiln = S.place(world, "kiln", 5, 2, 0, CAT);
    must(kiln);
    must(S.setRecipe(world, kiln.id, "r_iron_ingot", CAT));
    belt(S.autoRoute(world, { x: 4, z: 2 }, { x: 5, z: 2 }, "belt", CAT));
    belt(S.autoRoute(world, { x: 7, z: 2 }, HUB, "belt", CAT));
    S.advance(world, 180, 0.1, CAT);
    assert.ok(world.progress.requestsDone.includes("rq_copper"), "the copper order is filled");
});
