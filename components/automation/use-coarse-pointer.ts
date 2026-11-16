"use client";

// True on a touch screen (a coarse primary pointer). Starts false so the server and first client render match, then follows the media query.
import { useEffect, useState } from "react";

export function useCoarsePointer(): boolean {
    const [coarse, setCoarse] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia("(pointer: coarse)");
        const sync = () => setCoarse(mq.matches);
        sync();
        mq.addEventListener("change", sync);
        return () => mq.removeEventListener("change", sync);
    }, []);
    return coarse;
}
