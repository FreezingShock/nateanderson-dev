// Time-of-day accent for the naOS chrome and dither art. Pacific time decides the band; a viewer can pin one.
//
// Bands (America/Los_Angeles, hour 0 to 23):
//   amber   05:00 to 11:59  morning, warm light
//   cyan    12:00 to 16:59  afternoon, the original live colour
//   violet  17:00 to 04:59  evening and night
//
// The attribute `data-accent` on <html> is what CSS reads (camino.tokens.css). ACCENT_SCRIPT sets it before first
// paint so a page never opens in the wrong colour. A pinned choice is per-viewer (localStorage), never shared.

export const ACCENTS = ["amber", "cyan", "violet"] as const;
export type Accent = (typeof ACCENTS)[number];
export type AccentMode = Accent | "auto";

export const ACCENT_KEY = "site-accent-v1";
export const ACCENT_TZ = "America/Los_Angeles";

export const ACCENT_LABEL: Record<Accent, string> = { amber: "amber", cyan: "cyan", violet: "violet" };

/** Band for a Pacific hour (0 to 23, fractions allowed). */
export function accentForHour(h: number): Accent {
    if (h >= 5 && h < 12) return "amber";
    if (h >= 12 && h < 17) return "cyan";
    return "violet";
}

/** Pacific wall-clock hour and minute for a date. */
export function pacificClock(d: Date = new Date()): { hour: number; minute: number } {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: ACCENT_TZ, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(d);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    return { hour: get("hour") % 24, minute: get("minute") };
}

export function accentForNow(d: Date = new Date()): Accent {
    return accentForHour(pacificClock(d).hour);
}

export function isAccentMode(v: unknown): v is AccentMode {
    return v === "auto" || v === "amber" || v === "cyan" || v === "violet";
}

/** Plain-JS copy of the rule above, for the inline script that runs before the app loads. Keep the bands in step. */
export const ACCENT_SCRIPT =
    "(function(){var m=null;try{m=localStorage.getItem(" +
    JSON.stringify(ACCENT_KEY) +
    ")}catch(e){}var h=0;try{h=+new Intl.DateTimeFormat('en-US',{timeZone:" +
    JSON.stringify(ACCENT_TZ) +
    ",hour:'numeric',hourCycle:'h23'}).format(new Date())%24}catch(e){h=12}var a=h>=5&&h<12?'amber':h>=12&&h<17?'cyan':'violet';if(m==='amber'||m==='cyan'||m==='violet')a=m;document.documentElement.setAttribute('data-accent',a);})();";
