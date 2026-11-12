import { STATS, isUnlocked, type State } from "./engine";

/**
 * Era scenery: one dither landscape per stretch of the chain (art: scripts/naos-art/nodefarm-scenes.py, files
 * public/naos/nodefarm/scene-<n>.webp). The era is the furthest stat the current run has opened, so it moves forward
 * as the player decrypts new materials. Pure: reads the state only.
 */
export const ERAS = [
    { name: "Uplink", stats: ["bytes", "mult"] },
    { name: "Foundry", stats: ["reboot", "copper"] },
    { name: "Wafer", stats: ["silicon"] },
    { name: "Lattice", stats: ["quartz"] },
    { name: "Aurora", stats: ["aether"] },
    { name: "Monolith", stats: ["runes"] },
    { name: "Glass", stats: ["starglass"] },
    { name: "Eclipse", stats: ["voidsteel"] },
    { name: "Clockwork", stats: ["chrono", "nebula", "pulsars", "singularity", "engrams", "paradox", "origin"] },
] as const;

export function eraOf(s: State): number {
    let era = 0;
    for (const def of STATS) {
        if (!isUnlocked(s, def.id)) continue;
        const i = ERAS.findIndex((e) => (e.stats as readonly string[]).includes(def.id));
        if (i > era) era = i;
    }
    return era;
}

export const eraLabel = (era: number) => `ERA ${String(era + 1).padStart(2, "0")} // ${ERAS[era]?.name.toUpperCase() ?? ""}`;
