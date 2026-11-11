"use client";

import { useEffect, useState } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Types `text` out one character at a time and always settles on the full string: a guard timer finishes it even if
 * animation frames stop (background tab, throttled device). Reduced motion shows the whole line at once.
 */
export function useTyped(text: string, delay = 0, duration?: number): number {
    const len = text.length;
    const [n, setN] = useState(() => (reduced() ? len : 0));
    useEffect(() => {
        if (reduced()) {
            setN(len);
            return;
        }
        const dur = duration ?? Math.min(380, Math.max(120, len * 9));
        let raf = 0;
        let t0 = 0;
        const tick = (now: number) => {
            if (!t0) t0 = now;
            const p = Math.min(1, (now - t0) / dur);
            setN(Math.min(len, Math.ceil(p * len)));
            if (p < 1) raf = window.requestAnimationFrame(tick);
        };
        setN(0);
        const start = window.setTimeout(() => {
            raf = window.requestAnimationFrame(tick);
        }, delay);
        const guard = window.setTimeout(() => setN(len), delay + dur + 400);
        return () => {
            window.clearTimeout(start);
            window.clearTimeout(guard);
            window.cancelAnimationFrame(raf);
        };
    }, [text, len, delay, duration]);
    return n;
}

/**
 * Text that types itself in. The full line sits in a hidden layer that holds the width, so the typing never reflows
 * the row. Callers keep a real label (sr-only) for screen readers; this copy is aria-hidden.
 */
export function Typed({ text, delay = 0, duration, className }: { text: string; delay?: number; duration?: number; className?: string }) {
    const n = useTyped(text, delay, duration);
    const done = n >= text.length;
    return (
        <span className={className ? `nv-type ${className}` : "nv-type"} data-typing={done ? undefined : ""} aria-hidden="true">
            <span className="nv-type-ghost">{text}</span>
            <span className="nv-type-live">{text.slice(0, n)}</span>
        </span>
    );
}
