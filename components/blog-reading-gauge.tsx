"use client";

import { useEffect, useRef } from "react";

/**
 * How far through one article the reader is: a cyan bar and a percent readout in the post strip. It reads the
 * article's own box, so the number goes 0 to 100 across the text rather than across the whole page. Scroll events
 * are batched into one animation frame; the bar moves with transform only, and the readout is written as text
 * (no React re-render per scroll).
 */
export function ReadingGauge({ targetId }: { targetId: string }) {
    const barRef = useRef<HTMLDivElement>(null);
    const labelRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const target = document.getElementById(targetId);
        const bar = barRef.current;
        const label = labelRef.current;
        if (!target || !bar || !label) return;

        let frame = 0;
        const paint = () => {
            frame = 0;
            const rect = target.getBoundingClientRect();
            const span = rect.height - window.innerHeight * 0.5;
            const raw = span > 0 ? -rect.top / span : 1;
            const p = Math.min(1, Math.max(0, raw));
            bar.style.transform = `scaleX(${p.toFixed(4)})`;
            label.textContent = `${Math.round(p * 100)}%`;
        };
        const onScroll = () => {
            if (!frame) frame = window.requestAnimationFrame(paint);
        };

        paint();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            if (frame) window.cancelAnimationFrame(frame);
        };
    }, [targetId]);

    return (
        <div className="post-gauge" aria-hidden="true">
            <div className="post-gauge-row">
                <span className="cm-lbl">Reading</span>
                <span className="post-gauge-val" ref={labelRef}>0%</span>
            </div>
            <div className="post-gauge-track">
                <div className="post-gauge-bar" ref={barRef} />
            </div>
        </div>
    );
}
