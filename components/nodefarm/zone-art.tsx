"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { State, StatId } from "@/lib/nodefarm/engine";
import { nfArt } from "@/lib/nodefarm/art-version";
import { hasZoneArt, onStagePreview, shownStage } from "@/lib/nodefarm/zone-art";

/**
 * The staged dither scene in a zone panel's blank space: right of the description, below the title bar, above the spec lines
 * and buttons. One element, one sprite sheet: the row is the stage, CSS steps through the six frames. Paused while offscreen.
 * A stage going up flashes the new sprite in. The box is measured only when the panel resizes (no per-frame JS): it sets
 * --s (3 art px per art pixel on wide panels, else 2), --w (visible width, the art is cropped on its left), --b (where the
 * floor sits), --t (the top: the title bar), --tf (end of the dark wash behind the description) and --nx/--ny/--nw/--nh
 * (the dark pool behind the big number).
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
            let sc: number, w: number, b: number, t: number;
            let fade = -80; // where the dark wash behind the description ends, in box px
            let glow = [0, 0, 0, 0]; // the dark pool behind the big number: x, y, width, height in box px
            const top = (bar ? bar.bottom : r.top) - r.top;
            // scale: the whole 96-row cell fits between the title bar and the floor, nothing is cut. Snapped to whole device
            // pixels so the dither stays crisp; if snapping leaves a gap over 12 px at the top, the next step up is used and
            // the panel opens that much room above the spec lines instead.
            const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
            if (narrow) {
                // phones: the description runs full width, so the scene gets its own band under the header (CSS sizes it)
                sc = Math.max(1, Math.round((r.width / 288) * dpr) / dpr);
                w = Math.min(r.width, 288 * sc);
                t = (q(".nf-row-h")?.bottom ?? r.top) - r.top;
                b = t + 96 * sc;
                row.style.setProperty("--art-band", `${Math.round(96 * sc)}px`);
            } else {
                t = top;
                const pad = parseFloat(row.style.getPropertyValue("--art-pad")) || 0;
                b = (spec ? spec.top : r.bottom) - r.top - 6;
                const room = b - pad - top;
                sc = Math.max(1, Math.floor((room / 96) * dpr) / dpr);
                if (96 * sc < room - 12) sc += 1 / dpr;
                sc = Math.min(sc, 3);
                const nextPad = Math.max(0, Math.ceil(96 * sc - room));
                if (nextPad !== pad) {
                    row.style.setProperty("--art-pad", `${nextPad}px`);
                    b += nextPad - pad;
                }
                t = b - 96 * sc; // the cell's top edge sits at (or just under) the title bar
                // the scene runs to the panel's right edge; the description gets a dark wash and the big number a dark pool
                w = Math.min(r.width, 288 * sc);
                const boxL = r.right - w;
                fade = Math.round(textR - boxL);
                const num = q(".nf-row-n");
                if (num) glow = [num.left - boxL - 36, num.top - r.top - t - 22, num.width + 72, num.height + 44];
            }
            node.style.setProperty("--s", String(sc));
            node.style.setProperty("--w", `${Math.max(0, Math.round(w))}px`);
            node.style.setProperty("--b", `${Math.round(b)}px`);
            node.style.setProperty("--t", `${Math.round(t)}px`);
            node.style.setProperty("--tf", `${fade}px`);
            node.style.setProperty("--nx", `${Math.round(glow[0])}px`);
            node.style.setProperty("--ny", `${Math.round(glow[1])}px`);
            node.style.setProperty("--nw", `${Math.round(glow[2])}px`);
            node.style.setProperty("--nh", `${Math.round(glow[3])}px`);
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
            style={{ ["--st" as string]: stage, ["--art" as string]: `url(${nfArt(`zone-${id}.webp`)})` } as CSSProperties}
        />
    );
}
