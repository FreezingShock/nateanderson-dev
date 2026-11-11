"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { launcherLinks, navItems } from "@/lib/nav";
import { allGames, GAME_STATUS } from "@/lib/creations-data";
import { PIXEL_FOR, PixelIcon, type PixelName } from "@/components/cm/pixel-icons";
import { navigateWithCurtain } from "@/lib/motion/navigate";
import { useBackdropScrollLock } from "@/components/cm/scrim-lock";
import { sfx } from "@/lib/sound/sounds";
import { openConsole } from "@/components/cm/console-entry";
import { fuzzyScore, type FuzzyHit } from "@/lib/search/fuzzy";
import { readRecent, rememberRecent, type RecentSearch } from "@/lib/search/recent";

// What the list can hold. Pages, games and site sections open a link. Console commands open the naOS console with the
// command typed in. Recent searches fill the box again.
type Kind = "link" | "cmd" | "query";

interface Entry {
    key: string;
    kind: Kind;
    /** Where a link goes. */
    href: string;
    /** The text the user sees, and the part that gets highlighted. */
    label: string;
    /** Small line under the label. */
    hint: string;
    group: string;
    /** Searched as well as the label, never shown or highlighted. */
    extra: string;
    /** Pixel icon for the leading mark. Without one, a small chevron. */
    pixel?: PixelName;
    /** Commands: the name and the usage line. */
    cmd?: string;
    usage?: string;
}

interface Row {
    e: Entry;
    hit?: FuzzyHit;
}

interface CmdIndex {
    name: string;
    usage: string;
    desc: string;
}

const PAGE_GROUP = "Pages";
const GAMES_GROUP = "Games";
const CONSOLE_GROUP = "Console";
const RECENT_PLACES = "Recent";
const RECENT_QUERIES = "Recent searches";

/** Loaded once per visit: the console's command list lives in the console chunk, which only loads when searched. */
let consoleCommands: CmdIndex[] | null = null;

/** Draws the label with the matched letters marked. `idx` are character positions in the label. */
function highlight(label: string, idx?: number[]): ReactNode {
    if (!idx?.length) return label;
    const on = new Set(idx);
    const out: ReactNode[] = [];
    let run = "";
    let marked = false;
    const flush = (at: number) => {
        if (!run) return;
        out.push(marked ? <mark key={`m${at}`}>{run}</mark> : <span key={`s${at}`}>{run}</span>);
        run = "";
    };
    Array.from(label).forEach((c, i) => {
        const m = on.has(i);
        if (m !== marked) {
            flush(i);
            marked = m;
        }
        run += c;
    });
    flush(label.length);
    return <>{out}</>;
}

