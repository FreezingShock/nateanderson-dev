// Starwright settings: small preferences kept in this browser (sw-settings-v1), apart from the save so an import or a
// reset never changes them. Pure data plus a tiny store; the game and the console both read it.
import { ACHIEVEMENTS } from "./data";
import type { State } from "./engine";

export const SETTINGS_KEY = "sw-settings-v1";

export interface Settings {
    /** scene drawing: full art at 30 frames a second, or simple at 15 for slow machines */
    fx: "full" | "simple";
    /** the little notes that appear over the scene */
    notices: boolean;
    /** automatic supernova once the core passes this share of its collapse (0 = off). Unlocked by the "Ten stars" milestone. */
    autoNova: 0 | 1 | 1.5 | 2 | 3;
    /** automatic answer to a waiting visitor: take the lump, or the timed boost (off = you answer). Unlocked by twelve visitors. */
    autoVisitor: "off" | "lump" | "boost";
    /** welcome-back card after time away */
    welcome: boolean;
}

export const DEFAULTS: Settings = { fx: "full", notices: true, autoNova: 0, autoVisitor: "off", welcome: true };

export const AUTO_NOVA_STEPS: Settings["autoNova"][] = [0, 1, 1.5, 2, 3];
export const AUTO_VISITOR_STEPS: Settings["autoVisitor"][] = ["off", "lump", "boost"];

/** What unlocks each automation: an almanac milestone, with its plain description. */
export const UNLOCKS = {
    autoNova: { ach: "nova10", need: "Go supernova ten times" },
    autoVisitor: { ach: "guest12", need: "Answer twelve visitors" },
} as const;

export const unlocked = (s: Pick<State, "ach">, key: keyof typeof UNLOCKS) => s.ach.includes(UNLOCKS[key].ach);
export const unlockName = (key: keyof typeof UNLOCKS) => ACHIEVEMENTS.find((a) => a.id === UNLOCKS[key].ach)?.name ?? "";

export function parseSettings(raw: unknown): Settings {
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    return {
        fx: r.fx === "simple" ? "simple" : "full",
        notices: r.notices !== false,
        autoNova: AUTO_NOVA_STEPS.includes(r.autoNova as Settings["autoNova"]) ? (r.autoNova as Settings["autoNova"]) : 0,
        autoVisitor: AUTO_VISITOR_STEPS.includes(r.autoVisitor as Settings["autoVisitor"]) ? (r.autoVisitor as Settings["autoVisitor"]) : "off",
        welcome: r.welcome !== false,
    };
}

let cache: Settings | null = null;
const listeners = new Set<() => void>();

export function getSettings(): Settings {
    if (cache) return cache;
    let raw: unknown = null;
    try { raw = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "null"); } catch { /* none yet */ }
    cache = parseSettings(raw);
    return cache;
}

export function setSettings(patch: Partial<Settings>): Settings {
    cache = parseSettings({ ...getSettings(), ...patch });
    try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(cache)); } catch { /* private mode: lasts until the tab closes */ }
    listeners.forEach((f) => f());
    return cache;
}

export const onSettings = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

/** Step to the next value of a list, wrapping. */
export const cycle = <T,>(list: readonly T[], cur: T): T => list[(list.indexOf(cur) + 1) % list.length];
