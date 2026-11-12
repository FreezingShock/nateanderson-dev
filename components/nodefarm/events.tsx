"use client";

import "@/app/camino/nodefarm-events.css";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import { createPortal } from "react-dom";
import { keyIsTyping } from "@/lib/nodefarm/keys";
import { cxPlay, useCodeReveal } from "@/lib/nodefarm/cx";
import { sfx } from "@/lib/sound/sounds";
import { EVENTS, EVENT_TUNE, RARITY, nextGapMs, pickEvent, rogueChoices, rollLoot, type EventDef, type EventKind, type Loot } from "@/lib/nodefarm/events";
import { eventHaste, fmt, overclockMult, statDef, type State } from "@/lib/nodefarm/engine";
import { NfIcon, type NfIconName } from "./icon";

// Quick-time events (data and payout maths: lib/nodefarm/events.ts, styles: app/camino/nodefarm-events.css).
// The layer is portaled to <body> so the card centers on the visible screen whatever the page scroll or full-screen mode.
// Each event reports a quality from 0 to 1 (how much of it you did). From EVENT_TUNE.winAt it counts as a win: the game
// gives the timed Overclock (and runs the Anomaly tree nodes), then pays the loot this layer rolled.

type Stage = "incoming" | "live" | "result";
type Active = { def: EventDef; id: number; stage: Stage; won: boolean; loot: Loot | null };

interface LayerProps {
    game: MutableRefObject<State>;
    /** true while something else owns the screen (a board window, the away report, a reset prompt) */
    busy: boolean;
    enabled: boolean;
    ready: boolean;
    reduced: boolean;
    onEngage: (def: EventDef) => void;
    /** pay the win (Overclock first, then `loot`); return `{ echo: true }` to bring the next event right away (the Echo tree node) */
    onResult: (def: EventDef, won: boolean, loot?: Loot | null) => { echo?: boolean } | void;
    onMiss: (def: EventDef) => void;
    onDisable: () => void;
}

/** Event keys stay quiet while typing, with a modifier held, or under search or the console. */
const evKeyOff = (e: KeyboardEvent) => keyIsTyping(e) || !!document.querySelector(".nv-scrim, .cn-panel");

/** Schedules quick-time events and shows each one in the middle of the screen. */

