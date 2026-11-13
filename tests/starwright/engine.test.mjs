// Starwright engine tests (run with npm run test:nodefarm). Loads the real engine under node.
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const E = await import(resolve(root, "lib/starwright/engine.ts"));
const D = await import(resolve(root, "lib/starwright/data.ts"));
const C = await import(resolve(root, "lib/starwright/commands.ts"));

const ok = (s) => s.amt.every((v) => Number.isFinite(v) && v >= 0) && Number.isFinite(s.heat);

test("a fresh star burns without NaN for a long catch-up", () => {
    const s = E.fresh(0);
    for (let i = 0; i < D.ROWS; i++) for (let k = 0; k < D.TIERS; k++) s.bought[i][k] = 20;
    E.catchUp(s, 24 * 3600);
    assert.ok(ok(s));
    assert.ok(s.heat > 0);
});

test("buying a tier pays in its own element and adds levels", () => {
    const s = E.fresh(0);
    s.amt[0] = 1e6;
    const c = E.cost(s, 0, 1);
    assert.ok(E.buy(s, 0, 1));
    assert.equal(s.amt[0], 1e6 - c);
    assert.equal(E.levels(s, 0), 10);
    assert.equal(E.buy(fresh0(), 0, 0), true);
});
function fresh0() { const s = E.fresh(0); s.amt[0] = 100; return s; }

test("hydrogen fuses into helium only once hot enough, and conserves nothing it cannot afford", () => {
    const s = E.fresh(0);
    s.bought[0][0] = 5;
    s.amt[0] = 400;
    s.heat = 0;
    const f = E.effects(s);
    // cold: no helium
    const cold = E.fresh(0); cold.bought[0][0] = 5; cold.amt[0] = 400; cold.mass = 1;
    E.step(cold, 1, E.effects(cold));
    assert.equal(cold.amt[1], 0);
    s.heat = 50;
    E.step(s, 0.001, f);
    s.heat = 50;
    E.step(s, 1, f);
    assert.ok(s.amt[1] > 0);
    assert.ok(ok(s));
});

test("supernova needs a full collapse, pays stardust, keeps perks and resets the star", () => {
    const s = E.fresh(0);
    assert.equal(E.supernova(s), 0);
    s.amt[7] = 5000;
    s.perks = ["l1"];
    const g = E.supernova(s);
    assert.ok(g > 0);
    assert.equal(s.stardust, g);
    assert.deepEqual(s.perks, ["l1"]);
    assert.equal(s.amt[7], 0);
    assert.equal(s.novas, 1);
    assert.ok(E.feNeed(s, E.effects(s)) > D.TUNE.feNeed * 0.9); // the next collapse asks for more
});

test("planets survive a supernova only with Survivors", () => {
    const a = E.fresh(0); a.planets = ["ember"]; a.amt[7] = 5000; E.supernova(a);
    assert.deepEqual(a.planets, []);
    const b = E.fresh(0); b.planets = ["ember"]; b.perks = ["w3"]; b.amt[7] = 5000; E.supernova(b);
    assert.deepEqual(b.planets, ["ember"]);
});

test("neutron star resets stardust and perks, opens the heavy rows; black hole resets all but singularities", () => {
    const s = E.fresh(0);
    assert.equal(E.rowOpen(s, 7), false);
    s.sdLayer = 5000; s.stardust = 100; s.perks = ["l1", "k1"];
    const n = E.neutronStar(s);
    assert.ok(n >= 2);
    assert.equal(s.stardust, 0);
    assert.deepEqual(s.perks, []);
    assert.equal(E.rowOpen(s, 7), true);
    s.amt[9] = 1e9;
    assert.equal(E.blackHole(s), true);
    assert.equal(s.sing, 1);
    assert.equal(s.neutronStars, 0);
    assert.equal(E.rowOpen(s, 7), false);
    assert.ok(E.effects(s).global >= 2);
});

test("perks need their neighbours and enough stardust", () => {
    const s = E.fresh(0);
    s.stardust = 1000;
    assert.equal(E.buyPerk(s, "l2"), false);
    assert.equal(E.buyPerk(s, "l1"), true);
    assert.equal(E.buyPerk(s, "l2"), true);
    s.stardust = 0;
    assert.equal(E.buyPerk(s, "l3"), false);
});

test("saves round-trip, drop unknown fields and refuse junk", () => {
    const s = E.fresh(0);
    s.amt[3] = 123; s.perks = ["l1", "nope"]; s.planets = ["haze"];
    const back = E.parse(JSON.parse(E.serialize(s)));
    assert.equal(back.amt[3], 123);
    assert.deepEqual(back.perks, ["l1"]);
    assert.deepEqual(back.planets, ["haze"]);
    assert.equal(E.parse({}), null);
    assert.equal(E.parse(null), null);
    const bad = E.parse({ amt: [NaN, "x", Infinity], bought: [] });
    assert.ok(ok(bad));
});

test("console commands read and act on a star", () => {
    const s = E.fresh(0);
    s.amt[0] = 1e5;
    assert.match(C.swCommand(s, ["stats"]).lines[0].t, /Sol-7/);
    const r = C.swCommand(s, ["fuse", "h", "2"]);
    assert.equal(r.changed, true);
    assert.equal(E.levels(s, 0), 10);
    assert.equal(C.swCommand(s, ["collapse"]).changed, false);
    assert.equal(C.swCommand(s, ["name", "Vega"]).changed, true);
    assert.equal(s.name, "Vega");
});
