"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { ACCENT_KEY, accentForNow, isAccentMode, type Accent, type AccentMode } from "@/lib/accent";
import { sectionForPath } from "@/lib/section-accent";
import "./accent-root.css";

/** Fired on window to pin a mode ("auto" or one accent). Detail: { mode }. */
export const ACCENT_EVENT = "cm:accent";
/** Fired on window while a control is hovered or focused, to preview an accent. Detail: { accent | null }. */
export const ACCENT_PREVIEW_EVENT = "cm:accent-preview";

function readStored(): AccentMode {
    try {
        const v = localStorage.getItem(ACCENT_KEY);
        return isAccentMode(v) ? v : "auto";
    } catch {
        return "auto";
    }
}

function writeStored(mode: AccentMode) {
    try {
        if (mode === "auto") localStorage.removeItem(ACCENT_KEY);
        else localStorage.setItem(ACCENT_KEY, mode);
    } catch {
        /* private window or blocked storage: the pick lasts for this visit only */
    }
}

/**
 * Keeps <html data-accent> in step with Pacific time and the viewer's pick. The first value is set before paint by an
 * inline script (lib/accent.ts), so this only handles changes after load: the clock crossing a band, a pick, and a
 * hover preview. Each change is a colour ease (camino.tokens.css) with a short sweep across the page. Reduced motion
 * drops the sweep and makes the ease instant. Mount once in the root layout.
 */
export function AccentRoot() {
    const sweepRef = useRef<HTMLDivElement>(null);
    const path = usePathname();

    // Section colour: a plain attribute, so the CSS eases it like the time accent. No sweep for a section change.
    useEffect(() => {
        const sec = sectionForPath(path);
        if (sec) document.documentElement.setAttribute("data-section", sec);
        else document.documentElement.removeAttribute("data-section");
    }, [path]);

    const modeRef = useRef<AccentMode>("auto");
    const shownRef = useRef<Accent | null>(null);
    const previewRef = useRef<Accent | null>(null);

    useEffect(() => {
        const root = document.documentElement;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

        const sweep = () => {
            const el = sweepRef.current;
            if (!el || reduce.matches) return;
            el.classList.remove("is-run");
            void el.offsetWidth; // restart the animation
            el.classList.add("is-run");
        };

        const paint = (a: Accent, animate: boolean) => {
            if (shownRef.current === a) return;
            const first = shownRef.current === null;
            shownRef.current = a;
            root.setAttribute("data-accent", a);
            if (animate && !first) sweep();
        };

        const effective = () => (modeRef.current === "auto" ? accentForNow() : modeRef.current);

        // Start from what the inline script chose, so there is no second paint on load.
        modeRef.current = readStored();
        shownRef.current = (root.getAttribute("data-accent") as Accent | null) ?? null;
        paint(effective(), false);

        const onPick = (e: Event) => {
            const mode = (e as CustomEvent<{ mode?: unknown }>).detail?.mode;
            if (!isAccentMode(mode)) return;
            modeRef.current = mode;
            previewRef.current = null;
            writeStored(mode);
            paint(effective(), true);
        };
        const onPreview = (e: Event) => {
            const a = (e as CustomEvent<{ accent?: Accent | null }>).detail?.accent ?? null;
            previewRef.current = a;
            paint(a ?? effective(), true);
        };

        // The clock: check each 30 seconds; a band change on auto eases and sweeps like a pick.
        const tick = window.setInterval(() => {
            if (modeRef.current !== "auto" || previewRef.current) return;
            paint(accentForNow(), true);
        }, 30_000);

        window.addEventListener(ACCENT_EVENT, onPick);
        window.addEventListener(ACCENT_PREVIEW_EVENT, onPreview);
        return () => {
            window.clearInterval(tick);
            window.removeEventListener(ACCENT_EVENT, onPick);
            window.removeEventListener(ACCENT_PREVIEW_EVENT, onPreview);
        };
    }, []);

    return <div ref={sweepRef} className="accent-sweep" aria-hidden="true" />;
}

/** Pin a mode from anywhere on the site (the footer switch, the console). */
export function pickAccent(mode: AccentMode) {
    window.dispatchEvent(new CustomEvent(ACCENT_EVENT, { detail: { mode } }));
}

/** Preview an accent while a control is hovered or focused; pass null to go back to the shown accent. */
export function previewAccent(accent: Accent | null) {
    window.dispatchEvent(new CustomEvent(ACCENT_PREVIEW_EVENT, { detail: { accent } }));
}
