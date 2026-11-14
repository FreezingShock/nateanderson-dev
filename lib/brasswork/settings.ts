// Brasswork settings: saved in this browser so they survive a reload. Missing or damaged data falls back to defaults.
import type { HudSettings } from "@/lib/automation/types";

const KEY = "bw-settings-v1";

export function loadSettings(defaults: HudSettings): HudSettings {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return { ...defaults };
        const p = JSON.parse(raw) as Partial<HudSettings>;
        const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
        return {
            sound: bool(p.sound, defaults.sound),
            reduceMotion: bool(p.reduceMotion, defaults.reduceMotion),
            lowFx: bool(p.lowFx, defaults.lowFx),
            showRates: bool(p.showRates, defaults.showRates),
            numberFormat: p.numberFormat === "full" || p.numberFormat === "short" ? p.numberFormat : defaults.numberFormat,
        };
    } catch {
        return { ...defaults };
    }
}

export function saveSettings(s: HudSettings) {
    try {
        localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
        /* private window or full storage: the setting still works for this visit */
    }
}
