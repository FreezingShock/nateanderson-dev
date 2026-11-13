// What Reboot, Ascend, Handover and a stress test keep and wipe. If one of these fails, a change moved a reset boundary:
// decide whether that was intended, then update the rule here and the keep/wipe notes in docs/node-farm.md.
import test from "node:test";
import assert from "node:assert/strict";
import { E, ST, AD, RG, SC, ZE, maxed, loadFixture, clone, noAt, problems } from "./helpers.mjs";

const snap = (s) => JSON.parse(JSON.stringify(s));
const same = (a, b, keys, label) => { for (const k of keys) assert.deepEqual(b[k], a[k], `${label}: ${k} must be kept`); };

test("Reboot: wipes Bytes and Multipliers, keeps materials, counts the Reboot", () => {
    const s = loadFixture("release-mid.json");
    s.mult = E.button(s, "reboot", 0).cost * 1.5; // enough for the first Reboot button
    const tier = 0;
    assert.ok(E.canAfford(s, "reboot", tier));
    const a = snap(s);
    assert.ok(E.press(s, "reboot", tier));
    assert.ok(s.bytes < a.bytes && s.mult < a.mult, "Bytes and Multipliers drop");
    assert.ok(s.reboot > a.reboot, "Reboots grow");
    assert.equal(s.life.reboots, a.life.reboots + 1);
    same(a, s, ["ap", "perks", "tree", "ach", "logs", "drones", "armed"], "Reboot");
    for (const m of E.MATS) assert.equal(s.prod[m], a.prod[m], `Reboot keeps prod.${m}`);
});

test("Ascend: wipes the run, keeps the permanent layers", () => {
    const s = maxed();
    const a = snap(s);
    const gain = E.ascend(s);
    assert.ok(gain >= 1);
    assert.equal(s.ap, a.ap + gain, "AP paid");
    assert.equal(s.life.ascends, a.life.ascends + 1);
    assert.equal(s.life.bytes, a.life.bytes, "lifetime Bytes is never reset");
    assert.equal(s.life.secs, a.life.secs, "lifetime time is never reset");
    assert.ok(s.bytes < a.bytes && s.mult < a.mult && s.aether < a.aether, "the run resets");
    same(a, s, ["perks", "tree", "treeLv", "ach", "logs", "armed", "mounts", "watchdog"], "Ascend");
    assert.deepEqual(s.auto.own, a.auto.own, "learned scripts are kept");
    assert.deepEqual(s.lab.nodes, a.lab.nodes, "lab research is kept");
    assert.deepEqual(s.dr.nodes, a.dr.nodes, "drone tree is kept");
    assert.deepEqual(s.hand.fw, a.hand.fw, "firmware is kept");
    assert.equal(s.hand.keys, a.hand.keys);
    assert.equal(s.hand.count, a.hand.count, "Ascend is not a Handover");
    assert.deepEqual(problems(s), []);
});

test("Ascend with too little Aether changes nothing", () => {
    const s = loadFixture("release-early.json");
    assert.equal(E.canAscend(s), false);
    const a = noAt(s);
    assert.equal(E.ascend(s), 0);
    assert.deepEqual(noAt(s), a);
});

test("Handover: wipes the run, AP and tree; keeps goals, logs, lifetime, lab research, scripts, hangar, Keys and Firmware", () => {
    const s = maxed();
    AD.ownAllFw(s);
    s.ze = ZE.freshZe(); s.ze.seen = 7; s.ze.kinds = { surge: 3 };
    const a = snap(s);
    const refund = Math.floor(E.treeSpent(s) * E.HAND_BASE.apRefund); // a quarter of the tree's AP comes back on every Handover
    const keys = E.handover(s, "wren", "kept note", "osk");
    assert.ok(keys >= 1, "maxed state can hand over");
    assert.equal(s.hand.count, a.hand.count + 1);
    assert.equal(s.hand.keys, a.hand.keys + keys);
    assert.equal(s.hand.keysTotal, a.hand.keysTotal + keys);
    assert.equal(s.hand.notes.at(-1).text, "kept note");
    same(a, s, ["ach", "armed", "logs", "watchdog", "autoArmed"], "Handover");
    assert.equal(s.life.bytes, a.life.bytes, "lifetime Bytes is never reset");
    assert.equal(s.life.ascends, a.life.ascends);
    assert.equal(s.life.secs, a.life.secs);
    assert.deepEqual(s.lab.nodes, a.lab.nodes, "lab research is kept");
    assert.deepEqual(s.auto.own, a.auto.own, "learned scripts are kept");
    assert.deepEqual(s.hand.fw, a.hand.fw, "firmware is kept");
    assert.equal(s.ze.seen, 7, "zone event history is kept");
    assert.deepEqual(s.ze.kinds, { surge: 3 });
    assert.deepEqual(s.ze.act, [], "a running zone event ends");
    assert.ok(s.tree.every((id) => a.tree.includes(id)), "no node appears from nowhere");
    assert.ok(s.tree.length < a.tree.length, "the prestige tree is wiped (the entry and upper path of each section stay)");
    assert.equal(s.ap, refund, "AP is wiped down to the base refund of what the tree cost");
    assert.ok(s.drones.every((d, i) => d <= a.drones[i]), "Drones are wiped");
    assert.ok(s.bytes < a.bytes && s.aether < a.aether && s.prod.aether < a.prod.aether, "the run resets");
    for (const [k, v] of Object.entries(s.rig.lv)) assert.ok(v <= (a.rig.lv[k] ?? 0), `rig ${k} level never rises on Handover`);
    for (const k of ["scrub", "aim", "draw", "cool"]) if (k in a.rig) assert.equal(s.rig[k], a.rig[k], `rig switch ${k} stays`);
    assert.deepEqual(problems(s), []);
});

