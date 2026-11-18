"use client";

import { useEffect, useState } from "react";
import { ACCENT_KEY, accentForNow, isAccentMode, pacificClock, type Accent, type AccentMode } from "@/lib/accent";
import { ACCENT_EVENT, pickAccent, previewAccent } from "@/components/cm/accent-root";
import "./accent-switch.css";

const OPTIONS: { mode: AccentMode; label: string; hint: string }[] = [
    { mode: "auto", label: "auto", hint: "follow Pacific time" },
    { mode: "amber", label: "amber", hint: "morning, 05:00 to 11:59 Pacific" },
    { mode: "cyan", label: "cyan", hint: "afternoon, 12:00 to 16:59 Pacific" },
    { mode: "violet", label: "violet", hint: "evening and night, 17:00 to 04:59 Pacific" },
];

/**
 * Footer control for the time-of-day accent. Hover or focus previews a colour across the site; a click pins it
 * (saved in this browser only). "auto" follows the clock. The readout shows the Pacific time and the band in use.
 */
export function AccentSwitch() {
    const [mode, setMode] = useState<AccentMode>("auto");
    const [shown, setShown] = useState<Accent>("cyan");
    const [clock, setClock] = useState<string>("");

    useEffect(() => {
        let stored: AccentMode = "auto";
        try {
            const v = localStorage.getItem(ACCENT_KEY);
            if (isAccentMode(v)) stored = v;
        } catch {
            /* blocked storage: auto */
        }
        setMode(stored);
        const sync = () => {
            const { hour, minute } = pacificClock();
            setClock(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} PT`);
            setShown((document.documentElement.getAttribute("data-accent") as Accent | null) ?? accentForNow());
        };
        sync();
        const id = window.setInterval(sync, 30_000);
        const onPick = (e: Event) => {
            const m = (e as CustomEvent<{ mode?: unknown }>).detail?.mode;
            if (isAccentMode(m)) setMode(m);
            window.setTimeout(sync, 0);
        };
        window.addEventListener(ACCENT_EVENT, onPick);
        return () => {
            window.clearInterval(id);
            window.removeEventListener(ACCENT_EVENT, onPick);
        };
    }, []);

    const preview = (m: AccentMode, on: boolean) => {
        if (m === "auto") previewAccent(on ? accentForNow() : null);
        else previewAccent(on ? m : null);
    };

    return (
        <div className="acc-sw" role="group" aria-label="Accent colour">
            <span className="acc-sw-lead">accent</span>
            <div className="acc-sw-row">
                {OPTIONS.map((o) => (
                    <button
                        key={o.mode}
                        type="button"
                        className="acc-sw-btn"
                        data-k={o.mode}
                        aria-pressed={mode === o.mode}
                        title={o.hint}
                        onMouseEnter={() => preview(o.mode, true)}
                        onMouseLeave={() => preview(o.mode, false)}
                        onFocus={() => preview(o.mode, true)}
                        onBlur={() => preview(o.mode, false)}
                        onClick={() => pickAccent(o.mode)}
                    >
                        <i aria-hidden="true" />
                        <span>{o.label}</span>
                    </button>
                ))}
            </div>
            <span className="acc-sw-now" aria-live="polite">
                {clock ? `${clock} · ${shown}` : shown}
            </span>
        </div>
    );
}
