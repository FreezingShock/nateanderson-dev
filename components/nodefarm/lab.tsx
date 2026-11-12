"use client";

import { useRef, type CSSProperties } from "react";
import { useFoldReveal } from "@/lib/nodefarm/cx";
import {
    LAB, LAB_SECS, LAB_TUNE, PAYLOADS, compileBlock, compileSecs, deployBlock, fmt, fmtTime, hasRecipe, intelRate, isArmed, labHas, labNode, labNodeOpen,
    labQueueMax, labSlots, labTotals, labVis, payloadCost, payloadDur, payloadV, statDef, type Derived, type PayloadDef, type PayloadId, type State,
} from "@/lib/nodefarm/engine";
import { TreeSprite } from "./tree-sprite";
import type { TreeModel } from "./tree";
import "@/app/camino/nodefarm-lab.css";

/**
 * Exploit Lab: the board zone (Intel, running payloads, the compile queue and the recipe list) and the research tree model
 * that the shared tree menu (tree.tsx) draws in its blue "lab" skin. Rules live in the engine (`labStep`, `compile`,
 * `deploy`, `buyLabNode`); this file only draws and calls back. Styles: app/camino/nodefarm-lab.css.
 */
export const LAB_BLUE = "#4aa3ff";
const SEC_COL = Object.fromEntries(LAB_SECS.map((x) => [x.id, x.color])) as Record<string, string>;
/** each payload's icon is its recipe node's sprite */
const sprite = (id: PayloadId) => `rx_${id}`;

/** The research tree as a model for the shared tree menu. */
export function labModel(s: State): TreeModel {
    return {
        theme: "lab", title: "lab // research", label: "Research tree", nodes: LAB, sections: LAB_SECS, owned: s.lab.nodes, wallet: s.lab.intel, unit: "Intel",
        open: (n) => labNodeOpen(s, labNode(n.id)), vis: (n) => labVis(s, labNode(n.id)), totals: () => labTotals(s), totalsLabel: "Lab gives",
        keptNote: "kept through Ascend", buyWord: "Research", prompt: "PS ~/lab>", respec: false,
        fogText: "Encrypted research. Finish a node next to it to read this one.",
        core: { kicker: "lab.root", name: "Exploit Lab", fx: "Intel buys research here. Most nodes unlock a recipe you compile on the board; the rest upgrade the lab. Research is kept through every Ascend.", quote: "The last operator left the bench set up. Most of the notes are in a language only the node speaks.", color: LAB_BLUE },
    };
}

/** How many research nodes you can buy right now. */
export const labReady = (s: State) => LAB.filter((n) => !labHas(s, n.id) && labNodeOpen(s, n) && s.lab.intel >= n.cost).length;

const KIND_WORD = { buff: "buff", charge: "charge", instant: "instant" } as const;
function effect(s: State, p: PayloadDef) {
    if (p.kind !== "buff") return p.blurb;
    // buffs show their current numbers (Obfuscation and Mutation change them)
    const x = +(1 + payloadV(s, p)).toFixed(2);
    const t = `${Math.round(payloadDur(s, p) / 60)} minutes`;
    return p.blurb.replace(/x[\d.]+|twice as fast/, p.id === "botnet" ? `x${x} as fast` : `x${x}`).replace(/for \d+ minutes/, `for ${t}`);
}

