"use client";

import { useEffect, useRef } from "react";

/** Film vignette, grain and the one-time scan sweep. Decorative only; aria-hidden. */
export function Film() {
    const sweep = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!reduce) sweep.current?.classList.add("go");
    }, []);
    return (
        <div aria-hidden="true">
            <div className="cm-film" />
            <div className="cm-grain" />
            <div className="cm-sweep" ref={sweep} />
        </div>
    );
}
