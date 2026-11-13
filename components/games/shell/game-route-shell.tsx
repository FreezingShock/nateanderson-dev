"use client";

// Reusable route shell for /creations/games/* game pages. A game opts in by wrapping its route in a layout:
//   export default function Layout({ children }) { return <GameRouteShell name="Node Farm">{children}</GameRouteShell>; }
// What it does, and only this:
//  - marks the page as a game route (html.gs-game-route) so overscroll and pull-to-refresh stay out of the game
//  - tracks the tab being hidden and publishes it as a context value and a "gameshell:visibility" window event
//  - tracks a manual pause and publishes it as "gameshell:pause"; a hidden tab counts as paused
//  - full screen toggle for its own box, only where the browser supports it (iPhone Safari does not for boxes)
//  - an optional compact header (back link, name, pause, full screen), off by default so a game with its own
//    header is not doubled up
// It never touches game state. A game that wants to pause its own loop listens to the events or reads the hook.
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import "@/app/camino/game-shell.css";

export type GameShellState = {
    hidden: boolean;
    paused: boolean;
    fullscreen: boolean;
    supportsFullscreen: boolean;
    setPaused: (paused: boolean) => void;
    toggleFullscreen: () => void;
};

const NOOP_STATE: GameShellState = {
    hidden: false,
    paused: false,
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

export function GameRouteShell({
    name,
    children,
    header,
}: {
    name: string;
    children: ReactNode;
    /** Pass to show the compact header. Omit for games that already draw their own header. */
    header?: HeaderLink;
}) {
    const boxRef = useRef<HTMLDivElement>(null);
    const [hidden, setHidden] = useState(false);
    const [manualPause, setManualPause] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [supportsFullscreen, setSupportsFullscreen] = useState(false);

    // Mark the document while a game route is mounted. Removed on unmount, so the hub and other pages are unchanged.
    useEffect(() => {
        const root = document.documentElement;
        root.classList.add("gs-game-route");
        setSupportsFullscreen(!!document.fullscreenEnabled && typeof boxRef.current?.requestFullscreen === "function");
        return () => root.classList.remove("gs-game-route");
    }, []);

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
        const onChange = () => setFullscreen(!!boxRef.current && document.fullscreenElement === boxRef.current);
        document.addEventListener("fullscreenchange", onChange);
        return () => document.removeEventListener("fullscreenchange", onChange);
    }, []);

    const toggleFullscreen = useCallback(() => {
        const box = boxRef.current;
        if (!box) return;
        if (document.fullscreenElement === box) {
            void document.exitFullscreen?.().catch(() => {});
        } else if (typeof box.requestFullscreen === "function") {
            void box.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
        }
    }, []);

    const value = useMemo<GameShellState>(
        () => ({ hidden, paused, fullscreen, supportsFullscreen, setPaused: setManualPause, toggleFullscreen }),
        [hidden, paused, fullscreen, supportsFullscreen, toggleFullscreen],
    );

    return (
        <ShellContext.Provider value={value}>
            <div ref={boxRef} className="gs-shell" data-game={name} data-paused={paused ? "true" : undefined}>
                {header && (
                    <div className="gs-bar" role="region" aria-label={`${name} controls`}>
                        <Link className="gs-back" href={header.href}>
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
