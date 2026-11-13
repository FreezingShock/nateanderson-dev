// Unit tests for the shared game save helpers (lib/games/save.ts). Run with npm run test:nodefarm.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSaveTools, readStored, writeStored, MAX_SAVE_BYTES } from "../../lib/games/save.ts";

const isState = (v) => !!v && typeof v === "object" && typeof v.count === "number";
const tools = createSaveTools({ app: "demo", version: 2, validate: isState });

test("export writes an envelope with app, version and savedAt", () => {
    const text = tools.exportText({ count: 5 }, new Date("2026-11-13T12:00:00Z"));
    const env = JSON.parse(text);
    assert.equal(env.app, "demo");
    assert.equal(env.version, 2);
    assert.equal(env.savedAt, "2026-11-13T12:00:00.000Z");
    assert.deepEqual(env.data, { count: 5 });
});

test("import round-trips an exported save", () => {
    const r = tools.importText(tools.exportText({ count: 9 }));
    assert.equal(r.ok, true);
    assert.deepEqual(r.data, { count: 9 });
});

test("import refuses empty, oversized and non-JSON text with a reason", () => {
    assert.match(tools.importText("   ").error, /empty/);
    assert.match(tools.importText("x".repeat(MAX_SAVE_BYTES + 1)).error, /too large/);
    assert.match(tools.importText("{nope").error, /not valid JSON/);
});

test("import refuses another game's save", () => {
    const other = JSON.stringify({ app: "other", version: 1, data: { count: 1 } });
    assert.match(tools.importText(other).error, /for other/);
});

test("import refuses a save from a newer version", () => {
    const future = JSON.stringify({ app: "demo", version: 3, data: { count: 1 } });
    assert.match(tools.importText(future).error, /newer version/);
});

test("import refuses data that fails validation and a missing version", () => {
    assert.match(tools.importText(JSON.stringify({ app: "demo", version: 2, data: { count: "x" } })).error, /damaged/);
    assert.match(tools.importText(JSON.stringify({ app: "demo", data: { count: 1 } })).error, /no usable version/);
});

test("older versions are accepted when they pass validation", () => {
    const old = JSON.stringify({ app: "demo", version: 1, data: { count: 4 } });
    assert.deepEqual(tools.importText(old).data, { count: 4 });
});

test("file names carry the app and date", () => {
    assert.equal(tools.fileName(new Date("2026-11-13T00:00:00Z")), "demo-save-2026-11-13.json");
});

test("stored reads and writes never throw", () => {
    const store = new Map();
    const good = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    assert.equal(writeStored(good, "k", "v"), true);
    assert.equal(readStored(good, "k"), "v");
    const blocked = {
        getItem() { throw new Error("denied"); },
        setItem() { throw new Error("full"); },
    };
    assert.equal(readStored(blocked, "k"), null);
    assert.equal(writeStored(blocked, "k", "v"), false);
    assert.equal(readStored(null, "k"), null);
    assert.equal(writeStored(undefined, "k", "v"), false);
});
