// Brasswork simulation engine tests (node:test). Headless: no rendering, no DOM. Runs in a few seconds.
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// The engine imports siblings without extensions, like the rest of lib/. Resolve them to .ts the way the bundler does.
registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const S = await import(resolve(root, "lib/automation/sim/index.ts"));
const { PLACEHOLDER_CATALOG: CAT } = await import(resolve(root, "lib/automation/sim/data.ts"));

const clone = (x) => structuredClone(x);
const hubAt = { x: 10, z: 10 };
const stockOf = (w, item) => S.stock(w, item);
const ok = (r) => { assert.equal(r.ok, true, r.reason); return r; };

// A standard starting world: hub at (10,10), a copper-ish ore-a deposit at (5,10), plenty of plates to build with.
function base(cat = CAT, extra = {}, { power = true } = {}) {
    const w = S.createWorld({ width: 64, depth: 64, hub: hubAt, startStock: [{ item: "plate-a", qty: 200 }, { item: "plate-b", qty: 60 }], ...extra }, cat);
    S.addDeposit(w, 5, 10, "ore-a", 1);
    S.addDeposit(w, 5, 12, "ore-b", 1);
    if (power) ok(S.place(w, "windmill", 3, 8, 0, cat)); // 30 kW peak, range 6: covers the drill at (5,10)
    w.windPin = 0.5; // steady air for the rate tests; the wind tests leave it unpinned
    return w;
}
function buildRoute(w, from, to, cat = CAT) {
    const r = S.autoRoute(w, from, to, "belt", cat);
    assert.equal(r.ok, true, r.reason);
    for (const c of r.cells) ok(S.place(w, c.kind, c.x, c.z, c.rot, cat));
    return r.cells;
}

test("the hub is created where asked, holds the start stock, and cannot be placed or removed", () => {
    const w = base();
    assert.equal(w.buildings[w.hubId].x, 10);
    assert.equal(stockOf(w, "plate-a"), 190); // 200 start, 10 for the power plant
    assert.equal(S.place(w, "hub", 20, 20).ok, false);
    assert.equal(S.remove(w, w.hubId, CAT).ok, false);
});

test("placement refuses off-island, occupied, unaffordable and deposit-less miners, and pays the cost", () => {
    const w = base();
    assert.match(S.place(w, "belt", 64, 0, 0, CAT).reason ?? "", /off the island/);
    assert.match(S.place(w, "smelter", 63, 63, 0, CAT).reason, /off the island/);
    ok(S.place(w, "belt", 20, 20, 0, CAT));
    assert.equal(S.place(w, "belt", 20, 20, 1, CAT).reason, "occupied");
    assert.match(S.place(w, "drill", 30, 30, 0, CAT).reason, /resource node/);
    const before = stockOf(w, "plate-a");
    ok(S.place(w, "drill", 5, 10, 0, CAT));
    assert.equal(stockOf(w, "plate-a"), before - 4);
    const broke = base(CAT, { startStock: [] }, { power: false });
    assert.match(S.place(broke, "belt", 20, 20, 0, CAT).reason, /needs 1 Plate A/);
});

test("a miner on a 30 per minute node, routed into the hub, delivers about 0.5 ore per second", () => {
    const w = base();
    ok(S.place(w, "drill", 5, 10, 0, CAT));
    buildRoute(w, { x: 5, z: 10 }, hubAt);
    const start = stockOf(w, "ore-a");
    S.advance(w, 120, 0.1, CAT);
    const got = stockOf(w, "ore-a") - start;
    assert.ok(got >= 56 && got <= 60, `expected about 60 ore in 120 s, got ${got}`);
});

test("a belt carries at most speed divided by spacing, so 4 items per second at the placeholder belt", () => {
    const fast = clone(CAT);
    fast.tree.nodes = [{ item: "ore-a", baseRatePerMin: 1200 }, { item: "ore-b", baseRatePerMin: 30 }];
    const w = base(fast);
    ok(S.place(w, "drill", 5, 10, 0, fast));
    buildRoute(w, { x: 5, z: 10 }, hubAt, fast);
    const start = stockOf(w, "ore-a");
    S.advance(w, 60, 0.1, fast);
    const got = stockOf(w, "ore-a") - start;
    // Cap is 4 items per second. The first items take about four seconds to cross four belts.
    assert.ok(got >= 215 && got <= 240, `expected close to the 4 per second cap, got ${got}`);
});

test("a full output buffer stalls the miner instead of losing or banking items", () => {
    const w = base();
    ok(S.place(w, "drill", 5, 10, 0, CAT));
    S.advance(w, 300, 0.1, CAT);
    const b = S.buildingAt(w, 5, 10);
    assert.equal(b.output["ore-a"], 20);
    assert.ok(b.acc <= 1);
});

