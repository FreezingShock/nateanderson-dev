// __NAME__ engine tests (npm run test:__SLUG__). Loads the real engine under node, no browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../../lib/__SLUG__/engine.ts";

test("a new run starts empty, with nothing owned and nothing producing", () => {
    const s = E.fresh(1000);
    assert.equal(s.amount, 0);
    assert.equal(s.earned, 0);
    assert.deepEqual(s.owned, E.GENERATORS.map(() => 0));
    assert.deepEqual(s.bought, E.UPGRADES.map(() => false));
    assert.equal(E.rate(s), 0);
    assert.equal(s.savedAt, 1000);
});

test("a tap gathers, counts the tap, and leaves the old state alone", () => {
    const s = E.fresh(0);
    const t = E.tap(s);
    assert.equal(t.amount, E.TAP_GAIN);
    assert.equal(t.earned, E.TAP_GAIN);
    assert.equal(t.tapped, 1);
    assert.equal(s.amount, 0);
});

test("generator prices are whole numbers that grow with every copy", () => {
    for (let i = 0; i < E.GENERATORS.length; i++) {
        let s = { ...E.fresh(0), amount: 1e300 };
        let last = 0;
        for (let n = 0; n < 15; n++) {
            const c = E.generatorCost(s, i);
            assert.ok(Number.isInteger(c));
            assert.ok(c > last);
            last = c;
            s = E.buyGenerator(s, i);
        }
    }
});

test("a generator is only bought when the stock covers its price", () => {
    const poor = { ...E.fresh(0), amount: E.generatorCost(E.fresh(0), 0) - 1 };
    assert.equal(E.buyGenerator(poor, 0), poor);
    const rich = { ...E.fresh(0), amount: E.generatorCost(E.fresh(0), 0) };
    const bought = E.buyGenerator(rich, 0);
    assert.equal(bought.owned[0], 1);
    assert.equal(bought.amount, 0);
});

test("an unknown generator index changes nothing", () => {
    const s = { ...E.fresh(0), amount: 1e9 };
    assert.equal(E.buyGenerator(s, 99), s);
    assert.equal(E.buyGenerator(s, -1), s);
});

test("production adds up every generator, and upgrades multiply it", () => {
    const s = { ...E.fresh(0), owned: [2, 1, 0] };
    const base = 2 * E.GENERATORS[0].baseRate + E.GENERATORS[1].baseRate;
    assert.equal(E.rate(s), base);
    const upgraded = { ...s, bought: [true, false] };
    assert.equal(E.rate(upgraded), base * E.UPGRADES[0].multiplier);
});

test("an upgrade is bought once, when affordable", () => {
    const poor = { ...E.fresh(0), amount: E.UPGRADES[0].cost - 1 };
    assert.equal(E.buyUpgrade(poor, 0), poor);
    const rich = { ...E.fresh(0), amount: E.UPGRADES[0].cost };
    const bought = E.buyUpgrade(rich, 0);
    assert.equal(bought.bought[0], true);
    assert.equal(bought.amount, 0);
    assert.equal(E.buyUpgrade({ ...bought, amount: 1e9 }, 0).amount, 1e9);
});

test("advance credits production for the time that passed", () => {
    const s = { ...E.fresh(0), owned: [4, 0, 0] };
    const later = E.advance(s, 60_000);
    assert.equal(later.amount, 4 * E.GENERATORS[0].baseRate * 60);
    assert.equal(later.earned, later.amount);
    assert.equal(later.savedAt, 60_000);
});

test("time away stops at the offline cap", () => {
    const s = { ...E.fresh(0), owned: [2, 0, 0] };
    const day = E.advance(s, 24 * 60 * 60 * 1000);
    assert.equal(day.amount, 2 * E.GENERATORS[0].baseRate * E.OFFLINE_CAP_SECONDS);
});

test("a clock that goes backwards earns nothing and changes nothing", () => {
    const s = { ...E.fresh(5000), owned: [3, 0, 0] };
    assert.equal(E.advance(s, 1000), s);
});

test("prestige needs a full unit of gathering, then pays the square root in points", () => {
    const short = { ...E.fresh(0), earned: E.PRESTIGE_UNIT - 1 };
    assert.equal(E.prestigeGain(short), 0);
    assert.equal(E.prestige(short, 0), short);
    const big = { ...E.fresh(0), earned: E.PRESTIGE_UNIT * 9, amount: 500, owned: [3, 1, 0], bought: [true, false], tapped: 12 };
    assert.equal(E.prestigeGain(big), 3);
    const reset = E.prestige(big, 99);
    assert.equal(reset.points, 3);
    assert.equal(reset.runs, 1);
    assert.equal(reset.amount, 0);
    assert.deepEqual(reset.owned, E.GENERATORS.map(() => 0));
    assert.deepEqual(reset.bought, E.UPGRADES.map(() => false));
    assert.equal(reset.tapped, 12);
    assert.equal(reset.savedAt, 99);
});

test("prestige points raise production for good", () => {
    const base = { ...E.fresh(0), owned: [1, 0, 0] };
    const withPoints = { ...base, points: 5 };
    assert.equal(E.rate(withPoints), E.rate(base) * (1 + 5 * E.PRESTIGE_BONUS));
});

test("save and load round-trip the state exactly", () => {
    const s = { ...E.fresh(0), amount: 12.5, earned: 99, tapped: 40, owned: [3, 2, 1], bought: [true, false], points: 2, runs: 1, savedAt: 777 };
    const back = E.parse(JSON.parse(E.serialize(s)));
    assert.deepEqual(back, s);
});

test("parse refuses anything it cannot rebuild", () => {
    const good = E.fresh(0);
    assert.equal(E.parse(null), null);
    assert.equal(E.parse("text"), null);
    assert.equal(E.parse({ amount: 1 }), null);
    assert.equal(E.parse({ ...good, amount: -1 }), null);
    assert.equal(E.parse({ ...good, owned: [1] }), null);
    assert.equal(E.parse({ ...good, owned: ["x", 0, 0] }), null);
    assert.equal(E.parse({ ...good, bought: [1, 0] }), null);
    assert.equal(E.parse({ ...good, savedAt: Number.NaN }), null);
});

test("formatAmount shows whole numbers small and short forms large, without a rounded 1000", () => {
    assert.equal(E.formatAmount(0), "0");
    assert.equal(E.formatAmount(999), "999");
    assert.equal(E.formatAmount(1500), "1.50K");
    assert.equal(E.formatAmount(42_000_000), "42.0M");
    assert.equal(E.formatAmount(999_999), "1.00M");
});
