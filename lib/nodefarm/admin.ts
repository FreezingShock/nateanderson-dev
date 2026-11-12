// Node Farm admin mode ("root console"). Pure rules on a State plus a little localStorage for the switch and the
// snapshots; no React. Turned on from the naOS console (`nf admin on`, `nf admin max`) and driven by
// components/nodefarm/admin.tsx. Easy to remove: delete this file, admin.tsx, nodefarm-admin.css, and the few
// `admin` lines in node-farm.tsx, events.tsx and components/cm/console.tsx.
import { BUY_STATS, SCRIPTS, SCRIPT_TUNE, auto, grantScripts, setRunning } from "./scripts";
import { maxRigs } from "./rigs";
import {
    DRONE_TREE, DRONE_TUNE, POSTABLE, freshDr, modMax,
    FW, handover, GOALS, LAB, LAB_TUNE, MATS, PAYLOADS, PERKS, SECRETS, STATS, TIERS, TREE, TREE_FULL, TUNE, ascend, ascendNeed, apOnAscend, derive, droneMax, exportSave, freshLab, fullTreeIds, parseSave, tick, treeFx, treeSpent, unlock,
    type MatId, type PerkDef, type ScriptId, type State, type StatId,
} from "./engine";
import { LOGS } from "./story";
import { ERAS } from "./scenery";

export const ADMIN_KEY = "nf-admin-v1"; // "1" while admin mode is on (per device)
export const SNAP_KEY = "nf-admin-snaps-v1"; // JSON list of snapshots (per device)
export const SNAP_MAX = 12;

export interface Snap {
    id: string;
    label: string;
    at: number;
    /** the save, as an export code */
    code: string;
    /** the save as it was when admin mode was turned on; kept until the next time admin is turned on */
    real?: boolean;
}

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} };

export const isAdmin = () => read(ADMIN_KEY) === "1";

// ---- snapshots
export function snaps(): Snap[] {
    try {
        const a = JSON.parse(read(SNAP_KEY) ?? "[]");
        return Array.isArray(a) ? a.filter((x) => x && typeof x.code === "string") : [];
    } catch { return []; }
}
const putSnaps = (a: Snap[]) => write(SNAP_KEY, JSON.stringify(a));
export function takeSnap(s: State, label: string, real = false): Snap {
    const snap: Snap = { id: Math.random().toString(36).slice(2, 8), label: label.slice(0, 40) || "snapshot", at: Date.now(), code: exportSave(s), real };
    let a = snaps();
    if (real) a = a.filter((x) => !x.real);
    a.unshift(snap);
    // keep the real save and the newest others
    const keep = a.filter((x) => x.real).concat(a.filter((x) => !x.real).slice(0, SNAP_MAX));
    putSnaps(keep.sort((x, y) => y.at - x.at));
    return snap;
}
export function dropSnap(id: string) { putSnaps(snaps().filter((x) => x.id !== id)); }
export function snapState(id: string): State | null {
    const x = snaps().find((y) => y.id === id);
    return x ? parseSave(x.code) : null;
}
/** Replace everything in `s` with `next`, in place, so the open game keeps its object. */
export function overwrite(s: State, next: State) {
    for (const k of Object.keys(s)) delete (s as unknown as Record<string, unknown>)[k];
    Object.assign(s, next);
    s.at = Date.now();
}

/** Switch admin mode. Turning it on saves your real game first (once per session of admin). Returns the snapshot taken, if any. */
export function setAdmin(on: boolean, s: State | null): Snap | null {
    const was = isAdmin();
    write(ADMIN_KEY, on ? "1" : null);
    let snap: Snap | null = null;
    if (on && !was && s) snap = takeSnap(s, "real save", true);
    try { window.dispatchEvent(new CustomEvent("nf:admin", { detail: { on } })); } catch {}
    return snap;
}

// ---- numbers: "1e9", "5M", "2.5B", "12k" -> number
const SUFFIX: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12, qa: 1e15, qi: 1e18, sx: 1e21, sp: 1e24, oc: 1e27, no: 1e30, dc: 1e33 };
export function parseAmount(raw: string): number | null {
    const m = raw.trim().toLowerCase().replace(/[, _]/g, "").match(/^(-?\d*\.?\d+(?:e[+-]?\d+)?)([a-z]{0,2})$/);
    if (!m) return null;
    const mul = m[2] ? SUFFIX[m[2]] : 1;
    if (!mul) return null;
    const v = Number(m[1]) * mul;
    return Number.isFinite(v) ? v : null;
}