export function EventLayer({ game, busy, enabled, ready, reduced, onEngage, onResult, onMiss, onDisable }: LayerProps) {
    const [act, setAct] = useState<Active | null>(null);
    const [timeUp, setTimeUp] = useState(false);
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

    const open = useCallback((def: EventDef) => {
        last.current = def.kind;
        setTimeUp(false);
        setAct({ def, id: ids.current++, stage: "incoming", won: false, loot: null });
        sfx("nfAlert");
    }, []);

    // the scheduler: one check a second, never while something else is open or the tab is hidden
    useEffect(() => {
        if (!ready || !enabled) return;
        const iv = setInterval(() => {
            const s = game.current;
            if (!s || actRef.current || busyRef.current || document.hidden || performance.now() < next.current) return;
            const def = pickEvent(s.life.reboots + s.mult, last.current);
            if (def) open(def);
        }, 1000);
        return () => clearInterval(iv);
    }, [ready, enabled, game, open]);

    useEffect(() => {
        if (!enabled) setAct(null);
    }, [enabled]);

    // admin mode (`nf:fire`, components/nodefarm/admin.tsx): show a chosen event right away
    useEffect(() => {
        const onFire = (e: Event) => {
            const def = EVENTS.find((x) => x.kind === (e as CustomEvent<EventKind>).detail);
            if (def && !actRef.current) open(def);
        };
        window.addEventListener("nf:fire", onFire);
        return () => window.removeEventListener("nf:fire", onFire);
    }, [open]);

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

    /** `quality` 0 to 1; `chosen` is the loot the player picked (Rogue process), otherwise a win rolls one. */
    const finish = useCallback(
        (quality: number, chosen?: Loot) => {
            const a = actRef.current;
            if (!a || a.stage !== "live") return;
            const won = quality >= EVENT_TUNE.winAt;
            const loot = won ? (chosen ?? rollLoot(game.current, quality)) : null;
            const next1 = { ...a, stage: "result" as Stage, won, loot };
            actRef.current = next1;
            setAct(next1);
            const r = onResult(a.def, won, loot);
            if (!won) sfx("deny");
            else {
                sfx("nfBreach");
                if (loot) setTimeout(() => sfx("reveal", { r: loot.rarity + 1 }), 260);
            }
            setTimeout(() => setAct((c) => (c && c.id === a.id ? null : c)), EVENT_TUNE.resultMs);
            schedule();
            // Echo: the next event follows as soon as this result card is gone
            if (r && r.echo) next.current = performance.now() + EVENT_TUNE.resultMs + 1500;
        },
        [game, onResult, schedule],
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
            if (evKeyOff(e)) return;
            if (e.key === "Escape") {
                e.preventDefault();
                skip();
            }
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
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
    const shown = useCodeReveal(card, !!act, { style: "decrypt", rows: ":scope > :not(.nf-ev-br)" });
    const stageKey = act ? `${act.id}:${act.stage}` : "";
    const prevStage = useRef("");
    useEffect(() => {
        const was = prevStage.current;
        prevStage.current = stageKey;
        if (stageKey && was && was.split(":")[0] === stageKey.split(":")[0]) cxPlay(card.current, { style: "decrypt", bare: true, sound: false, rows: ":scope > :not(.nf-ev-br):not(.nf-ev-top)" });
    }, [stageKey]);

    const onTime = useCallback(() => setTimeUp(true), []);
    const host = useScreenHost();

    const view = act ?? (shown ? lastAct.current : null);
    if (!view || !host) return null;
    const { def, stage } = view;
    // Traffic spike plays on the real board, so while it is live the card docks as a strip and the board stays usable
    const docked = def.kind === "spike" && stage === "live";
    return createPortal(
        <div className="ctos nf-ev-host">
            <div className="nf-ev-scrim" data-stage={stage} data-docked={docked ? "" : undefined} data-out={act ? undefined : ""} inert={!act}>
                <div
                    ref={card}
                    className="nf-ev"
                    role={docked ? "status" : "alertdialog"}
                    aria-modal={docked ? undefined : true}
                    aria-labelledby="nf-ev-t"
                    aria-describedby="nf-ev-d"
                    data-kind={def.kind}
                    data-stage={stage}
                    data-reduced={reduced ? "" : undefined}
                    style={{ ["--k" as string]: view.loot && stage === "result" ? RARITY[view.loot.rarity].color : def.color } as CSSProperties}
                >
                    <i className="nf-ev-br" data-c="tl" /><i className="nf-ev-br" data-c="tr" /><i className="nf-ev-br" data-c="bl" /><i className="nf-ev-br" data-c="br" />
                    <div className="nf-ev-top">
                        <b id="nf-ev-t">{def.code}</b>
                        <span>{stage === "incoming" ? "incoming" : stage === "live" ? "live" : view.won ? "cleared" : "closed"}</span>
                    </div>

                    {stage === "incoming" && <Incoming def={def} onEngage={engage} onSkip={skip} onOff={() => { sfx("close"); onDisable(); }} />}
                    {stage === "live" && (
                        <>
                            {!docked && <p id="nf-ev-d" className="nf-ev-hint">{def.hint}</p>}
                            <Body def={def} game={game} onDone={finish} reduced={reduced} timeUp={timeUp} />
                            <Clock key={view.id} secs={def.secs} onEnd={onTime} />
                            {!docked && <div className="nf-ev-foot"><button type="button" className="nf-ev-link" onClick={skip}>Skip</button></div>}
                        </>
                    )}
                    {stage === "result" && <Result won={view.won} loot={view.loot} game={game.current} />}
                </div>
            </div>
        </div>,
        host,
    );
}

/** `<body>`, or the full-screen element while one smaller than the whole page is full screen; null until mounted. */
function useScreenHost() {
    const [host, setHost] = useState<Element | null>(null);
    useEffect(() => {
        const pick = () => {
            const fs = document.fullscreenElement;
            setHost(fs && fs !== document.documentElement ? fs : document.body);
        };
        pick();
        document.addEventListener("fullscreenchange", pick);
        return () => document.removeEventListener("fullscreenchange", pick);
    }, []);
    return host;
}

function Incoming({ def, onEngage, onSkip, onOff }: { def: EventDef; onEngage: () => void; onSkip: () => void; onOff: () => void }) {
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
            <EvArt kind={def.kind} color={def.color} />
            <h2 className="nf-ev-name">{def.title}</h2>
            <p id="nf-ev-d" className="nf-ev-brief">{def.brief}</p>
            <p className="nf-ev-reward">Engage: Overclock plus a loot roll. Skip: nothing happens.</p>
            <div className="nf-ev-actions">
                <button ref={ref} type="button" className="nf-ev-go" disabled={!armed} onClick={onEngage}>Engage</button>
                <button type="button" className="nf-ev-alt" onClick={onSkip}>Skip</button>
            </div>
            <div className="nf-ev-wait" aria-hidden="true"><i style={{ animationDuration: `${EVENT_TUNE.waitSecs}s` }} /></div>
            <div className="nf-ev-foot"><button type="button" className="nf-ev-link" onClick={onOff}>Turn events off</button></div>
        </>
    );
}

