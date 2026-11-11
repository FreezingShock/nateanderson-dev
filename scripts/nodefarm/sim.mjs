// Pacing sim for Node Farm. Run: node --experimental-strip-types scripts/nodefarm/sim.mjs [hours]
// A greedy bot (no tapping in this game): buys the best-value affordable
// button every 3 s, reboots when it roughly doubles income. Prints when each milestone lands (play time, no offline).
import * as E from "../../lib/nodefarm/engine.ts";
const hours = Number(process.argv[2] || 24 * 14);
const s = E.fresh(0);
const marks = {};
const ascents = [];
const mark = (k, t) => { if (!(k in marks)) marks[k] = t; };
const order = ["chrono", "voidsteel", "starglass", "runes", "aether", "quartz", "silicon", "copper", "mult"];
const treeOrder = [...E.TREE].sort((a, b) => a.cost - b.cost);
// Ascend policy: ascend as soon as AP gain is at least max(2, 40% of AP already held), a typical player keeps going for a while first.
let t = 0, nextBuy = 0;
const dt = 0.5;
while (t < hours * 3600) {
    E.tick(s, dt);
    t += dt;
    if (t >= nextBuy) {
        nextBuy = t + 3;
        // buy: for each stat, the most expensive affordable tier is a good greedy choice when cost < 25% of balance
        for (const st of order) {
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
        for (const m of ["runes", "starglass", "voidsteel", "chrono"]) if (s[m] > 0) mark(m, t);
        if (E.canAscend(s)) {
            mark("can ascend", t);
            const gain = E.apOnAscend(s);
            const last = ascents.length ? ascents[ascents.length - 1] : [0, 0];
            if ((s.life.ascends === 0 && gain >= 2) || gain >= last[1] * 1.4 || t - last[0] > 3600 * 60) {
                E.ascend(s);
                ascents.push([t, gain, s.ap]);
                mark("ascend " + s.life.ascends, t);
            }
        }
        for (const n of treeOrder) if (!s.tree.includes(n.id) && E.buyNode(s, n.id)) mark("node " + n.id, t);
        if (s.tree.length === E.TREE.length) mark("tree done", t);
        if (s.tree.length === E.TREE.length && s.chrono > 1e3) break;
    }
}
console.log("ascends", ascents.map(([a, g, ap]) => `${(a / 3600).toFixed(0)}h +${g} (ap ${ap})`).join(", "));
const h = (x) => (x / 3600).toFixed(2) + " h";
for (const [k, v] of Object.entries(marks)) if (k !== "lastReboot") console.log(k.padEnd(14), h(v));
console.log("end", h(t), "bytes/s", E.fmt(E.derive(s).bytesPerSec), "R", E.fmt(s.reboot), "cu", E.fmt(s.copper), "si", E.fmt(s.silicon), "qz", E.fmt(s.quartz), "ae", E.fmt(s.aether), "rn", E.fmt(s.runes), "sg", E.fmt(s.starglass), "vs", E.fmt(s.voidsteel), "ch", E.fmt(s.chrono), "ap", s.ap, "ascends", s.life.ascends, "goals", s.ach.length);

if (process.env.DUMP) {
    const { writeFileSync } = await import("node:fs");
    s.at = Date.now() - 2 * 3600 * 1000; // pretend the player left 2 hours ago, to try the offline summary
    writeFileSync(process.env.DUMP, JSON.stringify(s));
}
