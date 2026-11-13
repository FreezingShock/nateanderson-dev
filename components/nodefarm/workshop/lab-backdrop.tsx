"use client";

import { forwardRef, useMemo } from "react";
import { nfArt } from "@/lib/nodefarm/art/art-version";
import type { BackdropSpec } from "../tree/backdrop-canvas";
import { CanvasBackdrop, type BackdropHandle } from "../tree/canvas-backdrop";
import type { TreeBackdropHandle } from "../tree/tree-backdrop";
import { LAB, LAB_SECS } from "@/lib/nodefarm/engine";

/**
 * The research tree's backdrop: a dithered blueprint sheet. Far to near: the painted paper (`lab-bg-0`, multicolour mist and
 * schematic symbols), a fine and a major drafting grid, a layer of floating bytes (`lab-bg-2`) and the dot grid the nodes sit
 * on, each following the camera at its own rate for depth. World plates: one dither plate per section (`lab-sec-*`), the
 * core's drafting rings (`lab-core`) and three compass rings. Art: scripts/naos-art/nodefarm-lab-bg.py. Each
 * parallax layer is a pre-drawn canvas the GPU slides around (components/nodefarm/tree/backdrop-canvas.ts); the scan line and vignette stay CSS. Styles: app/camino/nodefarm/lab.css.
 */
export const LabBackdrop = forwardRef<TreeBackdropHandle, { unit?: number }>(function LabBackdrop({ unit = 165 }, ref) {
    const spec = useMemo<BackdropSpec>(() => {
        const secs = LAB_SECS.map((b) => {
            const ns = LAB.filter((n) => n.branch === b.id);
            return { id: b.id, color: b.color, x: (ns.reduce((a, n) => a + n.x, 0) / ns.length) * unit, y: (ns.reduce((a, n) => a + n.y, 0) / ns.length) * unit };
        });
        return {
            layers: [
                { kind: "img", src: nfArt("lab-bg-0.webp"), cell: 512, depth: 0.12, zoom: 0.2, alpha: 0.62 }, // painted paper (256 art px at 2x)
                { kind: "grid", color: "#5aa8ff10", line: 1, cell: 26, depth: 0.2, zoom: 0.25, alpha: 0.9 },
                { kind: "grid", color: "#5aa8ff22", line: 1, cell: 132, depth: 0.55, zoom: 0.6, alpha: 1 },
                { kind: "img", src: nfArt("lab-bg-2.webp"), cell: 768, depth: 0.8, zoom: 0.85, alpha: 0.8, sway: { name: "SwayB", s: 14, slack: 12 } }, // floating bytes (3x)
                { kind: "dots", color: "#9fd0ff66", r: 1.75, cell: 0, depth: 1, zoom: 1, alpha: 0.7 }, // half a unit, glued to the nodes
            ],
            world: [
                ...secs.map((s) => ({ kind: "plate" as const, x: s.x, y: s.y, size: 1536, src: nfArt(`lab-sec-${s.id}.webp`), alpha: 0.85, sec: s.id, round: true })),
                { kind: "plate", x: 0, y: 0, size: 1152, src: nfArt("lab-core.webp"), alpha: 1, pulse: [0.8, 1, 6], round: true },
                { kind: "ring", d: unit * 5.2, color: "#5aa8ff2e", width: 2, dash: true },
                { kind: "ring", d: unit * 11.2, color: "#5aa8ff1f", width: 1 },
                { kind: "ring", d: unit * 17.6, color: "#5aa8ff14", width: 2, dash: true },
            ],
            dim: 0.45,
        };
    }, [unit]);
    return (
        <CanvasBackdrop ref={ref as React.Ref<BackdropHandle>} spec={spec} unit={unit} className="nf-lbd">
            <i className="nf-lbd-scan" />
            <i className="nf-lbd-vig" />
        </CanvasBackdrop>
    );
});