/** The time limit. When it runs out the body is told, and it reports whatever it has so far. */
function Clock({ secs, onEnd }: { secs: number; onEnd: () => void }) {
    // onEnd lives in a ref: node-farm.tsx re-renders at 10 Hz, and a changing callback in the deps would restart the timer
    const end = useRef(onEnd);
    end.current = onEnd;
    useEffect(() => {
        const t = setTimeout(() => end.current(), secs * 1000);
        return () => clearTimeout(t);
    }, [secs]);
    return <div className="nf-ev-clock" aria-hidden="true"><i style={{ animationDuration: `${secs}s` }} /></div>;
}

function Result({ won, loot, game }: { won: boolean; loot: Loot | null; game: State }) {
    if (!won || !loot) return <p id="nf-ev-d" className="nf-ev-result" role="status">Closed with too little done. No cost, the next one will come.</p>;
    const r = RARITY[loot.rarity];
    return (
        <div id="nf-ev-d" className="nf-ev-loot" role="status" style={{ ["--c" as string]: r.color } as CSSProperties}>
            <span className="nf-ev-loot-ic"><NfIcon name={loot.stat as NfIconName} large /></span>
            <div>
                <small>{r.name} loot</small>
                <b>{loot.label}</b>
                <p>{loot.note}. Overclock x{fmt(overclockMult(game))}, {Math.round(game.overclock)} s left.</p>
            </div>
        </div>
    );
}

// ---- event bodies. Each reports once through `done(quality 0..1, chosen loot?)`; when time runs out, `sofar` decides.
type BodyProps = { game: MutableRefObject<State>; onDone: (q: number, chosen?: Loot) => void; reduced: boolean; timeUp: boolean };
function Body({ def, ...p }: { def: EventDef } & BodyProps) {
    if (def.kind === "spike") return <Spike {...p} />;
    if (def.kind === "rogue") return <Rogue {...p} />;
    if (def.kind === "vault") return <Vault {...p} />;
    if (def.kind === "relay") return <Relay {...p} />;
    return <Packet {...p} />;
}

/** Only the first report counts, and when time runs out the body is paid for what it has so far. */
function useDone({ onDone, timeUp }: BodyProps, sofar: () => number) {
    const fired = useRef(false);
    const so = useRef(sofar);
    so.current = sofar;
    const done = useCallback(
        (q: number, chosen?: Loot) => {
            if (fired.current) return;
            fired.current = true;
            onDone(q, chosen);
        },
        [onDone],
    );
    useEffect(() => {
        if (timeUp) done(so.current());
    }, [timeUp, done]);
    return done;
}

// ---- Traffic spike: the card docks as a strip; every buy press on the real board fills the contract
function Spike(p: BodyProps) {
    const { game } = p;
    const need = EVENT_TUNE.spikePresses;
    const start = useRef(game.current.life.presses);
    const [n, setN] = useState(0);
    const nRef = useRef(0);
    const done = useDone(p, () => nRef.current / need);
    useEffect(() => {
        const iv = setInterval(() => {
            const v = Math.max(0, game.current.life.presses - start.current);
            if (v === nRef.current) return;
            nRef.current = v;
            setN(v);
            if (v >= need) done(1);
        }, 120);
        return () => clearInterval(iv);
    }, [game, need, done]);
    const k = Math.min(1, n / need);
    return (
        <div className="nf-ev-body nf-ev-spike">
            <NfIcon name="mult" />
            <div className="nf-ev-spike-t">
                <small id="nf-ev-d">contract // press buy buttons</small>
                <div className="nf-ev-bar" aria-hidden="true"><i style={{ transform: `scaleX(${k})` }} /></div>
            </div>
            <b className="nf-ev-count" aria-live="polite">{Math.min(n, need)}/{need}</b>
            <button type="button" className="nf-ev-mini" onClick={() => done(nRef.current / need)}>Cash out</button>
        </div>
    );
}

