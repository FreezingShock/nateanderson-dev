"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { useTheme } from "next-themes";
import { BookOpen, GraduationCap, History, Home, Menu, PenLine, Route, Search, User, Volume2, VolumeX } from "lucide-react";
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

export function openMenu() {
    window.dispatchEvent(new Event("cm:menu"));
}

/**
 * Top status strip, one row: menu, brand, "you are here" crumb with the path meter, then the tools (search, theme,
 * sound). It scrolls away so the page keeps the whole screen.
 */
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
    const here = navItems.find((n) => isActive(path, n.href));
    const sub = here?.children?.find((c) => path === c.href || path.startsWith(c.href + "/"));
    const crumb = sub ? `${here?.label} / ${sub.label}` : here?.label ?? "Pages";

    return (
        <header className="nv-top">
            <button type="button" className="nv-menu-btn" onClick={openMenu} aria-label="Open site map" aria-haspopup="dialog">
                <Menu aria-hidden="true" size={17} strokeWidth={2} />
                <span>menu</span>
            </button>
            <Link className="nv-brand" href="/" aria-label="Nate Anderson, home">
                <NateGlyph size={20} />
                <b>nate anderson</b>
            </Link>
            <div className="nv-where">
                <span className="nv-no" aria-hidden="true">{here?.no ?? "--"}</span>
                <span className="nv-name" aria-live="polite">{crumb}</span>
                <div className="cm-gauge nv-gauge" title="Progress along the plan, Sept 2026 to May 2031">
                    <div className="row">
                        <span className="cm-lbl" style={{ fontSize: 8.5 }}>Path</span>
                        <span className="v" style={{ color: "var(--cm-cyan)" }}>{pct}%</span>
                    </div>
                    <div className="cm-meter"><i style={{ ["--v" as string]: `${pct}%` }} /></div>
                </div>
            </div>
            <div className="nv-tools">
                <button type="button" className="nv-search" onClick={openLauncher} aria-label="Search the site">
                    <Search aria-hidden="true" size={15} strokeWidth={2} />
                    <span>search</span>
                    <kbd className="nv-key" aria-hidden="true">/</kbd>
                </button>
                <div className="nv-theme" role="group" aria-label="Theme">
                    <button type="button" aria-pressed={current === "dark"} onClick={() => setTheme("dark")}>dark</button>
                    <button type="button" aria-pressed={current === "paper"} onClick={() => setTheme("paper")}>paper</button>
                </div>
                <button
                    type="button"
                    className="nv-snd"
                    data-snd="off"
                    aria-pressed={mounted ? snd.on : true}
                    aria-label={snd.on ? "Mute sound" : "Unmute sound"}
                    onClick={() => {
                        setSnd({ on: !snd.on });
                        if (!snd.on) setTimeout(() => sfx("on"), 40);
                    }}
                >
                    {mounted && !snd.on ? <VolumeX aria-hidden="true" size={15} strokeWidth={2} /> : <Volume2 aria-hidden="true" size={15} strokeWidth={2} />}
                    <span className="nv-snd-t" style={{ color: snd.on || !mounted ? "var(--cm-cyan)" : "var(--cm-dim)" }}>{mounted && !snd.on ? "off" : "on"}</span>
                </button>
            </div>
        </header>
    );
}

/** The bottom dock: one tab per page, numbered like the site map. A plate slides to the tab you tap, before the page has loaded. */
export function Dock() {
    const path = usePathname();
    const [next, setNext] = useState<string | null>(null);
    useEffect(() => setNext(null), [path]);
    // Never let the plate stay on a tab the route didn't reach (error, offline, cancelled transition).
    useEffect(() => {
        if (!next) return;
        const t = window.setTimeout(() => setNext(null), 7000);
        return () => window.clearTimeout(t);
    }, [next]);

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
                        onClick={() => setNext(isActive(path, n.href) ? null : n.href)}
                    >
                        <Icon className="ic" aria-hidden="true" strokeWidth={1.75} />
                        <span>{n.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
