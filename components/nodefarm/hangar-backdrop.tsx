"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { DRONE_SECS, DRONE_TREE } from "@/lib/nodefarm/engine";
import type { TreeBackdropHandle } from "./tree-backdrop";
import { gridHandle, type GridSpec } from "./parallax";

/**
 * The drone tree's backdrop: a hangar floor seen from above. Far to near: a dithered deck plate texture (`hangar-bg-0`),
 * the painted floor lines, a fine deck grid and the bolt grid the nodes sit on, each following the camera at its own rate
 * for depth. A world layer holds a landing pad under the core (`hangar-pad`), a glow plate per section in its colour and
 * three taxi rings with hazard dashes. A radar sweep turns slowly over the pad. Art: scripts/naos-art/nodefarm-hangar-art.py.
 * Same handle as the other tree backdrops. Styles: app/camino/nodefarm-hangar.css (`.nf-hbd*`). Decorative only.
 */
const LAYERS: GridSpec[] = [
    { depth: 0.12, zoom: 0.2, cell: 512 }, // deck plates (256 art px drawn at 2x)
    { depth: 0.3, zoom: 0.35, cell: 40 },
    { depth: 0.6, zoom: 0.65, cell: 160 },
    { depth: 1, zoom: 1, cell: 0 }, // cell 0 = half a tree unit, glued to the nodes
];

export const HangarBackdrop = forwardRef<TreeBackdropHandle, { unit?: number }>(function HangarBackdrop({ unit = 165 }, ref) {
    const root = useRef<HTMLDivElement>(null);
    const layers = useRef<(HTMLDivElement | null)[]>([]);
    const world = useRef<HTMLDivElement>(null);
    const secs = useMemo(() => DRONE_SECS.map((b) => {
        const ns = DRONE_TREE.filter((n) => n.branch === b.id);
        return { id: b.id, color: b.color, x: (ns.reduce((a, n) => a + n.x, 0) / ns.length) * unit, y: (ns.reduce((a, n) => a + n.y, 0) / ns.length) * unit };
    }), [unit]);
    useImperativeHandle(ref, () => gridHandle(LAYERS, unit, layers, world, root), [unit]);
    return (
        <div ref={root} className="nf-hbd" aria-hidden="true">
            {LAYERS.map((_, i) => <div key={i} ref={(el) => { layers.current[i] = el; }} className="nf-hbd-g" data-l={i} />)}
            <div ref={world} className="nf-hbd-w">
                {secs.map((s) => <i key={s.id} className="nf-hbd-sec" data-sec={s.id} style={{ left: s.x, top: s.y, ["--c" as string]: s.color }} />)}
                <i className="nf-hbd-ring" style={{ width: unit * 4.2, height: unit * 4.2 }} />
                <i className="nf-hbd-ring" data-r="2" style={{ width: unit * 9.4, height: unit * 9.4 }} />
                <i className="nf-hbd-ring" data-r="3" style={{ width: unit * 16, height: unit * 16 }} />
                <i className="nf-hbd-pad" />
                <i className="nf-hbd-sweep" style={{ width: unit * 9.4, height: unit * 9.4 }} />
            </div>
            <i className="nf-hbd-vig" />
        </div>
    );
});
