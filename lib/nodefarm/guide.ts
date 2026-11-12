// Node Farm guidance: what to do next, why a zone is still locked, and what a button will do. Pure rules on top of the
// engine (no React), so every number comes from `TUNE` and the engine's own `button`/`derive` and follows any rebalance.
import {
    chOff,
    GOALS, MATS, PERKS, TIERS, TREE, TUNE, REBOOT_UNLOCK,
    ARC_MATS, LAB, PAYLOADS, intelRate, amount, apOnAscend, ascendNeed, unlockNeed, FW, fwNodeOpen, keysOnHandover, treeComplete, button, canAfford, canAscend, derive, droneBoost, droneCost, droneMax, droneRate, dronesOpen, postOf, postX, zoneRank, ROMAN, originAp, paradoxOc, bloomKeys, sunstoneAll, singularityAll, fmt, fmtTime, goalDone, hasNode, isUnlocked, nodeOpen, statDef,
    type ButtonStat, type Derived, type MatId, type State, type StatId,
} from "./engine";
import { LORE } from "./lore";

/** What the glow points at: one button, a Drone to build, or a window. */
export interface Target {
    stat?: ButtonStat;
    tier?: number;
    drone?: number;
    win?: "ascend" | "goals" | "tree" | "lab" | "handover";
    /** scroll to the Exploit Lab zone on the board */
    lab?: boolean;
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
    target?: Target;
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
export const exact = (n: number) => (!Number.isFinite(n) ? "" : Math.abs(n) >= 1e15 ? n.toExponential(4) : n.toLocaleString("en-US", { maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0 }));

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
    // the Overgrowth and Descent arcs stay shut until the first Handover
    if (ARC_MATS.includes(id as MatId) && !(s.hand?.count > 0)) return { label: "Hand the node over once", cur: 0, need: 1, unit: "HANDOVER", frac: 0 };
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

/** The single most useful thing to do now. Always returns something: the chain, then the nearest goal. */
export function nextStep(s: State, d: Derived): Step {
    const training = s.life.ascends === 0;
    const mk = (o: Omit<Step, "kicker" | "eta" | "frac"> & { kicker?: string; eta?: number | null; frac?: number; pay?: StatId }): Step => ({
        kicker: o.kicker ?? "NEXT STEP",
        eta: o.eta !== undefined ? o.eta : o.pay ? etaTo(s, d, o.pay, o.need) : null,
        frac: o.frac ?? fracOf(o.cur, o.need),
        id: o.id, title: o.title, why: o.why, cur: o.cur, need: o.need, unit: o.unit, target: o.target,
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

    // ---- spend Ascension Points before anything else once you have them
    if (canSpendAp(s)) {
        return mk({ id: "spend-ap", title: `Spend ${fmt(s.ap)} Ascension Points`, why: "Perks and tree nodes are permanent and survive every Ascend. Open the tree to pick one.", cur: 1, need: 1, unit: "AP", target: { win: TREE.some((n) => !hasNode(s, n.id) && nodeOpen(s, n) && s.ap >= n.cost) ? "tree" : "ascend" } });
    }

    // ---- Handover (the reset past Ascend): flash Firmware with Keys you hold, and hand over once the tree is whole
    if (s.hand.keys > 0 && FW.some((n) => !s.hand.fw.includes(n.id) && fwNodeOpen(s, n) && s.hand.keys >= n.cost)) {
        return mk({ id: "flash-fw", kicker: "HANDOVER", title: `Flash Firmware with ${fmt(s.hand.keys)} Keys`, why: "Firmware is kept through every Handover and changes how every run starts and what survives.", cur: 1, need: 1, unit: "KEY", target: { win: "handover" } });
    }
    const hk = keysOnHandover(s);
    if (hk > 0 && (treeComplete(s) || s.hand.count > 0)) {
        return mk({ id: "handover", kicker: "NODE ZERO", title: `Hand over for +${fmt(hk)} Keys`, why: "Pass the node to the next operator. It wipes AP, perks and the tree too, and Keys buy Firmware that changes every later run.", cur: s.prod.origin, need: 1, unit: "OR", target: { win: "handover" } });
    }

    // ---- the Exploit Lab, once, when it opens: research a recipe, then compile and deploy it
    if (s.lab.seen && s.lab.nodes.length === 0) {
        const need = Math.min(...LAB.filter((n) => n.links.includes("core")).map((n) => n.cost));
        if (s.lab.intel >= need * 0.5) return mk({ id: "lab-research", kicker: "EXPLOIT LAB", title: "Research your first payload", why: "Intel runs alongside Bytes. Open the research tree and pick Packet sniffer or Rootkit.", cur: s.lab.intel, need, unit: "IN", eta: s.lab.intel >= need ? null : (need - s.lab.intel) / Math.max(1e-9, intelRate(s, d.bytesPerSec)), target: { win: "lab" } });
    }
    if (s.lab.nodes.length > 0 && s.life.compiled === 0 && s.lab.queue.length === 0 && PAYLOADS.some((p) => s.lab.nodes.includes(`rx_${p.id}`))) {
        return mk({ id: "lab-compile", kicker: "EXPLOIT LAB", title: "Compile your first payload", why: "Press Compile in the Lab. When it lands in stock, press Deploy for the buff.", cur: 0, need: 1, unit: "", eta: null, target: { lab: true } });
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
        if (!isUnlocked(s, m)) {
            const u = unlockInfo(s, m);
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
        return mk({ id: `goal-${g.id}`, title: `Goal: ${g.name}`, why: g.hint, cur: first ? Math.min(1, g.cur(s)) : g.cur(s), need: first ? 1 : g.target, frac: best.f, unit: "", target: { win: "goals" } });
    }
    return mk({ id: "done", title: "Every goal done", why: "The farm is yours. Chase more AP or the whole tree.", cur: 1, need: 1, unit: "", target: { win: "ascend" } });
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
        ["Presses", post ? `tier ${tier + 1} on ${statDef(post).name} only, x${fmt(postX(s, tier))}` : `tier ${tier + 1} buttons on every armed stat`],
        ["Now", `${fmt(per(droneRate(s, tier)))} presses/s`],
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
        note: post ? "Posted: it works one zone, faster, and builds that zone's mastery." : "Sweeping: it presses every stat you arm in its zone. Post it to one zone to build mastery.",
        rows,
        status: maxed ? "Maxed." : afford ? `Ready. ${lvl ? "Upgrade" : "Build"} it.` : `Short by ${fmt(cost - s.aether)} AE${etaText(eta) ? `, about ${etaText(eta)}` : ""}.`,
        tone: afford || maxed ? "ok" : "wait",
    };
}
