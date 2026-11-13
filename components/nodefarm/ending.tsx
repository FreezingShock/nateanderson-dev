"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { codeReveal } from "@/lib/nodefarm/cx";
import { scrambleNow } from "@/lib/motion/engine";
import { sfx } from "@/lib/sound/sounds";
import { PROTOS, fmt, fmtTime, statDef, type State } from "@/lib/nodefarm/engine";
import { END_COLORS, END_COPY, END_SOCKETS, END_STAGES, END_STAGE_LINES, END_STEPS, END_TUNE, buildBlock, endOpen, endStage, endText, inheritedLog, lastZone, stageCost } from "@/lib/nodefarm/ending";
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

/** A pixel key, filled when held. */
const KeyPip = ({ on }: { on: boolean }) => (
    <svg className="nf-end-key" data-on={on ? "" : undefined} viewBox="0 0 9 5" aria-hidden="true" shapeRendering="crispEdges">
        <path d="M0 1h1v3H0zM1 0h2v1H1zM1 4h2v1H1zM3 1h1v3H3zM4 2h5v1H4zM6 3h1v1H6zM8 3h1v2H8z" />
    </svg>
);

const POUR_MS = 1400;

/** The Final build, drawn as a cut-away of node zero over the buried sun: tap a socket to read it, hold to pour power
 *  into the next one. The art steps one frame per stage built; while you hold, the next frame rises from the floor. */
