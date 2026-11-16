"use client";

// Paged: how a Starwright menu holds more than fits. It never scrolls and never hides anything. It lays the content out once
// in an unseen copy, measures how much fits in the room the menu really has (any screen size, any rotation), and splits it into
// pages at row boundaries. When everything fits there is one page and no controls. When it does not, a small flip bar appears
// (arrows, "2 of 3"; also the arrow keys, PageUp/PageDown, and a swipe on a phone) and each flip slides in its own page.
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { play } from "@/lib/starwright/sound";
import { Gl } from "./sw-ui";

export interface PagedGroup {
    key: string;
    /** A small heading shown above this group on every page it appears on. */
    title?: ReactNode;
    /** Class of the list the units sit in (a grid, usually). */
    className?: string;
    /** `ul` when the units are `li`s. */
    tag?: "ul" | "div" | "dl";
    /** Starts this group on a new page whenever the menu has to be split (the Menu's Keys list uses it). */
    newPage?: boolean;
    /** One entry per row, tile or card. A unit is never split across pages. */
    units: ReactNode[];
}

/** True while a unit is drawn in the unseen measuring copy, so it can skip timers and animation frames. */
export const PagedProbe = createContext(false);
export const useProbe = () => useContext(PagedProbe);

type Seg = { g: number; from: number; to: number };
const NAV = 52;
const HEAD = 34;

function Groups({ groups, segs }: { groups: PagedGroup[]; segs: Seg[] }) {
    return (
        <>
            {segs.map((s) => {
                const g = groups[s.g];
                const Tag = g.tag ?? "div";
                return (
                    <section key={`${g.key}-${s.from}`} className="sw-pg-grp" data-g={g.key}>
                        {g.title && <h3 className="sw-h3">{g.title}</h3>}
                        <Tag className={g.className}>{g.units.slice(s.from, s.to)}</Tag>
                    </section>
                );
            })}
        </>
    );
}

