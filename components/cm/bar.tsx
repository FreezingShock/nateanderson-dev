"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { openConsole } from "@/components/cm/console-entry";
import { PIXEL_FOR, PixelIcon } from "@/components/cm/pixel-icons";
import { NateGlyph } from "@/components/cm/mark";
import { navItems } from "@/lib/nav";
import { useSoundPrefs } from "@/lib/sound/use-sound";
import { sfx } from "@/lib/sound/sounds";

const isActive = (path: string, href: string) =>
    href === "/" ? path === "/" : path === href || path.startsWith(href + "/");

export function openLauncher() {
    window.dispatchEvent(new Event("cm:launcher"));
}

function openMenu() {
    window.dispatchEvent(new Event("cm:menu"));
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

export function Bar() {
    const path = usePathname();
    const [mounted, setMounted] = useState(false);
    const [snd, setSnd] = useSoundPrefs();
    const scrolled = useScrolled();

    useEffect(() => setMounted(true), []);

    return (
        <header className="nv-top" data-scrolled={scrolled ? "" : undefined}>
            <div className="nv-start">
                <button type="button" className="nv-menu-btn" onClick={openMenu} aria-label="Menu, open site map" aria-haspopup="dialog">
                    <PixelIcon name="menu" size={24} />
                    <span>menu</span>
                </button>
                <Link className="nv-brand" href="/" aria-label="Nate Anderson, home">
                    <NateGlyph size={20} />
                    <b>nate anderson</b>
                </Link>
            </div>
            <div className="nv-tools">
                <button type="button" className="nv-search" onClick={openLauncher} aria-label="Search the site" aria-haspopup="dialog">
                    <PixelIcon name="search" size={24} />
                    <span>search</span>
                    <kbd className="nv-key" aria-hidden="true">/</kbd>
                </button>
                <button type="button" className="nv-term" onClick={openConsole} aria-label="Open the command console" aria-haspopup="dialog">
                    <PixelIcon name="terminal" size={24} />
                    <span>console</span>
                    <kbd className="nv-key" aria-hidden="true">`</kbd>
                </button>
                <button
                    type="button"
                    className="nv-snd"
                    data-snd="off"
                    aria-pressed={mounted ? snd.on : true}
                    aria-label={mounted && !snd.on ? "Sound off, unmute" : "Sound on, mute"}
                    onClick={() => {
                        setSnd({ on: !snd.on });
                        if (!snd.on) setTimeout(() => sfx("on"), 40);
                    }}
                >
                    {mounted && !snd.on ? <PixelIcon name="volumeOff" size={24} /> : <PixelIcon name="volumeOn" size={24} />}
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

    // When the plate moves, remember where from and how far. The plate's travel time grows with distance, and a dither
    // wake is drawn across the tabs it crossed. Derived during render so the first committed frame already has them.
    const [last, setLast] = useState(idx);
    const [dist, setDist] = useState(1);
    const [wake, setWake] = useState<{ from: number; to: number; k: number } | null>(null);
    if (idx !== last) {
        setLast(idx);
        if (idx >= 0 && last >= 0) {
            setDist(Math.abs(idx - last));
            setWake({ from: last, to: idx, k: (wake?.k ?? 0) + 1 });
        }
    }
    const lo = wake ? Math.min(wake.from, wake.to) : 0;
    const span = wake ? Math.abs(wake.to - wake.from) + 1 : 1;

    return (
        <nav
            className="cm-dock"
            aria-label="Primary"
            data-pending={next ? "" : undefined}
            style={{ ["--tabs" as string]: navItems.length, ["--i" as string]: Math.max(idx, 0), ["--dist" as string]: dist } as CSSProperties}
        >
            {wake && (
                <b
                    key={wake.k}
                    className="wake"
                    aria-hidden="true"
                    data-dir={wake.to > wake.from ? "r" : "l"}
                    style={{ ["--lo" as string]: lo, ["--span" as string]: span } as CSSProperties}
                    onAnimationEnd={() => setWake(null)}
                />
            )}
            <i className="ind" aria-hidden="true" data-off={idx < 0 ? "" : undefined} />
            {navItems.map((n) => (
                <Link
                    key={n.href}
                    href={n.href}
                    aria-current={isActive(path, n.href) ? "page" : undefined}
                    data-on={isActive(target, n.href) ? "" : undefined}
                    onClick={() => setNext(isActive(path, n.href) ? null : n.href)}
                >
                    <PixelIcon name={PIXEL_FOR[n.href] ?? "home"} className="ic" />
                    <span>{n.label}</span>
                </Link>
            ))}
        </nav>
    );
}
