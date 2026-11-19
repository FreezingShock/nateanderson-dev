"use client";

// Groundbreak: run a construction company. A full site view you can zoom and pan fills the screen; every menu floats over it as a
// small window and closes by clicking blank ground. The engine is lib/groundbreak/engine.ts.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { useGameShell } from "@/components/games/shell/game-route-shell";
import { createSaveTools, downloadText, readPickedFile, writeStored } from "@/lib/games/save";
import { loadSave, reviveAuto, reviveText, rollCopies, writeSave, encodeSave } from "@/lib/saves/core";
import { JOB_BY, JOBS, MATS, PERKS, STAGES, TIER_LABELS, TUNE, UNLOCK_COST as UNLOCK, cityOf, N as NMAT, type Perk } from "@/lib/groundbreak/data";
import { Ticked } from "@/components/games/juice/ticked";
import {
    GROUNDBREAK_SAVE, SAVE_KEY, SAVE_VERSION, acceptChange, buy, jobMat, buyPerk, canBuy, canIncorporate, canUnlock, catchUp, charterGain, chain, declineChange, effects, fmt, fmtAge,
    fmtCash, fresh, incorporate, isSave, jobFloors, jobPhaseName, jobProgress, methodReady, overtime, overtimeCost, parse, payout, perkReady, phaseNeeds,
    plan, queue, nextJob, offlineCapS, rawRate, repPay, repeatPay, repeatRep, stageOf, step, tierCost, unlock, waitingFor, type State,
} from "@/lib/groundbreak/engine";
import { gbCommand } from "@/lib/groundbreak/commands";
import { awaySnap, awaySummary, doCue, nextCue, type AwaySummary, type Cue } from "@/lib/groundbreak/guide";
import { usePresence, useAutosave } from "@/components/game-kit/hooks";
import { useToasts } from "@/components/game-kit/use-toasts";
import { watchNewerSave } from "@/lib/game-kit/tabs";
import { MAT_ICONS, iconUrl } from "./icons";
import { GB_JOBS, type GbJobId } from "@/components/groundbreak-art";
import { GB_BANNERS, type GbBannerId } from "@/components/groundbreak-art/ui-art";
import { GB_ICONS, GB_ICON_COLS, GB_ICON_ROWS, GB_ICON_SHEET, type GbIconId } from "@/components/groundbreak-art/icons";
import { GbSiteScene as GroundbreakScene } from "@/components/groundbreak-art/site-scene";
import { CAMERA_HOME, GROUND_Y, WORLD_H, WORLD_W, ZOOM_MAX, ZOOM_MIN, type Camera, type SceneJob } from "./scene-types";

