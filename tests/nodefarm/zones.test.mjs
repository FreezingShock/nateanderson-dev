// The 25 zones: order, unlock chain, and the Overgrowth and Descent arcs that wait for the first Handover.
import test from "node:test";
import assert from "node:assert/strict";
import { E, AR, RG, ZE } from "./helpers.mjs";

const ids = E.STATS.map((x) => x.id);
const REBOOT_I = ids.indexOf("reboot");

test("there are exactly 25 zones, in the documented order", () => {
    assert.equal(ids.length, 25);
    assert.deepEqual(ids.slice(0, 7), ["bytes", "mult", "reboot", "copper", "silicon", "quartz", "aether"]);
    assert.deepEqual(ids.slice(16, 25), ["origin", "spores", "mycelium", "pollen", "bloom", "basalt", "magma", "geodes", "sunstone"]);
    assert.equal(new Set(ids).size, 25, "ids are unique");
    assert.deepEqual([...E.MATS], ids.slice(3), "MATS is every zone from Copper on, in order");
    assert.equal(ids[24], "sunstone", "zone 25 is the buried sun, id sunstone");
});

test("every zone has an arc, a rig entry where it should, and a tune entry", () => {
    for (const id of ids) assert.ok(AR.arcOf(id), `${id} belongs to an arc`);
    assert.equal(AR.ARCS.flatMap((a) => a.zones).length, 25, "arcs cover each zone exactly once");
    for (const m of E.MATS) assert.ok(E.TUNE.unlockAt[m] > 0 && Number.isFinite(E.TUNE.unlockAt[m]), `unlockAt.${m}`);
    for (const id of ids) assert.ok(E.statDef(id).name, `${id} has a name`);
});

test("fresh game: only the first zones are open; materials never open out of order", () => {
    const s = E.fresh(0);
    assert.deepEqual(ids.filter((id) => E.isUnlocked(s, id)), ["bytes", "mult"]);
    // give a zone its unlock amount with nothing below it: it must stay shut, because each one needs the one before
    const t = E.fresh(0);
    t.life.reboots = 1000;
    for (const m of E.MATS) t[m] = 0;
    t.silicon = 1e30;
    assert.equal(E.isUnlocked(t, "quartz"), true, "quartz opens off silicon");
    assert.equal(E.isUnlocked(t, "runes"), false, "runes does not open off silicon");
});

test("walking the chain opens the zones 04 to 17 one after another, never skipping", () => {
    const s = E.fresh(0);
    s.life.reboots = E.TUNE.unlockAt.copper;
    s.life.bytes = 1e9;
    let open = ids.filter((id) => E.isUnlocked(s, id));
    const order = [...open];
    for (let i = ids.indexOf("copper"); i <= ids.indexOf("origin"); i++) {
        const id = ids[i], below = ids[i - 1];
        if (id !== "copper") {
            assert.equal(E.isUnlocked(s, id), false, `${id} is shut before ${below} is stocked`);
            s[below] = E.unlockNeed(s, id) * 1.01;
        }
        assert.equal(E.isUnlocked(s, id), true, `${id} opens once ${below} is stocked`);
        const now = ids.filter((x) => E.isUnlocked(s, x));
        assert.equal(now.length, order.length + 1 > now.length ? now.length : order.length + 1, `${id}: exactly one new zone`);
        for (const x of now) if (!order.includes(x)) order.push(x);
    }
    assert.deepEqual(order, ids.slice(0, ids.indexOf("origin") + 1), "unlock order equals zone order");
    for (const m of E.ARC_MATS) assert.equal(E.isUnlocked(s, m), false, `${m} stays shut before the first Handover`);
});

test("zones 18 to 25 open after the first Handover, in order, and never before", () => {
    assert.deepEqual([...E.ARC_MATS], ids.slice(17));
    const s = E.fresh(0);
    s.life.reboots = 1000;
    for (const m of E.MATS) s[m] = 1e30;
    for (const m of E.ARC_MATS) assert.equal(E.isUnlocked(s, m), false, `${m}: shut with a full stockpile before a Handover`);
    s.hand.count = 1;
    for (const m of E.ARC_MATS) s[m] = 0;
    let prev = "origin";
    s.origin = 1e30;
    for (const m of E.ARC_MATS) {
        assert.equal(E.isUnlocked(s, m), true, `${m} opens off ${prev} after a Handover`);
        s[m] = 1e30;
        prev = m;
    }
    // a zone that is producing stays open even when its stock is spent
    const t = E.fresh(0);
    t.hand.count = 1; t.prod.geodes = 1;
    assert.equal(E.isUnlocked(t, "geodes"), true);
});

test("every zone has a working button and finite cost at every tier", () => {
    const s = E.fresh(0);
    for (const id of ids.filter((x) => x !== "bytes")) for (let k = 0; k < E.TIERS; k++) {
        const b = E.button(s, id, k);
        assert.ok(Number.isFinite(b.cost) && b.cost > 0, `${id} tier ${k} cost`);
        assert.ok(Number.isFinite(b.gain) && b.gain > 0, `${id} tier ${k} gain`);
        assert.ok(ids.includes(b.pays), `${id} pays in a real zone`);
    }
});

test("goals that mention zones are not past the last zone", () => {
    const s = E.fresh(0);
    for (const g of E.GOALS) { const c = g.cur(s); assert.ok(Number.isFinite(c) && Number.isFinite(g.target) && g.target > 0, `goal ${g.id}`); }
});
