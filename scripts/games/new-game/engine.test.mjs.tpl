// __NAME__ engine tests (npm run test:__SLUG__). Loads the real engine under node, no browser.
// The engine imports the shared kit by relative path with no extension, so the resolve hook adds ".ts" as the kit tests do.
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const E = await import(resolve(root, "lib/__SLUG__/engine.ts"));

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `expected ${a} to be within ${eps} of ${b}`);

test("a new run starts empty, with nothing owned and nothing producing", () => {
    const s = E.fresh(1000);
    assert.equal(s.amount, 0);
    assert.equal(s.earned, 0);
    assert.deepEqual(s.owned, E.GENERATORS.map(() => 0));
    assert.deepEqual(s.bought, []);
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
            assert.ok(c > last);
            last = c;
            s = E.buyGenerator(s, i);
        }
    }
});

test("a generator is only bought when the stock covers its price", () => {
    const price = E.generatorCost(E.fresh(0), 0);
    const poor = { ...E.fresh(0), amount: price - 1 };
    assert.equal(E.buyGenerator(poor, 0), poor);
    const bought = E.buyGenerator({ ...E.fresh(0), amount: price }, 0);
    assert.equal(bought.owned[0], 1);
    assert.equal(bought.amount, 0);
});

test("an unknown generator index changes nothing", () => {
    const s = { ...E.fresh(0), amount: 1e9 };
    assert.equal(E.buyGenerator(s, 99), s);
    assert.equal(E.buyGenerator(s, -1), s);
});

test("the bottom tier makes stock, and each higher tier makes the one below it", () => {
    const s = { ...E.fresh(0), owned: [0, 1, 1] };
    const after = E.advance({ ...s, savedAt: 0 }, 1000);
    assert.ok(after.owned[0] > 0, "the Rig made Runners");
    assert.ok(after.owned[1] > 1, "the Plant made Rigs");
    assert.equal(after.owned[2], 1, "the top tier is not made by anything");
});

test("upgrades multiply every generator, once each", () => {
    const base = { ...E.fresh(0), owned: [2, 0, 0] };
    const bought = { ...base, bought: ["tools"] };
    near(E.rate(bought), E.rate(base) * E.UPGRADES[0].mult);
    const cannotAgain = E.buyUpgrade({ ...bought, amount: 1e9 }, 0);
    assert.equal(cannotAgain.bought.length, 1, "an upgrade is only bought once");
});

test("an upgrade is only bought when affordable", () => {
    const poor = { ...E.fresh(0), amount: E.UPGRADES[0].cost - 1 };
    assert.equal(E.buyUpgrade(poor, 0), poor);
    const bought = E.buyUpgrade({ ...E.fresh(0), amount: E.UPGRADES[0].cost }, 0);
    assert.deepEqual(bought.bought, ["tools"]);
    assert.equal(bought.amount, 0);
});

test("advance credits production for the time that passed", () => {
    const s = { ...E.fresh(0), owned: [4, 0, 0] };
    const later = E.advance(s, 60_000);
    near(later.amount, 4 * E.GENERATORS[0].rate * 60);
    near(later.earned, later.amount);
    assert.equal(later.savedAt, 60_000);
});

test("a live tick of a fraction of a second is played, not dropped", () => {
    const s = { ...E.fresh(0), owned: [10, 0, 0] };
    const tick = E.advance(s, 100);
    near(tick.amount, 10 * E.GENERATORS[0].rate * 0.1);
});

test("time away stops at the offline cap", () => {
    const s = { ...E.fresh(0), owned: [2, 0, 0] };
    const day = E.advance(s, 24 * 60 * 60 * 1000);
    near(day.amount, 2 * E.GENERATORS[0].rate * E.OFFLINE_CAP_SECONDS);
});

test("a clock that goes backwards earns nothing and changes nothing", () => {
    const s = { ...E.fresh(5000), owned: [3, 0, 0] };
    assert.equal(E.advance(s, 1000), s);
});

test("prestige needs a full unit of gathering, then pays the square root in points", () => {
    const short = { ...E.fresh(0), earned: E.PRESTIGE_UNIT - 1 };
    assert.equal(E.prestigeGainNow(short), 0);
    assert.equal(E.prestige(short, 0), short);
    const big = { ...E.fresh(0), earned: E.PRESTIGE_UNIT * 9, amount: 500, owned: [3, 1, 0], bought: ["tools"], tapped: 12 };
    assert.equal(E.prestigeGainNow(big), 3);
    const reset = E.prestige(big, 99);
    assert.equal(reset.points, 3);
    assert.equal(reset.runs, 1);
    assert.equal(reset.amount, 0);
    assert.equal(reset.earned, 0);
    assert.deepEqual(reset.owned, E.GENERATORS.map(() => 0));
    assert.deepEqual(reset.bought, []);
    assert.equal(reset.tapped, 12);
    assert.equal(reset.savedAt, 99);
});

test("prestige points raise production for good", () => {
    const base = { ...E.fresh(0), owned: [1, 0, 0] };
    const withPoints = { ...base, points: 5 };
    near(E.rate(withPoints), E.rate(base) * (1 + 5 * E.PRESTIGE_BONUS));
});

test("the prestige meter is between 0 and 1", () => {
    const m = E.prestigeMeter({ ...E.fresh(0), earned: E.PRESTIGE_UNIT * 2.5 });
    assert.ok(m >= 0 && m <= 1);
});

test("save and load round-trip the state exactly", () => {
    const s = { ...E.fresh(0), amount: 12.5, earned: 99, tapped: 40, owned: [3, 2.5, 1], bought: ["shifts"], points: 2, runs: 1, savedAt: 777 };
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
    assert.equal(E.parse({ ...good, bought: ["no-such-upgrade"] }), null);
    assert.equal(E.parse({ ...good, bought: [1] }), null);
    assert.equal(E.parse({ ...good, savedAt: Number.NaN }), null);
});

test("fmt shows whole numbers small and short forms large", () => {
    assert.equal(E.fmt(0), "0");
    assert.equal(E.fmt(999), "999");
    assert.equal(E.fmt(1500), "1.50K");
    assert.equal(E.fmt(42_000_000), "42.0M");
});