export function LabZone({ s, d, open, onToggle, onCompile, onCancel, onDeploy, onResearch, guided }: {
    s: State; d: Derived; open: boolean; onToggle: () => void; onCompile: (id: PayloadId) => void; onCancel: (i: number) => void; onDeploy: (id: PayloadId) => void; onResearch: () => void; guided?: boolean;
}) {
    const bodyIn = useRef<HTMLDivElement>(null);
    useFoldReveal(bodyIn, open);
    const rate = intelRate(s, d.bytesPerSec);
    const ready = labReady(s);
    const recipes = PAYLOADS.filter((p) => hasRecipe(s, p.id));
    const running = s.lab.run.filter((r) => r.left > 0);
    const slots = labSlots(s);
    const qmax = labQueueMax(s);
    const left = PAYLOADS.length - recipes.length;
    return (
        <article className="nf-row nf-lab" style={{ ["--c" as string]: LAB_BLUE }} data-open={open ? "true" : "false"} data-stat="lab" data-guide={guided ? "" : undefined}>
            <div className="nf-bar-t">
                <span>LAB // EXPLOIT LAB</span>
                <span className="nf-bar-s">+{fmt(rate)} intel/s</span>
                <button type="button" className="nf-fold" aria-expanded={open} aria-controls="nf-body-lab" aria-label={`${open ? "Minimize" : "Expand"} Exploit Lab`} onClick={onToggle}>
                    <i aria-hidden="true" />
                </button>
            </div>
            <div className="nf-body" id="nf-body-lab">
                <div className="nf-body-in" ref={bodyIn} inert={!open}>
                    <div className="nf-lab-top" data-cx-i="">
                        <div className="nf-lab-intel">
                            <span className="nf-lab-ps" aria-hidden="true">PS ~/lab&gt;</span>
                            <b>{fmt(s.lab.intel)}</b>
                            <span>Intel <small>+{fmt(rate)}/s · Reboots and event wins drop more</small></span>
                        </div>
                        <button type="button" className="nf-lab-go" data-ready={ready ? "" : undefined} onClick={onResearch} aria-haspopup="dialog">
                            <span aria-hidden="true">&gt; open ~/lab/research</span>
                            <b>{ready ? `${ready} ready` : `${s.lab.nodes.length}/${LAB.length}`}</b>
                            <span className="sr-only">Open the research tree. {ready ? `${ready} nodes ready to research.` : `${s.lab.nodes.length} of ${LAB.length} researched.`}</span>
                        </button>
                    </div>

                    {recipes.length === 0 ? (
                        <p className="nf-brief">Intel now runs alongside your Bytes. Spend it in the research tree to unlock recipes, compile them into payloads here, then deploy them for buffs. Start with <b>Packet sniffer</b> or <b>Rootkit</b>, both {LAB[0].cost} Intel.</p>
                    ) : (
                        <>
                            <div className="nf-lab-run" data-cx-i="" aria-label="Running payloads">
                                <span className="nf-lab-h">running <small>{running.length}/{slots} slots</small></span>
                                <ul>
                                    {Array.from({ length: slots }, (_, i) => {
                                        const r = running[i];
                                        if (!r) return <li key={i} className="nf-lab-slot" data-free=""><i aria-hidden="true">--</i><span>free slot</span></li>;
                                        const p = PAYLOADS.find((x) => x.id === r.id)!;
                                        const full = payloadDur(s, p);
                                        return (
                                            <li key={i} className="nf-lab-slot" style={{ ["--c" as string]: SEC_COL[p.sec], ["--f" as string]: Math.min(1, r.left / full) } as CSSProperties}>
                                                <TreeSprite sprite={sprite(p.id)} state="owned" scale={1} className="nf-lab-ic" />
                                                <span><b>{p.tag}</b> <small>{fmtTime(r.left)}</small></span>
                                                <i className="nf-lab-drain" aria-hidden="true" />
                                            </li>
                                        );
                                    })}
                                </ul>
                                {s.lab.armed.length > 0 && (
                                    <p className="nf-lab-armed">armed: {s.lab.armed.map((id) => (id === "logicbomb" ? "logic bomb → next Reboot x3" : "zero-click → next Ascend x1.25 AP")).join(" · ")}</p>
                                )}
                            </div>
                            <div className="nf-lab-q" data-cx-i="" aria-label="Compile queue">
                                <span className="nf-lab-h">compile queue <small>{s.lab.queue.length}/{qmax}</small></span>
                                {s.lab.queue.length === 0 ? (
                                    <p className="nf-lab-empty">// idle. Compile a recipe below; it keeps compiling while you are away.</p>
                                ) : (
                                    <ol>
                                        {s.lab.queue.map((q, i) => {
                                            const p = PAYLOADS.find((x) => x.id === q.id)!;
                                            const total = compileSecs(s, p);
                                            return (
                                                <li key={i} data-active={i === 0 ? "" : undefined} style={{ ["--c" as string]: SEC_COL[p.sec], ["--f" as string]: i === 0 ? 1 - q.left / total : 0 } as CSSProperties}>
                                                    <span className="nf-lab-qn">{i === 0 ? "gcc" : "wait"} {p.id}.c</span>
                                                    <i className="nf-lab-qbar" aria-hidden="true" />
                                                    <span className="nf-lab-qt">{fmtTime(i === 0 ? q.left : total)}</span>
                                                    <button type="button" className="nf-lab-x" onClick={() => onCancel(i)} aria-label={`Cancel ${p.name} and refund it`}><i aria-hidden="true" /></button>
                                                </li>
                                            );
                                        })}
                                    </ol>
                                )}
                            </div>
                            <ul className="nf-lab-list" data-cx-i="" aria-label="Recipes">
                                {recipes.map((p) => <Recipe key={p.id} s={s} d={d} p={p} onCompile={onCompile} onDeploy={onDeploy} />)}
                            </ul>
                        </>
                    )}
                    {left > 0 && <p className="nf-lab-more">// {left} more recipe{left > 1 ? "s" : ""} encrypted in the research tree</p>}
                </div>
            </div>
        </article>
    );
}

function Recipe({ s, d, p, onCompile, onDeploy }: { s: State; d: Derived; p: PayloadDef; onCompile: (id: PayloadId) => void; onDeploy: (id: PayloadId) => void }) {
    const c = payloadCost(s, p, d);
    const why = compileBlock(s, p.id, d);
    const stock = s.lab.stock[p.id] ?? 0;
    const dep = deployBlock(s, p.id);
    const run = s.lab.run.find((r) => r.id === p.id && r.left > 0);
    const mat = statDef(c.mat);
    const compileLabel = why === "queue" ? "Queue full" : why === "stock" ? "Stock full" : `Compile · ${fmt(c.intel)} IN + ${fmt(c.amount)} ${mat.short}`;
    const depLabel = run ? `+${fmtTime(payloadDur(s, p))}` : isArmed(s, p.id) ? "Armed" : dep === "slots" ? "Slots full" : "Deploy";
    return (
        <li style={{ ["--c" as string]: SEC_COL[p.sec] } as CSSProperties} data-run={run ? "" : undefined}>
            <TreeSprite sprite={sprite(p.id)} state="owned" scale={1} className="nf-lab-ic" />
            <span className="nf-lab-n">
                <b>{p.name}</b> <i>{KIND_WORD[p.kind]} · {fmtTime(compileSecs(s, p))}</i>
                <small>{effect(s, p)}</small>
            </span>
            <span className="nf-lab-stock" aria-label={`${stock} of ${LAB_TUNE.stockMax} in stock`}>
                {Array.from({ length: LAB_TUNE.stockMax }, (_, i) => <i key={i} data-f={i < stock ? "" : undefined} />)}
            </span>
            <span className="nf-lab-acts">
                <button type="button" className="nf-mini" disabled={!!why} onClick={() => onCompile(p.id)} title={why === "intel" ? `Needs ${fmt(c.intel)} Intel` : why === "mat" ? `Needs ${fmt(c.amount)} ${mat.name}` : undefined}>
                    {compileLabel}
                </button>
                <button type="button" className="nf-mini nf-lab-dep" disabled={!!dep} onClick={() => onDeploy(p.id)} aria-label={`Deploy ${p.name}. ${stock} in stock.`}>
                    {depLabel}
                </button>
            </span>
        </li>
    );
}

/** Running payloads for the HUD: one short tag and the time left each. */
export function LabHud({ s }: { s: State }) {
    const run = s.lab.run.filter((r) => r.left > 0);
    if (!run.length && !s.lab.armed.length) return null;
    return (
        <span className="nf-lab-hud" role="status" aria-label="Running payloads">
            {run.map((r) => {
                const p = PAYLOADS.find((x) => x.id === r.id)!;
                return <span key={r.id} style={{ ["--c" as string]: SEC_COL[p.sec] } as CSSProperties}>{p.tag} {fmtTime(r.left)}</span>;
            })}
            {s.lab.armed.map((id) => <span key={id} data-armed="">{PAYLOADS.find((x) => x.id === id)!.tag} armed</span>)}
        </span>
    );
}
