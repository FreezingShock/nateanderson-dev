// "What do I do next?" for Groundbreak. Pure functions of the game state: no React, no DOM. The page shows the cue as one line above the
// dock, pulses the tile or button it points at, and Space does it. `gb next` and `gb go` in the console use the same function.
import { MATS, PERKS, JOB_BY, UNLOCK_COST } from "./data";
import {
    acceptChange, buy, buyPerk, canBuy, canIncorporate, canUnlock, charterGain, chain, effects, fmt, fmtAge, fmtCash, incorporate, perkReady, phaseNeeds, plan,
    rawRate, tierCost, unlock, waitingFor, type State,
} from "./engine";

export type CueKind = "accept" | "unlock" | "buy" | "perk" | "incorporate" | "wait";
export interface Cue {
    kind: CueKind;
    /** One short imperative line, e.g. "Hire a Sand crew". */
    text: string;
    /** Why, in one line. */
    why: string;
    /** Material row the cue points at (buy, wait, unlock). */
    mat?: number;
    /** 0 crew, 1 equipment, 2 method. */
    tier?: 0 | 1 | 2;
    perk?: string;
    /** A button can do it right now (false for "wait"). */
    doable: boolean;
}

const TIER_NAME = ["crew", "equipment", "method"] as const;

/** Seconds until the tier-k purchase on row n is affordable at the current output, or 0 when it is now, Infinity when it never will be. */
export function secsToAfford(s: State, n: number, k: number): number {
    if (canBuy(s, n, k)) return 0;
    if (k === 2 && s.equip[n] < 2) return Infinity;
    const f = effects(s);
    const c = tierCost(s, n, k, f);
    const have = c.cur === "cash" ? s.cash : s.amt[c.mat];
    if (c.cur === "cash") return Infinity;
    const rate = rawRate(s, c.mat, f, chain(s));
    return rate > 0 ? Math.max(0, (c.amount - have) / rate) : Infinity;
}

/** The material row the player should be growing: the one the current build phase is short of the longest, else the last open one. */
export function bottleneck(s: State): number {
    const f = effects(s);
    const c = chain(s);
    const aj = s.job;
    if (aj && aj.step === "build") {
        const def = JOB_BY.get(aj.id);
        const ph = def ? plan(def, f)[aj.phase] : undefined;
        if (ph) {
            let best = -1, eta = 0;
            for (const [m, q] of phaseNeeds(aj, ph)) {
                const short = q - aj.got[m] - s.amt[m];
                if (short <= 1e-9) continue;
                const t = short / Math.max(1e-9, rawRate(s, m, f, c));
                if (t > eta) { eta = t; best = m; }
            }
            if (best >= 0) return best;
        }
    }
    return Math.max(0, s.open - 1);
}

const ago = (sec: number) => (sec < 1 ? "now" : `in ${fmtAge(Math.ceil(sec))}`);

/** While the crew repeats a job, a waiting cue also says what the next campaign job is waiting on. */
export function nextCue(s: State): Cue {
    const c = cueInner(s);
    const w = c.kind === "wait" && s.job?.rerun ? waitingFor(s) : null;
    const rep = w && s.job ? JOB_BY.get(s.job.id) : null;
    return w && rep ? { ...c, why: `${w} The crew repeats ${rep.name} meanwhile. ${c.why}` } : c;
}

