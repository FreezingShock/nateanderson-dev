// What the reactor core shows: which zone's colours it wears, whether chroma is on, and which structures have bolted on.
// The drawing lives in core-art.ts; this file reads the game state and the player's choice (`nf core` in the console).

import { STATS, isUnlocked, type State, type StatId } from "./engine";
import { PART, PART_ORDER, type PartId } from "./core-parts";

const KEY = "nf-core-v1";
/** "zone" follows the newest zone you have worked in, "chroma" cycles every zone's colours, a stat id pins that zone */
export type CoreMode = "zone" | "chroma" | StatId;

let mode: CoreMode | null = null;
/** `nf core parts N` previews N structures for this visit only (null = your real progress) */
let preview: number | null = null;

export function coreMode(): CoreMode {
    if (mode) return mode;
    try {
        const v = localStorage.getItem(KEY);
        mode = v === "chroma" || STATS.some((x) => x.id === v) ? (v as CoreMode) : "zone";
    } catch {
        mode = "zone";
    }
    return mode;
}
export function setCoreMode(m: CoreMode) {
    mode = m;
    try {
        localStorage.setItem(KEY, m);
    } catch {}
}
export const corePreview = () => preview;
export const setCorePreview = (n: number | null) => (preview = n == null ? null : Math.max(0, Math.min(PART_ORDER.length, Math.round(n))));

/** Chroma unlocks at the first Ascend. */
export const chromaOpen = (s: State) => s.life.ascends >= 1;

/** Each structure bolts on when its part of the game opens. */
export const PART_WHY: Record<PartId, string> = {
    clamps: "first reboot",
    socket: "copper online",
    masts: "exploit lab online",
    docks: "first drone",
    ring1: "first ascend",
    glyphs: "first script learned",
    ring2: "nebula online",
    corona: "engrams online",
    ring3: "origin online",
};
export function coreParts(s: State): number {
    if (preview != null) {
        let m = 0;
        for (let k = 0; k < preview; k++) m |= PART[PART_ORDER[k]];
        return m;
    }
    let m = 0;
    if (s.life.reboots >= 1 || s.reboot > 0) m |= PART.clamps;
    if (isUnlocked(s, "copper")) m |= PART.socket;
    if (s.lab.seen) m |= PART.masts;
    if (s.drones.some((n) => n > 0) || Object.keys(s.dr?.svc ?? {}).length > 0) m |= PART.docks;
    if (s.life.ascends >= 1) m |= PART.ring1;
    if ((s.auto?.own.length ?? 0) > 0) m |= PART.glyphs;
    if (isUnlocked(s, "nebula")) m |= PART.ring2;
    if (isUnlocked(s, "engrams")) m |= PART.corona;
    if (isUnlocked(s, "origin")) m |= PART.ring3;
    return m;
}

const worked = (s: State, id: StatId) => id === "bytes" || (id === "reboot" ? s.reboot > 0 || s.life.reboots > 0 : (s.bought[id as Exclude<StatId, "bytes">]?.some((n) => n > 0) ?? false));

export interface CoreLook {
    zone: number;
    chroma: boolean;
    parts: number;
    drones: number;
    glyphs: number;
}
export function coreLook(s: State): CoreLook {
    // the newest zone you've worked in: open, and at least one button bought there (Bytes counts from the start), so a
    // fresh node keeps its cyan until the first Multiplier
    let newest = 0;
    STATS.forEach((x, i) => {
        if (i > newest && isUnlocked(s, x.id) && worked(s, x.id)) newest = i;
    });
    const m = coreMode();
    const pin = m !== "zone" && m !== "chroma" ? STATS.findIndex((x) => x.id === m) : -1;
    const zone = pin >= 0 && isUnlocked(s, STATS[pin].id) ? pin : newest;
    const pv = preview != null;
    return {
        zone,
        chroma: m === "chroma" && chromaOpen(s),
        parts: coreParts(s),
        drones: pv ? 3 : s.drones.filter((n) => n > 0).length,
        glyphs: pv ? 4 : s.auto?.own.length ?? 0,
    };
}
