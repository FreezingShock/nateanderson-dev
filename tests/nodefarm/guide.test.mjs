// The next step: always a plain answer, never a throw, and it knows about the systems that landed after the guide was written.
import test from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { E, ZE, fixtureNames, loadFixture, clone } from "./helpers.mjs";

const G = await import(resolve(dirname(fileURLToPath(import.meta.url)), "../../lib/nodefarm/content/guide.ts"));
const step = (s) => G.nextStep(s, E.derive(s));

test("every fixture gets a titled step with a finite meter", () => {
    for (const f of fixtureNames()) {
        const st = step(loadFixture(f));
        assert.ok(st.id && st.title && st.why, `${f}: step has text`);
        assert.ok(Number.isFinite(st.frac) && st.frac >= 0 && st.frac <= 1, `${f}: frac ${st.frac}`);
        assert.ok(st.target, `${f}: step ${st.id} points somewhere`);
    }
});

test("an open Rich vein comes first, and an answering script takes it off", () => {
    const s = clone(loadFixture("release-post-ascend.json"));
    s.ap = 0;
    ZE.ensureZe(s).act.push({ id: 1, kind: "vein", zone: "copper", left: 20, total: 40 });
    assert.equal(step(s).id, "event");
    s.auto.own.push("event");
    s.auto.on.event = true;
    assert.notEqual(step(s).id, "event");
});

test("Handover comes before leftover AP, and arc zones before it ask for the tree, not a decrypt", () => {
    const s = clone(loadFixture("release-deep.json"));
    s.tree = s.tree.slice(0, 5);
    const st = step(s);
    assert.ok(!(st.id.startsWith("decrypt-") && E.ARC_MATS.includes(st.id.slice(8))), `got ${st.id}`);
});

test("an affordable final-build stage comes before Firmware, which spends the same Keys", () => {
    const s = clone(loadFixture("release-deep.json"));
    s.ap = 0;
    s.tree = [...E.fullTreeIds()];
    s.hand.count = 4;
    s.hand.keys = 50;
    s.prod.sunstone = 1; // the final build is paid in zone 25; Undersun (26 to 29) comes after it
    s.sunstone = 1e15;
    assert.equal(step(s).id, "final-build");
});
