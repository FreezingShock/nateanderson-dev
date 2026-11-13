"use client";

import { useEffect } from "react";

// Marks the document while the Brasswork route is mounted so app/camino/brasswork.css can hide the site dock,
// top bar, page gauge and footer (the game's own HUD replaces them). Removed on unmount.
export function BrassworkRouteChrome() {
    useEffect(() => {
        const root = document.documentElement;
        root.classList.add("bw-route");
        return () => root.classList.remove("bw-route");
    }, []);
    return null;
}
