// Loads saved games written by an older build (scripts/nodefarm/fixtures, made with save-gen.mjs) into the current engine and
// checks that nothing was lost, nothing is NaN or infinite, nothing that was unlocked is locked again, and the game still runs.
//   node --experimental-strip-types scripts/nodefarm/save-compat.mjs [old repo, to also compare unlocks against it]
import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const dir = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures");
// rigs.ts and scripts.ts import "./engine" without an extension and hook themselves into the tick; load them like the game does
const { registerHooks } = await import("node:module");
registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const E = await import("../../lib/nodefarm/engine.ts");
const RG = await import("../../lib/nodefarm/zones/rigs.ts");
const SC = await import("../../lib/nodefarm/systems/scripts.ts");
const O = process.argv[2] ? await import(resolve(process.argv[2], "lib/nodefarm/engine.ts")) : null;
let bad = 0;
const fail = (f, msg) => { bad++; console.log(`  FAIL ${f}: ${msg}`); };
const walk = (v, path, f) => {
    if (typeof v === "number" && !Number.isFinite(v)) fail(f, `non-finite number at ${path}`);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`, f);
};
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    const raw = readFileSync(resolve(dir, f), "utf8");
    const old = JSON.parse(raw);
    // both the plain JSON the game stores and the base64 code Export prints must load
    const a = E.parseSave(raw), b = E.parseSave(Buffer.from(raw).toString("base64"));
    if (!a || !b) { fail(f, "does not load"); continue; }
    walk(a, "save", f);
    for (const k of ["bytes", "mult", "reboot", "copper", "silicon", "quartz", "aether", "runes", "starglass", "voidsteel", "chrono"]) if (typeof old[k] === "number" && a[k] !== old[k]) fail(f, `${k} changed ${old[k]} -> ${a[k]}`);
    if (a.ap < old.ap) fail(f, `ap dropped ${old.ap} -> ${a.ap}`);
    for (const k of Object.keys(old.life ?? {})) if (typeof old.life[k] === "number" && a.life[k] !== old.life[k]) fail(f, `life.${k} changed ${old.life[k]} -> ${a.life[k]}`);
    // tree nodes that no longer exist are refunded in AP (checked above); everything else must still be there
    for (const k of ["ach", "logs", "tree", "mounts", "armed"]) for (const id of old[k] ?? []) if (!a[k].includes(id) && !(k === "tree" && !E.TREE.some((n) => n.id === id))) fail(f, `${k} lost ${id}`);
    for (const k of Object.keys(old.prod ?? {})) if (a.prod[k] !== old.prod[k]) fail(f, `prod.${k} changed`);
    // the Autoloader perk ("auto") was removed 2026-11-12 and refunded in AP
    for (const k of Object.keys(old.perks ?? {})) if (k !== "auto" && a.perks[k] !== old.perks[k]) fail(f, `perks.${k} changed ${old.perks[k]} -> ${a.perks[k]}`);
    for (const k of Object.keys(old.bought ?? {})) if (JSON.stringify(a.bought[k]) !== JSON.stringify(old.bought[k])) fail(f, `bought.${k} changed`);
    if (a.started !== old.started) fail(f, "started changed");
    if (old.lab) { for (const id of old.lab.nodes ?? []) if (!a.lab.nodes.includes(id)) fail(f, `lab lost ${id}`); if (a.lab.intel !== old.lab.intel) fail(f, "lab intel changed"); }
    if ((old.drones ?? []).some((x, i) => a.drones[i] !== x)) fail(f, "drones changed");
    if (O) for (const st of E.STATS) { const was = O.STATS.some((x) => x.id === st.id) && O.isUnlocked(old, st.id); if (was && !E.isUnlocked(a, st.id)) fail(f, `${st.id} was unlocked and is now locked`); }
    const d = E.derive(a);
    walk(d, "derive", f);
    const s = E.parseSave(raw);
    // systems added after the old build create their state on first use; an old save must come out with sane, finite state
    const au = SC.auto(s), rg = RG.rig(s);
    walk(au, "auto", f);
    walk(rg, "rig", f);
    if (au.own.length === 0 && old.life.presses > 400) console.log(`  note ${f}: no script learned yet by ${old.life.presses} presses (they are learned by doing)`);
    for (let i = 0; i < 120; i++) E.tick(s, 0.5);
    E.checkGoals(s);
    walk(s, "afterTick", f);
    const r = E.offline(s, 8 * 3600);
    walk(r, "offline", f);
    walk(s, "afterOffline", f);
    if (E.canAscend(s)) { E.ascend(s); walk(s, "afterAscend", f); }
    if (!E.parseSave(E.exportSave(s))) fail(f, "its own export does not load");
    const refund = a.treeRefund ? ` (refund ${a.treeRefund} AP)` : "";
    console.log(`${f.padEnd(28)} ok  bytes/s ${E.fmt(d.bytesPerSec)}  tree ${a.tree.length}  ap ${a.ap}${refund}`);
}
// a Handover note can hold any character: export must not throw, and the code must read back the same
{
    const s = E.fresh(0);
    s.hand.notes.push({ n: 1, text: "it\u2019s \u201Cfine\u201D \u2603 \u{1F9CA} caf\u00E9", at: 1, proto: null });
    let code = "";
    try { code = E.exportSave(s); } catch (e) { fail("unicode", `export throws: ${e.message}`); }
    const back = code && E.parseSave(code);
    if (code && (!back || back.hand.notes[0]?.text !== s.hand.notes[0].text)) fail("unicode", "note changed on the way through a code");
    // a code written by the old exporter (Latin-1 btoa) still loads, accents included
    const legacy = Buffer.from(JSON.stringify({ ...E.fresh(0), at: 1, started: 2, ach: ["caf\u00E9"] }), "latin1").toString("base64");
    const lg = E.parseSave(legacy);
    if (!lg || lg.ach[0] !== "caf\u00E9") fail("legacy-code", "an old Latin-1 code no longer loads");
    console.log("unicode and old-format codes".padEnd(28), bad ? "see above" : "ok");
}
console.log(bad ? `${bad} problem${bad === 1 ? "" : "s"}` : "all saves load clean");
process.exit(bad ? 1 : 0);
