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
    const backdropRef = useRef<HTMLDivElement>(null);
    const haloRef = useRef<HTMLDivElement>(null);
    const ripplesRef = useRef<HTMLDivElement>(null);

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

    // Input reactions. The art drifts a little with the pointer and the scroll position (depth, not a fixed sheet), a
    // dither halo wakes under the cursor or finger, and each press throws a short dither ring. Everything moves by
    // transform on its own layer, in one rAF loop that sleeps once settled, so no frame ever re-lays out the page.
    // Off under reduced motion; the static backdrop is unchanged.
    useEffect(() => {
        const backdrop = backdropRef.current;
        const halo = haloRef.current;
        const ripples = ripplesRef.current;
        if (!backdrop || !halo || !ripples) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const phone = window.matchMedia("(max-width: 760px)");
        const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
        const aim = { x: 0, y: 0, nx: 0.5 };
        const at = { x: 0, y: 0 };
        const drift = { x: 0, y: 0 };
        let frame = 0;

        const tick = () => {
            frame = 0;
            const r = phone.matches ? 100 : 150;
            at.x += (aim.x - at.x) * 0.22;
            at.y += (aim.y - at.y) * 0.22;
            // Pointer leans the art a few px sideways; scroll pushes it down slowly (capped), so it sits behind the copy.
            const wantX = fine ? (aim.nx - 0.5) * -20 : 0;
            const wantY = Math.min(Math.max(window.scrollY, 0) * 0.1, 56);
            drift.x += (wantX - drift.x) * 0.1;
            drift.y += (wantY - drift.y) * 0.1;
            halo.style.transform = `translate3d(${(at.x - r).toFixed(1)}px, ${(at.y - r).toFixed(1)}px, 0)`;
            backdrop.style.transform = `translate3d(${drift.x.toFixed(2)}px, ${drift.y.toFixed(2)}px, 0)`;
            const moving =
                Math.abs(aim.x - at.x) > 0.3 || Math.abs(aim.y - at.y) > 0.3 || Math.abs(wantX - drift.x) > 0.05 || Math.abs(wantY - drift.y) > 0.05;
            if (moving) frame = window.requestAnimationFrame(tick);
        };
        const schedule = () => {
            if (!frame) frame = window.requestAnimationFrame(tick);
        };

        const onMove = (e: PointerEvent) => {
            aim.x = e.clientX;
            aim.y = e.clientY;
            aim.nx = e.clientX / Math.max(window.innerWidth, 1);
            if (!halo.classList.contains("is-on")) {
                at.x = aim.x;
                at.y = aim.y;
                halo.classList.add("is-on");
            }
            schedule();
        };
        const onDown = (e: PointerEvent) => {
            if (e.button !== 0) return;
            onMove(e);
            const dot = document.createElement("span");
            dot.className = "naos-ripple";
            dot.style.left = `${e.clientX}px`;
            dot.style.top = `${e.clientY}px`;
            dot.addEventListener("animationend", () => dot.remove());
            ripples.appendChild(dot);
            while (ripples.childElementCount > 3) ripples.firstElementChild?.remove();
        };
        // A finger lifting ends its halo; a mouse leaving the window does the same.
        const onUp = (e: PointerEvent) => {
            if (e.pointerType === "touch" || e.pointerType === "pen") halo.classList.remove("is-on");
        };
        const onOut = (e: PointerEvent) => {
            if (!e.relatedTarget) halo.classList.remove("is-on");
        };

        window.addEventListener("pointermove", onMove, { passive: true });
        window.addEventListener("pointerdown", onDown, { passive: true });
        window.addEventListener("pointerup", onUp, { passive: true });
        window.addEventListener("pointercancel", onUp, { passive: true });
        window.addEventListener("pointerout", onOut, { passive: true });
        window.addEventListener("scroll", schedule, { passive: true });
        schedule();

        return () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerdown", onDown);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
            window.removeEventListener("pointerout", onOut);
            window.removeEventListener("scroll", schedule);
            if (frame) window.cancelAnimationFrame(frame);
            ripples.replaceChildren();
            halo.classList.remove("is-on");
            halo.style.transform = "";
            backdrop.style.transform = "";
        };
    }, [src]);

    return (
        <>
            <div className={`naos-backdrop-ground${ready ? " is-hidden" : ""}`} aria-hidden="true" />
            <div ref={backdropRef} className={`naos-backdrop${ready ? " is-ready" : ""}`} aria-hidden="true" style={{ backgroundImage: `url(${src})` }} />
            <div ref={haloRef} className="naos-halo" aria-hidden="true" />
            <div ref={ripplesRef} className="naos-ripples" aria-hidden="true" />
            <div className="naos-scrim" aria-hidden="true" />
        </>
    );
}
