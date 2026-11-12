// Scripts, drones, rigs, events, zone events, the lab, goals and secrets: none of them throws or makes a NaN on any state,
// and their data tables stay consistent (unique ids, links that point at real nodes, everything reachable).
import test from "node:test";
import assert from "node:assert/strict";
import { E, RG, SC, ZE, EV, AD, ST, LOGS, maxed, clone, loadFixture, fixtureNames, problems, play } from "./helpers.mjs";

const states = () => [["fresh", E.fresh(0)], ...fixtureNames().map((f) => [f, loadFixture(f)]), ["maxed", maxed()]];

test("data tables: ids are unique and links point at real nodes", () => {
    const uniq = (arr, what) => assert.equal(new Set(arr).size, arr.length, `${what} ids are unique`);
    uniq(E.TREE.map((n) => n.id), "TREE"); uniq(E.GOALS.map((g) => g.id), "GOALS"); uniq(E.SECRETS.map((x) => x.id), "SECRETS");
    uniq([...E.GOALS.map((g) => g.id), ...E.SECRETS.map((x) => x.id)], "goals+secrets"); uniq(E.LAB.map((n) => n.id), "LAB"); uniq(E.FW.map((n) => n.id), "FW");
    uniq(E.DRONE_TREE.map((n) => n.id), "DRONE_TREE"); uniq(E.PAYLOADS.map((p) => p.id), "PAYLOADS"); uniq(E.PERKS.map((p) => p.id), "PERKS"); uniq(LOGS.map((l) => l.id), "LOGS");
    uniq(SC.SCRIPTS.map((x) => x.id), "SCRIPTS"); uniq(E.PROTOS.map((p) => p.id), "PROTOS"); uniq(ST.TESTS.map((t) => t.id), "TESTS");
    for (const [name, nodes, key] of [["TREE", E.TREE, "links"], ["LAB", E.LAB, "links"], ["FW", E.FW, "links"], ["DRONE_TREE", E.DRONE_TREE, "links"]]) {
        const ids = new Set(nodes.map((n) => n.id));
        for (const n of nodes) for (const l of n[key]) assert.ok(l === "core" || ids.has(l), `${name} node ${n.id} links to unknown ${l}`);
        // reachable from the core by following links (a node you can never buy is a bug)
        const open = new Set(), q = nodes.filter((n) => n.links.includes("core")).map((n) => n.id);
        while (q.length) { const id = q.pop(); if (open.has(id)) continue; open.add(id); for (const n of nodes) if (n.links.includes(id) && !open.has(n.id)) q.push(n.id); }
        const unreachable = nodes.filter((n) => !open.has(n.id) && !(n.req && n.req.length)).map((n) => n.id);
        assert.deepEqual(unreachable, [], `${name} nodes with no path from the core`);
    }
});

test("every goal and secret condition evaluates on every kind of state", () => {
    for (const [name, s] of states()) {
        for (const g of E.GOALS) { const c = g.cur(s); assert.ok(Number.isFinite(c), `${name}: goal ${g.id} cur=${c}`); }
        for (const x of E.SECRETS) if (x.test) assert.equal(typeof x.test(s), "boolean", `${name}: secret ${x.id}`);
        assert.doesNotThrow(() => E.checkGoals(s), name);
        assert.deepEqual(problems(s), [], name);
    }
});

test("achievements: granting every goal and secret on a maxed state completes every tier", () => {
    const s = maxed();
    AD.grantGoals(s); AD.grantSecrets(s);
    assert.equal(E.tiersDone(s), E.GOAL_TIERS);
    assert.deepEqual(problems(s), []);
});

