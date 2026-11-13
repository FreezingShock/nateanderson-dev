// What the reactor core shows: which zone's colours it wears, which skin, which structures have bolted on, and what is
// happening (zone events). The drawing lives in core-art.ts; this file reads the game state and the player's choice
// (`nf core` in the console).

import { FW, SECRETS, STATS, isUnlocked, type State, type StatId } from "../engine";
import { CORE_EVENTS, PART, PART_ORDER, SKINS, type PartId, type SkinId } from "./core-parts";

const KEY = "nf-core-v1";
/** a skin name, or a stat id to pin that zone's colours ("zone" follows the newest zone you've worked in) */
export type CoreMode = SkinId | StatId;

let mode: CoreMode | null = null;
/** `nf core parts N` previews N structures for this visit only (null = your real progress) */
let preview: number | null = null;

export function coreMode(): CoreMode {
    if (mode) return mode;
    try {
        const v = localStorage.getItem(KEY);
        mode = (SKINS as readonly string[]).includes(v ?? "") || STATS.some((x) => x.id === v) ? (v as CoreMode) : "zone";
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

/** What unlocks each skin. */
export const SKIN_WHY: Record<Exclude<SkinId, "zone">, string> = {
    chroma: "your first Ascend",
    aurora: "your first Handover",
    gold: "opening Origin",
    mono: "finding every secret",
};
export function skinOpen(s: State, k: SkinId): boolean {
    if (k === "zone") return true;
    if (k === "chroma") return s.life.ascends >= 1;
    if (k === "aurora") return (s.hand?.count ?? 0) >= 1;
    if (k === "gold") return isUnlocked(s, "origin");
    return SECRETS.every((x) => s.ach.includes(x.id));
}
/** Chroma unlocks at the first Ascend. */
export const chromaOpen = (s: State) => skinOpen(s, "chroma");

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
    rigs: "first rig level",
    shell: "first handover",
    vines: "spores online",
    crust: "basalt online",
};
/** each zone's rig level (the Glyph hall's carvings count as its rig) */
function rigLevels(s: State): number[] {
    const lv = s.rig?.lv ?? {};
    return STATS.map((x) => {
        let n = lv[x.id] ?? 0;
        for (const k in lv) if (k.startsWith(`${x.id}:`)) n = Math.max(n, lv[k]);
        return n;
    });
}
export function coreParts(s: State, rigs = rigLevels(s)): number {
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
    if (rigs.some((n) => n > 0)) m |= PART.rigs;
    if ((s.hand?.count ?? 0) >= 1) m |= PART.shell;
    if (isUnlocked(s, "spores")) m |= PART.vines;
    if (isUnlocked(s, "basalt")) m |= PART.crust;
    return m;
}

const worked = (s: State, id: StatId) => id === "bytes" || (id === "reboot" ? s.reboot > 0 || s.life.reboots > 0 : (s.bought[id as Exclude<StatId, "bytes">]?.some((n) => n > 0) ?? false));

export interface CoreLook {
    zone: number;
    /** index into SKINS (0 = zone colours) */
    skin: number;
    parts: number;
    drones: number;
    glyphs: number;
    /** rig level per zone */
    rigs: number[];
    /** 0..1 share of the Firmware owned (lights the Handover shell) */
    fw: number;
    /** the running zone event: index + 1 in CORE_EVENTS, 0 for none */
    event: number;
}
export function coreLook(s: State): CoreLook {
    // the newest zone you've worked in: open, and at least one button bought there (Bytes counts from the start), so a
    // fresh node keeps its cyan until the first Multiplier
    let newest = 0;
    STATS.forEach((x, i) => {
        if (i > newest && isUnlocked(s, x.id) && worked(s, x.id)) newest = i;
    });
    const m = coreMode();
    const pin = (SKINS as readonly string[]).includes(m) ? -1 : STATS.findIndex((x) => x.id === m);
    const zone = pin >= 0 && isUnlocked(s, STATS[pin].id) ? pin : newest;
    const skin = (SKINS as readonly string[]).indexOf(m);
    const pv = preview != null;
    const rigs = rigLevels(s);
    const ev = s.ze?.act?.[0];
    return {
        zone,
        skin: skin > 0 && skinOpen(s, m as SkinId) ? skin : 0,
        parts: coreParts(s, rigs),
        drones: pv ? 3 : s.drones.filter((n) => n > 0).length,
        glyphs: pv ? 4 : s.auto?.own.length ?? 0,
        rigs: pv ? STATS.map((_, i) => (i < 9 ? 1 + (i % 4) : 0)) : rigs,
        fw: pv ? 0.5 : FW.length ? (s.hand?.fw.length ?? 0) / FW.length : 0,
        event: ev ? CORE_EVENTS.indexOf(ev.kind) + 1 : 0,
    };
}
