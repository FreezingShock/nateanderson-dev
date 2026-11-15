"use client";

// Small shared pieces of the Starwright GUI: glyph icons, element tiles, the floating tooltip, and the open/close hook that
// keeps a panel mounted while its closing animation plays.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cssUrl, glyphMask } from "@/lib/starwright/ui-art";
import { loadSheets, onSheets, sheetUrl } from "@/lib/starwright/ui-sheets";
import { ELEMENTS } from "@/lib/starwright/data";

/** This thread's drawn GUI art (scripts/starwright/ui-art/build.py writes public/starwright/ui). Bump UI_V when it changes. */
export const UI_V = 3;
export const ui = (name: string) => `/starwright/ui/${name}.png?v=${UI_V}`;
/** Glyph names that have a drawn 16px icon in the ui set. */
const UI_GLYPH: Record<string, string> = {
    back: "ui-back", cross: "ui-cross", burst: "stat-burst", star: "dock-stars", pulse: "dock-pulsar", orbit: "dock-orbit", book: "dock-almanac",
    menu: "dock-menu", pause: "menu-pause", play: "menu-play", full: "menu-full", sound: "menu-sound", mute: "menu-mute", export: "menu-export",
    import: "menu-import", lock: "lock", medal: "medal", mass: "stat-mass", heat: "stat-heat", age: "stat-age", dust: "stat-dust", neutron: "stat-neutron",
};
/** A drawn 16px icon at `s` times size. */
export function Ic({ n, s = 2 }: { n: string; s?: number }) {
    return <span className="sw-pic" aria-hidden="true" style={{ backgroundImage: cssUrl(ui(n)), "--s": s } as CSSProperties} />;
}

/** A 14px dither glyph, coloured by currentColor, drawn at `s` times its size. */
export function Gl({ n, s = 2 }: { n: string; s?: number }) {
    if (UI_GLYPH[n]) return <Ic n={UI_GLYPH[n]} s={s} />;
    return <span className="sw-gl" aria-hidden="true" style={{ "--m": cssUrl(glyphMask(n)), "--s": s } as CSSProperties} />;
}

/** The framed dither tile for an element (or the empty frame when locked). */
export function ElTile({ i, locked, size = 2 }: { i: number; locked?: boolean; size?: number }) {
    const src = locked ? ui("el-locked") : ui(`el-${ELEMENTS[i].sym.toLowerCase()}`);
    return <span className="sw-el" aria-hidden="true" data-locked={locked ? "" : undefined} style={{ backgroundImage: cssUrl(src), "--s": size } as CSSProperties} />;
}

/** `data-tip="Title|line|line"` on any element shows a floating box. One layer for the whole game, so panels never clip it. */
export function useTips() {
    const [tip, setTip] = useState<{ x: number; y: number; below: boolean; lines: string[] } | null>(null);
    const timer = useRef(0);
    const onOver = (e: React.PointerEvent) => {
        if (e.pointerType === "touch") return;
        const el = (e.target as Element).closest?.("[data-tip]") as HTMLElement | null;
        window.clearTimeout(timer.current);
        if (!el) { setTip(null); return; }
        const r = el.getBoundingClientRect();
        const lines = (el.getAttribute("data-tip") ?? "").split("|").filter(Boolean);
        timer.current = window.setTimeout(() => {
            const vw = window.innerWidth;
            setTip({ x: Math.max(140, Math.min(vw - 140, r.left + r.width / 2)), y: r.top > 130 ? r.top - 8 : r.bottom + 8, below: r.top <= 130, lines });
        }, 90);
    };
    const clear = () => { window.clearTimeout(timer.current); setTip(null); };
    useEffect(() => () => window.clearTimeout(timer.current), []);
    const layer = tip ? (
        <div className="sw-tipbox" data-below={tip.below ? "" : undefined} style={{ left: tip.x, top: tip.y }} role="tooltip">
            <b>{tip.lines[0]}</b>
            {tip.lines.slice(1).map((l, k) => <span key={k}>{l}</span>)}
        </div>
    ) : null;
    return { layer, handlers: { onPointerOver: onOver, onPointerLeave: clear, onPointerDown: clear } };
}

/** Keeps `value` mounted for `ms` after it becomes null so a closing animation can play. */
export function useLeaving<T>(value: T | null, ms = 260): { shown: T | null; leaving: boolean } {
    const [shown, setShown] = useState<T | null>(value);
    const [leaving, setLeaving] = useState(false);
    useEffect(() => {
        if (value !== null) {
            const t = window.setTimeout(() => { setShown(value); setLeaving(false); }, 0);
            return () => window.clearTimeout(t);
        }
        const a = window.setTimeout(() => setLeaving(true), 0);
        const b = window.setTimeout(() => { setShown(null); setLeaving(false); }, ms);
        return () => { window.clearTimeout(a); window.clearTimeout(b); };
    }, [value, ms]);
    return { shown: value ?? shown, leaving: value === null && leaving };
}

/** Loads the art sheets once and re-renders the caller when they arrive. */
export function useSheets(): number {
    const [n, setN] = useState(0);
    useEffect(() => {
        const off = onSheets(() => setN((v) => v + 1));
        void loadSheets();
        return off;
    }, []);
    return n;
}

/** A 16px picture from the art sheets (coloured), or the stand-in glyph. */
export function Pic({ sheet, glyph, s = 2 }: { sheet: string; glyph: string; s?: number }) {
    const own = sheet.replace(/^icon\//, "");
    if (/^(dock|menu)-/.test(own) || own === "lock" || own.startsWith("medal")) return <Ic n={own} s={s} />;
    const url = sheetUrl(sheet);
    if (!url) return <Gl n={glyph} s={s} />;
    return <span className="sw-pic" aria-hidden="true" style={{ backgroundImage: cssUrl(url), "--s": s } as CSSProperties} />;
}
