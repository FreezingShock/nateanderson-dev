"use client";

// Number ticks for the board: a short Web Animations flash when a big number steps up a magnitude (999 to 1.00K)
// or is spent (a drop). Runs on the DOM node only, so a tick never re-renders anything. Throttled, and skipped in
// low effects mode and under reduced motion.
import { useLayoutEffect, useRef } from "react";

const GAP_MS = 450; // at most one tick per window, so a held button does not keep the header flashing

function calm(): boolean {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function TickNum({ value, text, className, as = "b" }: { value: number; text: string; className?: string; as?: "b" | "span" }) {
    const ref = useRef<HTMLElement | null>(null);
    const prev = useRef<{ value: number; text: string } | null>(null);
    const last = useRef(0);
    useLayoutEffect(() => {
        const p = prev.current;
        prev.current = { value, text };
        const el = ref.current;
        if (!el || !p || p.text === text) return;
        if (document.body.classList.contains("nf-lowfx") || calm()) return;
        const up = text.length !== p.text.length && value > p.value; // a new magnitude
        const spend = value < p.value * 0.98 && value > 0; // bought something
        if (!up && !spend) return;
        const now = performance.now();
        if (now - last.current < GAP_MS) return;
        last.current = now;
        try {
            el.getAnimations().filter((a) => (a as Animation & { id?: string }).id === "nf-tick").forEach((a) => a.cancel());
            const frames: Keyframe[] = up
                ? [{ transform: "translateY(-6px) scale(1.08)", opacity: 0.55 }, { transform: "none", opacity: 1 }]
                : [{ transform: "translateY(4px)", filter: "brightness(1.6) hue-rotate(-30deg)" }, { transform: "none", filter: "none" }];
            el.animate(frames, { duration: up ? 220 : 160, easing: up ? "steps(4, end)" : "steps(3, end)", id: "nf-tick" });
        } catch {}
    }, [value, text]);
    const Tag = as;
    return <Tag ref={ref as never} className={className}>{text}</Tag>;
}
