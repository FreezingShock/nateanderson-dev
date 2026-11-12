"use client";

import { forwardRef, useMemo } from "react";
import { nfArt } from "@/lib/nodefarm/art-version";
import type { BackdropSpec } from "./backdrop-canvas";
import { CanvasBackdrop, type BackdropHandle } from "./canvas-backdrop";
import type { TreeBackdropHandle } from "./tree-backdrop";
import { DRONE_SECS, DRONE_TREE } from "@/lib/nodefarm/engine";

/**
 * The Drone tree's backdrop: a hangar floor at night. Far to near: the deck plates (`hangar-bg-0`), a fine deck grid, the
 * painted floor lines and the bolt grid the nodes sit on, each following the camera at its own rate for depth. World: a
 * glow per section in its colour, three taxi rings with hazard dashes, a landing pad under the core (`hangar-pad`) and a
 * radar sweep turning slowly over it. Art: scripts/naos-art/nodefarm-hangar-art.py. Each parallax layer is a pre-drawn canvas
 * the GPU slides around (components/nodefarm/backdrop-canvas.ts); the vignette stays CSS. Styles: app/camino/nodefarm-hangar.css.
 */
export const HangarBackdrop = forwardRef<TreeBackdropHandle, { unit?: number }>(function HangarBackdrop({ unit = 165 }, ref) {
    const spec = useMemo<BackdropSpec>(() => {
        const secs = DRONE_SECS.map((b) => {
            const ns = DRONE_TREE.filter((n) => n.branch === b.id);
            return { id: b.id, color: b.color, x: (ns.reduce((a, n) => a + n.x, 0) / ns.length) * unit, y: (ns.reduce((a, n) => a + n.y, 0) / ns.length) * unit };
        });
        return {
            layers: [
                { kind: "img", src: nfArt("hangar-bg-0.webp"), cell: 512, depth: 0.12, zoom: 0.2, alpha: 0.75 }, // deck plates (2x)
                { kind: "grid", color: "#ffb14a0c", line: 1, cell: 40, depth: 0.3, zoom: 0.35, alpha: 1 },
                { kind: "grid", color: "#ffd23a1a", line: 2, cell: 160, depth: 0.6, zoom: 0.65, alpha: 1 },
                { kind: "dots", color: "#c9d2e066", r: 1.75, cell: 0, depth: 1, zoom: 1, alpha: 0.6 },
            ],
            world: [
                ...secs.map((s) => ({ kind: "plate" as const, x: s.x, y: s.y, size: 1100, glow: s.color, alpha: 1, sec: s.id })),
                { kind: "ring", d: unit * 4.2, color: "#ffd23a33", width: 3, dash: true },
                { kind: "ring", d: unit * 9.4, color: "#ffb14a22", width: 2, dash: true },
                { kind: "ring", d: unit * 16, color: "#ffb14a14", width: 1 },
                { kind: "plate", x: 0, y: 0, size: 768, src: nfArt("hangar-pad.webp"), alpha: 1, round: true },
                { kind: "sweep", d: unit * 9.4, color: "#ffb14a2a", tail: 0.14, period: 9 },
            ],
            dim: 0.4,
        };
    }, [unit]);
    return (
        <CanvasBackdrop ref={ref as React.Ref<BackdropHandle>} spec={spec} unit={unit} className="nf-hbd">
            <i className="nf-hbd-vig" />
        </CanvasBackdrop>
    );
});
