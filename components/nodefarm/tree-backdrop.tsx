"use client";

import { forwardRef, useMemo } from "react";
import { TREE, BRANCHES, type Branch } from "@/lib/nodefarm/engine";
import { nfArt } from "@/lib/nodefarm/art-version";
import type { BackdropSpec, ImgLayer } from "./backdrop-canvas";
import { CanvasBackdrop, CanvasFront, type BackdropHandle } from "./canvas-backdrop";
import "@/app/camino/nodefarm-tree-art.css";

/**
 * The prestige tree's backdrop: three tiling dither layers that move at different rates with the camera (parallax), plus
 * world plates (the core halo and one nebula per section) that move 1:1 with the nodes. Each parallax layer is a
 * pre-drawn canvas the GPU slides around (components/nodefarm/backdrop-canvas.ts), so it never blanks mid-pan.
 *   move(x, y, k)   the world transform the menu applies: translate(x px, y px) scale(k)
 *   resize(w, h)    the view size in px (on mount and on resize)
 *   focus(branch)   tint toward one section (hover or select), or null
 * TreeDust (below) is a fourth, nearest layer the menu renders ABOVE its nodes: dust that drifts past in front of the tree and
 * moves faster than the nodes (depth > 1), which sells the depth. It shares this backdrop's camera.
 * Art: scripts/naos-art/nodefarm-tree-bg.py -> public/naos/nodefarm/tree-bg-0..2, tree-dust, tree-core, tree-sec-<branch>.
 * Styles: app/camino/nodefarm-tree-art.css. Decorative: aria-hidden, no pointer events.
 */
export interface TreeBackdropHandle {
    move(x: number, y: number, k: number): void;
    resize(w: number, h: number): void;
    focus(branch: Branch | null): void;
}

/** css px per tile: 512 art px drawn at 2x */
const T = 1024;
/** world size of the halo and the section nebulae in css px at zoom 1 (art px x 2 and x 4) */
const CORE = 800;
const SEC = 1024;
/** dust in front of the nodes: faster than the world, drifting the other way, see-through */
const DUST: ImgLayer[] = [{ kind: "img", src: nfArt("tree-dust.webp"), cell: T, depth: 1.35, zoom: 1.25, alpha: 0.55, drift: { s: 140, dir: 1 }, lowHide: true }];

export const TreeBackdrop = forwardRef<TreeBackdropHandle, { unit?: number }>(function TreeBackdrop({ unit = 110 }, ref) {
    const spec = useMemo<BackdropSpec>(() => {
        // each section's nebula sits at the middle of its nodes
        const secs = BRANCHES.map((b) => {
            const ns = TREE.filter((n) => n.branch === b.id);
            const x = (ns.reduce((a, n) => a + n.x, 0) / Math.max(1, ns.length)) * unit;
            const y = (ns.reduce((a, n) => a + n.y, 0) / Math.max(1, ns.length)) * unit;
            return { kind: "plate" as const, x, y, size: SEC, src: nfArt(`tree-sec-${b.id}.webp`), alpha: 0.9, sec: b.id };
        });
        return {
            // far to near; depth = how far a layer follows the camera, zoom = how much of the zoom it takes (Nate picked "strong depth")
            layers: [
                { kind: "img", src: nfArt("tree-bg-0.webp"), cell: T, depth: 0.1, zoom: 0.15, alpha: 1 },
                // the star layer drifts sideways by one tile every 300 s
                { kind: "img", src: nfArt("tree-bg-1.webp"), cell: T, depth: 0.45, zoom: 0.55, alpha: 1, drift: { s: 300, dir: -1 } },
                // the near layer sways in a slow loop
                { kind: "img", src: nfArt("tree-bg-2.webp"), cell: T, depth: 0.85, zoom: 0.95, alpha: 0.8, sway: { name: "SwayA", s: 17, slack: 40 }, lowHide: true },
            ],
            front: DUST,
            world: [...secs, { kind: "plate", x: 0, y: 0, size: CORE, src: nfArt("tree-core.webp"), alpha: 1, pulse: [0.85, 1, 6] }],
            dim: 0.45,
            // below 1:1 the dither would alias into moire, so the plates are smoothed into a soft glow
            softBelow: 0.95,
        };
    }, [unit]);
    return (
        <CanvasBackdrop ref={ref as React.Ref<BackdropHandle>} spec={spec} unit={unit} className="nf-bd">
            <i className="nf-bd-vig" />
        </CanvasBackdrop>
    );
});

/** Dust that drifts in front of the nodes. Render it after the world (above the nodes); it never takes pointer events. */
export function TreeDust() {
    return <CanvasFront className="nf-dust" layers={DUST} />;
}
