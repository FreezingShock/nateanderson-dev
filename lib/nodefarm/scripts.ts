// Node Farm Scripts: automation you teach by playing. The scheduler watches what you do by hand and, once it has seen
// enough, writes it down as a script that plays that part for you. Each script has a few plain rules you set.
//   buy.sh      auto-buy: presses the tiers you taught it, on the stats you tick, keeping a reserve
//   reboot.sh   auto-Reboot at the best tier once Multipliers reach a multiple of its price (the Watchdog rule)
//   compile.sh  keeps chosen recipes stocked in the Exploit Lab
//   deploy.sh   redeploys chosen payloads when they run out
//   drop.sh     opens the Dead drop when it is full
//   ascend.sh   Ascends once the AP on offer beats your last Ascend by a margin you pick
//   rig.sh      upgrades the zone rigs you tick once you hold a multiple of the price
//   event.sh    answers zone events: mines or rides a Rich vein, patches or waits out a Fault
//   restore.sh  after a Handover, buys your tree back in the order you built it, then your perks
// Drones are the fast, blind hands; scripts are the slow rules about when, which and how much to keep.
// Rules are pure (no React). The board zone is components/nodefarm/scripts.tsx. See docs/node-farm.md "Scripts".
import {
    MATS, STATS, TICK_HOOKS, TIERS, amount, apOnAscend, button, compile, compileBlock, deploy, deployBlock, dropFill, hasFeature, hasRecipe, isRunning,
    isUnlocked, labOpen, labSlots, openDrop, payload, press, PAYLOADS, PERKS, TREE, buyNode, buyPerk, handSeen, nodeLevel,
    type AutoState, type ButtonStat, type PayloadId, type ScriptId, type State, type StatId,
} from "./engine";
import { RIGS, buyRig, capCharge, rig, rigOpen, rigPrice } from "./rigs";
import { zeChoose } from "./zoneevents";
const BY_ID = new Set(TREE.map((n) => n.id));

export const SCRIPT_TUNE = {
    /** manual actions that teach each script */
    learn: { buy: 40, reboot: 12, compile: 5, deploy: 5, drop: 2, ascend: 3, rig: 5, event: 3, restore: 1 } as Record<ScriptId, number>,
    /** rig.sh buys a level once you hold this many times its price */
    rigX: [2, 5, 10, 20],
    /** buy.sh may press a tier after you pressed it by hand this many times (on that stat) */
    teachTier: 3,
    /** buy.sh: seconds between runs per version, and the buys that reach each version */
    buyCycle: [3, 1.5, 0.75, 0.3],
    buyVer: [0, 500, 5000, 50000],
    /** the other scripts' cycles, seconds */
    cycle: { compile: 2, deploy: 1, drop: 5, rig: 5, event: 1, restore: 1 } as Record<string, number>,
    /** settings each rule cycles through on a press */
    keep: [1, 2, 5, 10],
    rebootX: [1.5, 3, 10, 30],
    ascX: [1, 1.25, 1.5, 2, 3],
    stockTo: [0, 1, 2, 3, 5],
    /** ascend.sh never Ascends a run younger than this */
    ascMinSecs: 300,
    /** at most this many cycles of one script per tick (a long time-away step) */
    burst: 40,
};

