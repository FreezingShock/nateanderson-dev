// Starwright session care: corrupt saves, backups, time credit, welcome-back report, settings, console additions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const E = await import(pathToFileURL(resolve(root, "lib/starwright/engine.ts")).href);
const S = await import(pathToFileURL(resolve(root, "lib/starwright/session.ts")).href);
const T = await import(pathToFileURL(resolve(root, "lib/starwright/settings.ts")).href);
const D = await import(pathToFileURL(resolve(root, "lib/starwright/data.ts")).href);

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, String(v)), m }; };
const played = () => { const s = E.fresh(1000); for (let i = 0; i < 6; i++) s.bought[i][0] = 25; return s; };

test("no save means a new game, a good save loads", () => {
    const st = mem();
    assert.equal(S.loadSession(st).status, "new");
    st.setItem(E.SAVE_KEY, E.serialize(played()));
    const r = S.loadSession(st);
    assert.equal(r.status, "ok");
    assert.equal(r.state.bought[0][0], 25);
});

test("a damaged save is kept, not dropped, and the backup is used", () => {
    const st = mem();
    S.writeBackup(st, played(), true);
    st.setItem(E.SAVE_KEY, '{"amt":[1,2');
    const r = S.loadSession(st, 5000);
    assert.equal(r.status, "restored");
    assert.equal(r.state.bought[0][0], 25);
    assert.equal(st.getItem(S.CORRUPT_KEY), '{"amt":[1,2');
    assert.match(r.note, /backup/);
});

test("a damaged save with no backup is reported as lost and still kept", () => {
    const st = mem();
    st.setItem(E.SAVE_KEY, "not json");
    const r = S.loadSession(st);
    assert.equal(r.status, "lost");
    assert.equal(r.state, null);
    assert.equal(st.getItem(S.CORRUPT_KEY), "not json");
    st.setItem(E.SAVE_KEY, JSON.stringify({ hello: 1 }));
    assert.equal(S.loadSession(st).status, "lost");
});

test("a periodic backup never replaces one with more play in it", () => {
    const st = mem();
    const big = played(); big.totalAge = 5000;
    S.writeBackup(st, big, true);
    const small = E.fresh(); small.totalAge = 10;
    assert.equal(S.writeBackup(st, small), false);
    assert.equal(S.readBackup(st).totalAge, 5000);
    assert.equal(S.writeBackup(st, small, true), true);
    assert.equal(S.readBackup(st).totalAge, 10);
});

test("a gap between 1 and 3 seconds is no longer lost", () => {
    const a = played(), b = played();
    S.advance(a, 2);
    E.step(b, 1);
    assert.ok(a.age > b.age * 1.9, `age ${a.age} vs ${b.age}`);
    const c = played();
    assert.equal(S.advance(c, 600), 600);
    assert.ok(c.age >= 599);
    assert.equal(S.advance(c, -5), 0);
    assert.equal(S.advance(c, NaN), 0);
});

test("time away is capped by the offline limit and the report says so", () => {
    const s = played();
    const before = S.snap(s);
    const gap = 30 * 3600;
    const secs = S.advance(s, gap);
    assert.equal(secs, D.TUNE.offlineH * 3600);
    const r = S.awayReport(before, s, secs, gap);
    assert.ok(r.capped);
    assert.match(r.lines[0], /only keeps 8 hours/);
    assert.ok(r.lines.some((l) => /collapse/.test(l)));
    assert.ok(r.lines.length >= 3);
});

test("the away report stays in storage for the console", () => {
    const st = mem();
    const s = played();
    const before = S.snap(s);
    const secs = S.advance(s, 3600);
    S.saveAway(st, S.awayReport(before, s, secs, 3600, 42));
    assert.equal(S.lastAway(st).at, 42);
    st.setItem(S.AWAY_KEY, "garbage");
    assert.equal(S.lastAway(st), null);
});

test("settings parse anything, and automations unlock with their milestones", () => {
    assert.deepEqual(T.parseSettings(null), T.DEFAULTS);
    assert.equal(T.parseSettings({ autoNova: 7, fx: "weird", autoVisitor: "x" }).autoNova, 0);
    assert.equal(T.parseSettings({ autoNova: 1.5, notices: false }).notices, false);
    const s = E.fresh();
    assert.equal(T.unlocked(s, "autoNova"), false);
    s.ach.push("nova10");
    assert.equal(T.unlocked(s, "autoNova"), true);
    assert.deepEqual(T.cycle([0, 1, 2], 2), 0);
});

test("auto visitor answers take the lump or the boost", () => {
    const comet = D.EVENTS.find((e) => e.id === "comet");
    assert.equal(S.autoAnswer(comet, "lump"), 0);
    assert.equal(S.autoAnswer(comet, "boost"), 1);
    const pair = D.EVENTS.find((e) => e.id === "pair");
    assert.equal(S.autoAnswer(pair, "lump"), 1);
    assert.equal(S.autoAnswer(pair, "boost"), 0);
    const flare = D.EVENTS.find((e) => e.id === "flare");
    assert.equal(S.autoAnswer(flare, "lump"), 0);
});

