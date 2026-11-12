// Node Farm stress tests (challenge runs). After the first Ascend you can put the node under a fault: your real run is
// stored aside, a fresh run starts with one rule switched on, and you clear ranks I, II and III by opening Aether, Starglass
// and Chrono. Each rank pays a small permanent boost, kept through Ascend and Handover. Leaving (cleared or not) puts the
// real run back exactly as it was. Goals, logs and scripts learned during a test are kept; Ascend, Handover, the prestige
// tree, perks and Firmware are locked while a test runs.
//
// Rules are pure (no React). Importing this file fills the engine's CH_HOOKS and adds a tick hook. The window is
// components/nodefarm/stress.tsx. See docs/node-farm.md "Stress tests". Reward sizes belong to the balance pass: CH_TUNE.
import {
    CH_HOOKS, RIG_HOOKS, TICK_HOOKS, drOnAscend, fresh, freshLab, isUnlocked, parseSave,
    type ButtonStat, type ChMuls, type ChOff, type State, type StatId,
} from "./engine";

export type TestId = "brownout" | "grounded" | "cold" | "narrow" | "thin" | "dead" | "chain" | "leash";

export const CH_TUNE = {
    /** the zone that clears each rank */
    goals: ["aether", "starglass", "chrono"] as StatId[],
    /** Thin pipe: Bytes/s while the test runs */
    thin: 0.1,
    /** Narrow band: button tiers you may press (index 0 to narrow - 1) */
    narrow: 3,
    /** Short leash: minutes of game time from the start to clear each rank */
    leash: [30, 90, 240],
    /** what each cleared rank pays, per test */
    pay: { brownout: 0.03, grounded: 0.1, cold: 0.05, narrow: 0.1, thin: 0.25, dead: 0.1, chain: 0.05, leash: 1 } as Record<TestId, number>,
};

export interface TestDef {
    id: TestId;
    /** order in the window, 01 to 08 */
    n: number;
    name: string;
    /** the rule, one plain line */
    rule: string;
    /** what changes in how you play */
    plan: string;
    /** what the ranks cleared pay, as a phrase with the number */
    pays: (ranks: number) => string;
    icon: "zap" | "users" | "tree" | "layers" | "send" | "volumeOff" | "infinity" | "flag";
}

const pct = (x: number) => `+${Math.round(x * 100)}%`;
const P = CH_TUNE.pay;
export const TESTS: TestDef[] = [
    { id: "brownout", n: 1, icon: "zap", name: "Brownout", rule: "Perks, unspent AP and goal bonuses add nothing.", plan: "The tree and your materials carry the run.", pays: (r) => `everything ${pct(P.brownout * r)}` },
    { id: "grounded", n: 2, icon: "users", name: "Grounded", rule: "No Drones.", plan: "Scripts and your own presses carry the run.", pays: (r) => `Drone speed ${pct(P.grounded * r)}` },
    { id: "cold", n: 3, icon: "tree", name: "Cold tree", rule: "The prestige tree is switched off.", plan: "Perks and AP still count. The tree comes back when you leave.", pays: (r) => `AP on Ascend ${pct(P.cold * r)}` },
    { id: "narrow", n: 4, icon: "layers", name: "Narrow band", rule: `Only the first ${CH_TUNE.narrow} tiers of every button.`, plan: "The cheap tiers have to do all the work.", pays: (r) => `Multiplier gain ${pct(P.narrow * r)}` },
    { id: "thin", n: 5, icon: "send", name: "Thin pipe", rule: "Bytes/s cut to a tenth.", plan: "Bytes are scarce, so pick the Multiplier and Copper tiers that pay back fastest.", pays: (r) => `Bytes ${pct(P.thin * r)}` },
    { id: "dead", n: 6, icon: "volumeOff", name: "Dead air", rule: "No quick-time events and no zone events.", plan: "No Overclock and no event payouts. Pure production.", pays: (r) => `Overclock time ${pct(P.dead * r)}` },
    { id: "chain", n: 7, icon: "infinity", name: "Broken chain", rule: "Materials stop boosting the one below them.", plan: "Every zone stands on its own buttons. Spread out instead of rushing deep.", pays: (r) => `every material ${pct(P.chain * r)}` },
    { id: "leash", n: 8, icon: "flag", name: "Short leash", rule: `Each rank has a time limit: ${CH_TUNE.leash.join(", ")} min of game time.`, plan: "Game time, so time away counts toward each limit. Each later rank gets a longer limit.", pays: (r) => `offline cap +${P.leash * r} h` },
];
export const testDef = (id: TestId) => TESTS.find((t) => t.id === id)!;
export const RANKS = ["I", "II", "III"];
export const RANK_MAX = RANKS.length;