export interface ScriptDef {
    id: ScriptId;
    file: string;
    name: string;
    /** what it does, one plain line */
    blurb: string;
    /** what teaches it, with the count left */
    teach: (left: number) => string;
    /** a lore line */
    flavor: string;
    color: string;
}
export const SCRIPTS: ScriptDef[] = [
    { id: "buy", file: "buy.sh", name: "Auto-buy", color: "#b6f04a", blurb: "Presses the button tiers you taught it, on the stats you tick, and keeps a reserve.", teach: (n) => `Press any buy button by hand ${n} more time${n === 1 ? "" : "s"}.`, flavor: "It watched your hands for a while. Then it asked if it could try." },
    { id: "reboot", file: "reboot.sh", name: "Auto-Reboot", color: "#ff2d8a", blurb: "Reboots at the best tier you can afford once Multipliers reach a multiple of its price.", teach: (n) => `Reboot by hand ${n} more time${n === 1 ? "" : "s"}.`, flavor: "Kill, wait, start. The same three words every time, so it learned them." },
    { id: "compile", file: "compile.sh", name: "Auto-compile", color: "#4aa3ff", blurb: "Keeps the payloads you pick stocked, compiling whenever the queue and your Intel allow.", teach: (n) => `Compile ${n} more payload${n === 1 ? "" : "s"} by hand in the Exploit Lab.`, flavor: "make all. It has never once forgotten the flags." },
    { id: "deploy", file: "deploy.sh", name: "Auto-deploy", color: "#8f9bff", blurb: "Deploys the payloads you pick from stock: buffs when they run out, charges when unarmed.", teach: (n) => `Deploy ${n} more payload${n === 1 ? "" : "s"} by hand.`, flavor: "Fire and forget, then fire again on the minute." },
    { id: "drop", file: "drop.sh", name: "Auto-collect", color: "#ffc53a", blurb: "Opens the Dead drop the moment it is full, even while you are away.", teach: (n) => `Open the Dead drop by hand ${n} more time${n === 1 ? "" : "s"}.`, flavor: "Checks the box every five seconds. It has never been late." },
    { id: "rig", file: "rig.sh", name: "Auto-rig", color: "#f08a3c", blurb: "Upgrades the zone rigs you tick, one level at a time, once you hold a multiple of the price.", teach: (n) => `Buy ${n} more rig level${n === 1 ? "" : "s"} by hand in any zone.`, flavor: "It read the service manuals cover to cover. Then it picked up the wrench." },
    { id: "event", file: "event.sh", name: "Auto-answer", color: "#ffc53a", blurb: "Answers zone events for you: mines or rides a Rich vein, patches or waits out a Fault.", teach: (n) => `Answer ${n} more Rich vein or Fault by hand.`, flavor: "Picks up on the first ring. Always says the same thing." },
    { id: "restore", file: "restore.sh", name: "Auto-restore", color: "#9fe870", blurb: "After a Handover, buys your prestige tree back in the order you built it, then your perks, as AP comes in.", teach: () => "Do your first Handover. It saves your build on the way out.", flavor: "Somebody has to remember the floor plan. It wrote it on the back of the door." },
    { id: "ascend", file: "ascend.sh", name: "Auto-Ascend", color: "#6bffc9", blurb: "Ascends for you once the AP on offer beats your last Ascend by the margin you set. Only while the game is open.", teach: (n) => `Ascend by hand ${n} more time${n === 1 ? "" : "s"}.`, flavor: "It knows the way up now. It waits for you to say how high." },
];
export const SCRIPT_BY = new Map(SCRIPTS.map((x) => [x.id, x]));
export const SCRIPT_COLOR = "#ffb000";
/** stats buy.sh can run on, in chain order */
export const BUY_STATS: ButtonStat[] = ["mult", ...MATS];

const freshAuto = (): AutoState => ({
    taught: {}, learn: {}, own: [], on: {}, buy: {}, keep: 2, rebootX: 3, stockTo: {}, dep: [], ascX: 1.5, lastAp: 0, runAt: 0, seenAsc: 0, seenAp: 0, acc: {}, ran: {}, presses: 0,
});

/** The save's script state, made (and checked) on first use. Old saves are credited for what they already did by hand. */
export function auto(s: State): AutoState {
    if (s.auto && (s.auto as { ok?: boolean }).ok) return s.auto;
    const fromSave = !!s.auto;
    const a = sanitize(s.auto);
    if (!fromSave) {
        // credit an old save for what it has already done (generous: Drones' presses count too)
        a.learn.buy = Math.min(SCRIPT_TUNE.learn.buy, s.life.presses);
        a.learn.reboot = s.life.ascends > 0 || s.life.reboots >= 60 ? SCRIPT_TUNE.learn.reboot : 0;
        a.learn.compile = Math.min(SCRIPT_TUNE.learn.compile, s.life.compiled);
        a.learn.deploy = Math.min(SCRIPT_TUNE.learn.deploy, s.life.deployed);
        a.learn.ascend = Math.min(SCRIPT_TUNE.learn.ascend, s.life.ascends);
        for (const st of BUY_STATS) a.taught[st] = s.bought[st].map((n) => (n > 0 ? SCRIPT_TUNE.teachTier : 0));
        a.seenAsc = s.life.ascends;
        a.seenAp = s.life.apTotal;
        a.runAt = s.rebootAt ?? 0;
    }
    Object.defineProperty(a, "ok", { value: true, enumerable: false, configurable: true });
    s.auto = a;
    learnStep(s);
    return a;
}

