"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { cxPlay, useCodeReveal } from "@/lib/nodefarm/cx";
import { sfx } from "@/lib/sound/sounds";
import { EVENT_TUNE, nextGapMs, pickEvent, type EventDef, type EventKind } from "@/lib/nodefarm/events";
import { eventHaste, fmt, overclockMult, type State } from "@/lib/nodefarm/engine";

type Stage = "incoming" | "live" | "result";
type Active = { def: EventDef; id: number; stage: Stage; won: boolean };

interface LayerProps {
    game: MutableRefObject<State>;
    /** true while something else owns the screen (a board window, the away report, a reset prompt) */
    busy: boolean;
    enabled: boolean;
    ready: boolean;
    reduced: boolean;
    onEngage: (def: EventDef) => void;
    /** return `{ echo: true }` to bring the next event right away (the Echo tree node) */
    onResult: (def: EventDef, won: boolean) => { echo?: boolean } | void;
    onMiss: (def: EventDef) => void;
    onDisable: () => void;
}

/** Schedules quick-time events and shows each one in the middle of the screen. */
export function EventLayer({ game, busy, enabled, ready, reduced, onEngage, onResult, onMiss, onDisable }: LayerProps) {
    const [act, setAct] = useState<Active | null>(null);
    const next = useRef(0);
    const last = useRef<EventKind | null>(null);
    const ids = useRef(1);
    const actRef = useRef<Active | null>(null);
    actRef.current = act;
    const busyRef = useRef(busy);
    busyRef.current = busy;

    const schedule = useCallback(() => {
        next.current = performance.now() + nextGapMs(game.current ? eventHaste(game.current) : 0);
    }, [game]);

    useEffect(() => {
        if (ready) schedule();
    }, [ready, schedule]);

    // the scheduler: one check a second, never while something else is open or the tab is hidden
    useEffect(() => {
        if (!ready || !enabled) return;
        const iv = setInterval(() => {
            const s = game.current;
            if (!s || actRef.current || busyRef.current || document.hidden || performance.now() < next.current) return;
            const def = pickEvent(s.life.reboots + s.mult, last.current);
            if (!def) return;
            last.current = def.kind;
            setAct({ def, id: ids.current++, stage: "incoming", won: false });
            sfx("nfAlert");
        }, 1000);
        return () => clearInterval(iv);
    }, [ready, enabled, game]);

    useEffect(() => {
        if (!enabled) setAct(null);
    }, [enabled]);

    // restore focus to whatever had it when the event opened
    const returnTo = useRef<HTMLElement | null>(null);
    useEffect(() => {
        if (act && !returnTo.current) returnTo.current = document.activeElement as HTMLElement | null;
        if (!act && returnTo.current) {
            returnTo.current.focus?.({ preventScroll: true });
            returnTo.current = null;
        }
    }, [act]);

    const close = useCallback(() => {
        setAct(null);
        schedule();
    }, [schedule]);

    const finish = useCallback(
        (won: boolean) => {
            const a = actRef.current;
            if (!a || a.stage === "result") return;
            setAct({ ...a, stage: "result", won });
            const r = onResult(a.def, won);
            sfx(won ? "nfBreach" : "deny");
            setTimeout(() => setAct((c) => (c && c.id === a.id ? null : c)), EVENT_TUNE.resultMs);
            schedule();
            // Echo: the next event follows as soon as this result card is gone
            if (r && r.echo) next.current = performance.now() + EVENT_TUNE.resultMs + 1500;
        },
        [onResult, schedule],
    );

    const engage = useCallback(() => {
        const a = actRef.current;
        if (!a || a.stage !== "incoming") return;
        setAct({ ...a, stage: "live" });
        onEngage(a.def);
        sfx("open");
    }, [onEngage]);

    const skip = useCallback(() => {
        const a = actRef.current;
        if (!a) return;
        if (a.stage === "incoming") onMiss(a.def);
        if (a.stage === "live") onResult(a.def, false);
        sfx("close");
        close();
    }, [close, onMiss, onResult]);

    // Escape skips; the incoming card gives up on its own
    useEffect(() => {
        if (!act) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                skip();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [act, skip]);
    useEffect(() => {
        if (!act || act.stage !== "incoming") return;
        const t = setTimeout(() => {
            onMiss(act.def);
            close();
        }, EVENT_TUNE.waitSecs * 1000);
        return () => clearTimeout(t);
    }, [act, close, onMiss]);

    // the card prints in when an event arrives, reprints its body on each stage, and deletes out when it ends
    // (code reveal, lib/nodefarm/cx.ts). While it deletes out, the last state stays on screen, inert.
    const card = useRef<HTMLDivElement>(null);
    const lastAct = useRef<Active | null>(null);
    if (act) lastAct.current = act;
    const shown = useCodeReveal(card, !!act, { rows: ":scope > :not(.nf-ev-br)" });
    const stageKey = act ? `${act.id}:${act.stage}` : "";
    const prevStage = useRef("");
    useEffect(() => {
        const was = prevStage.current;
        prevStage.current = stageKey;
        if (stageKey && was && was.split(":")[0] === stageKey.split(":")[0]) cxPlay(card.current, { bare: true, sound: false, rows: ":scope > :not(.nf-ev-br):not(.nf-ev-top)" });
    }, [stageKey]);

    const view = act ?? (shown ? lastAct.current : null);
    if (!view) return null;
    const { def, stage } = view;
    return (
        <div className="nf-ev-scrim" data-stage={stage} data-out={act ? undefined : ""} inert={!act}>
            <div ref={card} className="nf-ev" role="alertdialog" aria-modal="true" aria-labelledby="nf-ev-t" aria-describedby="nf-ev-d" data-kind={def.kind} data-stage={stage} data-reduced={reduced ? "" : undefined}>
                <i className="nf-ev-br" data-c="tl" /><i className="nf-ev-br" data-c="tr" /><i className="nf-ev-br" data-c="bl" /><i className="nf-ev-br" data-c="br" />
                <div className="nf-ev-top">
                    <b id="nf-ev-t">{def.code}</b>
                    <span>{stage === "incoming" ? "incoming" : stage === "live" ? "live" : view.won ? "cleared" : "lost"}</span>
                </div>

                {stage === "incoming" && <Incoming def={def} mult={overclockMult(game.current)} onEngage={engage} onSkip={skip} onOff={() => { sfx("close"); onDisable(); }} />}
                {stage === "live" && (
                    <>
                        <p id="nf-ev-d" className="nf-ev-hint">{def.hint}</p>
                        <Body def={def} onDone={finish} reduced={reduced} />
                        <Clock key={view.id} secs={def.secs} onEnd={() => finish(false)} />
                        <div className="nf-ev-foot"><button type="button" className="nf-ev-link" onClick={skip}>Skip</button></div>
                    </>
                )}
                {stage === "result" && (
                    <p id="nf-ev-d" className="nf-ev-result" role="status" data-won={view.won ? "" : undefined}>
                        {view.won ? `Cleared. Overclock x${fmt(overclockMult(game.current))} for ${Math.round(game.current.overclock)} s.` : "Lost. No cost, the next one will come."}
                    </p>
                )}
            </div>
        </div>
    );
}

function Incoming({ def, mult, onEngage, onSkip, onOff }: { def: EventDef; mult: number; onEngage: () => void; onSkip: () => void; onOff: () => void }) {
    const [armed, setArmed] = useState(false);
    const ref = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        const t = setTimeout(() => {
            setArmed(true);
            ref.current?.focus({ preventScroll: true });
        }, EVENT_TUNE.armMs);
        return () => clearTimeout(t);
    }, []);
    return (
        <>
            <h2 className="nf-ev-name">{def.title}</h2>
            <p id="nf-ev-d" className="nf-ev-brief">{def.brief}</p>
            <p className="nf-ev-reward">Win: Overclock x{fmt(mult)}. Skip or lose: nothing happens.</p>
            <div className="nf-ev-actions">
                <button ref={ref} type="button" className="nf-ev-go" disabled={!armed} onClick={onEngage}>Engage</button>
                <button type="button" className="nf-ev-alt" onClick={onSkip}>Skip</button>
            </div>
            <div className="nf-ev-wait" aria-hidden="true"><i style={{ animationDuration: `${EVENT_TUNE.waitSecs}s` }} /></div>
            <div className="nf-ev-foot"><button type="button" className="nf-ev-link" onClick={onOff}>Turn events off</button></div>
        </>
    );
}

