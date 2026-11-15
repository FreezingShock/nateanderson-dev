// Groundbreak engine tests (run with npm run test:nodefarm). Loads the real engine under node.
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const E = await import(resolve(root, "lib/groundbreak/engine.ts"));
const D = await import(resolve(root, "lib/groundbreak/data.ts"));
const C = await import(resolve(root, "lib/groundbreak/commands.ts"));

const finite = (s) => s.amt.every((v) => Number.isFinite(v) && v >= 0) && Number.isFinite(s.cash) && s.cash >= 0 && Number.isFinite(s.rep);
function run(s, secs, dt = 1) { for (let t = 0; t < secs; t += dt) E.step(s, dt); }

test("data tables are the right shape", () => {
    assert.equal(D.MATS.length, D.N);
    for (const a of [D.UNLOCK_COST, D.RECIPE, D.BASE_RATE, D.CREW_COST, D.EQUIP_COST, D.METHOD_COST]) assert.equal(a.length, D.N);
    assert.equal(D.JOBS.length, 13);
    assert.equal(D.JOBS.at(-1).id, "bridge");
    assert.ok(D.JOBS.at(-1).ending);
    for (const j of D.JOBS) { assert.ok(j.needs.length > 0); assert.ok(j.stage >= 1 && j.stage <= 5); }
    for (const p of D.PERKS) for (const r of p.req) assert.ok(D.PERKS.some((x) => x.id === r), `${p.id} requires missing ${r}`);
    for (const c of D.CITIES) assert.equal(c.sites.length, 5);
});

test("a fresh firm starts with one gravel crew and makes gravel", () => {
    const s = E.fresh(0);
    assert.equal(s.crews[0], 1);
    run(s, 10);
    assert.ok(s.amt[0] > D.TUNE.startGravel);
    assert.ok(finite(s));
});

test("buying tiers spends the right currency and adds levels", () => {
    const s = E.fresh(0);
    s.amt[0] = 1e6;
    const c = E.tierCost(s, 0, 0);
    assert.equal(c.cur, "mat");
    assert.ok(E.buy(s, 0, 0));
    assert.equal(s.crews[0], 2);
    assert.ok(Math.abs(s.amt[0] - (1e6 - c.amount)) < 1e-6);
    assert.ok(E.buy(s, 0, 1));
    assert.equal(s.equip[0], 1);
    assert.equal(E.equipMult(s, 0), 2);
    assert.equal(E.canBuy(s, 0, 2), false, "method needs equipment levels first");
    s.equip[0] = D.TUNE.equipNeed;
    s.cash = 1e9;
    assert.ok(E.buy(s, 0, 2));
    assert.equal(s.method[0], true);
    assert.equal(E.buy(s, 0, 2), false, "a method is one-time");
    assert.equal(E.canBuy(s, 5, 0), false, "closed materials cannot be hired");
});

test("materials unlock one after another and pay from the one before", () => {
    const s = E.fresh(0);
    assert.equal(E.canUnlock(s, 2), false, "cannot skip ahead");
    assert.equal(E.canUnlock(s, 1), false, "needs the gravel");
    s.amt[0] = D.UNLOCK_COST[1];
    assert.ok(E.unlock(s, 1));
    assert.equal(s.open, 2);
    assert.equal(s.crews[1], 1);
    assert.equal(s.amt[0], 0);
});

test("forward boost lifts the next material; the last three feed back down", () => {
    const s = E.fresh(0);
    s.open = 12;
    s.amt[0] = 0;
    const c0 = E.chain(s);
    assert.equal(c0.fwd[1], 1);
    s.amt[0] = 1e4;
    assert.ok(E.chain(s).fwd[1] > 1);
    s.amt[9] = 1e4;
    const c1 = E.chain(s);
    assert.ok(c1.back[8] > 1, "precast boosts ductwork");
    assert.ok(c1.crew > 1, "precast gives crew speed");
    s.amt[10] = 1e4; s.amt[11] = 1e4;
    const c2 = E.chain(s);
    assert.ok(c2.pay > 1 && c2.rep > 1);
    assert.equal(c2.back[0], 1, "only the neighbour is boosted back");
});

test("the next job waits for its stage, then starts and runs to a payout", () => {
    const s = E.fresh(0);
    assert.ok(E.waitingFor(s));
    s.open = 3; s.crews = s.crews.map((c, i) => (i < 3 ? 20 : 0));
    s.amt = s.amt.map((_, i) => (i < 3 ? 1e6 : 0));
    assert.equal(E.waitingFor(s), null);
    E.step(s, 1);
    assert.equal(s.job.id, "sidewalk");
    const cash0 = s.cash;
    run(s, 400);
    assert.equal(s.built >= 1, true);
    assert.ok(s.cash > cash0);
    assert.ok(s.rep > 0);
    assert.equal(s.skyline[0].id, "sidewalk");
    assert.ok(finite(s));
});