function cueInner(s: State): Cue {
    const f = effects(s);
    if (s.change) {
        return { kind: "accept", text: "Accept the change order", why: `The client pays ${Math.round(s.change.bonus * 100)}% more for extra materials. Decline it if the crews are behind.`, doable: true };
    }
    // Charter points are free value once the firm exists.
    const perk = PERKS.filter((p) => perkReady(s.perks, p) && s.charter >= p.cost).sort((a, b) => a.cost - b.cost)[0];
    if (perk) return { kind: "perk", text: `Spend charter on ${perk.name}`, why: perk.desc, perk: perk.id, doable: true };
    if (s.open < MATS.length && canUnlock(s, s.open)) {
        return { kind: "unlock", text: `Bring ${MATS[s.open].name} on site`, why: `You hold enough ${MATS[s.open - 1].name}. A new material opens the next jobs.`, mat: s.open, doable: true };
    }
    const target = bottleneck(s);
    // Best affordable purchase on the bottleneck row, then on its neighbours: method (x3) before equipment (x2) before a crew.
    const rows = [target, ...Array.from({ length: s.open }, (_, i) => i).filter((i) => i !== target).sort((a, b) => Math.abs(a - target) - Math.abs(b - target))];
    for (const n of rows) {
        for (const k of [2, 1, 0] as const) {
            if (n >= s.open || !canBuy(s, n, k, f)) continue;
            const m = MATS[n];
            const what = k === 0 ? `Hire a ${m.name} crew` : k === 1 ? `Buy ${m.equip.toLowerCase().startsWith("a ") ? "" : "a "}${m.equip.toLowerCase()}` : `Learn ${m.method}`;
            const c = tierCost(s, n, k, f);
            const cost = c.cur === "cash" ? fmtCash(c.amount) : `${fmt(c.amount)} ${MATS[c.mat].name}`;
            const why = n === target
                ? `${m.name} is what the ${waitingFor(s) ? "next job" : "build"} is short of. Costs ${cost}.`
                : `You can afford it now (${cost}) and it speeds ${m.name} up.`;
            return { kind: "buy", text: what, why, mat: n, tier: k, doable: true };
        }
    }
    if (canIncorporate(s, f)) {
        return { kind: "incorporate", text: "Incorporate a new firm", why: `Worth ${charterGain(s, f)} charter. Cash, crews and materials reset; the skyline and perks stay. Take your time.`, doable: true };
    }
    // Nothing to buy: say what is being waited on and how long.
    let best: { n: number; k: 0 | 1 | 2; t: number } | null = null;
    for (const n of [target, ...rows]) {
        if (n >= s.open) continue;
        for (const k of [0, 1] as const) {
            const t = secsToAfford(s, n, k);
            if (t > 0 && Number.isFinite(t) && (!best || t < best.t)) best = { n, k, t };
        }
        if (best && n === target) break;
    }
    if (s.open < MATS.length) {
        const have = s.amt[s.open - 1], need = UNLOCK_COST[s.open];
        const rate = rawRate(s, s.open - 1, f, chain(s));
        if (!best || (rate > 0 && (need - have) / rate < best.t * 0.8)) {
            if (rate > 0) return { kind: "wait", text: `Keep making ${MATS[s.open - 1].name}`, why: `${MATS[s.open].name} opens when you hold ${fmt(need)} ${MATS[s.open - 1].name}, about ${ago((need - have) / rate)}.`, mat: s.open, doable: false };
        }
    }
    if (best) {
        const m = MATS[best.n];
        return { kind: "wait", text: `Next: ${best.k === 0 ? `a ${m.name} crew` : `${m.equip.toLowerCase()}`}`, why: `Affordable ${ago(best.t)}. The crews are making the material for it.`, mat: best.n, tier: best.k, doable: false };
    }
    const job = s.job ? JOB_BY.get(s.job.id) : null;
    return { kind: "wait", text: job ? `${job.name} is under way` : "The next job is starting", why: "Nothing to buy right now. The crews are working, and you can leave the tab open or come back later.", doable: false };
}

/** Do what the cue says. Returns a short line to show, or null when nothing was done. */
export function doCue(s: State, cue: Cue = nextCue(s)): string | null {
    if (!cue.doable) return null;
    if (cue.kind === "accept") return acceptChange(s) ? "Change order accepted." : null;
    if (cue.kind === "unlock") return unlock(s, s.open) ? `${MATS[cue.mat ?? 0].name} is on site.` : null;
    if (cue.kind === "buy" && cue.mat !== undefined && cue.tier !== undefined) return buy(s, cue.mat, cue.tier) ? `${MATS[cue.mat].name}: ${TIER_NAME[cue.tier]} bought.` : null;
    if (cue.kind === "perk" && cue.perk) return buyPerk(s, cue.perk) ? `${PERKS.find((p) => p.id === cue.perk)?.name ?? "Perk"} bought.` : null;
    if (cue.kind === "incorporate") return incorporate(s) > 0 ? "A new firm is incorporated." : null;
    return null;
}

// ---- welcome back --------------------------------------------------------------------------------------------------

export interface AwaySnap { cash: number; rep: number; amt: number[]; open: number; skyline: number; crews: number; firm: number }
export const awaySnap = (s: State): AwaySnap => ({ cash: s.cash, rep: s.rep, amt: s.amt.slice(), open: s.open, skyline: s.skyline.length, crews: s.crews.reduce((a, c) => a + c, 0), firm: s.firm });

export interface AwaySummary {
    secs: number;
    /** Time was cut at the offline limit. */
    capped: boolean;
    hours: number;
    jobs: { id: string; name: string; count: number }[];
    cash: number;
    rep: number;
    opened: string[];
    crews: number;
    /** Materials that grew the most, biggest first (at most 3). */
    mats: { name: string; gain: number }[];
}

export function awaySummary(before: AwaySnap, after: State, awaySecs: number, simulated: number, offlineCap: number): AwaySummary | null {
    if (simulated < 30) return null;
    const jobs = new Map<string, number>();
    for (const b of after.skyline.slice(before.skyline)) jobs.set(b.id, (jobs.get(b.id) ?? 0) + 1);
    const mats = after.amt.map((v, i) => ({ name: MATS[i].name, gain: v - (before.amt[i] ?? 0) })).filter((m) => m.gain > 0.5).sort((a, b) => b.gain - a.gain).slice(0, 3);
    return {
        secs: simulated,
        capped: awaySecs > offlineCap + 1,
        hours: Math.round(offlineCap / 3600),
        jobs: [...jobs].map(([id, count]) => ({ id, name: JOB_BY.get(id)?.name ?? id, count })),
        cash: after.cash - before.cash,
        rep: after.rep - before.rep,
        opened: MATS.slice(before.open, after.open).map((m) => m.name),
        crews: after.crews.reduce((a, c) => a + c, 0) - before.crews,
        mats,
    };
}
