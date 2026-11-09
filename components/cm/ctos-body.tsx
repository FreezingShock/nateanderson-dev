"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Sets `ctos-on` on <body> when the current page renders a naOS (`.ctos`) wrapper.
 *
 * The naOS page background, footer and bar rules used to be written as `body:has(.ctos)`. Chrome has to re-check
 * every `:has()` rule against the whole document each time a route swaps its DOM, which made each switch to a naOS
 * page spend hundreds of milliseconds in style recalc. A plain body class gives the same styling with no re-checks.
 * Runs after each route change, before paint, so client navigations never show the wrong ground.
 */
export function CtosBody() {
    const pathname = usePathname();
    useLayoutEffect(() => {
        document.body.classList.toggle("ctos-on", document.querySelector(".ctos") !== null);
    }, [pathname]);
    return null;
}
