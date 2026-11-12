"use client";

import { useState } from "react";
import { BRANCHES, GOALS, GOAL_TIERS, PERKS, STATS, TIER_NAMES, TREE, TUNE, amount, apOnAscend, canAscend, derive, droneCost, dronesOpen, fmt, goalDone, hasNode, isUnlocked, nodeOpen, tiersDone, treeNode, MATS, type MatId, type State, type StatId, type TreeNode } from "@/lib/nodefarm/engine";
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

const depthOf = (n: TreeNode): number => (n.req.length ? 1 + Math.max(...n.req.map((r) => depthOf(treeNode(r)))) : 0);

/** The whole farm on one screen: the chain from Bytes to Chrono, the Ascend gate and Drones, and the prestige tree. */
export function MapPanel({ s, d, onNode, onWin }: { s: State; d: D; onNode: (id: string) => void; onWin: (w: "ascend" | "goals") => void }) {
    const [sel, setSel] = useState<string>("");
    const step = nextStep(s, d);
    const stand = STATS.map((x) => standing(s, x.id));
    const frontier = stand.findIndex((x) => x !== "done");
    const total = STATS.length;
    const online = stand.filter((x) => x === "done").length;
    const goals = GOALS.filter((g) => goalDone(s, g)).length;
    const cur = (sel ? TREE.find((n) => n.id === sel) : undefined) ?? TREE.find((n) => !hasNode(s, n.id) && nodeOpen(s, n)) ?? TREE[0];
    const curState = hasNode(s, cur.id) ? "owned" : nodeOpen(s, cur) ? "open" : "locked";
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

            <h4 className="nf-mp-h">Prestige tree <small>Bought with AP in the Ascend window. Tap a node to read it.</small></h4>
            <div className="nf-mp-tree">
                {BRANCHES.map((b) => (
                    <section key={b.id} className="nf-mp-branch" style={{ ["--c" as string]: b.color }} aria-label={`${b.name} branch`}>
                        <header><b>{b.name}</b><small>{TREE.filter((n) => n.branch === b.id && hasNode(s, n.id)).length}/{TREE.filter((n) => n.branch === b.id).length}</small></header>
                        <ol>
                            {TREE.filter((n) => n.branch === b.id).map((n) => {
                                const st = hasNode(s, n.id) ? "owned" : nodeOpen(s, n) ? "open" : "locked";
                                return (
                                    <li key={n.id} style={{ ["--d" as string]: depthOf(n) }}>
                                        <button type="button" className="nf-mp-node" data-state={st} aria-pressed={cur.id === n.id} onClick={() => setSel(n.id)} onPointerEnter={(e) => { if (e.pointerType === "mouse") setSel(n.id); }}>
                                            <i aria-hidden="true" />
                                            <span>{n.name}</span>
                                            <small>{st === "owned" ? "owned" : `${n.cost} AP`}</small>
                                        </button>
                                    </li>
                                );
                            })}
                        </ol>
                    </section>
                ))}
            </div>
            <div className="nf-mp-sel" data-state={curState} style={{ ["--c" as string]: BRANCHES.find((b) => b.id === cur.branch)?.color }} aria-live="polite">
                <div>
                    <span>{BRANCHES.find((b) => b.id === cur.branch)?.name} // {curState === "owned" ? "OWNED" : curState === "open" ? "AVAILABLE" : "LOCKED"}</span>
                    <b>{cur.name}</b>
                    <p>{cur.blurb}{cur.req.length > 0 && ` Needs ${cur.req.map((r) => treeNode(r).name).join(" and ")}.`}</p>
                </div>
                <div className="nf-mp-sel-a">
                    <small>{cur.cost} AP · you have {fmt(s.ap)}</small>
                    <button type="button" className="nf-mini" disabled={curState !== "open" || s.ap < cur.cost} onClick={() => onNode(cur.id)}>
                        {curState === "owned" ? "Owned" : curState === "locked" ? "Locked" : `Buy · ${cur.cost} AP`}
                    </button>
                </div>
            </div>
            {PERKS.length > 0 && <p className="nf-mp-foot">Perks (Power core, Autoloader, Standby cells and more) are bought in the Ascend window too.</p>}
        </div>
    );
}
