// Reset audit for Node Farm. Builds a rich save, runs every reset the game has on it (Reboot, Ascend, Handover, a stress test
// start and leave, the three respecs, a wipe, and a save round trip), and prints what each one keeps and wipes, field by field.
// It also checks the claims the confirm screens make (the expected column below), and exits 1 if any check fails.
//   node --experimental-strip-types scripts/nodefarm/reset-audit.mjs            (table + checks)
//   node --experimental-strip-types scripts/nodefarm/reset-audit.mjs --json     (the raw verdicts)
// Rules are in lib/nodefarm/engine.ts (ascend, handover, respec, fresh) and lib/nodefarm/stress.ts (startTest, leaveTest).
import { loadEngine, richSave, NOW } from "./reset-fixture.mjs";
const { E, R, ST } = await loadEngine();
const rich = () => richSave(E, R);

const asJson = process.argv.includes("--json");

// ---- helpers
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
function leaves(v, path = "", out = new Map()) {
    if (isObj(v)) { const ks = Object.keys(v); if (!ks.length) out.set(path, "{}"); for (const k of ks) leaves(v[k], path ? `${path}.${k}` : k, out); }
    else if (Array.isArray(v)) { if (!v.length) out.set(path, "[]"); v.forEach((x, i) => leaves(x, `${path}[${i}]`, out)); }
    else out.set(path, v === undefined ? "<undef>" : JSON.stringify(v));
    return out;
}
const top = (s) => Object.keys({ ...s });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** KEPT: every leaf unchanged. WIPED: value equals the fresh save's (or is gone). PART: some leaves changed, some kept. CHANGED: all leaves moved. */
function verdicts(before, after, label) {
    const fresh = E.fresh(NOW);
    const out = {};
    for (const k of new Set([...top(before), ...top(after)])) {
        const b = before[k], a = after[k];
        const lb = leaves(b, k), la = leaves(a, k);
        const paths = new Set([...lb.keys(), ...la.keys()]);
        let kept = 0, changed = 0;
        const ex = [];
        for (const p of paths) {
            if (lb.get(p) === la.get(p)) kept++;
            else { changed++; if (ex.length < 3) ex.push(`${p}: ${lb.get(p) ?? "-"} -> ${la.get(p) ?? "-"}`); }
        }
        let v;
        if (changed === 0) v = "KEPT";
        else if (a === undefined || same(a, fresh[k]) || (isObj(a) && Object.values(a).every((x) => x === 0 || x === "[]" || x === null))) v = "WIPED";
        else if (kept === 0) v = "CHANGED";
        else v = "PART";
        out[k] = { v, kept, changed, ex };
    }
    return { label, rows: out };
}
const show = (label, res) => {
    if (asJson) return;
    console.log(`\n## ${label}`);
    for (const [k, r] of Object.entries(res.rows)) if (r.v !== "KEPT") console.log(`  ${r.v.padEnd(8)} ${k}${r.v === "PART" || r.v === "CHANGED" ? `  (${r.changed} of ${r.changed + r.kept} changed)` : ""}${r.ex.length ? "\n           " + r.ex.join("\n           ") : ""}`);
    const kept = Object.entries(res.rows).filter(([, r]) => r.v === "KEPT").map(([k]) => k);
    console.log(`  KEPT     ${kept.join(", ")}`);
};