// ---- resources
export const RESOURCES: StatId[] = ["bytes", "mult", "reboot", ...MATS];
export const CAP = 1e30;
export function setStat(s: State, id: StatId, v: number) {
    const n = Math.max(0, Math.min(CAP, v));
    (s[id] as number) = n;
    // what opens the next stats also looks at lifetime counters
    if (id === "bytes") s.life.bytes = Math.max(s.life.bytes, n);
    if (id === "reboot") s.life.reboots = Math.max(s.life.reboots, n);
}
export const addStat = (s: State, id: StatId, v: number) => setStat(s, id, (s[id] as number) + v);
export function setProd(s: State, id: MatId, n: number) { s.prod[id] = Math.max(0, Math.min(1e9, Math.floor(n))); }
export function setAP(s: State, v: number) { s.ap = Math.max(0, Math.min(1e9, Math.floor(v))); }

// ---- tree
export const ownAllNodes = (s: State) => { s.tree = fullTreeIds(); };
export const ownNoNodes = (s: State) => { s.tree = []; s.treeLv = {}; s.mounts = []; };
export function toggleNode(s: State, id: string): boolean {
    const had = s.tree.includes(id);
    const other = TREE.find((n) => n.id === id)?.excl;
    s.tree = had ? s.tree.filter((x) => x !== id) : [...s.tree.filter((x) => x !== other), id]; // a fork swaps
    if (had && s.treeLv) { const { [id]: _, ...rest } = s.treeLv; s.treeLv = rest; }
    if (had) s.mounts = s.mounts.slice(0, treeFx(s).mounts);
    return !had;
}
/** Take the tree back and give the AP back (what respec does). */
export function refundTree(s: State) { const b = treeSpent(s); s.ap += b; ownNoNodes(s); return b; }

// ---- perks, drones, goals, logs
export function setPerk(s: State, id: PerkDef["id"], lvl: number) { s.perks[id] = Math.max(0, Math.min(PERKS.find((p) => p.id === id)!.max, Math.floor(lvl))); }
export const maxPerks = (s: State) => { for (const p of PERKS) s.perks[p.id] = p.max; };
export const clearPerks = (s: State) => { for (const p of PERKS) s.perks[p.id] = 0; };
export function setDrone(s: State, tier: number, lvl: number) { s.drones[tier] = Math.max(0, Math.min(droneMax(s), Math.floor(lvl))); }
export const ARMABLE = ["mult", ...MATS] as string[];
export function maxDrones(s: State) {
    s.dr.nodes = DRONE_TREE.map((n) => n.id);
    for (let k = 0; k < TIERS; k++) { s.drones[k] = droneMax(s); s.dr.mods[k] = [modMax(s, 0), modMax(s, 1), modMax(s, 2)]; }
    for (const st of POSTABLE) s.dr.svc[st] = Math.max(s.dr.svc[st] ?? 0, DRONE_TUNE.rankAt[DRONE_TUNE.rankAt.length - 1]);
    s.armed = [...ARMABLE];
}
/** Wipe the hangar: postings, mastery, Parts, mods and the drone tree. */
export function clearHangar(s: State) { s.dr = freshDr(); }
export function grantGoals(s: State, tier?: number) { for (const g of GOALS) if (tier === undefined || g.tier === tier) unlock(s, g.id); }
export function revokeGoals(s: State, tier?: number) {
    const ids = new Set(GOALS.filter((g) => tier === undefined || g.tier === tier).map((g) => g.id));
    s.ach = s.ach.filter((x) => !ids.has(x));
    for (const id of ids) delete s.achAt[id];
}
export function toggleSecret(s: State, id: string): boolean {
    if (s.ach.includes(id)) { s.ach = s.ach.filter((x) => x !== id); delete s.achAt[id]; return false; }
    unlock(s, id);
    return true;
}
export const grantSecrets = (s: State) => { for (const x of SECRETS) unlock(s, x.id); };
export const grantLogs = (s: State) => { s.logs = LOGS.map((l) => l.id); };
export const clearLogs = (s: State) => { s.logs = []; };

// ---- Exploit Lab
/** Open the lab, research every node and fill Intel and stock. */
export function grantLab(s: State) {
    s.lab.seen = true;
    s.lab.nodes = LAB.map((n) => n.id);
    s.lab.intel = Math.max(s.lab.intel, 1e6);
    for (const p of PAYLOADS) s.lab.stock[p.id] = LAB_TUNE.stockMax;
}
/** Forget all research, stock, queue and running payloads (the lab stays open once seen). */
export function clearLab(s: State) {
    s.lab = { ...freshLab(), seen: s.lab.seen };
}

