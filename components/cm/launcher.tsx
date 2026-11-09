"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { launcherLinks, navItems } from "@/lib/nav";
import { navigateWithCurtain } from "@/lib/motion/navigate";

interface Entry {
    href: string;
    label: string;
    /** Two-digit index for pages, a mark for deep links. */
    ix: string;
    /** Small line under the label. */
    hint: string;
    group: string;
}

const PAGE_GROUP = "Pages";

/** `/` search: jump to any page, game or section. Esc closes, arrows + Enter pick. Results are grouped. */
export function Launcher() {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const [sel, setSel] = useState(0);
    const input = useRef<HTMLInputElement>(null);
    const returnTo = useRef<HTMLElement | null>(null);

    // Pages first, then the curated deep links in their groups, then any section subpage the curated list leaves out.
    const entries = useMemo<Entry[]>(() => {
        const curated = new Set(launcherLinks.map((l) => l.href));
        return [
            ...navItems.map((n) => ({ href: n.href, label: n.title, ix: n.no, hint: n.blurb, group: PAGE_GROUP })),
            ...launcherLinks.map((l) => ({ href: l.href, label: l.label, ix: "›", hint: "", group: l.group })),
            ...navItems.flatMap((n) =>
                (n.children ?? [])
                    .filter((c) => !curated.has(c.href))
                    .map((c) => ({ href: c.href, label: c.label, ix: "›", hint: n.title, group: n.title })),
            ),
        ];
    }, []);

    const shown = useMemo(() => {
        const v = q.trim().toLowerCase();
        return v ? entries.filter((e) => (e.label + " " + e.hint + " " + e.group).toLowerCase().includes(v)) : entries;
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

    // Keep the highlighted row in view while arrowing through a long list.
    useEffect(() => {
        if (!open) return;
        document.querySelector<HTMLElement>(".nv-list [data-sel]")?.scrollIntoView({ block: "nearest" });
    }, [sel, open]);

    if (!open) return null;
    const go = (href: string) => {
        setOpen(false);
        navigateWithCurtain(href);
    };

    let lastGroup = "";

    return (
        <div
            className="nv-scrim"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) hide();
            }}
        >
            <div className="nv-panel" role="dialog" aria-modal="true" aria-label="Search the site">
                <div className="nv-head">
                    <span>search // jump to</span>
                    <kbd className="nv-key">esc</kbd>
                </div>
                <div className="nv-input">
                    <span className="nv-prompt" aria-hidden="true">&gt;</span>
                    <input
                        ref={input}
                        value={q}
                        placeholder="a page, game, course or section"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        aria-label="Search the site"
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
                <ul className="nv-list">
                    {shown.map((e, i) => {
                        const head = e.group !== lastGroup;
                        lastGroup = e.group;
                        return (
                            <li key={e.href} className="nv-item">
                                {head && <div className="nv-group" aria-hidden="true">{e.group}</div>}
                                <Link
                                    href={e.href}
                                    data-sel={i === sel ? "" : undefined}
                                    className={i === sel ? "on" : undefined}
                                    onMouseEnter={() => setSel(i)}
                                    onClick={() => setOpen(false)}
                                >
                                    <span className="nv-ix">{e.ix}</span>
                                    <span className="nv-txt">
                                        <b>{e.label}</b>
                                        {e.hint && <small>{e.hint}</small>}
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                    {shown.length === 0 && (
                        <li className="nv-empty">Nothing matches “{q}”.</li>
                    )}
                </ul>
                <div className="nv-foot">
                    <span>↑ ↓ move</span>
                    <span>↵ open</span>
                    <span>esc close</span>
                </div>
            </div>
        </div>
    );
}
