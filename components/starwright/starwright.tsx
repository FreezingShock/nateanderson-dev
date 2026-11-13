"use client";

// Starwright: you are a star. Fuse hydrogen up the periodic table, collapse into a supernova, and chart constellations.
// The engine is lib/starwright/engine.ts (pure). This file draws the scene, the fusion ladder and the star chart, runs the
// tick, and saves to this browser. The shared game shell (components/games/shell) pauses nothing here by itself: a manual
// pause stops the tick, and a hidden tab is caught up on return like time away.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useGameShell } from "@/components/games/shell/game-route-shell";
import { createSaveTools, downloadText, readPickedFile, readStored, writeStored } from "@/lib/games/save";
import { CONSTELLATIONS, ELEMENTS, PERKS, PLANETS, PULSAR_PERKS, RECIPE, ROWS, STAGE_NAMES, TIERS, TIER_LEVELS, TIER_NAMES, TUNE, type Perk } from "@/lib/starwright/data";
import { H, W, render, renderBackdrop, type SceneFrame } from "@/lib/starwright/art";
import {
    SAVE_KEY, SAVE_VERSION, blackHole, buy, buyPerk, buyPlanet, buyPulsar, canBlackHole, canBuy, canNeutron, canPlanet, canSupernova, catchUp,
    collapse, cost, effects, fmt, fmtAge, fmtHeat, fresh, gateMK, heaviest, horizonNeed, isSave, levels, load, mass, neutronGain, neutronStar,
    offlineCapS, parse, perkReady, rowOpen, seeds, serialize, stageOf, step, supernova, type State,
} from "@/lib/starwright/engine";

const tools = createSaveTools<State>({ app: "starwright", version: SAVE_VERSION, validate: isSave });

type Panel = null | "stars" | "pulsar" | "orbit" | "menu";
interface Note { id: number; text: string; tone?: "hot" | "dim" }

