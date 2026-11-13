// Brasswork item art: every catalog item, machine and structure has a cell on the icon sheet.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { RECIPE_TREE } = await import(resolve(root, "lib/automation/data/tree.ts"));

// The icon index is generated TSX-free TypeScript but imports a React type, so read its tables as text.
const iconSrc = readFileSync(resolve(root, "lib/automation/icons/index.ts"), "utf8");
const table = (name) => {
    const body = iconSrc.match(new RegExp(`export const ${name} = \\{([^}]*)\\}`))[1];
    return Object.fromEntries([...body.matchAll(/(\w+): (\d+)/g)].map((m) => [m[1], Number(m[2])]));
};

test("every item has an icon cell", () => {
    const icons = table("ITEM_ICONS");
    for (const item of RECIPE_TREE.items) assert.ok(item.id in icons, `${item.id} has no icon`);
});

test("every machine has an icon cell", () => {
    const icons = table("MACHINE_ICONS");
    for (const m of RECIPE_TREE.machines) assert.ok(m.id in icons, `${m.id} has no icon`);
});

test("every structure has an icon cell", () => {
    const icons = table("STRUCTURE_ICONS");
    for (const st of RECIPE_TREE.structures ?? []) assert.ok(st.id in icons, `${st.id} has no icon`);
});

test("the icon sheet exists and fits every cell", () => {
    const png = resolve(root, "public/brasswork/icons/items.png");
    assert.ok(existsSync(png));
    const b = readFileSync(png);
    const w = b.readUInt32BE(16);
    const h = b.readUInt32BE(20);
    const cells = Object.values({ ...table("ITEM_ICONS"), ...table("MACHINE_ICONS"), ...table("STRUCTURE_ICONS") });
    assert.equal(w % 64, 0);
    assert.ok(Math.max(...cells) < (w / 64) * (h / 64));
});