function Clock({ secs, onEnd }: { secs: number; onEnd: () => void }) {
    // the game re-renders ten times a second and onEnd is a new function each time: keep it in a ref, or the timer restarts forever and never fires
    const end = useRef(onEnd);
    end.current = onEnd;
    useEffect(() => {
        const t = setTimeout(() => end.current(), secs * 1000);
        return () => clearTimeout(t);
    }, [secs]);
    return <div className="nf-ev-clock" aria-hidden="true"><i style={{ animationDuration: `${secs}s` }} /></div>;
}

type BodyProps = { onDone: (won: boolean) => void; reduced: boolean };
function Body({ def, ...p }: { def: EventDef } & BodyProps) {
    if (def.kind === "intrusion") return <Intrusion {...p} />;
    if (def.kind === "surge") return <Surge {...p} />;
    if (def.kind === "lock") return <Lock {...p} />;
    return <Trace {...p} />;
}

// ---- intrusion: a four-key sequence is shown, then keyed back in order
const KEYS = [
    { g: "◆", c: "#2fd8e8", n: "diamond" },
    { g: "▲", c: "#b6f04a", n: "triangle" },
    { g: "●", c: "#ff2d8a", n: "circle" },
    { g: "■", c: "#f0a53c", n: "square" },
];
function Intrusion({ onDone }: BodyProps) {
    const [seq] = useState(() => Array.from({ length: 4 }, () => Math.floor(Math.random() * 4)));
    const [phase, setPhase] = useState<"show" | "play">("show");
    const [step, setStep] = useState(0);
    const [bad, setBad] = useState(-1);
    const done = useRef(false);
    useEffect(() => {
        const t = setTimeout(() => setPhase("play"), 2400);
        return () => clearTimeout(t);
    }, []);
    const key = useCallback(
        (k: number) => {
            if (phase !== "play" || done.current) return;
            if (k === seq[step]) {
                sfx("tap");
                if (step + 1 >= seq.length) {
                    done.current = true;
                    onDone(true);
                } else setStep(step + 1);
            } else {
                sfx("deny");
                setBad(k);
                done.current = true;
                setTimeout(() => onDone(false), 350);
            }
        },
        [phase, seq, step, onDone],
    );
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key >= "1" && e.key <= "4") key(Number(e.key) - 1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [key]);
    return (
        <div className="nf-ev-body">
            <ol className="nf-ev-seq" aria-label={phase === "show" ? `Sequence: ${seq.map((i) => KEYS[i].n).join(", ")}` : "Sequence hidden"}>
                {seq.map((k, i) => (
                    <li key={i} data-lit={phase === "show" || i < step ? "" : undefined} style={{ ["--c" as string]: KEYS[k].c }}>
                        {phase === "show" || i < step ? KEYS[k].g : "?"}
                    </li>
                ))}
            </ol>
            <p className="nf-ev-state" aria-live="polite">{phase === "show" ? "Memorize the sequence" : `Key ${step + 1} of ${seq.length}`}</p>
            <div className="nf-ev-keys">
                {KEYS.map((k, i) => (
                    <button key={i} type="button" disabled={phase !== "play"} data-bad={bad === i ? "" : undefined} style={{ ["--c" as string]: k.c }} aria-label={`${k.n}, key ${i + 1}`} onClick={() => key(i)}>
                        {k.g}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ---- power surge: hold to charge, release in the green band (three tries)
function Surge({ onDone, reduced }: BodyProps) {
    const [band] = useState(() => 0.58 + Math.random() * 0.26);
    const HALF = 0.1;
    const [level, setLevel] = useState(0);
    const [held, setHeld] = useState(false);
    const [tries, setTries] = useState(3);
    const [note, setNote] = useState("Ready");
    const lv = useRef(0);
    const start = useRef(0);
    const raf = useRef(0);
    const done = useRef(false);
    const tr = useRef(3);

    const loop = useCallback(() => {
        lv.current = Math.min(1.05, (performance.now() - start.current) / 2200);
        setLevel(lv.current);
        if (lv.current >= 1.05) {
            release();
            return;
        }
        raf.current = requestAnimationFrame(loop);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const press = useCallback(() => {
        if (done.current || start.current) return;
        start.current = performance.now();
        setHeld(true);
        setNote("Charging");
        raf.current = requestAnimationFrame(loop);
    }, [loop]);
    const release = useCallback(() => {
        if (done.current || !start.current) return;
        cancelAnimationFrame(raf.current);
        start.current = 0;
        setHeld(false);
        const v = lv.current;
        if (Math.abs(v - band) <= HALF) {
            done.current = true;
            setLevel(band);
            onDone(true);
            return;
        }
        tr.current -= 1;
        setTries(tr.current);
        sfx("deny");
        setNote(v < band ? "Too low" : "Overloaded");
        lv.current = 0;
        setLevel(0);
        if (tr.current <= 0) {
            done.current = true;
            setTimeout(() => onDone(false), 400);
        }
    }, [band, onDone]);
    useEffect(() => {
        const dn = (e: KeyboardEvent) => {
            if (e.code === "Space" && !e.repeat) { e.preventDefault(); press(); }
        };
        const up = (e: KeyboardEvent) => {
            if (e.code === "Space") { e.preventDefault(); release(); }
        };
        window.addEventListener("keydown", dn);
        window.addEventListener("keyup", up);
        return () => {
            window.removeEventListener("keydown", dn);
            window.removeEventListener("keyup", up);
            cancelAnimationFrame(raf.current);
        };
    }, [press, release]);
    const zone = { left: `${(band - HALF) * 100}%`, width: `${HALF * 200}%` };
    return (
        <div className="nf-ev-body">
            <div className="nf-ev-meter" role="meter" aria-label="Charge" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1, level) * 100)} aria-valuetext={`${Math.round(Math.min(1, level) * 100)} percent, target band ${Math.round((band - HALF) * 100)} to ${Math.round((band + HALF) * 100)}`}>
                <span className="nf-ev-zone" style={zone} />
                <i style={{ width: `${Math.min(1, level) * 100}%`, transition: reduced ? "none" : undefined }} />
            </div>
            <p className="nf-ev-state" aria-live="polite">{note} · tries {tries}</p>
            <button
                type="button"
                className="nf-ev-hold"
                data-held={held ? "" : undefined}
                onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); press(); }}
                onPointerUp={release}
                onPointerCancel={release}
                onContextMenu={(e) => e.preventDefault()}
                onKeyDown={(e) => { if (e.code === "Space" || e.code === "Enter") e.preventDefault(); }}
            >
                Hold to charge
            </button>
        </div>
    );
}

