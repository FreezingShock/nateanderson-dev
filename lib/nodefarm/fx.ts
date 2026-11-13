// Node Farm effects level: one switch other code can hook.
//   full: everything runs.  low: the expensive decoration stops (see app/camino/nodefarm/fx.css).  auto: low while this
//   device is struggling, full again once it has recovered. Auto keeps watching the frame rate the whole time it is on,
//   so a machine that is slow only at first (or only in one window) doesn't get stuck in the wrong state. Auto is also
//   low while the OS asks for reduced motion (prefers-reduced-motion); an explicit full ignores that setting.
// Hooks for other code:
//   CSS      body.nf-lowfx { ... }          (also body[data-nf-fx="low"])
//   plain JS getLowFx()
//   React    const low = useLowFx()
//   event    window "nf:fx" (detail: boolean, true when low)
// Default is auto. Kept per device in localStorage "nf-fx-v1"; it is not part of the save.
//
// Auto rules (hysteresis, so it does not flap):
//   - frame times are read in 1.5 s windows; the window median decides the vote
//   - median over 25 ms (under ~40 fps) is a slow vote, under 18 ms (over ~55 fps) is a fast vote, between is neutral
//   - 3 slow votes in a row go low; 6 fast votes in a row go back to full. Each repeat drop doubles the fast votes
//     needed (up to 40), so a device that trips again and again settles on low instead of cycling
//   - after any switch, nothing changes again for 15 s
import { useSyncExternalStore } from "react";

export type FxMode = "full" | "low" | "auto";
export const FX_MODES: FxMode[] = ["full", "low", "auto"];
const KEY = "nf-fx-v1";

const BOOT_MS = 3500; // wait for the board to settle before the first window
const WINDOW_MS = 1500; // one vote per window
const MIN_SAMPLES = 3; // a window with fewer frames (a hidden tab) gives no vote; a starved CPU still votes on its few long frames
const SLOW_MS = 25;
const FAST_MS = 18;
const SLOW_NEEDED = 3;
const FAST_NEEDED = 6;
const FAST_MAX = 40; // each time auto has to drop to low again, the recovery wait doubles, up to this many windows (about 60 s)
const DWELL_MS = 15000;

let mode: FxMode = "auto"; // the default: watch the frame rate and go low only while it is struggling
let autoLow = false; // what the watcher last decided, only used in auto
let low = false;
let watching = false;
const subs = new Set<() => void>();

/** The OS asks for less motion. Auto treats that as low, so the heavy loops stop without a manual switch. */
function reducedMotion(): boolean {
    return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function apply() {
    const next = mode === "low" || (mode === "auto" && (autoLow || reducedMotion()));
    if (typeof document !== "undefined") {
        document.body.classList.toggle("nf-lowfx", next);
        document.body.dataset.nfFx = next ? "low" : "full";
    }
    if (next !== low) {
        low = next;
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("nf:fx", { detail: low }));
    }
    subs.forEach((f) => f());
}

export const getFxMode = (): FxMode => mode;
export const getLowFx = (): boolean => low;

export function setFxMode(m: FxMode) {
    mode = m;
    try { localStorage.setItem(KEY, m); } catch {}
    if (m === "auto") startWatch(true);
    apply();
}

// ---- the auto watcher -------------------------------------------------------------------------------------------
export interface AutoState {
    low: boolean; // auto's current decision
    slowRun: number; // slow votes in a row
    fastRun: number; // fast votes in a row
    drops: number; // times auto has gone low
    fastNeeded: number; // fast votes needed before it returns to full (doubles on each repeat drop)
    lastSwitch: number; // time of the last change, in ms
}
export const freshAuto = (): AutoState => ({ low: false, slowRun: 0, fastRun: 0, drops: 0, fastNeeded: FAST_NEEDED, lastSwitch: -1e9 });

/** One window's vote. Pure, so the rules can be checked without a browser (node-farm-perf/lod/fx-rules.mjs). */
export function stepAuto(s: AutoState, median: number, now: number): AutoState {
    const next = { ...s };
    if (median > SLOW_MS) { next.slowRun++; next.fastRun = 0; }
    else if (median < FAST_MS) { next.fastRun++; next.slowRun = 0; }
    else { next.slowRun = 0; next.fastRun = 0; }
    if (now - s.lastSwitch < DWELL_MS) return next;
    if (!next.low && next.slowRun >= SLOW_NEEDED) {
        // the second and later drops wait longer before they come back, so low and full can't keep trading places
        if (next.drops > 0) next.fastNeeded = Math.min(FAST_MAX, next.fastNeeded * 2);
        next.drops++;
        next.low = true;
    } else if (next.low && next.fastRun >= next.fastNeeded) {
        next.low = false;
    } else return next;
    next.slowRun = 0; next.fastRun = 0; next.lastSwitch = now;
    return next;
}

let auto = freshAuto();
function vote(median: number, now: number) {
    const before = auto.low;
    auto = stepAuto(auto, median, now);
    autoLow = auto.low;
    if (auto.low !== before) apply();
}

let booted = false; // the boot wait happens once per page load, not on every return to the tab
let bootAt = 0;

/** Starts the frame watcher once the page is up. Runs only in auto mode and only while the tab is visible. */
function startWatch(fresh = false) {
    if (typeof window === "undefined" || watching) return;
    if (fresh) auto = { ...freshAuto(), low: autoLow };
    watching = true;
    let dts: number[] = [];
    let last = 0;
    let winStart = 0;
    const step = (t: number) => {
        if (mode !== "auto" || document.hidden) { watching = false; return; } // a hidden tab measures nothing
        if (!booted) {
            if (!bootAt) bootAt = t;
            if (t - bootAt < BOOT_MS) { last = t; requestAnimationFrame(step); return; }
            booted = true;
        }
        if (last) dts.push(t - last);
        last = t;
        if (!winStart) winStart = t;
        if (t - winStart >= WINDOW_MS) {
            if (dts.length >= MIN_SAMPLES) {
                dts.sort((a, b) => a - b);
                vote(dts[dts.length >> 1], t);
            }
            dts = [];
            winStart = t;
        }
        requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

let listening = false;
function listenVisibility() {
    if (listening || typeof document === "undefined") return;
    listening = true;
    document.addEventListener("visibilitychange", () => {
        if (mode === "auto" && !document.hidden) startWatch();
    });
}

let started = false;
/** Call once when the game boots. */
export function initFx() {
    if (started) return;
    started = true;
    try {
        const v = localStorage.getItem(KEY);
        if (v === "low" || v === "full" || v === "auto") mode = v;
    } catch {}
    listenVisibility();
    try {
        // follow the OS setting while the game is open
        window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => { if (mode === "auto") apply(); });
    } catch {}
    if (mode === "auto") startWatch();
    apply();
}

export function useLowFx(): boolean {
    return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => low, () => false);
}
export function useFxMode(): FxMode {
    return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => mode, () => "auto" as FxMode);
}
