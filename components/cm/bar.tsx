"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { useTheme } from "next-themes";
import { BookOpen, GraduationCap, History, Home, PenLine, Route, User } from "lucide-react";
import { NateGlyph } from "@/components/cm/mark";
import { navItems } from "@/lib/nav";
import { JOURNEY_END, JOURNEY_START, progressBetween } from "@/lib/timeline-data";
import { useSoundPrefs } from "@/lib/sound/use-sound";
import { sfx } from "@/lib/sound/sounds";

const ICONS: Record<string, typeof Home> = {
    "/": Home,
    "/creations": BookOpen,
    "/timeline": Route,
    "/studies": GraduationCap,
    "/blog": PenLine,
    "/history": History,
    "/about": User,
};

const isActive = (path: string, href: string) =>
    href === "/" ? path === "/" : path === href || path.startsWith(href + "/");

export function openLauncher() {
    window.dispatchEvent(new Event("cm:launcher"));
}

/** Slim strip at the top of the page: brand, journey gauge and the theme / sound / search tools. Scrolls away. */
export function Bar({ initialPct }: { initialPct: number }) {
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
        <header className="cm-top">
            <Link className="home" href="/" aria-label="Nate Anderson, home">
                <NateGlyph size={22} />
                <b>NATE ANDERSON</b>
            </Link>
            <div className="cm-gauge" title="Progress along the plan, Sept 2026 to May 2031">
                <div className="row">
                    <span className="cm-lbl" style={{ fontSize: 8.5 }}>Path</span>
                    <span className="v" style={{ color: "var(--cm-cyan)" }}>{pct}%</span>
                </div>
                <div className="cm-meter"><i style={{ ["--v" as string]: `${pct}%` }} /></div>
            </div>
            <div className="tools">
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
        </header>
    );
}

/** The bottom dock: one tab per page. A cyan plate slides to the tab you tap, before the page has even loaded. */
export function Dock() {
    const path = usePathname();
    const [next, setNext] = useState<string | null>(null);
    useEffect(() => setNext(null), [path]);

    const target = next ?? path;
    const idx = navItems.findIndex((n) => isActive(target, n.href));
    return (
        <nav className="cm-dock" aria-label="Primary" style={{ ["--tabs" as string]: navItems.length, ["--i" as string]: Math.max(idx, 0) } as CSSProperties}>
            <i className="ind" aria-hidden="true" data-off={idx < 0 ? "" : undefined} />
            {navItems.map((n) => {
                const Icon = ICONS[n.href] ?? Home;
                return (
                    <Link
                        key={n.href}
                        href={n.href}
                        aria-current={isActive(path, n.href) ? "page" : undefined}
                        data-on={isActive(target, n.href) ? "" : undefined}
                        onClick={() => setNext(n.href)}
                    >
                        <Icon className="ic" aria-hidden="true" strokeWidth={1.75} />
                        <span>{n.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
