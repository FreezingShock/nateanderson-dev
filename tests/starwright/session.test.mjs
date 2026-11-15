// Starwright session care: corrupt saves, backups, time credit, welcome-back report, settings, console additions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const E = await import(resolve(root, "lib/starwright/engine.ts"));
const S = await import(resolve(root, "lib/starwright/session.ts"));
const T = await import(resolve(root, "lib/starwright/settings.ts"));
const D = await import(resolve(root, "lib/starwright/data.ts"));

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