export function Starwright() {
    const sRef = useRef<State | null>(null);
    const [ready, setReady] = useState(false);
    const [, setTick] = useState(0);
    const bump = useCallback(() => setTick((n) => n + 1), []);
    const [panel, setPanel] = useState<Panel>(null);
    const [notes, setNotes] = useState<Note[]>([]);
    const [ending, setEnding] = useState(false);
    const shell = useGameShell();
    const manualPause = useRef(false);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const novaRef = useRef<number>(-1);
    const noteId = useRef(0);
    const lastHeavy = useRef(0);
    const lastTickAt = useRef(0);
    const [paused, setPaused] = useState(false);
    const [away, setAway] = useState<string | null>(null);

    const note = useCallback((text: string, tone?: Note["tone"]) => {
        const id = ++noteId.current;
        setNotes((n) => [...n.slice(-3), { id, text, tone }]);
        window.setTimeout(() => setNotes((n) => n.filter((x) => x.id !== id)), 9000);
    }, []);

    const save = useCallback(() => {
        const s = sRef.current;
        if (!s) return;
        s.savedAt = Date.now();
        writeStored(window.localStorage, SAVE_KEY, serialize(s));
    }, []);

    // ---- boot: load, catch up on time away ------------------------------------------------------------------------
    useEffect(() => {
        const now = Date.now();
        const loaded = load(window.localStorage);
        const s = loaded ?? fresh(now);
        if (loaded) {
            const gone = (now - s.savedAt) / 1000;
            const f = effects(s);
            const done = catchUp(s, gone);
            if (done > 30) setAway(`The star burned on for ${fmtAge(done)} while you were away${gone > offlineCapS(f) ? ` (it only keeps ${Math.round(offlineCapS(f) / 3600)} hours)` : ""}.`);
        }
        s.savedAt = now;
        sRef.current = s;
        lastHeavy.current = heaviest(s);
        lastTickAt.current = now;
        setReady(true);
    }, []);

    // ---- the tick ------------------------------------------------------------------------------------------------
    useEffect(() => {
        if (!ready) return;
        const id = window.setInterval(() => {
            const s = sRef.current;
            if (!s) return;
            const now = Date.now();
            const gap = (now - lastTickAt.current) / 1000;
            lastTickAt.current = now;
            if (manualPause.current) return;
            if (gap > 3) catchUp(s, gap);
            else step(s, Math.min(gap, 1));
            const h = heaviest(s);
            if (h > lastHeavy.current) {
                const e = ELEMENTS[h];
                note(`${e.name} ignites in the core.`, "hot");
                lastHeavy.current = h;
            }
        }, 100);
        const ui = window.setInterval(bump, 250);
        const sv = window.setInterval(save, 8000);
        const onHide = () => save();
        document.addEventListener("visibilitychange", onHide);
        window.addEventListener("pagehide", onHide);
        return () => {
            window.clearInterval(id);
            window.clearInterval(ui);
            window.clearInterval(sv);
            document.removeEventListener("visibilitychange", onHide);
            window.removeEventListener("pagehide", onHide);
            save();
        };
    }, [ready, bump, save, note]);

    // ---- the scene -----------------------------------------------------------------------------------------------
    useEffect(() => {
        if (!ready) return;
        const c = canvasRef.current;
        const ctx = c?.getContext("2d");
        if (!c || !ctx) return;
        const img = ctx.createImageData(W, H);
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let raf = 0;
        let last = 0;
        const t0 = performance.now();
        const loop = (now: number) => {
            raf = requestAnimationFrame(loop);
            if (document.hidden || now - last < 33) return;
            last = now;
            const s = sRef.current;
            if (!s) return;
            const nova = novaRef.current >= 0 ? (now - novaRef.current) / 2600 : -1;
            if (nova >= 1) novaRef.current = -1;
            const h = heaviest(s);
            const f: SceneFrame = {
                t: (now - t0) / 1000,
                mass: mass(s),
                stage: stageOf(s),
                planets: s.planets,
                ring: h >= 2 ? Math.min(1, (h - 1) / 6) : 0,
                nova: nova >= 1 ? -1 : nova,
                hole: -1,
                pulsars: s.neutronStars,
                reduce,
            };
            render(img, f);
            ctx.putImageData(img, 0, 0);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [ready]);

    // ---- actions -------------------------------------------------------------------------------------------------
    const act = useCallback(
        (fn: (s: State) => unknown) => {
            const s = sRef.current;
            if (!s) return;
            fn(s);
            bump();
        },
        [bump],
    );

    const doBuy = useCallback((i: number, k: number) => act((s) => buy(s, i, k)), [act]);

    const doNova = useCallback(() => {
        act((s) => {
            const g = supernova(s);
            if (g > 0) {
                novaRef.current = performance.now();
                lastHeavy.current = 0;
                note(`Supernova. ${fmt(g)} stardust seeds the next star.`, "hot");
                save();
            }
        });
    }, [act, note, save]);

    const doNeutron = useCallback(() => {
        act((s) => {
            const g = neutronStar(s);
            if (g > 0) {
                novaRef.current = performance.now();
                lastHeavy.current = 0;
                note(`A neutron star forms. ${g} neutrons. Gold and uranium can fuse now.`, "hot");
                save();
            }
        });
    }, [act, note, save]);

    const doHole = useCallback(() => {
        act((s) => {
            if (blackHole(s)) {
                lastHeavy.current = 0;
                setEnding(true);
                save();
            }
        });
    }, [act, save]);

    // console bridge: `sw` talks to the open game
    useEffect(() => {
        if (!ready) return;
        const onLive = (e: Event) => {
            const d = (e as CustomEvent).detail as { live?: unknown };
            d.live = { s: sRef.current, changed: () => { bump(); save(); } };
        };
        const onFs = () => shell.toggleFullscreen();
        window.addEventListener("sw:live", onLive);
        window.addEventListener("sw:fs", onFs);
        return () => {
            window.removeEventListener("sw:live", onLive);
            window.removeEventListener("sw:fs", onFs);
        };
    }, [ready, bump, save, shell]);

    // keys: 1-9 buy tier I of that row (Shift tier II, Alt tier III), C chart, O orbit, M menu, Escape closes
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement | null;
            if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
            if (e.ctrlKey || e.metaKey) return;
            if (e.key === "Escape") { setPanel(null); return; }
            const k = e.key.toLowerCase();
            if (k === "c") setPanel((p) => (p === "stars" ? null : "stars"));
            else if (k === "o") setPanel((p) => (p === "orbit" ? null : "orbit"));
            else if (k === "m") setPanel((p) => (p === "menu" ? null : "menu"));
            else if (/^[1-9]$/.test(e.key) || (e.shiftKey && /^Digit[1-9]$/.test(e.code)) || (e.altKey && /^Digit[1-9]$/.test(e.code))) {
                const row = Number(e.code.replace("Digit", "")) - 1;
                if (row >= 0 && row < ROWS) doBuy(row, e.altKey ? 2 : e.shiftKey ? 1 : 0);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [doBuy]);

    const s = sRef.current;
    if (!ready || !s) {
        return (
            <div className="sw-root sw-boot" aria-busy="true">
                <p>Lighting the star…</p>
            </div>
        );
    }
    const f = effects(s);
    const col = collapse(s, f);
    const stage = stageOf(s);
    const heavy = heaviest(s);

    return (
        <div className="sw-root" data-paused={paused ? "true" : undefined}>
            <header className="sw-top">
                <Link href="/creations/games" className="sw-back">
                    <span aria-hidden="true">&lt;</span> Games
                </Link>
                <h1 className="sw-title">Starwright</h1>
                <nav className="sw-tools" aria-label="Starwright panels">
                    <button type="button" className="sw-tool" aria-label="Constellations" onClick={() => setPanel(panel === "stars" ? null : "stars")} aria-pressed={panel === "stars"} data-ping={PERKS.some((p) => perkReady(PERKS, s.perks, p) && s.stardust >= p.cost) ? "" : undefined}>
                        <span className="sw-ico" data-i="star" aria-hidden="true" />
                        <span className="sw-lbl">Constellations</span><em>{fmt(s.stardust)}</em>
                    </button>
                    {s.neutronStars > 0 && (
                        <button type="button" className="sw-tool" aria-label="Pulsar map" onClick={() => setPanel(panel === "pulsar" ? null : "pulsar")} aria-pressed={panel === "pulsar"} data-ping={PULSAR_PERKS.some((p) => perkReady(PULSAR_PERKS, s.pulsar, p) && s.neutrons >= p.cost) ? "" : undefined}>
                            <span className="sw-ico" data-i="pulse" aria-hidden="true" />
                            <span className="sw-lbl">Pulsar map</span><em>{fmt(s.neutrons)}</em>
                        </button>
                    )}
                    <button type="button" className="sw-tool" aria-label="Orbit" onClick={() => setPanel(panel === "orbit" ? null : "orbit")} aria-pressed={panel === "orbit"} data-ping={PLANETS.some((p) => canPlanet(s, p.id)) ? "" : undefined}>
                        <span className="sw-ico" data-i="orbit" aria-hidden="true" />
                        <span className="sw-lbl">Orbit</span><em>{s.planets.length}/{PLANETS.length}</em>
                    </button>
                    <button type="button" className="sw-tool" onClick={() => setPanel(panel === "menu" ? null : "menu")} aria-pressed={panel === "menu"} aria-label="Menu">
                        <span className="sw-ico" data-i="menu" aria-hidden="true" />
                        <span className="sw-lbl">Menu</span>
                    </button>
                </nav>
            </header>

            <main className="sw-main">
                <section className="sw-scene" aria-label="Your star">
                    <canvas ref={canvasRef} width={W} height={H} className="sw-canvas" role="img" aria-label={`${s.name}, a ${STAGE_NAMES[stage].toLowerCase()}`} />
                    <div className="sw-readout">
                        <span className="sw-tag">STARWRIGHT // {s.name.toUpperCase()}</span>
                        <p>
                            <span>mass <b>{fmt(mass(s))}</b></span>
                            <span>heat <b>{fmtHeat(s.heat)}</b></span>
                            <span>age <b>{fmtAge(s.age)}</b></span>
                        </p>
                        <p className="sw-stage">{STAGE_NAMES[stage]}{s.novasAll ? ` · supernova ${s.novas + 1}` : ""}</p>
                    </div>
                    <ul className="sw-feed" aria-live="polite">
                        {notes.map((n) => (
                            <li key={n.id} data-tone={n.tone}>{n.text}</li>
                        ))}
                    </ul>
                    {paused && <div className="sw-paused" role="status">Paused</div>}
                    <i className="sw-cn" data-c="tl" /><i className="sw-cn" data-c="tr" /><i className="sw-cn" data-c="bl" /><i className="sw-cn" data-c="br" />
                </section>

                <section className="sw-collapse" aria-label="Collapse">
                    {away && (
                        <button type="button" className="sw-away" onClick={() => setAway(null)}>
                            {away} <span>dismiss</span>
                        </button>
                    )}
                    <div className="sw-col-head">
                        <h2>Collapse</h2>
                        <span>{Math.floor(Math.min(col, 1) * 100)}%</span>
                    </div>
                    <div className="sw-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(Math.min(col, 1) * 100)} aria-label="Core collapse">
                        <i style={{ width: `${Math.min(col, 1) * 100}%` }} data-full={col >= 1 ? "" : undefined} />
                    </div>
                    <p className="sw-col-line">
                        {col >= 1 ? "The core is ready." : `Iron ${fmt(s.amt[7])} of ${fmt(TUNE.feNeed * Math.pow(TUNE.needGrow, s.novas) * (1 - f.need))}.`} A supernova seeds <b>{fmt(seeds(s, f))}</b> stardust.
                    </p>
                    <div className="sw-col-acts">
                        <button type="button" className="sw-go" disabled={!canSupernova(s, f)} onClick={doNova}>
                            Go supernova
                        </button>
                        {canNeutron(s) && (
                            <ConfirmGo label={`Form a neutron star · +${neutronGain(s)} neutrons`} sure="Resets stardust and the map. Sure?" onGo={doNeutron} />
                        )}
                        {canBlackHole(s, f) && <ConfirmGo label="Fall into a black hole" sure="Everything restarts for one singularity. Sure?" onGo={doHole} tone="void" />}
                    </div>
                    <p className="sw-hint">{hint(s, f)}</p>
                </section>

                <section className="sw-ladder" aria-label="Fusion ladder">
                    <div className="sw-lad-head">
                        <h2>Fusion ladder</h2>
                        <span>keys 1-9 buy · Shift II · Alt III</span>
                    </div>
                    <ol>
                        {ELEMENTS.map((el, i) => (
                            <Row key={el.sym} s={s} f={f} i={i} onBuy={doBuy} />
                        ))}
                    </ol>
                    {s.neutronStars === 0 && heavy >= 6 && <p className="sw-foot">Iron cannot fuse here. Gold and uranium wait for a neutron star.</p>}
                </section>
            </main>

            {panel === "stars" && <StarChart title="Constellations" s={s} list={PERKS} owned={s.perks} cur={s.stardust} curName="stardust" onBuy={(id) => act((x) => buyPerk(x, id))} onClose={() => setPanel(null)} constellations />}
            {panel === "pulsar" && <StarChart title="Pulsar map" s={s} list={PULSAR_PERKS} owned={s.pulsar} cur={s.neutrons} curName="neutrons" onBuy={(id) => act((x) => buyPulsar(x, id))} onClose={() => setPanel(null)} />}
            {panel === "orbit" && <Orbit s={s} onBuy={(id) => act((x) => { if (buyPlanet(x, id)) note(`${PLANETS.find((p) => p.id === id)?.name} forms in orbit.`); })} onClose={() => setPanel(null)} />}
            {panel === "menu" && (
                <Menu
                    s={s}
                    paused={paused}
                    onPause={() => { manualPause.current = !manualPause.current; setPaused(manualPause.current); lastTickAt.current = Date.now(); }}
                    onClose={() => setPanel(null)}
                    onName={(n) => act((x) => { x.name = n.slice(0, 24) || x.name; })}
                    onImport={(next) => { sRef.current = next; lastHeavy.current = heaviest(next); save(); bump(); note("Save imported."); }}
                    onReset={() => { const n = fresh(); sRef.current = n; lastHeavy.current = 0; writeStored(window.localStorage, SAVE_KEY, serialize(n)); setPanel(null); bump(); }}
                    onExport={() => downloadText(tools.fileName(), tools.exportText(s))}
                    shell={shell}
                />
            )}
            {ending && <Ending count={s.sing} onClose={() => setEnding(false)} />}
        </div>
    );
}

// ---- pieces ---------------------------------------------------------------------------------------------------------

function hint(s: State, f: ReturnType<typeof effects>): string {
    for (let r = 0; r < ROWS; r++) {
        if (!rowOpen(s, r)) return "Gold and uranium wait for a neutron star.";
        if (levels(s, r) === 0) {
            const el = ELEMENTS[r];
            const gate = gateMK(r, f);
            const heat = s.heat >= gate ? "" : ` and core heat ${fmtHeat(gate)}`;
            return `Next: burn ${el.name.toLowerCase()} into ${ELEMENTS[r + 1].name.toLowerCase()}. Needs ${fmt(cost(s, r, 0))} ${el.sym}${heat}.`;
        }
    }
    return s.neutronStars ? `A black hole needs ${fmt(horizonNeed(f))} uranium.` : "Every row burns. Let the iron build.";
}

function Row({ s, f, i, onBuy }: { s: State; f: ReturnType<typeof effects>; i: number; onBuy: (i: number, k: number) => void }) {
    const el = ELEMENTS[i];
    const style = { "--c": el.color } as CSSProperties;
    const seen = s.amt[i] >= 1 || levels(s, i) > 0 || (i > 0 && levels(s, i - 1) > 0) || i === 0;
    const open = i < ROWS ? rowOpen(s, i) : false;
    const gate = i < ROWS ? gateMK(i, f) : 0;
    const cold = i < ROWS && open && levels(s, i) > 0 && s.heat < gate;
    const flow = s.flow?.[i] ?? 0;
    const recipe = i < ROWS ? RECIPE[i].map(([e, q]) => `${q} ${ELEMENTS[e].sym}`).join(" + ") : "";
    let sub: ReactNode;
    if (!seen) sub = <span className="sw-dim">locked</span>;
    else if (i === ROWS) sub = <span className="sw-dim">the end of the ladder</span>;
    else if (!open) sub = <span className="sw-warn">needs a neutron star</span>;
    else if (cold) sub = <span className="sw-warn">cold: needs {fmtHeat(gate)}</span>;
    else sub = <span className="sw-dim">{recipe} → {ELEMENTS[i + 1].sym} · {fmtHeat(gate)}</span>;
    return (
        <li className="sw-row" style={style} data-seen={seen ? "" : undefined} data-open={open ? "" : undefined}>
            <span className="sw-tile" aria-hidden="true">{el.sym}</span>
            <div className="sw-info">
                <b>{el.name}{i < ROWS && seen && levels(s, i) > 0 && <small title="Burner levels">L{fmt(levels(s, i))}</small>}</b>
                <span className="sw-amt">
                    {seen ? fmt(s.amt[i]) : "0"}
                    {seen && Math.abs(flow) >= 0.01 && <em data-neg={flow < 0 ? "" : undefined}>{flow > 0 ? "+" : "−"}{fmt(Math.abs(flow))}/s</em>}
                </span>
                {sub}
            </div>
            {i < ROWS && (
                <div className="sw-btns" role="group" aria-label={`Burn ${el.name}`}>
                    {Array.from({ length: TIERS }, (_, k) => {
                        const c = cost(s, i, k);
                        const ok = seen && canBuy(s, i, k);
                        return (
                            <button key={k} type="button" className="sw-btn" data-tier={k} disabled={!ok} onClick={() => onBuy(i, k)} title={`${el.name} burner ${TIER_NAMES[k]}: +${TIER_LEVELS[k]} level${TIER_LEVELS[k] > 1 ? "s" : ""}. Costs ${fmt(c)} ${el.sym}.`} aria-label={`${el.name} burner ${TIER_NAMES[k]}, +${TIER_LEVELS[k]}, costs ${fmt(c)} ${el.sym}`}>
                                <b>{TIER_NAMES[k]}</b>
                                <i>+{TIER_LEVELS[k]}</i>
                                <em>{seen ? fmt(c) : "—"}</em>
                            </button>
                        );
                    })}
                </div>
            )}
        </li>
    );
}

function ConfirmGo({ label, sure, onGo, tone }: { label: string; sure: string; onGo: () => void; tone?: "void" }) {
    const [ask, setAsk] = useState(false);
    useEffect(() => {
        if (!ask) return;
        const t = window.setTimeout(() => setAsk(false), 6000);
        return () => window.clearTimeout(t);
    }, [ask]);
    return (
        <button type="button" className="sw-go sw-go2" data-tone={tone} onClick={() => (ask ? onGo() : setAsk(true))}>
            {ask ? sure : label}
        </button>
    );
}

function Overlay({ title, sub, onClose, children, wide }: { title: string; sub?: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
    // Clicking blank space (the backdrop) closes it, like every menu on the site.
    return (
        <div className="sw-over" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="sw-card" data-wide={wide ? "" : undefined}>
                <div className="sw-card-head">
                    <h2>{title}</h2>
                    {sub && <span>{sub}</span>}
                    <button type="button" className="sw-x" onClick={onClose} aria-label="Close">Esc</button>
                </div>
                {children}
                <i className="sw-cn" data-c="tl" /><i className="sw-cn" data-c="tr" /><i className="sw-cn" data-c="bl" /><i className="sw-cn" data-c="br" />
            </div>
        </div>
    );
}

function Orbit({ s, onBuy, onClose }: { s: State; onBuy: (id: string) => void; onClose: () => void }) {
    const f = effects(s);
    return (
        <Overlay title="Orbit" sub={`${s.planets.length} of ${PLANETS.length} formed${f.keepPlanets ? " · they survive supernovas" : " · a supernova strips them"}`} onClose={onClose} wide>
            <ul className="sw-planets">
                {PLANETS.map((p) => {
                    const own = s.planets.includes(p.id);
                    const ok = canPlanet(s, p.id);
                    return (
                        <li key={p.id} style={{ "--c": p.color } as CSSProperties} data-own={own ? "" : undefined}>
                            <span className="sw-orb" aria-hidden="true" data-big={p.size > 4 ? "" : undefined} data-ring={p.id === "seer" ? "" : undefined} />
                            <div>
                                <b>{p.name}</b> <span className="sw-dim">{p.kind}</span>
                                <p>{p.bonus}{f.planet ? ` (+${Math.round(f.planet * 100)}% from Halo)` : ""}</p>
                                <p className="sw-cost">
                                    {own ? "in orbit" : p.cost.map(([e, q], n) => <span key={n} style={{ "--c": ELEMENTS[e].color } as CSSProperties} data-short={s.amt[e] < q ? "" : undefined}>{fmt(q)} {ELEMENTS[e].sym}</span>)}
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

function StarChart({ title, s, list, owned, cur, curName, onBuy, onClose, constellations }: { title: string; s: State; list: Perk[]; owned: string[]; cur: number; curName: string; onBuy: (id: string) => void; onClose: () => void; constellations?: boolean }) {
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
        <div className="sw-chart" role="dialog" aria-modal="true" aria-label={title}>
            <canvas ref={bg} width={W} height={H} className="sw-chart-bg" aria-hidden="true" />
            <div className="sw-chart-top">
                <h2>{title}</h2>
                <span>{curName} <b>{fmt(cur)}</b></span>
                <button type="button" className="sw-x" onClick={onClose} aria-label="Close">Esc</button>
            </div>
            <div className="sw-chart-scroll" onClick={(e) => { if (e.target === e.currentTarget) { if (sel) setSel(null); else onClose(); } }}>
                <svg viewBox="0 0 1000 600" className="sw-svg" role="group" aria-label={title} onClick={(e) => { if ((e.target as Element).tagName === "svg") { if (sel) setSel(null); else onClose(); } }}>
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
                <div className="sw-pick" style={{ "--c": color(picked) } as CSSProperties}>
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
                </div>
            )}
            <p className="sw-chart-foot">{constellations ? "Stardust lights stars. They stay through every supernova and reset on a neutron star." : "Neutrons light the pulsar map. It stays until a black hole."} Click empty sky to close.</p>
        </div>
    );
}

function Menu({ s, paused, onPause, onClose, onName, onImport, onReset, onExport, shell }: { s: State; paused: boolean; onPause: () => void; onClose: () => void; onName: (n: string) => void; onImport: (s: State) => void; onReset: () => void; onExport: () => void; shell: ReturnType<typeof useGameShell> }) {
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
        <Overlay title="Menu" onClose={onClose}>
            <div className="sw-menu">
                <label className="sw-field">
                    <span>Star name</span>
                    <input defaultValue={s.name} maxLength={24} onChange={(e) => onName(e.target.value)} spellCheck={false} autoComplete="off" />
                </label>
                <div className="sw-menu-row">
                    <button type="button" className="sw-go" onClick={onPause}>{paused ? "Resume" : "Pause"}</button>
                    {shell.supportsFullscreen && <button type="button" className="sw-go" onClick={shell.toggleFullscreen}>{shell.fullscreen ? "Exit full screen" : "Full screen"}</button>}
                    <button type="button" className="sw-go" onClick={onExport}>Export save</button>
                    <button type="button" className="sw-go" onClick={() => file.current?.click()}>Import save</button>
                    <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
                </div>
                {msg && <p className="sw-msg" role="status">{msg}</p>}
                <dl className="sw-keys">
                    <dt>1 to 9</dt><dd>buy tier I of that row (Shift: II, Alt: III)</dd>
                    <dt>C · O · M</dt><dd>constellations, orbit, menu</dd>
                    <dt>Esc</dt><dd>close a panel</dd>
                    <dt>` or Ctrl+J</dt><dd>the console: sw stats, sw fuse he 2, sw collapse</dd>
                </dl>
                <p className="sw-dim sw-small">Saves in this browser. Away time counts up to {TUNE.offlineH} hours. A hidden tab catches up when you return. Played for {fmtAge(s.totalAge)}.</p>
                <button type="button" className="sw-reset" onClick={() => (sure ? onReset() : setSure(true))}>{sure ? "This erases the save. Press again to confirm." : "Reset the game"}</button>
            </div>
        </Overlay>
    );
}

function Ending({ count, onClose }: { count: number; onClose: () => void }) {
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
            <div className="sw-end-copy">
                <h2>It falls in.</h2>
                <p>Everything the star made, gold and uranium and all the iron before them, folds into one point. Nothing leaves. Somewhere far off, a cloud of hydrogen starts to turn.</p>
                <p className="sw-dim">{count} {count === 1 ? "singularity" : "singularities"}. Each doubles everything in every star that follows.</p>
                <button type="button" className="sw-go" onClick={onClose}>Light another star</button>
            </div>
        </div>
    );
}
