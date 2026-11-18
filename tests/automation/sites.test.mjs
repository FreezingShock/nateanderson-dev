// Prestige sites: every site must carry a node for each raw ore in the real tree, and a drill on
// each node must mine. Regression for the placeholder ids (ore-a, ore-b) that mined nothing after a prestige.
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const S = await import(pathToFileURL(resolve(root, "lib/automation/sim/index.ts")).href);
const CAT = S.DEFAULT_CATALOG;
const RAW = CAT.tree.nodes.map((n) => n.item);

for (const site of S.SITES) {
    test(`site ${site.id} has a node for every raw ore`, () => {
        const items = site.nodes.map((n) => n.item);
        for (const raw of RAW) assert.ok(items.includes(raw), `${site.id} is missing ${raw}`);
        for (const n of site.nodes) assert.ok(RAW.includes(n.item), `${site.id} node ${n.item} is not a raw ore in the tree`);
    });

    test(`site ${site.id} mines every ore after a prestige`, () => {
        const world = S.createWorld({ width: 18, depth: 12, hub: { x: 8, z: 5 } }, CAT);
        const r = S.prestige(world, CAT, site.id);
        assert.equal(r.ok, true, r.reason);
        for (const it of CAT.tree.items) world.buildings[world.hubId].input[it.id] = 500; // prestige empties the hub; windmills cost several items
        for (const n of site.nodes) {
            const w = structuredClone(world);
            const d = S.place(w, "drill", n.x, n.z, 0, CAT);
            assert.equal(d.ok, true, `drill on ${n.item} at ${n.x},${n.z}: ${d.reason}`);
            // A drill needs power: put a windmill within range of it (the range is 6 cells).
            const spots = [[n.x + 3, n.z], [n.x - 3, n.z], [n.x, n.z + 3], [n.x, n.z - 3]];
            const mill = spots.map(([x, z]) => S.place(w, "windmill", x, z, 0, CAT)).find((p) => p.ok);
            assert.ok(mill, `no room for a windmill beside ${n.item} at ${site.id}: ${spots.map(([x, z]) => S.placeError(w, "windmill", x, z, 0, CAT)).join(" / ")}`);
            S.advance(w, 120, 0.5, CAT);
            const b = S.buildingAt(w, n.x, n.z, CAT);
            assert.ok((b.output[n.item] ?? 0) > 0, `drill on ${n.item} at ${site.id} mined nothing`);
        }
    });
}

// Expedition menu states: before the first prestige every other site is locked; after it, each one is open.
test("other sites are locked before the first prestige and open after it", () => {
    const world = S.createWorld({ width: 18, depth: 12, hub: { x: 8, z: 5 } }, CAT);
    const before = S.hudData(world, CAT).areas;
    assert.ok(before.every((a) => a.state === "locked"), JSON.stringify(before));
    const r = S.prestige(world, CAT, S.SITES[0].id);
    assert.equal(r.ok, true, r.reason);
    const after = S.hudData(world, CAT).areas;
    assert.equal(after.find((a) => a.id === S.SITES[0].id).state, "current");
    for (const a of after.filter((a) => a.id !== S.SITES[0].id)) assert.equal(a.state, "open", a.id);
});

// Locked expedition cards name the milestones still open, in tree order, so the player sees what to deliver next.
test("the expedition lists every milestone still open, in tree order", () => {
    const world = S.createWorld({ width: 18, depth: 12, hub: { x: 8, z: 5 } }, CAT);
    const all = CAT.tree.milestones.map((m) => m.name);
    assert.deepEqual(S.hudData(world, CAT).prestige.missing, all);
    world.progress.milestonesDone = [CAT.tree.milestones[0].id];
    assert.deepEqual(S.hudData(world, CAT).prestige.missing, all.slice(1));
    world.progress.milestonesDone = CAT.tree.milestones.map((m) => m.id);
    assert.deepEqual(S.hudData(world, CAT).prestige.missing, []);
});
