"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { markNavigation, prefersReducedMotion, scan, start } from "@/lib/motion/engine";
import { NAV_EVENT } from "@/lib/motion/navigate";
import { navItems } from "@/lib/nav";

type Dir = "fwd" | "back" | "down" | "up";

const rankOf = (p: string) =>
    navItems.findIndex((n) => (n.href === "/" ? p === "/" : p === n.href || p.startsWith(n.href + "/")));
const depthOf = (p: string) => p.split("/").filter(Boolean).length;

/** Which way the curtain travels: along the nav order between sections, down/up inside one section. */
function direction(from: string, to: string): Dir {
    const a = rankOf(from);
    const b = rankOf(to);
    if (a !== b && a >= 0 && b >= 0) return b > a ? "fwd" : "back";
    const da = depthOf(from);
    const db = depthOf(to);
    return db > da ? "down" : db < da ? "up" : "fwd";
}

function labelFor(path: string): string {
    const i = rankOf(path);
    const base = i >= 0 ? navItems[i] : null;
    if (base && (path === base.href || (base.href === "/" && path === "/"))) return base.label;
    const seg = path.split("/").filter(Boolean).pop() ?? "";
    return seg.replace(/-/g, " ");
}

/**
 * Starts the motion engine, runs page transitions and draws the scroll gauge. Mount once in the root layout.
 * Internal link clicks and launcher jumps let the current page slide out along the direction of travel, swap the
 * route, then bring the new page in from the other side; its hero and reveals start as it arrives.
 */
export function MotionRoot() {
    const path = usePathname();
    const router = useRouter();
    const busy = useRef(false);
    const waiting = useRef<{ from: string; timer: number } | null>(null);
    const first = useRef(true);

    // Engine + boot cleanup.
    useEffect(() => {
        const stop = start();
        const t = window.setTimeout(() => document.querySelector(".cm-boot")?.remove(), 2600);
        return () => {
            window.clearTimeout(t);
            stop();
        };
    }, []);

    const arrive = useRef(() => {});
    arrive.current = () => {
        const w = waiting.current;
        if (!w) return;
        window.clearTimeout(w.timer);
        waiting.current = null;
        const doc = document.documentElement;
        // One tick: lift the hold (entrances start) and start the page-in animation together.
        doc.setAttribute("data-xin", "");
        doc.removeAttribute("data-xition");
        window.setTimeout(() => {
            doc.removeAttribute("data-xin");
            doc.removeAttribute("data-dir");
            busy.current = false;
        }, 700);
    };

    // The route actually changed: let the new page mount a frame, then bring it in.
    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        markNavigation();
        scan(document);
        const w = waiting.current;
        if (!w || w.from === path) return;
        const r = requestAnimationFrame(() => arrive.current());
        return () => cancelAnimationFrame(r);
    }, [path]);

    // Click interception + launcher jumps.
    useEffect(() => {
        const reduce = prefersReducedMotion();
        const go = async (href: string) => {
            if (busy.current) return false;
            const url = new URL(href, location.href);
            if (url.origin !== location.origin || url.pathname === location.pathname) return false;
            busy.current = true;
            const doc = document.documentElement;
            doc.setAttribute("data-dir", direction(location.pathname, url.pathname));
            doc.setAttribute("data-xition", "out");
            markNavigation();
            // Let the current page leave (170ms), then swap the route underneath it.
            await new Promise((r) => window.setTimeout(r, 170));
            doc.setAttribute("data-xition", "hold");
            waiting.current = {
                from: location.pathname,
                // If the route never commits (offline, error), don't leave the user on a blank page.
                timer: window.setTimeout(() => arrive.current(), 6000),
            };
            router.push(url.pathname + url.search + url.hash);
            return true;
        };

        const onClick = (e: MouseEvent) => {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            if (!(e.target instanceof Element)) return;
            const a = e.target.closest<HTMLAnchorElement>("a[href]");
            if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download") || a.closest("[data-no-curtain]")) return;
            const url = new URL(a.href, location.href);
            if (url.origin !== location.origin || url.pathname === location.pathname) return;
            e.preventDefault(); // next/link sees defaultPrevented and leaves the navigation to us
            if (!busy.current) void go(url.pathname + url.search + url.hash);
        };
        const onNav = (e: Event) => {
            const href = (e as CustomEvent<string>).detail;
            if (reduce) return router.push(href);
            void go(href).then((ok) => {
                if (!ok) router.push(href);
            });
        };
        if (!reduce) document.addEventListener("click", onClick, true);
        window.addEventListener(NAV_EVENT, onNav);
        return () => {
            document.removeEventListener("click", onClick, true);
            window.removeEventListener(NAV_EVENT, onNav);
        };
    }, [router]);

    return <div className="cm-pgauge" aria-hidden="true" />;
}
