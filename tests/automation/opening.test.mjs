// The new-player opening, played through the real catalog: drill, kiln, windmill, belts to the hub, first milestone.
// Regression for the soft-lock where the kiln and windmill were stage 1 and 2, and for belts that ended facing away from the hub.
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
const SPOTS = S.START_NODE_SPOTS;

function board() {
    const world = S.createWorld({ width: 18, depth: 12, hub: HUB }, CAT);
    CAT.tree.nodes.forEach((n, i) => SPOTS[i] && S.addDeposit(world, SPOTS[i][0], SPOTS[i][1], n.item, 1));
    return world;
}

test("the opening machines are available at stage 0", () => {
    for (const id of ["drill", "kiln", "windmill"]) {
        const m = CAT.tree.machines.find((x) => x.id === id);
        assert.equal(m.unlockStage, 0, `${id} should be stage 0`);
    }
});

test("a fresh save reaches the first milestone with drill, kiln, windmill and belts to the hub", () => {
    const world = board();
    const must = (r) => assert.equal(r.ok, true, r.reason);
    const belt = (route) => {
        assert.equal(route.ok, true, route.reason);
        route.cells.forEach((c) => must(S.place(world, "belt", c.x, c.z, c.rot, CAT)));
    };
    must(S.place(world, "drill", 2, 2, 1, CAT));
    must(S.place(world, "windmill", 4, 5, 0, CAT));
    const kiln = S.place(world, "kiln", 5, 2, 1, CAT);
    must(kiln);
    must(S.setRecipe(world, kiln.id, "r_iron_ingot", CAT));
    belt(S.autoRoute(world, { x: 4, z: 2 }, { x: 5, z: 2 }, "belt", CAT));
    belt(S.autoRoute(world, { x: 7, z: 2 }, HUB, "belt", CAT));
    for (let t = 0; t < 300; t++) S.advance(world, 1, 0.1, CAT);
    assert.ok((world.buildings[world.hubId].input.iron_ingot ?? 0) >= 50, "fifty iron ingots reach the hub in five minutes");
});

test("a route into a 3 by 3 hub ends with a belt facing the hub, from any side", () => {
    const world = board();
    const route = S.autoRoute(world, { x: 11, z: 9 }, HUB, "belt", CAT);
    assert.equal(route.ok, true, route.reason);
    const last = route.cells[route.cells.length - 1];
    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    const [dx, dz] = dirs[last.rot];
    const hubCells = new Set();
    for (let dz2 = 0; dz2 < 3; dz2++) for (let dx2 = 0; dx2 < 3; dx2++) hubCells.add(`${HUB.x + dx2},${HUB.z + dz2}`);
    assert.ok(hubCells.has(`${last.x + dx},${last.z + dz}`), "last belt points into the hub");
});

// Stage chain: walk the milestones in order. Before each one, the machines its items come from must be open
// given only the milestones already delivered, so no milestone waits on machines only it would unlock.
test("each milestone can be delivered with machines open before it", () => {
    const tree = CAT.tree;
    const world = S.createWorld({ width: 18, depth: 12, hub: HUB }, CAT);
    for (const m of tree.milestones) {
        for (const d of m.deliver) {
            const recipe = tree.recipes.find((r) => r.output.item === d.item);
            if (!recipe) continue;
            const mach = tree.machines.find((x) => x.id === recipe.machine);
            if (!mach) continue;
            assert.ok(S.unlockedMachine(world, CAT, mach.unlockStage), `${m.id} needs ${mach.id}, which is locked before it`);
        }
        world.progress.milestonesDone.push(m.id);
    }
});


