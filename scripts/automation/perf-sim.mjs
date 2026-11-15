// Simulation cost bench for Brasswork. Builds a dense late-game factory on the 18 x 12 plateau, then times
// step(), a serialize/deserialize round trip, hudData(), and the 8 hour offline catch-up the host runs on load.
//   node --experimental-strip-types --no-warnings scripts/automation/perf-sim.mjs [--json]
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const S = await import(resolve(root, "lib/automation/sim/index.ts"));
const P = await import(resolve(root, "lib/automation/sim/progress.ts"));
const CAT = S.DEFAULT_CATALOG;
const json = process.argv.includes("--json");

export function denseFactory() {
    const w = S.createWorld({ width: 18, depth: 12, hub: { x: 8, z: 5 } }, CAT);
    CAT.tree.nodes.forEach((n, i) => { const s = S.START_NODE_SPOTS[i]; if (s) S.addDeposit(w, s[0], s[1], n.item, 1); });
    const hub = w.buildings[w.hubId];
    for (const it of CAT.tree.items) hub.input[it.id] = 1e6;
    w.progress.blueprints = 1e6;
    for (let pass = 0; pass < 8; pass++) for (const n of CAT.tree.research) P.buyResearch(w, CAT, n.id);
    for (const r of CAT.tree.requests ?? []) w.progress.requestsDone.push(r.id);
    const hubCell = { x: 9, z: 6 };
    const route = (from, belt = "belt-steel") => {
        const r = S.autoRoute(w, from, hubCell, belt, CAT);
        if (r.ok) for (const c of r.cells) S.place(w, belt, c.x, c.z, c.rot, CAT);
        return r.ok;
    };
    // A drill on every node, each with its own belt to the hub.
    for (const key of Object.keys(w.deposits)) {
        const [x, z] = key.split(",").map(Number);
        const res = S.place(w, "drill", x, z, 0, CAT);
        if (res.ok) route({ x, z });
    }
    // Crafters wherever they fit, each fed by the hub side and sent back to it.
    const plan = ["kiln", "kiln", "furnace", "press", "press", "lathe", "lathe", "drawer", "assembler", "assembler", "fabricator", "windmill", "windmill", "windmill", "windmill"];
    for (const type of plan) {
        const fp = CAT.tree.machines.find((m) => m.id === type)?.footprint ?? { w: 2, d: 2 };
        const spot = S.suggestSpot(w, fp, CAT);
        if (!spot) continue;
        const res = S.place(w, type, spot.x, spot.z, 0, CAT);
        if (!res.ok) continue;
        const rec = CAT.tree.recipes.find((r) => r.machine === type);
        if (rec) S.actions.setRecipe(w, res.id, rec.id, CAT);
        route({ x: spot.x, z: spot.z });
    }
    // Fill every remaining free cell with a belt that carries full lanes, as a long winding line does late in a run.
    for (let z = 0; z < 12; z++) for (let x = 0; x < 18; x++) if (!S.buildingAt(w, x, z, CAT)) S.place(w, "belt-steel", x, z, (x + z) % 4, CAT);
    for (const b of Object.values(w.buildings)) {
        const r = S.resolve(CAT, b.type);
        if (r?.kind === "belt") b.lane = [0.05, 0.3, 0.55, 0.8].map((pos) => ({ item: "iron_plate", pos }));
    }
    return w;
}

const time = (f, n = 1) => { const t = performance.now(); for (let i = 0; i < n; i++) f(); return (performance.now() - t) / n; };
const stats = (xs) => { const s = [...xs].sort((a, b) => a - b); return { med: s[s.length >> 1], p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1] }; };

if (process.argv[1] && process.argv[1].endsWith("perf-sim.mjs")) {
const w = denseFactory();
const kinds = {};
for (const b of Object.values(w.buildings)) { const k = S.resolve(CAT, b.type)?.kind; kinds[k] = (kinds[k] ?? 0) + 1; }
const out = { buildings: Object.keys(w.buildings).length, kinds };

for (let i = 0; i < 200; i++) S.advance(w, 0.1, 0.1, CAT); // warm the JIT, settle the lanes
// What one 100 ms step costs.
const samples = [];
for (let i = 0; i < 600; i++) { const t = performance.now(); S.advance(w, 0.1, 0.1, CAT); samples.push(performance.now() - t); }
out.stepMs = stats(samples);
const hudSamples = [];
for (let i = 0; i < 200; i++) { const t = performance.now(); S.hudData(w, CAT, null, { sound: true, reduceMotion: false, lowFx: false, numberFormat: "short", showRates: true }); hudSamples.push(performance.now() - t); }
out.hudDataMs = stats(hudSamples);
const text = S.serialize(w);
out.saveBytes = text.length;
out.serializeMs = stats(Array.from({ length: 50 }, () => time(() => S.serialize(w)))).med;
out.deserializeMs = stats(Array.from({ length: 50 }, () => time(() => S.deserialize(text)))).med;
// Offline catch-up: host (dt 1 for the whole gap) against catchUp() (0.1 for 5 min, then 1).
const away = 8 * 3600;
const a = S.deserialize(text);
out.catchUp8hHostMs = time(() => S.advance(a, away, 1, CAT));
const b2 = S.deserialize(text);
out.catchUp8hFineThenCoarseMs = time(() => S.catchUp(b2, away, CAT));
const c = S.deserialize(text);
out.catchUp1hHostMs = time(() => S.advance(c, 3600, 1, CAT));
console.log(json ? JSON.stringify(out) : JSON.stringify(out, null, 2));
}
