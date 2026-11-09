"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";
import { prefersReducedMotion, whenUngated } from "@/lib/motion/engine";
import type { RevealVariant } from "@/components/cm/motion";

/**
 * Reveals its content once, the first time it scrolls into view. State lives in data attributes written by the
 * motion engine, so it never re-renders. `variant` is the controlled variation: rise (default), slide, slide-r,
 * scale, wipe, line, fade. `delay` (ms) overrides the automatic wave stagger.
 */
export function Reveal({
    as: Tag = "div",
    className,
    delay,
    variant = "rise",
    children,
    style,
}: {
    as?: ElementType;
    className?: string;
    delay?: number;
    variant?: RevealVariant;
    children: ReactNode;
    style?: CSSProperties;
}) {
    return (
        <Tag
            className={className || undefined}
            data-mx={variant === "rise" ? "" : variant}
            style={delay != null ? { ["--d" as string]: `${delay}ms`, ...style } : style}
        >
            {children}
        </Tag>
    );
}

/** Counts up once, when it first comes into view (900ms ease-out). Writes the DOM directly: no re-renders. */
export function CountUp({ value, className = "" }: { value: number; className?: string }) {
    const ref = useRef<HTMLSpanElement>(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el || prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;
        const final = value.toLocaleString("en-US");
        el.textContent = (0).toLocaleString("en-US");
        let raf = 0;
        let io: IntersectionObserver | null = null;
        const run = () => {
            const t0 = performance.now();
            const tick = (t: number) => {
                const p = Math.min(1, (t - t0) / 900);
                el.textContent = Math.round(value * (1 - Math.pow(1 - p, 3))).toLocaleString("en-US");
                if (p < 1) raf = requestAnimationFrame(tick);
                else el.textContent = final;
            };
            raf = requestAnimationFrame(tick);
        };
        const cancelGate = whenUngated(() => {
            io = new IntersectionObserver((es) => {
                if (!es.some((e) => e.isIntersecting)) return;
                io?.disconnect();
                run();
            });
            io.observe(el);
        });
        return () => {
            cancelGate();
            io?.disconnect();
            cancelAnimationFrame(raf);
            el.textContent = final;
        };
    }, [value]);
    return (
        <span ref={ref} className={`cm-num ${className}`.trim()} suppressHydrationWarning>
            {value.toLocaleString("en-US")}
        </span>
    );
}
