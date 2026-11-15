"use client";

// The menus that open over the star: Almanac, Orbit, Constellations and Pulsar map, Menu, the birth-cloud picker, the visitor
// card and the ending. Each opens and closes with its own animation (data-kind in app/camino/starwright.css).
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useGameShell } from "@/components/games/shell/game-route-shell";
import { createSaveTools, readPickedFile } from "@/lib/games/save";
import { ACHIEVEMENTS, ACH_BONUS, CLOUDS, CODEX, CONSTELLATIONS, ELEMENTS, EVENT_STAY, PLANETS, TUNE, type Perk } from "@/lib/starwright/data";
import { H, W, render, renderBackdrop } from "@/lib/starwright/art";
import { SAVE_VERSION, canPlanet, effects, eventOf, fmt, fmtAge, isSave, parse, perkReady, type State } from "@/lib/starwright/engine";
import { cloudArt, cssUrl, planetIcon } from "@/lib/starwright/ui-art";
import { ElTile, Gl } from "./sw-ui";

export const tools = createSaveTools<State>({ app: "starwright", version: SAVE_VERSION, validate: isSave });

export type Kind = "iris" | "shutter" | "wipe" | "settle";
const Corners = () => <><i className="sw-cn" data-c="tl" /><i className="sw-cn" data-c="tr" /><i className="sw-cn" data-c="bl" /><i className="sw-cn" data-c="br" /></>;

export function Overlay({ title, sub, onClose, children, wide, kind, leaving }: { title: string; sub?: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean; kind: Kind; leaving?: boolean }) {
    // Clicking blank space (the backdrop) closes it, like every menu on the site.
    return (
        <div className="sw-over" role="dialog" aria-modal="true" aria-label={title} data-leaving={leaving ? "" : undefined} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="sw-card sw-panel" data-wide={wide ? "" : undefined} data-kind={kind}>
                <div className="sw-card-head">
                    <h2>{title}</h2>
                    {sub && <span>{sub}</span>}
                    <button type="button" className="sw-x" onClick={onClose} aria-label="Close" data-tip="Close|Esc or click empty space"><Gl n="cross" s={1} /></button>
                </div>
                <i className="sw-rule" aria-hidden="true" />
                {children}
                <Corners />
            </div>
        </div>
    );
}

// ---- Almanac ---------------------------------------------------------------------------------------------------------------

