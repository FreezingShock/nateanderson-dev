"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { codeReveal } from "@/lib/nodefarm/cx";
import { scrambleNow } from "@/lib/motion/engine";
import { sfx } from "@/lib/sound/sounds";
import { PROTOS, fmt, fmtTime, statDef, type State } from "@/lib/nodefarm/engine";
import { END_COPY, END_STAGES, END_STEPS, END_TUNE, buildBlock, endOpen, endStage, endText, inheritedLog, lastZone, stageCost } from "@/lib/nodefarm/ending";
import { goalCounts } from "@/lib/nodefarm/records";
import { LOGS } from "@/lib/nodefarm/story";
import { NfIcon } from "./icon";
import "@/app/camino/nodefarm-ending.css";

/**
 * The ending: the final build (a section of the Handover window) and the end screen (full screen, CRT reveal).
 * Rules: lib/nodefarm/ending.ts. Styles: app/camino/nodefarm-ending.css (nf-end*). Art: public/naos/nodefarm/scene-ending.webp
 * (scripts/naos-art/nodefarm-ending-art.py). Rows carry data-cx-i for the shared code-reveal primitive.
 */
const SUN = "#ffd04a";
const FRAMES = 4;
const date = (ms: number) => new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

/** Five stage cells, then the next stage's two costs as data lines, and the build button. */
export function FinalBuild({ s, onBuild, onReplay }: { s: State; onBuild: () => void; onReplay: () => void }) {
    const stage = endStage(s);
    const done = stage >= END_STEPS;
    const z = lastZone();
    const def = statDef(z);
    const block = buildBlock(s);
    const c = stageCost(Math.min(stage, END_STEPS - 1));
    const have = s[z] as number;
    const last = stage === END_STEPS - 1;
    const [ask, setAsk] = useState(false);
    useEffect(() => { if (!ask) return; const t = window.setTimeout(() => setAsk(false), 4000); return () => window.clearTimeout(t); }, [ask]);
    const inh = inheritedLog(s);
    return (
        <section className="nf-end-build" data-cx-i="3" data-done={done ? "" : undefined} style={{ ["--c" as string]: SUN } as CSSProperties} aria-label="Final build">
            <i className="nf-end-br" aria-hidden="true" />
            <header className="nf-end-bh">
                <span data-cx-scr="">{END_COPY.buildHead}</span>
                <b>{done ? "COMPLETE" : `STAGE ${stage + 1}/${END_STEPS}`}</b>
            </header>
            <p className="nf-end-intro">{done ? END_COPY.buildDone : endText(END_COPY.buildIntro, s)}</p>
            <ol className="nf-end-cells" aria-label={`${stage} of ${END_STEPS} stages built`}>
                {END_STAGES.map((name, i) => (
                    <li key={name} data-st={i < stage ? "built" : i === stage ? "next" : "lock"}>
                        <span>{String(i + 1).padStart(2, "0")}</span>
                        <b>{name}</b>
                    </li>
                ))}
            </ol>
            {!done && (
                <>
                    <dl className="nf-end-cost">
                        <div style={{ ["--c" as string]: def.color } as CSSProperties}>
                            <dt><NfIcon name={z as "bytes"} />{def.name}</dt>
                            <dd><b>{fmt(Math.min(have, c.mat))}</b> / {fmt(c.mat)}</dd>
                            <i aria-hidden="true"><em style={{ width: `${Math.min(1, have / c.mat) * 100}%` }} /></i>
                        </div>
                        <div style={{ ["--c" as string]: "#ffc53a" } as CSSProperties}>
                            <dt>Keys</dt>
                            <dd><b>{Math.min(s.hand.keys, c.keys)}</b> / {c.keys}</dd>
                            <i aria-hidden="true"><em style={{ width: `${Math.min(1, s.hand.keys / c.keys) * 100}%` }} /></i>
                        </div>
                    </dl>
                    {!endOpen(s) && <p className="nf-end-note">Build one {def.name} producer this run to work on the build.</p>}
                    <button
                        type="button"
                        className="nf-end-go"
                        disabled={!!block}
                        onClick={() => {
                            if (block) return;
                            if (last && !ask) { setAsk(true); sfx("tab"); return; }
                            setAsk(false);
                            onBuild();
                        }}
                    >
                        {block ? block : last ? (ask ? "Confirm: wake node zero" : `Build ${END_STAGES[stage]} · wake node zero`) : `Build stage ${stage + 1}: ${END_STAGES[stage]}`}
                    </button>
                </>
            )}
            {done && (
                <div className="nf-end-after">
                    <dl className="nf-end-facts">
                        <div><dt>Woken</dt><dd>{s.end?.doneAt ? date(s.end.doneAt) : "now"}</dd></div>
                        <div><dt>Endings</dt><dd>{s.end?.stars ?? 1}</dd></div>
                    </dl>
                    <button type="button" className="nf-end-go nf-end-ghost" onClick={onReplay}>Replay the ending</button>
                </div>
            )}
            {inh && (
                <blockquote className="nf-end-inh">
                    <span>{END_COPY.inherited.replace("{n}", String(inh.n))}</span>
                    <p>{inh.text}</p>
                </blockquote>
            )}
        </section>
    );
}

