"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { LAB, LAB_SECS } from "@/lib/nodefarm/engine";
import type { TreeBackdropHandle } from "./tree-backdrop";
import { gridHandle, type GridSpec } from "./parallax";

/**
 * The research tree's backdrop: a dithered blueprint sheet. Far to near: the painted paper (`lab-bg-0`, multicolour mist and
 * schematic symbols), a fine and a major drafting grid, a layer of floating bytes (`lab-bg-2`) and the dot grid the nodes sit
 * on, each following the camera at its own rate for depth. A world layer holds one dither plate per section (`lab-sec-*`),
 * the core's drafting rings (`lab-core`) and three compass rings. Art: scripts/naos-art/nodefarm-lab-bg.py. Nothing per frame
 * but background-positions and one transform. Same handle as the prestige TreeBackdrop, so the menu drives either one.
 * Styles: app/camino/nodefarm-lab.css (`.nf-lbd*`). Decorative: aria-hidden, no pointer events.
 */
const LAYERS: GridSpec[] = [
    { depth: 0.12, zoom: 0.2, cell: 512 }, // painted paper (256 art px drawn at 2x)
    { depth: 0.2, zoom: 0.25, cell: 26 },
    { depth: 0.55, zoom: 0.6, cell: 132 },
    { depth: 0.8, zoom: 0.85, cell: 768, slack: 12 }, // floating bytes (256 art px drawn at 3x), sways 8 px
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
    useImperativeHandle(ref, () => gridHandle(LAYERS, unit, layers, world, root), [unit]);
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