// ---- Scripts
export { grantScripts };
/** Teach one script (stopped), plus every tier buy.sh needs when it is the buy script. */
export function teachScript(s: State, id: ScriptId) {
    const a = auto(s);
    a.learn[id] = SCRIPT_TUNE.learn[id];
    if (!a.own.includes(id)) a.own.push(id);
    if (id === "buy") for (const st of BUY_STATS) { a.taught[st] = Array(TIERS).fill(SCRIPT_TUNE.teachTier); a.buy[st] = 63; }
}
/** Forget one script: it stops, and has to be learned by hand again. */
export function forgetScript(s: State, id: ScriptId) {
    const a = auto(s);
    setRunning(s, id, false);
    a.own = a.own.filter((x) => x !== id);
    a.learn[id] = 0;
    a.on[id] = false;
}
/** Forget every script and everything the scheduler saw you do by hand. */
export function forgetScripts(s: State) {
    for (const x of SCRIPTS) forgetScript(s, x.id);
    const a = auto(s);
    a.taught = {};
    a.buy = {};
}
export const scriptCount = (s: State) => auto(s).own.length;

// ---- the whole lot
/** Everything: every tree node, every perk, Drones, goals, secrets, logs, a pile of every material and prestige. */
export function maxOut(s: State) {
    ownAllNodes(s);
    maxPerks(s);
    maxDrones(s);
    grantGoals(s);
    grantSecrets(s);
    grantLogs(s);
    grantLab(s);
    grantScripts(s);
    maxRigs(s);
    s.life.ascends = Math.max(s.life.ascends, 10);
    s.life.reboots = Math.max(s.life.reboots, 1000);
    s.life.apTotal = Math.max(s.life.apTotal, 1000);
    s.life.bytes = Math.max(s.life.bytes, 1e18);
    s.life.secs = Math.max(s.life.secs, 90000);
    s.ap = Math.max(s.ap, 1000);
    s.reboot = Math.max(s.reboot, 1000);
    s.mult = Math.max(s.mult, 1e6);
    s.bytes = Math.max(s.bytes, 1e18);
    for (const m of MATS) { s[m] = Math.max(s[m], 1e9); s.prod[m] = Math.max(s.prod[m], 100); }
    s.mounts = [...MATS].reverse().slice(0, treeFx(s).mounts);
    s.watchdog = true;
}

/** Run the game forward without the offline cap or the offline slow-down. Returns the Bytes made. */
export function skipTime(s: State, secs: number): number {
    const before = s.bytes;
    const steps = Math.min(900, Math.max(1, Math.ceil(secs / 10)));
    for (let i = 0; i < steps; i++) tick(s, secs / steps);
    return s.bytes - before;
}

/** Ascend now even if there is not enough Aether (adds just enough first). Returns the AP gained. */
export function forceAscend(s: State): number {
    if (apOnAscend(s) < 1) s.aether = Math.max(s.aether, ascendNeed(s));
    return ascend(s);
}

/** Hand over now even before node zero (gives one Origin producer first). Returns the Keys gained. */
export function forceHandover(s: State): number {
    if (s.prod.origin < 1) { s.prod.origin = 1; s.origin = Math.max(s.origin, 1); }
    return handover(s, s.hand.proto ?? "wren", "", s.hand.proto2);
}
/** Add Keys. */
export function addKeys(s: State, n: number) { s.hand.keys += n; s.hand.keysTotal += n; }
/** Flash every Firmware node (no Keys spent). */
export function ownAllFw(s: State) { s.hand.fw = FW.map((n) => n.id); }

/** Make the run look like it is in era `n`: open every material up to its first stat and empty the ones after. */
export function jumpEra(s: State, n: number) {
    const era = ERAS[Math.max(0, Math.min(ERAS.length - 1, n))];
    const first = era.stats[0] as StatId;
    const at = STATS.findIndex((x) => x.id === first);
    s.life.reboots = Math.max(s.life.reboots, at >= 3 ? 1 : 0);
    s.life.bytes = Math.max(s.life.bytes, 600);
    s.mult = Math.max(s.mult, 40);
    for (let i = 0; i < MATS.length; i++) {
        const idx = STATS.findIndex((x) => x.id === MATS[i]);
        if (idx <= at) { s.prod[MATS[i]] = Math.max(1, s.prod[MATS[i]]); }
        else { s.prod[MATS[i]] = 0; s[MATS[i]] = 0; }
    }
}

/** What admin mode changes, for the console and panel header. */
export const adminSummary = (s: State) => {
    const d = derive(s);
    return { nodes: s.tree.length, nodeTotal: TREE_FULL, ap: s.ap, global: d.global };
};