// ---- signal lock: a sweep moves across a track; stop it inside the zone (three tries)
function Lock({ onDone, reduced }: BodyProps) {
    const [zone] = useState(() => ({ at: 0.18 + Math.random() * 0.5, w: 0.24 }));
    const [pos, setPos] = useState(0);
    const [tries, setTries] = useState(3);
    const [note, setNote] = useState("Sweeping");
    const cur = useRef(0);
    const t0 = useRef(performance.now());
    const raf = useRef(0);
    const tr = useRef(3);
    const done = useRef(false);
    useEffect(() => {
        const loop = () => {
            const t = (performance.now() - t0.current) / 1500; // one full pass every 1.5 s
            const m = t % 2;
            cur.current = m < 1 ? m : 2 - m;
            setPos(cur.current);
            raf.current = requestAnimationFrame(loop);
        };
        raf.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf.current);
    }, []);
    const stop = useCallback(() => {
        if (done.current) return;
        const p = cur.current;
        if (p >= zone.at && p <= zone.at + zone.w) {
            done.current = true;
            cancelAnimationFrame(raf.current);
            onDone(true);
            return;
        }
        tr.current -= 1;
        setTries(tr.current);
        sfx("deny");
        setNote(p < zone.at ? "Too early" : "Too late");
        if (tr.current <= 0) {
            done.current = true;
            cancelAnimationFrame(raf.current);
            setTimeout(() => onDone(false), 400);
        }
    }, [zone, onDone]);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.code === "Space" || e.code === "Enter") {
                if ((e.target as HTMLElement)?.tagName === "BUTTON") return; // the button's own click handles it
                e.preventDefault();
                stop();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [stop]);
    return (
        <div className="nf-ev-body">
            <div className="nf-ev-meter" role="img" aria-label={`Sweep at ${Math.round(pos * 100)} percent, target zone ${Math.round(zone.at * 100)} to ${Math.round((zone.at + zone.w) * 100)} percent`}>
                <span className="nf-ev-zone" style={{ left: `${zone.at * 100}%`, width: `${zone.w * 100}%` }} />
                <b className="nf-ev-sweep" style={{ left: `${pos * 100}%`, transition: reduced ? "none" : undefined }} />
            </div>
            <p className="nf-ev-state" aria-live="polite">{note} · tries {tries}</p>
            <button type="button" className="nf-ev-hold" onClick={stop}>Lock</button>
        </div>
    );
}

