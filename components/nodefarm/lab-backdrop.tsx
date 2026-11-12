"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { LAB, LAB_SECS } from "@/lib/nodefarm/engine";
import type { TreeBackdropHandle } from "./tree-backdrop";

/**
 * The research tree's backdrop: a blueprint sheet. Three drafting grids (fine, major, and the world grid the nodes sit on)
 * follow the camera at different rates for depth, plus a world layer with the core's glow, one tinted wash per section and a
 * few drafting marks (a compass circle and dimension ticks). Pure CSS gradients: no art files, nothing per frame but a
 * background-position and one transform. Same handle as the prestige TreeBackdrop, so the menu drives either one.
 * Styles: app/camino/nodefarm-lab.css (`.nf-lbd*`). Decorative: aria-hidden, no pointer events.
 */
const LAYERS = [
    { depth: 0.2, zoom: 0.25, cell: 26 },
    { depth: 0.55, zoom: 0.6, cell: 132 },
    { depth: 1, zoom: 1, cell: 0 }, // cell 0 = half a tree unit, glued to the nodes
];

export const LabBackdrop = forwardRef<TreeBackdropHandle, { unit?: number }>(function LabBackdrop({ unit = 165 }, ref) {
    const root = useRef<HTMLDivElement>(null);
    const layers = useRef<(HTMLDivElement | null)[]>([]);
    const world = useRef<HTMLDivElement>(null);
    const secs = useMemo(() => LAB_SECS.map((b) => {
        const ns = LAB.filter((n) => n.branch === b.id);
        return { id: b.id, color: b.color, x: (ns.reduce((a, n) => a + n.x, 0) / ns.length) * unit, y: (ns.reduce((a, n) => a + n.y, 0) / ns.length) * unit };
    }), [unit]);
    useImperativeHandle(ref, () => {
        const v = { w: 0, h: 0, x: 0, y: 0, k: 1 };
        const paint = () => {
            if (!v.w) return;
            const cx = (v.w / 2 - v.x) / v.k, cy = (v.h / 2 - v.y) / v.k;
            LAYERS.forEach((L, i) => {
                const el = layers.current[i];
                if (!el) return;
                const sc = Math.max(0.2, 1 + (v.k - 1) * L.zoom);
                const cell = (L.cell || unit / 2) * sc;
                const ox = v.w / 2 - cx * L.depth * v.k, oy = v.h / 2 - cy * L.depth * v.k;
                el.style.backgroundSize = `${cell.toFixed(2)}px ${cell.toFixed(2)}px`;
                el.style.backgroundPosition = `${ox.toFixed(1)}px ${oy.toFixed(1)}px`;
            });
            if (world.current) world.current.style.transform = `translate3d(${v.x.toFixed(1)}px, ${v.y.toFixed(1)}px, 0) scale(${v.k.toFixed(4)})`;
        };
        return {
            move(x, y, k) { Object.assign(v, { x, y, k }); paint(); },
            resize(w, h) { Object.assign(v, { w, h }); paint(); },
            focus(branch) {
                const r = root.current;
                if (!r) return;
                if (branch) r.dataset.focus = branch;
                else delete r.dataset.focus;
            },
        };
    }, [unit]);
    return (
        <div ref={root} className="nf-lbd" aria-hidden="true">
            {LAYERS.map((_, i) => <div key={i} ref={(el) => { layers.current[i] = el; }} className="nf-lbd-g" data-l={i} />)}
            <div ref={world} className="nf-lbd-w">
                {secs.map((s) => <i key={s.id} className="nf-lbd-sec" data-sec={s.id} style={{ left: s.x, top: s.y, ["--c" as string]: s.color }} />)}
                <i className="nf-lbd-core" />
                <i className="nf-lbd-ring" style={{ width: unit * 5.2, height: unit * 5.2 }} />
                <i className="nf-lbd-ring" data-r="2" style={{ width: unit * 11.2, height: unit * 11.2 }} />
                <i className="nf-lbd-ring" data-r="3" style={{ width: unit * 17.6, height: unit * 17.6 }} />
            </div>
            <i className="nf-lbd-scan" />
            <i className="nf-lbd-vig" />
        </div>
    );
});