export interface TestRun {
    id: TestId;
    /** life.secs when the test started (game time, so time away counts) */
    t: number;
    /** wall clock at the start, ms epoch */
    at: number;
    /** ranks cleared in this attempt */
    got: number;
    /** Short leash: the next rank's time ran out */
    out: boolean;
    /** the real run, stored as a save object */
    real: unknown;
}
export interface ChState {
    /** best rank cleared per test (0 to 3), kept forever */
    done: Partial<Record<TestId, number>>;
    run: TestRun | null;
    tries: number;
    /** rank clears not yet announced on screen */
    news: { id: TestId; rank: number }[];
    /** how the last test ended, shown once in the window */
    last: { id: TestId; got: number; secs: number } | null;
}

const ids = new Set<string>(TESTS.map((t) => t.id));

const OK = new WeakSet<object>();
/** The saved state, checked field by field once per object, and created on first use. */
export function ensureCh(s: State): ChState {
    const o = s.ch as Partial<ChState> | undefined;
    if (o && OK.has(o)) return o as ChState;
    const x = (o && typeof o === "object" ? o : {}) as Partial<ChState>;
    const done: Partial<Record<TestId, number>> = {};
    for (const [k, v] of Object.entries(x.done ?? {})) if (ids.has(k) && Number.isFinite(v)) done[k as TestId] = Math.max(0, Math.min(RANK_MAX, Math.floor(v as number)));
    const r = x.run as TestRun | null | undefined;
    const run: TestRun | null = r && ids.has(r.id) && r.real && typeof r.real === "object" && Number.isFinite(r.t)
        ? { id: r.id, t: r.t, at: Number(r.at) || Date.now(), got: Math.max(0, Math.min(RANK_MAX, Math.floor(Number(r.got) || 0))), out: !!r.out, real: r.real }
        : null;
    const ch: ChState = {
        done, run, tries: Number(x.tries) || 0,
        news: Array.isArray(x.news) ? x.news.filter((n) => n && ids.has(n.id)) : [],
        last: x.last && ids.has(x.last.id) ? x.last : null,
    };
    OK.add(ch);
    s.ch = ch;
    return ch;
}

/** Stress tests open after the first Ascend (or while one is running). */
export const chOpen = (s: State) => s.life.ascends > 0 || !!s.ch?.run;
export const chRun = (s: State) => s.ch?.run ?? null;
export const chActive = (s: State, id: TestId) => s.ch?.run?.id === id;
export const ranksDone = (s: State, id: TestId) => s.ch?.done[id] ?? 0;
export const ranksTotal = (s: State) => TESTS.reduce((a, t) => a + ranksDone(s, t.id), 0);
export const RANKS_ALL = TESTS.length * RANK_MAX;
/** Seconds of game time since the running test started. */
export const chSecs = (s: State) => (s.ch?.run ? Math.max(0, s.life.secs - s.ch.run.t) : 0);
/** Short leash: seconds left for the next rank, or null. */
export function leashLeft(s: State): number | null {
    const r = s.ch?.run;
    if (!r || r.id !== "leash" || r.got >= RANK_MAX) return null;
    return Math.max(0, CH_TUNE.leash[r.got] * 60 - chSecs(s));
}

// ---- engine hooks
const ONE: ChMuls = { global: 1, drone: 1, bytes: 1, mats: 1, mult: 1, ap: 1, oc: 1, offlineH: 0, bare: false, noChain: false };
const MCACHE = new WeakMap<object, { key: string; v: ChMuls }>();
function muls(s: State): ChMuls {
    const ch = s.ch;
    if (!ch) return ONE;
    const d = ch.done ?? {};
    const run = ch.run?.id ?? "";
    const key = run + "|" + TESTS.map((t) => d[t.id] ?? 0).join("");
    const hit = MCACHE.get(ch);
    if (hit && hit.key === key) return hit.v;
    const r = (id: TestId) => (d[id] ?? 0) * P[id];
    const v: ChMuls = {
        global: 1 + r("brownout"),
        drone: 1 + r("grounded"),
        bytes: (1 + r("thin")) * (run === "thin" ? CH_TUNE.thin : 1),
        mats: 1 + r("chain"),
        mult: 1 + r("narrow"),
        ap: 1 + r("cold"),
        oc: 1 + r("dead"),
        offlineH: r("leash"),
        bare: run === "brownout",
        noChain: run === "chain",
    };
    MCACHE.set(ch, { key, v });
    return v;
}
function off(s: State, what: ChOff): boolean {
    const run = s.ch?.run;
    if (!run) return false;
    if (what === "prestige") return true;
    if (what === "drones") return run.id === "grounded";
    if (what === "events") return run.id === "dead";
    return false;
}
function buttonRule(s: State, stat: ButtonStat, tier: number, b: { cost: number; gain: number }) {
    const run = s.ch?.run;
    if (!run) return;
    if (run.id === "narrow" && tier >= CH_TUNE.narrow) b.cost = Infinity;
}
/** Is this button locked by the running test? (the board shows it as locked, not just unaffordable) */
export function chLocked(s: State, stat: ButtonStat, tier: number): boolean {
    const run = s.ch?.run;
    if (!run) return false;
    return run.id === "narrow" && tier >= CH_TUNE.narrow;
}

