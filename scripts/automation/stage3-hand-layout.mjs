// Stage 3 on top of the hand-built stage 2 layout, through the placement calls only (no autoRoute).
// Stage 2's copper ingot route and north-east windmill come out, since stage 3 no longer needs them.
// Phase A (built here): an iron line makes rods; one lathe makes screws straight into the frame assembler, which
// takes plates from the iron press and puts frames into the hub; a second lathe makes gears straight into the hub.
// Casings, circuit boards and steel beams are not placed yet.
// Run: node scripts/automation/stage3-hand-layout.mjs
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const { runStage2Layout } = await import("./stage2-hand-layout.mjs");
const S = await import("../../lib/automation/sim/index.ts");
const CAT = S.DEFAULT_CATALOG;
const E = 1, SOUTH = 0, W = 3;

// Stage 2's windmill at (12, 6) sits where the gear lathe goes, so it is replaced by one further east.
const WINDMILLS = [[0, 4], [5, 5], [16, 8], [16, 3]];

export function phaseA({ world, belt, machine, ok, remove }) {
    // Iron node two, its kiln and the rod supply run from the start, since the rod lathes need them.
    S.addDeposit(world, 16, 0, "iron_ore", 1);
    machine("kiln", 14, 0, "r_iron_ingot");
    machine("drill", 16, 0);
    belt(13, 0, W);                                              // kiln ingots side into rod lathe A
    belt(14, 2, SOUTH); belt(14, 3, SOUTH); belt(14, 4, SOUTH);  // and down to rod lathe B
    belt(14, 5, W); belt(13, 5, W);
    machine("lathe", 12, 0, "r_iron_rod");                       // rod lathe A, feeds the screw lathe
    machine("lathe", 12, 2, "r_iron_screw");                     // screw lathe, pushes screws straight into the frame assembler
    const frames = machine("assembler", 9, 2, null);             // frame assembler: plates from the press, screws from the lathe, frames into the hub
    // Beam press: sits on the trunk's south side so beams side-load into the hub. Steel reaches it through a filtered
    // unloader at (9, 8), which is not placed yet because an unloader costs iron rods the hub does not hold.
    const beams = machine("press", 8, 9, null);
    let gears = null;
    // Stage 2's copper ingot belt and its windmill sit where the gear pieces go. Milestone 1 needs those copper ingots
    // in the hub first, so the pieces go in only once it is done.
    let placed = false;
    const tick = (w) => {
        if (placed || !w.progress.milestonesDone.includes("ms_smelting")) return;
        placed = true;
        remove(11, 8); remove(11, 7); remove(11, 6);
        machine("lathe", 12, 5, "r_iron_rod");                   // rod lathe B, feeds the gear lathe
        gears = machine("lathe", 11, 5, null);                   // gear lathe: pushes gears straight into the hub
    };
    return {
        research: ["gears", "frames", "steel_beams"],
        deferred: [
            { research: "gears", id: () => gears, recipe: "r_iron_gear" },
            { research: "frames", id: frames, recipe: "r_frame" },
            { research: "steel_beams", id: beams, recipe: "r_steel_beam" },
        ],
        tick,
    };
}

export function runStage3Layout(minutes = 30) {
    const res = runStage2Layout(minutes, WINDMILLS, phaseA);
    const hub = res.world.buildings[res.world.hubId].input;
    const delivered = res.world.progress.delivered;
    return { ...res, hub, delivered };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const r = runStage3Layout(30);
    console.log("research", JSON.stringify(r.researchLog));
    console.log("milestones", JSON.stringify(r.world.progress.milestonesDone), "blueprints", r.world.progress.blueprints);
    console.log("delivered", JSON.stringify(r.delivered));
    console.log("hub", JSON.stringify(r.hub));
    for (const line of r.log) console.log(line);
    console.log("power", JSON.stringify(r.world.power));
}
