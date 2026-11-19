"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import "./theme-switch.css";

// Footer control for the page colour. Dark is the default. "light" is the warm paper theme (data-theme="paper" on
// <html>, see app/camino/paper.css). The choice is saved in this browser only (next-themes, localStorage).
const OPTIONS: { mode: "dark" | "paper"; label: string; hint: string }[] = [
    { mode: "dark", label: "dark", hint: "the default, dark ground" },
    { mode: "paper", label: "light", hint: "warm paper ground, ink plates" },
];

export function ThemeSwitch() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    // Until the client has read the saved choice, show dark (the server render), so the markup never disagrees.
    const current = mounted && theme === "paper" ? "paper" : "dark";

    return (
        <div className="thm-sw" role="group" aria-label="Page colour">
            <span className="thm-sw-lead">theme</span>
            <div className="thm-sw-row">
                {OPTIONS.map((o) => (
                    <button
                        key={o.mode}
                        type="button"
                        className="thm-sw-btn"
                        data-k={o.mode}
                        aria-pressed={current === o.mode}
                        title={o.hint}
                        onClick={() => setTheme(o.mode)}
                    >
                        <i aria-hidden="true" />
                        <span>{o.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
