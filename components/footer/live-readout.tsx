"use client";

import { useEffect, useRef } from "react";

// A live bar graph for the footer. It starts from fixed heights so the server and first client render match (no DOM
// mutation before hydration), then, after mount, one rAF loop eases each bar toward a random target. It writes only
// transform, pauses when the footer is off screen, and holds still under prefers-reduced-motion.
export function LiveReadout({ bars = 36 }: { bars?: number }) {
    const wrap = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = wrap.current;
        if (!root) return;
        const els = Array.from(root.querySelectorAll<HTMLElement>("[data-bar]"));
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce || els.length === 0) return;

        const cur = els.map((_, i) => 0.25 + ((i * 37) % 60) / 100);
        const target = cur.slice();
        let last = 0;
        let raf = 0;
        let visible = true;

        const retarget = (now: number) => {
            // A new target every ~180ms, weighted so neighbours move together like a real signal.
            if (now - last < 180) return;
            last = now;
            const base = Math.random();
            for (let i = 0; i < target.length; i++) {
                const wobble = Math.sin(now / 420 + i * 0.55) * 0.18;
                target[i] = Math.min(1, Math.max(0.12, base * 0.7 + 0.2 + wobble + (Math.random() - 0.5) * 0.35));
            }
        };

        const tick = (now: number) => {
            raf = 0;
            if (!visible) return;
            retarget(now);
            for (let i = 0; i < els.length; i++) {
                cur[i] += (target[i] - cur[i]) * 0.22;
                els[i].style.transform = `scaleY(${cur[i].toFixed(3)})`;
            }
            raf = requestAnimationFrame(tick);
        };

        const io = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible && !raf) raf = requestAnimationFrame(tick);
        });
        io.observe(root);
        raf = requestAnimationFrame(tick);

        return () => {
            io.disconnect();
            if (raf) cancelAnimationFrame(raf);
        };
    }, [bars]);

    return (
        <div ref={wrap} className="fc-graph" aria-hidden="true">
            {Array.from({ length: bars }, (_, i) => (
                <i key={i} data-bar style={{ transform: `scaleY(${0.25 + ((i * 37) % 60) / 100})` }} />
            ))}
        </div>
    );
}
