"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { launcherLinks, navItems } from "@/lib/nav";
import { navigateWithCurtain } from "@/lib/motion/navigate";

interface Entry {
    href: string;
    label: string;
    meta: string;
}

/** `/` command launcher: jump to any page, game or section. Esc closes, arrows + Enter pick. */
export function Launcher() {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const [sel, setSel] = useState(0);
    const input = useRef<HTMLInputElement>(null);
    const returnTo = useRef<HTMLElement | null>(null);

    const entries = useMemo<Entry[]>(
        () => [
            ...navItems.map((n) => ({ href: n.href, label: n.title, meta: n.no })),
            ...launcherLinks.map((l) => ({ href: l.href, label: l.label, meta: l.group })),
        ],
        [],
    );
    const shown = useMemo(() => {
        const v = q.trim().toLowerCase();
        return v ? entries.filter((e) => (e.label + " " + e.meta).toLowerCase().includes(v)) : entries;
    }, [entries, q]);

    const show = useCallback(() => {
        returnTo.current = document.activeElement as HTMLElement | null;
        setQ("");
        setSel(0);
        setOpen(true);
    }, []);
    const hide = useCallback(() => {
        setOpen(false);
        returnTo.current?.focus?.();
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            const typing = !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
            if (e.key === "/" && !open && !typing && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                show();
            } else if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                open ? hide() : show();
            } else if (e.key === "Escape" && open) {
                hide();
            }
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener("cm:launcher", show);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("cm:launcher", show);
        };
    }, [open, show, hide]);

    useEffect(() => {
        if (open) input.current?.focus();
    }, [open]);

    if (!open) return null;
    const go = (href: string) => {
        setOpen(false);
        navigateWithCurtain(href);
    };

    return (
        <div
            className="cm-scrim"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) hide();
            }}
        >
            <div className="cm-panel solid" role="dialog" aria-modal="true" aria-label="Jump to a page">
                <div className="cm-hbar">
                    <span>Launcher</span>
                    <span><span className="cm-kbd" style={{ borderColor: "#aab", color: "#4a565c" }}>ESC</span></span>
                </div>
                <div className="cm-launch-input">
                    <span style={{ color: "var(--cm-cyan)" }}>&gt;</span>
                    <input
                        ref={input}
                        value={q}
                        placeholder="Jump to a page, game or section"
                        autoComplete="off"
                        aria-label="Search the site"
                        style={{ fontSize: 16 }}
                        onChange={(e) => {
                            setQ(e.target.value);
                            setSel(0);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "ArrowDown") {
                                e.preventDefault();
                                setSel((s) => Math.min(shown.length - 1, s + 1));
                            } else if (e.key === "ArrowUp") {
                                e.preventDefault();
                                setSel((s) => Math.max(0, s - 1));
                            } else if (e.key === "Enter" && shown[sel]) {
                                e.preventDefault();
                                go(shown[sel].href);
                            }
                        }}
                    />
                </div>
                <ul className="cm-list">
                    {shown.map((e, i) => (
                        <li key={e.href}>
                            <Link href={e.href} className={i === sel ? "on" : ""} onClick={() => setOpen(false)}>
                                {e.label} <small>{e.meta}</small>
                            </Link>
                        </li>
                    ))}
                    {shown.length === 0 && (
                        <li><span className="cm-body-pad cm-note" style={{ display: "block" }}>Nothing matches “{q}”.</span></li>
                    )}
                </ul>
            </div>
        </div>
    );
}
