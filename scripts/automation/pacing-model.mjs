// Brasswork pacing model. NOT a play-through: it walks the recipe tree for every hub request and milestone and answers two questions.
//   1. Can the player always reach the next milestone? Every machine is unlocked, and every research node a recipe needs
//      is paid for by blueprints from earlier milestones, in time (a soft-lock check).
//   2. How fast could a perfect factory be? An idealised lower bound per milestone from drill rates and machine-seconds,
//      with no belts, no power and no building time, so the real time is always longer. Nate's playtest (P-01) judges pacing.
//   node --experimental-strip-types --no-warnings scripts/automation/pacing-model.mjs [--json]
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const S = await import(resolve(root, "lib/automation/sim/index.ts"));
const CAT = S.DEFAULT_CATALOG;
const PURITY_NORMAL = 1;

const T = CAT.tree;
const baseRecipe = new Map();
for (const r of T.recipes) if (!r.alternate) baseRecipe.set(r.output.item, r);
const machineDef = new Map(T.machines.map((m) => [m.id, m]));
const isRaw = (item) => T.nodes.some((n) => n.item === item);

// Everything a set of deliveries needs: raw ore, machine-seconds per machine type, and the recipes used.
function closure(stacks) {
    const ore = {};
    const machineSeconds = {};
    const recipes = new Set();
    const add = (item, qty) => {
        if (isRaw(item)) { ore[item] = (ore[item] ?? 0) + qty; return; }
        const rec = baseRecipe.get(item);
        if (!rec) throw new Error(`no base recipe makes ${item}`);
        recipes.add(rec.id);
        const runs = qty / rec.output.qty;
        machineSeconds[rec.machine] = (machineSeconds[rec.machine] ?? 0) + runs * rec.craftSeconds;
        for (const i of rec.inputs) add(i.item, runs * i.qty);
    };
    for (const s of stacks) add(s.item, s.qty);
    return { ore, machineSeconds, recipes };
}

const researchFor = (recipeId) => T.research.find((n) => n.recipes.includes(recipeId));
function researchChain(nodeId, out = new Set()) {
    const n = T.research.find((x) => x.id === nodeId);
    if (!n || out.has(nodeId)) return out;
    out.add(nodeId);
    for (const r of n.requires) researchChain(r, out);
    return out;
}

// A hub request opens its machines and recipes. unlockedMachine is the sim's own rule, run on a scratch world.
const scratch = () => S.createWorld({ width: 18, depth: 12, hub: { x: 8, z: 5 } }, CAT);

export function analyse({ drills = 1, machines = 2 } = {}) {
    const problems = [];
    const rows = [];
    const w = scratch();
    const doneRequests = [];
    const needed = [];      // cumulative deliveries
    const researchBought = new Set();
    let blueprints = 0;

    // Requests come first, in listed order. Each must be makeable with what the earlier ones opened.
    for (const q of T.requests ?? []) {
        const c = closure(q.deliver);
        for (const m of Object.keys(c.machineSeconds)) {
            const def = machineDef.get(m);
            if (!S.unlockedMachine(w, CAT, def.unlockStage, m)) problems.push(`request ${q.id} needs ${m} before anything opens it`);
        }
        for (const r of c.recipes) {
            const rec = T.recipes.find((x) => x.id === r);
            const gate = (T.requests ?? []).find((x) => x.unlocks.recipes.includes(rec.id));
            if (gate && !doneRequests.includes(gate.id)) problems.push(`request ${q.id} needs recipe ${rec.id} which request ${gate.id} opens later`);
            const node = researchFor(rec.id);
            if (node) problems.push(`request ${q.id} needs research ${node.id} before any blueprints exist`);
        }
        w.progress.requestsDone.push(q.id);
        doneRequests.push(q.id);
        needed.push(...q.deliver);
    }

    for (const [k, m] of T.milestones.entries()) {
        needed.push(...m.deliver);
        const c = closure(needed);
        // Machines the player needs for this milestone must be open by the time it is current.
        for (const type of Object.keys(c.machineSeconds)) {
            const def = machineDef.get(type);
            if (!S.unlockedMachine(w, CAT, def.unlockStage, type)) problems.push(`${m.id} needs ${type}, which is not open yet`);
        }
        // Research its recipes need, paid from blueprints earned by milestones before this one.
        let spent = 0;
        for (const rid of c.recipes) {
            const node = researchFor(rid);
            if (!node) continue;
            for (const id of researchChain(node.id)) {
                if (researchBought.has(id)) continue;
                researchBought.add(id);
                spent += T.research.find((n) => n.id === id).cost;
            }
        }
        const researchCostSoFar = [...researchBought].reduce((a, id) => a + T.research.find((n) => n.id === id).cost, 0);
        if (researchCostSoFar > blueprints) problems.push(`${m.id} needs ${researchCostSoFar} blueprints of research but only ${blueprints} are earned before it`);

        // Idealised time: the slowest of every ore (drill rate) and machine type (machine-seconds over machines of that type).
        const limits = [];
        for (const n of T.nodes) {
            const need = c.ore[n.item] ?? 0;
            if (need > 0) limits.push({ what: `${n.item} drills`, sec: need / ((n.baseRatePerMin / 60) * PURITY_NORMAL * drills) });
        }
        for (const [type, secs] of Object.entries(c.machineSeconds)) limits.push({ what: `${type}s`, sec: secs / (machines * (machineDef.get(type).speed ?? 1)) });
        limits.sort((a, b) => b.sec - a.sec);
        rows.push({ milestone: m.id, name: m.name, minutes: limits[0].sec / 60, bottleneck: limits[0].what, researchBlueprints: researchCostSoFar });

        blueprints += m.blueprints;
        w.progress.milestonesDone.push(m.id);
    }
    return { problems, rows, drills, machines };
}

if (process.argv[1] && process.argv[1].endsWith("pacing-model.mjs")) {
    const json = process.argv.includes("--json");
    const out = [{ drills: 1, machines: 1 }, { drills: 1, machines: 2 }, { drills: 2, machines: 4 }].map(analyse);
    if (json) console.log(JSON.stringify(out, null, 2));
    else {
        for (const r of out) {
            console.log(`\n${r.drills} drill per ore, ${r.machines} of each machine (ideal lower bound, minutes of play from an empty island)`);
            for (const row of r.rows) console.log(`  ${row.name.padEnd(24)} ${row.minutes.toFixed(1).padStart(6)} min   slowest: ${row.bottleneck}   research so far: ${row.researchBlueprints} blueprints`);
            console.log(r.problems.length ? `  PROBLEMS:\n    ${r.problems.join("\n    ")}` : "  no soft-locks found");
        }
    }
}
