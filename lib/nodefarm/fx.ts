// Node Farm effects level: one switch other code can hook.
//   full: everything runs.  low: the expensive decoration stops (see app/camino/nodefarm-fx.css).  auto: low only when this
//   device can't hold about 40 fps (measured once, a few seconds after the game opens), or when the OS asks for reduced motion.
//   An explicit full keeps everything running, even with reduced motion on.
// Hooks for other code:
//   CSS      body.nf-lowfx { ... }          (also body[data-nf-fx="low"])
//   plain JS getLowFx()
//   React    const low = useLowFx()
//   event    window "nf:fx" (detail: boolean, true when low)
// Default is auto. Kept per device in localStorage "nf-fx-v1"; it is not part of the save.
import { useSyncExternalStore } from "react";

export type FxMode = "full" | "low" | "auto";
export const FX_MODES: FxMode[] = ["full", "low", "auto"];
const KEY = "nf-fx-v1";

let mode: FxMode = "auto"; // the default: measure once and go low only on a slow machine
let autoLow = false; // what auto picked: the frame probe or the OS reduced-motion setting, only used in auto
let measuredLow = false; // what the frame probe found
let low = false;
let probed = false;
let timer: ReturnType<typeof setTimeout> | 0 = 0;
const subs = new Set<() => void>();

function apply() {
    const next = mode === "low" || (mode === "auto" && autoLow);
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
    if (m === "auto") probe();
    apply();
}

/** The OS asks for less motion. Auto treats that as low, so the heavy loops stop without a manual switch. */
function reducedMotion(): boolean {
    return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Auto is low when the OS asks for less motion or when the frame probe found a slow machine. */
function pickAuto() {
    autoLow = reducedMotion() || measuredLow;
}

/** Median frame time over about 90 frames. Slower than 24 ms (under ~40 fps) counts as a slow machine. */
function probe() {
    if (probed || typeof window === "undefined") return;
    if (reducedMotion()) { pickAuto(); apply(); return; } // no need to measure; the probe runs later if the OS setting turns off
    probed = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
        const dts: number[] = [];
        let last = 0;
        const step = (t: number) => {
            if (mode !== "auto") return;
            if (last && !document.hidden) dts.push(t - last);
            last = t;
            if (dts.length < 90) { requestAnimationFrame(step); return; }
            dts.sort((a, b) => a - b);
            measuredLow = dts[dts.length >> 1] > 24;
            pickAuto();
            apply();
        };
        requestAnimationFrame(step);
    }, 3500);
}

let started = false;
/** Call once when the game boots. */
export function initFx() {
    if (started) return;
    started = true;
    try {
        // follow the OS setting while the game is open: on turns auto low, off hands auto back to the probe
        window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => {
            if (mode !== "auto") return;
            pickAuto();
            if (!reducedMotion()) probe();
            apply();
        });
    } catch {}
    try {
        const v = localStorage.getItem(KEY);
        if (v === "low" || v === "full" || v === "auto") mode = v;
    } catch {}
    if (mode === "auto") probe();
    apply();
}

export function useLowFx(): boolean {
    return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => low, () => false);
}
export function useFxMode(): FxMode {
    return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => mode, () => "auto" as FxMode);
}
