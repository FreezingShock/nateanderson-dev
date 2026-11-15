"use client";

// Starwright: you are a star. Fuse hydrogen up the periodic table, collapse into a supernova, and chart constellations.
// The engine is lib/starwright/engine.ts (pure). This file draws the scene, the fusion ladder and the star chart, runs the
// tick, and saves to this browser. The shared game shell (components/games/shell) pauses nothing here by itself: a manual
// pause stops the tick, and a hidden tab is caught up on return like time away.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useGameShell } from "@/components/games/shell/game-route-shell";
import { downloadText, writeStored } from "@/lib/games/save";
import { ACHIEVEMENTS, ACH_BONUS, CLOUDS, ELEMENTS, EVENT_STAY, PERKS, PLANETS, PULSAR_PERKS, RECIPE, ROWS, STAGE_NAMES, TIERS, TIER_LEVELS, TIER_NAMES, TUNE } from "@/lib/starwright/data";
import { play, setSound, soundOn } from "@/lib/starwright/sound";
import { REPORT_MIN, advance, autoAnswer, awayReport, loadSession, saveAway, snap, writeBackup, type Snap } from "@/lib/starwright/session";
import { getSettings, unlocked } from "@/lib/starwright/settings";
import { H, W, makeLayers, render, renderLayered, type SceneFrame } from "@/lib/starwright/art";
import { initSprites, sprites } from "@/lib/starwright/sprites";
import {
    SAVE_KEY, answer, guide, blackHole, buy, checkAch, chooseCloud, eventOf, rowMult, buyPerk, buyDeep, deepCost, buyPlanet, buyPulsar, canBlackHole, canBuy, canNeutron, canPlanet, canSupernova,
    collapse, cost, effects, fmt, fmtAge, fmtHeat, fresh, gateMK, heaviest, horizonNeed, levels, mass, neutronGain, neutronStar,
    perkReady, planetStage, rowOpen, seeds, serialize, stageOf, supernova, type State,
} from "@/lib/starwright/engine";
import { uiVars } from "@/lib/starwright/ui-art";
import { Almanac, CloudPick, Ending, Menu, Orbit, StarChart, Visitor, tools } from "./panels";
import { AwayCard } from "./settings";
import { ElTile, Gl, Pic, ui, useLeaving, useSheets, useTips } from "./sw-ui";