test("time away with auto supernova fires supernovas and reports them", () => {
    const s = played();
    for (let i = 0; i < 8; i++) s.bought[i][0] = 60;
    s.amt[7] = 1400;
    const before = S.snap(s);
    const r = S.advanceAuto(s, 6 * 3600, { autoNova: 1, autoVisitor: "off" });
    assert.ok(r.novas >= 1, `novas ${r.novas}`);
    assert.equal(s.novasAll, r.novas);
    assert.ok(r.dust > 0);
    const rep = S.awayReport(before, s, r.secs, 6 * 3600, 1, r);
    assert.ok(rep.lines.some((l) => /Auto supernova fired/.test(l)));
    assert.ok(E.fresh().novasAll === 0);
});

test("time away answers a waiting visitor, and does nothing when automation is off", () => {
    const s = played();
    s.event = { id: "comet", left: 100 };
    const r = S.advanceAuto(s, 3600, { autoNova: 0, autoVisitor: "boost" });
    assert.equal(r.answered, true);
    assert.equal(s.event, null);
    const a = played(), b = played();
    S.advanceAuto(a, 3600, { autoNova: 0, autoVisitor: "off" });
    S.advance(b, 3600);
    assert.deepEqual(a.amt, b.amt);
});

test("the game's tick loses no time over short stalls and long gaps", () => {
    // mirrors the interval in starwright.tsx: gap since the last tick goes straight into advanceAuto
    const off = { autoNova: 0, autoVisitor: "off" };
    const s = played();
    const start = s.age;
    let wall = 0, counted = 0;
    const tick = (gap) => { wall += gap; counted += S.advanceAuto(s, gap, off).secs; };
    for (let i = 0; i < 40; i++) tick(0.25); // a normal 10 s
    for (const stall of [1.5, 2, 3, 12, 90, 600]) { tick(stall); for (let i = 0; i < 4; i++) tick(0.25); }
    assert.ok(Math.abs(counted - wall) < 1e-6, `counted ${counted} of ${wall} s`);
    assert.ok(Math.abs(s.age - start - wall) < 1, `age moved ${s.age - start} of ${wall} s`);
    // a gap past the offline cap counts only the cap, never more than the wall time
    const before = s.age;
    const huge = 40 * 3600;
    assert.equal(S.advanceAuto(s, huge, off).secs, D.TUNE.offlineH * 3600);
    assert.ok(s.age - before <= huge);
});

test("a second damaged save never replaces the first one, and the card shows once", () => {
    const st = mem();
    st.setItem(E.SAVE_KEY, "first {damaged");
    const a = S.loadSession(st);
    assert.equal(a.status, "lost");
    assert.equal(st.getItem(S.CORRUPT_KEY), "first {damaged");
    // the game then plays and saves a fresh star over the main key; a reload is clean, with no card
    st.setItem(E.SAVE_KEY, E.serialize(played()));
    assert.equal(S.loadSession(st).status, "ok");
    assert.equal(st.getItem(S.CORRUPT_KEY), "first {damaged");
    // a later, different damaged save keeps the older text under -prev
    st.setItem(E.SAVE_KEY, "second {damaged");
    assert.equal(S.loadSession(st).status, "lost");
    assert.equal(st.getItem(S.CORRUPT_KEY), "second {damaged");
    assert.equal(st.getItem(S.CORRUPT_KEY + "-prev"), "first {damaged");
    // the same damaged text read again changes nothing
    S.loadSession(st);
    assert.equal(st.getItem(S.CORRUPT_KEY + "-prev"), "first {damaged");
});

// Pins today's behaviour for a long absence so the "one supernova or a chain" call can be made on facts (BACKLOG, Needs Nate).
const strong = () => { const s = played(); for (let i = 0; i < 8; i++) s.bought[i][0] = 60; s.amt[7] = 1400; s.perks = ["w1", "w2", "w4"]; return s; };

test("24 h away with auto supernova on pays up to three supernovas (Nate's cap), the extra ones paying what the last paid", () => {
    const s = strong();
    const r = S.advanceAuto(s, 24 * 3600, { autoNova: 1, autoVisitor: "off" });
    assert.equal(r.secs, 24 * 3600, "Long watch counts the full day");
    assert.equal(r.novas, S.AWAY_NOVA_CAP);
    assert.equal(s.novasAll, r.novas);
    assert.equal(s.novas, r.novas);
    assert.ok(r.dust > 0 && s.stardust >= r.dust);
    // away time never buys anything, so the star itself is left restarted, not ready to collapse again
    assert.equal(E.canSupernova(s, E.effects(s)), false);
});

test("a short absence does not get the extra supernovas", () => {
    const s = strong();
    const r = S.advanceAuto(s, 600, { autoNova: 1, autoVisitor: "off" });
    assert.ok(r.novas <= 1, `novas ${r.novas}`);
});

test("24 h away with auto supernova off waits at the collapse line and does not reset", () => {
    const s = strong();
    const r = S.advanceAuto(s, 24 * 3600, { autoNova: 0, autoVisitor: "off" });
    assert.equal(r.novas, 0);
    assert.equal(s.novasAll, 0);
    assert.ok(E.canSupernova(s, E.effects(s)), "the star is still ready for the player to collapse it");
});
