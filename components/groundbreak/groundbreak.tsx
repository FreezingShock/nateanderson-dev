"use client";

// Groundbreak: run a construction company. A full site view you can zoom and pan fills the screen; every menu floats over it as a
// small window and closes by clicking blank ground. The engine is components/groundbreak/engine.ts (stand-in, swappable).
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { useGameShell } from "@/components/games/shell/game-route-shell";
import { createSaveTools, downloadText, readPickedFile, writeStored } from "@/lib/games/save";
import {
    JOBS, MATS, NMAT, SAVE_KEY, SAVE_VERSION, bid, bond, builderSpeed, buy, canBuy, canIncorporate, catchUp, charterGain, charterMult, fmt, fmtTime, fresh,
    incorporate, inspectLen, isSave, jobOf, load, lockedJobs, nextJob, campaignDone, jobReady, money, phaseFrac, phaseNeed, rate, refreshBids, REP_TO_INCORPORATE, serialize, stageOf, step,
    tierCost, unlockNext, unlockable, whyLocked, type State, type Tier,
} from "./engine";
import { MAT_ICONS, iconUrl } from "./icons";
import { GroundbreakScene } from "./scene";
import { CAMERA_HOME, WORLD_H, WORLD_W, ZOOM_MAX, ZOOM_MIN, type Camera, type SceneJob } from "./scene-types";
import { runCommand } from "./commands";

const tools = createSaveTools<State>({ app: "groundbreak", version: SAVE_VERSION, validate: isSave });
type Win = null | "bids" | "skyline" | "firm" | "console" | "menu";
interface Note { id: number; text: string; tone?: "hot" | "dim" }
const TIER_NAME = ["Crew", "Equipment", "Method"] as const;
const TIER_ICON = ["crew", "equip", "method"] as const;
const TIER_KEY = ["Q", "W", "E"] as const;
const MAT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function Ico({ id, size = 20, className }: { id: string; size?: number; className?: string }) {
    const [url, setUrl] = useState("");
    useEffect(() => setUrl(iconUrl(id)), [id]);
    return <i className={`gb-ico ${className ?? ""}`} style={{ width: size, height: size, backgroundImage: url ? `url(${url})` : undefined }} aria-hidden="true" />;
}

/** Keeps a window mounted for its exit animation. */
function useExit(open: boolean, ms = 190): { mounted: boolean; state: "in" | "out" } {
    const [mounted, setMounted] = useState(open);
    useEffect(() => {
        if (open) { setMounted(true); return; }
        const id = window.setTimeout(() => setMounted(false), ms);
        return () => window.clearTimeout(id);
    }, [open, ms]);
    return { mounted: open || mounted, state: open ? "in" : "out" };
}

function Window({ open, title, hint, variant, size = "md", onClose, children, icon }: { open: boolean; title: string; hint?: string; variant: "iris" | "shutter" | "settle" | "drop"; size?: "sm" | "md" | "lg"; onClose: () => void; children: ReactNode; icon?: string }) {
    const { mounted, state } = useExit(open);
    if (!mounted) return null;
    return (
        <section className={`gb-win gb-${size}`} data-v={variant} data-s={state} role="dialog" aria-label={title} onPointerDown={(e) => e.stopPropagation()}>
            <header className="gb-win-head">
                {icon && <Ico id={icon} size={20} />}
                <h2>{title}</h2>
                {hint && <span className="gb-win-hint">{hint}</span>}
                <button type="button" className="gb-x" onClick={onClose} aria-label={`Close ${title}`} data-tip="Close · Esc">×</button>
            </header>
            <div className="gb-win-body">{children}</div>
            <i className="gb-cn" data-c="tl" /><i className="gb-cn" data-c="tr" /><i className="gb-cn" data-c="bl" /><i className="gb-cn" data-c="br" />
        </section>
    );
}