export function Almanac({ s, onClose, leaving }: { s: State; onClose: () => void; leaving?: boolean }) {
    const [sel, setSel] = useState<number | null>(null);
    return (
        <Overlay title="Almanac" sub={`${s.ach.length} of ${ACHIEVEMENTS.length} · everything +${Math.round(ACH_BONUS * 100 * s.ach.length)}%`} onClose={onClose} wide kind="wipe" leaving={leaving}>
            <div className="sw-scroll">
                <h3 className="sw-h3">Elements made</h3>
                <ul className="sw-codex">
                    {ELEMENTS.map((e, i) => {
                        const own = s.found.includes(e.sym);
                        return (
                            <li key={e.sym} style={{ "--c": e.color } as CSSProperties} data-own={own ? "" : undefined} data-sel={sel === i ? "" : undefined} data-tip={own ? `${e.name}|${CODEX[e.sym]}` : "Not yet made|Fuse your way up the ladder."}>
                                <button type="button" className="sw-cx" onClick={() => setSel(sel === i ? null : i)} aria-label={own ? e.name : "Not yet made"}>
                                    <ElTile i={i} locked={!own} />
                                    <b>{own ? e.name : "?"}</b>
                                </button>
                            </li>
                        );
                    })}
                </ul>
                {sel !== null && <p className="sw-fact">{s.found.includes(ELEMENTS[sel].sym) ? CODEX[ELEMENTS[sel].sym] : "Fuse your way up the ladder to find out."}</p>}
                <h3 className="sw-h3">Milestones <small>+{Math.round(ACH_BONUS * 100)}% to everything each</small></h3>
                <ul className="sw-ach">
                    {ACHIEVEMENTS.map((a) => {
                        const own = s.ach.includes(a.id);
                        return (
                            <li key={a.id} data-own={own ? "" : undefined} data-tip={`${a.name}|${a.desc}`}>
                                <span className="sw-medal"><Gl n={own ? "medal" : "lock"} s={2} /></span>
                                <b>{a.name}</b>
                                <span>{a.desc}</span>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </Overlay>
    );
}

// ---- Orbit ----------------------------------------------------------------------------------------------------------------

export function Orbit({ s, onBuy, onClose, leaving }: { s: State; onBuy: (id: string) => void; onClose: () => void; leaving?: boolean }) {
    const f = effects(s);
    return (
        <Overlay title="Orbit" sub={`${s.planets.length} of ${PLANETS.length} formed${f.keepPlanets ? " · they survive supernovas" : " · a supernova strips them"}`} onClose={onClose} wide kind="shutter" leaving={leaving}>
            <ul className="sw-planets">
                {PLANETS.map((p) => {
                    const own = s.planets.includes(p.id);
                    const ok = canPlanet(s, p.id);
                    return (
                        <li key={p.id} style={{ "--c": p.color } as CSSProperties} data-own={own ? "" : undefined} data-ok={ok ? "" : undefined}>
                            <span className="sw-orb" style={{ backgroundImage: cssUrl(planetIcon(p.id, p.color, p.size)) }} data-tip={`${p.name}|${p.kind}`} />
                            <div className="sw-pl-body">
                                <b>{p.name}</b>
                                <p>{p.bonus}{f.planet ? ` (+${Math.round(f.planet * 100)}% Halo)` : ""}</p>
                                <p className="sw-cost">
                                    {own ? <em>in orbit</em> : p.cost.map(([e, q], n) => (
                                        <span key={n} style={{ "--c": ELEMENTS[e].color } as CSSProperties} data-short={s.amt[e] < q ? "" : undefined} data-tip={`${ELEMENTS[e].name}|you hold ${fmt(s.amt[e])}`}>
                                            <ElTile i={e} size={1} />{fmt(q)}
                                        </span>
                                    ))}
                                </p>
                            </div>
                            {!own && <button type="button" className="sw-go" disabled={!ok} onClick={() => onBuy(p.id)}>Form</button>}
                        </li>
                    );
                })}
            </ul>
        </Overlay>
    );
}

// ---- Constellations / Pulsar map --------------------------------------------------------------------------------------------

export function StarChart({ title, list, owned, cur, curName, onBuy, onClose, constellations, leaving }: { title: string; list: Perk[]; owned: string[]; cur: number; curName: string; onBuy: (id: string) => void; onClose: () => void; constellations?: boolean; leaving?: boolean }) {
    const [sel, setSel] = useState<string | null>(null);
    const bg = useRef<HTMLCanvasElement | null>(null);
    useEffect(() => {
        const ctx = bg.current?.getContext("2d");
        if (!ctx) return;
        const img = ctx.createImageData(W, H);
        renderBackdrop(img, 0);
        ctx.putImageData(img, 0, 0);
    }, []);
    const picked = list.find((p) => p.id === sel) ?? null;
    const color = (p: Perk) => CONSTELLATIONS.find((c) => c.id === p.con)?.color ?? "#9fd0ff";
    const P = (p: Perk) => [p.at[0] * 10, p.at[1] * 5.6 + 20];
    const stateOf = (p: Perk) => (owned.includes(p.id) ? "own" : perkReady(list, owned, p) ? (cur >= p.cost ? "buy" : "near") : "lock");
    return (
        <div className="sw-chart" role="dialog" aria-modal="true" aria-label={title} data-kind="iris" data-leaving={leaving ? "" : undefined}>
            <canvas ref={bg} width={W} height={H} className="sw-chart-bg" aria-hidden="true" />
            <div className="sw-chart-top">
                <h2>{title}</h2>
                <span>{curName} <b>{fmt(cur)}</b></span>
                <button type="button" className="sw-x" onClick={onClose} aria-label="Close" data-tip="Close|Esc or click empty sky"><Gl n="cross" s={1} /></button>
            </div>
            <div className="sw-chart-scroll" onClick={(e) => { if (e.target === e.currentTarget) { if (sel) setSel(null); else onClose(); } }}>
                <svg viewBox="0 0 1000 600" className="sw-svg" role="group" aria-label={title} shapeRendering="crispEdges" onClick={(e) => { if ((e.target as Element).tagName === "svg") { if (sel) setSel(null); else onClose(); } }}>
                    {list.map((p) => p.req.map((r) => {
                        const a = list.find((x) => x.id === r);
                        if (!a) return null;
                        const [x1, y1] = P(a), [x2, y2] = P(p);
                        const lit = owned.includes(a.id) && owned.includes(p.id);
                        return <line key={`${r}-${p.id}`} x1={x1} y1={y1} x2={x2} y2={y2} className="sw-edge" data-lit={lit ? "" : undefined} style={{ stroke: color(p) }} />;
                    }))}
                    {constellations && CONSTELLATIONS.map((c) => {
                        const ps = list.filter((p) => p.con === c.id);
                        const x = ps.reduce((a, p) => a + P(p)[0], 0) / ps.length, y = Math.min(...ps.map((p) => P(p)[1])) - 44;
                        return <text key={c.id} x={x} y={y} className="sw-conname" textAnchor="middle" style={{ fill: c.color }}>{c.name.toUpperCase()}</text>;
                    })}
                    {list.map((p) => {
                        const [x, y] = P(p);
                        const st = stateOf(p);
                        return (
                            <g key={p.id} className="sw-node" data-st={st} data-sel={sel === p.id ? "" : undefined} transform={`translate(${x} ${y})`} style={{ "--c": color(p) } as CSSProperties} role="button" tabIndex={0} aria-label={`${p.name}, ${st === "own" ? "owned" : `costs ${p.cost}`}`} onClick={(e) => { e.stopPropagation(); setSel(p.id); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(p.id); } }}>
                                <circle r="30" className="sw-hit" />
                                <circle r="17" className="sw-halo" />
                                <path className="sw-star" d="M0 -13 L3.4 -3.4 L13 0 L3.4 3.4 L0 13 L-3.4 3.4 L-13 0 L-3.4 -3.4 Z" />
                                <text y="32" className="sw-nodename" textAnchor="middle">{p.name}</text>
                            </g>
                        );
                    })}
                </svg>
            </div>
            {picked && (
                <div className="sw-pick sw-panel" style={{ "--c": color(picked) } as CSSProperties}>
                    <div>
                        <b>{picked.name}</b>
                        <p>{picked.desc}</p>
                        <p className="sw-dim">{picked.req.length ? `needs ${picked.req.map((r) => list.find((x) => x.id === r)?.name).join(", ")} · ` : ""}{stateOf(picked) === "own" ? "owned" : `costs ${fmt(picked.cost)} ${curName}`}</p>
                    </div>
                    {stateOf(picked) !== "own" && (
                        <button type="button" className="sw-go" disabled={stateOf(picked) !== "buy"} onClick={() => onBuy(picked.id)}>
                            {stateOf(picked) === "lock" ? "Locked" : stateOf(picked) === "near" ? "Not enough" : "Light it"}
                        </button>
                    )}
                    <Corners />
                </div>
            )}
            <p className="sw-chart-foot">{constellations ? "Stardust lights stars. They stay through every supernova and reset on a neutron star." : "Neutrons light the pulsar map. It stays until a black hole."}</p>
        </div>
    );
}

// ---- Menu -----------------------------------------------------------------------------------------------------------------

export function Menu({ sound, onSound, s, paused, onPause, onClose, onName, onImport, onReset, onExport, leaving }: { sound: boolean; onSound: () => void; s: State; paused: boolean; onPause: () => void; onClose: () => void; onName: (n: string) => void; onImport: (s: State) => void; onReset: () => void; onExport: () => void; leaving?: boolean }) {
    const shell = useGameShell();
    const [msg, setMsg] = useState("");
    const [sure, setSure] = useState(false);
    const file = useRef<HTMLInputElement | null>(null);
    const pick = async (f: File | undefined) => {
        if (!f) return;
        const r = await readPickedFile(f);
        if (!r.ok) return setMsg(r.error);
        const res = tools.importText(r.data);
        if (!res.ok) return setMsg(res.error);
        const next = parse(res.data);
        if (!next) return setMsg("That save is damaged and cannot be loaded.");
        onImport(next);
        setMsg("Save imported.");
    };
    return (
        <Overlay title="Menu" onClose={onClose} kind="settle" leaving={leaving}>
            <div className="sw-menu">
                <label className="sw-field">
                    <span>Star name</span>
                    <input defaultValue={s.name} maxLength={24} onChange={(e) => onName(e.target.value)} spellCheck={false} autoComplete="off" />
                </label>
                <div className="sw-ibtns">
                    <button type="button" className="sw-ibtn" onClick={onPause} data-tip={paused ? "Resume|The star burns again." : "Pause|Stops the clock until you resume."}><Gl n={paused ? "play" : "pause"} s={3} /><span>{paused ? "Resume" : "Pause"}</span></button>
                    {shell.supportsFullscreen && <button type="button" className="sw-ibtn" onClick={shell.toggleFullscreen} data-tip="Full screen|Hides the browser frame."><Gl n="full" s={3} /><span>{shell.fullscreen ? "Exit" : "Full"}</span></button>}
                    <button type="button" className="sw-ibtn" onClick={onSound} aria-pressed={sound} data-tip={sound ? "Sound on|Click to mute." : "Sound off|Click to turn it on."}><Gl n={sound ? "sound" : "mute"} s={3} /><span>{sound ? "On" : "Off"}</span></button>
                    <button type="button" className="sw-ibtn" onClick={onExport} data-tip="Export save|Downloads a file you can keep."><Gl n="export" s={3} /><span>Export</span></button>
                    <button type="button" className="sw-ibtn" onClick={() => file.current?.click()} data-tip="Import save|Replaces this game with a file."><Gl n="import" s={3} /><span>Import</span></button>
                    <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
                </div>
                {msg && <p className="sw-msg" role="status">{msg}</p>}
                <dl className="sw-keys">
                    <dt>1 to 9</dt><dd>buy tier I (Shift II, Alt III)</dd>
                    <dt>C · O · A · M</dt><dd>stars, orbit, almanac, menu</dd>
                    <dt>Esc</dt><dd>close a panel</dd>
                    <dt>` · Ctrl+J</dt><dd>console: sw stats, sw fuse he 2</dd>
                </dl>
                <p className="sw-dim sw-small">Saves in this browser. Away time counts up to {TUNE.offlineH} hours. Played for {fmtAge(s.totalAge)}.</p>
                <button type="button" className="sw-reset" onClick={() => (sure ? onReset() : setSure(true))}>{sure ? "This erases the save. Press again." : "Reset the game"}</button>
            </div>
        </Overlay>
    );
}

// ---- visitor card ----------------------------------------------------------------------------------------------------------

export function Visitor({ s, onAnswer }: { s: State; onAnswer: (pick: number) => void }) {
    const ev = eventOf(s);
    if (!ev || !s.event) return null;
    return (
        <div className="sw-visitor sw-panel" role="group" aria-label={ev.name}>
            <div className="sw-visitor-top">
                <b>{ev.name}</b>
                <span>{Math.ceil(s.event.left)}s</span>
            </div>
            <p>{ev.text}</p>
            <div className="sw-visitor-opts">
                {ev.opts.map((o, i) => (
                    <button key={o.id} type="button" className="sw-opt" onClick={() => onAnswer(i)}>
                        <b>{o.label}</b>
                        <span>{o.desc}</span>
                    </button>
                ))}
            </div>
            <i className="sw-visitor-bar" style={{ width: `${Math.max(0, (s.event.left / EVENT_STAY) * 100)}%` }} />
            <Corners />
        </div>
    );
}

// ---- birth clouds ----------------------------------------------------------------------------------------------------------

const CLOUD_COLOR: Record<string, string> = { dense: "#5fb4ff", hot: "#ff7a4d", rich: "#ffd75e", thin: "#c9e6ff", dusty: "#c8a0ff", quiet: "#3fe0a0" };
export function CloudPick({ s, onPick }: { s: State; onPick: (id: string) => void }) {
    return (
        <div className="sw-clouds sw-panel" role="group" aria-label="Birth cloud">
            <p className="sw-clouds-h">A new star. Pick its birth cloud.</p>
            <div>
                {s.offer.map((id) => {
                    const c = CLOUDS.find((x) => x.id === id)!;
                    return (
                        <button key={id} type="button" className="sw-cloud" style={{ "--c": CLOUD_COLOR[id] ?? "#ffb24d" } as CSSProperties} onClick={() => onPick(id)}>
                            <span className="sw-cloud-art" aria-hidden="true" style={{ backgroundImage: cssUrl(cloudArt(id, CLOUD_COLOR[id] ?? "#ffb24d")) }} />
                            <b>{c.name}</b>
                            <span>{c.desc}</span>
                        </button>
                    );
                })}
            </div>
            <Corners />
        </div>
    );
}

// ---- ending ---------------------------------------------------------------------------------------------------------------

export function Ending({ count, onClose }: { count: number; onClose: () => void }) {
    const ref = useRef<HTMLCanvasElement | null>(null);
    useEffect(() => {
        const ctx = ref.current?.getContext("2d");
        if (!ctx) return;
        const img = ctx.createImageData(W, H);
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const t0 = performance.now();
        let raf = 0;
        let last = 0;
        const loop = (now: number) => {
            raf = requestAnimationFrame(loop);
            if (now - last < 40) return;
            last = now;
            const t = (now - t0) / 1000;
            render(img, { t, mass: 1, stage: 0, planets: [], ring: 0, nova: -1, hole: reduce ? 1 : Math.min(1, t / 4), pulsars: 0, reduce });
            ctx.putImageData(img, 0, 0);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, []);
    return (
        <div className="sw-end" role="dialog" aria-modal="true" aria-label="The star falls in">
            <canvas ref={ref} width={W} height={H} className="sw-canvas" aria-hidden="true" />
            <div className="sw-end-copy sw-panel">
                <h2>It falls in.</h2>
                <p>Everything the star made, gold and uranium and all the iron before them, folds into one point. Nothing leaves. Somewhere far off, a cloud of hydrogen starts to turn.</p>
                <p className="sw-dim">{count} {count === 1 ? "singularity" : "singularities"}. Each doubles everything in every star that follows.</p>
                <button type="button" className="sw-go" onClick={onClose}>Light another star</button>
                <Corners />
            </div>
        </div>
    );
}