// ---- Rogue process: pick one of the shown outcomes
const ROGUE_NAMES = ["Quarantine", "Exploit", "Harvest"];
const ROGUE_LINES = ["Lock it away and bank what it carried.", "Turn it on itself. The node runs hot for longer.", "Strip it for parts. Raw material, straight in."];
function Rogue(p: BodyProps) {
    const [opts] = useState(() => rogueChoices(p.game.current));
    const done = useDone(p, () => 0);
    const pick = useCallback(
        (i: number) => {
            if (!opts[i]) return;
            sfx("tap");
            done(1, opts[i]);
        },
        [opts, done],
    );
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (evKeyOff(e)) return;
            if (e.key >= "1" && e.key <= String(opts.length)) pick(Number(e.key) - 1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [pick, opts.length]);
    return (
        <div className="nf-ev-body">
            <EvArt kind="rogue" color="#b46bff" />
            <div className="nf-ev-opts">
                {opts.map((o, i) => (
                    <button key={i} type="button" className="nf-ev-opt" style={{ ["--c" as string]: RARITY[o.rarity].color } as CSSProperties} onClick={() => pick(i)}>
                        <NfIcon name={o.stat as NfIconName} />
                        <span>
                            <b>{i + 1} · {ROGUE_NAMES[i]}</b>
                            <small>{o.label}, {o.note}. {ROGUE_LINES[i]}</small>
                        </span>
                    </button>
                ))}
            </div>
            <p className="nf-ev-state">All {opts.length} are <span style={{ color: RARITY[opts[0].rarity].color }}>{RARITY[opts[0].rarity].name.toLowerCase()}</span> this time.</p>
        </div>
    );
}

// ---- Cold storage: hold to decrypt rows; let go to pause, cash out to keep what is open
const GLYPHS = "░▒▓█▚▞▙▟";
const noise = (n: number) => Array.from({ length: n }, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]).join("");
function Vault(p: BodyProps) {
    const { game, reduced } = p;
    const rows = EVENT_TUNE.vaultRows;
    const [held, setHeld] = useState(false);
    const [prog, setProg] = useState(0); // rows, fractional
    const progRef = useRef(0);
    const t0 = useRef(0);
    const base = useRef(0);
    const raf = useRef(0);
    const done = useDone(p, () => Math.floor(progRef.current) / rows);
    const [labels] = useState(() => {
        const s = game.current;
        const ids = (["bytes", "mult", "reboot", "copper", "silicon", "quartz", "aether", "runes"] as const).filter((x) => x === "bytes" || (s[x] as number) > 0);
        return Array.from({ length: rows }, (_, i) => {
            const id = ids[i % ids.length];
            return { addr: `0x${(0x1f + i * 9).toString(16).toUpperCase()}`, name: statDef(id).name.toUpperCase().padEnd(13, " "), val: fmt((s[id] as number) * (0.2 + Math.random() * 0.6)) };
        });
    });
    const [, tick] = useState(0);

    // the frame loop reads everything through refs, so re-renders never restart or cancel it
    const doneRef = useRef(done);
    doneRef.current = done;
    const loop = useRef(() => {});
    loop.current = () => {
        if (!t0.current) return;
        const v = Math.min(rows, base.current + (performance.now() - t0.current) / EVENT_TUNE.vaultRowMs);
        if (Math.floor(v) > Math.floor(progRef.current)) sfx("tap");
        progRef.current = v;
        setProg(v);
        if (v >= rows) {
            t0.current = 0;
            setHeld(false);
            doneRef.current(1);
            return;
        }
        raf.current = requestAnimationFrame(() => loop.current());
    };
    const press = useCallback(() => {
        if (t0.current || progRef.current >= rows) return;
        t0.current = performance.now();
        base.current = progRef.current;
        setHeld(true);
        raf.current = requestAnimationFrame(() => loop.current());
        sfx("charge", { r: 1, ms: (rows - progRef.current) * EVENT_TUNE.vaultRowMs });
    }, [rows]);
    const release = useCallback(() => {
        if (!t0.current) return;
        cancelAnimationFrame(raf.current);
        t0.current = 0;
        setHeld(false);
    }, []);
    useEffect(() => {
        const dn = (e: KeyboardEvent) => {
            if (evKeyOff(e)) return;
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
        };
    }, [press, release]);
    useEffect(() => () => cancelAnimationFrame(raf.current), []);
    // the row being decrypted churns while you hold
    useEffect(() => {
        if (!held || reduced) return;
        const iv = setInterval(() => tick((x) => x + 1), 90);
        return () => clearInterval(iv);
    }, [held, reduced]);

    const opened = Math.floor(prog);
    return (
        <div className="nf-ev-body">
            <pre className="nf-ev-vault" aria-label={`${opened} of ${rows} rows decrypted`}>
                {labels.map((l, i) => (
                    <span key={i} data-open={i < opened ? "" : undefined} data-cur={i === opened && held ? "" : undefined}>
                        {l.addr}{"  "}{i < opened ? `${l.name}${l.val}` : noise(16)}
                        {"\n"}
                    </span>
                ))}
            </pre>
            <div className="nf-ev-bar" aria-hidden="true"><i style={{ transform: `scaleX(${prog / rows})` }} /></div>
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
                {held ? `Decrypting · ${opened} of ${rows}` : opened ? `Hold to keep going · ${opened} of ${rows}` : "Hold to decrypt"}
            </button>
            <div className="nf-ev-state">
                {opened ? <button type="button" className="nf-ev-mini" onClick={() => done(opened / rows)}>Cash out {opened} {opened === 1 ? "row" : "rows"}</button> : "Every open row is paid out."}
            </div>
        </div>
    );
}

