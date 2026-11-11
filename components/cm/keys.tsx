"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { navItems } from "@/lib/nav";
import { navigateWithCurtain } from "@/lib/motion/navigate";
import "./keys.css";

/** How long a `g` press waits for its section number. */
const CHORD_MS = 1500;

const isActive = (path: string, href: string) =>
    href === "/" ? path === "/" : path === href || path.startsWith(href + "/");

/** True while a text field has focus. Shortcuts stay out of the way so typing always works. */
const isTyping = (t: EventTarget | null) => {
    const el = t as HTMLElement | null;
    return !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
};

/** The cheat sheet. Keep it to keys the site really handles. */
type Row = { keys: string[]; sep?: string; label: string };
const GROUPS: { title: string; rows: Row[] }[] = [
    {
        title: "Anywhere",
        rows: [
            { keys: ["/"], label: "Search the site" },
            { keys: ["Ctrl / ⌘", "K"], sep: "+", label: "Search, even while a field has focus" },
            { keys: ["`"], label: "Open the command console" },
            { keys: ["Ctrl / ⌘", "J"], sep: "+", label: "Open the command console, even while a field has focus" },
            { keys: ["?"], label: "Show this list" },
            { keys: ["Esc"], label: "Close the panel that is open" },
        ],
    },
    {
        title: "Go to",
        rows: [
            { keys: ["g", "0–6"], sep: "then", label: "Go to a section. The numbers match the site map." },
            { keys: ["[", "]"], sep: "or", label: "Previous or next section. The list wraps at the ends." },
        ],
    },
    {
        title: "Move around",
        rows: [
            { keys: ["Tab"], label: "Move between links and buttons. Shift + Tab goes back." },
            { keys: ["Enter"], label: "Open the focused link or press the focused button." },
            { keys: ["↑", "↓"], sep: "or", label: "Move through search results, then Enter to go." },
        ],
    },
];

/**
 * Site-wide keyboard shortcuts. Registers one window listener and opens the cheat sheet on `?` or the `cm:keys` event.
 *
 * Single keys are never taken from a game or a field. The Flag Guesser already uses 1 to 6 to pick answers, so section
 * jumps use a `g` prefix, and `[` / `]` step through the sections in menu order. Nothing fires while another panel is
 * open, and the existing keys (`/`, the backtick, Ctrl/⌘+K, Ctrl/⌘+J, Esc) are untouched.
 */
export function KeyboardShortcuts() {
    const path = usePathname();
    const [open, setOpen] = useState(false);
    const returnTo = useRef<HTMLElement | null>(null);
    const panel = useRef<HTMLElement>(null);
    // When the last key was a `g`, so the next digit can complete the jump.
    const chord = useRef(0);

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
            if (e.isComposing) return;

            if (open) {
                if (e.key === "Escape" || e.key === "?") {
                    e.preventDefault();
                    hide();
                }
                return;
            }

            if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) {
                chord.current = 0;
                return;
            }
            // Another panel (search, site map, console) owns the keys while it is open.
            if (document.querySelector(".nv-scrim")) {
                chord.current = 0;
                return;
            }

            const key = e.key;
            const now = Date.now();

            if (chord.current && now - chord.current < CHORD_MS && /^[0-6]$/.test(key)) {
                chord.current = 0;
                const target = navItems[Number(key)];
                if (target) {
                    e.preventDefault();
                    navigateWithCurtain(target.href);
                }
                return;
            }
            chord.current = 0;

            if (key.toLowerCase() === "g") {
                // No preventDefault: a game that starts typing on a plain letter still gets it.
                chord.current = now;
                return;
            }
            if (key === "?") {
                e.preventDefault();
                show();
                return;
            }
            if (key === "[" || key === "]") {
                const n = navItems.length;
                const cur = navItems.findIndex((x) => isActive(window.location.pathname, x.href));
                const next = key === "]" ? (cur + 1) % n : cur <= 0 ? n - 1 : cur - 1;
                e.preventDefault();
                navigateWithCurtain(navItems[next].href);
            }
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener("cm:keys", show);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("cm:keys", show);
        };
    }, [open, show, hide]);

    // A route change closes the sheet, like the other panels.
    useEffect(() => setOpen(false), [path]);

    // Focus the close button and lock the page behind the sheet.
    useEffect(() => {
        if (!open) return;
        panel.current?.querySelector<HTMLElement>(".nv-close")?.focus();
        const prev = document.documentElement.style.overflow;
        document.documentElement.style.overflow = "hidden";
        return () => {
            document.documentElement.style.overflow = prev;
        };
    }, [open]);

    if (!open) return null;

    // The close button and the scrolling list are the only stops, so Tab cycles between them.
    const onPanelKey = (e: ReactKeyboardEvent<HTMLElement>) => {
        if (e.key !== "Tab") return;
        const first = e.currentTarget.querySelector<HTMLElement>(".nv-close");
        const last = e.currentTarget.querySelector<HTMLElement>(".nv-keys-body");
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    };

    return (
        <div
            className="nv-scrim"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) hide();
            }}
        >
            <section
                className="nv-panel nv-keys"
                role="dialog"
                aria-modal="true"
                aria-labelledby="nv-keys-title"
                ref={panel}
                onKeyDown={onPanelKey}
            >
                <div className="nv-head">
                    <span id="nv-keys-title">shortcuts // keyboard</span>
                    <button type="button" className="nv-close" onClick={hide} aria-label="Close shortcuts">
                        <kbd className="nv-key">esc</kbd>
                    </button>
                </div>
                <div className="nv-keys-body" role="region" aria-label="Keyboard shortcuts" tabIndex={0}>
                    {GROUPS.map((g) => (
                        <section key={g.title} className="nv-keys-group">
                            <h2 className="nv-keys-h">{g.title}</h2>
                            <dl className="nv-keys-list">
                                {g.rows.map((r) => (
                                    <div key={r.label} className="nv-keys-row">
                                        <dt>
                                            {r.keys.map((k, i) => (
                                                <span key={k + i} className="nv-keys-cap">
                                                    {i > 0 && r.sep && <span className="nv-keys-sep" aria-hidden="true">{r.sep}</span>}
                                                    <kbd className="nv-key">{k}</kbd>
                                                </span>
                                            ))}
                                        </dt>
                                        <dd>{r.label}</dd>
                                    </div>
                                ))}
                            </dl>
                        </section>
                    ))}
                    <p className="nv-keys-note">
                        Shortcuts pause while you type in a field. On a phone, use the menu, search and console buttons in the top bar.
                    </p>
                </div>
            </section>
        </div>
    );
}

/** A footer button that opens the same sheet, so the list is reachable without a keyboard. */
export function ShortcutsButton() {
    return (
        <button
            type="button"
            className="cm-keys-btn"
            aria-haspopup="dialog"
            onClick={() => window.dispatchEvent(new Event("cm:keys"))}
        >
            <kbd className="nv-key" aria-hidden="true">?</kbd>
            <span>keyboard shortcuts</span>
        </button>
    );
}
