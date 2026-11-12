// The ending: a final build in the last zone. Once the last zone (25 with the Overgrowth and Descent arcs, 17 before them)
// has a producer, the build opens in the Handover window. It has five stages; each is paid in the last zone's material
// plus Keys, and stages are kept through Ascend and Handover, so the build spans several cycles. Finishing the last stage
// plays the end screen once. Play continues afterwards, and "New operator" starts a fresh save that keeps the star count
// and the log you left, which the next run finds as its first log. Every number is in END_TUNE (balance thread owns them).
// Pure rules, no React. docs/node-farm.md "Ending".
import { END_LOG_MAX, STATS, fmt, isUnlocked, type EndLog, type EndState, type MatId, type State } from "./engine";

export type { EndLog, EndState };

export const END_TUNE = {
    /** Keys per stage */
    keys: [2, 3, 5, 8, 12],
    /** last-zone material per stage (spent) */
    mat: [1e3, 1e5, 1e7, 1e9, 1e11],
    /** producers the last zone needs this run before the build opens */
    needProd: 1,
    /** characters in the log you leave */
    logMax: END_LOG_MAX,
};

/** Stage names, shown on the build. Draft copy, waiting on Nate. */
export const END_STAGES = ["Power", "Clock", "Memory", "Voice", "Wake"] as const;
export const END_STEPS = END_STAGES.length;

export const freshEnd = (): EndState => ({ stage: 0, doneAt: 0, seen: false, stars: 0, logs: [] });

/** The last zone in the game (whatever the newest arc ends on). */
export const lastZone = (): MatId => STATS[STATS.length - 1].id as MatId;

/** The save's ending state, created on first use. */
export function endOf(s: State): EndState {
    if (!s.end) s.end = freshEnd();
    return s.end;
}

/** The last zone is producing this run. */
export const endOpen = (s: State) => (s.prod[lastZone()] ?? 0) >= END_TUNE.needProd;
/** The player has seen the build at least once (last zone opened, or a stage already built). */
export const endSeen = (s: State) => (s.end?.stage ?? 0) > 0 || isUnlocked(s, lastZone());
export const endStage = (s: State) => s.end?.stage ?? 0;
export const endDone = (s: State) => endStage(s) >= END_STEPS;

export function stageCost(i: number) {
    return { keys: END_TUNE.keys[Math.min(i, END_TUNE.keys.length - 1)], mat: END_TUNE.mat[Math.min(i, END_TUNE.mat.length - 1)] };
}

/** Why the next stage cannot be built, or null when it can. */
export function buildBlock(s: State): string | null {
    const stage = endStage(s);
    if (stage >= END_STEPS) return "built";
    if (s.ch?.run) return "Locked until you leave the test";
    const z = lastZone();
    const name = STATS[STATS.length - 1].name;
    if (!endOpen(s)) return `Start ${name} production`;
    const c = stageCost(stage);
    if ((s[z] as number) < c.mat) return `Need ${fmt(c.mat)} ${name}`;
    if (s.hand.keys < c.keys) return `Need ${c.keys} Keys`;
    return null;
}

/** Build the next stage. Returns the stage number built (1 to END_STEPS), or 0. */
export function buildStage(s: State, now = Date.now()): number {
    if (buildBlock(s)) return 0;
    const e = endOf(s);
    const c = stageCost(e.stage);
    (s as unknown as Record<string, number>)[lastZone()] -= c.mat;
    s.hand.keys -= c.keys;
    e.stage += 1;
    if (e.stage >= END_STEPS) {
        e.doneAt = now;
        e.stars += 1;
    }
    return e.stage;
}

/** The end screen has played: store the log you left (blank is fine) and mark it seen. */
export function closeEnding(s: State, log: string, now = Date.now()) {
    const e = endOf(s);
    const text = log.replace(/\s+/g, " ").trim().slice(0, END_TUNE.logMax);
    // one log per ending: replaying the end screen rewrites that ending's log
    const rest = e.logs.filter((l) => l.n !== e.stars);
    e.logs = text ? [...rest, { n: e.stars, text, at: now }].slice(-20) : e.logs;
    e.seen = true;
}

/** The end screen should open (built, not yet closed). */
export const endPending = (s: State) => endDone(s) && !s.end!.seen;

/** What a New operator keeps: the star count and your logs. Everything else starts fresh. */
export function carryEnd(s: State): EndState {
    const e = endOf(s);
    return { ...freshEnd(), stars: e.stars, logs: e.logs };
}

/** Your newest log, shown as the first log a New operator finds (null on a first save). */
export const inheritedLog = (s: State): EndLog | null => {
    const e = s.end;
    return e && e.logs.length ? e.logs[e.logs.length - 1] : null;
};

/**
 * End screen and build copy. DRAFT: written for Nate to approve or rewrite; nothing here is final until he says so.
 * `{zone}` is the last zone's name, `{n}` your operator number.
 */
export const END_COPY = {
    bar: "naOS // node.farm // node zero",
    barRight: "ALL ZONES LIT",
    kicker: "Final build · stage 5 of 5 · Wake",
    title: "Node zero is awake",
    lead: "Every zone is lit, from the first wire down to {zone}. The node runs on its own now. It still wants an operator.",
    creditsHead: "Operators of this node",
    youName: "You",
    youLine: "Operator {n}. Inherited the node, and woke it.",
    statsHead: "Your shift",
    logHead: "Leave a log",
    logHint: "Whoever runs this node next reads it first.",
    keep: "Keep running",
    next: "New operator",
    nextConfirm: "Confirm: start fresh as the next operator",
    nextNote: "A fresh save, from one wire. Goals, Keys, Firmware, the tree, stress ranks and lifetime stats start over. Your ending star and your log carry over.",
    buildHead: "Final build // node zero",
    buildIntro: "Five stages, paid in {zone} and Keys. Built stages are kept through Ascend and Handover.",
    buildDone: "Node zero is awake.",
    inherited: "Log from operator {n}",
};
export const endText = (t: string, s: State) => t.replace("{zone}", STATS[STATS.length - 1].name.replace(/^The /, "the ")).replace("{n}", String(Math.max(1, s.end?.stars ?? 1)));