// ---- Relay cascade: relays charge in turn; a full one waits; pressing soon after it fills keeps the chain going
function Relay(p: BodyProps) {
    const total = EVENT_TUNE.relays;
    const [i, setI] = useState(0); // the relay charging or waiting
    const [full, setFull] = useState(false);
    const [chain, setChain] = useState(0);
    const fullAt = useRef(0);
    const chainRef = useRef(0);
    const iRef = useRef(0);
    const done = useDone(p, () => (iRef.current / total) * 0.6);
    useEffect(() => {
        if (i >= total) return;
        setFull(false);
        const t = setTimeout(() => {
            fullAt.current = performance.now();
            setFull(true);
            sfx("tip");
        }, EVENT_TUNE.relayChargeMs);
        return () => clearTimeout(t);
    }, [i, total]);
    const hit = useCallback(() => {
        if (!full || iRef.current >= total) return;
        const quick = performance.now() - fullAt.current <= EVENT_TUNE.relayChainMs;
        if (quick) chainRef.current += 1;
        setChain(chainRef.current);
        sfx(quick ? "collect" : "tap");
        iRef.current += 1;
        setFull(false);
        setI(iRef.current);
        if (iRef.current >= total) done(0.55 + 0.45 * (chainRef.current / total));
    }, [full, total, done]);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (evKeyOff(e)) return;
            if (e.code === "Space" || e.code === "Enter") {
                if ((e.target as HTMLElement)?.tagName === "BUTTON") return;
                e.preventDefault();
                hit();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [hit]);
    return (
        <div className="nf-ev-body">
            <div className="nf-ev-relays">
                {Array.from({ length: total }, (_, n) => {
                    const st = n < i ? "done" : n === i ? (full ? "full" : "charge") : "idle";
                    return (
                        <button key={n} type="button" data-st={st} disabled={st !== "full"} aria-label={st === "full" ? `Relay ${n + 1}, full, press` : `Relay ${n + 1}, ${st}`} onClick={hit}>
                            <i key={st === "charge" ? `c${n}` : st} style={st === "charge" ? { animationDuration: `${EVENT_TUNE.relayChargeMs}ms` } : undefined} />
                            <span>{st === "done" ? "✓" : st === "full" ? "press" : String(n + 1).padStart(2, "0")}</span>
                        </button>
                    );
                })}
            </div>
            <p className="nf-ev-state" aria-live="polite">Chain {chain} of {total} · quick presses roll better loot</p>
        </div>
    );
}

// ---- Dead packet: three presses crack it open
function Packet(p: BodyProps) {
    const need = EVENT_TUNE.packetHits;
    const [hits, setHits] = useState(0);
    const hitsRef = useRef(0);
    const done = useDone(p, () => (hitsRef.current / need) * 0.5);
    const crack = useCallback(() => {
        if (hitsRef.current >= need) return;
        hitsRef.current += 1;
        setHits(hitsRef.current);
        const last = hitsRef.current >= need;
        if (last) setTimeout(() => done(0.6), 320);
        sfx("nfBuy");
    }, [need, done]);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (evKeyOff(e)) return;
            if ((e.code === "Space" || e.code === "Enter") && (e.target as HTMLElement)?.tagName !== "BUTTON") {
                e.preventDefault();
                crack();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [crack]);
    return (
        <div className="nf-ev-body">
            <div className="nf-ev-crate" key={hits} data-shake={hits ? "" : undefined} data-open={hits >= need ? "" : undefined}>
                <EvArt kind="packet" color="#ff4fa3" crack={hits / need} tall />
            </div>
            <button type="button" className="nf-ev-hold" onClick={crack} disabled={hits >= need}>
                {hits >= need ? "Opening" : `Crack · ${hits} of ${need}`}
            </button>
        </div>
    );
}

