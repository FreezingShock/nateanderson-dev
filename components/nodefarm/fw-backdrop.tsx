"use client";

import { forwardRef, useMemo } from "react";
import { nfArt } from "@/lib/nodefarm/art-version";
import type { BackdropSpec } from "./backdrop-canvas";
import { CanvasBackdrop, type BackdropHandle } from "./canvas-backdrop";
import type { TreeBackdropHandle } from "./tree-backdrop";
import { FW, FW_SECS } from "@/lib/nodefarm/engine";

/**
 * The Firmware tree's backdrop: green phosphor glass. Far to near: the painted glass (`fw-bg-0`, amber and cyan mist and
 * memory dumps), a fine and a major scan grid, a layer of glowing motes and keys (`fw-bg-2`) and the dot grid the nodes
 * sit on, each following the camera at its own rate. World plates: one dither plate per section (`fw-sec-*`), the rings
 * round node zero (`fw-core`) and three rings. Art: scripts/naos-art/nodefarm-handover-art.py. Each parallax layer is a pre-drawn canvas
 * the GPU slides around (components/nodefarm/backdrop-canvas.ts); the scan line and vignette stay CSS. Styles: app/camino/nodefarm-handover.css.
 */
export const FwBackdrop = forwardRef<TreeBackdropHandle, { unit?: number }>(function FwBackdrop({ unit = 165 }, ref) {
    const spec = useMemo<BackdropSpec>(() => {
        const secs = FW_SECS.map((b) => {
            const ns = FW.filter((n) => n.branch === b.id);
            return { id: b.id, color: b.color, x: (ns.reduce((a, n) => a + n.x, 0) / ns.length) * unit, y: (ns.reduce((a, n) => a + n.y, 0) / ns.length) * unit };
        });
        return {
            layers: [
                { kind: "img", src: nfArt("fw-bg-0.webp"), cell: 512, depth: 0.12, zoom: 0.2, alpha: 0.62 },
                { kind: "grid", color: "#3dff6e10", line: 1, cell: 26, depth: 0.2, zoom: 0.25, alpha: 0.9 },
                { kind: "grid", color: "#3dff6e22", line: 1, cell: 132, depth: 0.55, zoom: 0.6, alpha: 1 },
                { kind: "img", src: nfArt("fw-bg-2.webp"), cell: 768, depth: 0.8, zoom: 0.85, alpha: 0.8, sway: { name: "SwayB", s: 14, slack: 12 } },
                { kind: "dots", color: "#b6ffc866", r: 1.75, cell: 0, depth: 1, zoom: 1, alpha: 0.7 },
            ],
            world: [
                ...secs.map((s) => ({ kind: "plate" as const, x: s.x, y: s.y, size: 1536, src: nfArt(`fw-sec-${s.id}.webp`), alpha: 0.5, sec: s.id, round: true })),
                { kind: "plate", x: 0, y: 0, size: 1152, src: nfArt("fw-core.webp"), alpha: 1, pulse: [0.8, 1, 6], round: true },
                { kind: "ring", d: unit * 5.2, color: "#3dff6e2e", width: 2, dash: true },
                { kind: "ring", d: unit * 11.2, color: "#3dff6e1f", width: 1 },
                { kind: "ring", d: unit * 17.6, color: "#3dff6e14", width: 2, dash: true },
            ],
            dim: 0.3,
        };
    }, [unit]);
    return (
        <CanvasBackdrop ref={ref as React.Ref<BackdropHandle>} spec={spec} unit={unit} className="nf-fbd">
            <i className="nf-fbd-scan" />
            <i className="nf-fbd-vig" />
        </CanvasBackdrop>
    );
});