test("a smelter fed by a drill, with its plates routed on to the hub, makes plates at the ore-limited rate", () => {
    const w = base(CAT, { hub: { x: 30, z: 10 } });
    ok(S.place(w, "drill", 5, 10, 0, CAT));
    ok(S.place(w, "smelter", 20, 10, 0, CAT));
    ok(S.place(w, "windmill", 18, 7, 0, CAT)); // two windmills in range of the smelter: 60 kW for its 60 kW draw
    ok(S.place(w, "windmill", 18, 13, 0, CAT));
    ok(S.setRecipe(w, S.buildingAt(w, 20, 10).id, "smelt-a", CAT));
    buildRoute(w, { x: 5, z: 10 }, { x: 20, z: 10 }); // drill to the smelter
    buildRoute(w, { x: 20, z: 10 }, { x: 30, z: 10 }); // smelter to the hub
    const start = stockOf(w, "plate-a");
    S.advance(w, 240, 0.1, CAT);
    const plates = stockOf(w, "plate-a") - start;
    assert.ok(plates >= 50 && plates <= 60, `expected about 60 plates at 0.25 per second, got ${plates}`);
});

test("power gates miners: with no generator a miner stops, with enough supply it runs", () => {
    const off = base(CAT, {}, { power: false });
    ok(S.place(off, "drill", 5, 10, 0, CAT));
    buildRoute(off, { x: 5, z: 10 }, hubAt);
    const s0 = stockOf(off, "ore-a");
    S.advance(off, 60, 0.1, CAT);
    assert.equal(stockOf(off, "ore-a") - s0, 0);
    assert.equal(off.power.satisfaction, 0);

    const on = base();
    ok(S.place(on, "drill", 5, 10, 0, CAT));
    buildRoute(on, { x: 5, z: 10 }, hubAt);
    const s1 = stockOf(on, "ore-a");
    S.advance(on, 60, 0.1, CAT);
    assert.ok(stockOf(on, "ore-a") - s1 > 25);
    assert.equal(on.power.satisfaction, 1);
});

test("removing a building refunds half its cost and returns what it held", () => {
    const w = base();
    const p = ok(S.place(w, "press", 20, 20, 0, CAT));
    const a = stockOf(w, "plate-a");
    const b = stockOf(w, "plate-b");
    ok(S.remove(w, p.id, CAT));
    assert.equal(stockOf(w, "plate-a"), a + 4);
    assert.equal(stockOf(w, "plate-b"), b + 2);
});

test("changing a recipe returns the crafter's buffered inputs to the hub", () => {
    const w = base();
    const sm = ok(S.place(w, "smelter", 20, 20, 0, CAT));
    ok(S.setRecipe(w, sm.id, "smelt-a", CAT));
    w.buildings[sm.id].input["ore-a"] = 3;
    const before = stockOf(w, "ore-a");
    ok(S.setRecipe(w, sm.id, null, CAT));
    assert.equal(stockOf(w, "ore-a"), before + 3);
    assert.equal(S.setRecipe(w, sm.id, "press-x", CAT).ok, false);
});

test("gridView: get, set, idempotent set on covered cells, refusal on conflict, and check reports footprint problems", () => {
    const w = base();
    const g = S.gridView(w, CAT);
    assert.equal(g.set(20, 20, { kind: "belt", rot: 1 }).ok, true);
    assert.deepEqual(g.get(20, 20), { kind: "belt", rot: 1 });
    assert.equal(g.set(20, 20, { kind: "belt", rot: 1 }).ok, true);
    assert.equal(g.set(20, 20, { kind: "belt", rot: 3 }).ok, false);
    assert.equal(g.set(20, 20, null).ok, true);
    assert.equal(g.get(20, 20), null);
    assert.equal(g.check("smelter", 63, 63, 0), "off the island");
    assert.equal(g.check("smelter", 20, 20, 0), null);
    ok(S.place(w, "smelter", 30, 30, 0, CAT));
    assert.equal(g.check("belt", 31, 31, 0), "occupied"); // inside the smelter's footprint
    assert.equal(g.get(31, 31).kind, "smelter");
});

test("autoRoute finds a belt path to a building and the last belt faces into it", () => {
    const w = base();
    ok(S.place(w, "drill", 5, 10, 0, CAT));
    const r = S.autoRoute(w, { x: 5, z: 10 }, hubAt, "belt", CAT);
    assert.equal(r.ok, true, r.reason);
    assert.ok(r.cells.length >= 3);
    const last = r.cells[r.cells.length - 1];
    const dx = [0, 1, 0, -1][last.rot];
    const dz = [1, 0, -1, 0][last.rot];
    const into = { x: last.x + dx, z: last.z + dz };
    assert.ok(into.x >= 10 && into.x <= 11 && into.z >= 10 && into.z <= 11, "the last belt faces the hub's footprint");
    assert.ok(r.cells.every((c) => c.kind === "belt"));
});

