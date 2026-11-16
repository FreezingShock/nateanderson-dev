"use client";

// Game kit React hooks: presence (keep something mounted while it animates out), counters, flashes, clocks and
// the autosave loop. Headless: they hold timing and state only, so each game keeps its own markup and look.
// Docs: docs/game-kit.md.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { SettingsStore } from "@/lib/game-kit/settings";

// ---- presence ----------------------------------------------------------------------------------------------------

/**
 * Keeps something mounted for `ms` after `active` turns false, so its exit animation can play.
 * `leaving` is true only during that window. Use `data-s={leaving ? "out" : "in"}` (or similar) to pick the animation.
 */
export function usePresence(active: boolean, ms = 120): { mounted: boolean; leaving: boolean } {
    const [mounted, setMounted] = useState(active);
    useEffect(() => {
        if (active) {
            setMounted(true);
            return;
        }
        const id = window.setTimeout(() => setMounted(false), ms);
        return () => window.clearTimeout(id);
    }, [active, ms]);
    return { mounted: active || mounted, leaving: !active && mounted };
}

/**
 * For one-of-many panels (the open menu): keeps the old `value` shown for `ms` while it plays its exit, then shows the
 * new one. Swapping straight from one menu to another reads as one move: the old leaves, the new arrives.
 */
export function useLeaving<T>(value: T | null, ms = 260): { shown: T | null; leaving: boolean } {
    const [shown, setShown] = useState<T | null>(value);
    const [leaving, setLeaving] = useState(false);
    useEffect(() => {
        if (value === shown) {
            const t = window.setTimeout(() => setLeaving(false), 0);
            return () => window.clearTimeout(t);
        }
        if (value !== null && shown === null) {
            const t = window.setTimeout(() => {
                setShown(value);
                setLeaving(false);
            }, 0);
            return () => window.clearTimeout(t);
        }
        const a = window.setTimeout(() => setLeaving(true), 0);
        const b = window.setTimeout(() => {
            setShown(value);
            setLeaving(false);
        }, ms);
        return () => {
            window.clearTimeout(a);
            window.clearTimeout(b);
        };
    }, [value, shown, ms]);
    return { shown: shown === null ? value : shown, leaving: leaving && value !== shown };
}

// ---- motion ------------------------------------------------------------------------------------------------------

/** The OS reduced-motion setting, live. False on the server and on first render. */
export function useReducedMotion(): boolean {
    return useSyncExternalStore(
        (fn) => {
            if (typeof window === "undefined" || !window.matchMedia) return () => {};
            const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
            mq.addEventListener("change", fn);
            return () => mq.removeEventListener("change", fn);
        },
        () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        () => false,
    );
}

/**
 * Counts from 0 up to `to` over `ms` with an ease-out, for a payout that should read as fresh. With `still` (reduced
 * motion, low effects) it jumps straight to `to`. Restarts when `to` changes.
 */
