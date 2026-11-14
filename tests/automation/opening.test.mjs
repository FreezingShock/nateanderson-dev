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
        route.cells.forEach((c) => must(S.place(world, "belt", c.x, c.z, c.rot, CAT)));
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