const tools = createSaveTools<State>({ app: "groundbreak", version: SAVE_VERSION, validate: isSave });
type Tier = 0 | 1 | 2;
const fmtSecs = (sec: number) => { const s = Math.max(0, Math.ceil(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
type Win = null | "jobs" | "skyline" | "firm" | "console" | "menu";
interface Note { id: number; text: string; tone?: "hot" | "dim"; sticky?: boolean }
/** A short rising label (+1 crew, +$60) spawned over a tile or chip. Positions are in root pixels. */
interface Float { id: number; x: number; y: number; text: string; tone: "buy" | "cash" }
/** The big beat banner: a job handed over, a stage opened, a material on site. One at a time, 2.6 s. */
interface Moment { key: number; kind: "job" | "stage" | "open"; kicker: string; title: string; sub?: string }
const snapOf = (s: State) => ({ built: s.built, open: s.open, change: !!s.change, cashAll: s.cashAll });
const TIER_ICON = ["crew", "equip", "method"] as const;
/** The machine each material row buys at tier II, in material order. */
const EQUIP_ICONS = ["loader", "excavator", "kiln", "mixer", "bender", "mill", "float", "drawer", "brake", "yard", "rig", "crane"];
/** Dock sections: the chain split by what each group builds. */
const DOCK_GROUPS: [string, number, number][] = [["Earthwork", 0, 2], ["Concrete", 2, 4], ["Frame", 4, 6], ["Skin & services", 6, 9], ["Tower", 9, 12]];
const BRANCH_ICON: Record<string, string> = { ops: "crew", money: "cash", logistics: "permit" };

/** Finished-building thumbnail from the job's last cutaway frame. */
function JobThumb({ id, w = 88, h = 56 }: { id: string; w?: number; h?: number }) {
    const j = GB_JOBS[id as GbJobId];
    if (!j) return null;
    const n = j.frames.length, k = Math.min(w / j.w, h / j.h);
    return <i className="gb-thumb" aria-hidden="true" style={{ width: j.w * k, height: j.h * k, backgroundImage: `url("${j.src}")`, backgroundSize: `${j.w * n * k}px ${j.h * k}px`, backgroundPosition: `${-(n - 1) * j.w * k}px 0` }} />;
}
function Banner({ id }: { id: GbBannerId }) {
    return <i className="gb-banner" aria-hidden="true" style={{ backgroundImage: `url("${GB_BANNERS[id]}")` }} />;
}
const TIER_KEY = ["Q", "W", "E"] as const;
const MAT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="];
/** Space the dock and cue take at the bottom: a tall two-row dock on portrait phones, one slim row on a phone held sideways. */
const dockFallback = (r: { width: number; height: number }) => (r.height <= 520 ? 96 : r.width <= 860 ? 230 : 150);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** One icon. Every icon the game uses is a cell of the shared sheet, so the first paint needs one image request, not one per icon. */
function Ico({ id, size = 20, className }: { id: string; size?: number; className?: string }) {
    const [url, setUrl] = useState("");
    const cell = id in GB_ICONS ? GB_ICONS[id as GbIconId] : undefined;
    useEffect(() => { if (cell === undefined) setUrl(iconUrl(id)); }, [id, cell]);
    if (cell !== undefined) {
        return <i className={`gb-ico ${className ?? ""}`} style={{ width: size, height: size, backgroundImage: `url("${GB_ICON_SHEET}")`, backgroundSize: `${GB_ICON_COLS * size}px ${GB_ICON_ROWS * size}px`, backgroundPosition: `${-(cell % GB_ICON_COLS) * size}px ${-Math.floor(cell / GB_ICON_COLS) * size}px` }} aria-hidden="true" />;
    }
    return <i className={`gb-ico ${className ?? ""}`} style={{ width: size, height: size, backgroundImage: url ? `url(${url})` : undefined }} aria-hidden="true" />;
}

/** Keeps a window mounted for its exit animation (the game kit's usePresence). */
function useExit(open: boolean, ms = 190): { mounted: boolean; state: "in" | "out" } {
    const { mounted } = usePresence(open, ms);
    return { mounted, state: open ? "in" : "out" };
}

/** Holds the last non-null value for `ms` after it clears, so a card can play its exit. `state` is "out" while it leaves. */
function useHeld<T>(value: T | null, ms = 120): { shown: T | null; state: "in" | "out" } {
    const [held, setHeld] = useState<T | null>(value);
    useEffect(() => {
        if (value !== null) { setHeld(value); return; }
        const id = window.setTimeout(() => setHeld(null), ms);
        return () => window.clearTimeout(id);
    }, [value, ms]);
    return { shown: value ?? held, state: value !== null ? "in" : "out" };
}

function Window({ open, id, title, hint, variant, size = "md", onClose, children, icon, banner }: { open: boolean; id: string; title: string; hint?: string; variant: "iris" | "shutter" | "settle" | "drop" | "unroll" | "stamp"; size?: "sm" | "md" | "lg"; onClose: () => void; children: ReactNode; icon?: string; banner?: GbBannerId }) {
    const { mounted, state } = useExit(open);
    if (!mounted) return null;
    return (
        <section className={`gb-win gb-${size}`} data-id={id} data-v={variant} data-s={state} role="dialog" aria-label={title} onPointerDown={(e) => e.stopPropagation()}>
            {banner && <Banner id={banner} />}
            <header className="gb-win-head">
                {icon && <Ico id={icon} size={32} />}
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
    // Toasts (the game kit's queue): warnings stay 20 s and are never pushed out; of the rest only the newest stays beside a new one.
    const { toasts: notes, push: pushNote } = useToasts<NonNullable<Note["tone"]>>({ keep: 1, dedupe: true, ttlMs: 6000, stickyTtlMs: 20000 });
    // the material that just came on site: its dock tile plays one ring (keyed, so a new one restarts it)
    const [pulse, setPulse] = useState<{ key: number; mat: number } | null>(null);
    const pulseId = useRef(0);
    // the crew-tick of the job that was just handed over: it plays one stamp (`data-fresh`, see app/camino/groundbreak.css)
    const [freshTick, setFreshTick] = useState(-1);
    // the stage that just opened (its pip stamps once), and the perk that was just bought (its tile stamps once)
    const [freshStage, setFreshStage] = useState(-1);
    const [freshPerk, setFreshPerk] = useState<string | null>(null);
    // the perk a phone player tapped once: its name and effect show in the Firm footer, and a second tap buys it
    const [perkPeek, setPerkPeek] = useState<string | null>(null);
    const lastStage = useRef(-1);
    useEffect(() => { if (win !== "firm") setPerkPeek(null); }, [win]);
    // juice: rising labels, the dock tile that was just bought from, the beat banner, the cash chip flash, the Next move button's press
    const [floats, setFloats] = useState<Float[]>([]);
    const floatId = useRef(0);
    const [popTile, setPopTile] = useState<{ key: number; mat: number } | null>(null);
    const popId = useRef(0);
    const [moment, setMoment] = useState<Moment | null>(null);
    const momentId = useRef(0);
    const [cashGain, setCashGain] = useState(0);
    const [cuePress, setCuePress] = useState(0);
    /** What the active job pays at handover, remembered each tick, because the job is gone by the time the handover is noticed. */
    const worth = useRef({ pay: 0, rep: 0 });
    /** Measured height of the dock plus the Next move button above it; the camera keeps the ground clear of both. */
    const dockPx = useRef(0);
    const [away, setAway] = useState<AwaySummary | null>(null);
    const [conflict, setConflict] = useState(false);
    const conflictRef = useRef(false);
    const lastInput = useRef(0);
    const lastBackup = useRef(0);
    const warnedWrite = useRef(false);
    const [cam, setCam] = useState<Camera>(CAMERA_HOME);
    const camRef = useRef<Camera>(CAMERA_HOME);
    /** True once the player zoomed or panned; until then the camera follows the current job. */
    const userCam = useRef(false);
    const lastJob = useRef<string | null>(null);
    const seenRe = useRef(-1);
    const viewRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const dockRef = useRef<HTMLDivElement>(null);
    const manualPause = useRef(false);
    const [paused, setPaused] = useState(false);
    const [reduce, setReduce] = useState(false);
    const [simple, setSimple] = useState(false);
    const [jobOpen, setJobOpen] = useState(true);
    const lastTick = useRef(0);
    const seen = useRef({ built: 0, open: 1, change: false, cashAll: 0 });
    const dockHeight = useCallback((r: { width: number; height: number }) => (dockPx.current ? dockPx.current : dockFallback(r)), []);
    const shell = useGameShell();

    // a sticky note is a warning the player must be able to read (a broken save, storage blocked): later toasts do not push it out, and it stays 20 s
    const note = useCallback((text: string, tone?: Note["tone"], sticky = false) => {
        pushNote(text, tone, sticky);
    }, [pushNote]);
    /** A label that rises from a tile or chip (the selector names it) and fades. Gone after a second. */
    const spawnFloat = useCallback((target: string, text: string, tone: Float["tone"]) => {
        const root = rootRef.current;
        const el = root?.querySelector<HTMLElement>(target);
        if (!root || !el || !text) return;
        const rr = root.getBoundingClientRect(), er = el.getBoundingClientRect();
        const id = ++floatId.current;
        setFloats((f) => [...f.slice(-5), { id, x: er.left - rr.left + er.width / 2, y: er.top - rr.top + 4, text, tone }]);
        window.setTimeout(() => setFloats((f) => f.filter((v) => v.id !== id)), 1000);
    }, []);
    /** The beat banner: a job handed over, a stage opened, a material on site. */
    const showMoment = useCallback((m: Omit<Moment, "key">) => {
        const key = ++momentId.current;
        setMoment({ ...m, key });
        window.setTimeout(() => setMoment((cur) => (cur && cur.key === key ? null : cur)), 2600);
    }, []);
    /** A purchase landed: the tile it belongs to pops and a label rises from it. */
    const buyFx = useCallback((mat: number, tier: Tier) => {
        setPopTile({ key: ++popId.current, mat });
        spawnFloat(`.gb-tile[data-i="${mat}"]`, tier === 0 ? "+1 crew" : `x${tier === 1 ? TUNE.equipMult : TUNE.methodMult} output`, "buy");
    }, [spawnFloat]);
    const save = useCallback(() => {
        const s = sRef.current;
        if (!s) return;
        if (conflictRef.current) return;
        s.savedAt = Date.now();
        const raw = writeSave(window.localStorage, GROUNDBREAK_SAVE, s, s.savedAt);
        if (raw === null) {
            if (!warnedWrite.current) { warnedWrite.current = true; note("The browser would not save the game (storage full or blocked). Export a save from the Menu so nothing is lost.", "hot", true); }
            return;
        }
        // two rolling copies, five minutes apart, so a bad import or a bug never costs more than a few minutes
        if (s.savedAt - lastBackup.current > 300_000) {
            lastBackup.current = s.savedAt;
            try { rollCopies(window.localStorage, SAVE_KEY + "-auto1", SAVE_KEY + "-auto2", raw); } catch { /* storage blocked */ }
        }
    }, [note]);

    // ---- camera ------------------------------------------------------------------------------------------------------------
    const setCamera = useCallback((c: Camera) => {
        const z = clamp(c.z, ZOOM_MIN, ZOOM_MAX);
        let y = clamp(c.y, 20, WORLD_H + 20);
        const r = viewRef.current?.getBoundingClientRect();
        if (r) {
            // keep the ground line above the dock (and below the header) so the building is never buried behind it
            const sc = Math.max(r.width / WORLD_W, r.height / WORLD_H) * z;
            const dockH = dockHeight(r);
            y = Math.max(y, GROUND_Y - (r.height / 2 - dockH) / sc);
        }
        const n = { x: clamp(c.x, -40, WORLD_W + 40), y, z };
        camRef.current = n;
        setCam(n);
    }, [dockHeight]);
    /** Frame the site: the job (or the lot for the next job) fills about half the free view, so the crew and the staged building are the first thing seen. */
    const homeCam = useCallback((jobId?: string): Camera => {
        const r = viewRef.current?.getBoundingClientRect();
        if (!r) return CAMERA_HOME;
        const cover = Math.max(r.width / WORLD_W, r.height / WORLD_H);
        const portrait = r.height > r.width;
        const art = jobId ? GB_JOBS[jobId as GbJobId] : undefined;
        if (!art) return { x: portrait ? 240 : 236, y: portrait ? 160 : 166, z: clamp(r.width / (cover * 250), ZOOM_MIN, 1) };
        const hw = art.h / 2 + 14, ww = art.w / 2 + 24;
        const dockH = dockHeight(r), topH = r.width <= 860 ? 150 : 116;
        const free = Math.max(120, r.height - dockH - topH);
        const z = clamp(Math.min(free / (cover * hw), (r.width * 0.86) / (cover * ww)), 0.6, 3.2);
        // centre the building in the free band between the header and the dock
        const midShift = (dockH - topH) / 2 / (cover * z);
        return { x: 240, y: GROUND_Y - hw / 2 + 8 + midShift, z };
    }, [dockHeight]);
    const zoomAt = useCallback((factor: number, px?: number, py?: number) => {
        userCam.current = true; lastInput.current = Date.now();
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
        userCam.current = true; lastInput.current = Date.now();
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
        // lib/saves/core copies a save that cannot be read to SAVE_KEY-corrupt, then tries the rolling copies before it gives up
        const got = loadSave(window.localStorage, GROUNDBREAK_SAVE, now);
        const loaded = got.state;
        if (got.note) note(got.note, "hot", true);
        const s = loaded ?? fresh(now);
        if (loaded) {
            const gone = (now - s.savedAt) / 1000;
            const snap = awaySnap(s);
            const did = catchUp(s, gone);
            setAway(awaySummary(snap, s, gone, did, offlineCapS(effects(s))));
        }
        s.savedAt = now;
        sRef.current = s;
        seen.current = snapOf(s);
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
            if (gap > 60) {
                // a long background spell (sleeping laptop, throttled tab): show what the crews did, same as after closing the page
                const snap = awaySnap(s);
                const did = catchUp(s, gap);
                const sum = awaySummary(snap, s, gap, did, offlineCapS(effects(s)));
                if (sum) setAway(sum);
            } else if (gap > 3) catchUp(s, gap); else step(s, Math.min(gap, 1));
            const sn = seen.current;
            if (s.built > sn.built) {
                const last = s.skyline[s.skyline.length - 1];
                const w = worth.current;
                showMoment({ kind: "job", kicker: "Handed over", title: JOB_BY.get(last?.id ?? "")?.name ?? "Job", sub: w.pay > 0 ? `+${fmtCash(w.pay)} and +${fmt(w.rep)} rep` : undefined });
                if (w.pay > 0) spawnFloat(".gb-res li:first-child", `+${fmtCash(w.pay)}`, "cash");
                setCashGain((n) => n + 1);
                setFreshTick(s.builtThisFirm - 1);
            }
            if (s.job && !s.job.rerun) {
                const jd = JOB_BY.get(s.job.id), fx = effects(s);
                if (jd) worth.current = { pay: payout(s, jd, fx, chain(s), s.job.index) * (1 + s.job.bonus), rep: repPay(s, jd, fx) };
            }
            if (seenRe.current < 0 || s.reruns < seenRe.current) seenRe.current = s.reruns;
            if (s.reruns > seenRe.current) {
                seenRe.current = s.reruns;
                if (s.built === sn.built) note(`Repeat order finished: +${fmtCash(s.cashAll - sn.cashAll)}. It pays half and adds no building.`);
            }
            const jid = s.job?.id ?? "";
            if (lastJob.current !== null && jid && jid !== lastJob.current) {
                userCam.current = false; // a new job always brings the camera back to the site
                const jd = JOB_BY.get(jid);
                if (jd) note(`${jd.name} started at ${cityOf(s.firm).sites[jd.stage - 1]}.`, "hot");
            }
            lastJob.current = jid;
            if (s.open > sn.open) { showMoment({ kind: "open", kicker: "On site", title: MATS[s.open - 1].name, sub: "Hire crews on it from the dock." }); setPulse({ key: ++pulseId.current, mat: s.open - 1 }); }
            // a new stage: the pip stamps and the feed names it (the first read only records the stage, it does not announce it)
            const stNow = stageOf(s);
            if (lastStage.current > 0 && stNow > lastStage.current) { showMoment({ kind: "stage", kicker: `Stage ${stNow}`, title: STAGES[stNow - 1]?.name ?? "New crew", sub: "A new crew is on the job." }); setFreshStage(stNow); }
            lastStage.current = stNow;
            if (s.change && !sn.change) note("Change order: the client wants more.", "hot");
            seen.current = snapOf(s);
        }, 100);
        const ui = window.setInterval(bump, 250);
        // another tab saved newer progress: stop saving here so it cannot be overwritten (the game kit's watcher)
        const offNewer = watchNewerSave(SAVE_KEY, () => sRef.current?.savedAt, () => { conflictRef.current = true; setConflict(true); });
        // after 40 s without touching the view, the camera finds the site again
        const follow = window.setInterval(() => {
            if (userCam.current && lastInput.current && Date.now() - lastInput.current > 40_000) { userCam.current = false; const s = sRef.current; if (s) setCamera(homeCam(s.job?.id ?? nextJob(s).id)); }
        }, 2000);
        // `gb` in the site console talks to the open game through this event
        const onLive = (e: Event) => { (e as CustomEvent).detail.live = { s: sRef.current, changed: () => { bump(); save(); } }; };
        window.addEventListener("gb:live", onLive);
        return () => { clearInterval(tick); clearInterval(ui); clearInterval(follow); offNewer(); window.removeEventListener("gb:live", onLive); };
    }, [ready, bump, save, note, setCamera, homeCam, showMoment, spawnFloat]);
    // Saves every 8 s, on tab hide, on leaving and on unmount (the game kit's loop; save() writes through lib/saves).
    useAutosave(save, { enabled: ready });

    // ---- actions -----------------------------------------------------------------------------------------------------------
    const act = useCallback((fn: (s: State) => unknown) => { const s = sRef.current; if (s) { fn(s); bump(); } }, [bump]);
    const doBuy = useCallback((i: number, t: Tier) => act((s) => { if (buy(s, i, t)) { save(); buyFx(i, t); } }), [act, save, buyFx]);
    const doCueNow = useCallback(() => {
        const s = sRef.current;
        if (!s) return;
        const c = nextCue(s);
        if (!c.doable) { if (c.mat !== undefined && c.mat < s.open) { setWin(null); setSel(c.mat); } else if (c.kind === "wait") note(c.why); return; }
        if (c.kind === "perk" || c.kind === "incorporate") { setSel(null); setWin("firm"); if (c.kind === "perk") { const d = doCue(s, c); if (d) { save(); note(d, "hot"); bump(); } } return; }
        const d = doCue(s, c);
        if (d) {
            save(); bump(); setCuePress((n) => n + 1);
            // a buy keeps its tile and label as the confirmation; the other cues keep their one-line toast
            if (c.kind === "buy" && c.mat !== undefined && c.tier !== undefined) buyFx(c.mat, c.tier); else note(d, "hot");
        }
    }, [bump, note, save, buyFx]);
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
            if ((e.key === " " || k === "g") && !(el && (el.tagName === "BUTTON" || el.tagName === "A"))) { e.preventDefault(); doCueNow(); return; }
            if (e.key === "[" || e.key === "]") {
                const open = sRef.current?.open ?? 1;
                setWin(null);
                setSel((c) => (c === null ? (e.key === "]" ? 0 : open - 1) : (c + (e.key === "]" ? 1 : -1) + open) % open));
                return;
            }
            if (e.key === "?" || e.key === "/") { setSel(null); setWin((w) => (w === "menu" ? null : "menu")); return; }
            const mi = MAT_KEYS.indexOf(e.key);
            if (mi >= 0 && !e.shiftKey) { setWin(null); setSel((c) => (c === mi ? null : mi)); return; }
            if (sel !== null && (k === "q" || k === "w" || k === "e")) { doBuy(sel, (k === "q" ? 0 : k === "w" ? 1 : 2) as Tier); return; }
            if (k === "j") setWin((w) => (w === "jobs" ? null : "jobs"));
            else if (k === "k") setWin((w) => (w === "skyline" ? null : "skyline"));
            else if (k === "f") setWin((w) => (w === "firm" ? null : "firm"));
            else if (k === "m") setWin((w) => (w === "menu" ? null : "menu"));
            else if (k === "c") setWin((w) => (w === "console" ? null : "console"));
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
    }, [ready, win, sel, doBuy, doUnlock, doCueNow, act, togglePause, reset, zoomAt, panBy]);

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

    // the dock wraps to two or three rows on phones; publish how much room it takes so the cue, view buttons and feed sit above it
    const measureRef = useRef<() => void>(() => {});
    useEffect(() => {
        const root = rootRef.current, dock = dockRef.current;
        if (!root || !dock) return;
        const measure = () => {
            const rr = root.getBoundingClientRect(), dr = dock.getBoundingClientRect();
            root.style.setProperty("--gb-dock-top", `${Math.ceil(rr.bottom - dr.top)}px`);
            // the camera keeps the ground clear of the dock and the Next move button above it
            const room = Math.ceil(rr.bottom - dr.top) + (rr.height <= 520 ? 0 : rr.width <= 860 ? 76 : 100);
            if (room !== dockPx.current) {
                dockPx.current = room;
                const sn = sRef.current;
                if (sn && !userCam.current) setCamera(homeCam(sn.job?.id ?? nextJob(sn).id));
            }
            // The job card runs down to the dock, or to the cue or zoom buttons beside it. Its body scrolls past that.
            const job = root.querySelector<HTMLElement>(".gb-job");
            if (job) {
                const jr = job.getBoundingClientRect();
                let bottom = dr.top - 10;
                for (const sel of [".gb-cue"]) {
                    const e = root.querySelector<HTMLElement>(sel);
                    if (!e) continue;
                    const er = e.getBoundingClientRect();
                    if (er.width && er.height && er.right > jr.left && er.left < jr.right && er.top > jr.top) bottom = Math.min(bottom, er.top - 8);
                }
                root.style.setProperty("--gb-job-room", `${Math.max(56, Math.floor(bottom - jr.top))}px`);
                // toasts stack under the job card, in the same column
                root.style.setProperty("--gb-feed-top", `${Math.ceil(jr.bottom - rr.top + 8)}px`);
            }
        };
        measureRef.current = measure;
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(dock); ro.observe(root);
        return () => ro.disconnect();
    }, [ready, setCamera, homeCam]);
    // the cue and job card change height with the game, so re-measure after every render
    useEffect(() => { measureRef.current(); });

    // Held for the exit animations. These sit above the boot return so the hook order never changes.
    const cardH = useHeld(sel, 120);
    const awayH = useHeld(away, 120);
    // on desktop the material card hangs above its own tile: measure the tile and park the card and its notch over it
    const cardMat = cardH.shown;
    useEffect(() => {
        const root = rootRef.current;
        if (!root || cardMat === null) return;
        const place = () => {
            const tile = root.querySelector<HTMLElement>(`.gb-tile[data-i="${cardMat}"]`);
            const card = root.querySelector<HTMLElement>(".gb-card");
            if (!tile || !card) return;
            const rr = root.getBoundingClientRect(), tr = tile.getBoundingClientRect(), cw = card.getBoundingClientRect().width;
            const cx = tr.left - rr.left + tr.width / 2;
            const left = clamp(cx - cw / 2, 8, Math.max(8, rr.width - cw - 8));
            root.style.setProperty("--gb-card-left", `${Math.round(left)}px`);
            root.style.setProperty("--gb-card-notch", `${Math.round(cx - left)}px`);
        };
        place();
        window.addEventListener("resize", place);
        return () => window.removeEventListener("resize", place);
    }, [cardMat]);
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
    const cue = nextCue(s);
    // what the active build phase is short of right now: the material that will take longest to arrive
    let held: { mat: number; phase: string } | null = null;
    let buildPhase = "";
    if (def && aj && f && aj.step === "build") {
        const ph = plan(def, f)[aj.phase];
        if (ph) {
            buildPhase = ph.name;
            let eta = 0;
            for (const [m, q] of phaseNeeds(aj, ph)) {
                const short = q - aj.got[m] - s.amt[m];
                if (short <= 1e-9) continue;
                const e = short / Math.max(1e-9, rawRate(s, m, f, chain(s)));
                if (e > eta) { eta = e; held = { mat: m, phase: ph.name }; }
            }
        }
    }

    return (
        <div ref={rootRef} className="gb-root" data-paused={paused || shell.paused ? "true" : undefined} data-simple={simple ? "true" : undefined} data-reduce={reduce ? "true" : undefined} data-win={win ?? undefined} data-card={card !== null ? "" : undefined}>
            <div ref={viewRef} className="gb-view" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-label="Building site. Scroll to zoom, drag to pan.">
                <GroundbreakScene camera={cam} job={sceneJob} skyline={skyline} craneLevel={s.equip[11] ?? 0} idle={aj ? null : nextJob(s).id} crews={crewTotal} reduce={reduce || simple} paused={paused || shell.paused} />
            </div>

            <header className="gb-top">
                <div className="gb-brand">
                    <h1 className="gb-title">Groundbreak</h1>
                    <span className="gb-site" data-tip={city.blurb}><i aria-hidden="true" />{city.name}<em>{city.sites[stage - 1]}</em></span>
                </div>
                <div className="gb-prog" aria-label={`Stage ${stage} of 5, job ${Math.min(JOBS.length, s.builtThisFirm + 1)} of ${JOBS.length}`}>
                    <div className="gb-prog-row" data-tip={`Stage ${stage} of 5`}>
                        <span>Stage</span>
                        <ol className="gb-pips">{[1, 2, 3, 4, 5].map((n) => <li key={n} data-s={n < stage ? "done" : n === stage ? "now" : "wait"} data-fresh={n === freshStage ? "" : undefined} />)}</ol>
                        <b>{stage}<small>/5</small></b>
                    </div>
                    <div className="gb-prog-row" data-tip={`Job ${Math.min(JOBS.length, s.builtThisFirm + 1)} of ${JOBS.length}`}>
                        <span>Jobs</span>
                        <ol className="gb-ticks">{JOBS.map((j, n) => <li key={j.id} data-s={n < s.builtThisFirm ? "done" : n === s.builtThisFirm ? "now" : "wait"} data-fresh={n === freshTick ? "" : undefined} />)}</ol>
                        <b>{Math.min(JOBS.length, s.builtThisFirm + 1)}<small>/{JOBS.length}</small></b>
                    </div>
                </div>
                <ul className="gb-res" aria-label="Resources">
                    <li key={`cash${cashGain}`} data-gain={cashGain ? "" : undefined} data-tip="Cash. Jobs pay it; methods cost it."><Ico id="cash" size={22} /><b><Ticked value={s.cash} format={fmtCash} /></b></li>
                    <li data-tip="Reputation. It lifts all output and inspections."><Ico id="rep" size={22} /><b>{fmt(s.rep)}</b></li>
                    <li data-tip="Crews hired"><Ico id="crew" size={22} /><b>{crewTotal}</b></li>
                </ul>
            </header>

            <nav className="gb-tools" aria-label="Menus and view" onPointerDown={(e) => e.stopPropagation()}>
                <div className="gb-rail" role="group" aria-label="Menus">
                    {([["jobs", "bid", "Jobs", "J"], ["skyline", "skyline", "Skyline", "K"], ["firm", "firm", "Firm", "F"], ["console", "console", "Console", "C"], ["menu", "menu", "Menu", "M"]] as const).map(([id, ic, label, key]) => (
                        <button key={id} type="button" className="gb-rail-btn" aria-pressed={win === id} aria-label={label} data-tip={`${label} · ${key}`} data-ping={id === "firm" && (canIncorporate(s, f) || PERKS.some((p) => perkReady(s.perks, p) && s.charter >= p.cost)) ? "" : id === "jobs" && wait ? "" : undefined} onClick={() => { setSel(null); setWin(win === id ? null : id); }}>
                            <Ico id={ic} size={28} /><span>{label}</span><kbd>{key}</kbd>
                        </button>
                    ))}
                </div>
                <div className="gb-zoom" role="group" aria-label="View">
                    <button type="button" className="gb-zoom-in" onClick={() => zoomAt(1.3)} aria-label="Zoom in" data-tip="Zoom in · +"><Ico id="zoomin" size={26} /></button>
                    <button type="button" className="gb-zoom-out" onClick={() => zoomAt(0.77)} aria-label="Zoom out" data-tip="Zoom out · Shift -"><Ico id="zoomout" size={26} /></button>
                    <button type="button" onClick={reset} aria-label="Reset view" data-tip="Reset view · R"><Ico id="reset" size={26} /></button>
                </div>
            </nav>

            <aside className={`gb-job ${jobOpen ? "" : "is-min"}`} onPointerDown={(e) => e.stopPropagation()}>
                {jobOpen && <Banner id="current" />}
                <button type="button" className="gb-job-head" onClick={() => setJobOpen((v) => !v)} aria-expanded={jobOpen} data-tip={jobOpen ? "Collapse" : "Expand"}>
                    <Ico id="bid" size={28} /><span>{def ? def.name : nextJob(s).name}{s.job?.rerun && <small className="gb-rerun">Repeat order</small>}</span>
                    {aj && <em>{aj.step === "permit" ? `permit ${fmtSecs(aj.left)}` : aj.step === "inspect" ? `inspection ${fmtSecs(aj.left)}` : `${Math.floor(prog * 100)}%`}</em>}
                </button>
                {aj && <i className="gb-job-mini" aria-hidden="true"><b style={{ width: `${Math.floor(prog * 100)}%` }} /></i>}
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
                                        <Ico id={ph.id} size={24} /><i className="gb-bar"><b style={{ width: `${pct}%` }} /></i>
                                    </li>
                                );
                            })}
                        </ol>
                        <p className="gb-job-now" data-held={held ? "" : undefined}>
                            {held ? <Ico id={MAT_ICONS[held.mat]} size={20} /> : <Ico id={aj.step === "build" ? "crew" : aj.step === "inspect" ? "inspection" : "permit"} size={20} />}
                            <span>{aj.step === "permit" ? "Permit filed. The crew moves in." : aj.step === "inspect" ? "Inspection under way." : held ? <><b>{held.phase}</b> is waiting on {MATS[held.mat].name}.</> : <><b>{buildPhase}</b> is under way.</>}</span>
                        </p>
                        <p className="gb-job-pay">{aj.rerun ? `repeat order: pays ${fmtCash(repeatPay(s, def, f))} + ${repeatRep(s, def, f)} rep, no new building` : `pays ${fmtCash(payout(s, def, f, chain(s), aj.index) * (1 + aj.bonus))} + ${repPay(s, def, f)} rep`}</p>
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
                    <div className="gb-change" role="group" aria-label="Change order">
                        <header><Ico id="permit" size={32} /><p><strong>Change order</strong><span>The client wants more. Decide in {fmtSecs(s.change.left)}.</span></p></header>
                        <dl className="gb-terms">
                            <div data-k="up"><dt>Pay</dt><dd>+{Math.round(s.change.bonus * 100)}%</dd></div>
                            <div data-k="down"><dt>Build time</dt><dd>+{fmtSecs(s.change.secs)}</dd></div>
                            <div data-k="down"><dt>Inspection</dt><dd>+{s.change.score.toFixed(1)} score</dd></div>
                        </dl>
                        <i className="gb-bar gb-change-clock"><b style={{ width: `${Math.max(0, Math.min(100, (s.change.left / Math.max(1, TUNE.changeWait)) * 100))}%` }} /></i>
                        <div className="gb-change-act"><button type="button" className="gb-go" onClick={() => act((x) => acceptChange(x))}>Accept <kbd>Y</kbd></button><button type="button" className="gb-go" onClick={() => act((x) => declineChange(x))}>Decline <kbd>N</kbd></button></div>
                    </div>
                )}
            </aside>

            <ul className="gb-feed" aria-live="polite">{notes.map((n) => <li key={n.id} data-tone={n.tone}><Ico id={n.tone === "hot" ? "rep" : "bid"} size={28} /><span>{n.text}</span><i className="gb-cn" data-c="tl" /><i className="gb-cn" data-c="br" /></li>)}</ul>
            <CueChip cue={cue} onGo={doCueNow} press={cuePress} />
            <div className="gb-fx" aria-hidden="true">{floats.map((fl) => <i key={fl.id} className="gb-float" data-tone={fl.tone} style={{ left: fl.x, top: fl.y }}>{fl.text}</i>)}</div>
            {moment && (
                <div key={moment.key} className="gb-moment" data-kind={moment.kind} role="status">
                    <Ico id={moment.kind === "job" ? "skyline" : moment.kind === "stage" ? "crew" : MAT_ICONS[s.open - 1] ?? "crew"} size={48} />
                    <p><small>{moment.kicker}</small><strong>{moment.title}</strong>{moment.sub && <span>{moment.sub}</span>}</p>
                    <i className="gb-cn" data-c="tl" /><i className="gb-cn" data-c="tr" /><i className="gb-cn" data-c="bl" /><i className="gb-cn" data-c="br" />
                </div>
            )}
            {conflict && (
                <div className="gb-conflict" role="alert" onPointerDown={(e) => e.stopPropagation()}>
                    <p>Groundbreak is open in another tab, and that tab saved newer progress. Saving is paused here so it cannot overwrite it.</p>
                    <button type="button" className="gb-go" onClick={() => { conflictRef.current = false; setConflict(false); save(); }}>Use this tab</button>
                </div>
            )}
            {awayH.shown && <AwayCard a={awayH.shown} onClose={() => setAway(null)} leaving={awayH.state === "out"} />}
            {(paused || shell.paused) && <div className="gb-paused" role="status">Paused · P to resume</div>}

            {cardH.shown !== null && <MatCard s={s} i={cardH.shown} onBuy={doBuy} onUnlock={doUnlock} onClose={() => setSel(null)} cue={cue} leaving={cardH.state === "out"} />}

            <div ref={dockRef} className="gb-dock" onPointerDown={(e) => e.stopPropagation()} role="toolbar" aria-label="Materials">
                {DOCK_GROUPS.map(([label, from, to], gi) => (
                    // on a phone only the open groups and the next teaser group show, so the dock stays one or two rows and the site keeps the screen
                    <section key={label} className="gb-dgroup" data-open={from < s.open ? "" : undefined} data-far={from >= s.open && gi > DOCK_GROUPS.findIndex(([, f0]) => f0 >= s.open) ? "" : undefined} aria-label={label}>
                        <h4>{label}</h4>
                        <div className="gb-dgroup-row">
                            {MATS.slice(from, to).map((m, k) => {
                                const i = from + k;
                                const open = i < s.open, next = i === s.open;
                                const r = open ? rawRate(s, i, f, chain(s)) : 0;
                                const need = next ? UNLOCK[i] : 0;
                                const pct = next ? Math.min(100, Math.floor((s.amt[i - 1] / need) * 100)) : 0;
                                const can = open && ([0, 1, 2] as Tier[]).some((t) => canBuy(s, i, t, f));
                                return (
                                    <button key={m.id} type="button" className="gb-tile" data-i={i} data-can={can ? "" : undefined} data-hint={cue.mat === i && cue.kind !== "perk" ? "" : undefined} data-state={open ? "open" : next ? "next" : "locked"} data-on={card === i ? "" : undefined} data-ready={next && canUnlock(s, i) ? "" : undefined}
                                        aria-pressed={card === i} aria-label={`${m.name}${open ? `, ${fmt(s.amt[i])}` : ", locked"}`}
                                        data-tip={open ? `${m.name} · ${fmt(r)}/s` : next ? `${m.name} · needs ${fmt(need)} ${MATS[i - 1].name}` : `${m.name} · locked`}
                                        style={next ? ({ ["--pct" as string]: `${pct}%` } as CSSProperties) : undefined}
                                        onClick={() => { setWin(null); setSel(card === i ? null : i); }}>
                                        <kbd>{MAT_KEYS[i]}</kbd>
                                        <Ico id={MAT_ICONS[i]} size={open || next ? 48 : 40} className={open ? "" : next ? "is-next" : "is-shadow"} />
                                        <b>{open ? fmt(s.amt[i]) : next ? `${pct}%` : <><Ico id={MAT_ICONS[i - 1]} size={11} />{fmt(UNLOCK[i])}</>}</b>
                                        {open && <i className="gb-lv">{s.crews[i]}</i>}
                                        {!open && !next && <em className="gb-tile-name">{m.name}</em>}
                                        {!open && !next && <Ico id="lock" size={16} className="gb-tile-lock" />}
                                        {can && <i className="gb-can" aria-hidden="true" />}
                                        {pulse?.mat === i && <i key={pulse.key} className="gb-unlock" aria-hidden="true" />}
                                        {popTile?.mat === i && <i key={popTile.key} className="gb-pop" aria-hidden="true" />}
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </div>

            <Window open={win === "jobs"} id="jobs" title="Next jobs" hint={`${s.builtThisFirm} of ${JOBS.length} built`} variant="unroll" icon="bid" banner="jobs" onClose={() => setWin(null)}>
                <p className="gb-line">{city.name}. {city.blurb}</p>
                <ul className="gb-bids">
                    {s.job && def && <li className="is-now"><JobThumb id={def.id} /><div><strong>{def.name}</strong><span>{jobPhaseName(s.job, f)} · {s.job.rerun ? "Repeat order, no new building" : city.sites[def.stage - 1]}</span></div>{s.job.rerun && <dl><dt>pays</dt><dd>{fmtCash(repeatPay(s, def, f))}</dd><dt>rep</dt><dd>+{repeatRep(s, def, f)}</dd></dl>}<span className="gb-req">{Math.floor(prog * 100)}%</span></li>}
                    {queue(s, 4).map((q, i) => (
                        <li key={q.index} className={q.ready ? "is-next" : "is-locked"} style={{ ["--i" as string]: i } as CSSProperties}>
                            <JobThumb id={q.job.id} /><div><strong>{i === 0 && !s.job ? "Up next: " : ""}{q.job.name}</strong><span>{q.job.notes.join(" · ")}</span></div>
                            <dl><dt>pays</dt><dd>{fmtCash(payout(s, q.job, f, chain(s), q.index))}</dd><dt>rep</dt><dd>+{repPay(s, q.job, f)}</dd><dt>stage</dt><dd>{q.job.stage}</dd></dl>
                            {!q.ready && <span className="gb-req">Open {MATS[jobMat(q.job)].name}</span>}
                        </li>
                    ))}
                </ul>
                {wait && <p className="gb-line">{wait}.</p>}
            </Window>

            <Window open={win === "skyline"} id="skyline" title="Skyline" hint={`${s.skyline.length} built`} variant="iris" size="lg" icon="skyline" banner="skyline" onClose={() => setWin(null)}>
                <SkylineView skyline={s.skyline} />
            </Window>

            <Window open={win === "firm"} id="firm" title="Firm" hint={`${city.name} · firm ${s.firm + 1}`} variant="stamp" size="lg" icon="firm" banner="firm" onClose={() => setWin(null)}>
                <div className="gb-firm-side">
                <dl className="gb-stats">
                    <dt>Reputation this firm</dt><dd>{fmt(s.repFirm)}</dd>
                    <dt>Charter to spend</dt><dd>{s.charter}</dd>
                    <dt>Buildings</dt><dd>{s.built}</dd>
                    <dt>Offline limit</dt><dd>{Math.round((TUNE.offlineH + f.offlineH))} hours</dd>
                </dl>
                <p className="gb-line gb-firm-line">{canIncorporate(s, f) ? `Incorporate: +${charterGain(s, f)} charter for perks that stay, a new firm in ${cityOf(s.firm + 1).name}. The skyline stays.` : `Opens at ${TUNE.charterMinRep} rep (you have ${fmt(s.repFirm)}). Pays about +${Math.max(1, Math.floor(Math.sqrt(TUNE.charterMinRep / TUNE.charterDiv) * f.charter))} charter for perks that stay, then a new firm in ${cityOf(s.firm + 1).name}. The skyline stays.`}</p>
                <div className="gb-win-foot">
                    {/* the reason stays in view under the perks, so a greyed button always says what it is waiting for; a tapped perk on a phone takes this line for its name and effect */}
                    <p className="gb-foot-line" aria-live="polite">{perkPeek && PERKS.some((p) => p.id === perkPeek) ? perkLine(s, PERKS.find((p) => p.id === perkPeek)!) : canIncorporate(s, f) ? `Ready: +${charterGain(s, f)} charter, a new firm in ${cityOf(s.firm + 1).name}.` : `Opens at ${TUNE.charterMinRep} rep. You have ${fmt(s.repFirm)}.`}</p>
                    <ConfirmGo label="Incorporate" sure="Cash, crews and materials reset. Charter and the skyline stay. Sure?" onGo={doIncorporate} disabled={!canIncorporate(s, f)} />
                </div>
                </div>
                <PerkGrid s={s} justBought={freshPerk} peek={perkPeek} onPeek={setPerkPeek} onBuy={(id) => act((x) => { if (buyPerk(x, id)) { save(); setFreshPerk(id); setPerkPeek(null); note(`${PERKS.find((p) => p.id === id)?.name ?? "Perk"} bought.`, "hot"); } })} onAuto={(n) => act((x) => { x.autoOff = x.autoOff.includes(n) ? x.autoOff.filter((v) => v !== n) : [...x.autoOff, n]; save(); })} />
            </Window>

            <Window open={win === "console"} id="console" title="Console" hint="gb help" variant="drop" icon="console" banner="console" size="md" onClose={() => setWin(null)}>
                <Console run={doCommand} />
            </Window>

            <Window open={win === "menu"} id="menu" title="Menu" variant="settle" size="sm" icon="menu" banner="menu" onClose={() => setWin(null)}>
                <MenuBody s={s} paused={paused} onPause={togglePause} simple={simple} onSimple={toggleSimple} fs={shell.supportsFullscreen} onFs={shell.toggleFullscreen} fsOn={shell.fullscreen}
                    onImport={(st) => { const p = reviveAuto(GROUNDBREAK_SAVE, st); if (!p) { note("That save could not be read."); return; } if (sRef.current) writeStored(window.localStorage, SAVE_KEY + "-backup", encodeSave(GROUNDBREAK_SAVE, sRef.current)); sRef.current = p; seen.current = snapOf(p); seenRe.current = p.reruns; save(); bump(); note("Save imported. The old one is kept as a backup.", "hot"); }}
                    onWipe={() => { if (sRef.current) writeStored(window.localStorage, SAVE_KEY + "-backup", encodeSave(GROUNDBREAK_SAVE, sRef.current)); sRef.current = fresh(Date.now()); seen.current = snapOf(sRef.current); seenRe.current = -1; save(); setWin(null); setSel(null); bump(); }} onNote={note}
                    onRestore={(raw) => { const p = reviveText(GROUNDBREAK_SAVE, raw); if (!p) { note("That backup could not be read."); return; } if (sRef.current) writeStored(window.localStorage, SAVE_KEY + "-backup", encodeSave(GROUNDBREAK_SAVE, sRef.current)); sRef.current = p; seen.current = snapOf(p); seenRe.current = p.reruns; save(); setWin(null); bump(); note("Backup restored. The save you replaced is kept as the manual backup.", "hot"); }} />
            </Window>
        </div>
    );
}


/** The icon the Next move button wears: the crew, machine or method it buys, the material it opens, or the perk it spends on. */
function cueIcon(cue: Cue): string {
    if (cue.kind === "buy" && cue.mat !== undefined) return cue.tier === 0 ? "crew" : cue.tier === 1 ? EQUIP_ICONS[cue.mat] : "method";
    if (cue.kind === "perk" && cue.perk) return `perk_${cue.perk}`;
    if (cue.kind === "accept") return "permit";
    if (cue.kind === "incorporate") return "firm";
    if (cue.mat !== undefined) return MAT_ICONS[cue.mat];
    return "inspection";
}

/** The one thing to do next, as a big key at the bottom centre. Press it (or Space) and the game does it; while it waits it fills toward what it is waiting for. */
function CueChip({ cue, onGo, press }: { cue: Cue; onGo: () => void; press: number }) {
    const pct = cue.progress !== undefined ? Math.round(cue.progress * 100) : null;
    return (
        <div className="gb-cue" data-kind={cue.kind} data-doable={cue.doable ? "" : undefined} onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" onClick={onGo}>
                <i className="gb-cue-ico"><Ico id={cueIcon(cue)} size={40} /></i>
                <span className="gb-cue-main">
                    <small className="gb-cue-k">{cue.doable ? "Next move" : "Coming up"}</small>
                    <strong>{cue.doable ? cue.text : cue.text.replace(/^Next: (.)/, (_, c: string) => c.toUpperCase())}</strong>
                </span>
                {cue.cost && <b className="gb-cue-cost"><Ico id={cue.cost.cur === "cash" ? "cash" : MAT_ICONS[cue.cost.cur]} size={20} />{cue.cost.text}</b>}
                <kbd>Space</kbd>
                {pct !== null && !cue.doable && <i className="gb-cue-bar" aria-hidden="true"><b style={{ width: `${pct}%` }} /></i>}
                {press > 0 && <i key={press} className="gb-cue-hit" aria-hidden="true" />}
            </button>
            <p>{cue.why}</p>
        </div>
    );
}

function AwayCard({ a, onClose, leaving }: { a: AwaySummary; onClose: () => void; leaving?: boolean }) {
    const rows: [string, string][] = [];
    for (const j of a.jobs) rows.push([j.count > 1 ? `${j.name} x${j.count}` : j.name, "handed over"]);
    if (a.cash > 0) rows.push(["Cash earned", fmtCash(a.cash)]);
    if (a.rep > 0) rows.push(["Reputation", `+${fmt(a.rep)}`]);
    if (a.opened.length) rows.push(["Now on site", a.opened.join(", ")]);
    if (a.crews > 0) rows.push(["Crews hired", `+${a.crews}`]);
    for (const m of a.mats) rows.push([m.name, `+${fmt(m.gain)}`]);
    return (
        <section className="gb-away" role="dialog" aria-label="Welcome back" data-s={leaving ? "out" : undefined} onPointerDown={(e) => e.stopPropagation()}>
            <h2>Welcome back</h2>
            <p>The crews kept working for {fmtAge(a.secs)}{a.capped ? `. That is the offline limit of ${a.hours} hours; the rest of your time away did not count` : ""}.</p>
            {rows.length > 0 && <dl>{rows.slice(0, 7).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
            <button type="button" className="gb-go" onClick={onClose} autoFocus>Back to work</button>
        </section>
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

function MatCard({ s, i, onBuy, onUnlock, onClose, cue, leaving }: { s: State; i: number; onBuy: (i: number, t: Tier) => void; onUnlock: () => void; onClose: () => void; cue: Cue; leaving?: boolean }) {
    const hint = cue.kind === "buy" && cue.mat === i ? cue.tier : undefined;
    const m = MATS[i];
    const f = effects(s);
    const open = i < s.open;
    const next = i === s.open;
    return (
        <section className="gb-card" key={i} role="dialog" aria-label={m.name} data-s={leaving ? "out" : undefined} onPointerDown={(e) => e.stopPropagation()}>
            <header>
                <Ico id={open || next ? MAT_ICONS[i] : "lock"} size={56} />
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
                                <button key={t} type="button" className="gb-tier" disabled={!ok} onClick={() => onBuy(i, t)} data-tip={tip} data-done={done ? "" : undefined} data-hint={hint === t ? "" : undefined}>
                                    <kbd>{TIER_KEY[t]}</kbd>
                                    <Ico id={t === 1 ? EQUIP_ICONS[i] : TIER_ICON[t]} size={40} />
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

/** What a perk's footer line says: its name and effect, and what stands between the player and buying it. */
function perkLine(s: State, p: { id: string; name: string; desc: string; cost: number }): string {
    if (s.perks.includes(p.id)) return `${p.name}: ${p.desc} Owned.`;
    if (!perkReady(s.perks, p as Perk)) return `${p.name}: ${p.desc} Needs an earlier perk first.`;
    if (s.charter < p.cost) return `${p.name}: ${p.desc} Costs ${p.cost} charter. You have ${s.charter}.`;
    return `${p.name}: ${p.desc} Tap again to buy for ${p.cost} charter.`;
}

function PerkGrid({ s, justBought, peek, onPeek, onBuy, onAuto }: { s: State; justBought: string | null; peek: string | null; onPeek: (id: string | null) => void; onBuy: (id: string) => void; onAuto: (n: number) => void }) {
    const autoOf: Record<string, number> = { o2: 1, o4: 2, l9: 3 };
    const branches = [["ops", "Operations"], ["money", "Money"], ["logistics", "Logistics"]] as const;
    // A touch screen has no hover to read a perk with: its first tap shows the name and effect, the second buys. A mouse buys on one click.
    const tap = (p: Perk, buyable: boolean) => {
        if (!buyable) { onPeek(p.id); return; }
        const touch = window.matchMedia("(hover: none)").matches;
        if (!touch || peek === p.id) { onPeek(null); onBuy(p.id); return; }
        onPeek(p.id);
    };
    return (
        <div className="gb-perks">
            {branches.map(([b, label]) => (
                <div key={b}>
                    <h3><Ico id={BRANCH_ICON[b]} size={24} />{label}</h3>
                    <ul>
                        {PERKS.filter((p) => p.branch === b).map((p) => {
                            const own = s.perks.includes(p.id), ready = perkReady(s.perks, p);
                            const buyable = !own && ready && s.charter >= p.cost;
                            return (
                                <li key={p.id} data-fresh={justBought === p.id ? "" : undefined}>
                                    <button type="button" className="gb-perk" aria-disabled={!buyable || undefined} data-peek={peek === p.id ? "" : undefined} data-own={own ? "" : undefined} data-lock={!ready && !own ? "" : undefined} aria-label={p.name} data-tip={`${p.name}: ${p.desc}${own ? " Owned." : !ready ? " Needs an earlier perk." : ""}`} onClick={() => tap(p, buyable)}>
                                        <Ico id={`perk_${p.id}`} size={48} /><em>{own ? "✓" : p.cost}</em>
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

/** The skyline body: every job in the game, named. Built ones stand in colour with a count; the rest are dark silhouettes, so the window always fills and shows what is left. */
function SkylineView({ skyline }: { skyline: State["skyline"] }) {
    const counts = new Map<string, number>();
    skyline.forEach((b) => counts.set(b.id, (counts.get(b.id) ?? 0) + 1));
    return (
        <>
            {skyline.length === 0 && <p className="gb-none">Nothing built yet. Every finished job stays here for good, even after you incorporate.</p>}
            <ul className="gb-sky">
                {JOBS.map((j, n) => {
                    const c = counts.get(j.id) ?? 0;
                    return (
                        <li key={j.id} data-built={c ? "" : undefined} data-tip={c ? `${j.name} · built ${c}` : `${j.name} · not built yet`} aria-label={c ? `${j.name}, built ${c}` : `${j.name}, not built yet`} style={{ "--i": n } as CSSProperties}>
                            <JobThumb id={j.id} w={130} h={104} />
                            <b>{j.name}</b>
                            <em>{c ? `×${c} built` : "Not built yet"}</em>
                        </li>
                    );
                })}
            </ul>
        </>
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
            <form onSubmit={(e) => { e.preventDefault(); const line = v.trim(); if (!line) return; const out = run(line); setLines((p) => [...p.slice(-60), { t: `> ${line}`, k: "in" }, ...out]); setV(""); }}>
                <span aria-hidden="true">&gt;</span>
                <input ref={input} value={v} onChange={(e) => setV(e.target.value)} aria-label="Console command" autoComplete="off" autoCapitalize="off" spellCheck={false} />
            </form>
        </div>
    );
}

function MenuBody({ s, paused, onPause, simple, onSimple, fs, onFs, fsOn, onImport, onWipe, onNote, onRestore }: { s: State; paused: boolean; onPause: () => void; simple: boolean; onSimple: () => void; fs: boolean; onFs: () => void; fsOn: boolean; onImport: (s: State) => void; onWipe: () => void; onNote: (t: string) => void; onRestore: (raw: string) => void }) {
    const [backups] = useState(() => { try { return [["Automatic backup", SAVE_KEY + "-auto1"], ["Older automatic backup", SAVE_KEY + "-auto2"], ["Before last import or reset", SAVE_KEY + "-backup"]].flatMap(([label, key]) => { const raw = window.localStorage.getItem(key); if (!raw) return []; const p = reviveText(GROUNDBREAK_SAVE, raw); return p ? [{ label, raw, built: p.built, at: p.savedAt }] : []; }); } catch { return []; } });
    const [pickedBackup, setPickedBackup] = useState<number | null>(null);
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
            {backups.length > 0 && (
                <div className="gb-backups">
                    <p>Restore a backup</p>
                    {backups.map((b, i) => (
                        <button key={b.label} type="button" className="gb-row" onClick={() => (pickedBackup === i ? (setPickedBackup(null), onRestore(b.raw)) : setPickedBackup(i))}>
                            {pickedBackup === i ? "Replace this game with it?" : b.label}<em>{pickedBackup === i ? "yes" : `${b.built} built · ${new Date(b.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}</em>
                        </button>
                    ))}
                </div>
            )}
            <ConfirmGo label="Start over" sure="Deletes this save, skyline included. Sure?" onGo={onWipe} />
            <p className="gb-keys">Space do the next step · [ ] cycle materials · 1-0 - = materials · Q W E tiers · ? this menu · J jobs · K skyline · F firm · ` site console · wheel zoom · drag pan · R reset</p>
        </div>
    );
}
