// Old saves, the save code and the checks other threads already wrote. The scripts in scripts/nodefarm do the detailed field-by-field
// comparison; this file runs them (so a PR cannot skip them) and adds round-trip checks on every fixture and on late-game states.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { E, AD, fixtureNames, fixtureRaw, loadFixture, maxed, noAt, play, problems } from "./helpers.mjs";

const root = resolve(import.meta.dirname, "../..");
const run = (script) => {
    try { return execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", resolve(root, "scripts/nodefarm", script)], { cwd: root, encoding: "utf8", stdio: "pipe" }); }
    catch (e) { assert.fail(`${script} failed:\n${e.stdout ?? ""}${e.stderr ?? ""}`); }
};

test("fixtures exist for every release stage", () => {
    assert.ok(fixtureNames().length >= 5, "scripts/nodefarm/fixtures should hold saves from old builds (see save-gen.mjs)");
});
test("old-save migration: save-compat.mjs passes (nothing lost, nothing NaN, nothing re-locked)", () => { run("save-compat.mjs"); });
test("removed tree nodes refund their AP", () => { run("removed-nodes-check.mjs"); });
test("backup rules", () => { run("backups-check.mjs"); });

for (const name of fixtureNames()) {
    test(`${name}: plain JSON and base64 code load to the same save`, () => {
        const raw = fixtureRaw(name);
        const a = E.parseSave(raw), b = E.parseSave(Buffer.from(raw).toString("base64"));
        assert.ok(a && b);
        assert.deepEqual(a, b);
    });
    test(`${name}: export then import round trip is lossless`, () => {
        const s = loadFixture(name);
        const code = E.exportSave(s);
        const back = E.parseSave(code);
        assert.ok(back, "its own export must load");
        assert.deepEqual(noAt(back), noAt(s));
        assert.deepEqual(noAt(E.parseSave(E.exportSave(back))), noAt(back), "exporting again changes nothing");
    });
    test(`${name}: migrated save has no NaN or negative values and still runs`, () => {
        const s = loadFixture(name);
        assert.deepEqual(problems(s), []);
        for (let i = 0; i < 600; i++) E.tick(s, 0.5);
        assert.deepEqual(problems(s), []);
    });
}

test("round trip on a played run and on a late-game state", () => {
    const played = play(E.fresh(0), 1800);
    for (const [label, s] of [["played 30 min", played], ["maxed", maxed()]]) {
        const back = E.parseSave(E.exportSave(s));
        assert.ok(back, label);
        assert.deepEqual(noAt(back), noAt(E.parseSave(JSON.stringify(s))), `${label}: export/import equals a plain JSON load`);
        assert.deepEqual(problems(back), [], label);
    }
});

test("round trip after a Handover (notes, keys and firmware survive)", () => {
    const s = maxed();
    AD.ownAllFw(s);
    assert.ok(E.handover(s, "wren", "note with “quotes” and ☃", "osk") >= 1);
    const back = E.parseSave(E.exportSave(s));
    assert.ok(back);
    assert.equal(back.hand.count, s.hand.count);
    assert.equal(back.hand.keys, s.hand.keys);
    assert.deepEqual(back.hand.fw, s.hand.fw);
    assert.deepEqual(back.hand.notes, s.hand.notes);
});

test("garbage never throws and never loads", () => {
    for (const bad of ["", "{", "null", "[]", "not a save", "e30=", "\u0000"]) assert.doesNotThrow(() => E.parseSave(bad), JSON.stringify(bad));
    assert.equal(E.parseSave("not a save"), null);
});
