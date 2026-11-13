"use client";

import { useContext, useRef, type CSSProperties } from "react";
import { useFoldReveal } from "@/lib/nodefarm/cx";
import {
    DRONE_SECS, DRONE_TREE, DRONE_TUNE, MODS, POSTABLE, ROMAN, TIERS, TUNE, cores, coresSpent, droneCost, droneFx, droneMax, droneNode, droneNodeOpen,
    droneRate, droneTreeTotals, droneVis, dronesOpen, fmt, fmtTime, isUnlocked, masteredZones, masteryMul, masteryRanks, modBlock, modCost, modMax, nextRankAt, partsRate,
    postOf, postX, rigMasteryCut, statDef, svcRate, zoneRank, zoneSvc, type ButtonStat, type State,
} from "@/lib/nodefarm/engine";
import { DRONE_NAMES as NAMES, droneTip } from "@/lib/nodefarm/content/guide";
import { TipCtx } from "../windows/guide";
import type { TreeModel } from "../tree/tree";
import "@/app/camino/nodefarm/hangar.css";

/** Each Drone's colour matches the ramp its sprite is drawn in (scripts/naos-art/nodefarm-sprites.py) and its berth light. */
export const DRONE_COLOURS = ["#2fd8e8", "#b6f04a", "#f08a3c", "#7aa2ff", "#e08cff", "#ffc53a"];
export const HANGAR_AMBER = "#ffb14a";

/** The drone tree as a model for the shared tree menu (amber "hangar" skin, nodefarm/hangar.css). */
export function droneModel(s: State): TreeModel {
    return {
        theme: "hangar", title: "hangar // drone tree", label: "Drone tree", nodes: DRONE_TREE, sections: DRONE_SECS, owned: s.dr.nodes, wallet: cores(s), unit: "Cores",
        open: (n) => droneNodeOpen(s, droneNode(n.id)), vis: (n) => droneVis(s, droneNode(n.id)), totals: () => droneTreeTotals(s), totalsLabel: "Hangar gives",
        spent: () => coresSpent(s),
        keptNote: "kept through Ascend", buyWord: "Fit", prompt: "~/hangar $", respec: true, fitMin: [0.34, 0.5],
        fogText: "Crated. Fit a node next to it to open this one.",
        core: { kicker: "hangar.root", name: "Drone hangar", fx: "Cores fit nodes here. You earn one Core for every zone mastery rank your Drones reach. The tree is kept through every Ascend, and respec is free.", quote: "Six berths, six frames. The last operator left the lights on for them.", color: HANGAR_AMBER },
    };
}

/** Drone tree nodes you can fit right now. */
export const droneReady = (s: State) => DRONE_TREE.filter((n) => !s.dr.nodes.includes(n.id) && droneNodeOpen(s, n) && cores(s) >= n.cost).length;

const MOD_SHORT = ["SERVO", "UPLINK", "REACH", "TUNER", "SALVAGE"];

