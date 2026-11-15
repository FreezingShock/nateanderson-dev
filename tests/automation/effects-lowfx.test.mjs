// Place, remove and milestone bursts must not touch the particle pool under Simple visuals (low fx / reduce motion).
import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const THREE = await import("three");
const { MachineEffects } = await import(resolve(root, "lib/automation/render/effects.ts"));
const alive = (fx) => fx.parts.filter((p) => p.alive).length;

test("bursts spawn particles with effects on, and none with effects off", () => {
    const fx = new MachineEffects(new THREE.Scene());
    for (const kind of ["place", "remove", "milestone"]) {
        fx.burst(0, 0, 0, kind);
        assert.ok(alive(fx) > 0, `${kind} spawns with effects on`);
        fx.parts.forEach((p) => (p.alive = false));
    }
    fx.setEnabled(false);
    for (const kind of ["place", "remove", "milestone"]) {
        fx.burst(0, 0, 0, kind);
        assert.equal(alive(fx), 0, `${kind} spawns nothing with effects off`);
    }
});