function sanitize(o: unknown): AutoState {
    const b = freshAuto();
    if (!o || typeof o !== "object") return b;
    const x = o as Partial<AutoState>;
    const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
    const isScript = (v: unknown): v is ScriptId => typeof v === "string" && SCRIPT_BY.has(v as ScriptId);
    const isPay = (v: unknown): v is PayloadId => typeof v === "string" && PAYLOADS.some((p) => p.id === v);
    const pick = <T extends number>(v: unknown, list: readonly T[], d: T) => (list.includes(v as T) ? (v as T) : d);
    const rec = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
    for (const [k, v] of Object.entries(rec(x.taught))) if (BUY_STATS.includes(k as ButtonStat) && Array.isArray(v)) b.taught[k] = Array.from({ length: TIERS }, (_, i) => Math.max(0, num(v[i])));
    for (const [k, v] of Object.entries(rec(x.learn))) if (isScript(k)) b.learn[k] = Math.max(0, num(v));
    b.own = Array.isArray(x.own) ? [...new Set(x.own.filter(isScript))] : [];
    for (const [k, v] of Object.entries(rec(x.on))) if (isScript(k)) b.on[k] = !!v;
    for (const [k, v] of Object.entries(rec(x.buy))) if (BUY_STATS.includes(k as ButtonStat)) b.buy[k] = num(v) & 63;
    b.keep = pick(x.keep, SCRIPT_TUNE.keep, 2);
    b.rebootX = pick(x.rebootX, SCRIPT_TUNE.rebootX, 3);
    b.ascX = pick(x.ascX, SCRIPT_TUNE.ascX, 1.5);
    for (const [k, v] of Object.entries(rec(x.stockTo))) if (isPay(k)) b.stockTo[k] = pick(v, SCRIPT_TUNE.stockTo, 0);
    b.dep = Array.isArray(x.dep) ? [...new Set(x.dep.filter(isPay))] : [];
    b.lastAp = Math.max(0, num(x.lastAp));
    b.runAt = Math.max(0, num(x.runAt));
    b.seenAsc = Math.max(0, num(x.seenAsc));
    b.seenAp = Math.max(0, num(x.seenAp));
    for (const [k, v] of Object.entries(rec(x.acc))) if (isScript(k)) b.acc[k] = Math.max(0, num(v));
    for (const [k, v] of Object.entries(rec(x.ran))) if (isScript(k)) b.ran[k] = Math.max(0, num(v));
    b.presses = Math.max(0, num(x.presses));
    for (const k of ["capWait", "bombFirst", "zeroFirst", "rebuild", "restPerks"] as const) if (typeof x[k] === "boolean") b[k] = x[k];
    if (x.rigs && typeof x.rigs === "object") b.rigs = Object.fromEntries(Object.entries(x.rigs).filter(([k, v]) => RIG_ZONES.includes(k as StatId) && v === true));
    b.rigX = pick(x.rigX, SCRIPT_TUNE.rigX, 5);
    if (x.vein === "mine" || x.vein === "run") b.vein = x.vein;
    if (x.fault === "patch" || x.fault === "wait") b.fault = x.fault;
    if (Array.isArray(x.build)) b.build = x.build.filter((id) => typeof id === "string" && BY_ID.has(id));
    for (const k of ["buildLv", "buildPerks"] as const) if (x[k] && typeof x[k] === "object") b[k] = Object.fromEntries(Object.entries(x[k]!).filter(([, v]) => num(v) > 0).map(([id, v]) => [id, Math.floor(num(v))]));
    if (Number.isFinite(x.seenHand)) b.seenHand = Math.max(0, num(x.seenHand));
    return b;
}

