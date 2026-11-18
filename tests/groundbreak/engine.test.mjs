// Groundbreak engine tests (run with npm run test:nodefarm). Loads the real engine under node.
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const E = await import(pathToFileURL(resolve(root, "lib/groundbreak/engine.ts")).href);
const D = await import(pathToFileURL(resolve(root, "lib/groundbreak/data.ts")).href);
const C = await import(pathToFileURL(resolve(root, "lib/groundbreak/commands.ts")).href);

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
    // the first job is waiting on Sand, so the foreman opens it at once and spends its price
    assert.ok(s.amt[0] + D.UNLOCK_COST[1] * (s.open - 1) > D.TUNE.startGravel);
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
    s.amt[0] = 0;
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
    assert.equal(E.nextJob(s).id, "stadium", "after the bridge the last three jobs loop");
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

test("a change order is offered at the structure phase (the middle one for a small job), can be accepted, and raises the payout", () => {
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

// ---- overhaul (jobs start on their own material, repeat orders, no dead stretches) ----------------------------------

test("each job starts as soon as its own last material is open, not when its whole stage is", () => {
    assert.deepEqual(D.JOBS.map((j) => E.jobNeed(j)), [3, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 12, 12]);
    const s = E.fresh(0);
    s.open = 4; s.builtThisFirm = 2; // the house needs Concrete (4th)
    assert.ok(E.jobReady(s, E.nextJob(s)));
    s.open = 3;
    assert.ok(!E.jobReady(s, E.nextJob(s)));
    assert.match(E.waitingFor(s), /Two-storey house needs Concrete/);
    assert.equal(E.jobMat(E.nextJob(s)), 3);
});

test("while the next job waits on a material the crew rebuilds the last job as a repeat order that pays a share and adds no building", () => {
    const s = E.fresh(0);
    s.open = 3; s.builtThisFirm = 2; s.crews = s.crews.map((c, i) => (i < 3 ? 30 : 0)); s.amt = s.amt.map((_, i) => (i < 3 ? 1e6 : 0)); // house waits on Concrete
    s.amt[2] = 0; // keep the Concrete unlock out of reach
    E.step(s, 1);
    assert.ok(s.job && s.job.rerun, "a repeat order started");
    assert.equal(s.job.id, "driveway");
    const cash0 = s.cash, built0 = s.built, sky0 = s.skyline.length, rep0 = s.rep;
    run(s, 400);
    assert.ok(s.reruns >= 1 && s.cash > cash0 && s.rep > rep0);
    assert.equal(s.built, built0, "repeat orders are not campaign jobs");
    assert.equal(s.builtThisFirm, 2);
    assert.equal(s.skyline.length, sky0);
    const drive = D.JOB_BY.get("driveway");
    assert.ok(E.repeatPay(s, drive, E.effects(s)) < E.payout(s, drive, E.effects(s)), "less than the real job");
    assert.equal(E.overtimeCost(s), 0, "no overtime on repeats");
});

test("a repeat order is paid pro rata and dropped the moment the next job can start", () => {
    const s = E.fresh(0);
    s.open = 3; s.builtThisFirm = 2; s.crews = s.crews.map((c, i) => (i < 3 ? 40 : 0)); s.amt = s.amt.map((_, i) => (i < 3 ? 1e7 : 0));
    s.amt[2] = 0; s.crews[2] = 0; s.crews[1] = 0; s.crews[0] = 0;
    E.step(s, 1);
    run(s, 25);
    assert.ok(s.job.rerun);
    const cash0 = s.cash;
    s.amt[2] = 1e7; // Sand pays Concrete's unlock
    s.amt[1] = 1e7;
    E.step(s, 1);
    assert.ok(!s.job?.rerun || s.job.id === "house");
    assert.equal(s.job.id, "house", "the house started");
    assert.ok(!s.job.rerun);
    assert.ok(s.cash >= cash0, "the crew was paid for the part it finished");
    assert.equal(s.open, 4, "Concrete opened by itself for the waiting house");
});

test("a fresh firm has no repeat order, and the next material still opens by itself", () => {
    const s = E.fresh(0);
    assert.equal(E.repeatJob(s), null);
    E.step(s, 1);
    assert.ok(!s.job, "nothing to build yet, nothing invented");
});

test("a v1 save is moved onto the new job order without repeating a finished job", () => {
    const s = E.fresh(0);
    s.open = 12;
    s.builtThisFirm = 5; // old order: sidewalk, driveway, house, fire station, clinic built
    for (const id of ["sidewalk", "driveway", "house", "firestation", "clinic"]) s.skyline.push({ id, city: 0, firm: 0, at: 1 });
    const raw = JSON.parse(E.serialize(s));
    raw.v = 1;
    const t = E.parse(raw);
    assert.equal(E.nextJob(t).id, "parking");
    assert.equal(t.reruns, 0);
    const u = E.parse(JSON.parse(E.serialize(t)));
    assert.equal(u.v, 2);
    assert.equal(E.nextJob(u).id, "parking");
    const old = JSON.parse(E.serialize(s)); delete old.reruns; delete old.v;
    assert.ok(E.parse(old), "a save with no repeat counter loads");
});

test("repeat orders survive a save", () => {
    const s = E.fresh(0);
    s.open = 3; s.builtThisFirm = 2; s.crews = s.crews.map((c, i) => (i < 3 ? 30 : 0)); s.amt = s.amt.map((_, i) => (i < 3 ? 1e6 : 0)); s.amt[2] = 0;
    E.step(s, 1);
    const t = E.parse(JSON.parse(E.serialize(s)));
    assert.equal(t.job.rerun, true);
});

test("a normal firm never sits idle: money, unlocks and a payout keep coming", () => {
    const s = E.fresh(0);
    let t = 0, lastPay = 0, lastOpenAt = 0, lastOpen = s.open, worstPay = 0, worstOpen = 0, idle = 0;
    let paid = 0;
    while (t < 5 * 3600 && !s.ending) {
        if (t % 3 === 0) {
            const f = E.effects(s);
            for (let n = s.open - 1; n >= 0; n--) {
                if (E.methodReady(s, n)) E.buy(s, n, 2, f);
                const src = E.crewSrc(n), keep = src === s.open - 1 && s.open < D.N ? D.UNLOCK_COST[s.open] : 0;
                for (let k = 0; k < 60 && E.canBuy(s, n, 0, f) && E.crewCost(s, n, f) < s.amt[src] - keep; k++) E.buy(s, n, 0, f);
                for (let k = 0; k < 40 && E.canBuy(s, n, 1, f) && E.equipCost(s, n) < (s.amt[src] - keep) * 0.6; k++) E.buy(s, n, 1, f);
            }
            if (s.change) E.acceptChange(s);
        }
        const before = s.cash;
        E.step(s, 1);
        t++;
        if (s.cash > before) { worstPay = Math.max(worstPay, t - lastPay); lastPay = t; paid++; }
        if (s.open !== lastOpen) { worstOpen = Math.max(worstOpen, t - lastOpenAt); lastOpenAt = t; lastOpen = s.open; }
        if (t > 120 && !s.job) idle++;
    }
    assert.ok(s.ending);
    assert.ok(worstPay <= 14 * 60, `longest stretch without being paid: ${(worstPay / 60).toFixed(1)} min`);
    assert.ok(worstOpen <= 20 * 60, `longest stretch without a new material: ${(worstOpen / 60).toFixed(1)} min`);
    assert.ok(idle < 60, `no job running for ${idle} s after the opening`);
    assert.ok(s.reruns >= 5, "repeat orders filled the waiting");
});

test("jobs speed up with crew perks, and the second firm beats the first", () => {
    const f1 = E.effects(E.fresh(0));
    const s = E.fresh(0); s.perks = ["o1", "o3", "o5"];
    const f2 = E.effects(s);
    assert.ok(E.jobSpeed(f2) > E.jobSpeed(f1));
    const j = D.JOB_BY.get("tower");
    const t = (f) => E.plan(j, f).reduce((a, p) => a + p.secs, 0);
    assert.ok(t(f2) < t(f1));
});

test("progress draws pay through a long job and the handover pays the rest, never more in all", () => {
    const s = E.fresh(0);
    s.open = 8; s.builtThisFirm = 6; s.crews = s.crews.map((c, i) => (i < 8 ? 60 : 0)); s.amt = s.amt.map((_, i) => (i < 8 ? 1e12 : 0)); // the clinic, six phases
    const f = E.effects(s), def = D.JOB_BY.get("clinic");
    const total = E.payout(s, def, f);
    const cash0 = s.cash, steps = [];
    let last = s.cash;
    for (let t = 0; t < 4000 && s.builtThisFirm < 7; t++) {
        E.step(s, 1);
        if (s.cash > last) steps.push(s.cash - last);
        last = s.cash;
    }
    assert.ok(steps.length >= 4, `paid in ${steps.length} pieces`);
    assert.ok(Math.abs(s.cash - cash0 - total) <= 6, `total ${s.cash - cash0} vs ${total}`);
    assert.ok(steps.at(-1) < total, "the handover is not the whole job");
});

test("a change order costs build time and a tougher inspection, pays more, and is worth it only for a firm with the reputation to back it", () => {
    const run1 = (id, rep, accept) => {
        const s = E.fresh(0);
        s.open = 12; s.builtThisFirm = D.JOBS.findIndex((j) => j.id === id); s.crews = s.crews.map(() => 60); s.amt = s.amt.map(() => 1e15); s.rep = rep;
        const idx = s.builtThisFirm, c0 = s.cash;
        let t = 0, offered = null;
        while (s.builtThisFirm === idx && t < 20000) {
            E.step(s, 1); t++;
            if (s.change) { offered = offered ?? { ...s.change }; if (accept) E.acceptChange(s); else E.declineChange(s); }
        }
        return { t, cash: s.cash - c0, offered };
    };
    const weakNo = run1("house", 5, false), weakYes = run1("house", 5, true);
    assert.ok(weakYes.offered.secs > 0 && weakYes.offered.score > 0, "the offer says what it costs");
    assert.ok(weakYes.t > weakNo.t && weakYes.cash > weakNo.cash, "slower and bigger");
    assert.ok(weakYes.cash / weakYes.t < weakNo.cash / weakNo.t, "a brand-new firm does better saying no");
    const strongNo = run1("tower", 3500, false), strongYes = run1("tower", 3500, true);
    assert.ok(strongYes.cash / strongYes.t > strongNo.cash / strongNo.t * 1.08, "an established firm does better saying yes");
});

test("opening a material stocks a minute of its output so the new row is alive at once", () => {
    const s = E.fresh(0);
    s.amt[0] = 1e4;
    assert.ok(E.unlock(s, 1));
    assert.ok(s.amt[1] > 0, "Sand arrived stocked");
    assert.ok(s.amt[1] < 1000, "but only a minute's worth");
});

test("the first charter buys a real head start: a firm-1 run pays 25+ charter and Standing crews doubles every crew", () => {
    const s = E.fresh(0);
    s.repFirm = 3600; s.rep = 3600;
    assert.ok(E.charterGain(s) >= 25, "a firm that reached the bridge earns about 30 charter");
    const base = E.effects(s).crew;
    s.perks = ["o1"];
    assert.equal(E.effects(s).crew, base * 2);
});

test("every 25 crews in a row doubles its output (the rate per crew jumps, not just the count)", () => {
    const s = E.fresh(0); s.open = 4;
    const per = (crews) => { s.crews[0] = crews; return E.rawRate(s, 0, E.effects(s), E.chain(s)) / crews; };
    assert.equal(E.rowMult(s, 0), 1 * (s.crews[0] = 24, E.rowMult(s, 0)));
    assert.ok(Math.abs(per(25) / per(24) - 2) < 1e-9, "crew 25 doubles the per-crew rate");
    assert.ok(Math.abs(per(50) / per(49) - 2) < 1e-9, "crew 50 doubles it again");
});

test("reputation lifts production by repBoost per point", () => {
    const s = E.fresh(0); s.open = 4; s.crews[0] = 10;
    const at = (rep) => { s.rep = rep; return E.rawRate(s, 0, E.effects(s), E.chain(s)); };
    const r0 = at(0), r100 = at(100);
    assert.ok(Math.abs(r100 / r0 - (1 + 100 * D.TUNE.repBoost)) < 1e-9);
});

test("a region multiplies only the materials it lists", () => {
    const rate = (firm, n) => { const s = E.fresh(0); s.firm = firm; s.open = 12; s.crews[n] = 10; return E.rawRate(s, n, E.effects(s), E.chain(s)); };
    const eb = D.CITIES[0].mat, pen = D.CITIES[1].mat;
    assert.ok(eb[0] > 1 && pen[5] > 1);
    // same material, a region with and without the bonus (firm 2 is South Bay: no material bonus; fx are not crew speed)
    assert.ok(Math.abs(rate(0, 0) / rate(2, 0) - eb[0]) < 1e-9, "East Bay lifts Gravel");
    assert.ok(Math.abs(rate(1, 5) / rate(2, 5) - pen[5]) < 1e-9, "Peninsula lifts material 6");
    assert.equal(rate(1, 0), rate(2, 0), "Peninsula does not lift Gravel");
});

test("Night watch raises the offline cap, and catchUp stops at the cap", () => {
    const away = 40 * 3600;
    const base = E.fresh(0);
    const capBase = E.offlineCapS(E.effects(base));
    assert.equal(E.catchUp(base, away), capBase);
    const night = E.fresh(0); night.perks = ["l1", "l3"];
    const capNight = E.offlineCapS(E.effects(night));
    assert.ok(capNight > capBase, "Night watch adds hours");
    assert.equal(E.catchUp(night, away), capNight);
    assert.ok(E.catchUp(E.fresh(0), 1) === 0, "under two seconds is ignored");
});

test("gb help names every console subcommand", () => {
    for (const n of C.GB_SUBS) assert.ok(C.GB_HELP[n], `gb ${n} has a help line`);
    const r = C.gbCommand(E.fresh(0), ["help"]);
    assert.equal(r.lines.length, C.GB_SUBS.length);
    assert.equal(r.changed, false);
});

test("while the crew repeats a job, the waiting cue says what the next job waits on", async () => {
    const G = await import(pathToFileURL(resolve(root, "lib/groundbreak/guide.ts")).href);
    const s = E.fresh(0);
    for (let t = 0; t < 3600 && !(s.job && s.job.rerun); t++) {
        const f = E.effects(s);
        if (t % 3 === 0) { for (let n = s.open - 1; n >= 0; n--) for (let k = 0; k < 40 && E.canBuy(s, n, 0, f); k++) E.buy(s, n, 0, f); while (E.canUnlock(s, s.open)) E.unlock(s, s.open); }
        E.step(s, 1, f);
    }
    assert.ok(s.job && s.job.rerun, "reached a repeat order");
    s.amt = s.amt.map(() => 0); s.cash = 0; // nothing affordable, so the cue can only wait
    const c = G.nextCue(s);
    assert.equal(c.kind, "wait");
    assert.match(c.why, /repeats/);
    assert.match(c.why, /needs/);
});
