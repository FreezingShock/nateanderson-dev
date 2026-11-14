"use client";

import { useEffect, useRef } from "react";
import { createVoxelIsland, heightAt } from "@/lib/automation/render";
import { scatterProps } from "@/lib/automation/models/props";
import { depositModel, gradeOf, type ResourceId } from "@/lib/automation/models/resources";
import { getMachineModel } from "@/lib/automation/models/machines";
import { SITES } from "@/lib/automation/sim";

declare global {
    interface Window {
        __siteShot?: { ready: boolean; snap: () => string };
    }
}

// Per-site look: camera angle and light, so each picture reads as its own place.
const LOOKS: Record<string, { cam: [number, number, number]; target: [number, number, number]; t: number; seed: number; density: number }> = {
    ridge: { cam: [-14, 11, 15], target: [-1, 0, 0], t: 0.42, seed: 11, density: 0.7 },
    cove: { cam: [15, 10, 14], target: [-1, 0, 0], t: 0.5, seed: 7, density: 1.2 },
    "high-bank": { cam: [-3, 15, 17], target: [0, 0, 0], t: 0.35, seed: 23, density: 1 },
    quarry: { cam: [-15, 9, -11], target: [0, 0, 0], t: 0.55, seed: 41, density: 0.5 },
};

export default function SiteShot() {
    const ref = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) return;
        const q = new URLSearchParams(window.location.search);
        const site = SITES.find((s) => s.id === q.get("site")) ?? SITES[0];
        const look = LOOKS[site.id] ?? LOOKS.ridge;
        const island = createVoxelIsland(canvas, { quality: 2, dither: true, timeOfDay: look.t, cycle: false, lowFx: true });
        island.setScenery(
            scatterProps({
                heightAt,
                isFree: (x, z) => !(Math.abs(x) < 9.6 && Math.abs(z) < 6.6),
                waterLevel: -1.3,
                minX: -26, maxX: 26, minZ: -20, maxZ: 20,
                seed: look.seed,
                density: look.density,
                factoryDistance: (x, z) => Math.hypot(Math.max(Math.abs(x) - 9.2, 0), Math.max(Math.abs(z) - 6.2, 0)),
                clearRadius: 2.5,
            })
        );
        // Site coordinates map onto the 18 x 12 plateau; one ore node per cell, as in the game.
        const toBoard = (x: number, z: number): [number, number] => [Math.round((x / site.width - 0.5) * 16), Math.round((z / site.depth - 0.5) * 10)];
        const hub = getMachineModel("hub");
        const [hx, hz] = toBoard(site.hub.x, site.hub.z);
        if (hub) island.placeModel("hub", hub, { cell: { x: hx - 1, z: hz - 1 }, rot: 0 });
        site.nodes.forEach((n, i) => {
            const [x, z] = toBoard(n.x, n.z);
            island.placeModel(`ore${i}`, depositModel(n.item as ResourceId, gradeOf(n.purity), i), { cell: { x, z }, rot: 0 });
        });
        island.camera.position.set(...look.cam);
        island.controls?.target.set(...look.target);
        island.controls?.update();
        island.resize();
        island.start();
        window.__siteShot = { ready: true, snap: () => island.snapshot() };
        return () => island.dispose();
    }, []);

    return <canvas ref={ref} style={{ position: "fixed", inset: 0, width: "100vw", height: "100dvh", display: "block" }} />;
}
