// Pacing sim for Node Farm. Run: node --experimental-strip-types scripts/nodefarm/sim.mjs [hours]
// A greedy bot (no tapping in this game): buys the best-value affordable
// button every 3 s, reboots when it roughly doubles income. Prints when each milestone lands (play time, no offline).
import * as E from "../../lib/nodefarm/engine.ts";
const hours = Number(process.argv[2] || 24 * 14);
const s = E.fresh(0);
const marks = {};
const mark = (k, t) => { if (!(k in marks)) marks[k] = t; };
const mats = ["mult", "copper", "silicon", "quartz", "aether"];
let t = 0, nextBuy = 0;
const dt = 0.5;
while (t < hours * 3600) {
    E.tick(s, dt);
    t += dt;
    if (t >= nextBuy) {
        nextBuy = t + 3;
        // buy: for each stat, the most expensive affordable tier is a good greedy choice when cost < 25% of balance
        for (const st of ["aether", "quartz", "silicon", "copper", "mult"]) {
            if (!E.isUnlocked(s, st)) continue;
            for (let k = E.TIERS - 1; k >= 0; k--) {
                const b = E.button(s, st, k);
                if (E.amount(s, b.pays) >= b.cost * 4 || (st === "mult" && E.amount(s, b.pays) >= b.cost && k === 0)) { E.press(s, st, k); break; }
            }
        }
        // reboot: pick highest affordable tier when mult is at least 3x what we'd drop to... simple: when affordable at tier chosen by multiple
        if (E.isUnlocked(s, "reboot")) {
            for (let k = E.TIERS - 1; k >= 0; k--) {
                const b = E.button(s, "reboot", k);
                if (s.mult >= b.cost * 1.0 && (s.mult >= b.cost * 1.3 || t - (marks.lastReboot || 0) > 900)) { E.press(s, "reboot", k); marks.lastReboot = t; break; }
            }
        }
        E.checkGoals(s);
        if (s.reboot >= 1) mark("first reboot", t);
        if (s.life.reboots >= 25) mark("25 reboots", t);
        if (s.copper > 0) mark("copper", t);
        if (s.silicon > 0) mark("silicon", t);
        if (s.quartz > 0) mark("quartz", t);
        if (s.aether > 0) mark("aether", t);
        if (E.canAscend(s)) { mark("can ascend", t); break; }
    }
}
const h = (x) => (x / 3600).toFixed(2) + " h";
for (const [k, v] of Object.entries(marks)) if (k !== "lastReboot") console.log(k.padEnd(14), h(v));
console.log("end", h(t), "bytes/s", E.fmt(E.derive(s).bytesPerSec), "R", E.fmt(s.reboot), "cu", E.fmt(s.copper), "si", E.fmt(s.silicon), "qz", E.fmt(s.quartz), "ae", E.fmt(s.aether), "goals", s.ach.length);

if (process.env.DUMP) {
    const { writeFileSync } = await import("node:fs");
    s.at = Date.now() - 2 * 3600 * 1000; // pretend the player left 2 hours ago, to try the offline summary
    writeFileSync(process.env.DUMP, JSON.stringify(s));
}