function step(s: State) {
    if (!s.ch) return;
    const ch = ensureCh(s);
    const r = ch.run;
    if (!r) return;
    while (r.got < RANK_MAX && !r.out) {
        if (r.id === "leash" && chSecs(s) > CH_TUNE.leash[r.got] * 60) { r.out = true; break; }
        if (!isUnlocked(s, CH_TUNE.goals[r.got])) break;
        r.got += 1;
        if ((ch.done[r.id] ?? 0) < r.got) {
            ch.done = { ...ch.done, [r.id]: r.got };
            ch.news.push({ id: r.id, rank: r.got });
        }
    }
}

CH_HOOKS.off = off;
CH_HOOKS.muls = muls;
CH_HOOKS.button = buttonRule;
if (!TICK_HOOKS.includes(step)) TICK_HOOKS.push(step);

/** Replace every field of `s` with those of `n` (keeps the object, so the game's references stay valid). */
function swap(s: State, n: State) {
    for (const k of Object.keys(s)) delete (s as unknown as Record<string, unknown>)[k];
    Object.assign(s, n);
}

/** Start a test: store the real run and start a fresh one under the test's rule. */
export function startTest(s: State, id: TestId, now = Date.now()): boolean {
    if (!chOpen(s) || s.ch?.run || !ids.has(id)) return false;
    const ch = ensureCh(s);
    const real = JSON.parse(JSON.stringify({ ...s, ch: undefined }));
    const cold = id === "cold";
    const keep: Partial<State> = {
        ap: s.ap, perks: s.perks, ach: s.ach, achAt: s.achAt, logs: s.logs, tree: cold ? [] : s.tree, treeLv: cold ? {} : s.treeLv,
        armed: s.armed, watchdog: s.watchdog, dropAt: s.dropAt, autoArmed: s.autoArmed, auto: s.auto, life: { ...s.life }, started: s.started,
        hand: s.hand, lab: { ...freshLab(), seen: s.lab.seen, nodes: s.lab.nodes, last: s.lab.last }, dr: drOnAscend(s),
        rig: RIG_HOOKS.ascend ? RIG_HOOKS.ascend(s) : s.rig, mounts: [],
    };
    const n = fresh(s.at);
    Object.assign(n, keep);
    n.rebootAt = s.life.secs;
    n.ch = { ...ch, run: { id, t: s.life.secs, at: now, got: 0, out: false, real }, tries: ch.tries + 1, last: null };
    OK.add(n.ch);
    swap(s, n);
    return true;
}

/** Leave the running test: the real run comes back as it was. Ranks cleared, goals, logs, lifetime stats and learned
 *  scripts come along. Returns the ranks cleared in this attempt, or -1 when no test was running. */
export function leaveTest(s: State): number {
    const ch = s.ch;
    const r = ch?.run;
    if (!ch || !r) return -1;
    const back = parseSave(JSON.stringify(r.real));
    const secs = chSecs(s);
    const merged: ChState = { ...ch, run: null, last: { id: r.id, got: r.got, secs } };
    if (!back) {
        // the stored run could not be read: keep playing the test run as the real one rather than lose everything
        ch.run = null;
        ch.last = merged.last;
        return r.got;
    }
    back.ach = [...back.ach, ...s.ach.filter((x) => !back.ach.includes(x))];
    back.achAt = { ...s.achAt, ...back.achAt };
    back.logs = [...back.logs, ...s.logs.filter((x) => !back.logs.includes(x))];
    if (s.auto) back.auto = s.auto;
    back.life = { ...s.life };
    // the stored run's clocks are game-time stamps, so they move forward by the time the test took
    back.rebootAt = (back.rebootAt ?? 0) + secs;
    if (back.hand) back.hand = { ...back.hand, cycleAt: back.hand.cycleAt + secs };
    back.at = s.at;
    back.ch = merged;
    OK.add(merged);
    swap(s, back);
    return r.got;
}

/** Rank clears since the last call, for the banner and the feed. */
export function takeChNews(s: State): { id: TestId; rank: number }[] {
    const ch = s.ch;
    if (!ch || !ch.news.length) return [];
    const out = ch.news;
    ch.news = [];
    return out;
}

/** One line on what the boosts from cleared ranks add up to. */
export function chTotals(s: State): [string, string][] {
    return TESTS.filter((t) => ranksDone(s, t.id) > 0).map((t) => [t.name, t.pays(ranksDone(s, t.id))]);
}