test("Handover keeps are the default: a first Handover with no Firmware keeps the tree's spine, half the perks and half the rigs", () => {
    const s = maxed();
    s.hand = E.freshHand();
    const a = snap(s);
    const kept = E.handKeeps(s);
    assert.ok(kept.length > 0 && kept.length <= 20, "entry and upper path of each section");
    E.handover(s, "wren");
    assert.deepEqual([...s.tree].sort(), [...kept].sort());
    for (const [k, v] of Object.entries(a.perks)) assert.equal(s.perks[k], Math.floor(v * 0.5), `perk ${k} keeps half`);
    assert.equal(s.ap, Math.floor(E.treeSpent(a) * 0.25));
    assert.ok(s.reboot >= E.HAND_TUNE.warmReboots, "the next run starts with the kit");
    assert.equal(E.hasFeature(s, "watchdog"), true, "Watchdog comes preinstalled");
});

test("Firmware fold: an old save gets back the Keys spent on nodes that became base Handover", () => {
    const s = maxed();
    s.hand = { ...E.freshHand(), count: 3, keys: 1, fw: ["fw_warm", "fw_imprint", "fw_tape", "fw_keysmith", "fw_fastpath"] };
    delete s.hand.fwv;
    const back = E.parseSave(JSON.stringify(s));
    // warm 2 + imprint 2 + tape 12 gone; keysmith unchanged; fast path 8 -> 3
    assert.equal(back.hand.keys, 1 + 2 + 2 + 12 + 5);
    assert.deepEqual(back.hand.fw, ["fw_keysmith", "fw_fastpath"]);
    assert.equal(back.hand.fwv, 2);
    const again = E.parseSave(JSON.stringify(back));
    assert.equal(again.hand.keys, back.hand.keys, "the refund is paid once");
});

test("Handover rigs and zone events are not wiped to nothing (they wiped each other once)", () => {
    const s = maxed();
    AD.ownAllFw(s);
    ZE.ensureZe(s);
    const before = Object.values(s.rig.lv).reduce((n, v) => n + v, 0);
    E.handover(s, "wren");
    const after = Object.values(s.rig.lv).reduce((n, v) => n + v, 0);
    assert.ok(after <= before);
    assert.ok(s.ze && Array.isArray(s.ze.act), "zone event state survives the wipe");
    assert.ok(RG.rig(s) && typeof RG.rig(s).lv === "object", "rig state survives the wipe");
    assert.ok(SC.auto(s).own.length > 0, "script state survives the wipe");
});

test("Handover before node zero changes nothing", () => {
    const s = loadFixture("release-pre-ascend.json");
    assert.equal(E.keysOnHandover(s), 0);
    const a = noAt(s);
    assert.equal(E.handover(s, "wren"), 0);
    assert.deepEqual(noAt(s), a);
});

test("Stress test: start and leave puts the real run back exactly", () => {
    const s = loadFixture("release-post-ascend.json");
    const real = noAt({ ...s, ch: undefined, hand: undefined, life: undefined, rebootAt: undefined });
    assert.ok(ST.startTest(s, "brownout"));
    for (let i = 0; i < 400; i++) E.tick(s, 0.5);
    assert.equal(E.canAscend(s), false, "prestige is locked inside a test");
    ST.leaveTest(s);
    assert.equal(s.ch.run, null);
    assert.deepEqual(noAt({ ...s, ch: undefined, hand: undefined, life: undefined, rebootAt: undefined }), real);
    assert.deepEqual(problems(s), []);
});

test("Stress test: every test can start and be left on a late state without NaN", () => {
    for (const t of ST.TESTS) {
        const s = maxed();
        E.ascend(s);
        const tree = [...s.tree], ach = [...s.ach], ap = s.ap;
        assert.ok(ST.startTest(s, t.id), `${t.id} starts`);
        for (let i = 0; i < 120; i++) E.tick(s, 0.5);
        assert.deepEqual(problems(s), [], `${t.id} while running`);
        ST.leaveTest(s);
        assert.deepEqual(s.tree, tree, `${t.id}: tree back`);
        assert.equal(s.ap, ap, `${t.id}: AP back`);
        assert.ok(ach.every((id) => s.ach.includes(id)), `${t.id}: no goal lost`);
        assert.deepEqual(problems(s), [], `${t.id} after leaving`);
    }
});
