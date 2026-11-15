// The HUD's next-step line shows progress toward the next milestone's delivery.
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const S = await import(resolve(root, "lib/automation/sim/index.ts"));
const CAT = S.DEFAULT_CATALOG;

test("the next delivery line shows done and target per item", () => {
    const w = S.createWorld({ width: 20, depth: 20, hub: { x: 8, z: 5 } }, CAT);
    // Drill, kiln and windmill in place, so the early-game hints are past and the milestone line shows.
    S.addDeposit(w, 2, 2, "iron_ore", 1);
    const must = (r) => assert.equal(r.ok, true, r.reason);
    must(S.place(w, "drill", 2, 2, 0, CAT));
    const kiln = S.place(w, "kiln", 5, 2, 0, CAT);
    must(kiln);
    must(S.setRecipe(w, kiln.id, "r_iron_ingot", CAT));
    must(S.place(w, "windmill", 4, 6, 0, CAT));
    w.progress.requestsDone = CAT.tree.requests.map((r) => r.id); // past the early hub orders
    w.progress.delivered = { iron_ingot: 12 };
    const hud = S.hudData(w, CAT);
    const text = hud.nextStep.text;
    assert.match(text, /Iron ingot 12 of 50/);
    assert.match(text, /Copper ingot 0 of 30/);
});
