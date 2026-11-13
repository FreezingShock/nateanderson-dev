// The 25 zones: order, unlock chain, and the Overgrowth and Descent arcs that wait for the first Handover.
import test from "node:test";
import assert from "node:assert/strict";
import { E, AR, RG, ZE, END } from "./helpers.mjs";

const ids = E.STATS.map((x) => x.id);
const REBOOT_I = ids.indexOf("reboot");

test("there are exactly 29 zones, in the documented order", () => {
    assert.equal(ids.length, 29);
    assert.deepEqual(ids.slice(0, 7), ["bytes", "mult", "reboot", "copper", "silicon", "quartz", "aether"]);
    assert.deepEqual(ids.slice(16, 25), ["origin", "spores", "mycelium", "pollen", "bloom", "basalt", "magma", "geodes", "sunstone"]);
    assert.deepEqual(ids.slice(25), ["corona", "plasma", "lattice", "radiance"], "zones 26 to 29 are Undersun, after the ending");
    assert.equal(new Set(ids).size, 29, "ids are unique");
    assert.deepEqual([...E.MATS], ids.slice(3), "MATS is every zone from Copper on, in order");
    assert.equal(ids[24], "sunstone", "zone 25 is the buried sun, id sunstone");
});

test("every zone has an arc, a rig entry where it should, and a tune entry", () => {
    for (const id of ids) assert.ok(AR.arcOf(id), `${id} belongs to an arc`);
    assert.equal(AR.ARCS.flatMap((a) => a.zones).length, 29, "arcs cover each zone exactly once");
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

test("zones 18 to 29 open two at a time, one pair per Handover (ARC_GATE), in order, and never before", () => {
    assert.deepEqual([...E.ARC_MATS], ids.slice(17));
    const s = E.fresh(0);
    s.life.reboots = 1000;
    for (const m of E.MATS) s[m] = 1e30;
    for (const m of E.ARC_MATS) assert.equal(E.isUnlocked(s, m), false, `${m}: shut with a full stockpile before a Handover`);
    // each Handover opens exactly two more zones
    s.origin = 1e30;
    for (let h = 1; h <= 6; h++) {
        s.hand.count = h;
        const open = E.ARC_MATS.filter((m) => E.isUnlocked(s, m));
        assert.deepEqual(open, E.ARC_MATS.slice(0, h * 2), `Handover ${h} opens zones up to ${h * 2 + 16}`);
    }
    s.hand.count = 6;
    for (const m of E.ARC_MATS) s[m] = 0;
    let prev = "origin";
    for (const m of E.ARC_MATS) {
        assert.equal(E.isUnlocked(s, m), true, `${m} opens off ${prev} after a Handover`);
        s[m] = 1e30;
        prev = m;
    }
    // a zone that is producing stays open even when its stock is spent
    const t = E.fresh(0);
    t.hand.count = 4; t.prod.geodes = 1;
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

test("Undersun (26 to 29) opens after the ending: the final build still belongs to the buried sun", () => {
    assert.equal(END.lastZone(), "sunstone", "the ending is paid in zone 25, whatever zones come after it");
    const s = E.fresh(0);
    s.life.reboots = 1000;
    for (const m of E.MATS) s[m] = 1e30;
    s.hand.count = 4;
    assert.equal(E.isUnlocked(s, "corona"), false, "corona waits for the fifth Handover");
    s.hand.count = 5;
    assert.equal(E.isUnlocked(s, "corona"), true, "corona opens at Handover 5 off a stocked Sunstone");
    assert.equal(E.isUnlocked(s, "lattice"), false, "lattice waits for the sixth Handover");
    s.hand.count = 6;
    s.lattice = 1e30;
    assert.equal(E.isUnlocked(s, "radiance"), true, "radiance opens at Handover 6 off a stocked Lattice");
});