// ---- breach trace: five nodes light up one after another on a 3 x 3 grid; hit four
function Trace({ onDone }: BodyProps) {
    const [plan] = useState(() => {
        const out: number[] = [];
        while (out.length < 5) {
            const n = Math.floor(Math.random() * 9);
            if (n !== out[out.length - 1]) out.push(n);
        }
        return out;
    });
    const [i, setI] = useState(0); // which target is lit
    const [hits, setHits] = useState(0);
    const [flash, setFlash] = useState<{ n: number; ok: boolean } | null>(null);
    const lit = i < plan.length ? plan[i] : -1;
    const done = useRef(false);
    const hit = useRef(false);
    const advance = useCallback(() => {
        hit.current = false;
        setI((v) => v + 1);
    }, []);
    useEffect(() => {
        if (i >= plan.length) {
            if (!done.current) {
                done.current = true;
                onDone(hits >= 4);
            }
            return;
        }
        const t = setTimeout(advance, 1700);
        return () => clearTimeout(t);
    }, [i, plan.length, advance, hits, onDone]);
    const tap = useCallback(
        (n: number) => {
            if (done.current || i >= plan.length) return;
            if (n === lit && !hit.current) {
                hit.current = true;
                sfx("tap");
                setHits((h) => h + 1);
                setFlash({ n, ok: true });
                setTimeout(advance, 160);
            } else if (n !== lit) {
                sfx("deny");
                setFlash({ n, ok: false });
                setTimeout(() => setFlash((f) => (f && f.n === n ? null : f)), 220);
            }
        },
        [i, plan.length, lit, advance],
    );
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key >= "1" && e.key <= "9") tap(Number(e.key) - 1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [tap]);
    return (
        <div className="nf-ev-body">
            <div className="nf-ev-grid">
                {Array.from({ length: 9 }, (_, n) => (
                    <button key={`${n}-${n === lit ? i : "x"}`} type="button" data-lit={n === lit ? "" : undefined} data-flash={flash?.n === n ? (flash.ok ? "ok" : "bad") : undefined} aria-label={n === lit ? `Node ${n + 1}, lit` : `Node ${n + 1}`} onClick={() => tap(n)}>
                        {n + 1}
                    </button>
                ))}
            </div>
            <p className="nf-ev-state" aria-live="polite">Flag {Math.min(i + 1, plan.length)} of {plan.length} · hits {hits}, need 4</p>
        </div>
    );
}
