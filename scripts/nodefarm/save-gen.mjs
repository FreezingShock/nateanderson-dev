// Plays a greedy bot with a given Node Farm engine and writes save files at set play times, so an old build's saves can be loaded
// into a newer one. Run against a checkout of the old release:
//   node --experimental-strip-types scripts/nodefarm/save-gen.mjs <path to old repo> <out dir> [label]
// Stages: early (20 min), mid (2 h), pre-ascend (first time Ascend is available), post-ascend (1 h after the first Ascend),
// deep (the end of a 48 h run, several Ascends, lab and drones in use).
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
const [repo, out, label = "old"] = process.argv.slice(2);
if (!repo || !out) { console.error("usage: save-gen.mjs <old repo> <out dir> [label]"); process.exit(1); }
const E = await import(resolve(repo, "lib/nodefarm/engine.ts"));
mkdirSync(out, { recursive: true });
const s = E.fresh(0);
const order = [...E.MATS].reverse().concat("mult");
const has = (f) => typeof E[f] === "function";
const stages = { early: 20 * 60, mid: 2 * 3600 };
const done = new Set();
const write = (name, t) => {
    if (done.has(name)) return;
    done.add(name);
    s.at = Date.now();
    writeFileSync(`${out}/${label}-${name}.json`, JSON.stringify(s));
    console.log(name.padEnd(12), `${(t / 3600).toFixed(2)} h`, "ascends", s.life.ascends, "tree", s.tree.length, "ap", s.ap, "lab", s.lab?.nodes?.length ?? "-", "drones", s.drones?.reduce((a, b) => a + b, 0) ?? "-");
};
let t = 0, nextBuy = 0, firstAscend = 0, lastAscend = 0;
const END = 48 * 3600;
while (t < END) {
    E.tick(s, 0.5);
    t += 0.5;
    if (t >= nextBuy) {
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
            if (s.mult >= b.cost && (s.mult >= b.cost * 1.3 || t % 900 < 3)) { E.press(s, "reboot", k); break; }
        }
        if (has("dronesOpen") && E.dronesOpen(s)) for (let k = 0; k < E.TIERS; k++) if (s.aether >= E.droneCost(s, k) * 3) E.buyDrone(s, k);
        s.armed = ["mult", ...E.MATS];
        E.checkGoals(s);
        if (s.lab?.seen) {
            for (const n of [...E.LAB].sort((a, b) => a.cost - b.cost)) if (!s.lab.nodes.includes(n.id)) E.buyLabNode(s, n.id);
            for (const p of E.PAYLOADS) if ((s.lab.stock[p.id] ?? 0) < 2) E.compile(s, p.id);
        }
        const mats = ["chrono", "voidsteel", "starglass", "runes", "aether"].filter((m) => s.prod[m] > 0).slice(0, E.mountSlots?.(s) ?? 0);
        mats.forEach((m, i) => E.setMount(s, i, m));
        if (E.canAscend(s)) {
            write("pre-ascend", t);
            const gain = E.apOnAscend(s);
            if ((s.life.ascends === 0 && gain >= 2) || t - lastAscend > 3 * 3600) {
                E.ascend(s);
                lastAscend = t;
                if (!firstAscend) firstAscend = t;
            }
        }
        for (let more = true; more;) {
            more = false;
            const next = E.TREE.filter((n) => !E.nodeMaxed(s, n) && E.nodeOpen(s, n)).sort((a, b) => E.nodeCost(s, a) - E.nodeCost(s, b))[0];
            if (next && E.buyNode(s, next.id)) more = true;
        }
        if (s.ap > 20) while (E.buyPerk(s, "power"));
    }
    for (const [name, at] of Object.entries(stages)) if (t >= at) write(name, t);
    if (firstAscend && t >= firstAscend + 3600) write("post-ascend", t);
}
write("deep", t);
