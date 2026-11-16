// Save system tests (npm run test:nodefarm). Runs lib/saves/core.ts and each game's save definition under node.
// Real old shapes: the Groundbreak seeds in tests/saves/fixtures (copied from the late-game seed the balance pass used), a
// Brasswork save in its { text, savedAt } wrapper, a bare Starwright save, a bare Node Farm save, and guesser streaks from
// before the envelope. Each test uses an in-memory store, so nothing touches a browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const at = (p) => resolve(root, p);
const CORE = await import(at("lib/saves/core.ts"));
const KEYS = await import(at("lib/saves/keys.ts"));
const GB = await import(at("lib/groundbreak/engine.ts"));
const SW = await import(at("lib/starwright/engine.ts"));
const BW = await import(at("lib/automation/sim/save.ts"));
const WORLD = await import(at("lib/automation/sim/world.ts"));
const NF = await import(at("lib/nodefarm/engine.ts"));
const NFS = await import(at("lib/nodefarm/save.ts"));
const GS = await import(at("lib/games/guess-stats.ts"));

const memory = () => {
    const m = new Map();
    return {
        m,
        getItem: (k) => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => void m.set(k, String(v)),
        removeItem: (k) => void m.delete(k),
    };
};
const fixture = (name) => readFileSync(at(`tests/saves/fixtures/${name}`), "utf8");

// ---- keys -----------------------------------------------------------------------------------------------------------

test("every game's save key is the one its engine reads", () => {
    assert.equal(GB.SAVE_KEY, KEYS.SAVE_SLOTS.groundbreak.key);
    assert.equal(SW.SAVE_KEY, KEYS.SAVE_SLOTS.starwright.key);
    assert.equal(NFS.NF_KEY, KEYS.SAVE_SLOTS["node-farm"].key);
    assert.equal(BW.BRASSWORK_SAVE.key, KEYS.SAVE_SLOTS.brasswork.key);
    const keys = Object.values(KEYS.SAVE_SLOTS).map((s) => s.key);
    assert.equal(new Set(keys).size, keys.length, "keys are unique");
});

// ---- Groundbreak: real seeds, migrations -------------------------------------------------------------------------------

test("a Groundbreak late-game seed (bare, version 2) loads with no change to its numbers", () => {
    const raw = fixture("groundbreak-late180.json");
    const st = memory();
    st.setItem(GB.SAVE_KEY, raw);
    const r = CORE.loadSave(st, GB.GROUNDBREAK_SAVE);
    assert.equal(r.status, "ok");
    const want = GB.parse(JSON.parse(raw));
    assert.deepEqual(r.state.amt, want.amt);
    assert.deepEqual(r.state.crews, want.crews);
    assert.equal(r.state.open, want.open);
    assert.equal(r.state.cash, want.cash);
    assert.equal(r.state.job.id, want.job.id);
});

test("a mid-game seed loads too, and the envelope round trip keeps every number", () => {
    const st = memory();
    st.setItem(GB.SAVE_KEY, fixture("groundbreak-mid30.json"));
    const first = CORE.loadSave(st, GB.GROUNDBREAK_SAVE);
    assert.equal(first.status, "ok");
    const written = CORE.writeSave(st, GB.GROUNDBREAK_SAVE, first.state, 1_700_000_000_000);
    assert.ok(written, "the write succeeds");
    const env = JSON.parse(st.getItem(GB.SAVE_KEY));
    assert.equal(env.app, "groundbreak");
    assert.equal(env.version, 2);
    assert.equal(env.savedAt, new Date(1_700_000_000_000).toISOString());
    const again = CORE.loadSave(st, GB.GROUNDBREAK_SAVE);
    assert.equal(again.status, "ok");
    assert.deepEqual(again.state.amt, first.state.amt);
    assert.deepEqual(again.state.method, first.state.method);
});

test("a version 1 Groundbreak save is migrated to version 2 and is marked as migrated", () => {
    const raw = JSON.parse(fixture("groundbreak-late180.json"));
    const old = { ...raw, v: 1 };
    const st = memory();
    st.setItem(GB.SAVE_KEY, JSON.stringify(old));
    const r = CORE.loadSave(st, GB.GROUNDBREAK_SAVE);
    assert.equal(r.status, "migrated");
    assert.equal(r.from, 1);
    assert.deepEqual(r.state.amt, GB.parse(raw).amt, "the v1 to v2 migration keeps the numbers");
});

test("a save with an envelope but an old version is migrated the same way", () => {
    const st = memory();
    const raw = JSON.parse(fixture("groundbreak-mid30.json"));
    st.setItem(GB.SAVE_KEY, JSON.stringify({ app: "groundbreak", version: 1, savedAt: "2026-11-01T00:00:00.000Z", data: { ...raw, v: 1 } }));
    const r = CORE.loadSave(st, GB.GROUNDBREAK_SAVE);
    assert.equal(r.status, "migrated");
    assert.equal(r.savedAt, Date.parse("2026-11-01T00:00:00.000Z"));
});

