// Node Farm's mixer. Every Node Farm sound goes through `nfx(name, arg?, system?)`, which belongs to one system and plays
// at that system's volume (0 to 100%, kept per device in "nf-mix-v1", not in the save). The master volume and the sound
// switch still come first (lib/sound/engine.ts), so the site-wide settings always win.
//
// Systems, and what lives in each:
//   buttons     buying a tier, first purchase of a tier
//   unlocks     decrypts, goals, milestones, learned scripts
//   runs        Ascend, Handover, Reboot, stress tests, the ending
//   automation  scripts, drones, rigs
//   events      zone events (Rogue process and Cold storage included)
//   world       caches, core vent, scans
//   interface   tabs, menus, prints, Codex pages, refusals
//   hum         the reactor's low drone
// Add a sound: write it in lib/sound/sounds.ts, give it a system in HOME below, and call nfx("name").
import { useSyncExternalStore } from "react";
import { sfx, type SfxName } from "@/lib/sound/sounds";
import { setLevel } from "@/lib/sound/engine";

export type NfSystem = "buttons" | "unlocks" | "runs" | "automation" | "events" | "world" | "interface" | "hum";

export const NF_SYSTEMS: { id: NfSystem; label: string; note: string; sample: () => void }[] = [
    { id: "buttons", label: "buttons", note: "buying, tier-ups", sample: () => nfx("nfBuy", { tier: 3 }, "buttons") },
    { id: "unlocks", label: "unlocks", note: "decrypts, goals, milestones", sample: () => nfx("nfDecrypt", undefined, "unlocks") },
    { id: "runs", label: "runs", note: "Ascend, Handover, stress tests", sample: () => nfx("nfHandover", undefined, "runs") },
    { id: "automation", label: "automation", note: "scripts, drones, rigs", sample: () => nfx("nfRig", undefined, "automation") },
    { id: "events", label: "events", note: "zone events", sample: () => nfx("nfZone", { good: true }, "events") },
    { id: "world", label: "world", note: "caches, core vent, scans", sample: () => nfx("nfCache", undefined, "world") },
    { id: "interface", label: "interface", note: "tabs, menus, prints, Codex", sample: () => nfx("nfPrint", 4, "interface") },
    { id: "hum", label: "hum", note: "the reactor drone", sample: () => {} },
];

/** Which system a sound belongs to when the caller does not say. */
const HOME: Partial<Record<SfxName, NfSystem>> = {
    nfBuy: "buttons", nfTierUp: "buttons",
    nfDecrypt: "unlocks", nfGoal: "unlocks",
    nfAscend: "runs", nfReboot: "runs", nfHandover: "runs", nfStress: "runs", nfEnd: "runs",
    nfScript: "automation", nfDrone: "automation", nfRig: "automation",
    nfAlert: "events", nfBreach: "events", nfZone: "events", reveal: "events", charge: "events", collect: "events",
    nfCache: "world", nfVent: "world",
};

const KEY = "nf-mix-v1";
const DEFAULT: Record<NfSystem, number> = { buttons: 1, unlocks: 1, runs: 1, automation: 1, events: 1, world: 1, interface: 1, hum: 1 };
let mix: Record<NfSystem, number> = { ...DEFAULT };
let loaded = false;
const subs = new Set<() => void>();

function load() {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
        const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
        if (raw && typeof raw === "object") {
            const next = { ...DEFAULT };
            for (const k of Object.keys(DEFAULT) as NfSystem[]) if (typeof raw[k] === "number" && Number.isFinite(raw[k])) next[k] = Math.min(1, Math.max(0, raw[k]));
            mix = next;
        }
    } catch {
        /* private mode: keep defaults */
    }
}

export function getMix(): Record<NfSystem, number> {
    load();
    return mix;
}
export const getVol = (sys: NfSystem): number => getMix()[sys];

export function setVol(sys: NfSystem, v: number) {
    load();
    mix = { ...mix, [sys]: Math.min(1, Math.max(0, Number.isFinite(v) ? v : 1)) };
    try { localStorage.setItem(KEY, JSON.stringify(mix)); } catch {}
    subs.forEach((f) => f());
}
export function resetMix() {
    load();
    mix = { ...DEFAULT };
    try { localStorage.removeItem(KEY); } catch {}
    subs.forEach((f) => f());
}

/** Play a Node Farm sound at its system's volume. Silent at 0%. */
export function nfx(name: SfxName, arg?: unknown, system?: NfSystem) {
    const v = getVol(system ?? HOME[name] ?? "interface");
    if (v <= 0.001) return;
    // squared so the sliders feel even to the ear, like the master volume
    setLevel(v * v);
    try {
        sfx(name, arg);
    } finally {
        setLevel(1);
    }
}

/** The hum's own volume (0..1), passed to setHum. */
export const humVol = () => getVol("hum") ** 2;

export function useMix() {
    return useSyncExternalStore(
        (f) => { subs.add(f); return () => { subs.delete(f); }; },
        getMix,
        () => DEFAULT,
    );
}
