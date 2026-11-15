// Progression rules: supply crates, the new-workshop kit, commissions, mastery research, site power, and the crate-or-hub split.
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const S = await import(resolve(root, "lib/automation/sim/index.ts"));
const P = await import(resolve(root, "lib/automation/sim/progress.ts"));
const CAT = S.DEFAULT_CATALOG;
const fresh = () => S.createWorld({ width: 18, depth: 12, hub: { x: 8, z: 5 } }, CAT);
const hubOf = (w) => w.buildings[w.hubId].input;
const deliver = (w, stacks) => { for (const s of stacks) w.progress.delivered[s.item] = (w.progress.delivered[s.item] ?? 0) + s.qty; };
const finishFirstRun = (w) => { for (const m of CAT.tree.milestones) deliver(w, m.deliver); S.checkMilestones(w, CAT); };

test("a finished hub request pays its supply crate", () => {
    const w = fresh();
    const before = hubOf(w).copper_wire ?? 0;
    deliver(w, [{ item: "iron_ingot", qty: 10 }]);
    S.checkRequests(w, CAT);
    assert.ok(S.requestDone(w, "rq_copper"));
    assert.equal(hubOf(w).copper_wire, before + 10);
});

test("a finished milestone pays blueprints and its crate, and the crate does not count as a delivery", () => {
    const w = fresh();
    const m = CAT.tree.milestones[0];
    deliver(w, m.deliver);
    const plates = hubOf(w).iron_plate ?? 0;
    const delivered = { ...w.progress.delivered };
    S.checkMilestones(w, CAT);
    assert.equal(w.progress.blueprints, m.blueprints);
    assert.equal(hubOf(w).iron_plate, plates + 20);
    assert.deepEqual(w.progress.delivered, delivered);
});

test("every milestone before the last pays a crate; none pays twice", () => {
    for (const m of CAT.tree.milestones.slice(0, -1)) assert.ok(m.reward && m.reward.length > 0, m.id);
    const w = fresh();
    finishFirstRun(w);
    const snap = JSON.stringify(hubOf(w));
    S.checkMilestones(w, CAT);
    assert.equal(JSON.stringify(hubOf(w)), snap, "a second check changes nothing");
});

test("a new workshop starts with a kit that can raise a windmill (no soft-lock)", () => {
    const w = fresh();
    finishFirstRun(w);
    assert.equal(S.prestige(w, CAT, "ridge").ok, true);
    assert.equal(S.placeError(w, "windmill", 2, 2, 0, CAT), null);
    const second = fresh();
    S.prestige(second, CAT, "ridge");
    S.prestige(second, CAT, "cove");
    assert.ok(hubOf(second).iron_plate > hubOf(w).iron_plate, "a later workshop starts with more");
});

test("commissions open after the last milestone, need fresh deliveries, and repeat", () => {
    const w = fresh();
    assert.equal(P.currentCommission(w, CAT), null, "none during the first run");
    finishFirstRun(w);
    const c0 = P.currentCommission(w, CAT);
    assert.equal(c0.n, 0);
    // The deliveries already made do not count toward it.
    assert.equal(w.progress.commissions ?? 0, 0);
    const bp = w.progress.blueprints;
    const plates = hubOf(w).iron_plate ?? 0;
    const need = S.hudData(w, CAT).milestones.find((m) => m.commission);
    assert.ok(need, "the HUD lists the open commission");
    assert.equal(need.items.every((i) => i.have === 0), true);
    deliver(w, need.items.map((i) => ({ item: i.id, qty: i.need })));
    S.checkMilestones(w, CAT);
    assert.equal(w.progress.commissions, 1);
    assert.ok(w.progress.blueprints > bp);
    assert.ok((hubOf(w).iron_plate ?? 0) > plates);
    assert.equal(P.currentCommission(w, CAT).n, 1, "the next one is open");
    // A prestige does not finish the first-run milestones again and the commission starts clean.
    assert.equal(S.hudData(w, CAT).prestige.ready, true);
});

test("commission quantities grow past the list", () => {
    const w = fresh();
    finishFirstRun(w);
    w.progress.commissions = 6;
    const c = P.currentCommission(w, CAT);
    assert.ok(c.deliver.every((s) => s.qty >= 3));
    assert.match(c.name, /Grand commission/);
});

test("mastery research waits for the orrery line and then raises the multipliers", () => {
    const w = fresh();
    w.progress.blueprints = 999;
    assert.equal(S.buyResearch(w, CAT, "deep_seams").ok, false);
    for (const id of ["gears", "furnace_alloys", "sheet_rolling", "frames", "silicon", "steel_beams", "casings", "circuits", "motors", "quartz_optics", "servos", "photocells", "lens_arrays", "mirror_rings", "relay_cores", "orrery_struts"]) {
        assert.equal(S.buyResearch(w, CAT, id).ok, true, id);
    }
    for (const id of ["deep_seams", "deeper_seams", "tuned_sails", "tight_springs", "quick_hands", "steady_hands"]) assert.equal(S.buyResearch(w, CAT, id).ok, true, id);
    const b = w.progress.bonus;
    assert.ok(Math.abs(b.miner - 1.15 * 1.15) < 1e-9);
    assert.ok(Math.abs(b.power - 1.15 * 1.15) < 1e-9);
    assert.ok(Math.abs(b.craft - 1.1 * 1.1) < 1e-9);
});