test("scripts: all of them running for 10 minutes on late states never throws", () => {
    for (const [name, s] of [["deep", loadFixture("release-deep.json")], ["maxed", maxed()]]) {
        SC.grantScripts(s);
        for (const x of SC.SCRIPTS) SC.setRunning(s, x.id, true);
        for (let i = 0; i < 1200; i++) E.tick(s, 0.5);
        assert.deepEqual(problems(s), [], `${name} after scripts ran`);
        assert.ok(SC.runningCount(s) >= 1, `${name}: scripts are on`);
        for (const [fn, args] of [["cycleSetting", ["keep"]], ["cycleSetting", ["rebootX"]], ["cycleSetting", ["ascX"]], ["cycleSetting", ["rigX"]], ["flip", ["capWait"]], ["cycleAnswer", ["vein"]], ["cycleAnswer", ["fault"]]]) assert.doesNotThrow(() => SC[fn](s, ...args), `${fn} ${args}`);
        assert.doesNotThrow(() => { SC.scriptNext(s); SC.restoreLeft(s); SC.ascendDue(s); }, name);
    }
});

test("scripts: a fresh player learns them by doing, in the documented order", () => {
    const s = E.fresh(0);
    assert.equal(SC.owns(s, "buy"), false);
    SC.teachPress(s, "mult", 0, 500);
    for (let i = 0; i < 5; i++) SC.learnStep(s);
    assert.doesNotThrow(() => SC.scriptNext(s));
});

test("drones: posting, mods, drone tree, respec", () => {
    const s = maxed();
    E.ascend(s);
    AD.maxDrones(s);
    for (let k = 0; k < E.TIERS; k++) {
        const open = E.POSTABLE.filter((st) => E.isUnlocked(s, st));
        assert.doesNotThrow(() => E.setPost(s, k, open[k % open.length] ?? null));
        for (let m = 0; m < E.MOD_COUNT; m++) { s.dr.parts = 1e12; if (!E.modBlock(s, k, m)) E.buyMod(s, k, m); }
    }
    for (let i = 0; i < 30; i++) E.tick(s, 2);
    assert.deepEqual(problems(s), []);
    s.dr.parts = 1e12;
    for (const n of E.DRONE_TREE) E.buyDroneNode(s, n.id);
    assert.doesNotThrow(() => { E.respecDrones(s); E.droneTreeTotals(s); });
    assert.deepEqual(problems(s), []);
});

test("rigs: every rig buys, rewrites, switches and reports a line", () => {
    const s = maxed();
    for (const d of RG.RIGS) for (const k of d.keys) { s[RG.rigPrice(s, k.key).pays] = 1e30; assert.doesNotThrow(() => RG.buyRig(s, k.key), k.key); }
    s.origin = 1e30;
    for (const d of RG.RIGS) assert.doesNotThrow(() => RG.rewrite(s, d.zone), d.zone);
    for (const [k, v] of [["scrub", true], ["aim", "copper"], ["draw", 0.2], ["rwAim", "bytes"], ["cool", true]]) assert.doesNotThrow(() => RG.setRig(s, k, v), k);
    for (const d of RG.RIGS) assert.equal(typeof RG.rigLine(s, d.zone), "string", d.zone);
    const m = RG.muls(s);
    for (const [k, v] of Object.entries(m)) assert.ok(Number.isFinite(v) && v >= 0, `rig multiplier ${k}=${v}`);
    for (let i = 0; i < 1200; i++) E.tick(s, 0.5);
    assert.deepEqual(problems(s), []);
});

test("zone events: every kind in every zone starts, answers, ticks and ends", () => {
    const s = maxed();
    const started = [];
    for (const kind of ZE.ZONE_EVENTS.map((e) => e.kind)) for (const zone of E.STATS.map((x) => x.id)) {
        const e = ZE.zeStart(s, kind, zone);
        started.push(e);
        assert.equal(typeof ZE.zeEffect(s, e), "string", `${kind}/${zone}`);
        assert.ok(Array.isArray(ZE.eventsFor(s, zone)));
    }
    // answer half of them (every way), leave the rest to run out
    started.forEach((e, i) => { if (i % 2) for (const c of ["mine", "run", "patch", "wait"]) assert.doesNotThrow(() => ZE.zeChoose(s, e.id, c), `${e.kind}/${e.zone}/${c}`); });
    for (let i = 0; i < 30; i++) { E.tick(s, 10); if (i % 10 === 0) assert.deepEqual(problems(s), [], `tick ${i}`); }
    assert.deepEqual(problems(s), []);
    let r = 0.13;
    const rnd = () => (r = (r * 9301 + 49297) % 233280 / 233280);
    for (let i = 0; i < 200; i++) { const ev = ZE.rollEvent(s, rnd); assert.ok(ev && ZE.zoneEvDef(ev.kind) && E.STATS.some((x) => x.id === ev.zone)); }
    assert.doesNotThrow(() => ZE.zeClear(s));
});

