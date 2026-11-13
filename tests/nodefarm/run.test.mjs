// Simulated play: no NaN, no infinity, no negative balances, and lifetime totals that do not depend on the tick size.
import test from "node:test";
import assert from "node:assert/strict";
import { E, AD, OFF, maxed, play, problems, loadFixture, fixtureNames, clone } from "./helpers.mjs";

test("a bot playing a fresh game for 4 hours (with Ascends) never produces NaN, Infinity or a negative balance", () => {
    const s = E.fresh(0);
    const bad = [];
    play(s, 4 * 3600, { ascend: true, each: (st, t) => { if (t % 30 === 0) { const p = problems(st); if (p.length) bad.push(`t=${t}: ${p.slice(0, 3)}`); } } });
    assert.deepEqual(bad.slice(0, 3), []);
    assert.ok(s.life.reboots > 20, "the bot actually progressed");
    assert.ok(s.life.bytes > 1e6);
});

test("a late-game state ticking for 1 hour stays finite and non-negative", () => {
    const s = maxed();
    const bad = [];
    for (let t = 0; t < 3600; t += 2) { E.tick(s, 2); if (t % 60 === 0) { const p = problems(s); if (p.length) bad.push(`t=${t}: ${p.slice(0, 3)}`); } }
    assert.deepEqual(bad.slice(0, 3), []);
});

test("the Ascend, Handover, Ascend loop keeps every number sane", () => {
    const s = maxed();
    AD.ownAllFw(s);
    for (let cycle = 0; cycle < 2; cycle++) {
        for (let t = 0; t < 300; t++) E.tick(s, 2);
        assert.deepEqual(problems(s), [], `before handover ${cycle}`);
        s.prod.origin = Math.max(s.prod.origin, 5); s.origin = Math.max(s.origin, 1e6);
        assert.ok(E.handover(s, "wren", "", "osk") >= 1, `handover ${cycle}`);
        assert.deepEqual(problems(s), [], `after handover ${cycle}`);
        for (let t = 0; t < 600; t++) E.tick(s, 1);
        s.aether = Math.max(s.aether, E.ascendNeed(s));
        if (E.canAscend(s)) E.ascend(s);
        assert.deepEqual(problems(s), [], `after ascend ${cycle}`);
    }
    assert.equal(s.hand.count, 2);
});

// Zone events draw from Math.random, so each run gets the same seed: otherwise a 24 h absence (capped to 8 h) and an 8 h one
// differ by the random draws alone, and "a longer absence is never worth less" fails on luck.
function seeded(seed, fn) {
    const real = Math.random;
    let a = seed >>> 0;
    Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    try { return fn(); } finally { Math.random = real; }
}

test("away time: 10 min, 1 h, 8 h and 24 h at several stages give finite, non-negative gains within the cap", () => {
    const stages = [["early", loadFixture("release-early.json")], ["deep", loadFixture("release-deep.json")], ["maxed", maxed()]];
    for (const [name, base] of stages) {
        let last = -1;
        for (const secs of [600, 3600, 8 * 3600, 24 * 3600]) {
            const s = clone(base);
            const cap = E.derive(s).offlineCap;
            const r = seeded(7, () => E.offline(s, secs));
            const label = `${name} ${secs}s`;
            assert.deepEqual(problems(s), [], label);
            assert.ok(r.secs <= cap + 1e-6 && r.secs <= secs, `${label}: counted time within cap`);
            assert.equal(r.capped, secs > cap, `${label}: capped flag`);
            for (const [k, v] of Object.entries(r.gain)) assert.ok(Number.isFinite(v), `${label}: gain ${k} finite`);
            assert.ok(r.gain.bytes >= -1e-6 || s.life.reboots > base.life.reboots, `${label}: Bytes do not shrink unless a Reboot ran`);
            assert.ok(s.life.bytes >= base.life.bytes, `${label}: lifetime Bytes never drop`);
            assert.ok(s.life.bytes >= last, `${label}: a longer absence is never worth less`);
            last = s.life.bytes;
            const away = seeded(7, () => OFF.catchUp(clone(base), secs));
            assert.deepEqual(nonFin(away), [], `${label}: report has no NaN`);
        }
    }
});
const nonFin = (v, p = "away", out = []) => { if (typeof v === "number") { if (!Number.isFinite(v)) out.push(p); } else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) nonFin(x, `${p}.${k}`, out); return out; };

// The live game ticks at 0.1 s, offline steps are 10-20 s. Lifetime totals must agree. Bytes in hand is a sawtooth (every Reboot resets it),
// so only lifetime Bytes, presses and Reboots are compared. Measured spread today is under 7%; the limit leaves room for rounding, not for drift.
test("tick-size independence: lifetime Bytes, presses and Reboots agree between 0.1 s and 4 s ticks", () => {
    for (const name of fixtureNames()) {
        const results = [0.1, 0.5, 1, 4].map((dt) => { const s = loadFixture(name); for (let t = 0; t < 1800; t += dt) E.tick(s, dt); return { dt, bytes: s.life.bytes, presses: s.life.presses, reboots: s.life.reboots }; });
        const ref = results[0];
        for (const r of results) {
            assert.ok(Math.abs(r.bytes / ref.bytes - 1) < 0.1, `${name}: lifetime Bytes at dt ${r.dt} is ${r.bytes} vs ${ref.bytes} at 0.1`);
            assert.ok(Math.abs(r.presses - ref.presses) <= Math.max(2, ref.presses * 0.01), `${name}: presses at dt ${r.dt} ${r.presses} vs ${ref.presses}`);
            assert.ok(Math.abs(r.reboots - ref.reboots) <= Math.max(1, ref.reboots * 0.02), `${name}: reboots at dt ${r.dt} ${r.reboots} vs ${ref.reboots}`);
        }
    }
});
