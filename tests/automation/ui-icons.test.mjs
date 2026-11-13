// Brasswork HUD glyphs: the ui sheet exists, holds every cell in the index, and the glyphs the menus need are there.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const src = readFileSync(resolve(root, "lib/automation/icons/ui.ts"), "utf8");
const body = src.match(/export const UI_ICONS = \{([^}]*)\}/)[1];
const cells = Object.fromEntries([...body.matchAll(/"?([\w-]+)"?: (\d+),/g)].map((m) => [m[1], Number(m[2])]));

test("the menus' glyphs all have cells", () => {
    const needed = ["research", "expedition", "stats", "settings", "milestones", "prestige", "machines", "photo", "light",
        "codex", "keys", "power", "logistics", "blueprints", "sound", "rates", "undo", "redo", "remove"];
    for (const id of needed) assert.ok(id in cells, `${id} has no glyph`);
});

test("cells are unique and fit the sheet", () => {
    const png = resolve(root, "public/brasswork/icons/ui.png");
    assert.ok(existsSync(png));
    assert.ok(existsSync(resolve(root, "public/brasswork/icons/ui.webp")));
    const b = readFileSync(png);
    const w = b.readUInt32BE(16);
    const h = b.readUInt32BE(20);
    assert.equal(w, 8 * 64);
    assert.equal(h % 64, 0);
    const list = Object.values(cells);
    assert.equal(new Set(list).size, list.length);
    for (const k of list) assert.ok(k < (w / 64) * (h / 64), `cell ${k} is off the sheet`);
});
