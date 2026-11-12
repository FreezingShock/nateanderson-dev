"use client";

import { useRef, useState, type CSSProperties } from "react";
import { BRANCHES, GOALS, GOAL_TIERS, STATS, TIER_NAMES, TREE, TUNE, amount, apEach, apOnAscend, canAscend, derive, droneCost, dronesOpen, fmt, goalDone, hasNode, intelRate, isUnlocked, LAB, LAB_SECS, PAYLOADS, hasRecipe, tiersDone, MATS, type MatId, type State, type StatId } from "@/lib/nodefarm/engine";
import { feedLine, nextStep, unlockInfo } from "@/lib/nodefarm/guide";
import { LORE } from "@/lib/nodefarm/lore";
import { NfIcon, type NfIconName } from "./icon";
import { DataLines, Frame, WinBanner } from "./win-kit";
import { LAB_BLUE, labReady } from "./lab";

type D = ReturnType<typeof derive>;
type Stand = "done" | "ready" | "next" | "locked";

/** Where each stat stands: done (running), ready (open but nothing built yet), next (the one being decrypted) or locked. */
function standing(s: State, id: StatId): "done" | "ready" | "locked" {
    if (!isUnlocked(s, id)) return "locked";
    if (id === "bytes") return "done";
    if (id === "mult") return s.life.presses > 0 || s.mult > 1 ? "done" : "ready";
    if (id === "reboot") return s.reboot > 0 || s.life.reboots > 0 ? "done" : "ready";
    return s.prod[id as MatId] > 0 ? "done" : "ready";
}
const TAG: Record<Stand, string> = { done: "online", ready: "open", next: "decrypting", locked: "encrypted" };

/** The whole farm on one screen (rebuilt 2026-11-12): the chain drawn as a signal tower, Bytes at the base and Chrono at the
 *  top, with YOU ARE HERE on the zone being worked on and a readout of the picked zone beside it. Then the systems beyond
 *  the chain (Ascend, Drones, Goals) and the prestige tree's sections. */
