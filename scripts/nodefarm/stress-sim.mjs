// Stress test pacing: load a save dumped by sim.mjs (DUMP=/path.json node ... sim.mjs 3.6), start every test on it and let the
// same greedy bot play until rank III or the cap. Prints when each rank clears, and checks the real run comes back intact.
// Run: node --experimental-strip-types scripts/nodefarm/stress-sim.mjs /path.json [capHours]
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const E = await import("../../lib/nodefarm/engine.ts");
await import("../../lib/nodefarm/rigs.ts");
const ST = await import("../../lib/nodefarm/stress.ts");
if (process.env.NF_CHTUNE) Object.assign(ST.CH_TUNE, JSON.parse(process.env.NF_CHTUNE));
const file = process.argv[2];
const cap = Number(process.argv[3] || 8) * 3600;
const only = (process.env.NF_TEST || "").split(",").filter(Boolean);
const h = (x) => (x / 3600).toFixed(2) + " h";
const order = [...E.MATS].reverse().concat("mult");

for (const def of ST.TESTS) {
    if (only.length && !only.includes(def.id)) continue;
    const s = E.parseSave(readFileSync(file, "utf8"));
    s.armed = ["mult", ...E.MATS];
    const before = JSON.stringify({ ...s, ch: undefined });
    if (!ST.startTest(s, def.id)) { console.log(def.id, "did not start"); continue; }
    const marks = [];
    let t = 0, nextBuy = 0, lastReboot = 0;
    while (t < cap && s.ch.run.got < 3 && !s.ch.run.out) {
        E.tick(s, 0.5);
        t += 0.5;
        if (s.ch.run.got > marks.length) marks.push(t);
        if (t < nextBuy) continue;
        nextBuy = t + 3;
        for (const st of order) {
            if (!E.isUnlocked(s, st)) continue;
            for (let k = E.TIERS - 1; k >= 0; k--) {
                const b = E.button(s, st, k);
                if (E.amount(s, b.pays) >= b.cost * 4 || (st === "mult" && E.amount(s, b.pays) >= b.cost && k === 0)) { E.press(s, st, k); break; }
            }
        }
        if (E.isUnlocked(s, "reboot")) for (let k = E.TIERS - 1; k >= 0; k--) {
            const b = E.button(s, "reboot", k);
            if (s.mult >= b.cost && (s.mult >= b.cost * 1.3 || t - lastReboot > 900)) { E.press(s, "reboot", k); lastReboot = t; break; }
        }
        if (E.dronesOpen(s)) for (let k = 0; k < E.TIERS; k++) if (s.aether >= E.droneCost(s, k) * 3) E.buyDrone(s, k);
        E.checkGoals(s);
        if (E.canAscend(s) || E.buyPerk(s, "power")) console.log("  !! prestige not locked");
    }
    const ranks = marks.map((m, i) => `${ST.RANKS[i]} ${h(m)}`).join(", ") || "none";
    const got = ST.leaveTest(s);
    const after = JSON.parse(JSON.stringify({ ...s, ch: undefined }));
    const b = JSON.parse(before);
    const same = ["bytes", "mult", "reboot", "copper", "aether", "ap"].every((k) => after[k] === b[k]) && JSON.stringify(after.tree) === JSON.stringify(b.tree) && JSON.stringify(after.prod) === JSON.stringify(b.prod);
    console.log(def.name.padEnd(12), ranks.padEnd(40), s.ch.run ? "STILL RUNNING" : "", same ? "restored ok" : "RESTORE MISMATCH", "got", got, "done", s.ch.done[def.id] ?? 0, s.ch.last?.id, s.ch.run === null ? "" : "?", ST.ranksTotal(s));
}