export function FinalBuild({ s, onBuild, onReplay }: { s: State; onBuild: () => void; onReplay: () => void }) {
    const stage = endStage(s);
    const done = stage >= END_STEPS;
    const z = lastZone();
    const def = statDef(z);
    const block = buildBlock(s);
    const [pick, setPick] = useState<number | null>(null);
    const sel = pick ?? Math.min(stage, END_STEPS - 1);
    const c = stageCost(sel);
    const have = s[z] as number;
    const st = sel < stage ? "built" : sel === stage ? "next" : "sealed";
    const [hold, setHold] = useState(false);
    const t = useRef<number | undefined>(undefined);
    const stop = () => { window.clearTimeout(t.current); t.current = undefined; setHold(false); };
    const start = () => {
        if (block || t.current) return;
        setPick(null);
        setHold(true);
        sfx("tab");
        t.current = window.setTimeout(() => { t.current = undefined; setHold(false); onBuild(); }, POUR_MS);
    };
    useEffect(() => () => window.clearTimeout(t.current), []);
    const inh = inheritedLog(s);
    const keysShown = Math.min(c.keys, 12);
    return (
        <section className="nf-end-build" data-cx-i="3" data-done={done ? "" : undefined} aria-label="Final build">
            <i className="nf-end-br" aria-hidden="true" />
            <header className="nf-end-bh">
                <span data-cx-scr="">{END_COPY.buildHead}</span>
                <b>{done ? "AWAKE" : `${stage}/${END_STEPS} SOCKETS LIVE`}</b>
            </header>
            <div className="nf-end-sch" data-hold={hold ? "" : undefined} style={{ ["--f" as string]: stage, ["--pour" as string]: `${POUR_MS}ms` } as CSSProperties}>
                <i className="nf-end-sch-art" aria-hidden="true" />
                {!done && <i className="nf-end-sch-pour" aria-hidden="true" style={{ ["--n" as string]: stage + 1 } as CSSProperties} />}
                <span className="nf-end-sch-tag" aria-hidden="true">{def.name.toUpperCase()} · {fmt(have)}</span>
                {END_STAGES.map((name, i) => (
                    <button
                        key={name}
                        type="button"
                        className="nf-end-sock"
                        data-st={i < stage ? "built" : i === stage ? "next" : "sealed"}
                        data-sel={sel === i ? "" : undefined}
                        style={{ left: `${END_SOCKETS[i][0]}%`, top: `${END_SOCKETS[i][1]}%`, ["--c" as string]: END_COLORS[i] } as CSSProperties}
                        aria-label={`Socket ${i + 1}: ${name}${i < stage ? ", built" : i === stage ? ", next" : ", sealed"}`}
                        aria-pressed={sel === i}
                        onClick={() => { setPick(i); sfx("tab"); }}
                    />
                ))}
            </div>
            <div className="nf-end-read" style={{ ["--c" as string]: END_COLORS[sel] } as CSSProperties} aria-live="polite">
                <i className="nf-end-br" aria-hidden="true" />
                <div className="nf-end-read-h">
                    <span>SOCKET {String(sel + 1).padStart(2, "0")}</span>
                    <b>{END_STAGES[sel]}</b>
                    <em data-st={st}>{st === "built" ? "LIVE" : st === "next" ? (block ? "WAITING" : "READY") : "SEALED"}</em>
                </div>
                <p>{END_STAGE_LINES[sel]}</p>
                {st !== "built" && (
                    <dl className="nf-end-need">
                        <div>
                            <dt><NfIcon name={z as "bytes"} />{def.name}</dt>
                            <dd><b>{fmt(Math.min(have, c.mat))}</b> / {fmt(c.mat)}</dd>
                            <i className="nf-end-heat" aria-hidden="true"><em style={{ width: `${Math.min(1, have / c.mat) * 100}%` }} /></i>
                        </div>
                        <div>
                            <dt>Keys</dt>
                            <dd><b>{Math.min(s.hand.keys, c.keys)}</b> / {c.keys}</dd>
                            <span className="nf-end-keys" aria-hidden="true">{Array.from({ length: keysShown }, (_, k) => <KeyPip key={k} on={k < Math.round((Math.min(s.hand.keys, c.keys) / c.keys) * keysShown)} />)}</span>
                        </div>
                    </dl>
                )}
            </div>
            {!done && (
                <>
                    {!endOpen(s) && <p className="nf-end-note">Build one {def.name} producer this run to work on the build.</p>}
                    <button
                        type="button"
                        className="nf-end-go"
                        disabled={!!block}
                        data-hold={hold ? "" : undefined}
                        style={{ ["--pour" as string]: `${POUR_MS}ms` } as CSSProperties}
                        onPointerDown={(e) => { if (e.button === 0) { e.currentTarget.setPointerCapture?.(e.pointerId); start(); } }}
                        onPointerUp={() => { if (t.current) stop(); }}
                        onPointerCancel={() => stop()}
                        onLostPointerCapture={() => { if (t.current) stop(); }}
                        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); start(); } }}
                        onKeyUp={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (t.current) stop(); } }}
                        onBlur={() => { if (t.current) stop(); }}
                        onContextMenu={(e) => e.preventDefault()}
                    >
                        <i className="nf-end-go-fill" aria-hidden="true" />
                        <span>{block ? block : hold ? `Pouring into ${END_STAGES[stage]}` : stage === END_STEPS - 1 ? `Hold to wake node zero` : `Hold to pour: ${END_STAGES[stage]}`}</span>
                    </button>
                </>
            )}
            {done && (
                <div className="nf-end-after">
                    <dl className="nf-end-facts">
                        <div><dt>Woken</dt><dd>{s.end?.doneAt ? date(s.end.doneAt) : "now"}</dd></div>
                        <div><dt>Endings</dt><dd>{s.end?.stars ?? 1}</dd></div>
                    </dl>
                    <button type="button" className="nf-end-go nf-end-ghost" onClick={onReplay}><span>Replay the ending</span></button>
                </div>
            )}
            {inh && (
                <blockquote className="nf-end-inh">
                    <i className="nf-end-br" aria-hidden="true" />
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
    const [who, setWho] = useState(0);
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
    // the roll: each lamp's line comes up as it lights, once, until you tap a lamp or start typing
    const touched = useRef(false);
    const opsLen = PROTOS.length + (s.end?.logs ?? []).filter((l) => l.n < Math.max(1, s.end?.stars ?? 1)).length + 1;
    useEffect(() => {
        if (reduced) return;
        let i = 0;
        const iv = window.setInterval(() => {
            if (touched.current) return window.clearInterval(iv);
            i += 1;
            if (i >= opsLen) return window.clearInterval(iv);
            setWho(i);
        }, 2600);
        return () => window.clearInterval(iv);
    }, [opsLen, reduced]);

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
    // the lamps on the wall: the four past operators, any earlier endings of yours, then you (lit once you write a log)
    const ops = [
        ...PROTOS.map((p, i) => ({ key: p.id, name: p.op, color: p.color, col: i, lit: true, kicker: `${p.op} // ${p.name}`, line: p.flavor })),
        ...(s.end?.logs ?? []).filter((l) => l.n < n).map((l) => ({ key: `op${l.n}`, name: `Op ${l.n}`, color: "#c8f6ff", col: 4, lit: true, kicker: `Operator ${l.n} // your log`, line: l.text })),
        { key: "you", name: END_COPY.youName, color: "#c8f6ff", col: 4, lit: !!log.trim(), kicker: `Operator ${n} // you`, line: log.trim() || END_COPY.youLine.replace("{n}", String(n)) },
    ];

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
                    <div className="nf-end-wall" data-cx-i="5">
                        <div className="nf-end-lamps" role="tablist" aria-label={END_COPY.creditsHead}>
                            {ops.map((o, i) => (
                                <button
                                    key={o.key}
                                    type="button"
                                    role="tab"
                                    className="nf-end-lamp"
                                    data-lit={o.lit ? "" : undefined}
                                    aria-selected={who === i}
                                    style={{ ["--c" as string]: o.color, ["--col" as string]: o.col, ["--d" as string]: o.key === "you" ? "0ms" : `${700 + i * 260}ms` } as CSSProperties}
                                    onClick={() => { touched.current = true; setWho(i); sfx("tab"); }}
                                >
                                    <i aria-hidden="true" />
                                    <span>{o.name}</span>
                                </button>
                            ))}
                        </div>
                        <div className="nf-end-quote" role="tabpanel" style={{ ["--c" as string]: ops[who].color } as CSSProperties}>
                            <i className="nf-end-br" aria-hidden="true" />
                            <span className="nf-end-quote-k">{ops[who].kicker}</span>
                            <p key={who}>{ops[who].line}</p>
                        </div>
                    </div>

                    <h3 className="nf-end-h" data-cx-i="6" data-cx-scr="">{END_COPY.statsHead}</h3>
                    <div className="nf-end-slip" data-cx-i="7">
                        <i className="nf-end-br" aria-hidden="true" />
                        <span className="nf-end-slip-h" aria-hidden="true">SHIFT.LOG // NODE-00 // OPERATOR {String(n).padStart(2, "0")}</span>
                        <dl>
                            {stats.map(([k, v]) => <div key={k}><dt>{k}</dt><i aria-hidden="true" /><dd>{v}</dd></div>)}
                        </dl>
                    </div>

                    <label className="nf-end-log" data-cx-i="8">
                        <span className="nf-end-h">{END_COPY.logHead}</span>
                        <small>{END_COPY.logHint}</small>
                        <textarea ref={first} value={log} maxLength={END_TUNE.logMax} rows={3} onChange={(e) => setLog(e.target.value)} onFocus={() => { touched.current = true; setWho(ops.length - 1); }} spellCheck />
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
