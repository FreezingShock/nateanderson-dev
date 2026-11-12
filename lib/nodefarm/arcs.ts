// Zone arcs: the board groups its zones into chapters. Add a new arc (or new zone ids to an arc) here and the board,
// the headers and the remembered collapse state follow; nothing else lists the groups.
import { ARC_HOOKS, STATS, TIERS, type ButtonStat, type State } from "./engine";

export type Arc = { id: string; name: string; blurb: string; color: string; zones: readonly string[]; /** era scene file (scene-<n>.webp) used as the header art; arcs without one get a colour wash */ scene?: number };

export const ARCS: readonly Arc[] = [
    { id: "rack", name: "The rack", blurb: "Bytes, amps and the first power.", color: "#2fd8e8", zones: ["bytes", "mult", "reboot", "copper"], scene: 1 },
    { id: "fab", name: "The fab", blurb: "Wafers, crystal and raw signal.", color: "#7aa2ff", zones: ["silicon", "quartz", "aether"], scene: 4 },
    { id: "hollow", name: "The hollow", blurb: "Glyphs, glass, void metal and stopped time.", color: "#9a7bff", zones: ["runes", "starglass", "voidsteel", "chrono"], scene: 8 },
    { id: "deep", name: "Deep space", blurb: "Gas, dead stars and a point that pulls.", color: "#ff8ad8", zones: ["nebula", "pulsars", "singularity"], scene: 11 },
    { id: "origin", name: "The origin", blurb: "Memory, mirrors and the first node.", color: "#3dff6e", zones: ["engrams", "paradox", "origin"], scene: 13 },
    { id: "overgrowth", name: "Overgrowth", blurb: "Spores, threads, pollen and the farm in flower. Opens after the first Handover.", color: "#5cf0c0", zones: ["spores", "mycelium", "pollen", "bloom"], scene: 18 },
    { id: "descent", name: "Descent", blurb: "Rock, magma, hollow stone and a buried sun. Opens after the first Handover.", color: "#ff9a2a", zones: ["basalt", "magma", "geodes", "sunstone"], scene: 22 },
];

export const arcKey = (id: string) => `arc:${id}`;
export const arcOf = (stat: string) => ARCS.find((a) => a.zones.includes(stat));
/** Buttons of an arc that were ever pressed (kept through Ascend), out of all of them. Zones without buttons (Bytes) do not count. */
export function arcProgress(s: State, zones: readonly string[]) {
    let built = 0;
    let total = 0;
    for (const z of zones) {
        if (z === "bytes") continue;
        total += TIERS;
        const m = s.seen?.[z as ButtonStat] ?? 0;
        for (let k = 0; k < TIERS; k++) if (m & (1 << k)) built++;
    }
    return { built, total };
}
export const arcCleared = (s: State, a: Arc) => { const p = arcProgress(s, a.zones); return p.total > 0 && p.built >= p.total; };
export const arcsCleared = (s: State) => ARCS.reduce((n, a) => n + (arcCleared(s, a) ? 1 : 0), 0);
ARC_HOOKS.cleared = arcsCleared;
/** Zone number (01 to 25), the same one the zone panels print. */
export const zoneNo = (id: string) => STATS.findIndex((x) => x.id === id) + 1;
