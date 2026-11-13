"use client";

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { LayerCanvas, Parallax, type BackdropSpec, type ImgLayer, type Layer, type WorldItem } from "./backdrop-canvas";

/**
 * The React shell for every tree backdrop: a root div (its CSS gradient sits behind everything), one canvas per parallax
 * layer (drawn and moved by components/nodefarm/tree/backdrop-canvas.ts), a world layer of plates, rings and sweep that moves
 * 1:1 with the nodes, then any screen-fixed extras (scan line, vignette). Gives the tree menu the move / resize / focus
 * handle every backdrop shares. A spec's `front` layers draw into a <CanvasFront /> placed above the nodes (prestige dust).
 * Styles: app/camino/nodefarm/tree-art.css (`.nf-bdl`, `.nf-bdw`).
 */
export interface BackdropHandle {
    move(x: number, y: number, k: number): void;
    resize(w: number, h: number): void;
    focus(branch: string | null): void;
}

// the open backdrop and its front layer find each other here (only one tree menu is open at a time)
const slot: { px: Parallax | null; spec: BackdropSpec | null; unit: number; front: HTMLDivElement | null } = { px: null, spec: null, unit: 165, front: null };
function attachFront() {
    const { px, spec, front, unit } = slot;
    if (!px) return;
    const els = front ? Array.from(front.querySelectorAll<HTMLCanvasElement>("canvas")) : [];
    px.setFront((spec?.front ?? []).map((l, i) => (els[i] ? new LayerCanvas(els[i], l, unit) : null)).filter((x): x is LayerCanvas => !!x));
}

const layerAttrs = (l: Layer, i: number) => ({
    "data-l": i,
    "data-low": l.kind === "img" && l.lowHide ? "" : undefined,
    "data-drift": l.kind === "img" && l.drift ? (l.drift.dir < 0 ? "l" : "r") : undefined,
    "data-sway": l.kind === "img" && l.sway ? l.sway.name : undefined,
    style: {
        opacity: l.alpha,
        ...(l.kind === "img" && l.drift ? { ["--ds" as string]: `${l.drift.s}s` } : {}),
        ...(l.kind === "img" && l.sway ? { ["--ss" as string]: `${l.sway.s}s` } : {}),
    } as CSSProperties,
});

function WorldEl({ it }: { it: WorldItem }) {
    if (it.kind === "plate") {
        const st: CSSProperties = { left: it.x, top: it.y, width: it.size, height: it.size, ["--a" as string]: it.alpha };
        if (it.src) st.backgroundImage = `url(${it.src})`;
        if (it.glow) st.backgroundImage = `radial-gradient(circle, color-mix(in srgb, ${it.glow} 22%, transparent) 0, color-mix(in srgb, ${it.glow} 8%, transparent) 40%, transparent 68%)`;
        if (it.pulse) Object.assign(st, { ["--lo" as string]: it.pulse[0] * it.alpha, ["--hi" as string]: it.pulse[1] * it.alpha, ["--ps" as string]: `${it.pulse[2]}s` });
        return <i className="nf-bdw-p" data-sec={it.sec} data-pulse={it.pulse ? "" : undefined} data-round={it.round ? "" : undefined} data-art={it.src ? "" : undefined} style={st} />;
    }
    if (it.kind === "ring") return <i className="nf-bdw-r" style={{ width: it.d, height: it.d, border: `${it.width}px ${it.dash ? "dashed" : "solid"} ${it.color}` }} />;
    return <i className="nf-bdw-s" style={{ width: it.d, height: it.d, background: `conic-gradient(from 0deg, ${it.color}, transparent ${it.tail * 100}%, transparent)`, ["--sp" as string]: `${it.period}s` } as CSSProperties} />;
}

export const CanvasBackdrop = forwardRef<BackdropHandle, { spec: BackdropSpec; unit: number; className: string; children?: ReactNode }>(
    function CanvasBackdrop({ spec, unit, className, children }, ref) {
        const root = useRef<HTMLDivElement>(null);
        const world = useRef<HTMLDivElement>(null);
        const px = useRef<Parallax | null>(null);
        // the camera can arrive before the engine exists; keep the last values and replay them
        const last = useRef<{ size?: [number, number]; cam?: [number, number, number]; focus: string | null }>({ focus: null });

        useLayoutEffect(() => {
            const r = root.current;
            if (!r) return;
            const p = new Parallax(r, world.current, spec.softBelow);
            px.current = p;
            slot.px = p;
            slot.spec = spec;
            slot.unit = unit;
            const els = Array.from(r.querySelectorAll<HTMLCanvasElement>(":scope > canvas.nf-bdl"));
            const l = last.current;
            if (l.size) p.resize(...l.size);
            if (l.cam) p.move(...l.cam);
            p.setLayers(spec.layers.map((s, i) => new LayerCanvas(els[i], s, unit)));
            attachFront();
            return () => {
                p.destroy();
                if (slot.px === p) slot.px = null;
                px.current = null;
            };
        }, [spec, unit]);

        useImperativeHandle(ref, () => ({
            move(x, y, k) { last.current.cam = [x, y, k]; px.current?.move(x, y, k); },
            resize(w, h) { last.current.size = [w, h]; px.current?.resize(w, h); },
            focus(b) {
                last.current.focus = b;
                px.current?.focus(b);
                world.current?.querySelectorAll<HTMLElement>("[data-sec]").forEach((el) => {
                    if (b && el.dataset.sec === b) el.dataset.on = "";
                    else delete el.dataset.on;
                });
            },
        }), []);

        return (
            <div ref={root} className={`nf-bdx ${className}`} aria-hidden="true" style={{ ["--dim" as string]: spec.dim } as CSSProperties}>
                {spec.layers.map((l, i) => <canvas key={i} className="nf-bdl" {...layerAttrs(l, i)} />)}
                <div ref={world} className="nf-bdw">
                    {spec.world.map((it, i) => <WorldEl key={i} it={it} />)}
                </div>
                {children}
            </div>
        );
    },
);

/** The front layers (prestige dust), above the nodes. Render it after the world; it takes no pointer events. */
export function CanvasFront({ className, layers }: { className: string; layers: ImgLayer[] }) {
    const el = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        slot.front = el.current;
        attachFront();
        return () => {
            if (slot.front === el.current) slot.front = null;
            attachFront();
        };
    }, []);
    return (
        <div ref={el} className={className} aria-hidden="true">
            {layers.map((l, i) => <canvas key={i} className="nf-bdl" {...layerAttrs(l, i)} />)}
        </div>
    );
}
