// The Groundbreak console. Pure: acts on a State and returns printed lines.
import { JOBS, MATS, bid, buy, canIncorporate, charterGain, fmt, incorporate, money, rate, refreshBids, stageOf, tierCost, unlockNext, type State, type Tier } from "./engine";

export interface Line { t: string; k?: "dim" | "hi" | "err" }
const l = (t: string, k?: Line["k"]): Line => ({ t, k });
const matIndex = (q: string) => MATS.findIndex((m) => m.id === q || m.name.toLowerCase() === q || m.name.toLowerCase().startsWith(q));

export function runCommand(s: State, line: string): { lines: Line[]; changed: boolean } {
    const [cmd, ...a] = line.trim().toLowerCase().replace(/^gb\s+/, "").split(/\s+/);
    const out = (lines: Line[], changed = false) => ({ lines, changed });
    if (cmd === "help") return out([l("stats · hire <mat> · equip <mat> · method <mat> · unlock · bids · bid <job> · skyline · incorporate", "dim")]);
    if (cmd === "stats") return out([l(`${money(s.cash)} · rep ${fmt(s.rep)} · stage ${stageOf(s)} · firm ${s.firm} · charter ${s.charter}`, "hi"), l(MATS.slice(0, s.open).map((m, i) => `${m.name} ${fmt(s.amt[i])} (${fmt(rate(s, i))}/s)`).join(" · "), "dim")]);
    if (cmd === "hire" || cmd === "equip" || cmd === "method") {
        const i = matIndex(a[0] ?? "");
        if (i < 0 || i >= s.open) return out([l(`unknown or locked material. try: ${MATS.slice(0, s.open).map((m) => m.id).join(" ")}`, "err")]);
        const t: Tier = cmd === "hire" ? 0 : cmd === "equip" ? 1 : 2;
        const cost = tierCost(s, i, t);
        return buy(s, i, t) ? out([l(`${MATS[i].name} ${cmd} bought, -${money(cost)}`)], true) : out([l(`cannot ${cmd} ${MATS[i].name} (${money(cost)})`, "err")]);
    }
    if (cmd === "unlock") return unlockNext(s) ? out([l(`${MATS[s.open - 1].name} is on site`, "hi")], true) : out([l("not enough of the last material yet", "err")]);
    if (cmd === "bids") return out(s.bids.length ? s.bids.map((id) => l(`${id} · ${JOBS.find((j) => j.id === id)!.name}`)) : [l("no open bids", "dim")]);
    if (cmd === "bid") { refreshBids(s); return bid(s, a[0] ?? "") ? out([l(`bid placed on ${a[0]}`, "hi")], true) : out([l("cannot bid: unknown job, a job is running, or not enough cash", "err")]); }
    if (cmd === "skyline") return out([l(`${s.built.length} buildings across ${s.firm} firm${s.firm > 1 ? "s" : ""}`)]);
    if (cmd === "incorporate") return incorporate(s) ? out([l(`new firm. charter ${s.charter}`, "hi")], true) : out([l(canIncorporate(s) ? "failed" : `needs 500 rep and more charter (would be ${charterGain(s)})`, "err")]);
    return out([l("unknown command. help", "err")]);
}
