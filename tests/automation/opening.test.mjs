// The new-player opening, played through the real catalog: drill, kiln, windmill, belts to the hub, first milestone.
// Regression for the soft-lock where the kiln and windmill were stage 1 and 2, and for belts that ended facing away from the hub.
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
const SPOTS = [[2, 2], [2, 8], [15, 2], [15, 8], [8, 1]];

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
        route.cells.forEach((c) => must(S.place(world, c.kind, c.x, c.z, c.rot, CAT)));
    };
    must(S.place(world, "drill", 2, 2, 0, CAT));
    must(S.place(world, "windmill", 4, 5, 0, CAT));
    const kiln = S.place(world, "kiln", 5, 2, 0, CAT);
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

// Tunnel hop: a full column of belts blocks the plain route, so the route must hop under it and come out past it.
test("a route hops under a belt wall with a tunnel pair when no plain route exists", () => {
    const world = S.createWorld({ width: 8, depth: 3, hub: { x: 6, z: 0 }, startStock: [{ item: "iron_plate", qty: 50 }, { item: "iron_rod", qty: 20 }] }, CAT);
    for (let z = 0; z < 3; z++) assert.equal(S.place(world, "belt", 2, z, 0, CAT).ok, true);
    const route = S.autoRoute(world, { x: 1, z: 1 }, { x: 5, z: 1 }, "belt", CAT);
    assert.equal(route.ok, true, route.reason);
    const kinds = route.cells.map((c) => c.kind);
    assert.ok(kinds.includes("belt-underground-in") && kinds.includes("belt-underground-out"), `expected a tunnel pair, got ${kinds}`);
    for (const c of route.cells) assert.equal(S.place(world, c.kind, c.x, c.z, c.rot, CAT).ok, true, `placing ${c.kind} at ${c.x},${c.z}`);
});

// Side-loading: a belt already feeding a machine is a valid end for a new route, joined from the side.
test("a route side-loads onto a belt that already feeds the target", () => {
    const world = S.createWorld({ width: 10, depth: 8, hub: { x: 0, z: 0 } }, CAT);
    assert.equal(S.place(world, "kiln", 4, 4, 0, CAT).ok, true);
    assert.equal(S.place(world, "belt", 3, 4, 1, CAT).ok, true); // faces +x, into the kiln
    const route = S.autoRoute(world, { x: 0, z: 4 }, { x: 4, z: 4 }, "belt", CAT);
    assert.equal(route.ok, true, route.reason);
    const last = route.cells.at(-1);
    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    const [dx, dz] = dirs[last.rot];
    assert.equal(last.x + dx === 3 && last.z + dz === 4, true, "last belt feeds the existing belt at 3,4");
});

// Routes keep a resource node and the cells its drill would cover free, so a belt cannot block a drill.
test("a route keeps a resource node and its drill cells free", () => {
    const world = S.createWorld({ width: 10, depth: 6, hub: { x: 0, z: 0 } }, CAT);
    S.addDeposit(world, 4, 2, "iron_ore", 1);
    const route = S.autoRoute(world, { x: 0, z: 2 }, { x: 8, z: 2 }, "belt", CAT);
    assert.equal(route.ok, true, route.reason);
    for (const c of route.cells) {
        const onNode = [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([dx, dz]) => world.deposits[`${c.x + dx},${c.z + dz}`]);
        assert.equal(onNode, false, `belt at ${c.x},${c.z} covers the node or its drill cells`);
    }
});
