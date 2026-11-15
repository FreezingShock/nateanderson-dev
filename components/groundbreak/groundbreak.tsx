"use client";

// Groundbreak: run a construction company. A full site view you can zoom and pan fills the screen; every menu floats over it as a
// small window and closes by clicking blank ground. The engine is components/groundbreak/engine.ts (stand-in, swappable).
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { useGameShell } from "@/components/games/shell/game-route-shell";
import { createSaveTools, downloadText, readPickedFile, writeStored } from "@/lib/games/save";
import { JOB_BY, JOBS, MATS, PERKS, TIER_LABELS, TUNE, UNLOCK_COST as UNLOCK, cityOf, N as NMAT } from "@/lib/groundbreak/data";
import {
    SAVE_KEY, SAVE_VERSION, acceptChange, buy, buyPerk, canBuy, canIncorporate, canUnlock, catchUp, charterGain, chain, declineChange, effects, fmt, fmtAge,
    fmtCash, fresh, incorporate, isSave, jobFloors, jobPhaseName, jobProgress, load, methodReady, overtime, overtimeCost, parse, payout, perkReady, phaseNeeds,
    plan, queue, nextJob, rawRate, repPay, serialize, stageOf, step, tierCost, unlock, waitingFor, type State,
} from "@/lib/groundbreak/engine";
import { gbCommand } from "@/lib/groundbreak/commands";
import { MAT_ICONS, iconUrl } from "./icons";
import { GB_JOBS, type GbJobId } from "@/components/groundbreak-art";
import { GbSiteScene as GroundbreakScene } from "@/components/groundbreak-art/site-scene";
import { CAMERA_HOME, GROUND_Y, WORLD_H, WORLD_W, ZOOM_MAX, ZOOM_MIN, type Camera, type SceneJob } from "./scene-types";

