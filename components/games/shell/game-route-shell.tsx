"use client";

// Shared shell for /creations/games/* game routes. A game opts in from its layout. Two modes:
//
//  - framed (default; Node Farm): the page is the game's own page. The shell marks the route and adds the hooks below,
//    and draws nothing around the game. Use <GameRouteShell name="Node Farm">{children}</GameRouteShell>.
//  - windowed (Brasswork, Starwright, Groundbreak): the page is a normal site page with an intro. The game runs in a large
//    panel with a themed title bar on top. On load the page scrolls the Play section (its label, heading and panel) under
//    the site bar, and the game takes focus. While the game has focus, game keys and the wheel stay with the game; the
//    title bar and the space below the panel still scroll the page. The panel's own full screen button makes the game fill the screen.
//
// Both modes do the same things, and only these:
//  - mark the page as a game route (html.gs-game-route) so overscroll and pull-to-refresh stay out of the game
//  - track the tab being hidden and publish it as a window event "gameshell:visibility" and a context value
//  - track a manual pause and publish it as "gameshell:pause"; a hidden tab counts as paused
//  - full screen for the shell box (framed) or the game panel (windowed), where the browser supports it
//  - save export and import for games with a save slot (lib/games/save-slot.ts)
//
// It never touches game state. A game that wants to pause its own loop listens to the events or reads the hook.
import Link from "next/link";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type ReactNode,
} from "react";
import { CreationsShell, Section } from "@/components/creations-sections";
import { GAMES, type GameId } from "@/lib/games/registry";
import { SAVE_SLOTS, applyPendingImports, exportSave, importSave } from "@/lib/games/save-slot";
import "@/app/camino/game-shell.css";

// Runs once per page load, when this module loads, before any game mounts and reads its save.
applyPendingImports();

export type GameShellState = {
    hidden: boolean;
    paused: boolean;
    /** The pause the player asked for (the window's Pause button). Unlike `paused`, a hidden tab does not count. */
    manualPaused: boolean;
    fullscreen: boolean;
    supportsFullscreen: boolean;
    setPaused: (paused: boolean) => void;
    toggleFullscreen: () => void;
};

const NOOP_STATE: GameShellState = {
    hidden: false,
    paused: false,
    manualPaused: false,
    fullscreen: false,
    supportsFullscreen: false,
    setPaused: () => {},
    toggleFullscreen: () => {},
};

const ShellContext = createContext<GameShellState>(NOOP_STATE);

/** Read the shell from inside a game. Outside a shell it returns a harmless no-op state. */
export function useGameShell(): GameShellState {
    return useContext(ShellContext);
}

type HeaderLink = { href: string; label: string };

export type GameRouteShellProps = {
    name: string;
    children: ReactNode;
    /** Framed mode only: pass to show the compact header. Omit for games that already draw their own header. */
    header?: HeaderLink;
    /** "framed" (default) or "windowed". Windowed needs `game`. */
    mode?: "framed" | "windowed";
    /** Windowed mode: which game from lib/games/registry.ts. Supplies the intro, the panel theme and the save slot. */
    game?: GameId;
};

