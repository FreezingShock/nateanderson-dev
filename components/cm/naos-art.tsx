"use client";

import { useLayoutEffect, useRef } from "react";
import "./naos-art.css";

/**
 * Original naOS 1-bit dithered art (see scripts/naos-art/generate.py). Decorative only: aria-hidden, no alt text.
 * The image wipes in with a stepped, dithered-looking reveal once it scrolls into view. Without JS it simply shows.
 */
export function NaosArt({
    src,
    width,
    height,
    variant = "break",
    eager = false,
    className = "",
}: {
    src: string;
    width: number;
    height: number;
    variant?: "hero" | "break";
    /** Hero art is above the fold: load now and skip the scroll reveal. */
    eager?: boolean;
    className?: string;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el || eager) return;
        if (typeof IntersectionObserver === "undefined") return;
        // Armed before paint so the reveal starts hidden; the observer then plays it once.
        el.classList.add("is-armed");
        const io = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    if (e.isIntersecting) {
                        el.classList.add("is-in");
                        io.disconnect();
                    }
                }
            },
            { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
        );
        io.observe(el);
        return () => io.disconnect();
    }, [eager]);

    return (
        <div ref={ref} className={`naos-art naos-art-${variant} ${className}`.trim()} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} width={width} height={height} alt="" loading={eager ? "eager" : "lazy"} decoding="async" draggable={false} />
        </div>
    );
}
