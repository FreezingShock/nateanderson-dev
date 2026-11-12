// Node Farm guidance: what to do next, why a zone is still locked, and what a button will do. Pure rules on top of the
// engine (no React), so every number comes from `TUNE` and the engine's own `button`/`derive` and follows any rebalance.
import {
    GOALS, MATS, PERKS, TIERS, TREE, TUNE, REBOOT_UNLOCK,
    LAB, LAB_TUNE, PAYLOADS, STATS, intelRate, amount, apGlobal, apOnAscend, apSpent, labHas, labNodeOpen, treeFx, button, canAfford, canAscend, derive, droneCost, droneMax, droneRate, dronesOpen, fmt, fmtTime, goalDone, hasNode, isUnlocked, nodeOpen, statDef,
    type ButtonStat, type Derived, type MatId, type State, type StatId,
} from "./engine";
import { LORE } from "./lore";

/** What the glow points at: one button, a Drone to build, or a window. */
export interface Target {
    stat?: ButtonStat;
    tier?: number;
    drone?: number;
    win?: "ascend" | "goals" | "tree" | "lab";
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
    /** the stat being earned toward `need`, so the panel can show the live rate */
    pay?: StatId;
    /** replaces the plain "cur / need unit" line when the numbers need words (Spend AP) */
    meter?: string;
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
    const i = MATS.indexOf(id as MatId);
    const below = MATS[i - 1] as MatId | undefined;
    if (!below) return { label: "", cur: 0, need: 1, unit: "", frac: 0 };
    // after your first Ascend a zone opens at a quarter of the usual amount (same rule as isUnlocked)
    const quarter = s.life.ascends > 0 && s.life.reboots >= TUNE.unlockAt.copper;
    // same rule as isUnlocked: tree nodes can lower the threshold (unlockMul), so the numbers here match what actually opens it
    const need = (TUNE.unlockAt[id] * treeFx(s).unlockMul) / (quarter ? 4 : 1);
    return { label: `Hold ${fmt(need)} ${statDef(below).name}`, cur: amount(s, below), need, unit: statDef(below).short, frac: fracOf(amount(s, below), need) };
}

/** Whether the player has something to spend Ascension Points on right now. */
function canSpendAp(s: State): boolean {
    if (s.ap <= 0) return false;
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
        if (s.lab.intel >= need * 0.5) return mk({ id: "lab-research", kicker: "EXPLOIT LAB", title: "Research your first recipe", why: "Intel runs alongside Bytes. Open the research tree and pick Packet sniffer or Rootkit.", cur: s.lab.intel, need, unit: "IN", eta: s.lab.intel >= need ? null : (need - s.lab.intel) / Math.max(1e-9, intelRate(s, d.bytesPerSec)), target: { win: "lab" } });
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
                return mk({ id: "first-drone", title: "Build a Drone", why: "Drones press buttons for you, even while you are away. Open the Drone bay and build a Probe.", cur: s.aether, need: droneCost(s, 0), unit: "AE", pay: "aether", target: { drone: 0 } });
            }
            if (training) {
                if (canAscend(s)) {
                    const gain = apOnAscend(s);
                    return mk({ id: "ascend", title: `Ascend for +${fmt(gain)} AP`, why: "Ascending wipes this run but keeps goals, perks and the tree, and every AP boosts everything for good.", cur: s.aether, need: TUNE.ascendAether, unit: "AE", target: { win: "ascend" } });
                }
                return mk({ id: "reach-ascend", title: "Reach Ascend", why: `Hold ${fmt(TUNE.ascendAether)} Aether to Ascend: a reset that gives permanent power.`, cur: s.aether, need: TUNE.ascendAether, unit: "AE", pay: "aether", target: aim(s, "aether") });
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
        return mk({ id: "ascend", title: `Ascend for +${fmt(apOnAscend(s))} AP`, why: "A fresh run with more permanent power. Spend the AP on perks and the tree.", cur: s.aether, need: TUNE.ascendAether, unit: "AE", target: { win: "ascend" } });
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
        const eta = pay ? etaText(etaTo(s, d, pay, u.need)) : "";
        out.push({ id: "zone", icon: "key", label: "Next zone", value: next.name, sub: `${fmt(u.cur)} / ${fmt(u.need)} ${u.unit}${eta ? ` · ${eta}` : ""}`, frac: u.frac, color: next.color, state: "live", target: below && below !== "bytes" ? aim(s, below as ButtonStat) : aim(s, "mult") });
    } else out.push({ id: "zone", icon: "key", label: "Zones", value: "All online", sub: `${STATS.length} zones decrypted`, frac: 1, color: "#2fd8e8", state: "live" });

    // Ascend
    const ae = statDef("aether");
    if (!isUnlocked(s, "aether") && s.life.ascends === 0) out.push({ id: "ascend", icon: "ascend", label: "Ascend", value: "Locked", sub: "Decrypt Aether first", frac: 0, color: "#ff2d8a", state: "locked" });
    else if (canAscend(s)) out.push({ id: "ascend", icon: "ascend", label: "Ascend", value: `+${fmt(apOnAscend(s))} AP`, sub: `ready · ascend #${s.life.ascends + 1}`, frac: 1, color: "#ff2d8a", state: "ready", target: { win: "ascend" } });
    else {
        const eta = etaText(etaTo(s, d, "aether", TUNE.ascendAether));
        out.push({ id: "ascend", icon: "ascend", label: "Ascend", value: `${fmt(s.aether)} / ${fmt(TUNE.ascendAether)} ${ae.short}`, sub: eta ? `about ${eta}` : `build ${ae.name} nodes`, frac: fracOf(s.aether, TUNE.ascendAether), color: "#ff2d8a", state: "live", target: s.prod.aether > 0 ? aim(s, "aether") : { win: "ascend" } });
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
        status: afford ? (stat === "reboot" ? "Ready. Press to reboot." : "Ready. Press to buy.") : `Short by ${fmt(b.cost - have)} ${pays.short}${etaText(eta) ? `, about ${etaText(eta)}` : ""}.`,
        tone: afford ? "ok" : "wait",
    };
}

export const DRONE_NAMES = ["Probe", "Courier", "Sweeper", "Warden", "Cascade", "Sovereign"];
export function droneTip(s: State, tier: number): TipInfo {
    const lvl = s.drones[tier];
    const maxed = lvl >= droneMax(s);
    const cost = droneCost(s, tier);
    const afford = !maxed && s.aether >= cost;
    const rows: [string, string][] = [
        ["Presses", `tier ${tier + 1} buttons on every armed stat`],
        ["Now", `${fmt(droneRate(s, tier))} presses/s`],
    ];
    if (!maxed) {
        rows.push(["After", `${fmt(droneRate(s, tier) + TUNE.drone.rate)} presses/s`]);
        rows.push(["Cost", `${fmt(cost)} Aether`]);
        rows.push(["You have", `${fmt(s.aether)} AE`]);
    }
    rows.push(["Level", `${lvl} of ${droneMax(s)}`]);
    const eta = etaTo(s, derive(s), "aether", cost);
    return {
        color: statDef("aether").color,
        kicker: "Drone bay",
        title: `T${tier + 1} ${DRONE_NAMES[tier]}`,
        note: "Arm a stat in its zone so Drones press for it.",
        rows,
        status: maxed ? "Maxed." : afford ? `Ready. ${lvl ? "Upgrade" : "Build"} it.` : `Short by ${fmt(cost - s.aether)} AE${etaText(eta) ? `, about ${etaText(eta)}` : ""}.`,
        tone: afford || maxed ? "ok" : "wait",
    };
}
