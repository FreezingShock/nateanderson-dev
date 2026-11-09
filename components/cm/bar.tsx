"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { NateGlyph } from "@/components/cm/mark";
import { navItems } from "@/lib/nav";
import { JOURNEY_END, JOURNEY_START, progressBetween } from "@/lib/timeline-data";
import { useSoundPrefs } from "@/lib/sound/use-sound";
import { sfx } from "@/lib/sound/sounds";

const isActive = (path: string, href: string) =>
    href === "/" ? path === "/" : path === href || path.startsWith(href + "/");

export function openLauncher() {
    window.dispatchEvent(new Event("cm:launcher"));
}

/** The one slim top bar: mark, pages, journey gauge, theme, sound and the "/" launcher. */
export function Bar({ initialPct }: { initialPct: number }) {
    const path = usePathname();
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [pct, setPct] = useState(initialPct);
    const [snd, setSnd] = useSoundPrefs();

    useEffect(() => {
        setMounted(true);
        setPct(Math.round(progressBetween(JOURNEY_START, JOURNEY_END) * 100));
    }, []);

    const current = mounted ? (theme === "paper" ? "paper" : "dark") : "dark";

    return (
        <nav className="cm-bar fixed-top" aria-label="Primary">
            <Link className="home" href="/" aria-label="Nate Anderson, home">
                <NateGlyph size={22} />
                <b>NATE ANDERSON</b>
            </Link>
            <div className="grp grow links">
                {navItems
                    .filter((n) => n.href !== "/")
                    .map((n) => (
                        <Link
                            key={n.href}
                            href={n.href}
                            className="nav"
                            aria-current={isActive(path, n.href) ? "page" : undefined}
                        >
                            {n.label}
                        </Link>
                    ))}
            </div>
            <div className="grp gauge-grp">
                <div className="cm-gauge" title="Progress along the plan, Sept 2026 to May 2031">
                    <div className="row">
                        <span className="cm-lbl" style={{ fontSize: 8.5 }}>Path</span>
                        <span className="v" style={{ color: "var(--cm-cyan)" }}>{pct}%</span>
                    </div>
                    <div className="cm-meter"><i style={{ ["--v" as string]: `${pct}%` }} /></div>
                </div>
            </div>
            <div className="grp tools">
                <div className="cm-seg" role="group" aria-label="Theme">
                    <button type="button" aria-pressed={current === "dark"} onClick={() => setTheme("dark")}>DARK</button>
                    <button type="button" aria-pressed={current === "paper"} onClick={() => setTheme("paper")}>PAPER</button>
                </div>
                <button
                    type="button"
                    className="cm-btn"
                    data-snd="off"
                    aria-pressed={mounted ? snd.on : true}
                    aria-label={snd.on ? "Mute sound" : "Unmute sound"}
                    onClick={() => {
                        setSnd({ on: !snd.on });
                        if (!snd.on) setTimeout(() => sfx("on"), 40);
                    }}
                >
                    SND <span className="cm-state live" style={{ color: snd.on ? "var(--cm-cyan)" : "var(--cm-dim)" }}>{mounted && !snd.on ? "OFF" : "ON"}</span>
                </button>
                <button type="button" className="cm-btn" onClick={openLauncher} aria-label="Open search">
                    Search <span className="cm-kbd">/</span>
                </button>
            </div>
        </nav>
    );
}
