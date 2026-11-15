// The `gb` console commands. Pure: they act on a State and return printed lines. The console (components/cm/console.tsx) runs
// them against the open game's live state, or against the saved game when the game is not open (same pattern as `sw`).
import { CITIES, JOB_BY, cityOf, MATS, PERKS, TIERS, TIER_LABELS, TUNE } from "./data";
import {
    acceptChange, buy, buyPerk, canIncorporate, charterGain, declineChange, effects, fmt, fmtAge, fmtCash, incorporate, inspectScore, jobFloors,
    jobMat, jobPhaseName, jobProgress, matName, overtime, overtimeCost, perkReady, queue, stageOf, tierCost, unlock, canUnlock, waitingFor, type State,
} from "./engine";

export interface GbLine { t: string; k?: "dim" | "hi" | "err" }
export interface GbResult { lines: GbLine[]; changed: boolean }

export const GB_SAVE_KEY = "gb-save-v1";
export const GB_PATH = "/creations/games/groundbreak";
export const GB_SUBS = ["stats", "hire", "unlock", "jobs", "change", "overtime", "perks", "incorporate", "skyline", "open"];

const l = (t: string, k?: GbLine["k"]): GbLine => ({ t, k });
const matIndex = (q: string) => !q ? -1 : MATS.findIndex((m) => m.id === q || m.sym.toLowerCase() === q || m.name.toLowerCase() === q || m.name.toLowerCase().startsWith(q));

export function gbCommand(s: State, args: string[]): GbResult {
    const f = effects(s);
    const sub = (args[0] ?? "stats").toLowerCase();
    const out = (lines: GbLine[], changed = false): GbResult => ({ lines, changed });

    if (sub === "stats") {
        const c = cityOf(s.firm);
        return out([
            l(`firm ${s.firm + 1} · ${c.name} · stage ${stageOf(s)} · ${fmtAge(s.age)} this firm`, "hi"),
            l(`${fmtCash(s.cash)} · ${fmt(s.rep)} rep · ${s.charter} charter · ${s.built} buildings · inspection score ${inspectScore(s, f).toFixed(2)}`),
            l(MATS.slice(0, s.open).map((m, i) => `${m.sym} ${fmt(s.amt[i], 1)}`).join("  ")),
            l(waitingFor(s) ? `${waitingFor(s)} Meanwhile: ${s.job?.rerun ? `repeat order, ${JOB_BY.get(s.job.id)?.name} ${Math.floor(jobProgress(s.job, f) * 100)}%` : "no repeat order yet"}.` : s.job ? `${JOB_BY.get(s.job.id)?.name}: ${jobPhaseName(s.job, f)} ${Math.floor(jobProgress(s.job, f) * 100)}%` : "starting the next job", "dim"),
        ]);
    }
    if (sub === "hire" || sub === "buy") {
        const n = matIndex((args[1] ?? "").toLowerCase());
        const k = Math.max(1, Math.min(TIERS, parseInt(args[2] ?? "1", 10) || 1));
        if (n < 0) return out([l(`gb hire <material> [1-${TIERS}] · ${MATS.map((m) => m.id).join(" ")}`, "dim")]);
        if (n >= s.open) return out([l(`${matName(n)} is not open yet.`, "err")]);
        const cost = tierCost(s, n, k - 1, f);
        if (!buy(s, n, k - 1, f)) {
            const cur = cost.cur === "cash" ? fmtCash(cost.amount) : `${fmt(cost.amount)} ${matName(cost.mat)}`;
            return out([l(`cannot buy ${matName(n)} ${TIER_LABELS[k - 1].toLowerCase()} yet: it costs ${cur}${k === 3 ? ` and needs ${TUNE.equipNeed} equipment levels` : ""}.`, "err")]);
        }
        return out([l(`${matName(n)}: ${TIER_LABELS[k - 1].toLowerCase()} bought.`)], true);
    }
    if (sub === "unlock") {
        if (!canUnlock(s, s.open)) return out([l(s.open >= MATS.length ? "every material is open." : `next material needs more ${matName(s.open - 1)}.`, "err")]);
        const name = matName(s.open);
        unlock(s, s.open);
        return out([l(`${name} opened.`, "hi")], true);
    }
    if (sub === "jobs") {
        return out(queue(s, 3).map((q, i) => l(`${i === 0 && s.job ? "now " : "next"} ${q.job.name} · stage ${q.job.stage}${q.ready ? "" : ` · needs ${matName(jobMat(q.job))} open`}`, i === 0 ? undefined : "dim")));
    }
    if (sub === "change") {
        const pick = (args[1] ?? "").toLowerCase();
        if (!s.change) return out([l("no change order open.", "dim")]);
        if (!pick) return out([l(`change order: +${Math.round(s.change.bonus * 100)}% pay for about ${s.change.secs} s more building and an inspection that asks ${s.change.score.toFixed(1)} more score. gb change yes to accept, gb change no to decline.`, "hi")]);
        if (pick === "no" || pick === "decline") { declineChange(s); return out([l("change order declined.")], true); }
        if (!acceptChange(s)) return out([l("cannot accept it now.", "err")]);
        return out([l("change order accepted: more materials, bigger payout.", "hi")], true);
    }
    if (sub === "overtime") {
        const c = overtimeCost(s);
        if (!c) return out([l("no inspection to speed up.", "dim")]);
        if (!overtime(s)) return out([l(`overtime costs ${fmtCash(c)}.`, "err")]);
        return out([l(`overtime paid, ${fmtCash(c)}.`)], true);
    }
    if (sub === "perks") {
        const id = (args[1] ?? "").toLowerCase();
        if (id) {
            if (!buyPerk(s, id)) return out([l("cannot buy that perk (check its id, cost and requirements).", "err")], false);
            return out([l(`${PERKS.find((p) => p.id === id)?.name} bought.`)], true);
        }
        return out([l(`${s.charter} charter to spend`, "hi"), ...PERKS.map((p) => l(`${p.id} ${p.name} · ${p.cost}${s.perks.includes(p.id) ? " · owned" : perkReady(s.perks, p) ? "" : " · locked"}`, s.perks.includes(p.id) ? "dim" : undefined))]);
    }
    if (sub === "incorporate") {
        if (!canIncorporate(s, f)) return out([l(`not enough reputation yet: you need ${TUNE.charterMinRep} for a first Charter point (you have ${fmt(s.repFirm)}).`, "err")]);
        if (args[1] !== "yes") return out([l(`incorporate now for ${charterGain(s, f)} charter? Cash, crews and materials reset; the skyline stays. Type: gb incorporate yes`, "hi")]);
        const n = incorporate(s);
        return out([l(`new firm in ${CITIES[s.firm % CITIES.length].name}. +${n} charter.`, "hi")], true);
    }
    if (sub === "skyline") {
        const by = new Map<string, number>();
        for (const b of s.skyline) by.set(b.id, (by.get(b.id) ?? 0) + 1);
        if (!by.size) return out([l("nothing built yet.", "dim")]);
        return out([...by].map(([id, n]) => l(`${JOB_BY.get(id)?.name ?? id} x${n}`)));
    }
    if (sub === "floors") {
        return out([l(s.job ? `${jobFloors(s.job, f)} floors up` : "no job running", "dim")]);
    }
    return out([l(`gb ${GB_SUBS.join(" | ")}`, "dim")]);
}