export function Groundbreak() {
    const sRef = useRef<State | null>(null);
    const [ready, setReady] = useState(false);
    const [, setN] = useState(0);
    const bump = useCallback(() => setN((n) => n + 1), []);
    const [win, setWin] = useState<Win>(null);
    const [sel, setSel] = useState<number | null>(null);
    const [notes, setNotes] = useState<Note[]>([]);
    const [away, setAway] = useState<string | null>(null);
    const [cam, setCam] = useState<Camera>(CAMERA_HOME);
    const camRef = useRef<Camera>(CAMERA_HOME);
    const viewRef = useRef<HTMLDivElement>(null);
    const manualPause = useRef(false);
    const [paused, setPaused] = useState(false);
    const [reduce, setReduce] = useState(false);
    const [simple, setSimple] = useState(false);
    const [jobOpen, setJobOpen] = useState(true);
    const noteId = useRef(0);
    const lastTick = useRef(0);
    const shell = useGameShell();

    const note = useCallback((text: string, tone?: Note["tone"]) => {
        const id = ++noteId.current;
        setNotes((n) => [...n.slice(-3), { id, text, tone }]);
        window.setTimeout(() => setNotes((n) => n.filter((x) => x.id !== id)), 7000);
    }, []);
    const save = useCallback(() => {
        const s = sRef.current;
        if (!s) return;
        s.savedAt = Date.now();
        writeStored(window.localStorage, SAVE_KEY, serialize(s));
    }, []);

    // ---- camera ------------------------------------------------------------------------------------------------------------
    const setCamera = useCallback((c: Camera) => {
        const n = { x: clamp(c.x, -40, WORLD_W + 40), y: clamp(c.y, 20, WORLD_H + 20), z: clamp(c.z, ZOOM_MIN, ZOOM_MAX) };
        camRef.current = n;
        setCam(n);
    }, []);
    const homeCam = useCallback((): Camera => {
        const r = viewRef.current?.getBoundingClientRect();
        if (!r) return CAMERA_HOME;
        const cover = Math.max(r.width / WORLD_W, r.height / WORLD_H);
        const portrait = r.height > r.width;
        return { x: portrait ? 240 : 236, y: portrait ? 160 : 166, z: clamp(r.width / (cover * 250), ZOOM_MIN, 1) };
    }, []);
    const zoomAt = useCallback((factor: number, px?: number, py?: number) => {
        const r = viewRef.current?.getBoundingClientRect();
        const c = camRef.current;
        if (!r) return;
        const cover = Math.max(r.width / WORLD_W, r.height / WORLD_H);
        const nz = clamp(c.z * factor, ZOOM_MIN, ZOOM_MAX);
        const ax = px ?? r.width / 2, ay = py ?? r.height / 2;
        const wx = c.x + (ax - r.width / 2) / (cover * c.z), wy = c.y + (ay - r.height / 2) / (cover * c.z);
        setCamera({ z: nz, x: wx - (ax - r.width / 2) / (cover * nz), y: wy - (ay - r.height / 2) / (cover * nz) });
    }, [setCamera]);
    const panBy = useCallback((dx: number, dy: number) => {
        const r = viewRef.current?.getBoundingClientRect();
        const c = camRef.current;
        if (!r) return;
        const cover = Math.max(r.width / WORLD_W, r.height / WORLD_H);
        setCamera({ ...c, x: c.x - dx / (cover * c.z), y: c.y - dy / (cover * c.z) });
    }, [setCamera]);

    const ptrs = useRef(new Map<number, { x: number; y: number }>());
    const drag = useRef({ moved: 0, pinch: 0 });
    const onDown = (e: RPointerEvent<HTMLDivElement>) => {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        drag.current = { moved: 0, pinch: 0 };
    };
    const onMove = (e: RPointerEvent<HTMLDivElement>) => {
        const p = ptrs.current.get(e.pointerId);
        if (!p) return;
        const r = viewRef.current!.getBoundingClientRect();
        if (ptrs.current.size === 2) {
            const [a, b] = [...ptrs.current.values()];
            const prev = Math.hypot(a.x - b.x, a.y - b.y);
            p.x = e.clientX; p.y = e.clientY;
            const [a2, b2] = [...ptrs.current.values()];
            const now = Math.hypot(a2.x - b2.x, a2.y - b2.y);
            drag.current.moved = 99;
            if (prev > 0) zoomAt(now / prev, (a2.x + b2.x) / 2 - r.left, (a2.y + b2.y) / 2 - r.top);
            return;
        }
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        p.x = e.clientX; p.y = e.clientY;
        drag.current.moved += Math.abs(dx) + Math.abs(dy);
        if (drag.current.moved > 4) panBy(dx, dy);
    };
    const onUp = (e: RPointerEvent<HTMLDivElement>) => {
        ptrs.current.delete(e.pointerId);
        if (ptrs.current.size === 0 && drag.current.moved <= 4) { setWin(null); setSel(null); }
    };
    useEffect(() => {
        const el = viewRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const r = el.getBoundingClientRect();
            zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), e.clientX - r.left, e.clientY - r.top);
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [zoomAt, ready]);
    useEffect(() => { if (ready) setCamera(homeCam()); }, [ready, homeCam, setCamera]);

    // ---- boot and tick -------------------------------------------------------------------------------------------------------
    useEffect(() => {
        const now = Date.now();
        const loaded = load(window.localStorage);
        const s = loaded ?? fresh(now);
        if (loaded) {
            const gone = (now - s.savedAt) / 1000;
            const before = s.built.length;
            const did = catchUp(s, gone);
            if (did > 30) setAway(`The crews kept working for ${fmtTime(did)} while you were away${s.built.length > before ? `, and ${s.built.length - before} job${s.built.length - before > 1 ? "s" : ""} got finished` : ""}.`);
        }
        refreshBids(s);
        s.savedAt = now;
        sRef.current = s;
        lastTick.current = now;
        setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        try { setSimple(window.localStorage.getItem("gb-simple") === "1"); } catch { /* storage blocked */ }
        setReady(true);
    }, []);
    useEffect(() => {
        if (!ready) return;
        const tick = window.setInterval(() => {
            const s = sRef.current;
            if (!s) return;
            const now = Date.now();
            const gap = (now - lastTick.current) / 1000;
            lastTick.current = now;
            if (manualPause.current) return;
            const open = s.open;
            const ev = gap > 3 ? (catchUp(s, gap), {}) : step(s, Math.min(gap, 1));
            const e = ev as { built?: { name: string }; pay?: number };
            if (e.built) note(`${e.built.name} passed inspection. +${money(e.pay ?? 0)}`, "hot");
            if (s.open !== open) note(`${MATS[s.open - 1].name} is on site.`, "hot");
        }, 100);
        const ui = window.setInterval(bump, 250);
        const sv = window.setInterval(save, 8000);
        const onHide = () => save();
        document.addEventListener("visibilitychange", onHide);
        window.addEventListener("pagehide", onHide);
        return () => { clearInterval(tick); clearInterval(ui); clearInterval(sv); document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", onHide); save(); };
    }, [ready, bump, save, note]);

    // ---- actions -----------------------------------------------------------------------------------------------------------
    const act = useCallback((fn: (s: State) => unknown) => { const s = sRef.current; if (s) { fn(s); bump(); } }, [bump]);
    const doBuy = useCallback((i: number, t: Tier) => act((s) => { if (buy(s, i, t)) save(); }), [act, save]);
    const doUnlock = useCallback(() => act((s) => { if (unlockNext(s)) { note(`${MATS[s.open - 1].name} is on site.`, "hot"); save(); } }), [act, note, save]);
    const doBid = useCallback((id: string) => act((s) => { if (bid(s, id)) { setWin(null); note(`Mobilised: ${JOBS.find((j) => j.id === id)?.name}.`, "hot"); save(); } }), [act, note, save]);
    const doIncorporate = useCallback(() => act((s) => { if (incorporate(s)) { setWin(null); setSel(null); note(`A new firm opens in a new city. Charter ${s.charter}.`, "hot"); save(); } }), [act, note, save]);
    const togglePause = useCallback(() => { manualPause.current = !manualPause.current; setPaused(manualPause.current); shell.setPaused(manualPause.current); }, [shell]);
    const reset = useCallback(() => setCamera(homeCam()), [homeCam, setCamera]);
    const toggleSimple = useCallback(() => { setSimple((v) => { try { window.localStorage.setItem("gb-simple", v ? "0" : "1"); } catch { /* ignore */ } return !v; }); }, []);

    useEffect(() => {
        if (!ready) return;
        const onKey = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement | null;
            if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) { if (e.key === "Escape") (el as HTMLElement).blur(); return; }
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const k = e.key.toLowerCase();
            if (e.key === "Escape") { if (win) setWin(null); else setSel(null); return; }
            if (e.key === "`" || (k === "j" && false)) { e.preventDefault(); setWin((w) => (w === "console" ? null : "console")); return; }
            const mi = MAT_KEYS.indexOf(e.key);
            if (mi >= 0) { setWin(null); setSel((c) => (c === mi ? null : mi)); return; }
            if (sel !== null && (k === "q" || k === "w" || k === "e")) { doBuy(sel, (k === "q" ? 0 : k === "w" ? 1 : 2) as Tier); return; }
            if (k === "b") setWin((w) => (w === "bids" ? null : "bids"));
            else if (k === "k") setWin((w) => (w === "skyline" ? null : "skyline"));
            else if (k === "f") setWin((w) => (w === "firm" ? null : "firm"));
            else if (k === "m") setWin((w) => (w === "menu" ? null : "menu"));
            else if (k === "p") togglePause();
            else if (k === "u") doUnlock();
            else if (k === "r" || e.key === "Home") reset();
            else if (e.key === "+" || e.key === "=" && e.shiftKey) zoomAt(1.25);
            else if (e.key === "_" || (e.key === "-" && e.shiftKey)) zoomAt(0.8);
            else if (e.key === "ArrowLeft") panBy(60, 0);
            else if (e.key === "ArrowRight") panBy(-60, 0);
            else if (e.key === "ArrowUp") panBy(0, 60);
            else if (e.key === "ArrowDown") panBy(0, -60);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [ready, win, sel, doBuy, doUnlock, togglePause, reset, zoomAt, panBy]);

    useEffect(() => {
        const root = document.documentElement;
        root.classList.add("gb-route");
        return () => root.classList.remove("gb-route");
    }, []);

    const s = sRef.current;
    const def = s ? jobOf(s) : null;
    const sceneJob = useMemo<SceneJob | null>(() => {
        if (!s || !s.job || !def) return null;
        return { id: def.id, floors: def.floors, frac: phaseFrac(s), phase: Math.min(s.job.phase, def.phases.length - 1), phaseName: def.phases[Math.min(s.job.phase, def.phases.length - 1)].name, phaseCount: def.phases.length, inspecting: s.job.phase >= def.phases.length, inspect: s.job.inspect / inspectLen() };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [s?.job?.jobId, s?.job?.phase, Math.floor((s ? phaseFrac(s) : 0) * 200), s?.job && Math.floor(s.job.inspect)]);
    const skyline = useMemo(() => (s ? s.built.map((b, index) => ({ id: b.id, firm: b.firm, index })) : []), [s?.built.length]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!ready || !s) return <div className="gb-root gb-boot" aria-busy="true"><p>Staking out the site…</p></div>;

    const stage = stageOf(s);
    const crewTotal = s.crews.reduce((a, c) => a + c, 0);
    const card = sel !== null ? sel : null;
    const doCommand = (line: string) => { const r = runCommand(s, line); if (r.changed) { save(); bump(); } return r.lines; };

    return (
        <div className="gb-root" data-paused={paused || shell.paused ? "true" : undefined} data-simple={simple ? "true" : undefined} data-reduce={reduce ? "true" : undefined} data-win={win ?? undefined}>
            <div ref={viewRef} className="gb-view" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-label="Building site. Scroll to zoom, drag to pan.">
                <GroundbreakScene camera={cam} job={sceneJob} skyline={skyline} craneLevel={s.equip[11] ?? 0} reduce={reduce || simple} paused={paused || shell.paused} />
            </div>

            <header className="gb-top">
                <Link href="/creations/games" className="gb-back" data-tip="Back to Games"><span aria-hidden="true">&lt;</span> Games</Link>
                <h1 className="gb-title">Groundbreak</h1>
                <span className="gb-sub">firm {s.firm} · stage {stage} of 5 · job {Math.min(JOBS.length, campaignDone(s) + 1)} of {JOBS.length}</span>
                <ul className="gb-res" aria-label="Resources">
                    <li data-tip="Cash"><Ico id="cash" size={22} /><b>{money(s.cash)}</b></li>
                    <li data-tip={`Reputation. Incorporate at ${REP_TO_INCORPORATE}.`}><Ico id="rep" size={22} /><b>{fmt(s.rep)}</b></li>
                    <li data-tip={`Crews hired. Build speed x${builderSpeed(s).toFixed(1)}`}><Ico id="crew" size={22} /><b>{crewTotal}</b></li>
                </ul>
            </header>

            <nav className="gb-rail" aria-label="Menus" onPointerDown={(e) => e.stopPropagation()}>
                {([["bids", "bid", "Campaign", "B"], ["skyline", "skyline", "Skyline", "K"], ["firm", "firm", "Firm", "F"], ["console", "console", "Console", "`"], ["menu", "menu", "Menu", "M"]] as const).map(([id, ic, label, key]) => (
                    <button key={id} type="button" className="gb-rail-btn" aria-pressed={win === id} aria-label={label} data-tip={`${label} · ${key}`} data-ping={id === "bids" && !s.job && s.bids.length > 0 ? "" : id === "firm" && canIncorporate(s) ? "" : undefined} onClick={() => { setSel(null); setWin(win === id ? null : id); }}>
                        <Ico id={ic} size={28} /><kbd>{key}</kbd>
                    </button>
                ))}
            </nav>

            <div className="gb-zoom" onPointerDown={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => zoomAt(1.3)} aria-label="Zoom in" data-tip="Zoom in · +">+</button>
                <button type="button" onClick={() => zoomAt(0.77)} aria-label="Zoom out" data-tip="Zoom out · Shift -">−</button>
                <button type="button" onClick={reset} aria-label="Reset view" data-tip="Reset view · R"><Ico id="reset" size={22} /></button>
            </div>

            <aside className={`gb-job ${jobOpen ? "" : "is-min"}`} onPointerDown={(e) => e.stopPropagation()}>
                <button type="button" className="gb-job-head" onClick={() => setJobOpen((v) => !v)} aria-expanded={jobOpen} data-tip={jobOpen ? "Collapse" : "Expand"}>
                    <Ico id="bid" size={20} /><span>{def ? def.name : "No job on site"}</span>
                    {s.job && <em>{s.job.phase >= (def?.phases.length ?? 0) ? `inspection ${fmtTime(inspectLen() - s.job.inspect)}` : `${Math.floor(phaseFrac(s) * 100)}%`}</em>}
                </button>
                {jobOpen && (def && s.job ? (
                    <div className="gb-job-body">
                        <ol className="gb-phases">
                            {def.phases.map((ph, i) => {
                                const done = s.job!.phase > i, cur = s.job!.phase === i;
                                const pct = done ? 100 : cur ? Math.floor((s.job!.prog / phaseNeed(def, ph)) * 100) : 0;
                                return (
                                    <li key={i} data-state={done ? "done" : cur ? "cur" : "wait"} data-tip={`${ph.name}: needs ${MATS[ph.mat].name}`}>
                                        <Ico id={MAT_ICONS[ph.mat]} size={20} /><i className="gb-bar"><b style={{ width: `${pct}%` }} /></i>
                                    </li>
                                );
                            })}
                        </ol>
                        <p className="gb-job-pay">pays {money(Math.floor(def.pay * charterMult(s)))} + {def.rep} rep</p>
                    </div>
                ) : (
                    <div className="gb-job-body"><button type="button" className="gb-go" onClick={() => setWin("bids")} disabled={s.bids.length === 0}>Open the campaign</button></div>
                ))}
            </aside>

            <ul className="gb-feed" aria-live="polite">{notes.map((n) => <li key={n.id} data-tone={n.tone}>{n.text}</li>)}</ul>
            {away && <button type="button" className="gb-away" onClick={() => setAway(null)}>{away} <span>dismiss</span></button>}
            {(paused || shell.paused) && <div className="gb-paused" role="status">Paused · P to resume</div>}

            {card !== null && (
                <MatCard s={s} i={card} onBuy={doBuy} onUnlock={doUnlock} onClose={() => setSel(null)} />
            )}

            <div className="gb-dock" onPointerDown={(e) => e.stopPropagation()} role="toolbar" aria-label="Materials">
                {MATS.map((m, i) => {
                    const open = i < s.open, next = i === s.open;
                    const r = open ? rate(s, i) : 0;
                    return (
                        <button key={m.id} type="button" className="gb-tile" data-state={open ? "open" : next ? "next" : "locked"} data-on={card === i ? "" : undefined} data-ready={next && unlockable(s) ? "" : undefined}
                            aria-pressed={card === i} aria-label={`${m.name}${open ? `, ${fmt(s.amt[i])}` : ", locked"}`}
                            data-tip={open ? `${m.name} · ${fmt(r)}/s` : next ? `${m.name} · needs ${fmt(m.unlockAmt)} ${MATS[i - 1].name}` : "Locked"}
                            onClick={() => { setWin(null); setSel(card === i ? null : i); }}>
                            <kbd>{MAT_KEYS[i]}</kbd>
                            <Ico id={open || next ? MAT_ICONS[i] : "lock"} size={36} className={open ? "" : "is-dim"} />
                            <b>{open ? fmt(s.amt[i]) : next ? `${Math.min(99, Math.floor((s.amt[i - 1] / m.unlockAmt) * 100))}%` : ""}</b>
                            {open && <i className="gb-lv">{s.crews[i]}</i>}
                        </button>
                    );
                })}
            </div>

            <Window open={win === "bids"} title="Campaign" hint={`${campaignDone(s)} of ${JOBS.length} jobs`} variant="shutter" icon="bid" onClose={() => setWin(null)}>
                <ul className="gb-bids">
                    {s.job && def && <li className="is-now"><div><strong>{def.name}</strong><span>on site now</span></div><span className="gb-req">{Math.floor(phaseFrac(s) * 100)}%</span></li>}
                    {s.bids.map((id) => {
                        const j = JOBS.find((x) => x.id === id)!;
                        const ready = jobReady(s, j);
                        return (
                            <li key={id} className="is-next">
                                <div><strong>Next: {j.name}</strong><span>{j.blurb}</span></div>
                                <dl><dt>pays</dt><dd>{money(Math.floor(j.pay * charterMult(s)))}</dd><dt>rep</dt><dd>+{j.rep}</dd><dt>phases</dt><dd>{j.phases.length}</dd></dl>
                                <button type="button" className="gb-go" disabled={!!s.job || !ready || s.cash < bond(j)} onClick={() => doBid(id)} data-tip={s.job ? "Finish the current job first" : !ready ? `Needs ${MATS[[0, 2, 4, 7, 9, 11][j.stage]].name} on site` : `Mobilisation ${money(bond(j))}`}>{ready ? `Start ${money(bond(j))}` : `Needs stage ${j.stage}`}</button>
                            </li>
                        );
                    })}
                    {lockedJobs(s).map((j) => (
                        <li key={j.id} className="is-locked"><div><strong>{j.name}</strong><span>{j.blurb}</span></div><span className="gb-req">stage {j.stage}</span></li>
                    ))}
                    {s.bids.length === 0 && !s.job && <li className="gb-none">Campaign complete. Incorporate to open a new firm.</li>}
                </ul>
            </Window>

            <Window open={win === "skyline"} title="Skyline" hint={`${s.built.length} built`} variant="iris" size="lg" icon="skyline" onClose={() => setWin(null)}>
                <SkylineView built={s.built} />
            </Window>

            <Window open={win === "firm"} title="Firm" hint={`firm ${s.firm}`} variant="settle" icon="firm" onClose={() => setWin(null)}>
                <dl className="gb-stats">
                    <dt>Reputation</dt><dd>{fmt(s.rep)}</dd>
                    <dt>Charter</dt><dd>{s.charter} · x{charterMult(s).toFixed(2)} pay and output</dd>
                    <dt>Jobs finished</dt><dd>{s.built.length}</dd>
                    <dt>Crews</dt><dd>{crewTotal}</dd>
                </dl>
                <p className="gb-line">{canIncorporate(s) ? `Incorporate a new firm in a new city. Charter becomes ${charterGain(s)}. Your skyline stays.` : `Incorporate opens at ${REP_TO_INCORPORATE} reputation.`}</p>
                <ConfirmGo label="Incorporate" sure="Starts a new firm. Cash, crews and materials reset. Sure?" onGo={doIncorporate} disabled={!canIncorporate(s)} />
            </Window>

            <Window open={win === "console"} title="Console" hint="type help" variant="drop" icon="console" size="md" onClose={() => setWin(null)}>
                <Console run={doCommand} />
            </Window>

            <Window open={win === "menu"} title="Menu" variant="settle" size="sm" icon="menu" onClose={() => setWin(null)}>
                <MenuBody s={s} paused={paused} onPause={togglePause} simple={simple} onSimple={toggleSimple} fs={shell.supportsFullscreen} onFs={shell.toggleFullscreen} fsOn={shell.fullscreen}
                    onImport={(st) => { sRef.current = st; refreshBids(st); save(); bump(); note("Save imported.", "hot"); }} onWipe={() => { sRef.current = fresh(Date.now()); refreshBids(sRef.current); save(); setWin(null); setSel(null); bump(); }} onNote={note} />
            </Window>
        </div>
    );
}

function MatCard({ s, i, onBuy, onUnlock, onClose }: { s: State; i: number; onBuy: (i: number, t: Tier) => void; onUnlock: () => void; onClose: () => void }) {
    const m = MATS[i];
    const open = i < s.open;
    const next = i === s.open;
    return (
        <section className="gb-card" key={i} role="dialog" aria-label={m.name} onPointerDown={(e) => e.stopPropagation()}>
            <header>
                <Ico id={open || next ? MAT_ICONS[i] : "lock"} size={40} />
                <div><h3>{m.name}</h3><p>{open ? `${fmt(rate(s, i))} /s · ${fmt(s.amt[i])} ${m.unit}` : next ? `needs ${fmt(m.unlockAmt)} ${MATS[i - 1].name}` : "Locked"}</p></div>
                <button type="button" className="gb-x" onClick={onClose} aria-label="Close" data-tip="Close · Esc">×</button>
            </header>
            {open ? (
                <>
                    <p className="gb-card-line">{i < NMAT - 1 ? `Boosts ${MATS[i + 1].name}` : "Boosts crew pay"}{i >= 9 && i > 0 ? ` and ${MATS[i - 1].name}` : ""}</p>
                    <div className="gb-tiers">
                        {([0, 1, 2] as Tier[]).map((t) => {
                            const ok = canBuy(s, i, t);
                            const lvl = t === 0 ? s.crews[i] : t === 1 ? s.equip[i] : s.method[i] ? 1 : 0;
                            const why = whyLocked(s, i, t);
                            const done = t === 2 && s.method[i];
                            return (
                                <button key={t} type="button" className="gb-tier" disabled={!ok} onClick={() => onBuy(i, t)} data-tip={why || (t === 0 ? "Hire a crew" : t === 1 ? `${m.equip}: output x2` : `${m.method}: output x3`)} data-done={done ? "" : undefined}>
                                    <kbd>{TIER_KEY[t]}</kbd>
                                    <Ico id={TIER_ICON[t]} size={30} />
                                    <span className="gb-tier-name">{t === 0 ? "I" : t === 1 ? "II" : "III"} {TIER_NAME[t]}</span>
                                    <span className="gb-tier-lv">{t === 2 ? (done ? "done" : "once") : `lv ${lvl}`}</span>
                                    <b>{done ? "" : money(tierCost(s, i, t))}</b>
                                </button>
                            );
                        })}
                    </div>
                </>
            ) : next ? (
                <button type="button" className="gb-go gb-wide" disabled={!unlockable(s)} onClick={onUnlock}>{unlockable(s) ? `Bring ${m.name} on site · U` : `${fmt(s.amt[i - 1])} of ${fmt(m.unlockAmt)} ${MATS[i - 1].name}`}</button>
            ) : <p className="gb-card-line">Unlock {MATS[i - 1].name} first.</p>}
            <i className="gb-cn" data-c="tl" /><i className="gb-cn" data-c="tr" /><i className="gb-cn" data-c="bl" /><i className="gb-cn" data-c="br" />
        </section>
    );
}

function SkylineView({ built }: { built: State["built"] }) {
    if (built.length === 0) return <p className="gb-none">Nothing built yet. Every finished job stays here for good, even after you incorporate.</p>;
    const counts = new Map<string, number>();
    built.forEach((b) => counts.set(b.id, (counts.get(b.id) ?? 0) + 1));
    return (
        <ul className="gb-sky">
            {JOBS.filter((j) => counts.has(j.id)).map((j) => (
                <li key={j.id} style={{ "--h": `${Math.min(190, 60 + j.floors * 8)}px` } as CSSProperties}>
                    <span className="gb-sky-b" aria-hidden="true" /><b>{counts.get(j.id)}</b><em>{j.name}</em>
                </li>
            ))}
        </ul>
    );
}

function ConfirmGo({ label, sure, onGo, disabled }: { label: string; sure: string; onGo: () => void; disabled?: boolean }) {
    const [ask, setAsk] = useState(false);
    useEffect(() => { if (!ask) return; const id = window.setTimeout(() => setAsk(false), 5000); return () => window.clearTimeout(id); }, [ask]);
    return (
        <div className="gb-confirm">
            <button type="button" className="gb-go" disabled={disabled} onClick={() => (ask ? (setAsk(false), onGo()) : setAsk(true))}>{ask ? "Yes, do it" : label}</button>
            {ask && <p>{sure}</p>}
        </div>
    );
}

function Console({ run }: { run: (line: string) => { t: string; k?: string }[] }) {
    const [lines, setLines] = useState<{ t: string; k?: string }[]>([{ t: "gb console. Type help.", k: "dim" }]);
    const [v, setV] = useState("");
    const box = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLInputElement>(null);
    useEffect(() => { input.current?.focus(); }, []);
    useEffect(() => { box.current?.scrollTo({ top: 99999 }); }, [lines]);
    return (
        <div className="gb-con">
            <div ref={box} className="gb-con-out">{lines.map((l, i) => <p key={i} data-k={l.k}>{l.t}</p>)}</div>
            <form onSubmit={(e) => { e.preventDefault(); const line = v.trim(); if (!line) return; setLines((p) => [...p.slice(-60), { t: `> ${line}`, k: "in" }, ...run(line)]); setV(""); }}>
                <span aria-hidden="true">&gt;</span>
                <input ref={input} value={v} onChange={(e) => setV(e.target.value)} aria-label="Console command" autoComplete="off" autoCapitalize="off" spellCheck={false} />
            </form>
        </div>
    );
}

function MenuBody({ s, paused, onPause, simple, onSimple, fs, onFs, fsOn, onImport, onWipe, onNote }: { s: State; paused: boolean; onPause: () => void; simple: boolean; onSimple: () => void; fs: boolean; onFs: () => void; fsOn: boolean; onImport: (s: State) => void; onWipe: () => void; onNote: (t: string) => void }) {
    const file = useRef<HTMLInputElement>(null);
    return (
        <div className="gb-menu">
            <button type="button" className="gb-row" onClick={onPause}>{paused ? "Resume" : "Pause"}<kbd>P</kbd></button>
            <button type="button" className="gb-row" onClick={onSimple} aria-pressed={simple}>Simple visuals<em>{simple ? "on" : "off"}</em></button>
            {fs && <button type="button" className="gb-row" onClick={onFs}>{fsOn ? "Leave full screen" : "Full screen"}</button>}
            <button type="button" className="gb-row" onClick={() => downloadText(tools.fileName(), tools.exportText(s))}>Export save</button>
            <button type="button" className="gb-row" onClick={() => file.current?.click()}>Import save</button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = "";
                if (!f) return;
                const picked = await readPickedFile(f);
                if (!picked.ok) { onNote(picked.error); return; }
                const r = tools.importText(picked.data);
                if (r.ok) onImport(r.data); else onNote(r.error);
            }} />
            <ConfirmGo label="Start over" sure="Deletes this save, skyline included. Sure?" onGo={onWipe} />
            <p className="gb-keys">1-0 - = materials · Q W E tiers · B bids · K skyline · F firm · ` console · wheel zoom · drag pan · R reset</p>
        </div>
    );
}
