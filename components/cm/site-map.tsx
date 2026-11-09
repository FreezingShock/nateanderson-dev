"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { X } from "lucide-react";
import { navItems } from "@/lib/nav";
import { openLauncher } from "@/components/cm/bar";

const isActive = (path: string, href: string) =>
    href === "/" ? path === "/" : path === href || path.startsWith(href + "/");

/**
 * The hamburger menu: the whole site as a hierarchy (sections, then their subpages). Opens from the header or the
 * `cm:menu` event. Esc or a tap outside closes it, and so does any navigation. Focus returns to the button.
 */
export function SiteMap() {
    const path = usePathname();
    const { theme, setTheme } = useTheme();
    const [open, setOpen] = useState(false);
    const returnTo = useRef<HTMLElement | null>(null);
    const panel = useRef<HTMLElement>(null);

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

    return (
        <div
            className="nv-scrim"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) hide();
            }}
        >
            <nav className="nv-panel nv-map" ref={panel} role="dialog" aria-modal="true" aria-label="Site map">
                <div className="nv-head">
                    <span>site map // {navItems.length} sections</span>
                    <button type="button" className="nv-x" onClick={hide} aria-label="Close site map">
                        <X aria-hidden="true" size={15} strokeWidth={2} />
                    </button>
                </div>
                <ol className="nv-tree">
                    {navItems.map((n) => {
                        const on = isActive(path, n.href);
                        return (
                            <li key={n.href} className="nv-sec-row" data-on={on ? "" : undefined}>
                                <Link href={n.href} className="nv-sec" aria-current={on ? "page" : undefined}>
                                    <span className="nv-ix">{n.no}</span>
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
                <div className="nv-map-theme" role="group" aria-label="Theme">
                    <span>theme</span>
                    <button type="button" aria-pressed={theme !== "paper"} onClick={() => setTheme("dark")}>dark</button>
                    <button type="button" aria-pressed={theme === "paper"} onClick={() => setTheme("paper")}>paper</button>
                </div>
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