// The suggested spot covers free ground off the resource nodes and keeps a free cell beside it for a belt.
test("suggestSpot picks a free spot near the hub with room for a belt", () => {
    const world = S.createWorld({ width: 18, depth: 12, hub: HUB }, CAT);
    CAT.tree.nodes.forEach((n, i) => SPOTS[i] && S.addDeposit(world, SPOTS[i][0], SPOTS[i][1], n.item, 1));
    const spot = S.suggestSpot(world, { w: 2, d: 2 }, CAT);
    assert.ok(spot, "a spot exists on an empty island");
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        assert.equal(world.deposits[`${spot.x + dx},${spot.z + dz}`], undefined, "not on a node");
        assert.equal(S.buildingAt(world, spot.x + dx, spot.z + dz, CAT), null, "free ground");
    }
    assert.equal(S.place(world, "kiln", spot.x, spot.z, 0, CAT).ok, true);
});

// A crafter's output goes to its machine-bound outputs first; the hub only takes what they refuse.
test("a kiln feeds the press beside it before the hub, and the hub gets only the overflow", () => {
    const world = board();
    world.progress.requestsDone = CAT.tree.requests.map((r) => r.id); // the press and the iron plate recipe open from hub requests
    const must = (r) => assert.equal(r.ok, true, r.reason);
    const kiln = S.place(world, "kiln", 5, 2, 1, CAT);
    must(kiln);
    must(S.setRecipe(world, kiln.id, "r_iron_ingot", CAT));
    const press = S.place(world, "press", 11, 1, 0, CAT);
    must(press);
    must(S.setRecipe(world, press.id, "r_iron_plate", CAT));
    for (const route of [S.autoRoute(world, { x: 5, z: 2 }, { x: 11, z: 1 }, "belt", CAT), S.autoRoute(world, { x: 5, z: 2 }, HUB, "belt", CAT)]) {
        assert.equal(route.ok, true, route.reason);
        route.cells.forEach((c) => must(S.place(world, "belt", c.x, c.z, c.rot, CAT)));
    }
    // One ingot a second, well under what the press belt can take, so the hub belt should never be used.
    for (let t = 0; t < 10; t++) {
        world.buildings[kiln.id].output.iron_ingot = 1;
        S.advance(world, 1, 0.1, CAT);
    }
    assert.equal(world.buildings[world.hubId].input.iron_ingot ?? 0, 0, "the hub gets nothing while the press accepts");
    assert.ok((world.buildings[press.id].input.iron_ingot ?? 0) > 0, "the press received ingots");
});

test("the banner walks a newcomer through the recipe and the belts before it asks for ingots", () => {
    const world = board();
    const must = (r) => assert.equal(r.ok, true, r.reason);
    const next = () => S.hudData(world, CAT).nextStep;
    assert.equal(next().actionId, "drill");
    must(S.place(world, "drill", 2, 2, 0, CAT));
    assert.equal(next().actionId, "kiln");
    const kiln = S.place(world, "kiln", 5, 2, 0, CAT);
    must(kiln);
    must(S.place(world, "windmill", 4, 5, 0, CAT));
    assert.equal(world.buildings[kiln.id].recipe, "r_iron_ingot", "a new kiln starts on Iron ingot");
    must(S.setRecipe(world, kiln.id, null, CAT));
    assert.equal(next().actionId, "inspect", "a kiln whose recipe was cleared is named before anything else");
    assert.equal(next().selectId, kiln.id, "and the button selects that kiln");
    must(S.setRecipe(world, kiln.id, "r_iron_ingot", CAT));
    assert.equal(next().actionId, "belt", "then the belts");
    assert.match(next().text, /Belt the drill to the kiln/);
    S.autoRoute(world, { x: 4, z: 2 }, { x: 5, z: 2 }, "belt", CAT).cells.forEach((c) => must(S.place(world, "belt", c.x, c.z, c.rot, CAT)));
    S.autoRoute(world, { x: 7, z: 2 }, HUB, "belt", CAT).cells.forEach((c) => must(S.place(world, "belt", c.x, c.z, c.rot, CAT)));
    assert.equal(next().actionId, "hub-menu", "with belts down, the first order takes over");
});
