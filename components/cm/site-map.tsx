"use client";

import { PIXEL_FOR, PixelIcon } from "@/components/cm/pixel-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { navItems } from "@/lib/nav";
import { openLauncher } from "@/components/cm/bar";
import { useBackdropScrollLock } from "@/components/cm/scrim-lock";

const isActive = (path: string, href: string) =>
    href === "/" ? path === "/" : path === href || path.startsWith(href + "/");

/**
 * The hamburger menu: the whole site as a hierarchy (sections, then their subpages). Opens from the header or the
 * `cm:menu` event. Esc or a tap outside closes it, and so does any navigation. Focus returns to the button.
 */
export function SiteMap() {
    const path = usePathname();
    const [open, setOpen] = useState(false);
    const returnTo = useRef<HTMLElement | null>(null);
    const panel = useRef<HTMLElement>(null);
    const scrim = useRef<HTMLDivElement>(null);
    const swipe = useRef<{ x: number; y: number } | null>(null);
    useBackdropScrollLock(scrim, open);

    const show = useCallback(() => {
        returnTo.current = document.activeElement as HTMLElement | null;
        setOpen(true);
    }, []);
    const hide = useCallback(() => {
        setOpen(false);
        returnTo.current?.focus?.();
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && open) hide();
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener("cm:menu", show);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("cm:menu", show);
        };
    }, [open, show, hide]);

    // Any route change closes the map.
    useEffect(() => setOpen(false), [path]);

    // Lock the page behind the map and move focus into it.
    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        panel.current?.querySelector<HTMLElement>("a, button")?.focus();
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    if (!open) return null;

    // The drawer slides in from the left, so a flick back to the left closes it. Only a mostly sideways drag counts,
    // so scrolling the list never closes it by accident.
    return (
        <div
            className="nv-scrim nv-scrim-drawer"
            ref={scrim}
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) hide();
            }}
        >
            <nav
                className="nv-panel nv-map"
                ref={panel}
                role="dialog"
                aria-modal="true"
                aria-label="Site map"
                onTouchStart={(e) => {
                    const t = e.touches[0];
                    swipe.current = { x: t.clientX, y: t.clientY };
                }}
                onTouchEnd={(e) => {
                    const start = swipe.current;
                    swipe.current = null;
                    if (!start) return;
                    const t = e.changedTouches[0];
                    const dx = t.clientX - start.x;
                    const dy = t.clientY - start.y;
                    if (dx < -60 && Math.abs(dx) > Math.abs(dy) * 1.5) hide();
                }}
            >
                <div className="nv-head">
                    <span>site map // {navItems.length} sections</span>
                    <button type="button" className="nv-x" onClick={hide} aria-label="Close site map">
                        <PixelIcon name="close" size={24} />
                    </button>
                </div>
                <ol className="nv-tree">
                    {navItems.map((n) => {
                        const on = isActive(path, n.href);
                        return (
                            <li key={n.href} className="nv-sec-row" data-on={on ? "" : undefined}>
                                <Link href={n.href} className="nv-sec" aria-current={on ? "page" : undefined}>
                                    <span className="nv-ix"><PixelIcon name={PIXEL_FOR[n.href] ?? "home"} size={24} /></span>
                                    <span className="nv-sec-t">{n.title}</span>
                                    <small>{n.label}</small>
                                </Link>
                                {n.children && (
                                    <ul className="nv-kids">
                                        {n.children.map((c) => (
                                            <li key={c.href}>
                                                <Link href={c.href} aria-current={path === c.href ? "page" : undefined}>
                                                    <span className="nv-kid-dash" aria-hidden="true" />
                                                    {c.label}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        );
                    })}
                </ol>
                <div className="nv-foot nv-map-foot">
                    <button
                        type="button"
                        className="nv-map-search"
                        onClick={() => {
                            setOpen(false);
                            openLauncher();
                        }}
                    >
                        search everything <kbd className="nv-key">/</kbd>
                    </button>
                </div>
            </nav>
        </div>
    );
}
