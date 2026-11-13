// Node Farm guidance: what to do next, why a zone is still locked, and what a button will do. Pure rules on top of the
// engine (no React), so every number comes from `TUNE` and the engine's own `button`/`derive` and follows any rebalance.
import { END_STAGES, END_STEPS, buildBlock, endDone, endOpen, endStage, lastZone, stageCost } from "../systems/ending";
import {
    chOff,
    GOALS, MATS, PERKS, TIERS, TREE, TUNE, REBOOT_UNLOCK,
    ARC_MATS, arcGateNeed, LAB, LAB_TUNE, PAYLOADS, STATS, apGlobal, apSpent, labHas, labNodeOpen, treeFx, intelRate, amount, apOnAscend, ascendNeed, unlockNeed, FW, fwNodeOpen, keysOnHandover, treeComplete, button, canAfford, canAscend, derive, droneBoost, droneCost, droneMax, droneRate, dronesOpen, postOf, postX, zoneRank, ROMAN, originAp, paradoxOc, bloomKeys, sunstoneAll, singularityAll, fmt, fmtTime, goalDone, TREE_FULL, handOpen, HAND_TUNE, cores, DRONE_TREE, droneNodeOpen, modBlock, MOD_COUNT, hasNode, isUnlocked, nodeOpen, statDef,
    type ButtonStat, type Derived, type MatId, type State, type StatId,
} from "../engine";
import { LORE } from "./lore";
import { SCRIPTS, auto, learnLeft, owns, scriptOpen } from "../systems/scripts";
import { RIGS, rigOpen, rigPrice } from "../zones/rigs";
import { zeTitle, zoneName } from "../zones/zoneevents";
import { chOpen, chRun, ranksTotal } from "../systems/stress";

/** What the glow points at: one button, a Drone to build, or a window. */
export interface Target {
    stat?: ButtonStat;
    tier?: number;
    drone?: number;
    win?: "ascend" | "goals" | "tree" | "lab" | "handover" | "stress";
    /** scroll to the Exploit Lab zone on the board */
    lab?: boolean;
    /** scroll to the Scripts zone on the board */
    sched?: boolean;
    /** open the Drone tree (Cores) */
    dtree?: boolean;
}

/** Something else that is ready right now, shown as one plain line under the main step. */
export interface Also {
    id: string;
    text: string;
    target?: Target;
}

