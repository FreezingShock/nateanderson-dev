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

/** Writes the destination onto the title card: name, readout line and accent colour. */
function paintCard(card: HTMLDivElement | null, path: string) {
    if (!card) return;
    const i = rankOf(path);
    card.dataset.to = labelFor(path);
    card.style.setProperty("--acc", accentOf(path));
    const k = card.querySelector<HTMLElement>(".k");
    if (k) k.textContent = `${i >= 0 ? navItems[i].no : "--"} // ${labelFor(path)}`;
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
type Phase = "idle" | "out" | "hold" | "in";
/** Minimum time the title card stays up with the destination name on it. */
const HOLD_MIN = 480;

/** Accent on the title card by section: cyan, magenta, orange in nav order (one pop per section, never rainbow). */
const ACCENTS = ["#2fd8e8", "#ff2d8a", "#ff7a1a"];
const accentOf = (p: string) => ACCENTS[Math.max(0, rankOf(p)) % ACCENTS.length];

export function MotionRoot() {
    const path = usePathname();
    const router = useRouter();
    // One small state machine; the latest click always wins:
    //   idle -> out (page leaves) -> hold (route loading, page hidden) -> in (page arrives) -> idle
    const st = useRef<{ phase: Phase; target: string; timer: number; safety: number; heldAt: number }>({
        phase: "idle",
        target: "",
        timer: 0,
        safety: 0,
        heldAt: 0,
    });
    const first = useRef(true);
    const wipe = useRef<HTMLDivElement>(null);

    // Engine + boot cleanup.
    useEffect(() => {
        const stop = start();
        const t = window.setTimeout(() => document.querySelector(".cm-boot")?.remove(), 2600);
        return () => {
            window.clearTimeout(t);
            stop();
        };
    }, []);

    const reset = useRef(() => {});
    reset.current = () => {
        const s = st.current;
        window.clearTimeout(s.timer);
        window.clearTimeout(s.safety);
        const doc = document.documentElement;
        doc.removeAttribute("data-xition");
        doc.removeAttribute("data-xin");
        doc.removeAttribute("data-dir");
        s.phase = "idle";
    };

    const arrive = useRef(() => {});
    arrive.current = () => {
        const s = st.current;
        if (s.phase !== "hold") return;
        // Keep the title card up long enough to read the name (a cached route commits in a few ms).
        const rest = HOLD_MIN - (performance.now() - s.heldAt);
        if (rest > 0) {
            window.clearTimeout(s.safety);
            s.safety = window.setTimeout(() => arrive.current(), rest);
            return;
        }
        window.clearTimeout(s.safety);
        const doc = document.documentElement;
        if (!location.hash) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        // One tick: lift the hold (entrances start) and start the page-in animation together.
        doc.setAttribute("data-xin", "");
        doc.removeAttribute("data-xition");
        s.phase = "in";
        s.timer = window.setTimeout(() => reset.current(), 650);
    };

    // The route changed. If it is the one we are waiting for, bring the page in.
    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        markNavigation();
        scan(document);
        const s = st.current;
        if (s.phase !== "hold") return;
        if (new URL(s.target, location.href).pathname !== path) return; // an earlier click's page: keep waiting
        // Hidden still: go to the top now (Next's own scroll runs mid-transform and can land anywhere).
        if (!location.hash) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        const r = requestAnimationFrame(() => arrive.current());
        return () => cancelAnimationFrame(r);
    }, [path]);

    // Click interception + launcher jumps.
    useEffect(() => {
        const reduce = prefersReducedMotion();
        const s = st.current;

        const toHold = () => {
            if (s.phase !== "out") return;
            s.phase = "hold";
            s.heldAt = performance.now();
            document.documentElement.setAttribute("data-xition", "hold");
            router.push(s.target);
            // If the route never commits (offline, error), don't leave the user on a blank page.
            s.safety = window.setTimeout(() => arrive.current(), 6000);
        };

        /** Start or retarget a transition. The most recent call wins. Returns false if it left the click alone. */
        const go = (href: string): boolean => {
            const url = new URL(href, location.href);
            if (url.origin !== location.origin) return false;
            const target = url.pathname + url.search + url.hash;
            const here = url.pathname === location.pathname;
            if (here && s.phase === "idle") return false; // same page / #hash: plain Next behaviour
            const doc = document.documentElement;

            if (s.phase === "in") reset.current(); // interrupt the arrival, start over from the live page
            s.target = target;

            if (s.phase === "idle") {
                doc.setAttribute("data-dir", direction(location.pathname, url.pathname));
                doc.setAttribute("data-xition", "out");
                paintCard(wipe.current, url.pathname);
                s.phase = "out";
                markNavigation();
                s.timer = window.setTimeout(toHold, 260);
                return true;
            }
            if (s.phase === "out") {
                if (here) return reset.current(), true; // clicked back onto the page we are still on: cancel
                doc.setAttribute("data-dir", direction(location.pathname, url.pathname));
                paintCard(wipe.current, url.pathname);
                return true; // toHold will push the newest target
            }
            // hold: a route is loading. Point it at the newest target.
            router.push(target);
            if (here) arrive.current(); // back onto the page already showing: nothing to wait for
            return true;
        };

        const onClick = (e: MouseEvent) => {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            if (!(e.target instanceof Element)) return;
            const a = e.target.closest<HTMLAnchorElement>("a[href]");
            if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download") || a.closest("[data-no-curtain]")) return;
            const url = new URL(a.href, location.href);
            if (url.origin !== location.origin) return;
            if (go(url.pathname + url.search + url.hash)) e.preventDefault(); // next/link then leaves it to us
        };
        const onNav = (e: Event) => {
            const href = (e as CustomEvent<string>).detail;
            if (reduce || !go(href)) router.push(href);
        };
        if (!reduce) document.addEventListener("click", onClick, true);
        window.addEventListener(NAV_EVENT, onNav);
        return () => {
            document.removeEventListener("click", onClick, true);
            window.removeEventListener(NAV_EVENT, onNav);
            reset.current();
        };
    }, [router]);

    return (
        <>
            <div className="cm-pgauge" aria-hidden="true" />
            <div className="cm-wipe" ref={wipe} aria-hidden="true">
                <i className="edge" />
                <span className="k" />
            </div>
        </>
    );
}
