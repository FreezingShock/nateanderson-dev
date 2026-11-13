"use client";

import { useEffect } from "react";

// Marks the document while the Starwright route is mounted so app/camino/starwright.css can hide the site dock, top bar,
// page gauge and footer (the game draws its own header). Removed on unmount.
export function StarwrightRouteChrome() {
    useEffect(() => {
        const root = document.documentElement;
        root.classList.add("sw-route");
        return () => root.classList.remove("sw-route");
    }, []);
    return null;
}
