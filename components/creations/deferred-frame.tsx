"use client";

import { useEffect, useState } from "react";

/**
 * A live embed (the Nexus preview loads a whole other site, about 3 s and 40 stylesheets). Its src is set after
 * this page's own load event, so the embed no longer holds up the page's load, its first paint or the console.
 * The frame box is already laid out by .cr-preview-frame, so nothing shifts when it fills in.
 */
export function DeferredFrame({ src, title }: { src: string; title: string }) {
    const [live, setLive] = useState(false);
    useEffect(() => {
        const go = () => setLive(true);
        if (document.readyState === "complete") {
            const t = window.setTimeout(go, 0);
            return () => window.clearTimeout(t);
        }
        window.addEventListener("load", go, { once: true });
        return () => window.removeEventListener("load", go);
    }, []);
    return (
        <iframe
            src={live ? src : undefined}
            title={title}
            loading="lazy"
            allow="fullscreen; gamepad; autoplay"
            referrerPolicy="strict-origin-when-cross-origin"
        />
    );
}
