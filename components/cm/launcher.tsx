"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { launcherLinks, navItems } from "@/lib/nav";
import { PIXEL_FOR, PixelIcon } from "@/components/cm/pixel-icons";
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

/** Wraps the part of a label that matches the query. */
function mark(label: string, term: string) {
    const at = term ? label.toLowerCase().indexOf(term) : -1;
    if (at < 0) return label;
    return (
        <>
            {label.slice(0, at)}
            <mark>{label.slice(at, at + term.length)}</mark>
            {label.slice(at + term.length)}
        </>
    );
}

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

    const term = q.trim().toLowerCase();
    // With a query, results are ranked (label starts with it, label contains it, then hint or group) and shown flat.
    const shown = useMemo(() => {
        if (!term) return entries;
        const rank = (e: Entry) => {
            const l = e.label.toLowerCase();
            if (l.startsWith(term)) return 0;
            if (l.split(/[\s&/-]+/).some((w) => w.startsWith(term))) return 1;
            if (l.includes(term)) return 2;
            return (e.hint + " " + e.group).toLowerCase().includes(term) ? 3 : 4;
        };
        return entries
            .map((e, i) => ({ e, i, r: rank(e) }))
            .filter((x) => x.r < 4)
            .sort((a, b) => a.r - b.r || a.i - b.i)
            .map((x) => x.e);
    }, [entries, term]);

    // `cm:launcher` can carry `{ q }` (the console's `search <words>`) to open with the box already filled in.
    const show = useCallback((e?: Event) => {
        returnTo.current = document.activeElement as HTMLElement | null;
        setQ((e as CustomEvent<{ q?: string }> | undefined)?.detail?.q ?? "");
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

    // Lock page scroll behind the panel.
    useEffect(() => {
        if (!open) return;
        const prev = document.documentElement.style.overflow;
        document.documentElement.style.overflow = "hidden";
        return () => {
            document.documentElement.style.overflow = prev;
        };
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
            <div
                className="nv-panel nv-find"
                role="dialog"
                aria-modal="true"
                aria-label="Search the site"
                onKeyDown={(e) => {
                    // Keep Tab inside the panel: search field and close button.
                    if (e.key !== "Tab") return;
                    const first = input.current;
                    const last = e.currentTarget.querySelector<HTMLElement>(".nv-close");
                    if (!first || !last) return;
                    if (e.shiftKey && document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    } else if (!e.shiftKey && document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }}
            >
                <div className="nv-head">
                    <span>search // jump to</span>
                    <span className="nv-count" aria-live="polite">
                        {term ? `${shown.length} ${shown.length === 1 ? "match" : "matches"}` : `${shown.length} places`}
                    </span>
                    <button type="button" className="nv-close" onClick={hide} aria-label="Close search">
                        <kbd className="nv-key">esc</kbd>
                    </button>
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
                        role="combobox"
                        aria-expanded="true"
                        aria-controls="nv-results"
                        aria-activedescendant={shown[sel] ? `nv-opt-${sel}` : undefined}
                        enterKeyHint="go"
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
                <ul className="nv-list" id="nv-results" role="listbox" aria-label="Results">
                    {shown.map((e, i) => {
                        const head = !term && e.group !== lastGroup;
                        lastGroup = e.group;
                        return (
                            <li key={e.href} className="nv-item" role="presentation">
                                {head && <div className="nv-group" aria-hidden="true">{e.group}</div>}
                                <Link
                                    href={e.href}
                                    id={`nv-opt-${i}`}
                                    role="option"
                                    aria-selected={i === sel}
                                    tabIndex={-1}
                                    data-sel={i === sel ? "" : undefined}
                                    className={i === sel ? "on" : undefined}
                                    onMouseEnter={() => setSel(i)}
                                    onClick={() => setOpen(false)}
                                >
                                    <span className="nv-ix">{PIXEL_FOR[e.href] && e.group === PAGE_GROUP ? <PixelIcon name={PIXEL_FOR[e.href]} size={24} /> : <PixelIcon name="chevR" size={16} />}</span>
                                    <span className="nv-txt">
                                        <b>{mark(e.label, term)}</b>
                                        {e.hint && <small>{e.hint}</small>}
                                    </span>
                                    {term && <span className="nv-grp">{e.group}</span>}
                                </Link>
                            </li>
                        );
                    })}
                    {shown.length === 0 && (
                        <li className="nv-empty" role="presentation">Nothing matches “{q.trim()}”.</li>
                    )}
                </ul>
                <div className="nv-foot" aria-hidden="true">
                    <span><kbd className="nv-key">↑</kbd><kbd className="nv-key">↓</kbd>move</span>
                    <span><kbd className="nv-key">↵</kbd>open</span>
                    <span><kbd className="nv-key">esc</kbd>close</span>
                </div>
            </div>
        </div>
    );
}
