"use client";

// Launch and exit flow between the Games hub and each game. Game links use this cover instead of the site shutter. Mounted once in app/creations/games/layout.tsx, so it
// survives the route change and can cover the old page while the new one arrives.
//  - Clicking a game card (or any link into /creations/games/<game>) plays a themed cover, then navigates.
//  - Leaving a game (its back link to the hub) plays the same cover in reverse: cover, go, reveal.
//  - Every route change while in a game remembers that game as the last one played.
// The cover is one fixed layer. It is inert while idle, so it never blocks clicks or scrolling. Reduced motion
// skips the timed fades and only swaps the page.
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Scramble } from "@/components/cm/motion";
import { allGames } from "@/lib/creations-data";
import { HUB_PATH, routeSlugOf, writeLastGame } from "@/lib/game-launch/launch";

type Phase = "idle" | "cover" | "reveal";
type Target = { to: string; slug: string | null; title: string; accent: string; exit: boolean };

const COVER_MS = 260; // how long the cover takes to fade in before the route changes
const REVEAL_MS = 300; // how long the cover takes to fade out after the new route is in
const SAFETY_MS = 8000; // if the route never changes, drop the cover so the page is never stuck

const GAMES = allGames();

function targetFor(here: string, url: URL): Target | null {
    const toSlug = routeSlugOf(url.pathname);
    const hereSlug = routeSlugOf(here);
    const inGames = (p: string) => p === HUB_PATH || p.startsWith(`${HUB_PATH}/`);
    if (!inGames(url.pathname) && !inGames(here)) return null;

    if (toSlug) {
        // Launch: a game route, from the hub or from another game
        const match = GAMES.find((g) => g.href && routeSlugOf(g.href) === toSlug);
        return { to: `${url.pathname}${url.search}`, slug: toSlug, title: match?.title ?? "Game", accent: match?.accent ?? "#2fd8e8", exit: false };
    }
    if (url.pathname === HUB_PATH || url.pathname === `${HUB_PATH}/`) {
        // Exit: the hub, from a game. Hub to hub hash links stay normal.
        if (!hereSlug) return null;
        return { to: `${url.pathname}${url.search}${url.hash}`, slug: null, title: "Games", accent: "#2fd8e8", exit: true };
    }
    return null;
}

function prefersReducedMotion(): boolean {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function GameLaunchLayer() {
    const router = useRouter();
    const pathname = usePathname();
    const [phase, setPhase] = useState<Phase>("idle");
    const [target, setTarget] = useState<Target | null>(null);
    const busy = useRef(false);
    const phaseRef = useRef<Phase>("idle");
    const timers = useRef<number[]>([]);

    const clearTimers = useCallback(() => {
        timers.current.forEach((t) => window.clearTimeout(t));
        timers.current = [];
    }, []);

    const setPhaseBoth = useCallback((p: Phase) => {
        phaseRef.current = p;
        setPhase(p);
    }, []);

    const finish = useCallback(() => {
        clearTimers();
        busy.current = false;
        setPhaseBoth("idle");
    }, [clearTimers, setPhaseBoth]);

    // Remember the last game whenever a game route is on screen, including direct visits.
    useEffect(() => {
        const slug = routeSlugOf(pathname);
        if (slug) writeLastGame(slug);
    }, [pathname]);

    // The route changed while a cover was up: the new page is in, so reveal it.
    useEffect(() => {
        if (!busy.current || phaseRef.current !== "cover") return;
        const wait = prefersReducedMotion() ? 0 : REVEAL_MS;
        clearTimers();
        setPhaseBoth("reveal");
        timers.current.push(window.setTimeout(finish, wait));
    }, [pathname, clearTimers, finish, setPhaseBoth]);

    // Drop any pending timers when the layer unmounts.
    useEffect(() => clearTimers, [clearTimers]);

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const el = e.target instanceof Element ? e.target.closest("a[href]") : null;
            if (!(el instanceof HTMLAnchorElement)) return;
            if (el.target === "_blank" || el.hasAttribute("download")) return;
            const url = new URL(el.href, window.location.href);
            if (url.origin !== window.location.origin) return;
            const here = window.location.pathname;
            if (url.pathname === here) return; // same page, hash or query: normal behavior
            const t = targetFor(here, url);
            if (!t) return;

            // Take the click over: the cover plays, then the route changes. Stopping here also keeps the site shutter
            // and Next's own link handler from navigating before the cover is up.
            e.preventDefault();
            e.stopImmediatePropagation();
            if (busy.current) return;
            busy.current = true;
            if (t.slug) writeLastGame(t.slug);
            setTarget(t);
            setPhaseBoth("cover");

            const coverWait = prefersReducedMotion() ? 0 : COVER_MS;
            clearTimers();
            timers.current.push(window.setTimeout(() => router.push(t.to), coverWait));
            timers.current.push(window.setTimeout(finish, SAFETY_MS));
        };
        // Window capture runs before the site-wide shutter in motion-root (document capture), so game links
        // take this cover instead of the shutter. Every other link keeps the shutter.
        window.addEventListener("click", onClick, true);
        return () => window.removeEventListener("click", onClick, true);
    }, [router, clearTimers, finish, setPhaseBoth]);

    const shown = target ?? { title: "Games", accent: "#2fd8e8", slug: null, exit: true, to: HUB_PATH };
    const code = shown.exit ? "return.games" : `launch.${shown.slug ?? "game"}`;

    return (
        <div
            className="gl-layer"
            data-phase={phase}
            data-kind={shown.exit ? "exit" : "launch"}
            inert={phase === "idle"}
            aria-hidden={phase === "idle" ? true : undefined}
            style={{ ["--gl-accent" as string]: shown.accent }}
        >
            <div className="gl-sweep" aria-hidden="true" />
            <div className="gl-panel" role={phase === "idle" ? undefined : "status"}>
                <div className="gl-top">
                    <Scramble className="gl-sys" replay text={`naOS // ${code}`} />
                    <span className="gl-state">{phase === "reveal" ? "Ready" : "Loading"}</span>
                </div>
                <h2 className="gl-title">{shown.exit ? "Back to Games" : shown.title}</h2>
                <p className="gl-line">{shown.exit ? "Returning to the hub" : "Starting up. Your save loads with it."}</p>
                <div className="gl-bar" aria-hidden="true">
                    <i />
                </div>
                <div className="gl-foot" aria-hidden="true">
                    <span>{shown.exit ? "hub" : "game"}</span>
                    <span>{shown.exit ? "games" : shown.slug}</span>
                </div>
            </div>
        </div>
    );
}