const results = { tables: {}, checks: [] };
let fails = 0;
const check = (name, ok, detail = "") => { results.checks.push({ name, ok, detail }); if (!ok) fails++; if (!asJson) console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail && !ok ? `  [${detail}]` : ""}`); };
const note = (name, ok, detail = "") => { if (!asJson) console.log(`${ok ? "OBS " : "FINDING"} ${name}${detail ? `  [${detail}]` : ""}`); };
const pick = (s, paths) => Object.fromEntries(paths.map((p) => [p, p.split(".").reduce((o, k) => (o == null ? undefined : o[k]), s)]));

// ---- 1. Reboot (the first press that resets Bytes and Multipliers)
{
    const s = rich();
    s.rig.cache = 0; // a rig's cache is paid into Bytes on Reboot, so take it out of this check
    s.bytes = 1e12; s.mult = 1e12; s.life.bytes = 1e12;
    let pressed = -1;
    for (let t = E.TIERS - 1; t >= 0 && pressed < 0; t--) if (E.press(s, "reboot", t)) pressed = t;
    const before = rich();
    before.bytes = 1e12; before.mult = 1e12; before.life.bytes = 1e12;
    const res = verdicts(before, s, "Reboot");
    results.tables.reboot = res.rows;
    show(`Reboot (tier ${pressed})`, res);
    check("Reboot pressed (a tier was affordable)", pressed >= 0);
    check("Reboot resets Bytes to the start kit and takes Multipliers down", s.bytes === E.derive(s).bytesPerSec * (10 * s.perks.start + E.treeFx(s).start) && s.mult < before.mult);
    check("Reboot resets Multiplier tiers", s.bought.mult.every((x) => x === 0));
    check("Reboot keeps material tiers and producers", same(s.bought.copper, before.bought.copper) && same(s.prod, before.prod));
    check("Reboot keeps the Drones and the stress tests", same(s.drones, before.drones) && same(s.ch, before.ch));
}

// ---- 2. Ascend
{
    const s = rich();
    s.aether = E.ascendNeed(s) * 2;
    const before = rich(); before.aether = E.ascendNeed(before) * 2;
    const gain = E.ascend(s);
    const res = verdicts(before, s, "Ascend");
    results.tables.ascend = res.rows;
    show(`Ascend (+${gain} AP)`, res);
    check("Ascend pays AP", gain > 0);
    check("Ascend keeps AP, perks, tree, achievements, logs, lab research", s.ap === before.ap + gain && same(s.perks, before.perks) && same(s.tree, before.tree) && same(s.ach, before.ach) && same(s.logs, before.logs) && same(s.lab.nodes, before.lab.nodes));
    check("Ascend keeps Keys and Firmware", s.hand.keys === before.hand.keys && same(s.hand.fw, before.hand.fw));
    check("Ascend keeps the hangar nodes and postings", same(s.dr.nodes, before.dr.nodes) && same(s.dr.post, before.dr.post));
    check("Ascend keeps the stress test ranks", same(s.ch.done, before.ch.done));
    check("Ascend keeps Mounted drive material", same(s.mounts, before.mounts));
    check("Ascend keeps the lifetime Ascend count (+1)", s.life.ascends === before.life.ascends + 1);
    check("Ascend wipes Bytes, Multipliers, Reboots and Multiplier tiers", s.bytes === 0 && s.mult === 1 && s.reboot !== before.reboot && s.bought.mult.every((x) => x === 0));
    // Intel and running payloads: wiped until the first Handover, kept after it (HAND_BASE, #260)
    const afterFirst = before.hand.count > 0;
    check(afterFirst ? "Ascend keeps Intel and running payloads (a Handover has happened)" : "Ascend wipes Intel and running payloads (no Handover yet)", afterFirst ? s.lab.intel === before.lab.intel && s.lab.run.length === before.lab.run.length : s.lab.intel === 0 && s.lab.run.length === 0);
    check("Ascend keeps the lab's stock and armed charges", same(s.lab.stock, before.lab.stock) && same(s.lab.armed, before.lab.armed));
    check("Ascend keeps the Standing orders (armed stats)", same(s.armed, before.armed));
    check("Ascend keeps rig levels and wipes meters", same(s.rig.lv, before.rig.lv) && s.rig.cache === 0);
    check("Ascend keeps the zone event history and ends a running event", s.ze.seen === before.ze.seen && s.ze.act.length === 0);
    check("Ascend keeps the touch-layer caches", same(s.poke, before.poke));
}

// ---- 3. Handover
{
    const s = rich();
    s.prod.origin = E.HAND_TUNE.needProd;
    const before = rich(); before.prod.origin = E.HAND_TUNE.needProd;
    const keys = E.handover(s, "osk", "a note for the next operator", null);
    const res = verdicts(before, s, "Handover");
    results.tables.handover = res.rows;
    show(`Handover (+${keys} Keys)`, res);
    check("Handover pays Keys", keys > 0);
    check("Handover keeps goals, secrets, logs and lifetime stats", same(s.ach, before.ach) && same(s.achAt, before.achAt) && same(s.logs, before.logs) && s.life.ascends === before.life.ascends);
    check("Handover keeps lab research, learned scripts and the hangar nodes", same(s.lab.nodes, before.lab.nodes) && same(s.auto, before.auto) && same(s.dr.nodes, before.dr.nodes));
    check("Handover keeps the zone event history", s.ze?.seen === before.ze.seen && same(s.ze.log, before.ze.log));
    check("Handover keeps Keys and Firmware, and ranks up the protocol it ran", s.hand.keys === before.hand.keys + keys && same(s.hand.fw, before.hand.fw) && s.hand.rank.wren === before.hand.rank.wren + 1);
    check("Handover keeps the stress test ranks", same(s.ch.done, before.ch.done));
    check("Handover keeps the tree's entry and upper path, a quarter of its AP, and half the perks", s.tree.length > 0 && s.tree.length < before.tree.length && Math.abs(s.ap - Math.floor(E.treeSpent(before) * 0.25)) <= 1 && Object.entries(before.perks).every(([k, v]) => (s.perks[k] ?? 0) <= Math.ceil(v / 2)), `tree ${before.tree.length} -> ${s.tree.length}, ap ${before.ap} -> ${s.ap}`);
    check("Handover wipes Mounted drives, Drones and Lab Intel/stock", s.mounts.length === 0 && s.drones.every((x) => x === 0) && s.lab.intel === 0 && Object.keys(s.lab.stock).length === 0);
    check("Handover keeps half the rig levels (rounded up)", Object.keys(before.rig.lv).every((k) => (s.rig.lv[k] ?? 0) <= Math.ceil((before.rig.lv[k] ?? 0) / 2)));
    check("Handover keeps the note and count", s.hand.count === before.hand.count + 1 && s.hand.notes.at(-1)?.text === "a note for the next operator");
    note("Handover resets the hangar's Parts and mod levels unless Flight recorder or Black box keeps half (the ledger now lists this)", s.dr.parts === before.dr.parts, `parts ${before.dr.parts} -> ${s.dr.parts}`);
}

// ---- 4. Stress test: start and leave, nothing done inside
{
    const s = rich();
    const before = rich();
    const ok = ST.startTest(s, "thin", NOW);
    check("stress: a test starts after the first Ascend", ok);
    const inside = verdicts(before, s, "Stress start (inside the test)");
    results.tables.stress_start = inside.rows;
    show("Stress test start (state while the test runs)", inside);
    check("stress: while the test runs, the real run is stored", !!s.ch.run && s.ch.run.real && s.ch.run.id === "thin");
    check("stress: a non-cold test keeps the tree and clears Mounted drives", same(s.tree, before.tree) && s.mounts.length === 0);
    const left = ST.leaveTest(s);
    const res = verdicts(before, s, "Stress leave (nothing done in the test)");
    results.tables.stress_leave = res.rows;
    show(`Stress test leave (ranks cleared ${left})`, res);
    const norm = E.parseSave(JSON.stringify(before)); // the real run after a save round trip (fills defaults the same way a load does)
    check("stress: leaving restores the real run exactly", same(pick(s, ["bytes", "mult", "reboot", "ap", "tree", "treeLv", "perks", "mounts", "drones", "hand", "lab", "dr", "rig", "seen", "ze", "poke", "auto", "armed", "prod", "bought"]), pick(norm, ["bytes", "mult", "reboot", "ap", "tree", "treeLv", "perks", "mounts", "drones", "hand", "lab", "dr", "rig", "seen", "ze", "poke", "auto", "armed", "prod", "bought"])));
    check("stress: leaving clears the running test", s.ch.run === null);
}

// ---- 5. Stress test: progress made inside the test
{
    const s = rich();
    const before = rich();
    ST.startTest(s, "cold", NOW);
    s.prod.aether = 5; // the cold test's goal is Aether; it is unlocked once you make some, so rank I clears on the next tick
    E.tick(s, 1);
    // things a player can do inside a test
    s.copper += 1234; s.ap += 5; s.prod.silicon += 3; s.bytes += 77;
    s.ach.push("inside_goal"); s.achAt.inside_goal = NOW; s.logs.push("inside_log");
    (s.seen ??= {}).copper = 0b1111; // seen is not on the save while a test runs (startTest leaves it out)
    s.hand.keys += 7;
    s.lab.nodes.push(E.LAB[3].id);
    s.life.presses += 50;
    s.dr.parts += 99;
    const left = ST.leaveTest(s);
    results.tables.stress_inside = verdicts(before, s, "Stress inside").rows;
    const kept = (x) => s.ach.includes(x) || s.logs.includes(x);
    check("stress: goal, achievement and log earned in a test are kept", kept("inside_goal") && s.logs.includes("inside_log") && s.ach.includes("inside_goal"));
    check("stress: Keys, research, parts and AP earned in a test are not kept (the real run comes back)", s.hand.keys === before.hand.keys && !s.lab.nodes.includes(E.LAB[3].id) && s.dr.parts === before.dr.parts && s.ap === before.ap, `keys ${s.hand.keys}, ap ${s.ap}, parts ${s.dr.parts}`);
    check("stress: tiers pressed inside a test stay pressed (arc progress)", s.seen.copper === 0b1111, `seen.copper ${s.seen.copper}`);
    check("stress: a rank cleared inside the test is kept after leaving", ST.ranksDone(s, "cold") === 1, `done.cold ${ST.ranksDone(s, "cold")}, cleared on leave ${left}`);
}

// ---- 6. Respecs
{
    const s = rich(); const before = rich();
    const back = E.respec(s);
    results.tables.respec_tree = verdicts(before, s, "Tree respec").rows;
    check("tree respec refunds the AP the nodes cost", back > 0 && s.ap === before.ap + back);
    check("tree respec keeps Mounted drives", same(s.mounts, before.mounts));
}
{
    const s = rich(); const before = rich();
    const back = E.respecDrones(s);
    results.tables.respec_drones = verdicts(before, s, "Drone tree respec").rows;
    check("drone tree respec refunds Cores", back > 0 && s.dr.nodes.length === 0);
}
{
    const s = rich(); const before = rich();
    const back = E.respecFw(s);
    results.tables.respec_fw = verdicts(before, s, "Firmware respec").rows;
    check("Firmware respec refunds Keys", back > 0 && s.hand.keys === before.hand.keys + back && s.hand.fw.length === 0);
}
{
    // respecs are locked while a stress test runs (the window copy says Ascend, Handover, the tree, perks and Firmware are locked)
    const s = rich(); ST.startTest(s, "thin", NOW);
    const fwBack = E.respecFw(s);
    check("Firmware respec is refused during a stress test", fwBack === 0, `refunded ${fwBack} Keys inside the test`);
    const treeBack = E.respec(s);
    check("tree respec is refused during a stress test", treeBack === 0);
    const droneBack = E.respecDrones(s);
    check("drone tree respec is refused during a stress test", droneBack === 0, `refunded ${droneBack} Cores inside the test`);
    const perkOK = E.buyPerk(s, "scanner");
    check("perks are refused during a stress test", !perkOK);
}

// ---- 7. Wipe (Menu > Wipe save)
{
    const before = rich();
    const s = E.fresh(NOW);
    const res = verdicts(before, s, "Wipe save");
    results.tables.wipe = res.rows;
    check("wipe leaves a fresh save (no tree, goals, Keys, stress ranks or lab)", s.ach.length === 0 && s.hand.keys === 0 && s.tree.length === 0 && s.ch === undefined && s.lab.nodes.length === 0);
}

// ---- 8. Save round trip (export, then import or restore a backup)
{
    const s = E.parseSave(JSON.stringify(rich())); // a current save: the legacy migrations have already run
    const back = E.parseSave(E.exportSave(s));
    const res = verdicts(s, back, "Export then import");
    results.tables.roundtrip = res.rows;
    show("Export then import (round trip)", res);
    const lost = Object.entries(res.rows).filter(([k, r]) => r.v !== "KEPT" && k !== "at").map(([k, r]) => `${k}:${r.v}`);
    check("round trip keeps every field", lost.length === 0, lost.join(" "));
}

if (asJson) console.log(JSON.stringify(results, null, 2));
else console.log(`\n${results.checks.length - fails} of ${results.checks.length} checks pass${fails ? `, ${fails} FAIL` : ""}`);
process.exit(fails ? 1 : 0);