export interface Step {
    id: string;
    /** small label above the title: TRAINING 2/4 in the opening, NEXT STEP afterwards */
    kicker: string;
    title: string;
    /** one plain line on why this matters */
    why: string;
    cur: number;
    need: number;
    frac: number;
    unit: string;
    /** seconds until `need`, when something is producing toward it */
    eta: number | null;
    /** the stat being earned toward `need`, so the panel can show the live rate */
    pay?: StatId;
    /** replaces the plain "cur / need unit" line when the numbers need words (Spend AP) */
    meter?: string;
    target?: Target;
    /** other things ready right now (a Rich vein, Ascend, a rig level), best first, at most three */
    also?: Also[];
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const fracOf = (cur: number, need: number) => (need <= 0 ? 1 : clamp01(cur / need));

/** Units per second the player is earning of a stat (Multipliers and Reboots only change when pressed). */
export function incomeOf(s: State, d: Derived, id: StatId): number {
    if (id === "bytes") return d.bytesPerSec;
    return (MATS as readonly string[]).includes(id) ? d.rates[id as MatId] : 0;
}
const etaTo = (s: State, d: Derived, id: StatId, need: number) => {
    const have = amount(s, id);
    const rate = incomeOf(s, d, id);
    return have >= need ? 0 : rate > 0 ? (need - have) / rate : null;
};

/** The full number for a hover title, for when the short form ("1.24M") is not enough. */
// one formatter each: toLocaleString builds an Intl object on every call, which showed up at the top of the board profile
const NF2 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const NF0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export const exact = (n: number) => (!Number.isFinite(n) ? "" : Math.abs(n) >= 1e15 ? n.toExponential(4) : (Math.abs(n) < 100 ? NF2 : NF0).format(n));

/** A wait that assumes today's income: past half an hour it is only a ceiling, because every node you build shortens it. */
export const etaRate = (eta: number | null) => (eta === null || eta <= 0 ? "" : eta > 1800 ? "30m+ at this rate" : `${fmtTime(eta)} at this rate`);

/** Short form for a wait: "about 4m 10s". Null when nothing is producing toward it. */
export const etaText = (eta: number | null) => (eta === null || eta <= 0 ? "" : eta > 99 * 3600 ? "a very long time" : fmtTime(eta));

/** The stat whose buttons feed `stat`'s price. Multipliers are fed by their own buttons (they raise Bytes). */
const feederOf = (stat: ButtonStat): ButtonStat => {
    const pays = stat === "reboot" ? "mult" : statDef(stat).pays;
    return !pays || pays === "bytes" ? "mult" : (pays as ButtonStat);
};
const bestTier = (s: State, stat: ButtonStat) => {
    for (let k = TIERS - 1; k >= 0; k--) if (canAfford(s, stat, k)) return k;
    return 0;
};
/** The button to light up when the player wants `stat`: its own cheapest tier if they can pay, else the feeder's best affordable tier. */
function aim(s: State, stat: ButtonStat): Target {
    if (canAfford(s, stat, 0)) return { stat, tier: bestTier(s, stat) };
    const f = feederOf(stat);
    return { stat: f, tier: bestTier(s, f) };
}

/** Why a zone is still locked: a plain line, and how far along the player is. */
export function unlockInfo(s: State, id: StatId): { label: string; cur: number; need: number; unit: string; frac: number } {
    if (id === "reboot") {
        const byBytes = fracOf(s.life.bytes, REBOOT_UNLOCK.bytes);
        const byMult = fracOf(s.mult, REBOOT_UNLOCK.mult);
        return byMult > byBytes
            ? { label: `Hold ${fmt(REBOOT_UNLOCK.mult)} Multipliers`, cur: s.mult, need: REBOOT_UNLOCK.mult, unit: "MUL", frac: byMult }
            : { label: `Earn ${fmt(REBOOT_UNLOCK.bytes)} Bytes in total`, cur: s.life.bytes, need: REBOOT_UNLOCK.bytes, unit: "B", frac: byBytes };
    }
    if (id === "copper") {
        const need = button(s, "reboot", 0).cost;
        return { label: "Run your first Reboot", cur: s.mult, need, unit: "MUL", frac: isUnlocked(s, "reboot") ? fracOf(s.mult, need) : 0 };
    }
    // the Overgrowth and Descent zones stay shut until enough Handovers (ARC_GATE)
    if (ARC_MATS.includes(id as MatId) && (s.hand?.count ?? 0) < arcGateNeed(id)) { const need = arcGateNeed(id); return { label: need <= 1 ? "Hand the node over once" : `Hand the node over ${need} times`, cur: s.hand?.count ?? 0, need, unit: "HANDOVER", frac: fracOf(s.hand?.count ?? 0, need) }; }
    const i = MATS.indexOf(id as MatId);
    const below = MATS[i - 1] as MatId | undefined;
    if (!below) return { label: "", cur: 0, need: 1, unit: "", frac: 0 };
    // after your first Ascend a zone opens at a quarter of the usual amount (same rule as isUnlocked)
    const quarter = s.life.ascends > 0 && s.life.reboots >= TUNE.unlockAt.copper;
    const need = unlockNeed(s, id) / (quarter ? 4 : 1);
    return { label: `Hold ${fmt(need)} ${statDef(below).name}`, cur: amount(s, below), need, unit: statDef(below).short, frac: fracOf(amount(s, below), need) };
}

/** Whether the player has something to spend Ascension Points on right now. */
function canSpendAp(s: State): boolean {
    if (s.ap <= 0 || chOff(s, "prestige")) return false; // locked during a stress test
    if (PERKS.some((p) => s.perks[p.id] < p.max && s.ap >= p.cost(s.perks[p.id]))) return true;
    return TREE.some((n) => !hasNode(s, n.id) && nodeOpen(s, n) && s.ap >= n.cost);
}

/** What the player can buy with their AP right now: how many picks, the cheapest, and whether any is on the tree. */
export function apPicks(s: State): { count: number; cheapest: number; tree: boolean } {
    const costs: number[] = [];
    let tree = false;
    for (const p of PERKS) if (s.perks[p.id] < p.max && s.ap >= p.cost(s.perks[p.id])) costs.push(p.cost(s.perks[p.id]));
    for (const n of TREE) if (!hasNode(s, n.id) && nodeOpen(s, n) && s.ap >= n.cost) { costs.push(n.cost); tree = true; }
    return { count: costs.length, cheapest: costs.length ? Math.min(...costs) : 0, tree };
}

/** The single most useful thing to do now. Always returns something: the chain, then the nearest goal. */
export function nextStep(s: State, d: Derived): Step {
    const st = coreStep(s, d);
    // a Handover wipes the run, AP and perks, so Ascend and spending are no use beside it
    const wipes = st.id === "handover";
    const also = readyNow(s, d).filter((a) => a.id !== st.id && !sameTarget(a.target, st.target) && !(wipes && (a.id === "ascend" || a.id === "spend-ap" || a.id.startsWith("rig-")))).slice(0, 3);
    if (also.length) st.also = also;
    return st;
}

const sameTarget = (a?: Target, b?: Target) => !!a && !!b && a.win === b.win && a.stat === b.stat && a.drone === b.drone && !!a.lab === !!b.lab && !!a.sched === !!b.sched && !!a.dtree === !!b.dtree;

/** An event that needs an answer and has not been answered (a Rich vein, a Fault). Event.sh takes it off the list when it is running. */
const openEvents = (s: State) => (owns(s, "event") && auto(s).on.event ? [] : (s.ze?.act ?? []).filter((e) => (e.kind === "vein" || e.kind === "fault") && !e.picked && e.left > 0));

/** Everything else the player could usefully do right now, best first. Each one is listed only while it can be done this second. */
export function readyNow(s: State, d: Derived): Also[] {
    const out: Also[] = [];
    for (const e of openEvents(s)) out.push({ id: "event", text: `${zeTitle(e.kind, e.zone)} in ${zoneName(e.zone)}, ${Math.ceil(e.left)} s left`, target: { stat: e.zone as ButtonStat } });
    if (s.life.ascends > 0 && canAscend(s)) out.push({ id: "ascend", text: `Ascend for +${fmt(apOnAscend(s))} AP`, target: { win: "ascend" } });
    if (canSpendAp(s)) out.push({ id: "spend-ap", text: `Spend ${fmt(s.ap)} Ascension Points`, target: { win: "tree" } });
    // a learned script that is switched off does nothing
    for (const x of SCRIPTS) {
        if (!owns(s, x.id) || !scriptOpen(s, x.id) || x.id === "restore" || x.id === "ascend") continue;
        const on = x.id === "reboot" ? s.watchdog : auto(s).on[x.id];
        if (!on) { out.push({ id: `sw-${x.id}`, text: `Switch on ${x.file}, you have learned it`, target: { sched: true } }); break; }
    }
    // the closest script to learning, and what teaches it
    const near = SCRIPTS.filter((x) => !owns(s, x.id) && scriptOpen(s, x.id) && x.id !== "restore" && learnLeft(s, x.id) > 0).sort((a, b) => learnLeft(s, a.id) - learnLeft(s, b.id))[0];
    if (near && learnLeft(s, near.id) <= 5) out.push({ id: `teach-${near.id}`, text: `${near.file}: ${near.teach(learnLeft(s, near.id))}`, target: { sched: true } });
    // a rig level you can pay now
    if (!(owns(s, "rig") && auto(s).on.rig)) {
        for (const r of RIGS) {
            if (!rigOpen(s, r.zone)) continue;
            if (r.keys.some((x) => { const p = rigPrice(s, x.key, d); return !p.maxed && amount(s, p.pays) >= p.cost; })) { out.push({ id: `rig-${r.zone}`, text: `Upgrade the ${r.name} rig in ${zoneName(r.zone)}`, target: { stat: r.zone as ButtonStat } }); break; }
        }
    }
    // hangar: Parts for a mod, Cores for a Drone tree node
    if (s.dr && s.drones.some((n) => n > 0)) {
        let mod = false;
        for (let k = 0; k < TIERS && !mod; k++) for (let m = 0; m < MOD_COUNT; m++) if (!modBlock(s, k, m)) { mod = true; break; }
        if (mod) out.push({ id: "mod", text: "Refit a Drone with your Parts", target: { drone: Math.max(0, s.drones.findIndex((n) => n > 0)) } });
        if (DRONE_TREE.some((n) => !s.dr.nodes.includes(n.id) && droneNodeOpen(s, n) && cores(s) >= n.cost)) out.push({ id: "dtree", text: `Spend ${fmt(cores(s))} Cores in the Drone tree`, target: { dtree: true } });
    }
    // the lab: research you can afford, once the first one is done
    if (s.lab.seen && s.lab.nodes.length > 0) {
        const ready = LAB.filter((n) => !labHas(s, n.id) && labNodeOpen(s, n) && s.lab.intel >= n.cost).length;
        if (ready) out.push({ id: "lab-more", text: `${ready} research ready in the lab`, target: { win: "lab" } });
    }
    // stress tests: once, as an invitation
    if (chOpen(s) && !chRun(s) && ranksTotal(s) === 0 && s.life.ascends >= 2) out.push({ id: "stress", text: "Try a stress test for a permanent reward", target: { win: "stress" } });
    // things that change the run come first; a switch or a lesson is background
    const rank = (a: Also) => (a.id === "event" ? 0 : a.id.startsWith("sw-") ? 8 : a.id.startsWith("teach-") ? 7 : a.id === "stress" ? 6 : 1);
    return out.map((a, i) => [a, i] as const).sort((x, y) => rank(x[0]) - rank(y[0]) || x[1] - y[1]).map((x) => x[0]);
}

function coreStep(s: State, d: Derived): Step {
    const training = s.life.ascends === 0;
    const mk = (o: Omit<Step, "kicker" | "eta" | "frac"> & { kicker?: string; eta?: number | null; frac?: number }): Step => ({
        kicker: o.kicker ?? "NEXT STEP",
        eta: o.eta !== undefined ? o.eta : o.pay ? etaTo(s, d, o.pay, o.need) : null,
        frac: o.frac ?? fracOf(o.cur, o.need),
        id: o.id, title: o.title, why: o.why, cur: o.cur, need: o.need, unit: o.unit, target: o.target, pay: o.pay, meter: o.meter,
    });

    // ---- the opening, one thing at a time
    if (s.life.presses === 0 && s.mult <= 1) {
        const b = button(s, "mult", 0);
        return mk({ id: "first-mult", kicker: "TRAINING 1/4", title: "Buy your first Multiplier", why: "Each Multiplier adds Bytes every second. Press the glowing button.", cur: s.bytes, need: b.cost, unit: "B", pay: "bytes", target: { stat: "mult", tier: bestTier(s, "mult") } });
    }
    if (!isUnlocked(s, "reboot")) {
        const u = unlockInfo(s, "reboot");
        return mk({ id: "grow", kicker: "TRAINING 2/4", title: "Stack Multipliers", why: `Keep buying. ${u.label} to decrypt Reboots.`, cur: u.cur, need: u.need, frac: u.frac, unit: u.unit, pay: u.unit === "B" ? "bytes" : undefined, target: { stat: "mult", tier: bestTier(s, "mult") } });
    }
    if (s.life.reboots === 0) {
        const b = button(s, "reboot", 0);
        return mk({ id: "first-reboot", kicker: "TRAINING 3/4", title: "Run your first Reboot", why: "A Reboot wipes Bytes and Multipliers, then every Multiplier button hits harder for good. Reboot when it lights up.", cur: s.mult, need: b.cost, unit: "MUL", target: aim(s, "reboot") });
    }

    // ---- a zone event is open: it runs out, so it comes first
    const ev = openEvents(s)[0];
    if (ev) {
        return mk({ id: "event", kicker: "ZONE EVENT", title: `${zeTitle(ev.kind, ev.zone)} in ${zoneName(ev.zone)}`, why: ev.kind === "vein" ? "Mine it for a burst of that zone's material, or let it run. The card is on screen." : "Patch it before it eats output, or wait it out. The card is on screen.", cur: ev.total - ev.left, need: ev.total, frac: fracOf(ev.total - ev.left, ev.total), unit: "s", eta: ev.left, target: { stat: ev.zone as ButtonStat } });
    }

    // ---- the ending: a final-build stage you can pay for right now comes before Firmware, which spends the same Keys
    if (!buildBlock(s)) {
        const st = endStage(s);
        return mk({ id: "final-build", kicker: "FINAL BUILD", title: `Build stage ${st + 1}: ${END_STAGES[st]}`, why: `Node zero's final build, stage ${st + 1} of ${END_STEPS}. Built stages are kept through Ascend and Handover.`, cur: 1, need: 1, unit: "KEY", target: { win: "handover" } });
    }
    // ---- Handover (the reset past Ascend): flash Firmware with Keys you hold, and hand over once the tree is whole
    if (s.hand.keys > 0 && FW.some((n) => !s.hand.fw.includes(n.id) && fwNodeOpen(s, n) && s.hand.keys >= n.cost)) {
        return mk({ id: "flash-fw", kicker: "HANDOVER", title: `Flash Firmware with ${fmt(s.hand.keys)} Keys`, why: "Firmware is kept through every Handover and changes how every run starts and what survives.", cur: 1, need: 1, unit: "KEY", target: { win: "handover" } });
    }
    const hk = keysOnHandover(s);
    if (hk > 0 && (treeComplete(s) || s.hand.count > 0)) {
        return mk({ id: "handover", kicker: "NODE ZERO", title: `Hand over for +${fmt(hk)} Keys`, why: "Pass the node to the next operator. It wipes AP, perks and the tree too, and Keys buy Firmware that changes every later run.", cur: s.prod.origin, need: 1, unit: "OR", target: { win: "handover" } });
    }

    // ---- spend Ascension Points before anything else once you have them
    // the bar shows AP invested out of all AP held, so it fills as you spend (it used to read a fixed "1 / 1" while the title said 14)
    if (canSpendAp(s)) {
        const spent = apSpent(s);
        const picks = apPicks(s);
        return mk({ id: "spend-ap", title: `Spend ${fmt(s.ap)} Ascension Points`, why: `${picks.count} pick${picks.count === 1 ? "" : "s"} you can afford right now, cheapest ${fmt(picks.cheapest)} AP. Tree nodes and perks are permanent and survive every Ascend.`, cur: spent, need: spent + s.ap, unit: "AP", meter: `${fmt(spent)} / ${fmt(spent + s.ap)} AP invested`, target: { win: picks.tree ? "tree" : "ascend" } });
    }

    // ---- the Exploit Lab, once, when it opens: research a recipe, then compile and deploy it
    if (s.lab.seen && s.lab.nodes.length === 0) {
        const need = Math.min(...LAB.filter((n) => n.links.includes("core")).map((n) => n.cost));
        if (s.lab.intel >= need * 0.5) return mk({ id: "lab-research", kicker: "EXPLOIT LAB", title: "Research your first payload", why: "Intel runs alongside Bytes. Open the research tree and pick Packet sniffer or Rootkit.", cur: s.lab.intel, need, unit: "IN", eta: s.lab.intel >= need ? null : (need - s.lab.intel) / Math.max(1e-9, intelRate(s, d.bytesPerSec)), target: { win: "lab" } });
    }
    if (s.lab.nodes.length > 0 && s.life.compiled === 0 && s.lab.queue.length === 0 && PAYLOADS.some((p) => s.lab.nodes.includes(`rx_${p.id}`))) {
        // the Intel part of the cheapest recipe you own, so the bar means something (it used to sit at 0 / 1)
        const owned = PAYLOADS.filter((p) => s.lab.nodes.includes(`rx_${p.id}`));
        const need = Math.min(...owned.map((p) => p.intel));
        return mk({ id: "lab-compile", kicker: "EXPLOIT LAB", title: "Compile your first payload", why: "Press Compile in the Lab. When it lands in stock, press Deploy for the buff.", cur: s.lab.intel, need, unit: "IN", eta: s.lab.intel >= need ? null : (need - s.lab.intel) / Math.max(1e-9, intelRate(s, d.bytesPerSec)), target: { lab: true } });
    }

    // ---- the chain, one zone at a time: Copper, Silicon, Quartz, Aether, then (after an Ascend) the deep materials
    for (let i = 0; i < MATS.length; i++) {
        const m = MATS[i];
        const def = statDef(m);
        if (i === 4) {
            // Aether is online: Drones are cheap, then Ascend is the next big step
            const drones = s.drones.reduce((a, b) => a + b, 0);
            if (dronesOpen(s) && drones === 0 && s.aether >= droneCost(s, 0)) {
                return mk({ id: "first-drone", title: "Build a Drone", why: "Drones press buttons for you, even while you are away. Open the Drone hangar and build a Probe.", cur: s.aether, need: droneCost(s, 0), unit: "AE", pay: "aether", target: { drone: 0 } });
            }
            // once, after the first Drone: post it somewhere so the hangar's mastery and Cores start
            if (drones > 0 && s.dr.post.every((p) => !p) && zoneRank(s, "mult") === 0 && !s.dr.nodes.length && !Object.keys(s.dr.svc).length) {
                const k = s.drones.findIndex((x) => x > 0);
                return mk({ id: "post-drone", kicker: "DRONE HANGAR", title: "Post a Drone to a zone", why: "Pick a zone in a Drone's Posting menu. It presses only there, faster, and earns that zone permanent mastery and a Core per rank.", cur: 0, need: 1, unit: "", eta: null, target: { drone: k } });
            }
            if (training) {
                if (canAscend(s)) {
                    const gain = apOnAscend(s);
                    return mk({ id: "ascend", title: `Ascend for +${fmt(gain)} AP`, why: "Ascending wipes this run but keeps goals, perks, the tree and lab research, and every AP boosts everything for good.", cur: s.aether, need: ascendNeed(s), unit: "AE", target: { win: "ascend" } });
                }
                return mk({ id: "reach-ascend", title: "Reach Ascend", why: `Hold ${fmt(ascendNeed(s))} Aether to Ascend: a reset that gives permanent power.`, cur: s.aether, need: ascendNeed(s), unit: "AE", pay: "aether", target: aim(s, "aether") });
            }
        }
        if (!isUnlocked(s, m) && ARC_MATS.includes(m) && (s.hand?.count ?? 0) < arcGateNeed(m)) {
            // the Overgrowth and Descent arcs open at the first Handover, which wants the whole tree and an Origin node
            if (!(s.hand?.count > 0) && !treeComplete(s)) return mk({ id: "finish-tree", kicker: "NODE ZERO", title: "Finish the prestige tree", why: "Hand the node over once the whole tree is yours. The first Handover opens zones 18 and 19, and each one after opens two more, up to 25.", cur: s.tree.length, need: TREE_FULL, unit: "NODES", target: { win: "tree" } });
            if (!handOpen(s)) return mk({ id: "open-handover", kicker: "NODE ZERO", title: "Build an Origin node", why: "The Handover opens once an Origin node is running. Then hand the node over.", cur: s.prod.origin, need: HAND_TUNE.needProd, unit: "OR", pay: "origin", target: aim(s, "origin" as ButtonStat) });
        }
        if (!isUnlocked(s, m)) {
            const u = unlockInfo(s, m);
            // a zone far off is a wait; if Ascend is ready, that is the better thing to do meanwhile
            const wait = etaTo(s, d, MATS[i - 1] as StatId, u.need);
            if (!training && canAscend(s) && (wait === null || wait > 7200)) return mk({ id: "ascend", title: `Ascend for +${fmt(apOnAscend(s))} AP`, why: `${def.name} is ${wait === null ? "not close" : "hours away at this rate"}. A fresh run is faster and every AP boosts everything.`, cur: s.aether, need: ascendNeed(s), unit: "AE", target: { win: "ascend" } });
            const below = MATS[i - 1];
            return mk({ id: `decrypt-${m}`, title: `Decrypt ${def.name}`, why: `${u.label}. Build more ${statDef(below).name} nodes to get there faster.`, cur: u.cur, need: u.need, frac: u.frac, unit: u.unit, pay: below, target: aim(s, below as ButtonStat) });
        }
        if (s.prod[m] === 0) {
            const b = button(s, m, 0);
            const pays = statDef(b.pays);
            return mk({ id: `first-${m}`, kicker: training && i === 0 ? "TRAINING 4/4" : "NEXT STEP", title: `Build your first ${def.name} node`, why: `${def.role} Nodes mine on their own.`, cur: amount(s, b.pays), need: b.cost, unit: pays.short, pay: b.pays, target: aim(s, m) });
        }
    }

    // ---- chain is running: Ascend if it pays, otherwise the nearest goal
    if (canAscend(s)) {
        return mk({ id: "ascend", title: `Ascend for +${fmt(apOnAscend(s))} AP`, why: "A fresh run with more permanent power. Spend the AP on perks and the tree.", cur: s.aether, need: ascendNeed(s), unit: "AE", target: { win: "ascend" } });
    }
    // the final build is open but the next stage is not paid for yet: save toward it before chasing goals
    if (endOpen(s) && !endDone(s)) {
        const z = lastZone();
        const c = stageCost(endStage(s));
        const have = amount(s, z);
        const keyShort = s.hand.keys < c.keys;
        return mk({ id: "final-save", kicker: "FINAL BUILD", title: `Save for stage ${endStage(s) + 1}: ${END_STAGES[endStage(s)]}`, why: buildBlock(s) ?? "Ready.", cur: keyShort ? s.hand.keys : have, need: keyShort ? c.keys : c.mat, unit: keyShort ? "KEY" : statDef(z).short, pay: keyShort ? undefined : z, target: keyShort ? { win: "handover" } : aim(s, z as ButtonStat) });
    }
    let best: { g: (typeof GOALS)[number]; f: number } | null = null;
    for (const g of GOALS) {
        if (goalDone(s, g)) continue;
        const first = g.target < 1;
        const cur = g.cur(s);
        const f = first ? (cur > 0 ? 1 : 0) : g.target >= 1000 ? Math.log10(1 + Math.max(0, cur)) / Math.log10(1 + g.target) : fracOf(cur, g.target);
        if (!best || f > best.f) best = { g, f };
    }
    if (best) {
        const g = best.g;
        const first = g.target < 1;
        const cur = g.cur(s);
        return mk({ id: `goal-${g.id}`, title: `Goal: ${g.name}`, why: g.hint, cur: first ? Math.min(1, cur) : cur, need: first ? 1 : g.target, frac: best.f, unit: "", meter: first ? (cur > 0 ? "done" : "not yet") : `${fmt(Math.min(cur, g.target))} / ${fmt(g.target)} · ${Math.round(best.f * 100)}%`, target: { win: "goals" } });
    }
    return mk({ id: "done", title: "Every goal done", why: "The farm is yours. Chase more AP or the whole tree.", cur: 1, need: 1, unit: "", target: { win: "ascend" } });
}

// ---- live readouts under the next step: one cell per system, each one a jump to where it lives. Locked systems stay
// visible as a dim teaser that says what opens them, so the road ahead is always on screen.

export type NxIcon = "target" | "map" | "ascend" | "ap" | "key" | "goal" | "lab" | "drone" | "clock" | "tree" | "intel" | "play" | "lock";
export interface Cell {
    id: "zone" | "ascend" | "ap" | "goals" | "lab" | "drones";
    icon: NxIcon;
    label: string;
    value: string;
    sub: string;
    frac: number;
    color: string;
    state: "live" | "ready" | "locked";
    target?: Target;
}

export function telemetry(s: State, d: Derived): Cell[] {
    const out: Cell[] = [];
    // next zone to decrypt
    const next = STATS.find((x) => !isUnlocked(s, x.id));
    if (next) {
        const u = unlockInfo(s, next.id);
        const i = STATS.findIndex((x) => x.id === next.id);
        const below = STATS[i - 1]?.id as StatId | undefined;
        const pay: StatId | undefined = next.id === "reboot" ? (u.unit === "B" ? "bytes" : undefined) : next.id === "copper" ? undefined : below;
        const eta = pay ? etaRate(etaTo(s, d, pay, u.need)) : "";
        out.push({ id: "zone", icon: "key", label: "Next zone", value: next.name, sub: `${fmt(u.cur)} / ${fmt(u.need)} ${u.unit}${eta ? ` · ${eta}` : ""}`, frac: u.frac, color: next.color, state: "live", target: below && below !== "bytes" ? aim(s, below as ButtonStat) : aim(s, "mult") });
    } else out.push({ id: "zone", icon: "key", label: "Zones", value: "All online", sub: `${STATS.length} zones decrypted`, frac: 1, color: "#2fd8e8", state: "live" });

    // Ascend
    const ae = statDef("aether");
    if (!isUnlocked(s, "aether") && s.life.ascends === 0) out.push({ id: "ascend", icon: "ascend", label: "Ascend", value: "Locked", sub: "Decrypt Aether first", frac: 0, color: "#ff2d8a", state: "locked" });
    else if (canAscend(s)) out.push({ id: "ascend", icon: "ascend", label: "Ascend", value: `+${fmt(apOnAscend(s))} AP`, sub: `ready · ascend #${s.life.ascends + 1}`, frac: 1, color: "#ff2d8a", state: "ready", target: { win: "ascend" } });
    else {
        const eta = etaRate(etaTo(s, d, "aether", TUNE.ascendAether));
        out.push({ id: "ascend", icon: "ascend", label: "Ascend", value: `${fmt(s.aether)} / ${fmt(TUNE.ascendAether)} ${ae.short}`, sub: eta ? eta : `build ${ae.name} nodes`, frac: fracOf(s.aether, TUNE.ascendAether), color: "#ff2d8a", state: "live", target: s.prod.aether > 0 ? aim(s, "aether") : { win: "ascend" } });
    }

    // Ascension Points
    if (s.life.ascends === 0 && s.ap <= 0 && s.tree.length === 0) out.push({ id: "ap", icon: "ap", label: "AP", value: "Locked", sub: "Earned by Ascending", frac: 0, color: "#a98bff", state: "locked" });
    else {
        const picks = apPicks(s);
        const spent = apSpent(s);
        out.push({ id: "ap", icon: "ap", label: "AP", value: `${fmt(s.ap)} AP banked`, sub: picks.count ? `${picks.count} pick${picks.count === 1 ? "" : "s"} open · all ×${fmt(apGlobal(s))}` : `all ×${fmt(apGlobal(s))} · ${fmt(spent)} invested`, frac: fracOf(spent, spent + s.ap), color: "#a98bff", state: picks.count ? "ready" : "live", target: { win: picks.count && !picks.tree ? "ascend" : "tree" } });
    }

    // Goals
    const done = GOALS.filter((g) => goalDone(s, g)).length;
    out.push({ id: "goals", icon: "goal", label: "Goals", value: `${done} / ${GOALS.length}`, sub: done === GOALS.length ? "every goal done" : `${GOALS.length - done} to go`, frac: fracOf(done, GOALS.length), color: "#ffc53a", state: "live", target: { win: "goals" } });

    // Exploit Lab
    if (!s.lab.seen) out.push({ id: "lab", icon: "lab", label: "Exploit Lab", value: "Locked", sub: `Opens with ${statDef(LAB_TUNE.opensAt).name}`, frac: 0, color: "#9fd0ff", state: "locked" });
    else {
        const open = LAB.filter((n) => !labHas(s, n.id) && labNodeOpen(s, n));
        const ready = open.filter((n) => s.lab.intel >= n.cost).length;
        const cheap = open.length ? Math.min(...open.map((n) => n.cost)) : 0;
        const stock = Object.values(s.lab.stock).reduce((a, b) => a + (b ?? 0), 0);
        const rate = intelRate(s, d.bytesPerSec);
        const sub = ready ? `${ready} research ready` : open.length ? `next ${fmt(cheap)} IN${rate > 0 ? ` · ${etaText((cheap - s.lab.intel) / rate)}` : ""}` : "tree complete";
        out.push({ id: "lab", icon: "lab", label: "Exploit Lab", value: `${fmt(s.lab.intel)} Intel`, sub: `${sub}${stock ? ` · ${stock} in stock` : s.lab.queue.length ? ` · ${s.lab.queue.length} compiling` : ""}`, frac: open.length ? fracOf(s.lab.intel, cheap) : 1, color: "#9fd0ff", state: ready ? "ready" : "live", target: { win: "lab" } });
    }

    // Drones
    if (!dronesOpen(s)) out.push({ id: "drones", icon: "drone", label: "Drones", value: "Locked", sub: "Opens with Aether", frac: 0, color: "#6bffc9", state: "locked" });
    else {
        const lv = s.drones.reduce((a, b) => a + b, 0);
        let k = -1;
        for (let t = 0; t < s.drones.length; t++) if (s.drones[t] < droneMax(s) && (k < 0 || droneCost(s, t) < droneCost(s, k))) k = t;
        const cost = k >= 0 ? droneCost(s, k) : 0;
        out.push({ id: "drones", icon: "drone", label: "Drones", value: `${lv} level${lv === 1 ? "" : "s"}`, sub: k < 0 ? "fleet maxed" : `T${k + 1} ${DRONE_NAMES[k]} ${fmt(cost)} AE`, frac: k < 0 ? 1 : fracOf(s.aether, cost), color: "#6bffc9", state: k >= 0 && s.aether >= cost ? "ready" : "live", target: { drone: Math.max(0, k) } });
    }
    return out;
}

/** One line on what a stat gives the chain right now, with live multipliers. Used by the chain strip and the progress map. */
export function feedLine(id: StatId, s: State, d: Derived): string {
    const b = d.boosts;
    switch (id) {
        case "bytes": return `+${fmt(d.bytesPerSec)} Bytes/s`;
        case "mult": return `Adds ${fmt(s.mult)} to Bytes/s before boosts`;
        case "reboot": return `Multiplier buttons ×${fmt(d.multGainMult)}`;
        case "copper": return `Reboot power ×${fmt(b.cuReboot)}, Bytes ×${fmt(b.cuBytes)}`;
        case "silicon": return `Copper ×${fmt(b.siCu)}`;
        case "quartz": return `Silicon ×${fmt(b.qzSi)}`;
        case "aether": return `Quartz ×${fmt(b.aeQz)}, opens Ascend`;
        case "runes": return `Aether ×${fmt(b.ruAe)}`;
        case "starglass": return `Runes ×${fmt(b.sgRu)}`;
        case "voidsteel": return `Starglass ×${fmt(b.vsSg)}`;
        case "chrono": return `Voidsteel ×${fmt(b.chVs)}, everything ×${fmt(b.chAll)}`;
        case "nebula": return `Chrono ×${fmt(b.nbCh)}`;
        case "pulsars": return `Nebula ×${fmt(b.puNb)}`;
        case "singularity": return `Pulsars ×${fmt(b.snPu)}, everything ×${fmt(singularityAll(s))}`;
        case "engrams": return `Singularity ×${fmt(b.egSn)}, Drones ×${fmt(droneBoost(s))}`;
        case "paradox": return `Engrams ×${fmt(b.pxEg)}, Overclock ×${fmt(paradoxOc(s))}`;
        case "origin": return `Paradox ×${fmt(b.orPx)}, AP on Ascend ×${fmt(originAp(s))}`;
        case "spores": return `Origin ×${fmt(b.spOr)}`;
        case "mycelium": return `Spores ×${fmt(b.mySp)}`;
        case "pollen": return `Mycelium ×${fmt(b.poMy)}`;
        case "bloom": return `Pollen ×${fmt(b.blPo)}, Keys on Handover ×${fmt(bloomKeys(s))}`;
        case "basalt": return `Bloom ×${fmt(b.baBl)}`;
        case "magma": return `Basalt ×${fmt(b.mgBa)}`;
        case "geodes": return `Magma ×${fmt(b.geMg)}`;
        case "sunstone": return `Geodes ×${fmt(b.suGe)}, everything ×${fmt(sunstoneAll(s))}`;
    }
}

// ---- button tooltips

export interface TipInfo {
    color: string;
    kicker: string;
    title: string;
    /** a short line under the title */
    note?: string;
    rows: [string, string][];
    status: string;
    tone: "ok" | "wait";
}

/** What one press of a stat's button does, what it costs, and what the next tier and the next copy of it look like. */
export function buttonTip(s: State, stat: ButtonStat, tier: number): TipInfo {
    const d = derive(s);
    const def = statDef(stat);
    const b = button(s, stat, tier);
    const pays = statDef(b.pays);
    const have = amount(s, b.pays);
    const afford = have >= b.cost;
    const rows: [string, string][] = [];
    if (stat === "reboot") {
        const after = derive({ ...s, reboot: s.reboot + b.gain });
        rows.push(["Per press", `+${fmt(b.gain)} Reboot${b.gain > 1 ? "s" : ""}`]);
        rows.push(["Effect", `Buttons ×${fmt(d.multGainMult)} → ×${fmt(after.multGainMult)}`]);
        rows.push(["Wipes", "Bytes and Multipliers"]);
    } else {
        rows.push(["Per press", `+${fmt(b.gain)} ${def.name}`]);
        if (stat === "mult") {
            rows.push(["Per second", `+${fmt(derive({ ...s, mult: s.mult + b.gain }).bytesPerSec - d.bytesPerSec)} Bytes/s`]);
        } else {
            const m = stat as MatId;
            const after = derive({ ...s, prod: { ...s.prod, [m]: s.prod[m] + b.gain } });
            rows.push(["Per second", `+${fmt(after.rates[m] - d.rates[m])} ${def.name}/s`]);
        }
    }
    rows.push(["Cost", `${fmt(b.cost)} ${pays.name}`]);
    if (b.cost >= 1000 && b.cost < 1e15) rows.push(["Exact", exact(b.cost)]);
    rows.push(["You have", `${fmt(have)} ${pays.short}`]);
    const growth = stat === "reboot" ? Math.pow(TUNE.rebootGrowth, b.gain) : TUNE.cost[stat].growth;
    rows.push(["Then costs", `${fmt(b.cost * growth)} ${pays.short}`]);
    if (tier < TIERS - 1) {
        const nb = button(s, stat, tier + 1);
        rows.push(["Next tier", `+${fmt(nb.gain)} for ${fmt(nb.cost)} ${pays.short}`]);
    }
    if (stat !== "reboot") rows.push(["Owned", `×${s.bought[stat][tier]}`]);
    const eta = etaTo(s, d, b.pays, b.cost);
    return {
        color: def.color,
        kicker: `${def.name} · tier ${tier + 1}`,
        title: LORE[stat].tiers[tier],
        note: stat === "reboot" ? undefined : "Hold the button to keep buying.",
        rows,
        status: afford ? (stat === "reboot" ? "Ready. Press to Reboot." : "Ready. Press to buy.") : `Short by ${fmt(b.cost - have)} ${pays.short}${etaText(eta) ? `, about ${etaText(eta)}` : ""}.`,
        tone: afford ? "ok" : "wait",
    };
}

export const DRONE_NAMES = ["Probe", "Courier", "Sweeper", "Warden", "Cascade", "Sovereign"];
export function droneTip(s: State, tier: number): TipInfo {
    const lvl = s.drones[tier];
    const maxed = lvl >= droneMax(s);
    const cost = droneCost(s, tier);
    const afford = !maxed && s.aether >= cost;
    const post = postOf(s, tier);
    const per = (r: number) => (post ? r * postX(s, tier) : r);
    const rows: [string, string][] = [
        ["Presses", post ? `tier ${tier + 1} on ${statDef(post).name} only, x${fmt(postX(s, tier))}` : "nothing while docked: pick a zone in its Posting menu"],
        ["Now", `${post ? fmt(per(droneRate(s, tier))) : "0"} presses/s`],
    ];
    if (post) rows.push(["Mastery", `${statDef(post).name} ${ROMAN[zoneRank(s, post)] || "unranked"}`]);
    if (!maxed) {
        s.drones[tier] += 1;
        const next = droneRate(s, tier);
        s.drones[tier] -= 1;
        rows.push(["After", `${fmt(per(next))} presses/s`]);
        rows.push(["Cost", `${fmt(cost)} Aether`]);
        rows.push(["You have", `${fmt(s.aether)} AE`]);
    }
    rows.push(["Level", `${lvl} of ${droneMax(s)}`]);
    const eta = etaTo(s, derive(s), "aether", cost);
    return {
        color: statDef("aether").color,
        kicker: "DRONE HANGAR",
        title: `T${tier + 1} ${DRONE_NAMES[tier]}`,
        note: post ? "Posted: it works one zone, faster, and builds that zone's mastery." : "Docked: it does nothing. Post it to a zone in the hangar to put it to work.",
        rows,
        status: maxed ? "Maxed." : afford ? `Ready. ${lvl ? "Upgrade" : "Build"} it.` : `Short by ${fmt(cost - s.aether)} AE${etaText(eta) ? `, about ${etaText(eta)}` : ""}.`,
        tone: afford || maxed ? "ok" : "wait",
    };
}
