"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { FW, FW_SECS } from "@/lib/nodefarm/engine";
import type { TreeBackdropHandle } from "./tree-backdrop";
import { gridHandle, type GridSpec } from "./parallax";

/**
 * The Firmware tree's backdrop: green phosphor glass. Far to near: the painted glass (`fw-bg-0`, amber and cyan mist and
 * memory dumps), a fine and a major scan grid, a layer of glowing motes and keys (`fw-bg-2`) and the dot grid the nodes
 * sit on, each following the camera at its own rate. A world layer holds one dither plate per section (`fw-sec-*`), the
 * rings round node zero (`fw-core`) and three rings. Art: scripts/naos-art/nodefarm-handover-art.py. Same handle as the
 * prestige TreeBackdrop. Styles: app/camino/nodefarm-handover.css (`.nf-fbd*`). Decorative: aria-hidden, no pointer events.
 */
const LAYERS: GridSpec[] = [
    { depth: 0.12, zoom: 0.2, cell: 512 }, // painted paper (256 art px drawn at 2x)
    { depth: 0.2, zoom: 0.25, cell: 26 },
    { depth: 0.55, zoom: 0.6, cell: 132 },
    { depth: 0.8, zoom: 0.85, cell: 768, slack: 12 }, // floating bytes (256 art px drawn at 3x), sways 8 px
    { depth: 1, zoom: 1, cell: 0 }, // cell 0 = half a tree unit, glued to the nodes
];

export const FwBackdrop = forwardRef<TreeBackdropHandle, { unit?: number }>(function FwBackdrop({ unit = 165 }, ref) {
    const root = useRef<HTMLDivElement>(null);
    const layers = useRef<(HTMLDivElement | null)[]>([]);
    const world = useRef<HTMLDivElement>(null);
    const secs = useMemo(() => FW_SECS.map((b) => {
        const ns = FW.filter((n) => n.branch === b.id);
        return { id: b.id, color: b.color, x: (ns.reduce((a, n) => a + n.x, 0) / ns.length) * unit, y: (ns.reduce((a, n) => a + n.y, 0) / ns.length) * unit };
    }), [unit]);
    useImperativeHandle(ref, () => gridHandle(LAYERS, unit, layers, world, root), [unit]);
    return (
        <div ref={root} className="nf-fbd" aria-hidden="true">
            {LAYERS.map((_, i) => <div key={i} ref={(el) => { layers.current[i] = el; }} className="nf-fbd-g" data-l={i} />)}
            <div ref={world} className="nf-fbd-w">
                {secs.map((s) => <i key={s.id} className="nf-fbd-sec" data-sec={s.id} style={{ left: s.x, top: s.y, ["--c" as string]: s.color }} />)}
                <i className="nf-fbd-core" />
                <i className="nf-fbd-ring" style={{ width: unit * 5.2, height: unit * 5.2 }} />
                <i className="nf-fbd-ring" data-r="2" style={{ width: unit * 11.2, height: unit * 11.2 }} />
                <i className="nf-fbd-ring" data-r="3" style={{ width: unit * 17.6, height: unit * 17.6 }} />
            </div>
            <i className="nf-fbd-scan" />
            <i className="nf-fbd-vig" />
        </div>
    );
});