test("the Groundbreak file import path revives an old file the same way (reviveAuto)", () => {
    const raw = JSON.parse(fixture("groundbreak-late180.json"));
    const s = CORE.reviveAuto(GB.GROUNDBREAK_SAVE, { ...raw, v: 1 });
    assert.ok(s, "revives");
    assert.deepEqual(s.amt, GB.parse(raw).amt);
});

// ---- the core: migrations order, newer saves, damage ---------------------------------------------------------------------

test("migrations run in order from the stored version to the current one", () => {
    const def = {
        app: "t", key: "t-save", version: 3,
        bareVersion: (d) => d.v,
        migrations: { 1: (d) => ({ n: d.n + 10 }), 2: (d) => ({ n: d.n * 2 }) },
        revive: (d) => ({ n: d.n }),
        dump: (s) => s,
    };
    const bare = memory();
    bare.setItem("t-save", JSON.stringify({ v: 1, n: 1 }));
    assert.equal(CORE.loadSave(bare, def).state.n, 22, "(1 + 10) * 2");
    const env = memory();
    env.setItem("t-save", JSON.stringify({ app: "t", version: 2, savedAt: "2026-01-01T00:00:00Z", data: { n: 5 } }));
    assert.equal(CORE.loadSave(env, def).state.n, 10, "migrates from 2 only");
});

test("a save from a newer version is refused, kept, and never overwritten by the load", () => {
    const st = memory();
    const newer = JSON.stringify({ app: "groundbreak", version: 9, savedAt: "2027-01-01T00:00:00Z", data: { v: 9 } });
    st.setItem(GB.SAVE_KEY, newer);
    const r = CORE.loadSave(st, GB.GROUNDBREAK_SAVE);
    assert.equal(r.state, null);
    assert.equal(r.status, "lost");
    assert.match(r.note, /newer version/);
    assert.equal(st.getItem(GB.SAVE_KEY + "-corrupt"), newer, "the newer save is copied aside");
    assert.equal(st.getItem(GB.SAVE_KEY), newer, "the live key is left for the game to overwrite on its next save");
});

test("a damaged save with a valid rolling copy restores the copy and keeps the damaged text", () => {
    const st = memory();
    const good = CORE.encodeSave(GB.GROUNDBREAK_SAVE, GB.parse(JSON.parse(fixture("groundbreak-mid30.json"))), 1_700_000_000_000);
    st.setItem(GB.SAVE_KEY, '{"app":"groundbreak","version":2,"da');
    st.setItem(GB.SAVE_KEY + "-auto1", good);
    const r = CORE.loadSave(st, GB.GROUNDBREAK_SAVE, 1_700_000_360_000);
    assert.equal(r.status, "restored");
    assert.ok(r.state);
    assert.match(r.note, /backup from 6 minutes ago/);
    assert.equal(st.getItem(GB.SAVE_KEY + "-corrupt"), '{"app":"groundbreak","version":2,"da');
});

test("a damaged save with no usable copy is lost, its text is kept, and a second damaged text moves the first to -prev", () => {
    const st = memory();
    st.setItem(GB.SAVE_KEY, "first {damaged");
    const a = CORE.loadSave(st, GB.GROUNDBREAK_SAVE);
    assert.equal(a.status, "lost");
    assert.equal(st.getItem(GB.SAVE_KEY + "-corrupt"), "first {damaged");
    st.setItem(GB.SAVE_KEY, "second {damaged");
    CORE.loadSave(st, GB.GROUNDBREAK_SAVE);
    assert.equal(st.getItem(GB.SAVE_KEY + "-corrupt"), "second {damaged");
    assert.equal(st.getItem(GB.SAVE_KEY + "-corrupt-prev"), "first {damaged");
});

test("a missing save is new, and a blocked store never throws", () => {
    assert.equal(CORE.loadSave(memory(), GB.GROUNDBREAK_SAVE).status, "new");
    assert.equal(CORE.loadSave(null, GB.GROUNDBREAK_SAVE).status, "new");
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    assert.equal(CORE.loadSave(blocked, GB.GROUNDBREAK_SAVE).status, "new");
    assert.equal(CORE.writeSave(blocked, GB.GROUNDBREAK_SAVE, GB.fresh(0)), null);
});

test("a save for another game is refused", () => {
    const st = memory();
    st.setItem(GB.SAVE_KEY, JSON.stringify({ app: "starwright", version: 1, savedAt: "x", data: {} }));
    assert.equal(CORE.loadSave(st, GB.GROUNDBREAK_SAVE).status, "lost");
});

// ---- Starwright -----------------------------------------------------------------------------------------------------

