// Groundbreak guidance, welcome-back summary and extra console commands.
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const E = await import(resolve(root, "lib/groundbreak/engine.ts"));
const G = await import(resolve(root, "lib/groundbreak/guide.ts"));
const C = await import(resolve(root, "lib/groundbreak/commands.ts"));
const Q = await import(resolve(root, "lib/groundbreak/commands-qol.ts"));

const run = (s, secs) => { for (let t = 0; t < secs; t++) E.step(s, 1); };

test("a fresh game always has a cue, and Space-style doCue never throws", () => {
    const s = E.fresh(0);
    const c = G.nextCue(s);
    assert.ok(c.text.length > 0 && c.why.length > 0);
    for (let i = 0; i < 400; i++) { run(s, 3); const cue = G.nextCue(s); assert.ok(cue.text); if (cue.doable) assert.ok(G.doCue(s, cue), cue.kind); }
});

test("a bot that only follows the cue keeps progressing", () => {
    const s = E.fresh(0);
    for (let i = 0; i < 20 * 60; i++) { run(s, 3); for (let k = 0; k < 4; k++) { const c = G.nextCue(s); if (!c.doable || c.kind === "incorporate") break; G.doCue(s, c); } }
    assert.ok(s.built >= 3, `built ${s.built}`);
    assert.ok(s.open >= 4, `open ${s.open}`);
});

test("cue order: change order first, unlock next, then a purchase, then waiting", () => {
    const s = E.fresh(0);
    s.amt[0] = 1e6;
    assert.equal(G.nextCue(s).kind, "unlock");
    s.change = { job: 0, left: 30, extra: [], bonus: 0.3 };
    assert.equal(G.nextCue(s).kind, "accept");
    s.change = null; s.amt[0] = 0; s.cash = 0;
    const w = G.nextCue(s);
    assert.ok(["buy", "wait"].includes(w.kind));
});

test("welcome-back summary lists what happened and notes the cap", () => {
    const s = E.fresh(0);
    run(s, 600);
    const snap = G.awaySnap(s);
    const did = E.catchUp(s, 3600);
    const a = G.awaySummary(snap, s, 3600, did, E.offlineCapS(E.effects(s)));
    assert.ok(a && a.secs > 3000 && !a.capped);
    assert.ok(a.mats.length > 0);
    const b = G.awaySummary(snap, s, 99 * 3600, did, E.offlineCapS(E.effects(s)));
    assert.equal(b.capped, true);
    assert.equal(G.awaySummary(snap, s, 5, 5, 3600), null);
});

test("console: next, go, auto, rate, admin gate, give, warp", () => {
    const s = E.fresh(0);
    assert.ok(C.gbCommand(s, ["next"]).lines.length >= 2);
    assert.match(C.gbCommand(s, ["give", "cash", "10"]).lines[0].t, /admin on/);
    C.gbCommand(s, ["admin", "on"]);
    C.gbCommand(s, ["give", "cash", "500"]);
    assert.equal(s.cash >= 500, true);
    const r = C.gbCommand(s, ["warp", "30m"]);
    assert.equal(r.changed, true);
    assert.ok(s.age > 1700);
    assert.ok(C.gbCommand(s, ["rate"]).lines.length === s.open);
    assert.match(C.gbCommand(s, ["auto", "crews"]).lines[0].t, /not unlocked/);
    s.perks.push("o1", "o2");
    assert.match(C.gbCommand(s, ["auto", "crews", "off"]).lines[0].t, /off/);
    assert.deepEqual(s.autoOff, [1]);
    assert.ok(Number.isNaN(Q.parseDuration("soon")) && Q.parseDuration("2h") === 7200);
    C.gbCommand(s, ["admin", "off"]);
});
