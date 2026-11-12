"use client";

import { BRANCHES, GOALS, GOAL_TIERS, PERKS, STATS, TIER_NAMES, TREE, TUNE, amount, apOnAscend, canAscend, derive, droneCost, dronesOpen, fmt, goalDone, hasNode, isUnlocked, tiersDone, MATS, type MatId, type State, type StatId } from "@/lib/nodefarm/engine";
import { feedLine, nextStep, unlockInfo } from "@/lib/nodefarm/guide";
import { LORE } from "@/lib/nodefarm/lore";
import { NfIcon, type NfIconName } from "./icon";

type D = ReturnType<typeof derive>;

/** Where each stat stands: done (running), ready (open but nothing built yet) or locked. */
function standing(s: State, id: StatId): "done" | "ready" | "locked" {
    if (!isUnlocked(s, id)) return "locked";
    if (id === "bytes") return "done";
    if (id === "mult") return s.life.presses > 0 || s.mult > 1 ? "done" : "ready";
    if (id === "reboot") return s.reboot > 0 || s.life.reboots > 0 ? "done" : "ready";
    return s.prod[id as MatId] > 0 ? "done" : "ready";
}

/** The whole farm on one screen: the chain from Bytes to Chrono, the Ascend gate and Drones, and the prestige tree. */
export function MapPanel({ s, d, onTree, onWin }: { s: State; d: D; onTree: () => void; onWin: (w: "ascend" | "goals") => void }) {
    const step = nextStep(s, d);
    const stand = STATS.map((x) => standing(s, x.id));
    const frontier = stand.findIndex((x) => x !== "done");
    const total = STATS.length;
    const online = stand.filter((x) => x === "done").length;
    const goals = GOALS.filter((g) => goalDone(s, g)).length;
    const owned = TREE.filter((n) => hasNode(s, n.id)).length;

    return (
        <div className="nf-sys nf-map">
            <header className="nf-sys-h">
                <h3>Progress map</h3>
                <p>The whole farm in one place: what is running, what is next, and what each part does. {online} of {total} zones online, {owned} of {TREE.length} tree nodes, {goals} of {GOALS.length} goals.</p>
            </header>

            <p className="nf-mp-now" aria-label="Current step">
                <span>YOU ARE HERE</span> <b>{step.title}</b> <em>{Math.round(step.frac * 100)}%</em>
            </p>

            <h4 className="nf-mp-h">Signal chain <small>Bytes at the bottom, Chrono at the top. Each zone boosts the one before it.</small></h4>
            <ol className="nf-mp-chain" aria-label="Signal chain">
                {[...STATS].map((def, i) => ({ def, i })).reverse().map(({ def, i }) => {
                    const st = stand[i];
                    const isNext = i === frontier;
                    const u = st === "locked" ? unlockInfo(s, def.id) : null;
                    const rate = def.id === "bytes" ? d.bytesPerSec : (MATS as readonly string[]).includes(def.id) ? d.rates[def.id as MatId] : 0;
                    const prev = STATS[i - 1];
                    return (
                        <li key={def.id} className="nf-mp" data-state={st} data-next={isNext ? "" : undefined} style={{ ["--c" as string]: def.color }}>
                            <span className="nf-mp-rail" aria-hidden="true"><i /></span>
                            <span className="nf-mp-ic"><NfIcon name={st === "locked" ? "lock" : (def.id as NfIconName)} responsive /></span>
                            <div className="nf-mp-t">
                                <b>{def.name} <em>{def.short}</em></b>
                                <small>{LORE[def.id].zone} // {def.role}</small>
                            </div>
                            <div className="nf-mp-d">
                                {st === "done" && (
                                    <>
                                        <b>{fmt(amount(s, def.id))}{rate > 0 && <span> · +{fmt(rate)}/s</span>}</b>
                                        <small>{feedLine(def.id, s, d)}</small>
                                    </>
                                )}
                                {st === "ready" && (
                                    <>
                                        <b>Open</b>
                                        <small>{def.id === "reboot" ? "Press a Reboot button to begin." : "Build your first node."}</small>
                                    </>
                                )}
                                {u && isNext && (
                                    <>
                                        <b>Next · {Math.round(u.frac * 100)}%</b>
                                        <small>Unlocks at: {u.label.charAt(0).toLowerCase() + u.label.slice(1)}.</small>
                                        <span className="nf-bar sm" aria-hidden="true"><i style={{ width: `${u.frac * 100}%` }} /></span>
                                    </>
                                )}
                                {u && !isNext && (
                                    <>
                                        <b>Encrypted</b>
                                        <small>Opens after {prev ? prev.name : "the one before"}.</small>
                                    </>
                                )}
                            </div>
                            {isNext && <span className="nf-mp-tag">NEXT</span>}
                        </li>
                    );
                })}
            </ol>

            <h4 className="nf-mp-h">Beyond the chain <small>Where the run goes once it is running.</small></h4>
            <div className="nf-mp-cards">
                <section className="nf-mp-card" style={{ ["--c" as string]: "#6bffc9" }}>
                    <b>Ascend</b>
                    <p>Wipes the run, keeps goals, perks and the tree, and pays Ascension Points. Each AP adds +{TUNE.apBonus * 100}% to everything.</p>
                    <span className="nf-bar sm" aria-hidden="true"><i style={{ width: `${Math.min(100, (s.aether / TUNE.ascendAether) * 100)}%` }} /></span>
                    <small>{canAscend(s) ? `Ready: +${fmt(apOnAscend(s))} AP now.` : `${fmt(s.aether)} / ${fmt(TUNE.ascendAether)} Aether to open it.`}</small>
                    <button type="button" className="nf-mini" onClick={() => onWin("ascend")}>Open Ascend</button>
                </section>
                <section className="nf-mp-card" style={{ ["--c" as string]: "#2fd8e8" }}>
                    <b>Drones</b>
                    <p>Press buttons for you, even while you are away. Bought with Aether, one line per button tier.</p>
                    <small>{!dronesOpen(s) ? "Mine your first Aether to open the bay." : s.drones.some((x) => x > 0) ? (() => { const n = s.drones.reduce((a, x) => a + x, 0); return `${n} level${n === 1 ? "" : "s"} built.`; })() : `First Drone costs ${fmt(droneCost(s, 0))} Aether.`}</small>
                </section>
                <section className="nf-mp-card" style={{ ["--c" as string]: "#ffc53a" }}>
                    <b>Goals</b>
                    <p>Every goal adds +{TUNE.achBonus * 100}% to everything, and a finished tier adds +{TUNE.tierBonus * 100}%.</p>
                    <span className="nf-bar sm" aria-hidden="true"><i style={{ width: `${(goals / GOALS.length) * 100}%` }} /></span>
                    <small>{goals} of {GOALS.length} done, tier {Math.min(GOAL_TIERS, tiersDone(s) + 1)} ({TIER_NAMES[Math.min(GOAL_TIERS, tiersDone(s) + 1)]}) next.</small>
                    <button type="button" className="nf-mini" onClick={() => onWin("goals")}>Open Goals</button>
                </section>
            </div>

            <h4 className="nf-mp-h">Prestige tree <small>{owned} of {TREE.length} nodes, bought with AP in the tree menu.</small></h4>
            <div className="nf-mp-tree">
                {BRANCHES.map((b) => {
                    const mine = TREE.filter((n) => n.branch === b.id);
                    const have = mine.filter((n) => hasNode(s, n.id)).length;
                    return (
                        <section key={b.id} className="nf-mp-branch" style={{ ["--c" as string]: b.color }} aria-label={`${b.name} section`}>
                            <header><b>{b.name}</b><small>{have}/{mine.length}</small></header>
                            <p>{b.blurb}</p>
                            <span className="nf-bar sm" aria-hidden="true"><i style={{ width: `${(have / mine.length) * 100}%` }} /></span>
                        </section>
                    );
                })}
            </div>
            <div className="nf-mp-sel" data-state="open">
                <div>
                    <span>PRESTIGE TREE</span>
                    <b>{fmt(s.ap)} AP to spend</b>
                    <p>A web of {TREE.length} upgrades in five sections. Pan and zoom to explore it. Nothing in it resets.</p>
                </div>
                <div className="nf-mp-sel-a">
                    <button type="button" className="nf-mini" onClick={onTree}>Open tree</button>
                </div>
            </div>
            {PERKS.length > 0 && <p className="nf-mp-foot">Perks (Power core, Autoloader, Standby cells and more) are bought in the Ascend window.</p>}
        </div>
    );
}
