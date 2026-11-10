"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { BookOpen, GraduationCap, History, Home, Menu, PenLine, Route, Search, User, Volume2, VolumeX } from "lucide-react";
import { NateGlyph } from "@/components/cm/mark";
import { navItems } from "@/lib/nav";
import {
    JOURNEY_DAYS,
    JOURNEY_END,
    JOURNEY_START,
    daysUntil,
    getUpNext,
    progressBetween,
} from "@/lib/timeline-data";
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

function openMenu() {
    window.dispatchEvent(new Event("cm:menu"));
}

const SEGS = 24;

interface Readout {
    pct: number;
    /** Day of the plan, counting the start day as day 1. */
    day: number;
    next: { title: string; days: number } | null;
}

/** Reads the plan's clock after mount, so the server render and the first client render agree. */
function useReadout(initialPct: number): Readout {
    const [r, setR] = useState<Readout>({ pct: initialPct, day: 0, next: null });
    useEffect(() => {
        const now = Date.now();
        const n = getUpNext(1, now)[0];
        setR({
            pct: Math.round(progressBetween(JOURNEY_START, JOURNEY_END, now) * 100),
            day: Math.max(0, 1 - daysUntil(JOURNEY_START, now)),
            next: n ? { title: n.title, days: Math.max(0, daysUntil(n.start, now)) } : null,
        });
    }, []);
    return r;
}

/** The top-right readout: day of the plan, the next step, and a segmented bar that fills with the journey. */
function Journey({ initialPct }: { initialPct: number }) {
    const r = useReadout(initialPct);
    const lit = Math.round((r.pct / 100) * SEGS);
    return (
        <div
            className="nv-journey"
            role="img"
            aria-label={`${r.pct} percent through the plan to May 2031. Day ${r.day}.`}
            title="Progress along the plan, Sept 2026 to May 2031"
        >
            <div className="nv-jrow" aria-hidden="true">
                <span className="nv-jday">
                    day <b>{r.day}</b>
                    <em>/ {JOURNEY_DAYS.toLocaleString("en-US")}</em>
                </span>
                {r.next && (
                    <span className="nv-jnext" title={`Next: ${r.next.title}`}>
                        {r.next.days === 0 ? "due today" : `next in ${r.next.days}d`}
                    </span>
                )}
            </div>
            <div className="nv-segs" aria-hidden="true">
                {Array.from({ length: SEGS }, (_, i) => (
                    <i key={i} className={i < lit ? "on" : undefined} data-head={i === lit - 1 ? "" : undefined} />
                ))}
            </div>
        </div>
    );
}

/**
 * Top status strip: menu and brand on the left, journey readout, search and sound on the right. Sticky. Once the page
 * scrolls, the strip fades and the two clusters float on their own, with the page showing through the middle.
 */
/** True once the page has scrolled away from the top. Reads on scroll frames, so it costs one state change per edge. */
function useScrolled(threshold = 40): boolean {
    const [on, setOn] = useState(false);
    useEffect(() => {
        let frame = 0;
        const read = () => {
            frame = 0;
            setOn(window.scrollY > threshold);
        };
        const onScroll = () => {
            if (!frame) frame = window.requestAnimationFrame(read);
        };
        read();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            window.removeEventListener("scroll", onScroll);
            if (frame) window.cancelAnimationFrame(frame);
        };
    }, [threshold]);
    return on;
}

export function Bar({ initialPct }: { initialPct: number }) {
    const path = usePathname();
    const [mounted, setMounted] = useState(false);
    const [snd, setSnd] = useSoundPrefs();
    const scrolled = useScrolled();

    useEffect(() => setMounted(true), []);

    return (
        <header className="nv-top" data-scrolled={scrolled ? "" : undefined}>
            <div className="nv-start">
                <button type="button" className="nv-menu-btn" onClick={openMenu} aria-label="Open site map" aria-haspopup="dialog">
                    <Menu aria-hidden="true" size={17} strokeWidth={2} />
                    <span>menu</span>
                </button>
                <Link className="nv-brand" href="/" aria-label="Nate Anderson, home">
                    <NateGlyph size={20} />
                    <b>nate anderson</b>
                </Link>
            </div>
            <div className="nv-tools">
                <Journey initialPct={initialPct} />
                <button type="button" className="nv-search" onClick={openLauncher} aria-label="Search the site">
                    <Search aria-hidden="true" size={15} strokeWidth={2} />
                    <span>search</span>
                    <kbd className="nv-key" aria-hidden="true">/</kbd>
                </button>
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