/** `/` search: jump to any page, game, section or console command. Esc closes, arrows + Enter pick. */
export function Launcher() {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const [sel, setSel] = useState(0);
    const [recent, setRecent] = useState<RecentSearch>({ queries: [], places: [] });
    const [cmds, setCmds] = useState<CmdIndex[] | null>(consoleCommands);
    const input = useRef<HTMLInputElement>(null);
    const scrim = useRef<HTMLDivElement>(null);
    const returnTo = useRef<HTMLElement | null>(null);
    const loadingCmds = useRef(false);
    useBackdropScrollLock(scrim, open);

    const term = q.trim().toLowerCase();

    // Every place the search can reach. Pages first, then games (read from the games data, so new ones appear on their
    // own), then curated deep links, then the subpages the curated list leaves out. The first entry for an href wins.
    const places = useMemo<Entry[]>(() => {
        const out: Entry[] = [];
        const seen = new Set<string>();
        const add = (e: Entry) => {
            if (seen.has(e.href)) return;
            seen.add(e.href);
            out.push(e);
        };
        for (const n of navItems) {
            add({ key: `page:${n.href}`, kind: "link", href: n.href, label: n.title, hint: n.blurb, group: PAGE_GROUP, extra: n.label, pixel: PIXEL_FOR[n.href] });
        }
        for (const g of allGames()) {
            if (!g.href) continue; // planned games have no page yet
            add({
                key: `game:${g.href}`,
                kind: "link",
                href: g.href,
                label: g.title,
                hint: GAME_STATUS[g.status].label,
                group: GAMES_GROUP,
                extra: `game ${g.blurb}`,
            });
        }
        for (const l of launcherLinks) {
            add({ key: `link:${l.href}`, kind: "link", href: l.href, label: l.label, hint: "", group: l.group, extra: "" });
        }
        for (const n of navItems) {
            for (const c of n.children ?? []) {
                add({ key: `sec:${c.href}`, kind: "link", href: c.href, label: c.label, hint: n.title, group: n.title, extra: "" });
            }
        }
        return out;
    }, []);

    const commandEntries = useMemo<Entry[]>(
        () =>
            (cmds ?? []).map((c) => ({
                key: `cmd:${c.name}`,
                kind: "cmd",
                href: "",
                label: c.name,
                hint: c.usage,
                group: CONSOLE_GROUP,
                extra: `command console ${c.desc}`,
                cmd: c.name,
                usage: c.usage,
            })),
        [cmds],
    );

    // With no query: recent searches, recently opened places, then everything. With a query: every match, ranked.
    const shown = useMemo<Row[]>(() => {
        if (!term) {
            const rows: Row[] = recent.queries.slice(0, 3).map((s) => ({
                e: { key: `q:${s}`, kind: "query" as const, href: "", label: s, hint: "search again", group: RECENT_QUERIES, extra: "" },
            }));
            const opened = recent.places
                .map((h) => places.find((x) => x.href === h))
                .filter((x): x is Entry => !!x)
                .slice(0, 4);
            for (const p of opened) rows.push({ e: { ...p, key: `recent:${p.href}`, group: RECENT_PLACES } });
            return [...rows, ...places.map((e) => ({ e }))];
        }
        // Commands rank a little below places with the same match, so "history" opens the History page before the console.
        const ranked: { r: Row; rank: number; i: number }[] = [];
        [...places, ...commandEntries].forEach((e, i) => {
            const hit = fuzzyScore(term, e.label, `${e.hint} ${e.group} ${e.extra}`);
            if (hit) ranked.push({ r: { e, hit }, rank: hit.score * (e.kind === "cmd" ? 0.8 : 1), i });
        });
        return ranked.sort((a, b) => b.rank - a.rank || a.i - b.i).map((x) => x.r);
    }, [term, places, commandEntries, recent]);

    const show = useCallback(() => {
        returnTo.current = document.activeElement as HTMLElement | null;
        setQ("");
        setSel(0);
        setRecent(readRecent());
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
            // A game's guess box takes focus on desktop as soon as the page loads, so "/" would type into it. An empty
            // guess box is not a field anyone types a slash into, so "/" opens search there too.
            const emptyGuessBox =
                !!t &&
                t.tagName === "INPUT" &&
                t.getAttribute("role") === "combobox" &&
                (t as HTMLInputElement).value === "" &&
                !t.closest(".nv-panel, .cn-panel");
            if (e.key === "/" && !open && (!typing || emptyGuessBox) && !e.metaKey && !e.ctrlKey) {
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

    // The console's command list is fetched the first time someone searches. Nothing loads for people who never search.
    useEffect(() => {
        if (!open || !term || cmds || loadingCmds.current) return;
        loadingCmds.current = true;
        import("@/components/cm/console")
            .then((m) => {
                consoleCommands = m.CONSOLE_INDEX;
                setCmds(m.CONSOLE_INDEX);
            })
            .catch(() => {
                loadingCmds.current = false;
            });
    }, [open, term, cmds]);

    useEffect(() => {
        if (open) input.current?.focus();
    }, [open]);

    // Follow the visible area on phones: when the keyboard comes up, the search shrinks to the space left above it.
    useEffect(() => {
        const vv = window.visualViewport;
        const el = scrim.current;
        if (!open || !vv || !el) return;
        const fit = () => {
            el.style.setProperty("--nv-h", `${Math.round(vv.height)}px`);
            el.style.setProperty("--nv-top", `${Math.round(vv.offsetTop)}px`);
        };
        fit();
        vv.addEventListener("resize", fit);
        vv.addEventListener("scroll", fit);
        return () => {
            vv.removeEventListener("resize", fit);
            vv.removeEventListener("scroll", fit);
        };
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

    // The panel's own open and close scans (the buttons and keys that open it are silent).
    const sounded = useRef(false);
    useEffect(() => {
        if (open === sounded.current) return;
        sounded.current = open;
        sfx(open ? "open" : "close");
    }, [open]);

    // Keep the highlighted row in view while arrowing through a long list.
    useEffect(() => {
        if (!open) return;
        document.querySelector<HTMLElement>(".nv-list [data-sel]")?.scrollIntoView({ block: "nearest" });
    }, [sel, open]);

    /** Remembers the query (when there is one) and, for places, the place. */
    const commit = (e: Entry) => {
        if (term) rememberRecent("queries", q);
        if (e.kind === "link") rememberRecent("places", e.href);
    };

    const go = (e: Entry) => {
        if (e.kind === "query") {
            setQ(e.label);
            setSel(0);
            input.current?.focus();
            return;
        }
        commit(e);
        setOpen(false);
        if (e.kind === "cmd") {
            // Open the console with the command in the box. Enter runs it, so nothing happens by surprise.
            const text = e.cmd ?? e.label;
            openConsole(e.usage && e.usage.trim() !== text ? `${text} ` : text);
            return;
        }
        navigateWithCurtain(e.href);
    };

    if (!open) return null;

    let lastGroup = "";

    return (
        <div
            className="nv-scrim"
            ref={scrim}
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
                        placeholder="a page, game, command or section"
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
                                go(shown[sel].e);
                            }
                        }}
                    />
                </div>
                <ul className="nv-list" id="nv-results" role="listbox" aria-label="Results">
                    {shown.map(({ e, hit }, i) => {
                        const head = !term && e.group !== lastGroup;
                        lastGroup = e.group;
                        const icon = (
                            <span className="nv-ix">
                                {e.pixel ? <PixelIcon name={e.pixel} size={24} /> : <PixelIcon name="chevR" size={16} />}
                            </span>
                        );
                        const body = (
                            <span className="nv-txt">
                                <b>{term ? highlight(e.label, hit?.idx) : e.label}</b>
                                {e.hint && <small>{e.hint}</small>}
                            </span>
                        );
                        const common = {
                            id: `nv-opt-${i}`,
                            role: "option" as const,
                            "aria-selected": i === sel,
                            tabIndex: -1,
                            "data-sel": i === sel ? "" : undefined,
                            className: i === sel ? "on" : undefined,
                            onMouseEnter: () => setSel(i),
                        };
                        return (
                            <li key={e.key} className="nv-item" role="presentation">
                                {head && <div className="nv-group" aria-hidden="true">{e.group}</div>}
                                {e.kind === "link" ? (
                                    <Link href={e.href} {...common} onClick={() => commit(e)}>
                                        {icon}
                                        {body}
                                        {term && <span className="nv-grp">{e.group}</span>}
                                    </Link>
                                ) : (
                                    <button type="button" {...common} onClick={() => go(e)}>
                                        {icon}
                                        {body}
                                        {term && <span className="nv-grp">{e.group}</span>}
                                    </button>
                                )}
                            </li>
                        );
                    })}
                    {shown.length === 0 && <li className="nv-empty" role="presentation">Nothing matches “{q.trim()}”. Try fewer letters, or just the first letters of each word.</li>}
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