// ---- learning
/** Whether a script can be shown and learned yet (the system it automates exists for this player). */
export function scriptOpen(s: State, id: ScriptId): boolean {
    switch (id) {
        case "buy": return true;
        case "reboot": return isUnlocked(s, "reboot");
        case "compile": case "deploy": return labOpen(s);
        case "drop": return hasFeature(s, "deaddrop");
        case "ascend": return s.life.ascends > 0 || apOnAscend(s) >= 1;
        case "rig": return true;
        case "event": return !!s.ze || s.life.secs >= 300;
        case "restore": return handSeen(s);
    }
}
/** What still locks a script, in a few words, for scripts that are not open yet. */
export const scriptGate: Record<ScriptId, string> = {
    buy: "", reboot: "opens with Reboots", compile: "opens with the Exploit Lab (Silicon)", deploy: "opens with the Exploit Lab (Silicon)", drop: "opens with the Dead drop tree node", ascend: "opens when you can first Ascend",
    rig: "", event: "opens with the first zone event", restore: "opens when the Root Chamber decrypts",
};
export const owns = (s: State, id: ScriptId) => !!s.auto?.own.includes(id);
/** 0..1 how far a script is learned. Watchdog timer (tree) teaches reboot.sh and Cron job (lab) teaches compile.sh. */
export function learnPart(s: State, id: ScriptId): number {
    if (owns(s, id)) return 1;
    if (id === "reboot" && hasFeature(s, "watchdog")) return 1;
    if (id === "compile" && s.lab.nodes.includes("rx_cron")) return 1;
    // rig levels and Handovers are counted where they are kept, so earlier play counts too
    if (id === "rig") return Math.min(1, Math.max(auto(s).learn.rig ?? 0, rigLevels(s)) / SCRIPT_TUNE.learn.rig);
    if (id === "restore") return s.hand.count >= SCRIPT_TUNE.learn.restore ? 1 : 0;
    return Math.min(1, (auto(s).learn[id] ?? 0) / SCRIPT_TUNE.learn[id]);
}
export const learnLeft = (s: State, id: ScriptId) => Math.max(0, SCRIPT_TUNE.learn[id] - Math.floor(id === "rig" ? Math.max(auto(s).learn.rig ?? 0, rigLevels(s)) : id === "restore" ? s.hand.count : (auto(s).learn[id] ?? 0)));
/** Rig levels owned across every zone. */
export const rigLevels = (s: State) => Object.values(rig(s).lv).reduce((n, v) => n + v, 0);
/** Learn every script that is now taught. Returns the ids just learned (the UI announces them). New scripts start stopped. */
export function learnStep(s: State): ScriptId[] {
    const a = s.auto;
    if (!a) return [];
    const out: ScriptId[] = [];
    for (const x of SCRIPTS) {
        if (a.own.includes(x.id) || !scriptOpen(s, x.id) || learnPart(s, x.id) < 1) continue;
        a.own.push(x.id);
        out.push(x.id);
        if (x.id === "reboot" && !hasFeature(s, "watchdog")) s.watchdog = false;
        if (x.id === "buy") for (const st of BUY_STATS) if (!(st in a.buy) && taughtMask(s, st)) a.buy[st] = taughtMask(s, st);
    }
    return out;
}
const bump = (a: AutoState, id: ScriptId, n = 1) => { a.learn[id] = (a.learn[id] ?? 0) + n; };
/** A button pressed by hand, n times at once (Auto-buy learns from these). */
export function teachPress(s: State, stat: ButtonStat, tier: number, n = 1) {
    const a = auto(s);
    if (stat === "reboot") { bump(a, "reboot"); return; }
    const t = (a.taught[stat] ??= Array(TIERS).fill(0));
    const before = t[tier] >= SCRIPT_TUNE.teachTier;
    t[tier] += n;
    bump(a, "buy", n);
    // a tier taught after buy.sh has the stat ticked joins its rule at once
    if (!before && t[tier] >= SCRIPT_TUNE.teachTier && a.own.includes("buy") && a.buy[stat]) a.buy[stat] |= 1 << tier;
}
export const teachCompile = (s: State) => bump(auto(s), "compile");
export const teachDeploy = (s: State) => bump(auto(s), "deploy");
export const teachDrop = (s: State) => bump(auto(s), "drop");
export const teachAscend = (s: State) => bump(auto(s), "ascend");
export const teachEvent = (s: State) => bump(auto(s), "event");

// ---- buy.sh
/** Tiers of a stat buy.sh is allowed to press (taught by hand), as a bitmask. */
export function taughtMask(s: State, stat: string): number {
    const t = s.auto?.taught[stat];
    if (!t) return 0;
    let m = 0;
    for (let k = 0; k < TIERS; k++) if (t[k] >= SCRIPT_TUNE.teachTier) m |= 1 << k;
    return m;
}
/** buy.sh version (0..3), from the buys it has made. */
export const buyVer = (s: State) => { const n = s.auto?.ran.buy ?? 0; let v = 0; SCRIPT_TUNE.buyVer.forEach((at, i) => { if (n >= at) v = i; }); return v; };
export const buyCycle = (s: State) => SCRIPT_TUNE.buyCycle[buyVer(s)];
/** One buy.sh run: on each ticked stat, press the highest allowed tier it can afford while keeping the reserve. */
export function runBuy(s: State): number {
    const a = s.auto!;
    let n = 0;
    for (const st of BUY_STATS) {
        const mask = (a.buy[st] ?? 0) & taughtMask(s, st);
        if (!mask || !isUnlocked(s, st)) continue;
        for (let k = TIERS - 1; k >= 0; k--) {
            if (!(mask & (1 << k))) continue;
            const b = button(s, st, k);
            if (amount(s, b.pays) < b.cost * a.keep) continue;
            if (press(s, st, k)) { n++; break; }
        }
    }
    a.presses += n;
    a.ran.buy = (a.ran.buy ?? 0) + n;
    return n;
}
export function toggleBuyTier(s: State, stat: string, tier: number) {
    const a = auto(s);
    if (!(taughtMask(s, stat) & (1 << tier))) return false;
    a.buy[stat] = (a.buy[stat] ?? 0) ^ (1 << tier);
    return true;
}
/** Tick a whole stat on (every taught tier) or off. */
export function toggleBuyStat(s: State, stat: string) {
    const a = auto(s);
    a.buy[stat] = a.buy[stat] ? 0 : taughtMask(s, stat);
}

