// Brasswork tooltips: every machine, item, research node, milestone and control has a tag built from game data,
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const T = await import(pathToFileURL(resolve(root, "lib/automation/tips.ts")).href);
const S = await import(pathToFileURL(resolve(root, "lib/automation/sim/index.ts")).href);
const CAT = S.DEFAULT_CATALOG;
const tree = CAT.tree;

function checkTag(tip, label) {
  assert.ok(tip, `${label}: no tag`);
  assert.equal(typeof tip.title, "string", `${label}: title`);
  assert.ok(tip.title.trim().length > 0, `${label}: empty title`);
  const text = JSON.stringify(tip);
  assert.ok(!/undefined|NaN|null/.test(text), `${label}: bad value in ${text}`);
  for (const r of tip.rows ?? []) {
    assert.ok(r.k && r.v, `${label}: empty row`);
    assert.ok(!/^\s*$/.test(r.v), `${label}: blank value for ${r.k}`);
  }
}

test("every machine in the tree has a build-list tag with a cost and size", () => {
  for (const m of tree.machines) {
    const view = {
      id: m.id, name: m.name, glyph: "", unlocked: true, count: 2, cost: (m.buildCost ?? []).map((s) => ({ resourceId: s.item, amount: s.qty })),
      status: "idle", group: m.generatesKw ? "power" : "machines",
    };
    const tip = T.machineTip(CAT, view, 1);
    checkTag(tip, m.id);
    assert.ok(tip.rows.some((r) => r.k === "Built" && r.v === "2"), `${m.id}: built count`);
    assert.ok(tip.rows.some((r) => r.k === "Size"), `${m.id}: size`);
    assert.equal(tip.key, "1");
  }
});

test("a locked machine says why it is locked and shows no cost line", () => {
  const m = tree.machines[0];
  const view = { id: m.id, name: m.name, glyph: "", unlocked: false, lockedReason: "Unlocks at stage 2", count: 0, cost: [], status: "idle" };
  const tip = T.machineTip(CAT, view);
  assert.equal(tip.note, "Unlocks at stage 2");
  assert.ok(!tip.rows.some((r) => r.k === "Cost"));
});

test("every item has a tag, and every base-recipe item says what makes it", () => {
  for (const item of tree.items) {
    const tip = T.itemTip(tree, item.id);
    checkTag(tip, item.id);
    const base = tree.recipes.find((r) => r.output.item === item.id && !r.alternate);
    if (base) assert.ok(tip.rows.some((r) => r.k === "Made in"), `${item.id}: made in`);
  }
});

test("every research node has a cost, a state and the names of what it needs", () => {
  for (const n of tree.research) {
    const view = { id: n.id, name: n.name, glyph: "", note: n.note ?? "", blueprintCost: n.cost, requires: n.requires, unlocks: [], column: 0, row: 0, state: "locked" };
    const tip = T.researchTip(tree, view, 3);
    checkTag(tip, n.id);
    assert.ok(tip.rows.some((r) => r.k === "Cost"), `${n.id}: cost`);
    assert.ok(tip.rows.some((r) => r.k === "State" && r.v === "Locked"), `${n.id}: locked state`);
  }
  const ready = T.researchTip(tree, { id: "x", name: "X", glyph: "", note: "", blueprintCost: 4, requires: [], unlocks: ["Iron gear"], column: 0, row: 0, state: "available" }, 0);
  assert.ok(ready.rows.some((r) => r.k === "State" && r.v === "Ready to buy"));
  assert.ok(ready.rows.some((r) => r.k === "Unlocks" && r.v === "Iron gear"));
  const short = T.researchTip(tree, { id: "x", name: "X", glyph: "", note: "", blueprintCost: 4, requires: [], unlocks: [], column: 0, row: 0, state: "available" }, 2);
  assert.ok(short.rows.some((r) => r.k === "State" && r.v === "2 more blueprints"));
});

test("every recipe tag gives its inputs, output and craft time", () => {
  for (const r of tree.recipes) {
    const tip = T.recipeTip(tree, r);
    checkTag(tip, r.id);
    assert.ok(tip.rows.some((x) => x.k === "Craft time"), `${r.id}: craft time`);
    assert.equal(tip.tag, r.alternate ? "Alternate recipe" : "Recipe");
  }
});

test("every milestone tag shows its reward and progress", () => {
  for (const m of tree.milestones) {
    const view = { id: m.id, name: m.name, goal: "Deliver", progress: 0.5, blueprintReward: m.blueprints, done: false, items: [] };
    const tip = T.milestoneTip(view);
    checkTag(tip, m.id);
    assert.ok(tip.rows.some((r) => r.k === "Progress" && r.v === "50%"));
  }
});

test("control tags are complete and carry the right keys", () => {
  for (const [id, tip] of Object.entries(T.CONTROL_TIPS)) {
    checkTag(tip, id);
    assert.ok(tip.text && tip.text.length > 10, `${id}: needs a line of text`);
  }
  assert.equal(T.CONTROL_TIPS.rotate.key, "R");
  assert.equal(T.CONTROL_TIPS.remove.key, "X");
});

test("kind tags for placed buildings resolve for every machine and engine piece", () => {
  for (const id of [...tree.machines.map((m) => m.id), ...Object.keys(CAT.engine)]) {
    const tip = T.kindTip(CAT, id);
    assert.ok(tip, `${id}: no kind tag`);
    checkTag(tip, id);
  }
  assert.equal(T.kindTip(CAT, "not-a-building"), null);
});

test("number formatting drops trailing zeros", () => {
  assert.equal(T.num(2), "2");
  assert.equal(T.num(1.5), "1.5");
  assert.equal(T.num(0.333333), "0.33");
});