export function MapPanel({ s, d, onTree, onWin, onLab }: { s: State; d: D; onTree: () => void; onWin: (w: "ascend" | "goals") => void; onLab?: () => void }) {
    const step = nextStep(s, d);
    const raw = STATS.map((x) => standing(s, x.id));
    const frontier = raw.findIndex((x) => x !== "done");
    const stand: Stand[] = raw.map((x, i) => (x === "locked" && i === frontier ? "next" : x));
    const online = raw.filter((x) => x === "done").length;
    const goals = GOALS.filter((g) => goalDone(s, g)).length;
    const owned = TREE.filter((n) => hasNode(s, n.id)).length;
    const here = frontier < 0 ? STATS.length - 1 : frontier;
    const [sel, setSel] = useState<number | null>(null);
    const zone = useRef<HTMLElement>(null);
    const pick = sel ?? here;
    const def = STATS[pick];
    const st = stand[pick];
    const u = st === "next" || st === "locked" ? unlockInfo(s, def.id) : null;
    const rate = def.id === "bytes" ? d.bytesPerSec : (MATS as readonly string[]).includes(def.id) ? d.rates[def.id as MatId] : 0;
    const prev = STATS[pick - 1];

    return (
        <div className="nf-sys nf-wk nf-map">
            <WinBanner
                art="map"
                color="#2fd8e8"
                readout={[
                    ["~/map", ""],
                    ["ZONES", `${online} / ${STATS.length} online`],
                    ["TREE", `${owned} / ${TREE.length} nodes`],
                    ["GOALS", `${goals} / ${GOALS.length}`],
                    ...(s.lab.seen ? [["LAB", `${s.lab.nodes.length} / ${LAB.length} research`] as [string, string]] : []),
                ]}
            />

            <section className="nf-wk-here" data-cx-i="1" aria-label="Current step">
                <span className="nf-wk-here-k">YOU ARE HERE</span>
                <b>{step.title}</b>
                <span className="nf-bar sm" aria-hidden="true"><i style={{ width: `${Math.round(step.frac * 100)}%` }} /></span>
                <em>{Math.round(step.frac * 100)}%</em>
            </section>

            <div className="nf-wk-tower" data-cx-i="2">
                <ol className="nf-wk-chain" aria-label="Signal chain, Chrono at the top, Bytes at the base">
                    {STATS.map((x, i) => ({ x, i })).reverse().map(({ x, i }) => {
                        const k = stand[i];
                        return (
                            <li key={x.id} data-state={k} data-here={i === here ? "" : undefined} style={{ ["--c" as string]: x.color } as CSSProperties}>
                                <button type="button" aria-pressed={i === pick} onClick={() => { setSel(i); if (matchMedia("(max-width: 819px)").matches) setTimeout(() => zone.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 40); }} onPointerEnter={(e) => { if (e.pointerType === "mouse") setSel(i); }}>
                                    <span className="nf-wk-cn"><NfIcon name={k === "locked" ? "lock" : (x.id as NfIconName)} /></span>
                                    <span className="nf-wk-cl">
                                        <b>{k === "locked" ? "????" : x.name}</b>
                                        <small>{k === "locked" ? "encrypted" : LORE[x.id].zone}</small>
                                    </span>
                                    <span className="nf-wk-ct">{i === here ? "you are here" : TAG[k]}</span>
                                </button>
                            </li>
                        );
                    })}
                </ol>

                <article ref={zone} className="nf-wk-zone" data-state={st} style={{ ["--c" as string]: def.color } as CSSProperties} aria-live="polite">
                    <span className="nf-wk-p">zone.{String(pick).padStart(2, "0")} // {st === "locked" ? "encrypted" : LORE[def.id].code}</span>
                    <div className="nf-wk-zh">
                        <NfIcon name={st === "locked" ? "lock" : (def.id as NfIconName)} large />
                        <div>
                            <h3>{st === "locked" ? "Encrypted zone" : def.name}</h3>
                            <small>{st === "locked" ? `Opens after ${prev ? prev.name : "the one before"}.` : `${LORE[def.id].zone} // ${def.short}`}</small>
                        </div>
                    </div>
                    {st !== "locked" && <p className="nf-wk-zf">{LORE[def.id].flavor}</p>}
                    {st === "done" && (
                        <DataLines rows={[
                            ["held", fmt(amount(s, def.id))],
                            ...(rate > 0 ? [["output", `+${fmt(rate)}/s`] as [string, string]] : []),
                            ["feeds", feedLine(def.id, s, d)],
                        ]} />
                    )}
                    {st === "ready" && <DataLines rows={[["status", "open"], ["to do", def.id === "reboot" ? "press a Reboot button" : "build your first node"]]} />}
                    {u && st === "next" && (
                        <>
                            <DataLines rows={[["unlock", u.label], ["progress", `${fmt(u.cur)} / ${fmt(u.need)} ${u.unit}`]]} />
                            <span className="nf-bar" aria-hidden="true"><i style={{ width: `${u.frac * 100}%` }} /></span>
                        </>
                    )}
                    {st === "locked" && <DataLines rows={[["status", "encrypted"], ["key", `decrypt ${prev ? prev.name : "the zone below"} first`]]} />}
                </article>
            </div>

            <div className="nf-wk-cols nf-wk-beyond">
                <Frame i={3} color="#6bffc9" path="sys/ascend" title="Ascend" note={<>Wipes the run, keeps goals, perks, the tree and lab research, and pays AP. Each AP adds +{Math.round(apEach(s) * 100)}% to everything.</>}>
                    <span className="nf-bar sm" aria-hidden="true"><i style={{ width: `${Math.min(100, (s.aether / TUNE.ascendAether) * 100)}%` }} /></span>
                    <DataLines rows={[["status", canAscend(s) ? `ready, +${fmt(apOnAscend(s))} AP` : `${fmt(s.aether)} / ${fmt(TUNE.ascendAether)} Aether`]]} />
                    <button type="button" className="nf-wk-btn" onClick={() => onWin("ascend")}>Open Ascend</button>
                </Frame>
                <Frame i={4} color="#ff4d6d" path="sys/drones" title="Drones" note="Press buttons for you, even while you are away. Bought with Aether, one line per button tier.">
                    <DataLines rows={[["status", !dronesOpen(s) ? "mine your first Aether" : s.drones.some((x) => x > 0) ? `${s.drones.reduce((a, x) => a + x, 0)} levels built` : `first costs ${fmt(droneCost(s, 0))} AE`]]} />
                </Frame>
                <Frame i={5} color="#ffc53a" path="sys/goals" title="Goals" note={<>Each goal adds +{TUNE.achBonus * 100}% to everything, a finished tier +{TUNE.tierBonus * 100}%.</>}>
                    <span className="nf-bar sm" aria-hidden="true"><i style={{ width: `${(goals / GOALS.length) * 100}%` }} /></span>
                    <DataLines rows={[["done", `${goals} / ${GOALS.length}`], ["next tier", TIER_NAMES[Math.min(GOAL_TIERS, tiersDone(s) + 1)]]]} />
                    <button type="button" className="nf-wk-btn" onClick={() => onWin("goals")}>Open Goals</button>
                </Frame>
            </div>

            <Frame i={6} color="#2fd8e8" className="nf-wk-treefr" path="sys/tree" title="Prestige tree" aside={<>{fmt(s.ap)} AP to spend</>} note={`${owned} of ${TREE.length} nodes in five sections, bought with AP. Nothing in it resets.`}>
                <ul className="nf-wk-branches">
                    {BRANCHES.map((b) => {
                        const mine = TREE.filter((n) => n.branch === b.id);
                        const have = mine.filter((n) => hasNode(s, n.id)).length;
                        return (
                            <li key={b.id} style={{ ["--c" as string]: b.color } as CSSProperties}>
                                <b>{b.name}</b>
                                <span className="nf-bar sm" aria-hidden="true"><i style={{ width: `${(have / mine.length) * 100}%` }} /></span>
                                <em>{have}/{mine.length}</em>
                                <small>{b.blurb}</small>
                            </li>
                        );
                    })}
                </ul>
                <button type="button" className="nf-wk-btn is-main" onClick={onTree}>Open tree</button>
            </Frame>

            <Frame i={7} color={LAB_BLUE} className="nf-wk-treefr" path="sys/lab" title="Exploit Lab" aside={s.lab.seen ? <>{fmt(s.lab.intel)} Intel</> : <>opens with Silicon</>} note={s.lab.seen ? "Earn Intel, research recipes, compile them into payloads, deploy them for timed buffs. Research and stock survive Ascend." : "A second currency and a small research tree. It decrypts the moment Silicon comes online."}>
                {s.lab.seen ? (
                    <>
                        <ul className="nf-wk-branches">
                            {LAB_SECS.map((b) => {
                                const mine = LAB.filter((n) => n.branch === b.id);
                                const have = mine.filter((n) => s.lab.nodes.includes(n.id)).length;
                                return (
                                    <li key={b.id} style={{ ["--c" as string]: b.color } as CSSProperties}>
                                        <b>{b.name}</b>
                                        <span className="nf-bar sm" aria-hidden="true"><i style={{ width: `${(have / mine.length) * 100}%` }} /></span>
                                        <em>{have}/{mine.length}</em>
                                        <small>{b.blurb}</small>
                                    </li>
                                );
                            })}
                        </ul>
                        <DataLines rows={[["intel", `+${fmt(intelRate(s, d.bytesPerSec))}/s`], ["recipes", `${PAYLOADS.filter((p) => hasRecipe(s, p.id)).length} / ${PAYLOADS.length}`], ["ready", labReady(s) ? `${labReady(s)} to research` : "save up Intel"]]} />
                        {onLab && <button type="button" className="nf-wk-btn is-main" onClick={onLab}>Open lab</button>}
                    </>
                ) : (
                    <DataLines rows={[["status", "encrypted"], ["key", "bring Silicon online"]]} />
                )}
            </Frame>
        </div>
    );
}
