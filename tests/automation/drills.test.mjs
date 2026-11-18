// Drills: a 2 by 2 drill works a node under any of its cells, reports why it is idle, and the shown rate matches what arrives.
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const S = await import(pathToFileURL(resolve(root, "lib/automation/sim/index.ts")).href);
const G = await import(pathToFileURL(resolve(root, "lib/automation/sim/grid.ts")).href);
const H = await import(pathToFileURL(resolve(root, "lib/automation/sim/hud.ts")).href);
const CAT = S.DEFAULT_CATALOG;
const SPOTS = S.START_NODE_SPOTS;
const board = () => {
    const w = S.createWorld({ width: 18, depth: 12, hub: { x: 8, z: 5 } }, CAT);
    CAT.tree.nodes.forEach((n, i) => S.addDeposit(w, SPOTS[i][0], SPOTS[i][1], n.item, 1));
    return w;
};

test("every start node can be mined and delivers to the hub", () => {
    CAT.tree.nodes.forEach((n, i) => {
        const w = board();
        const [x, z] = SPOTS[i];
        assert.equal(S.place(w, "drill", x, z, 0, CAT).ok, true);
        assert.equal(S.place(w, "windmill", x > 8 ? x - 3 : x + 3, z > 6 ? z - 4 : z + 3, 0, CAT).ok, true);
        const r = G.autoRoute(w, { x, z }, { x: 8, z: 5 }, "belt", CAT);
        assert.equal(r.ok, true, `${n.item} route`);
        r.cells.forEach((c) => assert.equal(S.place(w, "belt", c.x, c.z, c.rot, CAT).ok, true));
        for (let t = 0; t < 600; t++) S.step(w, 0.1, CAT);
        assert.ok((w.buildings[w.hubId].input[n.item] ?? 0) > 20, `${n.item} reached the hub`);
    });
});

test("a drill covering a node with any of its cells mines it", () => {
    const w = board();
    // Node at (15,8): anchor one cell up and left, so the node sits under the drill's far corner.
    assert.equal(S.placeError(w, "drill", 14, 7, 0, CAT)?.includes("resource node") ?? false, false);
    assert.equal(S.place(w, "drill", 14, 7, 0, CAT).ok, true);
    assert.equal(S.place(w, "windmill", 11, 9, 0, CAT).ok, true);
    for (let t = 0; t < 100; t++) S.step(w, 0.1, CAT);
    const d = Object.values(w.buildings).find((b) => b.type === "drill");
    assert.ok((d.output.quartz ?? 0) > 3);
});

test("a drill with no belt beside it shows no rate and says why", () => {
    const w = board();
    S.place(w, "drill", 15, 8, 0, CAT);
    S.place(w, "windmill", 12, 9, 0, CAT);
    for (let t = 0; t < 400; t++) S.step(w, 0.1, CAT); // fills the 20-ore buffer
    const d = Object.values(w.buildings).find((b) => b.type === "drill");
    assert.equal(S.hasOutputNeighbour(w, d, CAT), false);
    const hud = H.hudData(w, CAT, d.id, H.DEFAULT_SETTINGS);
    const quartz = [...hud.resources].find((r) => r.id === "quartz");
    assert.ok(!quartz || quartz.perSecond === 0);
    assert.match(hud.selected.reason, /belt/i);
});
