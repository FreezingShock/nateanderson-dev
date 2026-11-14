// Hand-built stage 2 layout through the placement calls (no autoRoute). Prints the hub stock after ten minutes.
// Run: node scripts/automation/stage2-hand-layout.mjs
import { registerHooks } from "node:module";
registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const S = await import("../../lib/automation/sim/index.ts");
const CAT = S.DEFAULT_CATALOG; const HUB = { x: 8, z: 5 };
const world = S.createWorld({ width: 18, depth: 12, hub: HUB }, CAT);
const nodes = { iron: [2, 2], copper: [14, 0], coal: [15, 2], aluminium: [2, 5] };
for (const [item, [x, z]] of Object.entries(nodes)) S.addDeposit(world, x, z, `${item}_ore`, 1);
S.addDeposit(world, 15, 2, "coal", 1);
const ok = (label, r) => { if (!r.ok) console.log("FAIL", label, r.reason); return r.ok; };
const belt = (x, z, rot) => ok(`belt ${x},${z}`, S.place(world, "belt", x, z, rot, CAT));
const machine = (id, x, z, recipe) => { const r = S.place(world, id, x, z, 0, CAT); if (!ok(`${id} ${x},${z}`, r)) return null; if (recipe) ok(`recipe ${recipe}`, S.setRecipe(world, r.id, recipe, CAT)); return r.id; };
// Iron: drill feeds two kilns; one kiln's ingots go to a press that touches the hub.
machine("drill", 2, 2);
belt(4, 2, 1); machine("kiln", 5, 2, "r_iron_ingot");
belt(7, 2, 1); machine("press", 8, 2, "r_iron_plate");
belt(2, 4, 1); belt(3, 4, 1); belt(4, 4, 1); machine("kiln", 5, 4, "r_iron_ingot");
// Steel: second kiln's ingots go south around the hub into a furnace that touches the hub.
belt(5, 6, 0); belt(5, 7, 0); belt(5, 8, 1); for (let x = 6; x <= 10; x++) belt(x, 8, 1); belt(11, 8, 2);
machine("furnace", 11, 5, "r_steel_ingot");
// Coal to the furnace.
machine("drill", 15, 2);
belt(14, 3, 3); belt(13, 3, 0); belt(13, 4, 0); belt(13, 5, 3);
machine("windmill", 6, 0); machine("windmill", 4, 0); machine("windmill", 13, 8); machine("windmill", 14, 6); machine("windmill", 0, 9); machine("windmill", 10, 10); machine("windmill", 16, 10); machine("windmill", 16, 0);
// Copper: drill feeds a kiln that sits on the north edge; its ingots go down into a wire drawer that touches the hub.
machine("drill", 14, 0); belt(13, 0, 3);
machine("kiln", 11, 0, "r_copper_ingot");
belt(11, 2, 0); belt(11, 3, 3);
machine("drawer", 10, 3, "r_copper_wire");
for (let t = 0; t < 600; t++) S.advance(world, 1, 0.1, CAT);
const hub = world.buildings[world.hubId].input;
console.log("hub after 10 min", JSON.stringify(hub));
console.log("buildings", Object.values(world.buildings).length, "power", JSON.stringify(S.hudData ? "" : ""));
const f = Object.values(world.buildings).find((b) => b.type === "furnace");
console.log("furnace", JSON.stringify({ input: f.input, output: f.output, power: f.power, sat: f.satisfaction, recipe: f.recipe }));
const k = Object.values(world.buildings).filter((b) => b.type === "kiln").map((b) => ({ x: b.x, z: b.z, input: b.input, output: b.output, recipe: b.recipe, sat: b.satisfaction }));
console.log("kilns", JSON.stringify(k));
for (const b of Object.values(world.buildings)) if (["drill","belt"].includes(b.type) && (b.z >= 2 && b.z <= 4)) console.log(b.type, b.x, b.z, b.rot, JSON.stringify(b.items ?? b.cargo ?? b.lane ?? b.output ?? {}), b.acc ?? "");
console.log("power", JSON.stringify(world.power));
