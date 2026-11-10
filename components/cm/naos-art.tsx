"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import "./naos-art.css";

/** Every full-page backdrop. A page prefetches the others once its own art is up, so the next page is ready. */
const BACKDROPS = ["home", "studies", "about", "history", "timeline", "blog", "games", "default"].map((n) => `/naos/bg-${n}.webp`);

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

/**
 * Full-bleed dithered backdrop for a whole naOS page (scripts/naos-art/generate.py, backdrop()). Fixed to the
 * viewport and painted under the page content, so it reads as the ground the page sits on, not a header piece.
 * Place it as the first child of the page's `.ctos` root. Decorative: aria-hidden, no pointer events.
 */
export function NaosBackdrop({ src }: { src: string }) {
    // Asked for during render, so the browser fetches it before the stylesheet reaches the background. The backdrop
    // fades in only once the image is decoded, over a cheap dot field, so it never blinks in as a finished picture.
    preload(src, { as: "image", fetchPriority: "high" });
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let live = true;
        const img = new Image();
        img.src = src;
        const show = () => {
            if (live) setReady(true);
        };
        if (typeof img.decode === "function") img.decode().then(show, show);
        else img.onload = show;

        // Prefetch the other page backdrops at low priority once this one is up. Skipped on phones and data saver,
        // where the extra kilobytes cost more than the wait they save.
        const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
        const small = window.matchMedia("(max-width: 760px)").matches;
        let idle: number | undefined;
        if (!small && !conn?.saveData) {
            idle = window.setTimeout(() => {
                for (const other of BACKDROPS) if (other !== src) preload(other, { as: "image", fetchPriority: "low" });
            }, 1500);
        }
        return () => {
            live = false;
            if (idle !== undefined) window.clearTimeout(idle);
        };
    }, [src]);

    return (
        <>
            <div className={`naos-backdrop-ground${ready ? " is-hidden" : ""}`} aria-hidden="true" />
            <div className={`naos-backdrop${ready ? " is-ready" : ""}`} aria-hidden="true" style={{ backgroundImage: `url(${src})` }} />
            <div className="naos-scrim" aria-hidden="true" />
        </>
    );
}