const tools = createSaveTools<State>({ app: "groundbreak", version: SAVE_VERSION, validate: isSave });
type Tier = 0 | 1 | 2;
const fmtSecs = (sec: number) => { const s = Math.max(0, Math.ceil(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
type Win = null | "jobs" | "skyline" | "firm" | "console" | "menu";
interface Note { id: number; text: string; tone?: "hot" | "dim" }
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
    /** True once the player zoomed or panned; until then the camera follows the current job. */
    const userCam = useRef(false);
    const lastJob = useRef<string | null>(null);
    const viewRef = useRef<HTMLDivElement>(null);
    const manualPause = useRef(false);
    const [paused, setPaused] = useState(false);
    const [reduce, setReduce] = useState(false);
    const [simple, setSimple] = useState(false);
    const [jobOpen, setJobOpen] = useState(true);
    const noteId = useRef(0);
    const lastTick = useRef(0);
    const seen = useRef({ built: 0, open: 1, change: false });
    const shell = useGameShell();

    const note = useCallback((text: string, tone?: Note["tone"]) => {
        const id = ++noteId.current;
        setNotes((n) => [...n.filter((x) => x.text !== text).slice(-1), { id, text, tone }]);
        window.setTimeout(() => setNotes((n) => n.filter((x) => x.id !== id)), 6000);
    }, []);
    const save = useCallback(() => {
        const s = sRef.current;
        if (!s) return;
        s.savedAt = Date.now();
        writeStored(window.localStorage, SAVE_KEY, serialize(s));
    }, []);

    // ---- camera ------------------------------------------------------------------------------------------------------------
    const setCamera = useCallback((c: Camera) => {
        const z = clamp(c.z, ZOOM_MIN, ZOOM_MAX);
        let y = clamp(c.y, 20, WORLD_H + 20);
        const r = viewRef.current?.getBoundingClientRect();
        if (r) {
            // keep the ground line above the dock (and below the header) so the building is never buried behind it
            const sc = Math.max(r.width / WORLD_W, r.height / WORLD_H) * z;
            const dockH = r.width <= 860 ? 230 : 120;
            y = Math.max(y, GROUND_Y - (r.height / 2 - dockH) / sc);
        }
        const n = { x: clamp(c.x, -40, WORLD_W + 40), y, z };
        camRef.current = n;
        setCam(n);
    }, []);
    /** Frame the site: the job (or the lot for the next job) fills about half the free view, so the crew and the staged building are the first thing seen. */
    const homeCam = useCallback((jobId?: string): Camera => {
        const r = viewRef.current?.getBoundingClientRect();
        if (!r) return CAMERA_HOME;
        const cover = Math.max(r.width / WORLD_W, r.height / WORLD_H);
        const portrait = r.height > r.width;
        const art = jobId ? GB_JOBS[jobId as GbJobId] : undefined;
        if (!art) return { x: portrait ? 240 : 236, y: portrait ? 160 : 166, z: clamp(r.width / (cover * 250), ZOOM_MIN, 1) };
        const hw = art.h / 2 + 14, ww = art.w / 2 + 24;
        const dockH = r.width <= 860 ? 230 : 120, topH = 60;
        const free = Math.max(120, r.height - dockH - topH);
        const z = clamp(Math.min(free / (cover * hw), (r.width * 0.86) / (cover * ww)), 0.6, 3.2);
        // centre the building in the free band between the header and the dock
        const midShift = (dockH - topH) / 2 / (cover * z);
        return { x: 240, y: GROUND_Y - hw / 2 + 8 + midShift, z };
    }, []);
    const zoomAt = useCallback((factor: number, px?: number, py?: number) => {
        userCam.current = true;
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
        userCam.current = true;
        const r = viewRef.current?.getBoundingClientRect();
        const c = camRef.current;
        if (!r) return;
        const cover = Math.max(r.width / WORLD_W, r.height / WORLD_H);
        setCamera({ ...c, x: c.x - dx / (cover * c.z), y: c.y - dy / (cover * c.z) });
    }, [setCamera]);

    const ptrs = useRef(new Map<number, { x: number; y: number }>());
    const drag = useRef({ moved: 0 });
    const onDown = (e: RPointerEvent<HTMLDivElement>) => {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        drag.current = { moved: 0 };
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
    const siteKey = sRef.current ? (sRef.current.job?.id ?? nextJob(sRef.current).id) : "";
    useEffect(() => { if (ready && !userCam.current) setCamera(homeCam(siteKey)); }, [ready, siteKey, homeCam, setCamera]);

    // ---- boot and tick -------------------------------------------------------------------------------------------------------
    useEffect(() => {
        const now = Date.now();
        const loaded = load(window.localStorage);
        if (!loaded) {
            // A save that exists but cannot be read is copied aside before the new game overwrites it.
            try {
                const raw = window.localStorage.getItem(SAVE_KEY);
                if (raw) { writeStored(window.localStorage, SAVE_KEY + "-corrupt", raw); note("Your saved game could not be read. A copy is kept for recovery and a new firm starts."); }
            } catch { /* storage blocked */ }
        }
        const s = loaded ?? fresh(now);
        if (loaded) {
            const gone = (now - s.savedAt) / 1000;
            const before = s.built;
            const did = catchUp(s, gone);
            if (did > 30) setAway(`The crews kept working for ${fmtAge(did)} while you were away${s.built > before ? `, and ${s.built - before} job${s.built - before > 1 ? "s" : ""} got handed over` : ""}.`);
        }
        s.savedAt = now;
        sRef.current = s;
        seen.current = { built: s.built, open: s.open, change: !!s.change };
        lastTick.current = now;
        setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        if (window.innerWidth <= 860) setJobOpen(false);
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
            if (gap > 3) catchUp(s, gap); else step(s, Math.min(gap, 1));
            const sn = seen.current;
            if (s.built > sn.built) {
                const last = s.skyline[s.skyline.length - 1];
                note(`${JOB_BY.get(last?.id ?? "")?.name ?? "Job"} handed over.`, "hot");
            }
            const jid = s.job?.id ?? "";
            if (lastJob.current !== null && jid && jid !== lastJob.current) {
                const jd = JOB_BY.get(jid);
                if (jd) note(`${jd.name} started at ${cityOf(s.firm).sites[jd.stage - 1]}.`, "hot");
            }
            lastJob.current = jid;
            if (s.open > sn.open) note(`${MATS[s.open - 1].name} is on site.`, "hot");
            if (s.change && !sn.change) note("Change order: the client wants more.", "hot");
            seen.current = { built: s.built, open: s.open, change: !!s.change };
        }, 100);
        const ui = window.setInterval(bump, 250);
        const sv = window.setInterval(save, 8000);
        const onHide = () => save();
        document.addEventListener("visibilitychange", onHide);
        window.addEventListener("pagehide", onHide);
        // `gb` in the site console talks to the open game through this event
        const onLive = (e: Event) => { (e as CustomEvent).detail.live = { s: sRef.current, changed: () => { bump(); save(); } }; };
        window.addEventListener("gb:live", onLive);
        return () => { clearInterval(tick); clearInterval(ui); clearInterval(sv); document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", onHide); window.removeEventListener("gb:live", onLive); save(); };
    }, [ready, bump, save, note]);

    // ---- actions -----------------------------------------------------------------------------------------------------------
    const act = useCallback((fn: (s: State) => unknown) => { const s = sRef.current; if (s) { fn(s); bump(); } }, [bump]);
    const doBuy = useCallback((i: number, t: Tier) => act((s) => { if (buy(s, i, t)) save(); }), [act, save]);
    const doUnlock = useCallback(() => act((s) => { if (unlock(s, s.open)) save(); }), [act, save]);
    const doIncorporate = useCallback(() => act((s) => { const g = incorporate(s); if (g > 0) { setWin(null); setSel(null); note(`A new firm opens in ${cityOf(s.firm).name}. +${g} charter.`, "hot"); save(); } }), [act, note, save]);
    const togglePause = useCallback(() => { manualPause.current = !manualPause.current; setPaused(manualPause.current); shell.setPaused(manualPause.current); }, [shell]);
    const reset = useCallback(() => { userCam.current = false; const s = sRef.current; setCamera(homeCam(s ? (s.job?.id ?? nextJob(s).id) : undefined)); }, [homeCam, setCamera]);
    const toggleSimple = useCallback(() => { setSimple((v) => { try { window.localStorage.setItem("gb-simple", v ? "0" : "1"); } catch { /* ignore */ } return !v; }); }, []);

    useEffect(() => {
        if (!ready) return;
        const onKey = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement | null;
            if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) { if (e.key === "Escape") (el as HTMLElement).blur(); return; }
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const k = e.key.toLowerCase();
            if (e.key === "Escape") { if (win) setWin(null); else setSel(null); return; }
            const mi = MAT_KEYS.indexOf(e.key);
            if (mi >= 0 && !e.shiftKey) { setWin(null); setSel((c) => (c === mi ? null : mi)); return; }
            if (sel !== null && (k === "q" || k === "w" || k === "e")) { doBuy(sel, (k === "q" ? 0 : k === "w" ? 1 : 2) as Tier); return; }
            if (k === "j") setWin((w) => (w === "jobs" ? null : "jobs"));
            else if (k === "k") setWin((w) => (w === "skyline" ? null : "skyline"));
            else if (k === "f") setWin((w) => (w === "firm" ? null : "firm"));
            else if (k === "m") setWin((w) => (w === "menu" ? null : "menu"));
            else if (k === "p") togglePause();
            else if (k === "u") doUnlock();
            else if (k === "y") act((x) => acceptChange(x));
            else if (k === "n") act((x) => declineChange(x));
            else if (k === "r" || e.key === "Home") reset();
            else if (e.key === "+") zoomAt(1.25);
            else if (e.key === "_") zoomAt(0.8);
            else if (e.key === "ArrowLeft") panBy(60, 0);
            else if (e.key === "ArrowRight") panBy(-60, 0);
            else if (e.key === "ArrowUp") panBy(0, 60);
            else if (e.key === "ArrowDown") panBy(0, -60);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [ready, win, sel, doBuy, doUnlock, act, togglePause, reset, zoomAt, panBy]);

    useEffect(() => {
        const root = document.documentElement;
        root.classList.add("gb-route");
        return () => root.classList.remove("gb-route");
    }, []);

    const s = sRef.current;
    const f = s ? effects(s) : null;
    const aj = s?.job ?? null;
    const def = aj ? JOB_BY.get(aj.id) ?? null : null;
    const prog = s && f && aj ? jobProgress(aj, f) : 0;
    const sceneJob: SceneJob | null = s && f && aj && def ? {
        id: def.id, floors: Math.max(1, def.floors), frac: prog, phase: aj.phase, phaseName: jobPhaseName(aj, f), phaseCount: plan(def, f).length,
        inspecting: aj.step === "inspect", inspect: aj.step === "inspect" ? 1 - aj.left / Math.max(1, aj.inspectTotal) : 0, floorsUp: jobFloors(aj, f), permit: aj.step === "permit",
    } : null;
    const skyKey = s ? s.skyline.length : 0;
    const skyline = useMemo(() => (sRef.current ? sRef.current.skyline.map((b, index) => ({ id: b.id, firm: b.firm, index })) : []), [skyKey]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!ready || !s || !f) return <div className="gb-root gb-boot" aria-busy="true"><p>Staking out the site…</p></div>;

    const stage = stageOf(s);
    const crewTotal = s.crews.reduce((a, c) => a + c, 0);
    const card = sel;
    const city = cityOf(s.firm);
    const wait = waitingFor(s);
    const doCommand = (line: string) => {
        const args = line.trim().split(/\s+/).filter(Boolean);
        if (args[0]?.toLowerCase() === "gb") args.shift();
        const r = gbCommand(s, args);
        if (r.changed) { save(); bump(); }
        return r.lines;
    };
    const ovt = overtimeCost(s);

    return (
        <div className="gb-root" data-paused={paused || shell.paused ? "true" : undefined} data-simple={simple ? "true" : undefined} data-reduce={reduce ? "true" : undefined} data-win={win ?? undefined}>
            <div ref={viewRef} className="gb-view" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-label="Building site. Scroll to zoom, drag to pan.">
                <GroundbreakScene camera={cam} job={sceneJob} skyline={skyline} craneLevel={s.equip[11] ?? 0} idle={aj ? null : nextJob(s).id} crews={crewTotal} reduce={reduce || simple} paused={paused || shell.paused} />
            </div>

            <header className="gb-top">
                <Link prefetch={false} href="/creations/games" className="gb-back" data-tip="Back to Games"><span aria-hidden="true">&lt;</span> Games</Link>
                <h1 className="gb-title">Groundbreak</h1>
                <span className="gb-sub">{city.name} · stage {stage} of 5 · job {Math.min(JOBS.length, s.builtThisFirm + 1)} of {JOBS.length}</span>
                <ul className="gb-res" aria-label="Resources">
                    <li data-tip="Cash. Jobs pay it; methods cost it."><Ico id="cash" size={22} /><b>{fmtCash(s.cash)}</b></li>
                    <li data-tip="Reputation. It lifts all output and inspections."><Ico id="rep" size={22} /><b>{fmt(s.rep)}</b></li>
                    <li data-tip="Crews hired"><Ico id="crew" size={22} /><b>{crewTotal}</b></li>
                </ul>
            </header>

            <nav className="gb-rail" aria-label="Menus" onPointerDown={(e) => e.stopPropagation()}>
                {([["jobs", "bid", "Jobs", "J"], ["skyline", "skyline", "Skyline", "K"], ["firm", "firm", "Firm", "F"], ["console", "console", "Console", "⌃J"], ["menu", "menu", "Menu", "M"]] as const).map(([id, ic, label, key]) => (
                    <button key={id} type="button" className="gb-rail-btn" aria-pressed={win === id} aria-label={label} data-tip={`${label} · ${key}`} data-ping={id === "firm" && (canIncorporate(s, f) || PERKS.some((p) => perkReady(s.perks, p) && s.charter >= p.cost)) ? "" : id === "jobs" && wait ? "" : undefined} onClick={() => { setSel(null); setWin(win === id ? null : id); }}>
                        <Ico id={ic} size={34} /><kbd>{key}</kbd>
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
                    <Ico id="bid" size={20} /><span>{def ? def.name : nextJob(s).name}</span>
                    {aj && <em>{aj.step === "permit" ? `permit ${fmtSecs(aj.left)}` : aj.step === "inspect" ? `inspection ${fmtSecs(aj.left)}` : `${Math.floor(prog * 100)}%`}</em>}
                </button>
                {jobOpen && (def && aj && f ? (
                    <div className="gb-job-body">
                        <ol className="gb-phases">
                            {plan(def, f).map((ph, i) => {
                                const done = aj.step === "inspect" || aj.phase > i, cur = aj.step === "build" && aj.phase === i;
                                const needs = phaseNeeds(aj, ph);
                                const tot = needs.reduce((a, [, q]) => a + q, 0) || 1;
                                const got = cur ? needs.reduce((a, [m, q]) => a + Math.min(aj.got[m], q), 0) : 0;
                                const pct = done ? 100 : Math.floor((got / tot) * 100);
                                const need = needs.map(([m, q]) => `${fmt(q)} ${MATS[m].name}`).join(", ");
                                return (
                                    <li key={ph.id} data-state={done ? "done" : cur ? "cur" : "wait"} data-tip={`${ph.name}: ${need}`}>
                                        <Ico id={MAT_ICONS[needs[0]?.[0] ?? 0]} size={20} /><i className="gb-bar"><b style={{ width: `${pct}%` }} /></i>
                                    </li>
                                );
                            })}
                        </ol>
                        <p className="gb-job-pay">pays {fmtCash(payout(s, def, f, chain(s), aj.index) * (1 + aj.bonus))} + {repPay(s, def, f)} rep</p>
                        {aj.step === "inspect" && ovt > 0 && <button type="button" className="gb-go" disabled={s.cash < ovt} onClick={() => act((x) => overtime(x))} data-tip="Pay to finish the inspection now">Overtime {fmtCash(ovt)}</button>}
                    </div>
                ) : (
                    <div className="gb-job-body">
                        <p className="gb-job-pay">{wait ?? "Permit filed. The crew is moving in."}</p>
                        {wait && <i className="gb-bar" data-tip={`${MATS[s.open - 1].name} toward opening ${MATS[s.open].name}`}><b style={{ width: `${Math.min(100, Math.floor((s.amt[s.open - 1] / UNLOCK[s.open]) * 100))}%` }} /></i>}
                        <p className="gb-job-pay">Hire crews and buy equipment to make material faster. Jobs start on their own.</p>
                        <button type="button" className="gb-go" onClick={() => setWin("jobs")}>See next jobs</button>
                    </div>
                ))}
                {s.change && (
                    <div className="gb-change" data-tip="The client wants more. Extra materials, bigger payout.">
                        <p>Change order <em>+{Math.round(s.change.bonus * 100)}% pay · {fmtSecs(s.change.left)}</em></p>
                        <div><button type="button" className="gb-go" onClick={() => act((x) => acceptChange(x))}>Accept <kbd>Y</kbd></button><button type="button" className="gb-go" onClick={() => act((x) => declineChange(x))}>Decline <kbd>N</kbd></button></div>
                    </div>
                )}
            </aside>

            <ul className="gb-feed" aria-live="polite">{notes.map((n) => <li key={n.id} data-tone={n.tone}>{n.text}</li>)}</ul>
            {away && <button type="button" className="gb-away" onClick={() => setAway(null)}>{away} <span>dismiss</span></button>}
            {(paused || shell.paused) && <div className="gb-paused" role="status">Paused · P to resume</div>}

            {card !== null && <MatCard s={s} i={card} onBuy={doBuy} onUnlock={doUnlock} onClose={() => setSel(null)} />}

            <div className="gb-dock" onPointerDown={(e) => e.stopPropagation()} role="toolbar" aria-label="Materials">
                {MATS.map((m, i) => {
                    const open = i < s.open, next = i === s.open;
                    const r = open ? rawRate(s, i, f, chain(s)) : 0;
                    const need = next ? UNLOCK[i] : 0;
                    return (
                        <button key={m.id} type="button" className="gb-tile" data-state={open ? "open" : next ? "next" : "locked"} data-on={card === i ? "" : undefined} data-ready={next && canUnlock(s, i) ? "" : undefined}
                            aria-pressed={card === i} aria-label={`${m.name}${open ? `, ${fmt(s.amt[i])}` : ", locked"}`}
                            data-tip={open ? `${m.name} · ${fmt(r)}/s` : next ? `${m.name} · needs ${fmt(need)} ${MATS[i - 1].name}` : "Locked"}
                            onClick={() => { setWin(null); setSel(card === i ? null : i); }}>
                            <kbd>{MAT_KEYS[i]}</kbd>
                            <Ico id={open || next ? MAT_ICONS[i] : "lock"} size={36} className={open ? "" : "is-dim"} />
                            <b>{open ? fmt(s.amt[i]) : next ? `${Math.min(99, Math.floor((s.amt[i - 1] / need) * 100))}%` : ""}</b>
                            {open && <i className="gb-lv">{s.crews[i]}</i>}
                        </button>
                    );
                })}
            </div>

            <Window open={win === "jobs"} title="Next jobs" hint={`${s.builtThisFirm} of ${JOBS.length} built`} variant="shutter" icon="bid" onClose={() => setWin(null)}>
                <p className="gb-line">{city.name}. {city.blurb}</p>
                <ul className="gb-bids">
                    {s.job && def && <li className="is-now"><div><strong>{def.name}</strong><span>{jobPhaseName(s.job, f)} · {city.sites[def.stage - 1]}</span></div><span className="gb-req">{Math.floor(prog * 100)}%</span></li>}
                    {queue(s, 4).map((q, i) => (
                        <li key={q.index} className={q.ready ? "is-next" : "is-locked"}>
                            <div><strong>{i === 0 && !s.job ? "Up next: " : ""}{q.job.name}</strong><span>{q.job.notes.join(" · ")}</span></div>
                            <dl><dt>pays</dt><dd>{fmtCash(payout(s, q.job, f, chain(s), q.index))}</dd><dt>rep</dt><dd>+{repPay(s, q.job, f)}</dd><dt>stage</dt><dd>{q.job.stage}</dd></dl>
                            {!q.ready && <span className="gb-req">Open {MATS[[0, 2, 4, 7, 9, 11][q.job.stage - 1]].name}</span>}
                        </li>
                    ))}
                </ul>
                {wait && <p className="gb-line">{wait}.</p>}
            </Window>

            <Window open={win === "skyline"} title="Skyline" hint={`${s.skyline.length} built`} variant="iris" size="lg" icon="skyline" onClose={() => setWin(null)}>
                <SkylineView skyline={s.skyline} />
            </Window>

            <Window open={win === "firm"} title="Firm" hint={`${city.name} · firm ${s.firm + 1}`} variant="settle" size="lg" icon="firm" onClose={() => setWin(null)}>
                <dl className="gb-stats">
                    <dt>Reputation this firm</dt><dd>{fmt(s.repFirm)}</dd>
                    <dt>Charter to spend</dt><dd>{s.charter}</dd>
                    <dt>Buildings</dt><dd>{s.built}</dd>
                    <dt>Offline limit</dt><dd>{Math.round((TUNE.offlineH + f.offlineH))} hours</dd>
                </dl>
                <PerkGrid s={s} onBuy={(id) => act((x) => { if (buyPerk(x, id)) save(); })} onAuto={(n) => act((x) => { x.autoOff = x.autoOff.includes(n) ? x.autoOff.filter((v) => v !== n) : [...x.autoOff, n]; save(); })} />
                <p className="gb-line">{canIncorporate(s, f) ? `Incorporate a new firm in ${cityOf(s.firm + 1).name}. +${charterGain(s, f)} charter. The skyline stays.` : `Incorporate opens at ${TUNE.charterMinRep} reputation earned this firm (you have ${fmt(s.repFirm)}).`}</p>
                <ConfirmGo label="Incorporate" sure="Cash, crews and materials reset. Charter and the skyline stay. Sure?" onGo={doIncorporate} disabled={!canIncorporate(s, f)} />
            </Window>

            <Window open={win === "console"} title="Console" hint="gb help" variant="drop" icon="console" size="md" onClose={() => setWin(null)}>
                <Console run={doCommand} />
            </Window>

            <Window open={win === "menu"} title="Menu" variant="settle" size="sm" icon="menu" onClose={() => setWin(null)}>
                <MenuBody s={s} paused={paused} onPause={togglePause} simple={simple} onSimple={toggleSimple} fs={shell.supportsFullscreen} onFs={shell.toggleFullscreen} fsOn={shell.fullscreen}
                    onImport={(st) => { const p = parse(st); if (!p) { note("That save could not be read."); return; } if (sRef.current) writeStored(window.localStorage, SAVE_KEY + "-backup", serialize(sRef.current)); sRef.current = p; seen.current = { built: p.built, open: p.open, change: !!p.change }; save(); bump(); note("Save imported. The old one is kept as a backup.", "hot"); }}
                    onWipe={() => { if (sRef.current) writeStored(window.localStorage, SAVE_KEY + "-backup", serialize(sRef.current)); sRef.current = fresh(Date.now()); seen.current = { built: 0, open: 1, change: false }; save(); setWin(null); setSel(null); bump(); }} onNote={note} />
            </Window>
        </div>
    );
}


function CostLine({ s, i, t }: { s: State; i: number; t: Tier }) {
    const c = tierCost(s, i, t);
    return (
        <b className="gb-cost">
            {c.cur === "mat" ? <Ico id={MAT_ICONS[c.mat]} size={16} /> : <Ico id="cash" size={16} />}
            {c.cur === "cash" ? fmtCash(c.amount) : fmt(c.amount)}
        </b>
    );
}

function MatCard({ s, i, onBuy, onUnlock, onClose }: { s: State; i: number; onBuy: (i: number, t: Tier) => void; onUnlock: () => void; onClose: () => void }) {
    const m = MATS[i];
    const f = effects(s);
    const open = i < s.open;
    const next = i === s.open;
    return (
        <section className="gb-card" key={i} role="dialog" aria-label={m.name} onPointerDown={(e) => e.stopPropagation()}>
            <header>
                <Ico id={open || next ? MAT_ICONS[i] : "lock"} size={40} />
                <div><h3>{m.name}</h3><p>{open ? `${fmt(rawRate(s, i, f, chain(s)))} /s · ${fmt(s.amt[i])} held` : next ? `needs ${fmt(UNLOCK[i])} ${MATS[i - 1].name}` : "Locked"}</p></div>
                <button type="button" className="gb-x" onClick={onClose} aria-label="Close" data-tip="Close · Esc">×</button>
            </header>
            {open ? (
                <>
                    <p className="gb-card-line">{i < NMAT - 1 ? `Boosts ${MATS[i + 1].name}` : "Boosts reputation"}{i >= TUNE.backFrom && i > 0 ? ` and ${MATS[i - 1].name}` : ""}</p>
                    <div className="gb-tiers">
                        {([0, 1, 2] as Tier[]).map((t) => {
                            const ok = canBuy(s, i, t);
                            const done = t === 2 && s.method[i];
                            const lvl = t === 0 ? `${s.crews[i]} hired` : t === 1 ? `lv ${s.equip[i]}` : done ? "done" : "once";
                            const tip = t === 0 ? `Hire a crew. Paid in ${MATS[Math.max(0, i - 1)].name}.` : t === 1 ? `${m.equip}: output x2. Paid in ${MATS[Math.max(0, i - 1)].name}.` : done ? m.methodNote : methodReady(s, i) ? `${m.method}: output x3, ${m.methodNote}` : "Needs 2 equipment levels first";
                            return (
                                <button key={t} type="button" className="gb-tier" disabled={!ok} onClick={() => onBuy(i, t)} data-tip={tip} data-done={done ? "" : undefined}>
                                    <kbd>{TIER_KEY[t]}</kbd>
                                    <Ico id={TIER_ICON[t]} size={30} />
                                    <span className="gb-tier-name">{["I", "II", "III"][t]} {TIER_LABELS[t]}</span>
                                    <span className="gb-tier-lv">{lvl}</span>
                                    {done ? <b className="gb-cost"> </b> : <CostLine s={s} i={i} t={t} />}
                                </button>
                            );
                        })}
                    </div>
                </>
            ) : next ? (
                <button type="button" className="gb-go gb-wide" disabled={!canUnlock(s, i)} onClick={onUnlock}>{canUnlock(s, i) ? `Bring ${m.name} on site · U` : `${fmt(s.amt[i - 1])} of ${fmt(UNLOCK[i])} ${MATS[i - 1].name}`}</button>
            ) : <p className="gb-card-line">Open {MATS[i - 1].name} first.</p>}
            <i className="gb-cn" data-c="tl" /><i className="gb-cn" data-c="tr" /><i className="gb-cn" data-c="bl" /><i className="gb-cn" data-c="br" />
        </section>
    );
}

function PerkGrid({ s, onBuy, onAuto }: { s: State; onBuy: (id: string) => void; onAuto: (n: number) => void }) {
    const autoOf: Record<string, number> = { o2: 1, o4: 2, l9: 3 };
    const branches = [["ops", "Operations"], ["money", "Money"], ["logistics", "Logistics"]] as const;
    return (
        <div className="gb-perks">
            {branches.map(([b, label]) => (
                <div key={b}>
                    <h3>{label}</h3>
                    <ul>
                        {PERKS.filter((p) => p.branch === b).map((p) => {
                            const own = s.perks.includes(p.id), ready = perkReady(s.perks, p);
                            return (
                                <li key={p.id}>
                                    <button type="button" className="gb-perk" disabled={own || !ready || s.charter < p.cost} data-own={own ? "" : undefined} data-tip={`${p.desc}${own ? " Owned." : !ready ? " Needs an earlier perk." : ""}`} onClick={() => onBuy(p.id)}>
                                        <span>{p.name}</span><em>{own ? "owned" : p.cost}</em>
                                    </button>
                                    {own && autoOf[p.id] && <button type="button" className="gb-auto" aria-pressed={!s.autoOff.includes(autoOf[p.id])} onClick={() => onAuto(autoOf[p.id])} data-tip="Switch this automation on or off">{s.autoOff.includes(autoOf[p.id]) ? "off" : "on"}</button>}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </div>
    );
}

function SkylineView({ skyline }: { skyline: State["skyline"] }) {
    if (skyline.length === 0) return <p className="gb-none">Nothing built yet. Every finished job stays here for good, even after you incorporate.</p>;
    const counts = new Map<string, number>();
    skyline.forEach((b) => counts.set(b.id, (counts.get(b.id) ?? 0) + 1));
    return (
        <ul className="gb-sky">
            {JOBS.filter((j) => counts.has(j.id)).map((j) => (
                <li key={j.id} style={{ "--h": `${Math.min(190, 60 + Math.max(1, j.floors) * 8)}px` } as CSSProperties}>
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
    const [pending, setPending] = useState<State | null>(null);
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
                if (r.ok) setPending(r.data); else onNote(r.error);
            }} />
            {pending && (
                <div className="gb-confirm">
                    <p>Replace this save with the imported one? The current save is kept as a backup.</p>
                    <div><button type="button" className="gb-go" onClick={() => { onImport(pending); setPending(null); }}>Replace save</button><button type="button" className="gb-go" onClick={() => setPending(null)}>Keep current</button></div>
                </div>
            )}
            <ConfirmGo label="Start over" sure="Deletes this save, skyline included. Sure?" onGo={onWipe} />
            <p className="gb-keys">1-0 - = materials · Q W E tiers · J jobs · K skyline · F firm · ` site console · wheel zoom · drag pan · R reset</p>
        </div>
    );
}