// ---- compile.sh and deploy.sh
export function runCompile(s: State): number {
    const a = s.auto!;
    let n = 0;
    for (const p of PAYLOADS) {
        const want = a.stockTo[p.id] ?? 0;
        if (!want || !hasRecipe(s, p.id)) continue;
        const have = (s.lab.stock[p.id] ?? 0) + s.lab.queue.filter((q) => q.id === p.id).length;
        if (have >= want || compileBlock(s, p.id)) continue;
        if (compile(s, p.id)) n++;
    }
    a.ran.compile = (a.ran.compile ?? 0) + n;
    return n;
}
/** Whether deploy.sh would fire this payload now: buffs only when not running, charges when not armed, Trojan outside an Overclock, Polymorph with two buffs up. */
export function wantsDeploy(s: State, id: PayloadId): boolean {
    if (deployBlock(s, id)) return false;
    const p = payload(id);
    if (p.kind === "buff") return !isRunning(s, id);
    if (id === "trojan") return s.overclock <= 0;
    if (id === "polymorph") return s.lab.run.filter((r) => r.left > 0).length >= Math.min(2, labSlots(s));
    return true;
}
export function runDeploy(s: State): PayloadId[] {
    const a = s.auto!;
    const out: PayloadId[] = [];
    for (const id of a.dep) if (wantsDeploy(s, id) && deploy(s, id).ok) out.push(id);
    a.ran.deploy = (a.ran.deploy ?? 0) + out.length;
    return out;
}

// ---- reboot.sh: the Watchdog rule with its own reserve, plus two chains (wait for the Capacitor, arm a Logic bomb first)
export function runReboot(s: State): number {
    const a = s.auto!;
    if (!isUnlocked(s, "reboot")) return -1;
    if (a.capWait && capCharge(s) < 1) return -1;
    for (let k = TIERS - 1; k >= 0; k--) {
        const b = button(s, "reboot", k);
        if (s.mult < b.cost * a.rebootX) continue;
        if (a.bombFirst && (s.lab.stock.logicbomb ?? 0) > 0 && !s.lab.armed.includes("logicbomb")) deploy(s, "logicbomb");
        if (!press(s, "reboot", k)) return -1;
        a.ran.reboot = (a.ran.reboot ?? 0) + 1;
        return k;
    }
    return -1;
}

// ---- rig.sh
/** Zones with a rig that has levels to buy (every zone but the Root chamber). */
export const RIG_ZONES = RIGS.filter((r) => r.keys.length > 0).map((r) => r.zone);
export function runRig(s: State): number {
    const a = s.auto!;
    let n = 0;
    for (const z of RIG_ZONES) {
        if (!a.rigs?.[z] || !rigOpen(s, z)) continue;
        const def = RIGS.find((r) => r.zone === z)!;
        // the cheapest key first (the Glyph hall has three)
        const keys = def.keys.map((k) => ({ k: k.key, p: rigPrice(s, k.key) })).filter((x) => !x.p.maxed && Number.isFinite(x.p.cost)).sort((x, y) => x.p.cost - y.p.cost);
        const pick = keys[0];
        if (pick && (s[pick.p.pays] as number) >= pick.p.cost * (a.rigX ?? 5) && buyRig(s, pick.k)) n++;
    }
    a.ran.rig = (a.ran.rig ?? 0) + n;
    return n;
}
export function toggleRigZone(s: State, z: StatId) {
    const a = auto(s);
    a.rigs = { ...(a.rigs ?? {}), [z]: !a.rigs?.[z] };
}

