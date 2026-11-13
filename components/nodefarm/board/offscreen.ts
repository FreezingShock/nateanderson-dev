"use client";

import { useEffect, type RefObject } from "react";

/**
 * Marks board panels that are scrolled out of view with data-off, so CSS can pause their looping animations
 * (app/camino/nodefarm/fx.css). The board is thousands of elements tall at the late game; nothing below the fold
 * should be animating. A panel is judged against the viewport plus 300px, so it is already moving when it scrolls in.
 */
const off = new Set<string>();
/** True while the board panel with this data-stat (lab, sched, drones, a zone id) is scrolled out of view. */
export const isOff = (stat: string) => off.has(stat);

export function useOffscreenPause(root: RefObject<HTMLElement | null>, on: boolean) {
    useEffect(() => {
        const host = root.current;
        if (!on || !host || typeof IntersectionObserver === "undefined") return;
        const seen = new WeakSet<Element>();
        const io = new IntersectionObserver(
            (list) => {
                for (const e of list) {
                    const k = (e.target as HTMLElement).dataset.stat;
                    if (e.isIntersecting) { e.target.removeAttribute("data-off"); if (k) off.delete(k); }
                    else { e.target.setAttribute("data-off", ""); if (k) off.add(k); }
                }
            },
            { rootMargin: "300px 0px" },
        );
        // panels come and go (a zone decrypts, an arc folds), so look for new ones once a second
        const scan = () => {
            host.querySelectorAll(".nf-statspane > *, .nf-arc-zones > *, .nf-corepane > *").forEach((el) => {
                if (seen.has(el)) return;
                seen.add(el);
                io.observe(el);
            });
        };
        scan();
        const iv = setInterval(scan, 1000);
        return () => {
            clearInterval(iv);
            io.disconnect();
            off.clear();
            host.querySelectorAll("[data-off]").forEach((el) => el.removeAttribute("data-off"));
        };
    }, [root, on]);
}
