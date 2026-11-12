// Staged zone art: each zone panel shows a dither scene that grows from 0 to 7 sprites as the zone matures.
// Sheets are drawn by scripts/naos-art/nodefarm-zone-*.py with the shared kit scripts/naos-art/nodefarm_zone_kit.py
// (contract in docs/node-farm.md, "Zone art"). This file only decides which stage a zone is at. No React.
import { STATS, TIERS, amount, button, type ButtonStat, type State, type StatId } from "./engine";

/** Zones that have a sheet at /naos/nodefarm/zone-<id>.webp. Art lanes add their ids here. */
export const ZONE_ART: readonly StatId[] = ["bytes"];

export const ART = { W: 288, H: 96, STAGES: 8, FRAMES: 6, FPS: 6 } as const;
export const MAX_STAGE = ART.STAGES - 1;

/** How many of a zone's units count as "fully built" for the owned half of the blend (log scale, so the first few count most). */
const OWN_FULL: Partial<Record<StatId, number>> = { mult: 400, reboot: 150 };
const OWN_FULL_DEFAULT = 240;

/** The buttons whose prices measure a zone's progress. Bytes has none of its own, so it uses what Bytes buy: the Multiplier row. */
const priced = (id: StatId): ButtonStat => (id === "bytes" ? "mult" : (id as ButtonStat));

/**
 * Afford, 0..6: how many of the zone's six buttons you can pay for right now, plus a log-scale fraction of the way to the next
 * one. 6 means even the top tier is affordable.
 */
export function affordScore(s: State, id: StatId): number {
    const stat = priced(id);
    const costs = Array.from({ length: TIERS }, (_, k) => button(s, stat, k));
    const have = amount(s, costs[0].pays);
    const ok = costs.filter((b) => have >= b.cost).map((b) => b.cost);
    if (ok.length >= TIERS) return TIERS;
    const next = Math.min(...costs.filter((b) => have < b.cost).map((b) => b.cost));
    const prev = ok.length ? Math.max(...ok) : next / 1000;
    const frac = have <= prev ? 0 : Math.log(have / prev) / Math.log(next / prev);
    return ok.length + Math.max(0, Math.min(0.999, frac));
}

/** Owned, 0..6: how much of the zone you have built this run. */
export function ownedScore(s: State, id: StatId): number {
    if (id === "bytes") return s.bought.mult.filter((n) => n > 0).length; // tiers of Multiplier you have running
    const total = s.bought[id as ButtonStat].reduce((a, n) => a + n, 0) + (id === "reboot" ? s.reboot : 0);
    const full = OWN_FULL[id] ?? OWN_FULL_DEFAULT;
    return Math.min(TIERS, (TIERS * Math.log1p(total)) / Math.log1p(full));
}

/**
 * Changes when the art may shrink again: only on Ascend. A Reboot wipes Bytes and Multipliers every few minutes, so those two
 * zones keep the best stage any Reboot cycle reached, which makes their art a picture of the whole run.
 */
export function resetKey(s: State, _id: StatId): number {
    return s.life.ascends;
}

/**
 * The stage, 0..7. 0 = nothing built yet. Blend: 60% what you can afford, 40% what you own. Being able to pay for the zone's
 * top button always means stage 7. Reboots are the exception (see below).
 */
export function zoneStage(s: State, id: StatId): number {
    const o = ownedScore(s, id);
    // Reboot prices climb with every Reboot, so that zone is measured by how many you have done
    if (id === "reboot") return o <= 0 ? 0 : Math.min(MAX_STAGE, 1 + Math.floor(o));
    const a = affordScore(s, id);
    if (a >= TIERS) return MAX_STAGE;
    if (o <= 0 && a < 1) return 0;
    return Math.max(1, Math.min(MAX_STAGE - 1, 1 + Math.floor(0.6 * a + 0.4 * o)));
}

// ---- ratchet: the art never shrinks because you spent; it only goes back after a reset. Kept per browser, not in the save.
const KEY = "nf-zone-art-v1";
type Mem = Partial<Record<StatId, [stage: number, reset: number]>>;
let mem: Mem | null = null;
const load = (): Mem => {
    if (mem) return mem;
    try {
        mem = JSON.parse(localStorage.getItem(KEY) || "{}") as Mem;
    } catch {
        mem = {};
    }
    return mem;
};
let saveT: ReturnType<typeof setTimeout> | null = null;
const persist = () => {
    if (saveT) return;
    saveT = setTimeout(() => {
        saveT = null;
        try {
            localStorage.setItem(KEY, JSON.stringify(mem));
        } catch {
            /* private mode: the ratchet just lasts this visit */
        }
    }, 2000);
};

/** Admin preview: force every zone to one stage (null = live). */
let preview: number | null = null;
const listeners = new Set<() => void>();
export function setStagePreview(n: number | null) {
    preview = n == null ? null : Math.max(0, Math.min(MAX_STAGE, Math.round(n)));
    listeners.forEach((f) => f());
}
export const getStagePreview = () => preview;
export function onStagePreview(f: () => void) {
    listeners.add(f);
    return () => void listeners.delete(f);
}

/** The stage to draw: the live stage, held at its peak until the zone is reset. */
export function shownStage(s: State, id: StatId): number {
    if (preview != null) return preview;
    const live = zoneStage(s, id);
    if (typeof window === "undefined") return live;
    const m = load();
    const key = resetKey(s, id);
    const prev = m[id];
    let out = live;
    if (prev && prev[1] === key) out = Math.max(live, prev[0]);
    if (!prev || prev[0] !== out || prev[1] !== key) {
        m[id] = [out, key];
        persist();
    }
    return out;
}

/** For docs and the admin panel: every zone's live stage and the two halves of the blend. */
export function stageReport(s: State) {
    return STATS.filter((d) => ZONE_ART.includes(d.id)).map((d) => ({ id: d.id, stage: zoneStage(s, d.id), afford: affordScore(s, d.id), owned: ownedScore(s, d.id) }));
}

export const hasZoneArt = (id: StatId) => ZONE_ART.includes(id);
