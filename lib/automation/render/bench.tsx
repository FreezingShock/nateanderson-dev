"use client";

// Renderer test harness. Mounts the island full screen and exposes window.__voxelBench for the
// headless timing script (scripts/voxel-island-bench.mjs). Query options:
//   quality=auto|0|1|2   dither=0|1   lowfx=0|1   t=0..1 (time of day)   cycle=0|1
//   machines=N           stamps N simple machines across the island for load testing
//   model=1              places the example machine and a placement ghost
//   orbit=0|1            0 = orbit: false, so an input module owns the camera
import { useEffect, useRef } from "react";
import { createVoxelIsland, type VoxelIsland } from "./index";
import { heightAt } from "./terrain";
import { EXAMPLE_BLOCK } from "../models/examples";

declare global {
    interface Window {
        __voxelBench?: {
            ready: boolean;
            island: VoxelIsland;
            stats: () => ReturnType<VoxelIsland["stats"]>;
        };
    }
}

export default function VoxelIslandBench() {
    const ref = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) return;
        const q = new URLSearchParams(window.location.search);
        const qualityParam = q.get("quality") ?? "auto";
        const island = createVoxelIsland(canvas, {
            quality: qualityParam === "auto" ? "auto" : Number(qualityParam),
            dither: q.get("dither") !== "0",
            lowFx: q.get("lowfx") === "1",
            timeOfDay: q.get("t") ? Number(q.get("t")) : 0.5,
            cycle: q.get("cycle") === "1",
            orbit: q.get("orbit") !== "0",
        });

        const machines = Number(q.get("machines") ?? 0);
        if (machines > 0) {
            island.stamp((s) => {
                let placed = 0;
                for (let n = 0; placed < machines && n < machines * 40; n++) {
                    // Spread across the island with a deterministic lattice.
                    const x = -22 + ((n * 37) % 45) * 1.0;
                    const z = -18 + ((n * 23) % 37) * 1.0;
                    const y = heightAt(x, z);
                    if (y < -0.4) continue;
                    s.box(x, y, z, 0.8, 0.5, 0.8, 0x7f8ca3);
                    s.cylinder(x, y + 0.5, z, 0.25, 0.8, 0xc4682f);
                    s.box(x, y + 0.5, z + 0.3, 0.3, 0.2, 0.1, 0xffb347);
                    placed++;
                }
            });
        }
        island.stampGlow((s) => {
            s.box(-2.8, 0.6, -1.95, 0.6, 0.4, 0.1, 0xffb347);
            s.box(-2.8, 0.6, 4.05, 0.6, 0.4, 0.1, 0xffb347);
        });

        if (q.get("model") === "1") {
            island.placeModel("example", EXAMPLE_BLOCK, {
                cell: { x: -6, z: 2 },
                rot: 1,
            });
            island.setGhost(EXAMPLE_BLOCK, { x: 2, z: 2 }, 0, false);
        }

        island.resize();
        island.start();
        window.__voxelBench = {
            ready: true,
            island,
            stats: () => island.stats(),
        };

        const onResize = () => island.resize();
        window.addEventListener("resize", onResize);
        return () => {
            window.removeEventListener("resize", onResize);
            island.dispose();
            delete window.__voxelBench;
        };
    }, []);

    return (
        <canvas
            ref={ref}
            style={{
                position: "fixed",
                inset: 0,
                width: "100vw",
                height: "100dvh",
                display: "block",
                background: "#140d08",
            }}
        />
    );
}