test("Starwright: a bare save loads, and the envelope round trip keeps the star", () => {
    const st = memory();
    const s = SW.fresh(1_700_000_000_000);
    s.amt[0] = 12.5;
    st.setItem(SW.SAVE_KEY, JSON.stringify(s));
    const r = CORE.loadSave(st, SW.STARWRIGHT_SAVE);
    assert.equal(r.status, "ok");
    assert.equal(r.state.amt[0], 12.5);
    CORE.writeSave(st, SW.STARWRIGHT_SAVE, r.state, 1_700_000_100_000);
    assert.equal(JSON.parse(st.getItem(SW.SAVE_KEY)).app, "starwright");
    assert.equal(CORE.loadSave(st, SW.STARWRIGHT_SAVE).state.amt[0], 12.5);
});

test("Starwright: the backup key is the rolling copy the load falls back to", () => {
    const st = memory();
    const s = SW.fresh(0);
    s.totalAge = 500;
    st.setItem(SW.SAVE_KEY, "{broken");
    st.setItem(SW.SAVE_KEY + "-backup", JSON.stringify(s));
    const r = CORE.loadSave(st, SW.STARWRIGHT_SAVE);
    assert.equal(r.status, "restored");
    assert.equal(r.state.totalAge, 500);
});

// ---- Brasswork ------------------------------------------------------------------------------------------------------

test("Brasswork: the old { text, savedAt } wrapper loads and keeps its save time", () => {
    const world = WORLD.createWorld({});
    const legacy = JSON.stringify({ text: BW.serialize(world), savedAt: 1_700_000_000_000 });
    const st = memory();
    st.setItem(BW.BRASSWORK_SAVE.key, legacy);
    const r = CORE.loadSave(st, BW.BRASSWORK_SAVE);
    assert.equal(r.status, "ok");
    assert.equal(r.savedAt, 1_700_000_000_000);
    assert.equal(r.state.time, world.time);
    assert.equal(r.state.hubId, world.hubId);
    CORE.writeSave(st, BW.BRASSWORK_SAVE, r.state, 1_700_000_500_000);
    const env = JSON.parse(st.getItem(BW.BRASSWORK_SAVE.key));
    assert.equal(env.app, "brasswork");
    assert.equal(env.version, 1);
    assert.equal(CORE.loadSave(st, BW.BRASSWORK_SAVE).state.hubId, world.hubId);
});

test("Brasswork: a damaged world text is kept, not silently dropped", () => {
    const st = memory();
    st.setItem(BW.BRASSWORK_SAVE.key, JSON.stringify({ text: "{not a world", savedAt: 1 }));
    assert.equal(CORE.loadSave(st, BW.BRASSWORK_SAVE).status, "lost");
    assert.match(st.getItem(BW.BRASSWORK_SAVE.key + "-corrupt"), /not a world/);
});

// ---- Node Farm ------------------------------------------------------------------------------------------------------

test("Node Farm: the envelope and the bare text both parse to the same save", () => {
    const s = NF.fresh(1_700_000_000_000);
    s.bytes = 4242;
    const envelope = NFS.nfSaveText(s, 1_700_000_100_000);
    assert.equal(NF.parseSave(envelope)?.bytes, 4242);
    assert.equal(NF.parseSave(JSON.stringify(s))?.bytes, 4242);
    assert.equal(NF.parseSave("{broken"), null);
});

// ---- Guesser streaks ------------------------------------------------------------------------------------------------

test("guesser streaks: a bare object from before the envelope migrates and fills the distribution", () => {
    const st = memory();
    st.setItem("outline-stats-v1", JSON.stringify({ daily: { played: 3, won: 2, streak: 1, best: 2, last: "x" }, unlimited: { played: "bad" } }));
    const r = CORE.loadSave(st, GS.statsSave("outline-guesser", "outline-stats-v1", 6));
    assert.equal(r.status, "migrated");
    assert.equal(r.state.daily.played, 3);
    assert.deepEqual(r.state.daily.dist, [0, 0, 0, 0, 0, 0]);
    assert.equal(r.state.unlimited.played, 0, "a bad counter reads as zero");
});

test("guesser streaks: a longer distribution is trimmed to the game's guess count", () => {
    const out = GS.normalizeStats({ daily: { played: 1, won: 1, streak: 1, best: 1, last: "", dist: [1, 2, 3, 4, 5, 6, 7] } }, 6);
    assert.deepEqual(out.daily.dist, [1, 2, 3, 4, 5, 6]);
    assert.equal(out.unlimited, undefined);
});

test("guesser streaks: a written value reads back through the envelope", () => {
    const st = memory();
    const def = GS.statsSave("flag-guesser", "flag-stats-v1", 6);
    CORE.writeSave(st, def, { daily: { played: 4, won: 4, streak: 4, best: 4, last: "2026-11-16", dist: [0, 1, 2, 1, 0, 0] } }, 1);
    const r = CORE.loadSave(st, def);
    assert.equal(r.status, "ok");
    assert.equal(r.state.daily.streak, 4);
});