test("quick-time events: loot of every kind and rarity pays a finite amount", () => {
    for (const [name, s] of states()) {
        for (const kind of ["burst", "cache", "overtime"]) for (let rarity = 0; rarity < EV.RARITY.length; rarity++) {
            const loot = EV.makeLoot(s, kind, rarity);
            const c = clone(s);
            const paid = EV.payLoot(c, loot);
            assert.ok(Number.isFinite(paid) && paid >= 0, `${name}: ${kind} r${rarity}`);
            assert.deepEqual(problems(c), [], `${name}: ${kind} r${rarity}`);
        }
        for (const q of [0, 0.25, 0.5, 1]) assert.doesNotThrow(() => EV.rollLoot(s, q), name);
        assert.doesNotThrow(() => EV.rogueChoices(s), name);
        for (const k of ["spike", "rogue", "vault", "relay", "packet", null]) assert.doesNotThrow(() => EV.pickEvent(1, k), name);
    }
    for (const e of EV.EVENTS) assert.equal(EV.eventDef(e.kind), e);
    assert.doesNotThrow(() => { const s = maxed(); E.breach(s); });
});

test("exploit lab: every payload compiles and deploys on a state that has the research", () => {
    const s = maxed();
    for (const p of E.PAYLOADS) {
        s.lab.intel = 1e30; for (const m of E.MATS) s[m] = 1e30;
        assert.doesNotThrow(() => { E.compileBlock(s, p.id); E.deployBlock(s, p.id); }, p.id);
        assert.doesNotThrow(() => E.compile(s, p.id), p.id);
    }
    for (let i = 0; i < 1200; i++) E.tick(s, 1);
    for (const p of E.PAYLOADS) s.lab.stock[p.id] = 2;
    for (const p of E.PAYLOADS) assert.doesNotThrow(() => E.deploy(s, p.id), p.id);
    for (let i = 0; i < 600; i++) E.tick(s, 1);
    assert.deepEqual(problems(s), []);
    assert.doesNotThrow(() => E.labTotals(s));
});

test("prestige tree: buying every node in any order, respec, and the AP books balance", () => {
    const s = E.fresh(0);
    s.ap = 1e9;
    const full = new Set(E.fullTreeIds()); // the first side of every fork (buying the other side swaps it, which would never end)
    for (let more = true; more;) { more = false; for (const n of E.TREE) if (full.has(n.id) && !E.nodeMaxed(s, n) && E.nodeOpen(s, n) && E.buyNode(s, n.id)) more = true; }
    assert.equal(s.tree.length >= E.TREE_FULL, true);
    const spent = E.treeSpent(s);
    assert.equal(s.ap, 1e9 - spent, "AP spent equals what the tree says it cost");
    const fork = E.TREE.find((n) => n.form === "fork" && n.excl && !full.has(n.id));
    if (fork) { // swapping a fork refunds the side you had, in full
        const ap = s.ap, held = E.treeSpent(s);
        assert.ok(E.buyNode(s, fork.id), "the other side of a fork can be swapped in");
        assert.equal(s.ap + E.treeSpent(s), ap + held, "swap keeps the AP books balanced");
    }
    const back = E.respec(s);
    assert.equal(s.ap, 1e9, "a free respec returns every AP");
    assert.ok(back >= 0 && s.tree.length === 0);
});

test("a played game passes through every system without the engine throwing (zone events, scripts and rigs live)", () => {
    const s = E.fresh(0);
    SC.grantScripts(s);
    for (const x of SC.SCRIPTS) SC.setRunning(s, x.id, true);
    play(s, 1800, { ascend: true, each: (st, t) => { if (t % 120 === 0) { const ev = ZE.rollEvent(st); if (ev) ZE.zeStart(st, ev.kind, ev.zone); } } });
    assert.deepEqual(problems(s), []);
});