test("jobs run in the fixed campaign order", () => {
    const s = E.fresh(0);
    s.open = 12; s.crews = s.crews.map(() => 40); s.amt = s.amt.map(() => 1e12);
    const done = [];
    for (let t = 0; t < 20000 && done.length < 13; t++) { const b = s.built; E.step(s, 1); if (s.built > b) done.push(s.skyline.at(-1).id); }
    assert.deepEqual(done, D.JOBS.map((j) => j.id));
    assert.equal(s.ending, true);
    assert.equal(E.nextJob(s).id, "tower", "after the bridge the last three jobs loop");
});

test("inspection score stretches but never fails an inspection", () => {
    const s = E.fresh(0);
    const f = E.effects(s);
    const j = D.JOB_BY.get("bridge");
    const slow = E.inspectSecs(s, j, f);
    s.rep = 1e5;
    const fast = E.inspectSecs(s, j, f);
    assert.ok(slow > fast);
    assert.ok(slow <= j.inspect * D.TUNE.delayCap + 1e-9);
    assert.ok(fast >= 1);
});

test("overtime ends an inspection early for cash", () => {
    const s = E.fresh(0);
    s.open = 3; s.crews = s.crews.map((c, i) => (i < 3 ? 30 : 0)); s.amt = s.amt.map((_, i) => (i < 3 ? 1e6 : 0));
    let g = 0;
    while (!(s.job && s.job.step === "inspect") && g++ < 2000) E.step(s, 1);
    assert.equal(s.job.step, "inspect");
    s.cash = 1e12;
    const c = E.overtimeCost(s);
    assert.ok(c > 0);
    assert.ok(E.overtime(s));
    E.step(s, 1);
    assert.ok(s.built >= 1);
});

test("a change order is offered at the structure phase, can be accepted, and raises the payout", () => {
    const run1 = (accept) => {
        const s = E.fresh(0);
        s.open = 5; s.crews = s.crews.map((c, i) => (i < 5 ? 30 : 0)); s.amt = s.amt.map((_, i) => (i < 5 ? 1e8 : 0));
        s.builtThisFirm = 2; // the Two-storey house
        let offered = false;
        for (let t = 0; t < 2000 && s.builtThisFirm < 3; t++) {
            E.step(s, 1);
            if (s.change && !offered) { offered = true; if (accept) assert.ok(E.acceptChange(s)); else E.declineChange(s); }
        }
        return { offered, cash: s.cash };
    };
    const a = run1(true), b = run1(false);
    assert.ok(a.offered && b.offered);
    assert.ok(a.cash > b.cash);
});

test("incorporate resets the firm, keeps skyline and charter, moves to a new region", () => {
    const s = E.fresh(0);
    s.repFirm = 4000; s.rep = 4000; s.cash = 5e6; s.open = 8; s.skyline.push({ id: "sidewalk", city: 0, firm: 0, at: 0 });
    const gain = E.charterGain(s);
    assert.ok(gain >= 1);
    assert.equal(E.incorporate(s), gain);
    assert.equal(s.firm, 1);
    assert.equal(s.charter, gain);
    assert.equal(s.open, 1);
    assert.equal(s.cash, D.TUNE.startCash);
    assert.equal(s.builtThisFirm, 0);
    assert.equal(s.skyline.length, 1);
    assert.equal(E.incorporate(s), 0, "needs fresh reputation");
});

test("perks need their requirements and charter", () => {
    const s = E.fresh(0);
    s.charter = 100;
    assert.equal(E.buyPerk(s, "o2"), false, "locked");
    assert.ok(E.buyPerk(s, "o1"));
    assert.ok(E.buyPerk(s, "o2"));
    assert.equal(E.buyPerk(s, "o2"), false, "once");
    assert.ok(E.effects(s).crew > 1);
    assert.equal(E.effects(s).auto, 1);
});

test("Foreman hires crews on its own, and only with a small share", () => {
    const s = E.fresh(0);
    s.perks = ["o1", "o2"];
    s.amt[0] = 1e6;
    const before = s.amt[0];
    E.step(s, 1);
    assert.ok(s.crews[0] > 1);
    assert.ok(s.amt[0] > before * 0.5, "never spends more than a share per tick");
});

test("a long catch-up is finite, capped and fast", () => {
    const s = E.fresh(0);
    s.open = 12; s.crews = s.crews.map(() => 30); s.amt = s.amt.map(() => 1e6);
    const t0 = Date.now();
    const secs = E.catchUp(s, 3 * 24 * 3600);
    assert.equal(secs, E.offlineCapS(E.effects(s)));
    assert.ok(finite(s));
    assert.ok(Date.now() - t0 < 5000);
    assert.equal(E.catchUp(E.fresh(0), 1), 0);
});

