"use client";

import { useEffect, type RefObject } from "react";

/**
 * iOS ignores `overflow: hidden` on the page, so a drag on the dimmed backdrop of an open sheet still scrolls the page
 * behind it. Cancel that drag on the backdrop itself. Panels keep their own scrolling, because the touch starts inside
 * them, not on the backdrop. The listener is native and non-passive, since React's touch listeners are passive.
 */
export function useBackdropScrollLock(ref: RefObject<HTMLElement | null>, active: boolean) {
    useEffect(() => {
        const el = ref.current;
        if (!active || !el) return;
        const stop = (e: TouchEvent) => {
            if (e.target === el) e.preventDefault();
        };
        el.addEventListener("touchmove", stop, { passive: false });
        return () => el.removeEventListener("touchmove", stop);
    }, [ref, active]);
}