test("mastery stays out of the critical path: the first run's blueprints cover every orrery node", () => {
    const orrery = ["gears", "furnace_alloys", "sheet_rolling", "frames", "silicon", "steel_beams", "casings", "circuits", "motors", "quartz_optics", "servos", "photocells", "lens_arrays", "mirror_rings", "relay_cores", "orrery_struts"];
    const need = orrery.reduce((a, id) => a + CAT.tree.research.find((n) => n.id === id).cost, 0);
    const have = CAT.tree.milestones.reduce((a, m) => a + m.blueprints, 0);
    assert.ok(have >= need, `${have} blueprints for ${need} of research`);
    const mastery = CAT.tree.research.filter((n) => n.bonus);
    for (const n of mastery) assert.ok(n.requires.length > 0, n.id);
});

test("the site's power bonus reaches the generators, and the craft bonus the crafters", () => {
    const run = (power, craft) => {
        const w = fresh();
        w.windPin = 1;
        S.addDeposit(w, 2, 2, "iron_ore", 1);
        S.place(w, "drill", 2, 2, 0, CAT);
        S.place(w, "windmill", 5, 5, 0, CAT);
        w.progress.bonus = { miner: 1, power, craft };
        S.advance(w, 5, 0.5, CAT);
        return w.power.supply;
    };
    assert.ok(Math.abs(run(1.2, 1) - 1.2 * run(1, 1)) < 1e-6);
    const crafted = (craft) => {
        const w = fresh();
        w.windPin = 1;
        const kiln = S.place(w, "kiln", 2, 2, 0, CAT);
        S.setRecipe(w, kiln.id, "r_iron_ingot", CAT);
        S.place(w, "windmill", 5, 5, 0, CAT);
        w.buildings[kiln.id].input.iron_ore = 40;
        w.progress.bonus = { miner: 1, power: 1, craft };
        S.advance(w, 20, 0.5, CAT);
        return w.buildings[kiln.id].output.iron_ingot ?? 0;
    };
    assert.ok(crafted(1.5) > crafted(1) * 1.3);
});

test("a kiln between a crate and a belt to the hub fills neither alone", () => {
    const w = fresh();
    w.windPin = 1;
    // Kiln at (2,5) 2x2; crate on its east at (4,5); belt from (4,6) to the hub at x=8.
    const kiln = S.place(w, "kiln", 2, 5, 1, CAT);
    S.setRecipe(w, kiln.id, "r_iron_ingot", CAT);
    S.place(w, "windmill", 2, 8, 0, CAT);
    S.place(w, "belt-crate", 4, 5, 0, CAT);
    for (let x = 4; x <= 7; x++) assert.equal(S.place(w, "belt", x, 6, 1, CAT).ok, true);
    w.buildings[kiln.id].input.iron_ore = 60;
    S.advance(w, 60, 0.2, CAT);
    const crate = S.buildingAt(w, 4, 5, CAT);
    assert.ok((crate.input.iron_ingot ?? 0) > 0, "crate received ingots");
    assert.ok((hubOf(w).iron_ingot ?? 0) > 0, "hub received ingots");
});

test("a full crate never slows the hub: every ingot a kiln makes reaches the hub or the crate", () => {
    const run = (crateFull) => {
        const w = fresh();
        w.windPin = 1;
        const kiln = S.place(w, "kiln", 2, 5, 1, CAT);
        S.setRecipe(w, kiln.id, "r_iron_ingot", CAT);
        S.place(w, "windmill", 2, 8, 0, CAT);
        S.place(w, "belt-crate", 4, 5, 0, CAT);
        if (crateFull) S.buildingAt(w, 4, 5, CAT).input.iron_ingot = 200;
        for (let x = 4; x <= 7; x++) S.place(w, "belt", x, 6, 1, CAT);
        w.buildings[kiln.id].input.iron_ore = 40;
        S.advance(w, 60, 0.2, CAT);
        const crate = S.buildingAt(w, 4, 5, CAT).input.iron_ingot ?? 0;
        const onBelts = Object.values(w.buildings).reduce((n, b) => n + (b.lane?.length ?? 0), 0);
        return { hub: hubOf(w).iron_ingot ?? 0, crate: crate - (crateFull ? 200 : 0), onBelts, left: w.buildings[kiln.id].input.iron_ore };
    };
    const open = run(false);
    const full = run(true);
    assert.equal(full.crate, 0, "a full crate takes nothing");
    assert.ok(open.hub > 0 && open.crate > 0, "with room, the crate and the hub share the kiln's output");
    // Same ore used in both runs, so the same ingots were made: a full crate sends all of them on.
    assert.equal(full.hub + full.onBelts, open.hub + open.crate + open.onBelts, "no ingot is lost or held back");
});