// ---- event.sh
export function runEvent(s: State): number {
    const a = s.auto!;
    const z = s.ze;
    if (!z?.act.length) return 0;
    let n = 0;
    for (const e of [...z.act]) {
        if (e.left <= 0 || e.picked) continue;
        if (e.kind === "vein") {
            const mine = (a.vein ?? "mine") === "mine";
            if (mine) { if (mineVein(s, e.id)) n++; }
            else { e.picked = true; n++; }
        } else if (e.kind === "fault") {
            if ((a.fault ?? "patch") === "patch" && patchFault(s, e.id)) n++;
            else if (a.fault === "wait") { e.picked = true; n++; }
        }
    }
    a.ran.event = (a.ran.event ?? 0) + n;
    return n;
}
const mineVein = (s: State, id: number) => zeChoose(s, id, "mine").ok;
const patchFault = (s: State, id: number) => zeChoose(s, id, "patch").ok;

// ---- restore.sh
/** Keep a copy of the build while it grows, and start rebuilding when a Handover happens. */
function restoreWatch(s: State, a: AutoState) {
    const n = s.hand.count;
    if (a.seenHand === undefined) a.seenHand = n;
    if (n > a.seenHand) {
        a.seenHand = n;
        if (a.build?.length) a.rebuild = true;
        return;
    }
    if (a.rebuild || !s.tree.length) return;
    // a new copy whenever the tree grew or changed
    if (!a.build || a.build.length !== s.tree.length || a.build.some((id, i) => s.tree[i] !== id)) a.build = [...s.tree];
    a.buildLv = { ...(s.treeLv ?? {}) };
    if (Object.values(s.perks).some((v) => v > 0)) a.buildPerks = { ...s.perks };
}
/** What restore.sh still has to buy: [tree nodes and ranks left, perk levels left]. */
export function restoreLeft(s: State): [number, number] {
    const a = s.auto;
    if (!a?.build) return [0, 0];
    let t = 0;
    for (const id of a.build) t += Math.max(0, Math.max(1, a.buildLv?.[id] ?? 1) - (s.tree.includes(id) ? nodeLevel(s, id) : 0));
    let p = 0;
    if (a.restPerks !== false) for (const x of PERKS) p += Math.max(0, (a.buildPerks?.[x.id] ?? 0) - s.perks[x.id]);
    return [t, p];
}
export function runRestore(s: State): number {
    const a = s.auto!;
    if (!a.rebuild || !a.build) return 0;
    let n = 0;
    // the tree in build order; stop at the first node it can't pay for, so the path stays in order
    for (const id of a.build) {
        if (!BY_ID.has(id)) continue;
        const want = Math.max(1, a.buildLv?.[id] ?? 1);
        while ((s.tree.includes(id) ? nodeLevel(s, id) : 0) < want) {
            if (!buyNode(s, id)) {
                if (!s.tree.includes(id)) { a.ran.restore = (a.ran.restore ?? 0) + n; return n; }
                break;
            }
            n++;
        }
    }
    if (a.restPerks !== false)
        for (const x of PERKS) while (s.perks[x.id] < (a.buildPerks?.[x.id] ?? 0)) { if (!buyPerk(s, x.id)) { a.ran.restore = (a.ran.restore ?? 0) + n; return n; } n++; }
    a.rebuild = false;
    a.ran.restore = (a.ran.restore ?? 0) + n;
    return n;
}

// ---- ascend.sh (run by the open game only, so an Ascend always happens in front of you)
/** AP ascend.sh is waiting for. */
export const ascendTarget = (s: State) => {
    // before ascend.sh has seen an Ascend, measure against your average one
    const last = s.auto?.lastAp || (s.life.ascends > 0 ? s.life.apTotal / s.life.ascends : 0);
    return Math.max(1, Math.ceil(last * (s.auto?.ascX ?? 1.5)));
};
export const runAge = (s: State) => Math.max(0, s.life.secs - (s.auto?.runAt ?? 0));
export function ascendDue(s: State): boolean {
    const a = s.auto;
    if (!a?.on.ascend || !a.own.includes("ascend")) return false;
    return runAge(s) >= SCRIPT_TUNE.ascMinSecs && apOnAscend(s) >= ascendTarget(s);
}
/** Just before ascend.sh Ascends: arm a stocked Zero-click if that chain is on. */
export function ascendPrep(s: State) {
    const a = s.auto;
    if (a?.zeroFirst && (s.lab.stock.zeroclick ?? 0) > 0 && !s.lab.armed.includes("zeroclick")) deploy(s, "zeroclick");
}