export function Paged({ groups, deps = "", label, overlay }: { groups: PagedGroup[]; deps?: string; label: string; overlay?: ReactNode }) {
    const root = useRef<HTMLDivElement | null>(null);
    const view = useRef<HTMLDivElement | null>(null);
    const [pages, setPages] = useState<Seg[][] | null>(null); // null: measure
    const [fixed, setFixed] = useState<number | null>(null);
    const [page, setPage] = useState(0);
    const [dir, setDir] = useState(1);
    const redo = useRef(0);
    const [stamp, setStamp] = useState(0);
    const sig = `${deps}|${groups.map((g) => g.units.length).join(",")}|${stamp}`;
    const lastSig = useRef(sig);
    if (lastSig.current !== sig) { lastSig.current = sig; setPages(null); setFixed(null); }

    // Measure: the first pass draws everything (unseen: the layout effect below replaces it before the browser paints), finds the
    // room the menu really has, and cuts pages at row boundaries.
    useLayoutEffect(() => {
        if (pages !== null) return;
        const r = root.current, v = view.current;
        if (!r || !v) return;
        const room = r.clientHeight;
        const all: Seg[] = groups.map((g, i) => ({ g: i, from: 0, to: g.units.length }));
        // the page element's own height: scrollHeight would also count tiles still sliding into place
        const content = (v.firstElementChild as HTMLElement | null)?.offsetHeight ?? v.scrollHeight;
        if (content <= room + 1) { setPages([all]); setPage(0); return; }
        const avail = room - NAV;
        // offsets, not bounding boxes: a menu that is still scaling in would measure half size
        const abs = (e: HTMLElement) => { let y = 0; let n: HTMLElement | null = e; while (n) { y += n.offsetTop; n = n.offsetParent as HTMLElement | null; } return y; };
        const base = abs(v);
        const out: Seg[][] = [];
        let cur: Seg[] = [];
        let top = 0; // y (in the full layout) where the current page begins
        let lead = 0; // room a repeated heading takes when the page begins in the middle of a group
        const flush = () => { if (cur.length) out.push(cur); cur = []; lead = 0; };
        groups.forEach((g, gi) => {
            const sec = v.querySelector(`[data-g="${g.key}"]`);
            const kids = sec ? (Array.from((sec.lastElementChild as HTMLElement).children) as HTMLElement[]) : [];
            if (!sec || kids.length === 0) return;
            const y = (e: Element, edge: "top" | "bottom") => abs(e as HTMLElement) - base + (edge === "bottom" ? (e as HTMLElement).offsetHeight : 0);
            const headTop = y(sec, "top");
            if (g.newPage && cur.length) flush();
            if (cur.length === 0) top = headTop;
            let from = 0;
            for (let k = 0; k < kids.length; k++) {
                if (y(kids[k], "bottom") - top + lead <= avail) continue;
                if (k > from) {
                    // cut before this row: step back over the units that share its top
                    let cut = k;
                    while (cut > from + 1 && Math.abs(y(kids[cut - 1], "top") - y(kids[k], "top")) < 2) cut--;
                    cur.push({ g: gi, from, to: cut });
                    flush();
                    from = cut;
                    top = y(kids[cut], "top");
                    lead = HEAD;
                } else if (cur.length) {
                    // this group's heading and first row do not fit under what is already on the page
                    flush();
                    top = headTop;
                }
            }
            cur.push({ g: gi, from, to: kids.length });
        });
        flush();
        setFixed(room);
        setPages(out.length ? out : [all]);
        setPage((n) => Math.min(n, Math.max(0, out.length - 1)));
    }, [pages, groups]);

    // A page that still overflows (text wrapped another way) is measured again, at most three times.
    useLayoutEffect(() => {
        const v = view.current;
        if (!v || pages === null || pages.length < 2) return;
        if (((v.firstElementChild as HTMLElement | null)?.offsetHeight ?? v.scrollHeight) > v.clientHeight + 1 && redo.current < 3) { redo.current++; setStamp((n) => n + 1); }
    });
    useEffect(() => { redo.current = 0; }, [deps]);

    // Measure again when the window turns or resizes.
    useEffect(() => {
        let t = 0;
        const on = () => { window.clearTimeout(t); t = window.setTimeout(() => { redo.current = 0; setStamp((n) => n + 1); }, 120); };
        window.addEventListener("resize", on);
        window.addEventListener("orientationchange", on);
        return () => { window.clearTimeout(t); window.removeEventListener("resize", on); window.removeEventListener("orientationchange", on); };
    }, []);

    const n = pages?.length ?? 1;
    const go = useCallback((d: number) => {
        if (n < 2) return;
        setPage((v) => {
            const nx = Math.max(0, Math.min(n - 1, v + d));
            if (nx !== v) { setDir(d); play("page", { dir: d }); }
            return nx;
        });
    }, [n]);

    useEffect(() => {
        const key = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); go(1); }
            else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(-1); }
        };
        window.addEventListener("keydown", key);
        return () => window.removeEventListener("keydown", key);
    }, [go]);

    const down = useRef<{ x: number; y: number } | null>(null);
    const everything: Seg[] = groups.map((g, i) => ({ g: i, from: 0, to: g.units.length }));
    const shown = pages ? pages[Math.min(page, pages.length - 1)] : everything;

    return (
        <div
            ref={root}
            className="sw-pg"
            data-paged={n > 1 ? "" : undefined}
            style={fixed && n > 1 ? { flex: `0 0 ${fixed}px` } : undefined}
            aria-label={label}
            onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY }; }}
            onPointerUp={(e) => {
                const d = down.current;
                down.current = null;
                if (!d || n < 2) return;
                const dx = e.clientX - d.x, dy = e.clientY - d.y;
                if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.6) go(dx < 0 ? 1 : -1);
            }}
        >
            <div ref={view} className="sw-pg-view">
                <div className="sw-pg-page" key={page} data-dir={dir > 0 ? "next" : "prev"}>
                    <PagedProbe.Provider value={pages === null}><Groups groups={groups} segs={shown} /></PagedProbe.Provider>
                </div>
                {overlay}
            </div>
            {n > 1 && (
                <div className="sw-pg-nav" role="group" aria-label={`${label} pages`}>
                    <button type="button" className="sw-pg-btn" disabled={page === 0} onClick={() => go(-1)} aria-label="Previous page" data-tip="Previous|Left arrow or swipe"><Gl n="back" s={1} /></button>
                    <span className="sw-pg-dots" aria-live="polite">
                        {Array.from({ length: n }, (_, i) => <i key={i} data-on={i === page ? "" : undefined} />)}
                        <b>{page + 1} of {n}</b>
                    </span>
                    <button type="button" className="sw-pg-btn" data-next disabled={page >= n - 1} onClick={() => go(1)} aria-label="Next page" data-tip="Next|Right arrow or swipe"><Gl n="back" s={1} /></button>
                </div>
            )}
        </div>
    );
}
