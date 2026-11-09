"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { markNavigation, prefersReducedMotion, scan, start } from "@/lib/motion/engine";
import { NAV_EVENT } from "@/lib/motion/navigate";
import { navItems } from "@/lib/nav";

type Dir = "fwd" | "back" | "down" | "up";

const EASE_CUT = "cubic-bezier(.7, 0, .2, 1)";
const EDGES: Record<Dir, { from: string; to: string }> = {
    fwd: { from: "translate3d(100%,0,0)", to: "translate3d(-100%,0,0)" },
    back: { from: "translate3d(-100%,0,0)", to: "translate3d(100%,0,0)" },
    down: { from: "translate3d(0,100%,0)", to: "translate3d(0,-100%,0)" },
    up: { from: "translate3d(0,-100%,0)", to: "translate3d(0,100%,0)" },
};

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
 * Starts the motion engine, owns the page curtain, and draws the scroll gauge. Mount once in the root layout.
 * Internal link clicks and launcher jumps cover the screen with a directional curtain, navigate underneath it,
 * then uncover the new page; the new page's hero and reveals only start once the curtain is lifting.
 */
export function MotionRoot() {
    const path = usePathname();
    const router = useRouter();
    const curtain = useRef<HTMLDivElement>(null);
    const label = useRef<HTMLSpanElement>(null);
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

    const uncover = useRef(() => {});
    uncover.current = () => {
        const el = curtain.current;
        const w = waiting.current;
        if (!el || !w) return;
        window.clearTimeout(w.timer);
        waiting.current = null;
        const dir = (el.dataset.dir as Dir) || "fwd";
        const doc = document.documentElement;
        const out = el.animate([{ transform: "none" }, { transform: EDGES[dir].to }], {
            duration: 460,
            easing: EASE_CUT,
            fill: "forwards",
        });
        // The new page starts writing itself in just after the curtain begins to lift.
        window.setTimeout(() => doc.removeAttribute("data-xition"), 110);
        const done = () => {
            el.style.visibility = "hidden";
            out.cancel();
            busy.current = false;
        };
        out.finished.then(done, done);
    };

    // The route actually changed: lift the curtain (after the new page has had a frame or two to mount).
    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        markNavigation();
        scan(document);
        const w = waiting.current;
        if (!w || w.from === path) return;
        let r2 = 0;
        const r1 = requestAnimationFrame(() => {
            r2 = requestAnimationFrame(() => window.setTimeout(() => uncover.current(), 60));
        });
        return () => {
            cancelAnimationFrame(r1);
            cancelAnimationFrame(r2);
        };
    }, [path]);

    // Click interception + launcher jumps.
    useEffect(() => {
        const reduce = prefersReducedMotion();
        const go = async (href: string) => {
            const el = curtain.current;
            if (!el || busy.current) return false;
            const url = new URL(href, location.href);
            if (url.origin !== location.origin || url.pathname === location.pathname) return false;
            busy.current = true;
            const dir = direction(location.pathname, url.pathname);
            el.dataset.dir = dir;
            if (label.current) label.current.textContent = `${dir === "back" || dir === "up" ? "←" : "→"} ${labelFor(url.pathname)}`;
            document.documentElement.setAttribute("data-xition", "cover");
            markNavigation();
            el.style.visibility = "visible";
            const cover = el.animate([{ transform: EDGES[dir].from }, { transform: "none" }], {
                duration: 270,
                easing: EASE_CUT,
                fill: "forwards",
            });
            try {
                await cover.finished;
            } catch {
                /* cancelled */
            }
            waiting.current = {
                from: location.pathname,
                // If the route never commits (offline, error), don't leave the user behind a curtain.
                timer: window.setTimeout(() => uncover.current(), 6000),
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
            if (busy.current) return e.preventDefault(); // a curtain is already moving: ignore the extra click
            e.preventDefault(); // next/link sees defaultPrevented and leaves the navigation to us
            void go(url.pathname + url.search + url.hash);
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

    return (
        <>
            <div className="cm-pgauge" aria-hidden="true" />
            <div className="cm-curtain" ref={curtain} aria-hidden="true" data-dir="fwd">
                <i className="edge a" />
                <i className="edge b" />
                <span className="lbl" ref={label} />
            </div>
        </>
    );
}
