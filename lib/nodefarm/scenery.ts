import { STATS, isUnlocked, type State } from "./engine";

/**
 * Era scenery: one dither landscape per stretch of the chain (art: scripts/naos-art/nodefarm-scenes.py for eras 0-8,
 * scripts/naos-art/nodefarm-scenes-deep.py for 9-14; files public/naos/nodefarm/scene-<n>.webp). The era is the furthest
 * stat the current run has opened, so it moves forward as the player decrypts new materials. Pure: reads the state only.
 *
 * `drift` marks the layered eras (9 on): their ground is a far layer that drifts sideways (one 480 art px tile every
 * `drift` seconds; 0 = it stays put) behind a near layer with an animated overlay. See app/camino/nodefarm-scenery.css.
 */
export type Era = { name: string; stats: readonly string[]; drift?: number };

export const ERAS: readonly Era[] = [
    { name: "Uplink", stats: ["bytes", "mult"] },
    { name: "Foundry", stats: ["reboot", "copper"] },
    { name: "Wafer", stats: ["silicon"] },
    { name: "Lattice", stats: ["quartz"] },
    { name: "Aurora", stats: ["aether"] },
    { name: "Monolith", stats: ["runes"] },
    { name: "Glass", stats: ["starglass"] },
    { name: "Eclipse", stats: ["voidsteel"] },
    { name: "Clockwork", stats: ["chrono"] },
    { name: "Nursery", stats: ["nebula"], drift: 420 },
    { name: "Beacon", stats: ["pulsars"], drift: 720 },
    { name: "Horizon", stats: ["singularity"], drift: 900 },
    { name: "Archive", stats: ["engrams"], drift: 0 },
    { name: "Mirror", stats: ["paradox"], drift: 600 },
    { name: "Root", stats: ["origin"], drift: 0 },
];

/** True for the eras drawn in layers (far, near, animated overlay). */
export const isLayered = (era: number) => ERAS[era]?.drift !== undefined;

export function eraOf(s: State): number {
    let era = 0;
    for (const def of STATS) {
        if (!isUnlocked(s, def.id)) continue;
        const i = ERAS.findIndex((e) => e.stats.includes(def.id));
        if (i > era) era = i;
    }
    return era;
}

export const eraLabel = (era: number) => `ERA ${String(era + 1).padStart(2, "0")} // ${ERAS[era]?.name.toUpperCase() ?? ""}`;
