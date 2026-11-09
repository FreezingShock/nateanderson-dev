"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode, type CSSProperties } from "react";

/** Fades an element in once, the first time it scrolls into view (Camino `cm-reveal`). */
export function Reveal({
    as: Tag = "div",
    className = "",
    delay = 0,
    children,
    style,
}: {
    as?: ElementType;
    className?: string;
    delay?: number;
    children: ReactNode;
    style?: CSSProperties;
}) {
    const ref = useRef<HTMLElement>(null);
    const [on, setOn] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (typeof IntersectionObserver === "undefined") return setOn(true);
        const io = new IntersectionObserver(
            (es) => {
                if (es.some((e) => e.isIntersecting)) {
                    setOn(true);
                    io.disconnect();
                }
            },
            { threshold: 0.12 },
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);
    return (
        <Tag
            ref={ref}
            className={`cm-reveal${on ? " in" : ""} ${className}`.trim()}
            style={{ animationDelay: `${delay}ms`, ...style }}
        >
            {children}
        </Tag>
    );
}

/** Counts up once, on first view (900ms ease-out). Respects reduced motion. */
export function CountUp({ value, className = "" }: { value: number; className?: string }) {
    const ref = useRef<HTMLSpanElement>(null);
    const [n, setN] = useState(value);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce || typeof IntersectionObserver === "undefined") return;
        setN(0);
        let raf = 0;
        const io = new IntersectionObserver((es) => {
            if (!es.some((e) => e.isIntersecting)) return;
            io.disconnect();
            const t0 = performance.now();
            const tick = (t: number) => {
                const p = Math.min(1, (t - t0) / 900);
                setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
                if (p < 1) raf = requestAnimationFrame(tick);
            };
            raf = requestAnimationFrame(tick);
        });
        io.observe(el);
        return () => {
            io.disconnect();
            cancelAnimationFrame(raf);
        };
    }, [value]);
    return (
        <span ref={ref} className={`cm-num ${className}`.trim()}>
            {n.toLocaleString("en-US")}
        </span>
    );
}
