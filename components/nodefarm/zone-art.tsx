"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { State, StatId } from "@/lib/nodefarm/engine";
import { hasZoneArt, onStagePreview, shownStage } from "@/lib/nodefarm/zone-art";

/**
 * The staged dither scene in a zone panel's blank space: right of the description, below the title bar, above the spec lines
 * and buttons. One element, one sprite sheet: the row is the stage, CSS steps through the six frames. Paused while offscreen.
 * A stage going up flashes the new sprite in. The box is measured only when the panel resizes (no per-frame JS): it sets
 * --s (3 art px per art pixel on wide panels, else 2), --w (visible width, the art is cropped on its left), --b (where the
 * floor sits) and --r (room kept free for the big number on the right).
 * Styles: app/camino/nodefarm-zone-art.css. Stage logic: lib/nodefarm/zone-art.ts.
 */
export function ZoneArt({ id, s }: { id: StatId; s: State }) {
    const el = useRef<HTMLElement>(null);
    const [, rerender] = useState(0);
    const stage = hasZoneArt(id) ? shownStage(s, id) : 0;
    const prev = useRef<number | null>(null);
    const [up, setUp] = useState(0);
    useEffect(() => onStagePreview(() => rerender((n) => n + 1)), []);
    useEffect(() => {
        if (prev.current != null && stage > prev.current) {
            setUp((n) => n + 1);
            const t = setTimeout(() => setUp(0), 900);
            prev.current = stage;
            return () => clearTimeout(t);
        }
        prev.current = stage;
    }, [stage]);
    useLayoutEffect(() => {
        const node = el.current;
        const row = node?.parentElement;
        if (!node || !row || typeof ResizeObserver === "undefined") return;
        const fit = () => {
            const r = row.getBoundingClientRect();
            if (!r.width) return;
            const q = (sel: string) => row.querySelector(sel)?.getBoundingClientRect();
            const bar = q(".nf-bar-t");
            const spec = q(".nf-spec") ?? q(".nf-arm") ?? q(".nf-btns");
            const brief = row.querySelector(".nf-brief");
            const title = q(".nf-row-t");
            // right edge of the text column: the description's actual text, or the title, whichever reaches further
            let textR = title ? title.left + Math.min(title.width, 260) : r.left;
            if (brief?.firstChild) {
                const range = document.createRange();
                range.selectNodeContents(brief);
                for (const c of range.getClientRects()) textR = Math.max(textR, c.right);
            }
            const narrow = matchMedia("(max-width: 639px)").matches; // same breakpoint as the band in the CSS
            let sc: number, w: number, b: number, right = 0;
            if (narrow) {
                // phones: the description runs full width, so the scene gets its own band under the header (CSS makes room)
                sc = 2;
                w = r.width;
                b = (q(".nf-row-h")?.bottom ?? r.top) - r.top + 64 * sc;
            } else {
                const top = (bar ? bar.bottom : r.top) - r.top;
                const pad = parseFloat(row.style.getPropertyValue("--art-pad")) || 0;
                b = (spec ? spec.top : r.bottom) - r.top - 6;
                // wide panels get 3x: the backdrop-only top rows may hide under the title bar, and up to 48 px of extra
                // room is opened above the spec lines when the description is short
                const need = 64 * 3 - 32 - (b - pad - top);
                sc = r.width >= 1100 && need <= 48 ? 3 : 2;
                const nextPad = sc === 3 ? Math.max(0, Math.ceil(need)) : 0;
                if (nextPad !== pad) {
                    row.style.setProperty("--art-pad", `${nextPad}px`);
                    b += nextPad - pad;
                }
                // the scene stops short of the big number, so the number never sits on art
                const num = q(".nf-row-n");
                right = num ? r.right - num.left + 14 : 0;
                w = Math.min(r.width - right - (textR - r.left) - 24, 288 * sc);
            }
            node.style.setProperty("--s", String(sc));
            node.style.setProperty("--w", `${Math.max(0, Math.round(w))}px`);
            node.style.setProperty("--b", `${Math.round(b)}px`);
            node.style.setProperty("--r", `${Math.round(right)}px`);
        };
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(row);
        const num = row.querySelector(".nf-row-n");
        if (num) ro.observe(num); // the number grows a digit: refit
        return () => ro.disconnect();
    }, []);
    useEffect(() => {
        const node = el.current;
        if (!node || typeof IntersectionObserver === "undefined") return;
        const io = new IntersectionObserver((e) => {
            if (e[0]?.isIntersecting) node.setAttribute("data-run", "");
            else node.removeAttribute("data-run");
        });
        io.observe(node);
        return () => io.disconnect();
    }, []);
    if (!hasZoneArt(id)) return null;
    return (
        <i
            ref={el}
            className="nf-art"
            aria-hidden="true"
            data-stage={stage}
            data-up={up ? "" : undefined}
            style={{ ["--st" as string]: stage, ["--art" as string]: `url(/naos/nodefarm/zone-${id}.webp)` } as CSSProperties}
        />
    );
}