/** Cycle a rule setting to its next value. */
export function cycleSetting(s: State, key: "keep" | "rebootX" | "ascX" | "rigX") {
    const a = auto(s);
    const list = SCRIPT_TUNE[key] as readonly number[];
    const cur = key === "rigX" ? a.rigX ?? 5 : a[key];
    const next = list[(list.indexOf(cur) + 1) % list.length];
    if (key === "rigX") a.rigX = next; else a[key] = next;
}
/** Flip one of the yes/no rules. */
export function flip(s: State, key: "capWait" | "bombFirst" | "zeroFirst" | "restPerks") {
    const a = auto(s);
    a[key] = key === "restPerks" ? a.restPerks === false : !a[key];
}
export function cycleAnswer(s: State, key: "vein" | "fault") {
    const a = auto(s);
    if (key === "vein") a.vein = (a.vein ?? "mine") === "mine" ? "run" : "mine";
    else a.fault = (a.fault ?? "patch") === "patch" ? "wait" : "patch";
}
export function cycleStock(s: State, id: PayloadId) {
    const a = auto(s);
    const list = SCRIPT_TUNE.stockTo;
    a.stockTo[id] = list[(list.indexOf(a.stockTo[id] ?? 0) + 1) % list.length];
}
export function toggleDeploy(s: State, id: PayloadId) {
    const a = auto(s);
    a.dep = a.dep.includes(id) ? a.dep.filter((x) => x !== id) : [...a.dep, id];
}
/** Run or stop a script. reboot.sh shares the Watchdog switch. */
export function setRunning(s: State, id: ScriptId, on: boolean) {
    const a = auto(s);
    if (!a.own.includes(id)) return false;
    if (id === "reboot") s.watchdog = on;
    else a.on[id] = on;
    if (on) a.acc[id] = 0;
    return true;
}
export const isOn = (s: State, id: ScriptId) => (id === "reboot" ? owns(s, "reboot") && s.watchdog : !!(s.auto?.own.includes(id) && s.auto.on[id]));

// ---- the scheduler: runs every tick, so scripts also work through time away (except ascend.sh)
function every(a: AutoState, id: ScriptId, dt: number, cycle: number, fn: () => unknown) {
    let t = (a.acc[id] ?? 0) + dt;
    let n = 0;
    while (t >= cycle && n < SCRIPT_TUNE.burst) { t -= cycle; n++; fn(); }
    a.acc[id] = Math.min(t, cycle);
}
/** Old saves: stats that sweeping Drones or the removed Autoloader perk pressed come to buy.sh once (engine migrateAutomation
 * fills `armed`). buy.sh is learned and running, each stat ticked, and every tier the save has bought counts as taught. */
export function migrateArmed(s: State) {
    if (!s.armed.length) return;
    const a = auto(s);
    for (const st of s.armed) {
        if (!BUY_STATS.includes(st as ButtonStat)) continue;
        const t = (a.taught[st] ??= Array(TIERS).fill(0));
        s.bought[st as ButtonStat].forEach((n, k) => { if (n > 0 || ((s.seen?.[st as ButtonStat] ?? 0) >> k) & 1) t[k] = Math.max(t[k], SCRIPT_TUNE.teachTier); });
        a.buy[st] = ALL_TIERS;
    }
    if (!a.own.includes("buy")) a.own.push("buy");
    a.learn.buy = Math.max(a.learn.buy ?? 0, SCRIPT_TUNE.learn.buy);
    a.on.buy = true;
    s.armed = [];
}
const ALL_TIERS = (1 << TIERS) - 1;
/** Standing orders (tree node): every stat is ticked for buy.sh the first time it opens; untick it and it stays off. */
function standingOrders(s: State, a: AutoState) {
    if (!a.own.includes("buy") || !hasFeature(s, "orders")) return;
    for (const st of BUY_STATS) {
        if (s.autoArmed.includes(st) || !isUnlocked(s, st)) continue;
        s.autoArmed.push(st);
        a.buy[st] = ALL_TIERS;
    }
}