test("save and load: a loaded world runs exactly like the one it came from", () => {
    const w = base();
    ok(S.place(w, "drill", 5, 10, 0, CAT));
    buildRoute(w, { x: 5, z: 10 }, hubAt);
    S.advance(w, 30, 0.1, CAT);
    const text = S.serialize(w);
    const w2 = S.deserialize(text);
    S.advance(w, 60, 0.1, CAT);
    S.advance(w2, 60, 0.1, CAT);
    assert.equal(S.serialize(w), S.serialize(w2));
});

test("the same steps always give the same world", () => {
    const run = () => {
        const w = base();
        ok(S.place(w, "drill", 5, 10, 0, CAT));
        buildRoute(w, { x: 5, z: 10 }, hubAt);
        S.advance(w, 90, 0.1, CAT);
        return S.serialize(w);
    };
    assert.equal(run(), run());
});

test("invalid saves are rejected with a reason", () => {
    assert.throws(() => S.deserialize("nope"), /not JSON/);
    assert.throws(() => S.deserialize(JSON.stringify({ format: "other", version: 1, world: {} })), /not a Brasswork save/);
    assert.throws(() => S.deserialize(JSON.stringify({ format: S.SAVE_FORMAT, version: 9, world: {} })), /unsupported save version/);
});

test("offline catch-up tracks a live run within 3 percent, and drops time past the cap", () => {
    const live = base();
    ok(S.place(live, "drill", 5, 10, 0, CAT));
    buildRoute(live, { x: 5, z: 10 }, hubAt);
    const away = base();
    ok(S.place(away, "drill", 5, 10, 0, CAT));
    buildRoute(away, { x: 5, z: 10 }, hubAt);
    S.advance(live, 3600, 0.1, CAT);
    const res = S.catchUp(away, 3600, CAT);
    assert.equal(res.simulated, 3600);
    assert.equal(res.skipped, 0);
    const a = stockOf(live, "ore-a");
    const b = stockOf(away, "ore-a");
    assert.ok(Math.abs(a - b) / a <= 0.03, `live ${a} vs catch-up ${b}`);

    const cap = base();
    const over = S.catchUp(cap, 9 * 3600, CAT);
    assert.equal(over.simulated, 8 * 3600);
    assert.equal(over.skipped, 3600);
});

test("a milestone delivery grants blueprints, and research gates a recipe until bought", () => {
    const t = clone(CAT);
    t.tree.milestones = [{ id: "m1", name: "First ore", stage: 0, deliver: [{ item: "ore-a", qty: 10 }], blueprints: 3 }];
    t.tree.research = [{ id: "r1", name: "Smelting", cost: 2, requires: [], recipes: ["smelt-a"] }];
    const w = base(t);
    ok(S.place(w, "drill", 5, 10, 0, t));
    buildRoute(w, { x: 5, z: 10 }, hubAt, t);
    assert.ok(!S.unlockedRecipes(w, t).includes("smelt-a"), "smelt-a is locked before research");
    assert.ok(S.unlockedRecipes(w, t).includes("smelt-b"));
    S.advance(w, 60, 0.1, t);
    assert.equal(w.progress.blueprints, 3);
    assert.deepEqual(S.buyResearch(w, t, "r1"), { ok: true });
    assert.equal(w.progress.blueprints, 1);
    assert.ok(S.unlockedRecipes(w, t).includes("smelt-a"));
    assert.equal(S.buyResearch(w, t, "r1").ok, false);
});

test("prestige keeps blueprints, research and belts, and resets machines and stock", () => {
    const t = clone(CAT);
    t.tree.research = [{ id: "r1", name: "x", cost: 1, requires: [], recipes: [] }];
    const w = base(t);
    ok(S.place(w, "drill", 5, 10, 0, t));
    buildRoute(w, { x: 5, z: 10 }, hubAt, t);
    w.progress.blueprints = 5;
    S.buyResearch(w, t, "r1");
    S.prestige(w, t, "ridge");
    const kinds = Object.values(w.buildings).map((b) => b.type);
    assert.ok(!kinds.includes("drill"));
    assert.ok(kinds.includes("belt"));
    assert.equal(stockOf(w, "plate-a"), 0);
    assert.deepEqual(w.progress.researched, ["r1"]);
    assert.equal(w.progress.blueprints, 4);
    assert.equal(w.progress.prestiges, 1);
});