type Panel = null | "stars" | "pulsar" | "orbit" | "almanac" | "menu";
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
    const tips = useTips();
    const { shown, leaving } = useLeaving(panel);
    const manualPause = useRef(false);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const novaRef = useRef<number>(-1);
    const novaFrom = useRef(0);
    const novaKind = useRef(0);
    const stageRef = useRef({ now: 0, from: 0, at: -1e9 });
    const lastNovaAt = useRef(0);
    const noteId = useRef(0);
    const lastHeavy = useRef(0);
    const lastTickAt = useRef(0);
    const lastMult = useRef<number[]>([]);
    const lastEvent = useRef<string | null>(null);
    const lastAch = useRef(0);
    const [sound, setSoundState] = useState(true);
    const [paused, setPaused] = useState(false);
    const [card, setCard] = useState<{ title: string; lines: string[] } | null>(null);
    const readOnly = useRef(false);
    const [other, setOther] = useState(false);
    const tabCh = useRef<{ ch: BroadcastChannel; id: string } | null>(null);
    const saveFailAt = useRef(0);
    const lastBackup = useRef(Date.now());

    const note = useCallback((text: string, tone?: Note["tone"], force = false) => {
        if (!force && !getSettings().notices) return;
        const id = ++noteId.current;
        setNotes((n) => [...n.slice(-3), { id, text, tone }]);
        window.setTimeout(() => setNotes((n) => n.filter((x) => x.id !== id)), 9000);
    }, []);

    const save = useCallback(() => {
        const s = sRef.current;
        if (!s || readOnly.current) return;
        s.savedAt = Date.now();
        if (!writeStored(window.localStorage, SAVE_KEY, serialize(s)) && Date.now() - saveFailAt.current > 300000) {
            saveFailAt.current = Date.now();
            note("Could not save: this browser's storage is full or blocked. Export a save from the menu to keep your star.", "hot", true);
        }
    }, [note]);

    // ---- boot: load, catch up on time away ------------------------------------------------------------------------
    useEffect(() => {
        const now = Date.now();
        const ld = loadSession(window.localStorage, now);
        const loaded = ld.state;
        const s = loaded ?? fresh(now);
        if (ld.status === "restored") s.savedAt = now;
        if (ld.note) setCard({ title: "Save problem", lines: [ld.note] });
        else if (loaded) {
            const gone = (now - s.savedAt) / 1000;
            const before: Snap = snap(s);
            const done = advance(s, gone);
            if (done >= REPORT_MIN) {
                const r = awayReport(before, s, done, gone, now);
                saveAway(window.localStorage, r);
                if (getSettings().welcome) setCard({ title: "Welcome back", lines: r.lines });
            }
        }
        s.savedAt = now;
        sRef.current = s;
        lastHeavy.current = heaviest(s);
        lastTickAt.current = now;
        lastMult.current = s.bought.map((_, i) => rowMult(s, i));
        stageRef.current = { now: stageOf(s), from: stageOf(s), at: -1e9 };
        lastEvent.current = s.event?.id ?? null;
        checkAch(s);
        setSoundState(soundOn());
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
            // every gap counts: short ones are one step, long ones (a stalled frame, a hidden tab) are caught up like time away
            const before = gap > 2 ? snap(s) : null;
            const done = advance(s, gap);
            if (before && done >= REPORT_MIN) {
                const r = awayReport(before, s, done, gap);
                saveAway(window.localStorage, r);
                if (getSettings().welcome) setCard({ title: "Welcome back", lines: r.lines });
            }
            const h = heaviest(s);
            if (h > lastHeavy.current) {
                const e = ELEMENTS[h];
                note(`${e.name} ignites in the core.`, "hot");
                play("ignite");
                lastHeavy.current = h;
            }
            if (Date.now() - lastAch.current > 1000) {
                lastAch.current = Date.now();
                for (const id of checkAch(s)) {
                    note(`Almanac: ${ACHIEVEMENTS.find((a) => a.id === id)?.name}. Everything +${Math.round(ACH_BONUS * 100)}%.`, "hot");
                    play("badge");
                }
            }
            const ev = s.event?.id ?? null;
            if (ev && ev !== lastEvent.current) play("visitor");
            lastEvent.current = ev;
        }, 100);
        const ui = window.setInterval(bump, 250);
        const sv = window.setInterval(() => {
            save();
            const s = sRef.current;
            if (s && Date.now() - lastBackup.current > 600000) { lastBackup.current = Date.now(); writeBackup(window.localStorage, s); }
        }, 8000);
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
        const layers = makeLayers(ctx);
        initSprites();
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let raf = 0;
        let last = 0;
        const t0 = performance.now();
        const loop = (now: number) => {
            raf = requestAnimationFrame(loop);
            if (document.hidden || now - last < (getSettings().fx === "simple" ? 66 : 33)) return;
            last = now;
            const s = sRef.current;
            if (!s) return;
            const nova = novaRef.current >= 0 ? (now - novaRef.current) / 3400 : -1;
            if (nova >= 1) novaRef.current = -1;
            const h = heaviest(s);
            const st = stageOf(s);
            const sr = stageRef.current;
            if (st !== sr.now) {
                // a stage change on its own (not a collapse) runs a shift from the old look to the new one
                if (novaRef.current < 0 && now - sr.at > 200) { sr.from = sr.now; sr.at = now; }
                sr.now = st;
            }
            const sinceNova = novaRef.current >= 0 ? now - novaRef.current : 1e9;
            const bornAt = novaRef.current >= 0 ? novaRef.current + 1900 : lastNovaAt.current + 1900;
            const ev = s.event;
            const f: SceneFrame = {
                t: (now - t0) / 1000,
                mass: mass(s),
                stage: st,
                planets: s.planets,
                ring: h >= 2 ? Math.min(1, (h - 1) / 6) : 0,
                nova: nova >= 1 ? -1 : nova,
                hole: -1,
                pulsars: s.neutronStars,
                reduce,
                fromStage: sr.from,
                shift: Math.min(1, (now - sr.at) / 2800),
                born: sinceNova < 1e9 || lastNovaAt.current > 0 ? Math.min(1, Math.max(0, (now - bornAt) / 2600)) : 1,
                collapse: collapse(s, effects(s)),
                sky: s.sing > 0 ? 2 : s.neutronStars > 0 ? 1 : 0,
                planetStages: Object.fromEntries(s.planets.map((id) => [id, planetStage(s, id)])),
                visitor: ev ? { id: ev.id, age: EVENT_STAY - ev.left } : null,
                novaKind: novaKind.current,
                novaFrom: novaFrom.current,
            };
            if (layers) renderLayered(layers, f, sprites);
            else { render(img, f); ctx.putImageData(img, 0, 0); }
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

    const doBuy = useCallback(
        (i: number, k: number) =>
            act((s) => {
                if (!buy(s, i, k)) return;
                const m = rowMult(s, i);
                if (m > (lastMult.current[i] ?? 1)) {
                    note(`${ELEMENTS[i].name} burners double. Level ${levels(s, i)} makes it x${fmt(m)}.`, "hot");
                    play("milestone");
                } else play("buy");
                lastMult.current[i] = m;
            }),
        [act, note],
    );

    const doAnswer = useCallback(
        (pick: number) =>
            act((s) => {
                const ev = eventOf(s);
                const o = answer(s, pick);
                if (o && ev) { note(`${ev.name}: ${o.label.toLowerCase()}.`, "hot"); play("answer"); }
            }),
        [act, note],
    );

    const doCloud = useCallback(
        (id: string) =>
            act((s) => {
                if (chooseCloud(s, id)) { note(`${CLOUDS.find((c) => c.id === id)?.name} chosen for ${s.name}.`, "hot"); play("cloud"); }
            }),
        [act, note],
    );

    const doNova = useCallback(() => {
        act((s) => {
            const from = stageOf(s);
            const g = supernova(s);
            if (g > 0) {
                novaRef.current = performance.now();
                lastNovaAt.current = novaRef.current;
                novaFrom.current = from;
                novaKind.current = 0;
                lastHeavy.current = 0;
                lastMult.current = s.bought.map(() => 1);
                play("nova");
                note(`Supernova. ${fmt(g)} stardust seeds the next star.`, "hot");
                save();
            }
        });
    }, [act, note, save]);

    const doNeutron = useCallback(() => {
        act((s) => {
            const from = stageOf(s);
            if (canNeutron(s)) writeBackup(window.localStorage, s, true);
            const g = neutronStar(s);
            if (g > 0) {
                novaRef.current = performance.now();
                lastNovaAt.current = novaRef.current;
                novaFrom.current = from;
                novaKind.current = 1;
                lastHeavy.current = 0;
                lastMult.current = s.bought.map(() => 1);
                play("nova");
                note(`A neutron star forms. ${g} neutrons. Gold and uranium can fuse now.`, "hot");
                save();
            }
        });
    }, [act, note, save]);

    const doHole = useCallback(() => {
        act((s) => {
            if (canBlackHole(s, effects(s))) writeBackup(window.localStorage, s, true);
            if (blackHole(s)) {
                lastHeavy.current = 0;
                lastMult.current = s.bought.map(() => 1);
                play("nova");
                setEnding(true);
                save();
            }
        });
    }, [act, save]);

    const togglePause = useCallback(() => {
        manualPause.current = !manualPause.current;
        setPaused(manualPause.current);
        lastTickAt.current = Date.now();
    }, []);

    const toggleSound = useCallback(() => {
        const v = !soundOn();
        setSound(v);
        setSoundState(v);
        if (v) play("answer");
    }, []);

    // One tab plays at a time: a newer tab tells older ones to stop saving, so two tabs never overwrite each other.
    const playHere = useCallback(() => {
        const ld = loadSession(window.localStorage);
        if (ld.state) {
            ld.state.savedAt = Date.now();
            sRef.current = ld.state;
            lastHeavy.current = heaviest(ld.state);
        }
        readOnly.current = false;
        manualPause.current = false;
        setPaused(false);
        lastTickAt.current = Date.now();
        setOther(false);
        tabCh.current?.ch.postMessage({ t: "hello", id: tabCh.current.id });
        bump();
    }, [bump]);

    useEffect(() => {
        if (!ready || typeof BroadcastChannel === "undefined") return;
        const id = Math.random().toString(36).slice(2);
        const ch = new BroadcastChannel("sw-tab");
        tabCh.current = { ch, id };
        ch.onmessage = (e: MessageEvent) => {
            if (e.data?.t !== "hello" || e.data.id === id || readOnly.current) return;
            save();
            readOnly.current = true;
            manualPause.current = true;
            setPaused(true);
            setOther(true);
        };
        ch.postMessage({ t: "hello", id });
        return () => { ch.close(); tabCh.current = null; };
    }, [ready, save]);

    // Automation unlocks (opt-in, see Settings): supernova by itself at a chosen core share, and visitors answered for you.
    useEffect(() => {
        if (!ready) return;
        const id = window.setInterval(() => {
            const s = sRef.current;
            if (!s || manualPause.current || readOnly.current || document.hidden) return;
            const v = getSettings();
            if (v.autoNova && unlocked(s, "autoNova") && novaRef.current < 0) {
                const f = effects(s);
                if (canSupernova(s, f) && collapse(s, f) >= v.autoNova) doNova();
            }
            const ev = eventOf(s);
            if (ev && s.event && v.autoVisitor !== "off" && unlocked(s, "autoVisitor") && EVENT_STAY - s.event.left >= 6) doAnswer(autoAnswer(ev, v.autoVisitor));
        }, 400);
        return () => window.clearInterval(id);
    }, [ready, doNova, doAnswer]);

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
            if (document.querySelector(".sw-end")) return;
            if (e.key === "Escape") { setPanel(null); setCard(null); return; }
            const k = e.key.toLowerCase();
            const onBtn = !!el && (el.tagName === "BUTTON" || el.tagName === "A");
            if (e.repeat && !/^[1-9]$/.test(e.key)) return;
            if (k === " " && !onBtn) { e.preventDefault(); togglePause(); }
            else if (k === "n") { const s = sRef.current; if (s && canSupernova(s, effects(s))) doNova(); }
            else if (k === "q" || k === "w") { if (sRef.current?.event) doAnswer(k === "q" ? 0 : 1); }
            else if (k === "f") { if (shell.supportsFullscreen) shell.toggleFullscreen(); }
            else if (k === "u") toggleSound();
            else if (k === "c") setPanel((p) => (p === "stars" ? null : "stars"));
            else if (k === "o") setPanel((p) => (p === "orbit" ? null : "orbit"));
            else if (k === "p" && sRef.current && sRef.current.neutronStars > 0) setPanel((p) => (p === "pulsar" ? null : "pulsar"));
            else if (k === "a") setPanel((p) => (p === "almanac" ? null : "almanac"));
            else if (k === "m") setPanel((p) => (p === "menu" ? null : "menu"));
            else if (/^[1-9]$/.test(e.key) || (e.shiftKey && /^Digit[1-9]$/.test(e.code)) || (e.altKey && /^Digit[1-9]$/.test(e.code))) {
                const row = Number(e.code.replace("Digit", "")) - 1;
                if (row >= 0 && row < ROWS) doBuy(row, e.altKey ? 2 : e.shiftKey ? 1 : 0);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [doBuy, doNova, doAnswer, togglePause, toggleSound, shell]);
    const sheetsN = useSheets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const vars = useMemo(() => (ready ? uiVars() : {}), [ready, sheetsN]);

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
    const toggle = (p: Exclude<Panel, null>) => setPanel(panel === p ? null : p);
    const dock: { id: Exclude<Panel, null>; g: string; name: string; tip: string; key: string; val?: string; ping?: boolean; show?: boolean }[] = [
        { id: "stars", g: "star", name: "Constellations", tip: "Spend stardust on the star map.", key: "C", val: fmt(s.stardust), ping: PERKS.some((p) => perkReady(PERKS, s.perks, p) && s.stardust >= p.cost) },
        { id: "pulsar", g: "pulse", name: "Pulsar map", tip: "Spend neutrons on the pulsar map.", key: "P", val: fmt(s.neutrons), ping: PULSAR_PERKS.some((p) => perkReady(PULSAR_PERKS, s.pulsar, p) && s.neutrons >= p.cost), show: s.neutronStars > 0 },
        { id: "orbit", g: "orbit", name: "Orbit", tip: "Form planets for passive bonuses.", key: "O", val: `${s.planets.length}/${PLANETS.length}`, ping: PLANETS.some((p) => canPlanet(s, p.id)) },
        { id: "almanac", g: "book", name: "Almanac", tip: "Elements made and milestones.", key: "A", val: `${s.ach.length}/${ACHIEVEMENTS.length}` },
        { id: "menu", g: "menu", name: "Menu", tip: "Pause, sound, saves.", key: "M" },
    ];
    const lockedRows = ELEMENTS.map((_, i) => i).filter((i) => !seen(s, i));

    return (
        <div className="sw-root" data-paused={paused ? "true" : undefined} style={vars as CSSProperties} {...tips.handlers}>
            <section className="sw-scene" aria-label="Your star">
                <canvas ref={canvasRef} width={W} height={H} className="sw-canvas" role="img" aria-label={`${s.name}, a ${STAGE_NAMES[stage].toLowerCase()}`} />
                <i className="sw-fade" data-edge="top" aria-hidden="true" />
                <i className="sw-fade" data-edge="bottom" aria-hidden="true" />
                <div className="sw-readout">
                    <span className="sw-tag">{s.name.toUpperCase()}</span>
                    <p>
                        <span data-tip="Mass|Grows as the star fuses. Raises hydrogen inflow."><Gl n="mass" s={1} />mass <b>{fmt(mass(s))}</b></span>
                        <span data-tip="Core heat|Gates every fusion. Mass sets it."><Gl n="heat" s={1} />heat <b>{fmtHeat(s.heat)}</b></span>
                        <span data-tip="Age of this star"><Gl n="age" s={1} />age <b>{fmtAge(s.age)}</b></span>
                    </p>
                    <p className="sw-stage">{STAGE_NAMES[stage]}{s.novasAll ? ` · supernova ${s.novas + 1}` : ""}</p>
                </div>
                {s.buffs.length > 0 && (
                    <ul className="sw-buffs" aria-label="Active boosts">
                        {s.buffs.map((b) => (
                            <li key={b.name + b.k} data-tip={`${b.name}|${BUFF_LABEL[b.k]} x${b.v}`}><span>{b.name}</span> <b>{Math.ceil(b.left)}s</b></li>
                        ))}
                    </ul>
                )}
                <ul className="sw-feed" aria-live="polite">
                    {notes.map((n) => (
                        <li key={n.id} data-tone={n.tone}>{n.text}</li>
                    ))}
                </ul>
                {paused && <div className="sw-paused" role="status">Paused</div>}
            </section>

            <header className="sw-top">
                <Link prefetch={false} href="/creations/games" className="sw-back" data-tip="Back to Games"><Gl n="back" s={1} /> Games</Link>
                <nav className="sw-dock" aria-label="Starwright panels">
                    {dock.filter((d) => d.show !== false).map((d) => (
                        <button key={d.id} type="button" className="sw-dt" aria-label={d.name} aria-pressed={panel === d.id} data-ping={d.ping ? "" : undefined} data-tip={`${d.name}|${d.tip}|key ${d.key}`} onClick={() => toggle(d.id)}>
                            <Pic sheet={`icon/dock-${d.id}`} glyph={d.g} s={2} />
                            <kbd>{d.key}</kbd>
                            {d.val && <em>{d.val}</em>}
                        </button>
                    ))}
                </nav>
            </header>

            {s.event && <Visitor s={s} onAnswer={doAnswer} />}
            {s.offer.length > 0 && <CloudPick s={s} onPick={doCloud} />}
            {card && <AwayCard title={card.title} lines={card.lines} onClose={() => setCard(null)} />}
            {other && (
                <div className="sw-lock sw-panel" role="alert">
                    <span>Starwright is open in another tab, so this one stopped saving.</span>
                    <button type="button" onClick={playHere}>Play here</button>
                </div>
            )}

            <section className="sw-collapse sw-panel" aria-label="Collapse">
                <div className="sw-col-head">
                    <h2><Gl n="burst" s={1} /> Collapse</h2>
                    <span>{Math.floor(Math.min(col, 1) * 100)}%</span>
                </div>
                <div className="sw-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(Math.min(col, 1) * 100)} aria-label="Core collapse" data-tip={`Iron to collapse|${col >= 1 ? "The core is ready." : `${fmt(s.amt[7])} of ${fmt(TUNE.feNeed * Math.pow(TUNE.needGrow, s.novas) * (1 - f.need))}`}`}>
                    <i style={{ width: `${Math.min(col, 1) * 100}%` }} data-full={col >= 1 ? "" : undefined} />
                </div>
                <p className="sw-col-line">
                    {col >= 1 ? "The core is ready." : `Iron ${fmt(s.amt[7])} of ${fmt(TUNE.feNeed * Math.pow(TUNE.needGrow, s.novas) * (1 - f.need))}.`} Seeds <b>{fmt(seeds(s, f))}</b> stardust.
                </p>
                <div className="sw-col-acts">
                    <button type="button" className="sw-go" disabled={!canSupernova(s, f)} onClick={doNova}><Gl n="burst" s={1} /> Go supernova</button>
                    {canNeutron(s) && <ConfirmGo label={`Neutron star · +${neutronGain(s)}`} sure="Resets stardust and the map. Sure?" onGo={doNeutron} />}
                    {canBlackHole(s, f) && <ConfirmGo label="Fall into a black hole" sure="Everything restarts for one singularity. Sure?" onGo={doHole} tone="void" />}
                </div>
                <p className="sw-hint" data-tip={`${s.cloud ? CLOUDS.find((c) => c.id === s.cloud)?.name : "Next step"}|${s.cloud ? CLOUDS.find((c) => c.id === s.cloud)?.desc : hint(s, f)}${s.cloud ? ` ${hint(s, f)}` : ""}`}>{hint(s, f)}</p>
                <Corners />
            </section>

            <section className="sw-ladder sw-panel" aria-label="Fusion ladder">
                <div className="sw-lad-head" data-tip="Keys 1 to 9|Tier I. Shift for II, Alt for III.">
                    <h2><Gl n="star" s={1} /> Fusion ladder</h2>
                    <span>1-9</span>
                </div>
                <i className="sw-rule" aria-hidden="true" />
                <ol>
                    {ELEMENTS.map((el, i) => (seen(s, i) ? <Row key={el.sym} s={s} f={f} i={i} onBuy={doBuy} /> : null))}
                </ol>
                {lockedRows.length > 0 && (
                    <div className="sw-locked" aria-label="Locked elements">
                        {lockedRows.map((i) => (
                            <span key={i} data-tip={`${ELEMENTS[i].name}|locked${i === ROWS && s.neutronStars === 0 ? " · waits for a neutron star" : ""}`}><ElTile i={i} locked size={1} /></span>
                        ))}
                    </div>
                )}
                {s.neutronStars === 0 && heavy >= 6 && <p className="sw-foot">Iron cannot fuse here. Gold and uranium wait for a neutron star.</p>}
                <Corners />
            </section>

            {shown === "stars" && <StarChart title="Constellations" list={PERKS} owned={s.perks} cur={s.stardust} curName="stardust" onBuy={(id) => act((x) => buyPerk(x, id))} onClose={() => setPanel(null)} constellations leaving={leaving} deep={{ n: s.deep, cost: deepCost(s), onBuy: () => act((x) => { buyDeep(x); }) }} />}
            {shown === "pulsar" && <StarChart title="Pulsar map" list={PULSAR_PERKS} owned={s.pulsar} cur={s.neutrons} curName="neutrons" onBuy={(id) => act((x) => buyPulsar(x, id))} onClose={() => setPanel(null)} leaving={leaving} />}
            {shown === "orbit" && <Orbit s={s} onBuy={(id) => act((x) => { if (buyPlanet(x, id)) note(`${PLANETS.find((p) => p.id === id)?.name} forms in orbit.`); })} onClose={() => setPanel(null)} leaving={leaving} />}
            {shown === "almanac" && <Almanac s={s} onClose={() => setPanel(null)} leaving={leaving} />}
            {shown === "menu" && (
                <Menu
                    s={s}
                    paused={paused}
                    leaving={leaving}
                    onPause={togglePause}
                    onClose={() => setPanel(null)}
                    onName={(n) => act((x) => { x.name = n.slice(0, 24) || x.name; })}
                    onImport={(next) => { writeBackup(window.localStorage, s, true); next.savedAt = Date.now(); sRef.current = next; lastHeavy.current = heaviest(next); save(); bump(); note("Save imported. The old one is kept as a backup.", "hot", true); }}
                    onReset={() => { writeBackup(window.localStorage, s, true); const n = fresh(); sRef.current = n; lastHeavy.current = 0; writeStored(window.localStorage, SAVE_KEY, serialize(n)); setPanel(null); bump(); }}
                    onExport={() => downloadText(tools.fileName(), tools.exportText(s))}
                    sound={sound}
                    onSound={toggleSound}
                />
            )}
            {ending && <Ending count={s.sing} onClose={() => setEnding(false)} />}
            {tips.layer}
        </div>
    );
}

