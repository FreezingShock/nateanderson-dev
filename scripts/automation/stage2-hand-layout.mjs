// Hand-built stage 2 layout on the 18 by 12 test island, through the placement calls only (no autoRoute).
// Four lines: iron plates and steel from the north-west, copper wire from the south-east, aluminium sheets
// from the south-west. Plates, steel and sheets side-load onto one trunk belt that enters the hub from the
// south. Copper wire has its own short belt into the hub's south-east cell.
// Run: node scripts/automation/stage2-hand-layout.mjs
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const S = await import("../../lib/automation/sim/index.ts");
const CAT = S.DEFAULT_CATALOG;
const HUB = { x: 8, z: 5 };
const E = 1, SOUTH = 0, W = 3, N = 2; // rot: 0 = +z, 1 = +x, 2 = -z, 3 = -x

export const WINDMILLS = [[0, 4], [5, 5], [12, 6], [16, 8]];

// extra(ctx) may add pieces (stage 3) and returns { research, deferred, tick } for the runner to buy and set.
// deferred.id may be a function, for pieces placed later; tick(world) runs every tenth of a second.
export function runStage2Layout(minutes = 10, windmills = WINDMILLS, extra = null) {
const world = S.createWorld({ width: 18, depth: 12, hub: HUB }, CAT);
const log = [];
const ok = (label, r) => { if (!r.ok) log.push(`FAIL ${label}: ${r.reason}`); return r.ok; };
const belt = (x, z, rot) => ok(`belt ${x},${z}`, S.place(world, "belt", x, z, rot, CAT));
const machine = (id, x, z, recipe) => {
  const r = S.place(world, id, x, z, 0, CAT);
  if (!ok(`${id} ${x},${z}`, r)) return null;
  if (recipe) ok(`recipe ${recipe}`, S.setRecipe(world, r.id, recipe, CAT));
  return r.id;
};

// Ore nodes on the island (test deposits, not the generator's).
for (const [item, x, z] of [["iron_ore", 1, 1], ["coal", 1, 6], ["aluminium_ore", 1, 10], ["coal", 1, 8], ["copper_ore", 14, 10]]) {
  S.addDeposit(world, x, z, item, 1);
}

// North-west: iron plates and steel.
machine("drill", 1, 1);
belt(3, 1, E); machine("kiln", 4, 1, "r_iron_ingot");           // kiln A
belt(6, 1, E); machine("press", 7, 1, "r_iron_plate");           // press Fe, fed by kiln A
belt(1, 3, E); belt(2, 3, E); belt(3, 3, E);                     // drill's second output feeds kiln B
machine("kiln", 4, 3, "r_iron_ingot");                           // kiln B, feeds the furnace below
const steelFurnace = machine("furnace", 3, 5, null);            // steel furnace, touches kiln B
machine("drill", 1, 6);                                          // coal drill touches the steel furnace
for (const z of [4, 5, 6, 7]) belt(7, z, SOUTH);                 // plates from press Fe down to the trunk
belt(6, 4, E);                                                   // kiln B's spare ingots side-load onto the plate line, so the hub gets iron ingots

// South-west: aluminium sheets.
machine("drill", 1, 10);                                         // aluminium drill, touches the furnace
const alFurnace = machine("furnace", 3, 9, null);   // 2 by 3, sits on the bottom rows
machine("drill", 1, 8);                                          // coal drill, touches the aluminium furnace
const alPress = machine("press", 5, 9, null);                     // press Al, touches the furnace and the trunk
// Recipes wait for their research, which the player buys with blueprints as they arrive.
const deferred = [
    { research: "furnace_alloys", id: steelFurnace, recipe: "r_steel_ingot" },
    { research: "furnace_alloys", id: alFurnace, recipe: "r_aluminium_ingot" },
    { research: "sheet_rolling", id: alPress, recipe: "r_aluminium_sheet" },
];
const researchLog = [];

// Trunk: side-loads from the north and south, enters the hub from the south-west corner.
for (let x = 4; x <= 7; x++) belt(x, 8, E);
belt(8, 8, N);

// South-east: copper wire.
machine("drill", 14, 10);
belt(13, 10, W); machine("kiln", 11, 9, "r_copper_ingot");       // copper kiln
belt(11, 8, N); belt(11, 7, N); belt(11, 6, W);  // spare copper ingots run north, then into the hub's east side
machine("drawer", 10, 9, "r_copper_wire");                       // wire drawer, touches the kiln
belt(10, 8, N);                                                  // wire goes straight into the hub

// Power: windmills set back from the lines.
for (const [x, z] of windmills) machine("windmill", x, z);

// Step in tenths of a second so a research purchase lands the moment the blueprints are there.
const buyWhenReady = (order) => {
    for (const node of order) {
        if (world.progress.researched.includes(node)) continue;
        const r = S.buyResearch(world, CAT, node);
        if (!r.ok) return;
        researchLog.push(`${node} at ${world.time.toFixed(0)}s`);
        for (const d of deferred) {
            const id = typeof d.id === "function" ? d.id() : d.id;
            if (d.research === node && id != null) ok(`recipe ${d.recipe}`, S.setRecipe(world, id, d.recipe, CAT));
        }
    }
};
const RESEARCH_ORDER = ["furnace_alloys", "sheet_rolling"];
const extras = extra ? extra({ world, S, CAT, belt, machine, ok, remove: (x, z) => ok(`remove ${x},${z}`, S.remove(world, S.buildingAt(world, x, z, CAT)?.id ?? -1, CAT)) }) : {};
deferred.push(...(extras.deferred ?? []));
const order = [...RESEARCH_ORDER, ...(extras.research ?? [])];
for (let t = 0; t < minutes * 600; t++) {
    S.advance(world, 0.1, 0.1, CAT);
    if (extras.tick) extras.tick(world);
    buyWhenReady(order);
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