test("saves round-trip, survive junk, and refuse non-saves", () => {
    const s = E.fresh(5);
    s.open = 6; s.cash = 1234; s.perks = ["o1", "nope"]; s.method[2] = true;
    s.rep = 12; s.job = { index: 0, id: "sidewalk", step: "build", left: 0, inspectTotal: 0, phase: 1, got: Array(12).fill(1), extra: Array(12).fill(0), bonus: 0 };
    const t = E.parse(JSON.parse(E.serialize(s)));
    assert.equal(t.open, 6);
    assert.equal(t.cash, 1234);
    assert.deepEqual(t.perks, ["o1"]);
    assert.equal(t.method[2], true);
    assert.equal(t.job.id, "sidewalk");
    assert.equal(t.job.phase, 1);
    assert.equal(E.parse(null), null);
    assert.equal(E.parse({ amt: "x" }), null);
    const junk = E.parse({ amt: [NaN, -5, "a"], crews: [1e400], open: 99, cash: "x", job: { id: "ghost" }, skyline: [{ id: "ghost" }, { id: "tower" }] });
    assert.ok(finite(junk));
    assert.equal(junk.open, 12);
    assert.equal(junk.job, null);
    assert.equal(junk.skyline.length, 1);
    assert.equal(E.load({ getItem: () => "{bad json" }), null);
    assert.equal(E.load(null), null);
});

test("fmt reads well across scales", () => {
    assert.equal(E.fmt(12), "12");
    assert.equal(E.fmt(1500), "1.50K");
    assert.equal(E.fmt(2.5e6), "2.50M");
    assert.equal(E.fmt(NaN), "0");
    assert.match(E.fmt(1e40), /e40$/);
});

test("console commands drive the same state", () => {
    const s = E.fresh(0);
    s.amt[0] = 1e5;
    assert.match(C.gbCommand(s, ["stats"]).lines[0].t, /firm 1/);
    assert.equal(C.gbCommand(s, ["hire", "gravel"]).changed, true);
    assert.equal(C.gbCommand(s, ["hire", "concrete"]).lines[0].k, "err");
    assert.equal(C.gbCommand(s, ["jobs"]).lines.length, 3);
    assert.equal(C.gbCommand(s, ["incorporate"]).lines[0].k, "err");
    assert.equal(C.gbCommand(s, ["zzz"]).changed, false);
});

test("the bot finishes the campaign in about three hours", () => {
    // A tiny version of scripts/groundbreak/sim.mjs: buy what is affordable every 3 s, keep the next unlock's price.
    const s = E.fresh(0);
    let t = 0;
    while (t < 5 * 3600 && !s.ending) {
        if (t % 3 === 0) {
            const f = E.effects(s);
            for (let n = s.open - 1; n >= 0; n--) {
                if (E.methodReady(s, n)) E.buy(s, n, 2, f);
                const src = E.crewSrc(n), keep = src === s.open - 1 && s.open < D.N ? D.UNLOCK_COST[s.open] : 0;
                for (let k = 0; k < 60 && E.canBuy(s, n, 0, f) && E.crewCost(s, n, f) < s.amt[src] - keep; k++) E.buy(s, n, 0, f);
                for (let k = 0; k < 40 && E.canBuy(s, n, 1, f) && E.equipCost(s, n) < (s.amt[src] - keep) * 0.6; k++) E.buy(s, n, 1, f);
            }
            while (E.canUnlock(s, s.open)) E.unlock(s, s.open);
            if (s.change) E.acceptChange(s);
        }
        E.step(s, 1);
        t++;
    }
    assert.ok(s.ending, "the bridge was built");
    assert.ok(t > 2.4 * 3600 && t < 3.6 * 3600, `finished in ${(t / 3600).toFixed(2)} h`);
});

test("the next material opens by itself when the next job is waiting on it, so a new firm never stalls", () => {
    const hire = (s) => { for (let n = 0; n < s.open; n++) E.buy(s, n, 0); };
    const s = E.fresh(0);
    for (let i = 0; i < 20 * 60; i++) {
        E.step(s, 1);
        hire(s);
        if (s.open < 3) assert.ok(!s.job, "no job before cement is open");
    }
    assert.ok(s.open >= 3, "sand and cement opened without a click");
    assert.ok(s.job || s.built > 0, "the first job started");
    const away = E.fresh(0);
    for (let i = 0; i < 90; i++) { E.step(away, 1); hire(away); }
    E.catchUp(away, 3 * 3600);
    assert.ok(away.built >= 1, "time away builds jobs, not only stockpiles");
});
