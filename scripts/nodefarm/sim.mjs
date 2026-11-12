// Pacing sim for Node Farm. Run: node --experimental-strip-types scripts/nodefarm/sim.mjs [hours]
// A greedy bot (no tapping in this game): buys the best-value affordable
// button every 3 s, reboots when it roughly doubles income. Prints when each milestone lands (play time, no offline).
import * as E from "../../lib/nodefarm/engine.ts";
const hours = Number(process.argv[2] || 24 * 14);
// NF_TUNE='{"perProducer":{"copper":0.02}}' deep-merges over TUNE so numbers can be tried without editing the engine.
const merge = (a, b) => { for (const [k, v] of Object.entries(b)) a[k] = v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" ? merge(a[k], v) : v; return a; };
if (process.env.NF_TUNE) merge(E.TUNE, JSON.parse(process.env.NF_TUNE));
const s = E.fresh(0);
if (!process.env.NF_NODRONES) s.armed = ["mult", ...E.MATS]; // the bot arms every stat once it has Drones
if (process.env.NF_NODRONES) s.autoArmed = ["mult", ...E.MATS]; // keep Standing orders from arming anything
const marks = {};
const ascents = [];
const mark = (k, t) => { if (!(k in marks)) marks[k] = t; };
const order = [...E.MATS].reverse().concat("mult");
const treeOrder = [...E.TREE].sort((a, b) => a.cost - b.cost);
const labOrder = [...E.LAB].sort((a, b) => a.cost - b.cost);
let labBought = 0, labCompiles = 0;
const labSkip = (process.env.NF_LABSKIP || "").split(","); // payload ids the bot never compiles
const FULL = new Set(E.fullTreeIds()); // the bot takes the first side of every fork
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
        // Drones: cheapest tier first, paid in Aether
        if (!process.env.NF_NODRONES && E.dronesOpen(s)) for (let k = 0; k < E.TIERS; k++) if (s.aether >= E.droneCost(s, k) * 3 && E.buyDrone(s, k)) mark("drone " + k, t);
        // Drone hangar (NF_NOHANGAR=1 skips it): post each Drone to the open zone with the lowest mastery (newest zone wins ties),
        // buy the cheapest mod, then the cheapest drone tree node
        if (!process.env.NF_NODRONES && !process.env.NF_NOHANGAR && s.drones.some((x) => x > 0)) {
            if (t % 120 < 3) {
                const open = E.POSTABLE.filter((st) => E.isUnlocked(s, st)).sort((a, b) => E.zoneRank(s, a) - E.zoneRank(s, b) || E.POSTABLE.indexOf(b) - E.POSTABLE.indexOf(a));
                for (let k = 0; k < E.TIERS; k++) E.setPost(s, k, s.drones[k] > 0 ? open[k % open.length] ?? null : null);
            }
            for (let more = true; more;) {
                more = false;
                let best = null;
                for (let k = 0; k < E.TIERS; k++) for (let m = 0; m < 3; m++) if (!E.modBlock(s, k, m)) { const c = E.modCost(s, k, m); if (!best || c < best[2]) best = [k, m, c]; }
                if (best && E.buyMod(s, best[0], best[1])) more = true;
            }
            for (const n of [...E.DRONE_TREE].sort((a, b) => a.cost - b.cost)) if (E.buyDroneNode(s, n.id)) mark("dnode " + n.id, t);
            const r = E.masteryRanks(s);
            for (const x of [1, 5, 15, 30, 45, 60, 75]) if (r >= x) mark(`mastery ${x}`, t);
        }
        E.checkGoals(s);
        if (s.reboot >= 1) mark("first reboot", t);
        if (s.life.reboots >= 25) mark("25 reboots", t);
        if (s.copper > 0) mark("copper", t);
        if (s.silicon > 0) mark("silicon", t);
        if (s.quartz > 0) mark("quartz", t);
        if (s.aether > 0) mark("aether", t);
        for (const m of E.MATS.slice(4)) if (s[m] > 0) mark(m, t);
        if (E.canAscend(s)) {
            mark("can ascend", t);
            const gain = E.apOnAscend(s);
            const last = ascents.length ? ascents[ascents.length - 1] : [0, 0];
            // NF_ASC_GAP=1: at most one Ascend per hour of play (a player does not Ascend ten times in twenty minutes), and one
            // at least every 3 hours once gains stop growing
            const gapOk = t - last[0] >= 3600 * Number(process.env.NF_ASC_GAP || 0);
            if (gapOk && ((s.life.ascends === 0 && gain >= 2) || gain >= last[1] * 1.4 || t - last[0] > 3600 * (process.env.NF_ASC_GAP && s.tree.length >= 40 ? 3 * Number(process.env.NF_ASC_GAP) : 60))) {
                E.ascend(s);
                ascents.push([t, gain, s.ap]);
                mark("ascend " + s.life.ascends, t);
            }
        }
        // cheapest first, including the next rank of a ranked node; never swaps a fork
        for (let more = true; more;) {
            more = false;
            const next = E.TREE.filter((n) => FULL.has(n.id) && !E.nodeMaxed(s, n) && E.nodeOpen(s, n)).sort((a, b) => E.nodeCost(s, a) - E.nodeCost(s, b))[0];
            if (next && E.buyNode(s, next.id)) { more = true; mark("node " + next.id + (E.nodeLevel(s, next.id) > 1 ? " r" + E.nodeLevel(s, next.id) : ""), t); }
        }
        const allRanks = E.TREE.every((n) => !FULL.has(n.id) || E.nodeMaxed(s, n));
        if (s.tree.filter((id) => !E.treeNode(id).form).length === 40) mark("first 40 done", t);
        // Exploit Lab (NF_NOLAB=1 skips it): research cheapest first, keep a little stock of every recipe, deploy as soon as it helps
        if (!process.env.NF_NOLAB && s.lab.seen) {
            mark("lab open", t);
            for (const n of labOrder) if (!s.lab.nodes.includes(n.id) && E.buyLabNode(s, n.id)) { labBought++; mark(`lab ${labBought}`, t); }
            if (s.lab.nodes.length === E.LAB.length) mark("lab done", t);
            for (const p of E.PAYLOADS) if (!labSkip.includes(p.id) && (s.lab.stock[p.id] ?? 0) < 2 && E.compile(s, p.id)) labCompiles++;
            for (const p of E.PAYLOADS) {
                if ((s.lab.stock[p.id] ?? 0) < 1) continue;
                if (p.kind === "buff" && !E.isRunning(s, p.id)) E.deploy(s, p.id);
                else if (p.kind === "charge" && !E.isArmed(s, p.id)) E.deploy(s, p.id);
                else if (p.id === "ransom" || p.id === "trojan") E.deploy(s, p.id);
                else if (p.id === "polymorph" && s.lab.run.length >= 2) E.deploy(s, p.id);
            }
        }
        // mounted drives: the bot keeps its deepest materials; the Dead drop is opened as soon as it is full
        const mats = ["chrono", "voidsteel", "starglass", "runes", "aether"].filter((m) => s.prod[m] > 0).slice(0, E.mountSlots(s));
        mats.forEach((m, i) => E.setMount(s, i, m));
        if (E.openDrop(s, t * 1000)) mark("first drop", t);
        // leftover AP goes into the Power core, then Cold cache
        if (allRanks || s.ap > 40) { while (E.buyPerk(s, "power")); }
        if (E.treeComplete(s)) mark("tree whole", t);
        if (allRanks) mark("tree done", t);
        if (allRanks && s.origin > 0 && !process.env.NF_NOSTOP) break;
    }
}
console.log("ascends", ascents.map(([a, g, ap]) => `${(a / 3600).toFixed(0)}h +${g} (ap ${ap})`).join(", "));
const h = (x) => (x / 3600).toFixed(2) + " h";
for (const [k, v] of Object.entries(marks)) if (k !== "lastReboot") console.log(k.padEnd(14), h(v));
console.log("lab", s.lab.nodes.length + "/" + E.LAB.length, "compiles", labCompiles, "intel life", E.fmt(s.life.intel));
console.log("end", h(t), "bytes/s", E.fmt(E.derive(s).bytesPerSec), "R", E.fmt(s.reboot), "cu", E.fmt(s.copper), "si", E.fmt(s.silicon), "qz", E.fmt(s.quartz), "ae", E.fmt(s.aether), "rn", E.fmt(s.runes), "sg", E.fmt(s.starglass), "vs", E.fmt(s.voidsteel), "ch", E.fmt(s.chrono), "eg", E.fmt(s.engrams), "px", E.fmt(s.paradox), "or", E.fmt(s.origin), "ap", s.ap, "ascends", s.life.ascends, "goals", s.ach.length);

if (process.env.DUMP) {
    const { writeFileSync } = await import("node:fs");
    s.at = Date.now() - 2 * 3600 * 1000; // pretend the player left 2 hours ago, to try the offline summary
    writeFileSync(process.env.DUMP, JSON.stringify(s));
}