/** Full-screen end screen: art, title, the operators, your shift in numbers, then your log and the two ways on. */
export function EndScreen({ s, reduced, onKeep, onNew }: { s: State; reduced: boolean; onKeep: (log: string) => void; onNew: (log: string) => void }) {
    const [host, setHost] = useState<Element | null>(null);
    const [log, setLog] = useState(() => s.end?.logs.at(-1)?.n === s.end?.stars ? s.end?.logs.at(-1)?.text ?? "" : "");
    const [ask, setAsk] = useState(false);
    const panel = useRef<HTMLElement>(null);
    const wrap = useRef<HTMLDivElement>(null);
    const first = useRef<HTMLTextAreaElement>(null);
    const leaving = useRef(false);
    useEffect(() => setHost(document.body), []);
    useEffect(() => {
        if (!host) return;
        const back = document.activeElement as HTMLElement | null;
        const html = document.documentElement;
        const prev = html.style.overflow;
        html.style.overflow = "hidden";
        sfx("nfAscend");
        if (!reduced) {
            codeReveal(panel.current, { dir: "in", style: "crt", rows: "[data-cx-i]", sound: false, ms: 900 });
            wrap.current?.querySelectorAll<HTMLElement>("[data-cx-scr]").forEach((t) => scrambleNow(t));
        }
        wrap.current?.focus();
        return () => { html.style.overflow = prev; back?.focus?.(); };
    }, [host, reduced]);
    useEffect(() => { if (!ask) return; const t = window.setTimeout(() => setAsk(false), 5000); return () => window.clearTimeout(t); }, [ask]);

    const leave = (fn: (log: string) => void) => {
        if (leaving.current) return;
        leaving.current = true;
        sfx("nfBuy", { tier: 3 });
        wrap.current?.setAttribute("data-out", "");
        if (reduced) return fn(log);
        codeReveal(panel.current, { dir: "out", style: "crt", rows: "[data-cx-i]" }).then(() => fn(log));
    };
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === "Escape" && document.activeElement !== first.current) { e.preventDefault(); leave(onKeep); } };
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    });

    const c = goalCounts(s);
    const stats: [string, string][] = [
        ["First boot", date(s.started)],
        ["Time played", fmtTime(s.life.secs)],
        ["Buttons pressed", fmt(s.life.presses)],
        ["Reboots", fmt(s.life.reboots)],
        ["Ascensions", fmt(s.life.ascends)],
        ["Handovers", fmt(s.hand.count)],
        ["Keys earned", fmt(s.hand.keysTotal)],
        ["Goals", `${c.goals}/${c.goalTotal}`],
        ["Secrets", `${c.secrets}/${c.secretTotal}`],
        ["Logs read", `${s.logs.length}/${LOGS.length}`],
    ];
    const n = Math.max(1, s.end?.stars ?? 1);

    if (!host) return null;
    return createPortal(
        <div ref={wrap} className="nf-aw nf-end" role="dialog" aria-modal="true" aria-labelledby="nf-end-title" tabIndex={-1} data-reduced={reduced ? "" : undefined}>
            <div className="nf-aw-bar">
                <span><span className="sr-only">{END_COPY.bar}</span><span aria-hidden="true" data-cx-scr="">{END_COPY.bar}</span></span>
                <span className="nf-aw-bar-r">{END_COPY.barRight}</span>
            </div>
            <div className="nf-aw-body">
                <section className="nf-aw-panel nf-end-panel" ref={panel}>
                    <i className="nf-aw-br" aria-hidden="true" />
                    <div className="nf-end-art" data-cx-i="0" aria-hidden="true" style={{ ["--frames" as string]: FRAMES } as CSSProperties}><i /></div>
                    <p className="nf-aw-kicker" data-cx-i="1">{END_COPY.kicker}</p>
                    <h2 id="nf-end-title" className="nf-aw-title" data-cx-i="2">{END_COPY.title}</h2>
                    <p className="nf-end-lead" data-cx-i="3">{endText(END_COPY.lead, s)}</p>

                    <h3 className="nf-end-h" data-cx-i="4" data-cx-scr="">{END_COPY.creditsHead}</h3>
                    <ol className="nf-end-ops" data-cx-i="5">
                        {PROTOS.map((p, i) => (
                            <li key={p.id} style={{ ["--c" as string]: p.color, ["--d" as string]: `${i * 140}ms` } as CSSProperties}>
                                <b>{p.op}</b>
                                <span>{p.flavor}</span>
                            </li>
                        ))}
                        {(s.end?.logs ?? []).filter((l) => l.n < n).map((l, i) => (
                            <li key={`p${l.n}-${l.at}`} style={{ ["--c" as string]: "#c8f6ff", ["--d" as string]: `${(PROTOS.length + i) * 140}ms` } as CSSProperties}>
                                <b>Operator {l.n}</b>
                                <span>{l.text}</span>
                            </li>
                        ))}
                        <li data-you="" style={{ ["--c" as string]: "#c8f6ff", ["--d" as string]: `${(PROTOS.length + 1) * 140}ms` } as CSSProperties}>
                            <b>{END_COPY.youName}</b>
                            <span>{log.trim() || END_COPY.youLine.replace("{n}", String(n))}</span>
                        </li>
                    </ol>

                    <h3 className="nf-end-h" data-cx-i="6" data-cx-scr="">{END_COPY.statsHead}</h3>
                    <dl className="nf-aw-facts nf-end-stats" data-cx-i="7">
                        {stats.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
                    </dl>

                    <label className="nf-end-log" data-cx-i="8">
                        <span className="nf-end-h">{END_COPY.logHead}</span>
                        <small>{END_COPY.logHint}</small>
                        <textarea ref={first} value={log} maxLength={END_TUNE.logMax} rows={3} onChange={(e) => setLog(e.target.value)} spellCheck />
                        <small className="nf-end-count" aria-hidden="true">{log.length}/{END_TUNE.logMax}</small>
                    </label>

                    <div className="nf-end-acts" data-cx-i="9">
                        <button type="button" className="nf-aw-go" onClick={() => leave(onKeep)}>{END_COPY.keep}</button>
                        <button type="button" className="nf-aw-go nf-end-next" data-ask={ask ? "" : undefined} onClick={() => { if (!ask) { setAsk(true); sfx("tab"); return; } leave(onNew); }}>
                            {ask ? END_COPY.nextConfirm : END_COPY.next}
                        </button>
                    </div>
                    <p className="nf-end-note" data-cx-i="9">{END_COPY.nextNote}</p>
                </section>
            </div>
        </div>,
        host,
    );
}
