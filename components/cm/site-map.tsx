"use client";

import { PIXEL_FOR, PixelIcon } from "@/components/cm/pixel-icons";
import { Typed } from "@/components/cm/typed";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { navItems, type NavItem } from "@/lib/nav";
import { openLauncher } from "@/components/cm/bar";
import { useBackdropScrollLock } from "@/components/cm/scrim-lock";
import { sfx } from "@/lib/sound/sounds";

const isActive = (path: string, href: string) =>
    href === "/" ? path === "/" : path === href || path.startsWith(href + "/");

const kidsId = (href: string) => `nv-kids-${href.replace(/[^a-z0-9]+/gi, "-")}`;

/** Where you are, read like a path: nate / studies / ap biology. */
function trail(path: string): string[] {
    const sec = navItems.find((n) => isActive(path, n.href));
    if (!sec || sec.href === "/") return ["nate", "home"];
    const kid = sec.children?.find((c) => c.href === path);
    return ["nate", sec.label.toLowerCase(), ...(kid ? [kid.label.toLowerCase()] : [])];
}

/**
 * The hamburger menu: the whole site as a tree. Each section opens to show its pages (the open one is the section you
 * are in). The list types itself in from code as it opens. Esc, a tap outside or a left flick closes it, and so does
 * any navigation. Arrow keys move between entries. Focus returns to the button.
 */
export function SiteMap() {
    const path = usePathname();
    const [open, setOpen] = useState(false);
    // Manual expand/collapse per section. A section with no entry follows the page you are on.
    const [toggled, setToggled] = useState<Record<string, boolean>>({});
    const returnTo = useRef<HTMLElement | null>(null);
    const panel = useRef<HTMLElement>(null);
    const scrim = useRef<HTMLDivElement>(null);
    const swipe = useRef<{ x: number; y: number } | null>(null);
    useBackdropScrollLock(scrim, open);

    const show = useCallback(() => {
        returnTo.current = document.activeElement as HTMLElement | null;
        setToggled({});
        setOpen(true);
    }, []);
    const hide = useCallback(() => {
        setOpen(false);
        returnTo.current?.focus?.();
    }, []);

    useEffect(() => {
        const onKey = (e: globalThis.KeyboardEvent) => {
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

    // The panel's own open and close scans (the buttons that open it are silent).
    const sounded = useRef(false);
    useEffect(() => {
        if (open === sounded.current) return;
        sounded.current = open;
        sfx(open ? "open" : "close");
    }, [open]);

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

    const isOpen = (n: NavItem) => toggled[n.href] ?? isActive(path, n.href);
    const crumbs = trail(path);

    // Arrow keys walk every entry in reading order, the way a file tree does.
    const onNavKey = (e: KeyboardEvent<HTMLElement>) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
        const items = Array.from(panel.current?.querySelectorAll<HTMLElement>(".nv-tree a[href], .nv-caret, .nv-map-search") ?? []);
        if (!items.length) return;
        const i = items.indexOf(document.activeElement as HTMLElement);
        const last = items.length - 1;
        const next =
            e.key === "Home" ? 0 :
            e.key === "End" ? last :
            e.key === "ArrowDown" ? (i < 0 ? 0 : Math.min(last, i + 1)) :
            i < 0 ? last : Math.max(0, i - 1);
        e.preventDefault();
        items[next].focus();
        items[next].scrollIntoView({ block: "nearest" });
    };

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
                onKeyDown={onNavKey}
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
                    <button type="button" className="nv-x" data-snd="off" onClick={hide} aria-label="Close site map">
                        <PixelIcon name="close" size={24} />
                    </button>
                </div>
                <div className="nv-where">
                    <span>you are here</span>
                    <b>{crumbs.join(" / ")}</b>
                </div>
                <div className="nv-scroll">
                    <div className="nv-code" aria-hidden="true">
                        <Typed text='<nav aria-label="site map">' />
                    </div>
                    <ol className="nv-tree">
                        {navItems.map((n, i) => {
                            const on = isActive(path, n.href);
                            const expanded = n.children ? isOpen(n) : false;
                            return (
                                <li
                                    key={n.href}
                                    className="nv-sec-row"
                                    data-on={on ? "" : undefined}
                                    style={{ "--i": i } as CSSProperties}
                                >
                                    <div className="nv-sec-line">
                                        <Link href={n.href} className="nv-sec" aria-current={on ? "page" : undefined}>
                                            <span className="nv-no" aria-hidden="true">{n.no}</span>
                                            <span className="nv-ix" style={{ "--d": `${120 + i * 70}ms` } as CSSProperties}>
                                                <PixelIcon name={PIXEL_FOR[n.href] ?? "home"} size={24} />
                                            </span>
                                            <span className="nv-sec-body">
                                                <span className="nv-sec-t">
                                                    <span className="sr-only">{n.title}</span>
                                                    <Typed text={n.title} delay={60 + i * 70} />
                                                </span>
                                                {!n.title.toLowerCase().includes(n.label.toLowerCase()) && <small>{n.label}</small>}
                                            </span>
                                        </Link>
                                        {n.children && (
                                            <button
                                                type="button"
                                                className="nv-caret"
                                                aria-expanded={expanded}
                                                aria-controls={kidsId(n.href)}
                                                aria-label={`${expanded ? "Hide" : "Show"} the ${n.children.length} pages in ${n.title}`}
                                                onClick={() => setToggled((t) => ({ ...t, [n.href]: !expanded }))}
                                            >
                                                <span className="nv-caret-n" aria-hidden="true">{n.children.length}</span>
                                                <span className="nv-caret-t" aria-hidden="true">pages</span>
                                                <PixelIcon name={expanded ? "minus" : "plus"} size={16} />
                                            </button>
                                        )}
                                    </div>
                                    {n.children && expanded && (
                                        <ul className="nv-kids" id={kidsId(n.href)}>
                                            {n.children.map((c, j) => {
                                                const here = path === c.href;
                                                return (
                                                    <li key={c.href}>
                                                        <Link
                                                            href={c.href}
                                                            aria-current={here ? "page" : undefined}
                                                            style={{ "--d": `${60 + j * 35}ms` } as CSSProperties}
                                                        >
                                                            <PixelIcon name={c.icon ?? "chevR"} size={16} className="nv-kid-ic" />
                                                            <span className="sr-only">{c.label}</span>
                                                            <Typed text={c.label} delay={j * 35} />
                                                        </Link>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                    <div className="nv-code nv-code-end" aria-hidden="true">{"</nav>"}</div>
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