export function scriptStep(s: State, dt: number) {
    if (s.armed.length) migrateArmed(s);
    const a = s.auto;
    if (!a) return;
    standingOrders(s, a);
    // notice an Ascend from anywhere (button, admin, ascend.sh) for ascend.sh's rule
    if (s.life.ascends !== a.seenAsc) {
        if (s.life.ascends > a.seenAsc) { a.lastAp = Math.max(0, s.life.apTotal - a.seenAp); a.runAt = s.life.secs; }
        a.seenAsc = s.life.ascends;
        a.seenAp = s.life.apTotal;
    }
    restoreWatch(s, a);
    if (!a.own.length) return;
    if (s.watchdog && a.own.includes("reboot")) runReboot(s);
    if (a.on.rig && a.own.includes("rig")) every(a, "rig", dt, SCRIPT_TUNE.cycle.rig, () => runRig(s));
    if (a.on.event && a.own.includes("event")) every(a, "event", dt, SCRIPT_TUNE.cycle.event, () => runEvent(s));
    if (a.on.restore && a.own.includes("restore")) every(a, "restore", dt, SCRIPT_TUNE.cycle.restore, () => runRestore(s));
    if (a.on.buy && a.own.includes("buy")) every(a, "buy", dt, buyCycle(s), () => runBuy(s));
    if (a.on.compile && a.own.includes("compile") && labOpen(s)) every(a, "compile", dt, SCRIPT_TUNE.cycle.compile, () => runCompile(s));
    if (a.on.deploy && a.own.includes("deploy") && labOpen(s)) every(a, "deploy", dt, SCRIPT_TUNE.cycle.deploy, () => runDeploy(s));
    if (a.on.drop && a.own.includes("drop")) every(a, "drop", dt, SCRIPT_TUNE.cycle.drop, () => { if (dropFill(s) >= 1 && openDrop(s)) a.ran.drop = (a.ran.drop ?? 0) + 1; });
}
if (!TICK_HOOKS.includes(scriptStep)) TICK_HOOKS.push(scriptStep);

/** Scripts the player owns that are running, and all owned. */
export const runningCount = (s: State) => SCRIPTS.filter((x) => isOn(s, x.id)).length;

/** Scene stage 0..7 for the zone art: one machine per script learned, the seventh once buy.sh reaches v3. */
export const SCHED_STAGES = 11;
export const schedStage = (s: State) => Math.min(SCHED_STAGES - 1, (s.auto?.own.length ?? 0) + (buyVer(s) >= 2 ? 1 : 0));

/** The one thing to do next with scripts, as a plain line (or null when everything is set). */
export function scriptNext(s: State): { id: ScriptId; text: string } | null {
    const a = auto(s);
    for (const x of SCRIPTS) {
        if (!scriptOpen(s, x.id)) continue;
        if (!a.own.includes(x.id)) return { id: x.id, text: `Teach ${x.file}: ${x.teach(learnLeft(s, x.id))}` };
        if (!isOn(s, x.id)) return { id: x.id, text: `${x.file} is learned. Press Run to start it.` };
        if (x.id === "buy" && !BUY_STATS.some((st) => a.buy[st])) return { id: x.id, text: "Tick a stat in buy.sh so it has something to buy." };
        if (x.id === "compile" && !PAYLOADS.some((p) => (a.stockTo[p.id] ?? 0) > 0 && hasRecipe(s, p.id))) return { id: x.id, text: "Set a stock level on a recipe in compile.sh." };
        if (x.id === "deploy" && !a.dep.length) return { id: x.id, text: "Tick a payload in deploy.sh." };
    }
    // the next untaught tier on a stat already open
    for (const st of BUY_STATS) {
        if (!isUnlocked(s, st)) continue;
        const t = a.taught[st] ?? [];
        for (let k = 0; k < TIERS; k++) {
            if ((t[k] ?? 0) >= SCRIPT_TUNE.teachTier) continue;
            if (s.bought[st][k] > 0 || k === 0 || (t[k - 1] ?? 0) >= SCRIPT_TUNE.teachTier) {
                const left = SCRIPT_TUNE.teachTier - Math.floor(t[k] ?? 0);
                return { id: "buy", text: `Press ${STATS.find((x) => x.id === st)!.name} T${k + 1} by hand ${left} more time${left === 1 ? "" : "s"} to teach it to buy.sh.` };
            }
            break;
        }
    }
    return null;
}

/** The Scripts zone shows once you have pressed a few buttons by hand (the recording has started) or Reboots are open. */
export const schedOpen = (s: State) => !!s.auto?.own.length || (s.auto?.learn.buy ?? 0) >= 10 || isUnlocked(s, "reboot");

/** Admin: teach every script and every tier (stopped, so nothing runs until you press Run). */
export function grantScripts(s: State) {
    const a = auto(s);
    for (const x of SCRIPTS) a.learn[x.id] = SCRIPT_TUNE.learn[x.id];
    for (const st of BUY_STATS) a.taught[st] = Array(TIERS).fill(SCRIPT_TUNE.teachTier);
    for (const x of SCRIPTS) if (!a.own.includes(x.id)) a.own.push(x.id);
    for (const st of BUY_STATS) a.buy[st] = 63;
    a.rigs = Object.fromEntries(RIG_ZONES.map((z) => [z, true]));
}
