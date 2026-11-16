// The codex's "new" rule: basics and reference entries are never new, and what the player reaches but has not read is.
// The rail count, the window's NEW readout and the dots in its list all come from isCodexNew, so they cannot disagree.
import test from "node:test";
import assert from "node:assert/strict";
import { maxed, CX } from "./helpers.mjs";
const { codexNew, codexSeen, isCodexNew, markCodexSeen, unlocked } = CX;

test("codex: basics and reference entries are never new", () => {
    const s = maxed();
    const seen = codexSeen();
    const basics = unlocked(s).filter((e) => e.group === "basics" || e.group === "ref");
    assert.ok(basics.length > 0, "the maxed state unlocks basics entries");
    for (const e of basics) assert.equal(isCodexNew(e, seen), false, `${e.id} is not new`);
});

test("codex: a reached entry is new until it is read, and the rail count agrees with the rule", () => {
    const s = maxed();
    const reached = unlocked(s).filter((e) => e.group !== "basics" && e.group !== "ref");
    assert.ok(reached.length > 0, "the maxed state reaches non-basics entries");
    const target = reached[0];
    const seen = codexSeen();
    seen.delete(target.id);
    assert.equal(isCodexNew(target, seen), true, "unread reached entry is new");
    assert.ok(codexNew(s).some((e) => e.id === target.id), "the rail count includes it");
    markCodexSeen(target.id);
    assert.equal(isCodexNew(target, codexSeen()), false, "reading it clears it");
    assert.ok(!codexNew(s).some((e) => e.id === target.id), "and the rail count drops it");
    // the panel's NEW readout is the same filter over the unlocked list, so it matches the rail exactly
    const panel = unlocked(s).filter((e) => isCodexNew(e, codexSeen())).length;
    assert.equal(panel, codexNew(s).length);
});