// ---- dithered art, drawn once per mount on a tiny canvas (4 x 4 Bayer) and scaled up with square pixels
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function EvArt({ kind, color, crack = 0, tall = false }: { kind: EventKind; color: string; crack?: number; tall?: boolean }) {
    const ref = useRef<HTMLCanvasElement>(null);
    const seed = useRef(Math.random() * 10);
    useLayoutEffect(() => {
        const c = ref.current;
        const x = c?.getContext("2d");
        if (!c || !x) return;
        const W = 160, H = tall ? 60 : 44;
        c.width = W;
        c.height = H;
        x.fillStyle = "#070707";
        x.fillRect(0, 0, W, H);
        const sd = seed.current;
        for (let y = 0; y < H; y++)
            for (let i = 0; i < W; i++) {
                let v = 0;
                let col = color;
                const dx = (i - W / 2) / W, dy = (y - H / 2) / H;
                if (kind === "spike") {
                    const wave = H / 2 + Math.sin(i * 0.09 + sd) * H * 0.3 * Math.sin(i * 0.013 + sd);
                    v = Math.max(0, 1 - Math.abs(y - wave) / 7) + (Math.abs(y - wave) < 1 ? 0.5 : 0);
                    if (Math.abs(y - (H - wave)) < 2.5) { v = 0.5; col = "#4aa8ff"; }
                } else if (kind === "rogue") {
                    const r = Math.hypot(dx * 1.6, dy * 2.4);
                    v = Math.max(0, 1 - r * 2.2) + (Math.sin(i * 0.35 + y * 0.2 + sd) > 0.93 ? 0.6 : 0);
                    if (Math.abs(i - W / 2) < 9 && Math.abs(y - H / 2) < 9) { v = 1; col = (i + y) % 6 < 3 ? "#ff2d8a" : color; }
                } else if (kind === "vault") {
                    const cell = (Math.floor(i / 8) * 7 + Math.floor(y / 6) * 13 + Math.floor(sd)) % 5;
                    v = i % 8 && y % 6 ? (cell === 0 ? 1 : 0.25 + cell * 0.1) : 0;
                    v *= Math.max(0, 1.1 - Math.hypot(dx, dy * 0.6) * 1.6);
                    if (cell === 0) col = "#b6f04a";
                } else if (kind === "relay") {
                    const w5 = W / 5, col5 = Math.floor(i / w5), m = i % w5;
                    v = m > 6 && m < w5 - 6 ? Math.max(0, y / H - 0.12 * (4 - col5)) * 1.2 : 0;
                    if (Math.abs(y - H * 0.25 - Math.sin(i * 0.4 + sd) * 3) < 1) { v = 0.9; col = "#fff1c2"; }
                } else {
                    const cx = W / 2, cy = H / 2 + 3;
                    const inBox = Math.abs(i - cx) < 22 && Math.abs(y - cy) < 15;
                    const glow = Math.max(0, 1 - Math.hypot((i - cx) / 60, (y - cy) / 28));
                    if (inBox) v = 0.35 + ((i - cx + 22) % 11 < 2 || (y - cy + 15) % 10 < 2 ? 0.5 : 0);
                    else { v = glow * (0.35 + crack * 0.65); col = y % 2 ? "#ffb02e" : color; }
                    const d = Math.hypot(i - cx, y - cy);
                    if (!inBox && d < 33 && d > 31) v = 0.6;
                    // up to three white cracks through the box
                    for (let k = 0; k < Math.round(crack * 3); k++) {
                        const a = [0.6, -0.8, 1.6][k];
                        if (inBox && Math.abs(i - cx - (y - cy) * a + k * 7 - 7) < 1.2) { v = 1; col = "#fff"; }
                    }
                }
                if (v * 16 > BAYER[(y % 4) * 4 + (i % 4)] + 0.5) {
                    x.fillStyle = col;
                    x.fillRect(i, y, 1, 1);
                }
            }
    }, [kind, color, crack, tall]);
    return <canvas ref={ref} className="nf-ev-art" data-tall={tall ? "" : undefined} aria-hidden="true" />;
}
