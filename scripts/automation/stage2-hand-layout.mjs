// Hand-built stage 2 layout on the 18 by 12 test island, through the placement calls only (no autoRoute).
// Four lines: iron plates and steel from the north-west, copper wire from the south-east, aluminium sheets
// from the south-west. Machines take items in at their back edge and push out at their front edge, so every
// belt below starts at a front edge and ends at a back edge (or at the hub, which is open on every side).
// Run: node scripts/automation/stage2-hand-layout.mjs
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const S = await import("../../lib/automation/sim/index.ts");
const CAT = S.DEFAULT_CATALOG;
const HUB = { x: 8, z: 5 };
const E = 1, SOUTH = 0, W = 3, N = 2; // rot: 0 = +z, 1 = +x, 2 = -z, 3 = -x

export const WINDMILLS = [[0, 4], [14, 0], [12, 6], [16, 3], [12, 2]];

export function runStage2Layout(minutes = 10, windmills = WINDMILLS) {
const world = S.createWorld({ width: 18, depth: 12, hub: HUB }, CAT);
world.progress.requestsDone = CAT.tree.requests.map((r) => r.id); // this layout starts past the hub orders
const log = [];
const ok = (label, r) => { if (!r.ok) log.push(`FAIL ${label}: ${r.reason}`); return r.ok; };
const belt = (x, z, rot) => ok(`belt ${x},${z}`, S.place(world, "belt", x, z, rot, CAT));
const machine = (id, x, z, recipe, rot = 1) => {
  const r = S.place(world, id, x, z, rot, CAT);
  if (!ok(`${id} ${x},${z}`, r)) return null;
  if (recipe) ok(`recipe ${recipe}`, S.setRecipe(world, r.id, recipe, CAT));
  return r.id;
};

// Ore nodes on the island (test deposits, not the generator's).
for (const [item, x, z] of [["iron_ore", 1, 1], ["coal", 1, 6], ["aluminium_ore", 1, 10], ["coal", 1, 8], ["copper_ore", 14, 10]]) {
  S.addDeposit(world, x, z, item, 1);
}

// Machines have real ports: items go in through the back edge and out through the front edge (the side they face).
// Rotations: 0 faces +z, 1 faces +x (east), 2 faces -z (north), 3 faces -x. Most machines face east (their back is west);
// the copper line faces north and the hub is open on every side.
const copperDrill = machine("drill", 14, 10, null, N);
// North-west: iron plates, and the iron ingots a steel furnace and the hub both need.
machine("drill", 1, 1);
machine("kiln", 5, 1, "r_iron_ingot");                           // kiln A, feeds the press and the hub
const kilnB = machine("kiln", 5, 3, "r_iron_ingot");              // kiln B, feeds the steel furnace
machine("press", 10, 1, "r_iron_plate", SOUTH);                   // press Fe: back edge north, front edge south onto the hub
const steelFurnace = machine("furnace", 5, 6, null);             // steel furnace: ingots on its back edge from the north, coal below; front edge touches the hub
machine("drill", 1, 6);                                          // coal drill for the steel furnace
// South-west: aluminium sheets. The furnace's front edge touches the press, so no belt joins them.
machine("drill", 1, 10);                                         // aluminium drill
machine("drill", 1, 8);                                          // coal drill
const alFurnace = machine("furnace", 5, 9, null);
const alPress = machine("press", 8, 9, null);
// South-east: copper. One drill feeds two kilns; kiln 1 feeds the drawer directly, kiln 2 sends ingots to the hub.
machine("kiln", 13, 8, "r_copper_ingot", N);
machine("kiln", 15, 8, "r_copper_ingot", N);
machine("drawer", 14, 6, "r_copper_wire", N);                    // wire drawer: back edge touches kiln 1, front edge drops onto the wire belt
// Belts. Each machine keeps its own back-edge cell, so a coal belt can never block an ingot belt.
const BELTS = [
  [3, 1, E], [4, 1, E], [3, 2, SOUTH], [3, 3, E], [4, 3, E],                 // drill to kiln A and kiln B
  [7, 1, E], [8, 1, E], [9, 1, N], [9, 0, E], [10, 0, SOUTH],                // kiln A to the press back edge
  [7, 2, SOUTH], [7, 3, E], [8, 3, SOUTH], [8, 4, SOUTH],                    // kiln A spare ingots to the hub
  [10, 4, SOUTH],                                                            // press Fe to the hub
  [7, 4, SOUTH], [7, 5, W], [6, 5, W], [5, 5, W], [4, 5, SOUTH], [4, 6, E],  // kiln B to the steel furnace
  [3, 7, E], [4, 7, E],                                                      // coal to the steel furnace
  [3, 9, E], [4, 9, E], [3, 10, E], [4, 10, E],                              // coal and aluminium ore to the aluminium furnace
  [11, 9, N], [11, 8, N], [11, 7, W],                                        // sheets to the hub
  [15, 7, N], [15, 6, N], [15, 5, W], [14, 5, W], [13, 5, W], [12, 5, W], [11, 5, W], // copper ingots and wire to the hub
];
for (const [x, z, r] of BELTS) belt(x, z, r);
void copperDrill; void kilnB;
// Recipes wait for their research, which the player buys with blueprints as they arrive.
const deferred = [
    { research: "furnace_alloys", id: steelFurnace, recipe: "r_steel_ingot" },
    { research: "furnace_alloys", id: alFurnace, recipe: "r_aluminium_ingot" },
    { research: "sheet_rolling", id: alPress, recipe: "r_aluminium_sheet" },
];
const researchLog = [];

// Power: windmills set back from the lines.
for (const [x, z] of windmills) machine("windmill", x, z);

// Step in tenths of a second so a research purchase lands the moment the blueprints are there.
const buyWhenReady = (order) => {
    for (const node of order) {
        if (world.progress.researched.includes(node)) continue;
        const r = S.buyResearch(world, CAT, node);
        if (!r.ok) return;
        researchLog.push(`${node} at ${world.time.toFixed(0)}s`);
        for (const d of deferred) if (d.research === node) ok(`recipe ${d.recipe}`, S.setRecipe(world, d.id, d.recipe, CAT));
    }
};
const RESEARCH_ORDER = ["furnace_alloys", "sheet_rolling"];
for (let t = 0; t < minutes * 600; t++) {
    S.advance(world, 0.1, 0.1, CAT);
    buyWhenReady(RESEARCH_ORDER);
}

const hub = world.buildings[world.hubId].input;
const targets = { iron_plate: 60, copper_wire: 60, steel_ingot: 30, aluminium_sheet: 20 };
const stock = Object.fromEntries(Object.keys(targets).map((item) => [item, hub[item] ?? 0]));
return { stock, targets, log, world, researchLog };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
const { stock, targets, log, world } = runStage2Layout();
for (const [item, need] of Object.entries(targets)) console.log(`${stock[item] >= need ? "ok  " : "NO  "} ${item} ${stock[item]} of ${need}`);
let free = 0;
for (let z = 0; z < 12; z++) for (let x = 0; x < 18; x++) if (!S.buildingAt(world, x, z, CAT) && !world.deposits[`${x},${z}`]) free++;
console.log(`free cells ${free} of ${18 * 12} (ore nodes excluded)`);
for (const line of log) console.log(line);
console.log(`power ${JSON.stringify(world.power)}`);
}