// ---- pieces ---------------------------------------------------------------------------------------------------------

const Corners = () => <><i className="sw-cn" data-c="tl" /><i className="sw-cn" data-c="tr" /><i className="sw-cn" data-c="bl" /><i className="sw-cn" data-c="br" /></>;

const seen = (s: State, i: number) => s.amt[i] >= 1 || levels(s, i) > 0 || (i > 0 && levels(s, i - 1) > 0) || i === 0;

function hint(s: State, f: ReturnType<typeof effects>): string {
    return guide(s, f);
}

function Row({ s, f, i, onBuy }: { s: State; f: ReturnType<typeof effects>; i: number; onBuy: (i: number, k: number) => void }) {
    const el = ELEMENTS[i];
    const style = { "--c": el.color } as CSSProperties;
    const open = i < ROWS ? rowOpen(s, i) : false;
    const gate = i < ROWS ? gateMK(i, f) : 0;
    const cold = i < ROWS && open && levels(s, i) > 0 && s.heat < gate;
    const flow = s.flow?.[i] ?? 0;
    const recipe = i < ROWS ? RECIPE[i].map(([e, q]) => `${q} ${ELEMENTS[e].sym}`).join(" + ") : "";
    const tip = i === ROWS ? `${el.name}|the end of the ladder` : !open ? `${el.name}|needs a neutron star` : `${el.name}|${recipe} → ${ELEMENTS[i + 1].name} (${ELEMENTS[i + 1].sym})|needs core heat ${fmtHeat(gate)}${cold ? " · cold now" : ""}|key ${i + 1}`;
    return (
        <li className="sw-row" style={style} data-cold={cold ? "" : undefined}>
            <span className="sw-rt" data-tip={tip}>
                <ElTile i={i} anim />
                {i < 9 && <kbd>{i + 1}</kbd>}
            </span>
            <div className="sw-info">
                <b>{el.name}{i < ROWS && levels(s, i) > 0 && <small>L{fmt(levels(s, i))}</small>}</b>
                <span className="sw-amt">
                    {fmt(s.amt[i])}
                    {Math.abs(flow) >= 0.01 && <em data-neg={flow < 0 ? "" : undefined}>{flow > 0 ? "+" : "−"}{fmt(Math.abs(flow))}/s</em>}
                    {cold && <em className="sw-cold">cold</em>}
                </span>
                {i < ROWS && open && <span className="sw-sub">{recipe} → {ELEMENTS[i + 1].sym} · {fmtHeat(gate)}</span>}
            </div>
            {i < ROWS && open && (
                <div className="sw-btns" role="group" aria-label={`Burn ${el.name}`}>
                    {Array.from({ length: TIERS }, (_, k) => {
                        const c = cost(s, i, k);
                        return (
                            <button key={k} type="button" className="sw-btn" data-tier={k} disabled={!canBuy(s, i, k)} onClick={() => onBuy(i, k)} data-tip={`${el.name} burner ${TIER_NAMES[k]}|+${TIER_LEVELS[k]} level${TIER_LEVELS[k] > 1 ? "s" : ""}|costs ${fmt(c)} ${el.sym}`} aria-label={`${el.name} burner ${TIER_NAMES[k]}, +${TIER_LEVELS[k]}, costs ${fmt(c)} ${el.sym}`}>
                                <i className="sw-tier" aria-hidden="true" style={{ backgroundImage: `url("${ui(`tier-${k + 1}`)}")` }} />
                                <em>{fmt(c)}</em>
                            </button>
                        );
                    })}
                </div>
            )}
            {i < ROWS && !open && <span className="sw-warn sw-closed">needs a neutron star</span>}
        </li>
    );
}

const BUFF_LABEL: Record<string, string> = { inflow: "inflow", fuse: "fusion", heat: "heat", global: "all" };

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