const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End"]);
/** Space to a focused button or link still clicks it, so those keep it. */
const TYPING = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** True when `el` can scroll further in the direction of the wheel. */
function canScroll(el: HTMLElement, dy: number): boolean {
    if (el.scrollHeight <= el.clientHeight + 1) return false;
    const oy = getComputedStyle(el).overflowY;
    if (oy !== "auto" && oy !== "scroll") return false;
    return dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1;
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function GameRouteShell({ name, children, header, mode = "framed", game }: GameRouteShellProps) {
    const windowed = mode === "windowed" && !!game && !!GAMES[game];
    const boxRef = useRef<HTMLDivElement>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLElement>(null);
    const [hidden, setHidden] = useState(false);
    const [manualPause, setManualPause] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [supportsFullscreen, setSupportsFullscreen] = useState(false);
    const [saveMsg, setSaveMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    /** The element that goes full screen: the game panel in windowed mode, the whole shell in framed mode. */
    const fsTarget = useCallback(() => (windowed ? frameRef.current : boxRef.current), [windowed]);

    // Mark the document while a game route is mounted. Removed on unmount, so the hub and other pages are unchanged.
    useEffect(() => {
        const root = document.documentElement;
        root.classList.add("gs-game-route");
        setSupportsFullscreen(!!document.fullscreenEnabled && typeof fsTarget()?.requestFullscreen === "function");
        return () => root.classList.remove("gs-game-route");
    }, [fsTarget]);

    useEffect(() => {
        const onVisibility = () => setHidden(document.visibilityState === "hidden");
        onVisibility();
        document.addEventListener("visibilitychange", onVisibility);
        return () => document.removeEventListener("visibilitychange", onVisibility);
    }, []);

    useEffect(() => {
        window.dispatchEvent(new CustomEvent("gameshell:visibility", { detail: { hidden } }));
    }, [hidden]);

    const paused = hidden || manualPause;
    useEffect(() => {
        window.dispatchEvent(new CustomEvent("gameshell:pause", { detail: { paused } }));
    }, [paused]);

    useEffect(() => {
        const onChange = () => {
            const el = fsTarget();
            setFullscreen(!!el && document.fullscreenElement === el);
        };
        document.addEventListener("fullscreenchange", onChange);
        return () => document.removeEventListener("fullscreenchange", onChange);
    }, [fsTarget]);

    const toggleFullscreen = useCallback(() => {
        const el = fsTarget();
        if (!el) return;
        if (document.fullscreenElement === el) {
            void document.exitFullscreen?.().catch(() => {});
        } else if (typeof el.requestFullscreen === "function") {
            void el.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
        }
    }, [fsTarget]);

    // Both modes. Focus inside the game (the panel when windowed, the shell box when framed) hands it the keys and the wheel.
    useEffect(() => {
        const frame = windowed ? frameRef.current : boxRef.current;
        if (!frame) return;

        // Game keys never scroll the page while the game has focus. Typing fields keep their keys.
        const onKey = (e: KeyboardEvent) => {
            if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
            if (!frame.contains(document.activeElement)) return;
            const t = e.target as HTMLElement | null;
            const typing = !!t && (TYPING.has(t.tagName) || t.isContentEditable);
            if (typing) return;
            if (SCROLL_KEYS.has(e.key)) e.preventDefault();
            else if (e.key === " " && t?.tagName !== "BUTTON" && t?.tagName !== "A") e.preventDefault();
        };

        // The wheel belongs to the game while it has focus, except inside a part of the game that scrolls itself.
        const onWheel = (e: WheelEvent) => {
            if (!frame.contains(document.activeElement)) return;
            let el = e.target as HTMLElement | null;
            while (el && el !== frame) {
                if (canScroll(el, e.deltaY)) return;
                el = el.parentElement;
            }
            e.preventDefault();
        };

        window.addEventListener("keydown", onKey, { capture: true });
        frame.addEventListener("wheel", onWheel, { passive: false });
        return () => {
            window.removeEventListener("keydown", onKey, { capture: true });
            frame.removeEventListener("wheel", onWheel);
        };
    }, [windowed]);

    // Windowed only. On load, bring the Play section up under the site bar, then give the game focus without moving the page again.
    // Waits past the launch cover's reveal (about 0.4 s after the route changes) so the scroll is not seen behind it.
    useEffect(() => {
        if (!windowed) return;
        // The line the page should start below: the site bar's real bottom (taller on phones) plus a small gap.
        const clearance = () => {
            const bar = document.querySelector<HTMLElement>("header.nv-top");
            // Groundbreak hides the site bar on its route, so keep the old 72px line there.
            const bottom = bar ? bar.getBoundingClientRect().bottom : 0;
            return bottom > 0 ? bottom + 12 : 72;
        };
        // On tall screens (desktop 700px and up, phones 760px and up) the anchor is the panel's title bar, so the panel can take
        // nearly the whole screen between the site bar and the dock or the phone tab bar. The Play label and heading scroll up
        // above it, and the reader can scroll back to them. Short screens keep the panel as the anchor.
        const anchor = () => {
            const tall = window.matchMedia("(min-width: 761px) and (min-height: 700px), (max-width: 760px) and (min-height: 760px)").matches;
            if (tall) return document.querySelector<HTMLElement>(".gs-win-bar") || panelRef.current;
            return panelRef.current;
        };
        let settle = 0;
        let moved = false;
        const stop = () => { moved = true; };
        // For a few seconds (the game can take a while to boot) the page keeps the Play section under the site bar while the page above it settles (the game boots, the cover lifts).
        // Any wheel, touch, press or key from the reader ends it.
        const hold = (until: number) => {
            const p = anchor();
            if (!p || moved || performance.now() > until) return;
            const off = p.getBoundingClientRect().top - clearance();
            if (off < -2) window.scrollBy({ top: off, behavior: "auto" });
            settle = window.setTimeout(() => hold(until), 120);
        };
        const id = window.setTimeout(() => {
            const play = anchor();
            if (play) {
                const target = Math.max(0, play.getBoundingClientRect().top + window.scrollY - clearance());
                if (Math.abs(window.scrollY - target) > 8) {
                    window.scrollTo({ top: target, behavior: reducedMotion() ? "auto" : "smooth" });
                }
            }
            frameRef.current?.focus({ preventScroll: true });
            window.addEventListener("wheel", stop, { passive: true });
            window.addEventListener("touchstart", stop, { passive: true });
            window.addEventListener("pointerdown", stop, { passive: true });
            window.addEventListener("keydown", stop);
            hold(performance.now() + 15000);
        }, 450);
        return () => {
            window.clearTimeout(id);
            window.clearTimeout(settle);
            window.removeEventListener("wheel", stop);
            window.removeEventListener("touchstart", stop);
            window.removeEventListener("pointerdown", stop);
            window.removeEventListener("keydown", stop);
        };
    }, [windowed]);

    const value = useMemo<GameShellState>(
        () => ({ hidden, paused, manualPaused: manualPause, fullscreen, supportsFullscreen, setPaused: setManualPause, toggleFullscreen }),
        [hidden, paused, manualPause, fullscreen, supportsFullscreen, toggleFullscreen],
    );

    if (windowed && game) {
        const g = GAMES[game];
        const slot = SAVE_SLOTS[game];
        const onExport = async () => {
            const r = await exportSave(game);
            setSaveMsg(r.ok ? { tone: "ok", text: r.message } : { tone: "err", text: r.error });
        };
        const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setSaveMsg({ tone: "ok", text: "Checking the file." });
            const r = await importSave(game, file);
            if (!r.ok) {
                setSaveMsg({ tone: "err", text: r.error });
                return;
            }
            setSaveMsg({ tone: "ok", text: r.message });
            window.setTimeout(() => window.location.reload(), 400);
        };
        return (
            <ShellContext.Provider value={value}>
                <div ref={boxRef} className="gs-shell gs-windowed" data-game={name} data-theme={g.theme} data-paused={paused ? "true" : undefined}>
                    {/* The back link lives in the title bar, not above the page, so the window carries its own way out. */}
                    <CreationsShell
                        eyebrow={g.eyebrow}
                        title={[g.name]}
                        description={g.description}
                        variant="sub"
                    >
                        <Section id="play" no="01" label="Play" title={g.playTitle} ctos>
                            <section ref={panelRef} className="gs-win" aria-label={`${name} panel`}>
                                <header className="gs-win-bar">
                                    <Link prefetch={false} className="gs-win-back" href={g.backHref} aria-label={g.backLabel}>
                                        <svg viewBox="0 0 12 12" aria-hidden="true">
                                            <path d="M7.5 2 3.5 6l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
                                        </svg>
                                        <span className="gs-win-back-txt">Games</span>
                                    </Link>
                                    <div className="gs-win-title">
                                        <span className="gs-win-kick">{g.eyebrow}</span>
                                        <h3>{name}</h3>
                                    </div>
                                    <span className="gs-state" aria-live="polite">{paused ? "paused" : "running"}</span>
                                    <button
                                        type="button"
                                        className="gs-win-btn"
                                        aria-pressed={manualPause}
                                        onClick={() => setManualPause((p) => !p)}
                                    >
                                        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                                            {manualPause ? <path d="M3 2l7 4-7 4z" fill="currentColor" /> : <path d="M3 2h2v8H3zM7 2h2v8H7z" fill="currentColor" />}
                                        </svg>
                                        {manualPause ? "Resume" : "Pause"}
                                    </button>
                                    {supportsFullscreen && (
                                        <button type="button" className="gs-win-btn" aria-pressed={fullscreen} onClick={toggleFullscreen}>
                                            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                                                <path d="M1 4V1h3M8 1h3v3M11 8v3H8M4 11H1V8" fill="none" stroke="currentColor" strokeWidth="1.4" />
                                            </svg>
                                            {fullscreen ? "Exit full screen" : "Full screen"}
                                        </button>
                                    )}
                                </header>
                                <div ref={frameRef} className="gs-frame" tabIndex={-1} role="group" aria-label={`${name} game`}>
                                    <div className="gs-fs-bar">
                                        <Link prefetch={false} className="gs-fs-link" href={g.backHref}>{"<"} Games</Link>
                                        <button type="button" className="gs-fs-link" onClick={toggleFullscreen}>Exit full screen</button>
                                    </div>
                                    {children}
                                </div>
                                {slot && (
                                    <footer className="gs-win-foot">
                                        {/* Icon-only: the name is the aria-label and the tooltip (CSS, on hover and keyboard focus). */}
                                        <button type="button" className="gs-win-btn gs-win-icon" data-tip="Export save" aria-label="Export save" onClick={onExport}>
                                            <svg viewBox="0 0 12 12" aria-hidden="true">
                                                <path d="M6 1v6.5M3.2 4.8 6 7.6l2.8-2.8M1.5 10.5h9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
                                            </svg>
                                        </button>
                                        <button type="button" className="gs-win-btn gs-win-icon" data-tip="Import save" aria-label="Import save" onClick={() => fileRef.current?.click()}>
                                            <svg viewBox="0 0 12 12" aria-hidden="true">
                                                <path d="M6 7.5V1M3.2 3.7 6 .9l2.8 2.8M1.5 10.5h9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
                                            </svg>
                                        </button>
                                        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onPick} aria-label={`Import a ${name} save file`} />
                                        <p className="gs-win-msg" role="status" data-tone={saveMsg?.tone}>{saveMsg?.text ?? ""}</p>
                                        <span className="gs-win-hint">Scroll the page from the title bar or below the panel. The game keeps the wheel while it has focus.</span>
                                    </footer>
                                )}
                            </section>
                        </Section>
                    </CreationsShell>
                </div>
            </ShellContext.Provider>
        );
    }

    return (
        <ShellContext.Provider value={value}>
            <div ref={boxRef} className="gs-shell" data-game={name} data-paused={paused ? "true" : undefined}>
                {header && (
                    <div className="gs-bar" role="region" aria-label={`${name} controls`}>
                        <Link prefetch={false} className="gs-back" href={header.href}>
                            <span aria-hidden="true">{"<"}</span>&nbsp;{header.label}
                        </Link>
                        <span className="gs-name">{name}</span>
                        <span className="gs-state" aria-live="polite">{paused ? "paused" : "running"}</span>
                        <button type="button" className="gs-btn" aria-pressed={manualPause} onClick={() => setManualPause((p) => !p)}>
                            {manualPause ? "Resume" : "Pause"}
                        </button>
                        {supportsFullscreen && (
                            <button type="button" className="gs-btn" aria-pressed={fullscreen} onClick={toggleFullscreen}>
                                {fullscreen ? "Exit full screen" : "Full screen"}
                            </button>
                        )}
                    </div>
                )}
                {children}
            </div>
        </ShellContext.Provider>
    );
}