export function useCountUp(to: number, { ms = 650, still = false }: { ms?: number; still?: boolean } = {}): number {
    const [n, setN] = useState(still ? to : 0);
    useEffect(() => {
        if (still || to <= 0) {
            setN(to);
            return;
        }
        let raf = 0;
        const t0 = performance.now();
        const tick = (t: number) => {
            const k = Math.min(1, (t - t0) / ms);
            setN(Math.round(to * (1 - (1 - k) * (1 - k))));
            if (k < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [to, still, ms]);
    return n;
}

/**
 * Glides a shown number toward `value` (a live counter that rolls instead of jumping). Each change eases over `ms`
 * from wherever the display is now. With `still` it follows exactly.
 */
export function useTween(value: number, { ms = 400, still = false }: { ms?: number; still?: boolean } = {}): number {
    const [shown, setShown] = useState(value);
    const from = useRef(value);
    const cur = useRef(value);
    useEffect(() => {
        if (still || !Number.isFinite(value) || !Number.isFinite(cur.current)) {
            cur.current = value;
            setShown(value);
            return;
        }
        from.current = cur.current;
        let raf = 0;
        const t0 = performance.now();
        const tick = (t: number) => {
            const k = Math.min(1, (t - t0) / ms);
            const e = 1 - (1 - k) * (1 - k);
            cur.current = from.current + (value - from.current) * e;
            setShown(cur.current);
            if (k < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [value, still, ms]);
    return shown;
}

/**
 * A keyed one-shot effect (a ring, a flash, a burst): `fire(detail)` sets a new key, so the element re-mounts and its
 * CSS animation restarts instead of stacking. Render `{flash && <i key={flash.key} ... />}`.
 */
export function useFlash<T = true>(): [{ key: number; detail: T } | null, (detail: T) => void] {
    const [flash, setFlash] = useState<{ key: number; detail: T } | null>(null);
    const id = useRef(0);
    const fire = useCallback((detail: T) => setFlash({ key: ++id.current, detail }), []);
    return [flash, fire];
}

/**
 * Reports how much a number rose since the last render where it changed: `{ key, gained }` (null until it changes).
 * Drives "+N" floats and buy bursts keyed on the new value, so a fast run restarts one effect instead of stacking.
 */
export function useGain(n: number): { key: number; gained: number } | null {
    const [prev, setPrev] = useState(n);
    const [hit, setHit] = useState<{ key: number; gained: number } | null>(null);
    if (n !== prev) {
        setPrev(n);
        setHit({ key: n, gained: n - prev });
    }
    return hit;
}

// ---- clocks ------------------------------------------------------------------------------------------------------

/** setInterval that always calls the latest `fn`. Off while `enabled` is false. */
export function useInterval(fn: () => void, ms: number, enabled = true): void {
    const ref = useRef(fn);
    useEffect(() => {
        ref.current = fn;
    });
    useEffect(() => {
        if (!enabled) return;
        const id = window.setInterval(() => ref.current(), ms);
        return () => window.clearInterval(id);
    }, [ms, enabled]);
}

/** Re-renders the caller every `ms` (the usual 250 ms UI refresh over a mutable game state). Returns a render count. */
export function useRerender(ms = 250, enabled = true): number {
    const [n, setN] = useState(0);
    useInterval(() => setN((v) => v + 1), ms, enabled);
    return n;
}

/**
 * The idle-game tick: every `ms`, calls `onTick(gapSeconds, nowMs)` with the real time since the last tick, so a
 * throttled or sleeping tab loses nothing (sort the gap with classifyGap from lib/game-kit/time). While `paused()` is
 * true the clock still advances but onTick is skipped, so unpausing never pays out the pause.
 */
export function useGameClock(onTick: (gap: number, now: number) => void, { ms = 100, enabled = true, paused }: { ms?: number; enabled?: boolean; paused?: () => boolean } = {}): void {
    const last = useRef(0);
    useEffect(() => {
        if (enabled) last.current = Date.now();
    }, [enabled]);
    useInterval(() => {
        const now = Date.now();
        const gap = (now - last.current) / 1000;
        last.current = now;
        if (paused?.()) return;
        onTick(gap, now);
    }, ms, enabled);
}

// ---- saving ------------------------------------------------------------------------------------------------------

/**
 * The autosave loop: calls `save` every `everyMs`, when the tab is hidden or the page is left, and on unmount.
 * It never decides what or how to write; `save` does (see the save helpers in lib/games). `afterSave` runs after each
 * interval save, for rolling backups on their own schedule.
 */
export function useAutosave(save: () => void, { everyMs = 8000, enabled = true, afterSave }: { everyMs?: number; enabled?: boolean; afterSave?: () => void } = {}): void {
    const ref = useRef({ save, afterSave });
    useEffect(() => {
        ref.current = { save, afterSave };
    });
    useEffect(() => {
        if (!enabled) return;
        const id = window.setInterval(() => {
            ref.current.save();
            ref.current.afterSave?.();
        }, everyMs);
        const onHide = () => ref.current.save();
        document.addEventListener("visibilitychange", onHide);
        window.addEventListener("pagehide", onHide);
        return () => {
            window.clearInterval(id);
            document.removeEventListener("visibilitychange", onHide);
            window.removeEventListener("pagehide", onHide);
            ref.current.save();
        };
    }, [everyMs, enabled]);
}

// ---- settings ----------------------------------------------------------------------------------------------------

/** Reads a kit settings store (lib/game-kit/settings) and re-renders on every change. Server render uses `fallback`. */
export function useSettings<T>(store: SettingsStore<T>, fallback: T): T {
    return useSyncExternalStore(store.subscribe, store.get, () => fallback);
}