/** The Drone hangar: berths with live Drones, the roster (build, post, mod), zone mastery and the way into the drone tree. */
export function DroneBay({ s, open, onToggle, onBuy, onPost, onMod, onTree, guided }: {
    s: State; open: boolean; onToggle: () => void; onBuy: (tier: number) => void; onPost: (tier: number, st: ButtonStat | null) => void; onMod: (tier: number, mod: number) => void; onTree: () => void; guided?: number;
}) {
    const tips = useContext(TipCtx);
    const bodyIn = useRef<HTMLDivElement>(null);
    useFoldReveal(bodyIn, open);
    if (!dronesOpen(s)) {
        return (
            <article className="nf-row nf-locked" style={{ ["--c" as string]: "#6bffc9" }}>
                <span className="nf-plate"><span className="nf-sp-d" aria-hidden="true" style={{ ["--k" as string]: 0 } as CSSProperties} /></span>
                <div>
                    <b>ENCRYPTED // Drone hangar</b>
                    <small>Mine your first Aether to decrypt.</small>
                </div>
            </article>
        );
    }
    const total = s.drones.reduce((a, b) => a + b, 0);
    const press = s.drones.reduce((a, _, k) => a + droneRate(s, k) * (postOf(s, k) ? postX(s, k) : 1), 0);
    const built = total > 0;
    const zones = POSTABLE.filter((st) => isUnlocked(s, st));
    const ranks = masteryRanks(s);
    const ready = droneReady(s);
    const treeSeen = ranks > 0 || s.dr.nodes.length > 0;
    const pr = partsRate(s);
    return (
        <article className="nf-row nf-dr nf-hg" style={{ ["--c" as string]: "#6bffc9" }} data-open={open ? "true" : "false"} data-guide={guided !== undefined ? "" : undefined} data-stat="drones">
            <div className="nf-bar-t">
                <span>HANGAR // DRONES</span>
                <span className="nf-bar-s">{built ? `${fmt(press)} presses/s` : "idle"}</span>
                <button type="button" className="nf-fold" aria-expanded={open} aria-controls="nf-body-drones" aria-label={`${open ? "Minimize" : "Expand"} Drone hangar`} onClick={onToggle}>
                    <i aria-hidden="true" />
                </button>
            </div>
            <div className="nf-body" id="nf-body-drones">
                <div className="nf-body-in" ref={bodyIn} inert={!open}>
                    <Berths s={s} />
                    <div className="nf-hg-top" data-cx-i="">
                        <dl className="nf-hg-wallet">
                            <div><dt>Parts</dt><dd>{fmt(s.dr.parts)}</dd><small>{pr > 0 ? `+${fmt(pr)}/s from Drone presses` : "Drones salvage Parts as they press"}</small></div>
                            <div><dt>Cores</dt><dd>{fmt(cores(s))}</dd><small>{ranks} mastery {ranks === 1 ? "rank" : "ranks"} earned</small></div>
                        </dl>
                        <button type="button" className="nf-hg-go" data-ready={ready ? "" : undefined} disabled={!treeSeen} onClick={onTree} aria-haspopup="dialog">
                            <span>{treeSeen ? "./drone-tree" : "./drone-tree  // reach a mastery rank"}</span>
                            <b>{treeSeen ? (ready ? `${ready} ready` : `${s.dr.nodes.length}/${DRONE_TREE.length}`) : "locked"}</b>
                        </button>
                    </div>
                    <p className="nf-brief">A Drone works only once it is <b>posted</b> to a zone. It presses its tier&apos;s button there, x{fmt(DRONE_TUNE.postX + droneFx(s).postX)} as fast, and builds that zone&apos;s mastery: a permanent boost, cheaper rig upgrades there, and a Core per rank. A posted Drone also makes that zone&apos;s good events last longer and patches its faults faster. Mods and Parts reset on Ascend; postings, mastery and the drone tree stay. Away, Drones run at {Math.round(Math.min(1, TUNE.drone.offline + droneFx(s).off) * 100)}% speed or better. A new Drone posts itself to the newest zone nobody works; scripts do the rest of the automating.</p>
                    <ul className="nf-dr-list">
                        {Array.from({ length: TIERS }, (_, k) => {
                            const lvl = s.drones[k];
                            const maxed = lvl >= droneMax(s);
                            const cost = droneCost(s, k);
                            const afford = !maxed && s.aether >= cost;
                            const post = postOf(s, k);
                            const want = s.dr.post[k];
                            const rate = droneRate(s, k) * (post ? postX(s, k) : 1);
                            return (
                                <li key={k} style={{ ["--c" as string]: DRONE_COLOURS[k] } as CSSProperties} data-on={lvl > 0 ? "" : undefined} data-cx-i="">
                                    <div
                                        className="nf-hg-head"
                                        onPointerEnter={(e) => { if (e.pointerType === "mouse") tips.show(e.currentTarget, () => droneTip(s, k), { guided: guided === k }); }}
                                        onPointerLeave={(e) => { if (e.pointerType === "mouse") tips.hide(e.currentTarget); }}
                                        onPointerDown={(e) => { if (e.pointerType !== "mouse") tips.show(e.currentTarget, () => droneTip(s, k), { ms: 2600, guided: guided === k }); }}
                                        onFocus={(e) => { if ((e.target as HTMLElement).matches(":focus-visible")) tips.show(e.currentTarget, () => droneTip(s, k), { guided: guided === k }); }}
                                        onBlur={(e) => tips.hide(e.currentTarget)}
                                    >
                                        <span className="nf-sp-d" aria-hidden="true" data-on={lvl > 0 ? "" : undefined} style={{ ["--k" as string]: k } as CSSProperties} />
                                        <span className="nf-dr-n">
                                            <b>T{k + 1} {NAMES[k]}</b>
                                            <small>{lvl > 0 ? `${post ? `${fmt(rate)} presses/s · posted to ${statDef(post).name}` : want ? `${statDef(want).name} locked, docked` : "docked, pick a zone"}` : "not built"}</small>
                                        </span>
                                        <span className="nf-dr-pips" aria-label={`Level ${lvl} of ${droneMax(s)}`}>
                                            {Array.from({ length: droneMax(s) }, (_, i) => <i key={i} data-f={i < lvl ? "" : undefined} />)}
                                        </span>
                                        <button type="button" className="nf-mini" data-guide={guided === k ? "" : undefined} disabled={!afford} onClick={() => onBuy(k)} aria-label={maxed ? `${NAMES[k]} maxed` : `${lvl ? "Upgrade" : "Build"} ${NAMES[k]} for ${fmt(cost)} Aether`}>
                                            {maxed ? "Max" : `${lvl ? "Upgrade" : "Build"} · ${fmt(cost)} AE`}
                                        </button>
                                    </div>
                                    {lvl > 0 && (
                                        <div className="nf-hg-ctl">
                                            <label className="nf-hg-post">
                                                <span>Posting</span>
                                                <select value={want ?? ""} onChange={(e) => onPost(k, (e.target.value || null) as ButtonStat | null)} aria-label={`Posting for T${k + 1} ${NAMES[k]}`}>
                                                    <option value="">Docked (does nothing)</option>
                                                    {zones.map((st) => <option key={st} value={st}>{statDef(st).name} · mastery {ROMAN[zoneRank(s, st)] || "0"}</option>)}
                                                    {want && !zones.includes(want) && <option value={want}>{statDef(want).name} (locked)</option>}
                                                </select>
                                            </label>
                                            <div className="nf-hg-mods" role="group" aria-label={`Mods for ${NAMES[k]}`}>
                                                {MODS.map((m, i) => {
                                                    const ml = s.dr.mods[k][i];
                                                    const mx = modMax(s, i);
                                                    const why = modBlock(s, k, i);
                                                    const c = modCost(s, k, i);
                                                    return (
                                                        <button key={m.id} type="button" className="nf-hg-mod" disabled={!!why} onClick={() => onMod(k, i)} title={`${m.name}: ${m.blurb}`}
                                                            aria-label={why === "max" ? `${m.name} maxed at ${mx}` : `${m.name} level ${ml} of ${mx}, ${m.blurb}. Costs ${fmt(c)} Parts`}>
                                                            <b>{MOD_SHORT[i]}</b>
                                                            <span className="nf-hg-lv" aria-hidden="true">{Array.from({ length: mx }, (_, j) => <i key={j} data-f={j < ml ? "" : undefined} />)}</span>
                                                            <small>{why === "max" ? "max" : `${fmt(c)} P`}</small>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                    {built && <Mastery s={s} zones={zones} />}
                </div>
            </div>
        </article>
    );
}

/** The six berths with the live Drones: empty and docked ones sit in their cradle, posted ones fly sorties. */
function Berths({ s }: { s: State }) {
    return (
        <div className="nf-hg-bay" aria-hidden="true">
            {Array.from({ length: TIERS }, (_, k) => {
                const lvl = s.drones[k];
                const post = postOf(s, k);
                const mode = lvl <= 0 ? "empty" : post ? "out" : "dock";
                // a sortie's cycle follows the real press rate: faster postings fly faster (2.2 s at the fastest, 6 s at the slowest)
                const pace = post ? Math.max(2.2, Math.min(6, 6 / Math.sqrt(Math.max(1, droneRate(s, k) * postX(s, k))))) : 6;
                return (
                    <span key={k} className="nf-hg-berth" data-mode={mode} style={{ ["--c" as string]: DRONE_COLOURS[k], ["--z" as string]: post ? statDef(post).color : DRONE_COLOURS[k], ["--k" as string]: k, ["--dur" as string]: `${pace.toFixed(2)}s` } as CSSProperties}>
                        {lvl > 0 && <span className="nf-hg-fly"><span className="nf-sp-d" data-on="" style={{ ["--k" as string]: k } as CSSProperties} /></span>}
                        <span className="nf-hg-tag" data-long={lvl <= 0 || !post ? "" : undefined} data-short={lvl <= 0 ? `T${k + 1}` : "DCK"}>{lvl <= 0 ? `T${k + 1} empty` : post ? `→ ${statDef(post).short}` : "docked"}</span>
                    </span>
                );
            })}
        </div>
    );
}

/** Zone mastery: one plain data line per open zone with its rank, progress to the next and its boost. */
function Mastery({ s, zones }: { s: State; zones: ButtonStat[] }) {
    return (
        <section className="nf-hg-ms" data-cx-i="">
            <h4 className="nf-hg-h">zone mastery <small>ranks are permanent · each rank is one Core{masteredZones(s) ? ` · ${masteredZones(s)} mastered, every Drone +${Math.round(masteredZones(s) * DRONE_TUNE.masteredSpeed * 100)}%` : " · a zone at V speeds up every Drone"}</small></h4>
            <ol>
                {zones.map((st) => {
                    const r = zoneRank(s, st);
                    const at = nextRankAt(s, st);
                    const prev = r ? DRONE_TUNE.rankAt[r - 1] : 0;
                    const sv = zoneSvc(s, st);
                    const f = at ? Math.max(0, Math.min(1, (sv - prev) / (at - prev))) : 1;
                    const rate = svcRate(s, st);
                    const here = Array.from({ length: TIERS }, (_, k) => k).filter((k) => s.drones[k] > 0 && postOf(s, k) === st);
                    const def = statDef(st);
                    return (
                        <li key={st} style={{ ["--c" as string]: def.color, ["--f" as string]: f } as CSSProperties} data-r={r} data-live={rate > 0 ? "" : undefined}>
                            <b>{def.name}</b>
                            <span className="nf-hg-rk" aria-label={`Rank ${r} of 5`}>{[1, 2, 3, 4, 5].map((i) => <i key={i} data-f={i <= r ? "" : undefined} />)}</span>
                            <span className="nf-hg-bar"><i /></span>
                            <small>{at ? (rate > 0 ? `${ROMAN[r + 1]} in ${fmtTime((at - sv) / rate)}` : `${fmt(sv)} / ${fmt(at)}`) : "mastered"}</small>
                            <em title={r ? `Output x${fmt(masteryMul(s, st))}, rig upgrades -${Math.round((1 - rigMasteryCut(s, st)) * 100)}%` : undefined}>x{fmt(masteryMul(s, st))}</em>
                            <span className="nf-hg-here">{here.map((k) => <i key={k} style={{ ["--c" as string]: DRONE_COLOURS[k] } as CSSProperties} title={`T${k + 1} ${NAMES[k]}`} />)}</span>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}
