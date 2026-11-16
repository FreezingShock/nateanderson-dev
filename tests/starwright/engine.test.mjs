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

test("planets come through a supernova young, or at their age with Survivors, and a neutron star clears them", () => {
    const a = E.fresh(0); a.planets = ["ember"]; a.planetAge = { ember: 500 }; a.amt[7] = 5000; E.supernova(a);
    assert.deepEqual(a.planets, ["ember"]);
    assert.equal(a.planetAge.ember, 0);
    const b = E.fresh(0); b.planets = ["ember"]; b.planetAge = { ember: 500 }; b.perks = ["w3"]; b.amt[7] = 5000; E.supernova(b);
    assert.deepEqual(b.planets, ["ember"]);
    assert.equal(b.planetAge.ember, 500);
    const c = E.fresh(0); c.planets = ["ember"]; c.sdLayer = D.TUNE.neutronAt; E.neutronStar(c);
    assert.deepEqual(c.planets, []);
});

test("neutron star resets stardust and perks, opens the heavy rows; black hole resets all but singularities", () => {
    const s = E.fresh(0);
    assert.equal(E.rowOpen(s, 7), false);
    s.sdLayer = D.TUNE.neutronAt; s.stardust = 100; s.perks = ["l1", "k1"];
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

test("a visitor arrives after the first wait, answers pay, and the star stays finite", () => {
    const s = E.fresh(0);
    for (let n = 0; n < D.EVENT_FIRST + 2; n++) E.step(s, 1);
    assert.ok(s.event, "a visitor is waiting");
    const before = E.levels(s, 0);
    const ev = E.eventOf(s);
    assert.equal(ev.opts.length, 2);
    const o = E.answer(s, 1);
    assert.ok(o);
    assert.equal(s.event, null);
    assert.equal(s.visitors, 1);
    assert.equal(E.levels(s, 0), before);
    assert.ok(s.evIn > 60);
    assert.ok(ok(s));
});

test("every visitor option does something and none breaks the numbers", () => {
    for (const ev of D.EVENTS) for (let i = 0; i < 2; i++) {
        const s = E.fresh(0);
        s.bought[0][0] = 10;
        s.event = { id: ev.id, left: 100 };
        const m0 = s.mass;
        E.answer(s, i);
        assert.ok(s.mass > m0 || s.buffs.length > 0, `${ev.id}/${i} had an effect`);
        for (let t = 0; t < 200; t++) E.step(s, 1);
        assert.ok(ok(s));
        assert.ok(s.buffs.every((b) => b.left > 0), "buffs expire");
    }
});

test("time away never spawns a visitor", () => {
    const s = E.fresh(0);
    E.catchUp(s, 3600);
    assert.equal(s.event, null);
});

test("buffs raise the effects while they last", () => {
    const s = E.fresh(0);
    const base = E.effects(s).fuse;
    s.event = { id: "comet", left: 100 };
    E.answer(s, 1);
    assert.equal(E.effects(s).fuse, base * 2);
    for (let t = 0; t < 61; t++) E.step(s, 1);
    assert.equal(E.effects(s).fuse, base);
});

test("birth clouds are offered after the second star, chosen once, and last one star", () => {
    const s = E.fresh(0);
    s.amt[7] = 1e6;
    E.supernova(s);
    assert.equal(s.offer.length, 3, "offered from the first supernova on");
    const id = s.offer[0];
    assert.ok(E.chooseCloud(s, id));
    assert.equal(s.cloud, id);
    assert.equal(s.cloudsPicked, 1);
    assert.equal(E.chooseCloud(s, id), false);
    s.amt[7] = 1e9;
    E.supernova(s);
    assert.equal(s.cloud, "");
    assert.equal(s.offer.length, 3);
});

test("each cloud changes the effects in the way it says", () => {
    for (const c of D.CLOUDS) {
        const s = E.fresh(0);
        const base = E.effects(s);
        s.cloud = c.id;
        const f = E.effects(s);
        for (const k of Object.keys(c.fx)) assert.notEqual(f[k], base[k], `${c.id} moves ${k}`);
        assert.ok(Object.values(f).every(Number.isFinite));
    }
});

test("milestones award once, add 2% each, and survive a save", () => {
    const s = E.fresh(0);
    s.bought[0][0] = 30;
    const got = E.checkAch(s);
    assert.ok(got.includes("flame") && got.includes("l25"));
    assert.deepEqual(E.checkAch(s), []);
    const base = E.fresh(0);
    assert.ok(Math.abs(E.effects(s).global / E.effects(base).global - (1 + D.ACH_BONUS * s.ach.length)) < 1e-9);
    const back = E.parse(JSON.parse(E.serialize(s)));
    assert.deepEqual(back.ach, s.ach);
    assert.deepEqual(back.found, s.found);
});

test("the codex records an element once it exists", () => {
    const s = E.fresh(0);
    assert.deepEqual(s.found, ["H"]);
    s.amt[1] = 5;
    E.step(s, 1);
    assert.ok(s.found.includes("He"));
    assert.ok(D.ELEMENTS.every((e) => typeof D.CODEX[e.sym] === "string"));
});

test("saves keep a waiting visitor and drop damaged new fields", () => {
    const s = E.fresh(0);
    s.event = { id: "flare", left: 90 };
    s.buffs = [{ k: "heat", v: 2, secs: 60, name: "A flare builds", left: 30 }];
    const back = E.parse(JSON.parse(E.serialize(s)));
    assert.equal(back.event.id, "flare");
    assert.equal(back.buffs.length, 1);
    const bad = E.parse({ ...JSON.parse(E.serialize(s)), event: { id: "nope" }, buffs: [{ k: "mass", v: 9, name: "x", left: 5 }], cloud: "zzz", ach: ["x"], offer: ["y"] });
    assert.equal(bad.event, null);
    assert.deepEqual(bad.buffs, []);
    assert.equal(bad.cloud, "");
    assert.deepEqual(bad.ach, []);
});

test("console: visitor, cloud and almanac", () => {
    const s = E.fresh(0);
    assert.match(C.swCommand(s, ["visitor"]).lines[0].t, /nothing/);
    s.event = { id: "comet", left: 100 };
    const r = C.swCommand(s, ["visitor", "1"]);
    assert.ok(r.changed);
    assert.ok(C.swCommand(s, ["almanac"]).lines.length > 5);
});

test("planets grow through four stages with time in orbit and pay more for it", () => {
    const s = E.fresh(0);
    s.amt[2] = 1e6;
    assert.ok(E.buyPlanet(s, "ember"));
    assert.equal(E.planetStage(s, "ember"), 0);
    const f0 = E.effects(s).inflow;
    for (let t = 0; t < D.PLANET_STAGE_AT[2] + 5; t++) E.step(s, 1);
    assert.equal(E.planetStage(s, "ember"), 2);
    assert.ok(E.effects(s).inflow > f0 * (1 + 0), "bonus grows");
    const back = E.parse(JSON.parse(E.serialize(s)));
    assert.equal(E.planetStage(back, "ember"), 2);
    s.amt[7] = 1e9;
    E.supernova(s);
    assert.equal(s.planetAge.ember, 0, "a supernova sets planets back to young");
    assert.ok(D.PLANETS.every((p) => p.stages.length === 4 && p.look));
});

test("the guide always says something useful and the collapse estimate follows the iron flow", () => {
    const s = E.fresh(0);
    let f = E.effects(s);
    assert.match(E.guide(s, f), /^Start here: buy a hydrogen burner \(key 1, 18\s+H\)/);
    // once the first burner is bought the line moves on to helium, so a new player always has the next step
    const first = E.fresh(0);
    E.buy(first, 0, 0);
    assert.match(E.guide(first, E.effects(first)), /^Next: burn helium into /);
    for (let i = 0; i < D.ROWS; i++) s.bought[i][0] = 1;
    s.amt = s.amt.map(() => 0);
    f = E.effects(s);
    s.flow = Array(D.N).fill(0);
    assert.equal(E.collapseEta(s, f), null);
    assert.match(E.guide(s, f), /not reaching iron/);
    s.flow[7] = 10;
    s.amt[7] = 100;
    const eta = E.collapseEta(s, f);
    assert.ok(Math.abs(eta - (E.feNeed(s, f) - 100) / 10) < 1e-9);
    assert.match(E.guide(s, f), /Iron 100 of .*to the collapse/);
    s.amt[7] = 1e9;
    assert.equal(E.collapseEta(s, f), 0);
    assert.match(E.guide(s, f), /The core is ready/);
});

test("the first visitor comes early and the deep rows are within reach of a first star", () => {
    assert.ok(D.EVENT_FIRST <= 45);
    // a plain player (acts every 10 s, buys the biggest tier affordable) collapses the first star in about 18 minutes (median).
    // Visitor timing and events use Math.random, so the run is seeded: a few percent of unseeded runs landed just past 25 minutes
    // and made this test flaky on CI. Over 1000 unseeded runs: median 1092 s, 99% under 1491 s, worst 1592 s.
    const realRandom = Math.random;
    const times = [];
    try {
        for (let seed = 1; seed <= 20; seed++) {
            let a = seed * 2654435761 >>> 0;
            Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            const s = E.fresh(0);
            let t = 0;
            while (t < 2400 && !E.canSupernova(s, E.effects(s))) {
                t++;
                E.step(s, 1);
                if (s.event && t % 8 === 0) E.answer(s, 0);
                if (t % 10) continue;
                for (let i = D.ROWS - 1; i >= 0; i--) for (let k = D.TIERS - 1; k >= 0; k--) { let n = 0; while (n++ < 30 && E.cost(s, i, k) <= s.amt[i] * 0.9) E.buy(s, i, k); }
            }
            times.push(t);
        }
    } finally { Math.random = realRandom; }
    times.sort((x, y) => x - y);
    assert.ok(times[10] <= 1300, `median first collapse ${times[10]} s`);
    assert.ok(times[times.length - 1] <= 1800, `slowest first collapse ${times[times.length - 1]} s`);
});

test("deep stars: endless stardust sink, each adds to everything, cleared by a neutron star, old saves load", () => {
    const s = E.fresh(0);
    const g0 = E.effects(s).global;
    s.stardust = 1e6;
    const c1 = E.deepCost(s);
    assert.ok(E.buyDeep(s));
    assert.equal(s.stardust, 1e6 - c1);
    assert.ok(E.deepCost(s) > c1);
    assert.ok(Math.abs(E.effects(s).global - g0 * (1 + D.TUNE.deepBonus)) < 1e-9);
    assert.equal(E.buyDeep(E.fresh(0)), false);
    const back = E.parse(JSON.parse(E.serialize(s)));
    assert.equal(back.deep, 1);
    const old = JSON.parse(E.serialize(E.fresh(0))); delete old.deep;
    assert.equal(E.parse(old).deep, 0);
    s.sdLayer = D.TUNE.neutronAt;
    E.neutronStar(s);
    assert.equal(s.deep, 0);
});

test("after a neutron star, a player who stays and chases uranium reaches the black hole in about two hours", () => {
    const s = E.fresh(0);
    s.neutronStars = 1; s.neutronStarsAll = 1; s.neutrons = 6; s.pulsar = ["p1"]; s.perks = D.PERKS.map((p) => p.id);
    let t = 0;
    while (t < 4 * 3600 && !E.canBlackHole(s, E.effects(s))) {
        t++;
        E.step(s, 1);
        if (s.event && t % 8 === 0) E.answer(s, 0);
        if (t % 10) continue;
        for (let i = D.ROWS - 1; i >= 0; i--) for (let k = D.TIERS - 1; k >= 0; k--) { let n = 0; while (n++ < 30 && E.cost(s, i, k) <= s.amt[i] * 0.9) E.buy(s, i, k); }
    }
    assert.ok(E.canBlackHole(s, E.effects(s)), "black hole within four hours of the neutron star");
});

test("sw deep lists and buys deep stars", () => {
    const s = E.fresh(0);
    assert.equal(C.swCommand(s, ["deep", "buy"]).changed, false);
    s.stardust = 1e5;
    const r = C.swCommand(s, ["deep", "buy"]);
    assert.ok(r.changed);
    assert.equal(s.deep, 1);
    assert.match(C.swCommand(s, ["deep"]).lines.at(-1).t, /deep stars 1/);
});