test("day-night clock: noon is full sun, midnight-ish is dark, the day count advances", () => {
    const w = base();
    const len = CAT.tune.dayLength;
    w.time = 0; assert.equal(S.dayClock(w, CAT).isNight, false);
    w.time = len * 0.25; assert.ok(S.dayClock(w, CAT).solar > 0.99);
    w.time = len * 0.75; assert.equal(S.dayClock(w, CAT).isNight, true);
    w.time = len * 2.1; assert.equal(S.dayClock(w, CAT).day, 2);
});

test("hudData reports resources with net rates, machine status, selected detail, milestones and the next step", () => {
    const w = base(CAT, {}, { power: true });
    ok(S.place(w, "drill", 5, 10, 0, CAT));
    buildRoute(w, { x: 5, z: 10 }, hubAt);
    S.advance(w, 30, 0.1, CAT);
    const h = S.hudData(w, CAT, S.buildingAt(w, 5, 10).id);
    const ore = h.resources.find((r) => r.id === "ore-a");
    assert.ok(ore && ore.amount > 0 && Math.abs(ore.perSecond - 0.5) < 1e-9, "drill nets 0.5 per second");
    assert.equal(h.machines.find((m) => m.id === "drill").status, "running");
    assert.equal(h.machines.find((m) => m.id === "drill").count, 1);
    assert.equal(h.selected.id, "drill");
    assert.ok(h.selected.rates.some((r) => r.label.includes("out")));
    assert.equal(h.stats.find((x) => x.label === "Power").value.length > 0, true);
    assert.ok(h.nextStep.text.length > 0);
    assert.equal(h.prestige.ready, false);
    assert.equal(h.settings.numberFormat, "short");
});

test("actions wrap the world operations and return the same results", () => {
    const w = base();
    const sm = S.actions.place(w, "smelter", 20, 20, 0, CAT);
    assert.equal(sm.ok, true);
    assert.equal(S.actions.setRecipe(w, sm.id, "smelt-a", CAT).ok, true);
    assert.equal(S.actions.setRecipe(w, sm.id, "press-x", CAT).ok, false);
    assert.equal(S.actions.buyResearch(w, "nope", CAT).ok, false);
    assert.equal(S.actions.prestige(w, "ridge", CAT).ok, true);
});

test("prestige offers three sites, moves the hub and nodes to the chosen site, and applies its bonus", () => {
    const a = S.offerSites(7);
    const b = S.offerSites(7);
    assert.equal(a.length, 3);
    assert.deepEqual(a.map((s) => s.id), b.map((s) => s.id), "same seed, same offer");
    assert.equal(new Set(a.map((s) => s.id)).size, 3);
    const w = base();
    const site = a[0];
    S.prestige(w, CAT, site.id);
    assert.equal(w.width, site.width);
    assert.equal(w.buildings[w.hubId].x, site.hub.x);
    assert.equal(w.progress.site, site.id);
    assert.equal(w.progress.bonus.miner, site.bonus.miner);
    assert.equal(S.prestige(w, CAT, "nowhere").ok, false);
});

test("a wound spring stores energy in strong wind, and a windmill's output follows the wind", () => {
    const w = base(CAT, {}, { power: false });
    w.windPin = 0.8; // strong wind: the spring charges
    const sp = ok(S.place(w, "spring_winder", 30, 30, 0, CAT));
    S.step(w, 0.5, CAT);
    const stored = w.buildings[sp.id].charge;
    assert.ok(stored > 0, "a spring charges while the wind is above 0.5");
    assert.ok(stored <= 60 * CAT.tune.springSeconds, "and never above its capacity");
    w.windPin = 0.25; // calm: the spring releases and the windmill is weak
    ok(S.place(w, "windmill", 40, 40, 0, CAT));
    S.step(w, 0.1, CAT);
    assert.ok(w.buildings[sp.id].charge < stored, "calm air drains the spring");
    assert.ok(w.power.supply > 0 && w.power.supply <= 60 + 30 * 0.5 + 1, "output stays within the peaks");
});

test("the default catalog is the Recipe thread's tree, with its generators and costs", () => {
    assert.ok(S.DEFAULT_CATALOG.tree.machines.some((m) => m.id === "windmill" && m.generatesKw > 0));
    assert.ok(S.DEFAULT_CATALOG.tree.machines.some((m) => m.id === "spring_winder"));
    const w = S.createWorld({ width: 64, depth: 64, hub: hubAt, startStock: [{ item: "plate-a", qty: 500 }] });
    assert.equal(S.place(w, "windmill", 20, 20, 0, CAT).ok, true);
});
