// Research gates recipes in the sim: a recipe behind research is refused until that research is bought.
// Blueprint economy: every stage's research is affordable from the milestones before it.
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const S = await import(resolve(root, "lib/automation/sim/index.ts"));
const CAT = S.DEFAULT_CATALOG;

test("a recipe behind research is refused until the research is bought", () => {
    const w = S.createWorld({ width: 20, depth: 20, hub: { x: 8, z: 5 } }, CAT);
    const lathe = S.place(w, "lathe", 4, 4, 0, CAT);
    assert.equal(lathe.ok, true, lathe.reason);
    const refused = S.setRecipe(w, lathe.id, "r_iron_gear", CAT);
    assert.equal(refused.ok, false);
    assert.match(refused.reason, /research/);
    w.progress.blueprints = 10;
    assert.equal(S.buyResearch(w, CAT, "gears").ok, true);
    assert.equal(S.setRecipe(w, lathe.id, "r_iron_gear", CAT).ok, true);
});

test("the research for each stage is affordable from the milestones before it", () => {
    const tree = CAT.tree;
    const cost = Object.fromEntries(tree.research.map((n) => [n.id, n.cost]));
    // Total cost of a research node and everything it requires.
    const closure = (ids) => {
        const out = new Set();
        const walk = (id) => {
            if (out.has(id)) return;
            out.add(id);
            tree.research.find((n) => n.id === id).requires.forEach(walk);
        };
        ids.forEach(walk);
        return [...out].reduce((a, id) => a + cost[id], 0);
    };
    const stage3 = ["gears", "sheet_rolling", "furnace_alloys", "silicon", "circuits", "casings", "frames", "steel_beams"];
    const stage4 = ["motors", "servos", "photocells", "quartz_optics"];
    const megaproject = ["lens_arrays", "mirror_rings", "relay_cores", "orrery_struts"];
    // Blueprints earned before milestone i: the sum of the milestones before it.
    const earned = (i) => tree.milestones.slice(0, i).reduce((a, m) => a + m.blueprints, 0);
    assert.ok(earned(2) >= closure(stage3), `stage 3 needs ${closure(stage3)} blueprints, has ${earned(2)}`);
    assert.ok(earned(3) >= closure([...stage3, ...stage4]), `stage 4 needs ${closure([...stage3, ...stage4])}, has ${earned(3)}`);
    assert.ok(earned(4) >= closure([...stage3, ...stage4, ...megaproject]), `megaproject needs ${closure([...stage3, ...stage4, ...megaproject])}, has ${earned(4)}`);
});
