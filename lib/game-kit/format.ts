// Game kit: number and time formatting shared by every game. Pure, DOM-free and relative-import-only, so engines can
// re-export these and the node tests can run them. Each style reproduces the output a game already shipped, character
// for character (tests/games/game-kit.test.mjs checks them against the old copies), so moving a game onto the kit
// changes nothing on screen.
//
//   style      1234       123456     1.5e7      1e40        non-finite  used by
//   "suffix"   1.23K      123K       15.0M      1.00e+40*   "∞"         Node Farm, new games (default)
//   "kilo"     1.23K      123K       15.00M     1.00e40     "0"         Groundbreak
//   "grouped"  1,234      123,456    1.50e7     1.00e40     "0"         Starwright
//   "compact"  1.23K      123.5K     15M        (B max)     "–"         Brasswork HUD
//   "full"     1,234      123,456    15,000,000             "–"         Brasswork "Full numbers"
//   "sci"      1.23e3     1.23e5     1.50e7     1.00e40     "∞"
//   "eng"      1.23e3     123e3      15.0e6     10.0e39     "∞"
//   * suffix runs to Dc (1e33), then scientific.

export type NumberStyle = "suffix" | "kilo" | "grouped" | "compact" | "full" | "sci" | "eng";

const SUF = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
const KILO_SUF = ["M", "B", "T", "Qa", "Qi"];

/** Mantissa and power of ten: 15000 -> "1.50e4". */
const sciOf = (n: number, digits: number) => {
    const x = Math.floor(Math.log10(n));
    return `${(n / Math.pow(10, x)).toFixed(digits)}e${x}`;
};

/** Under 1000: whole numbers as is, small fractions with `digits` decimals. Shared by kilo, grouped and suffix. */
const small = (n: number, digits: number) => (n < 10 && n % 1 !== 0 ? n.toFixed(digits) : Math.floor(n).toString());

function suffix(n: number, digits: number, style: "suffix" | "sci" | "eng"): string {
    if (!Number.isFinite(n)) return "∞";
    if (n < 0) return "-" + suffix(-n, digits, style);
    if (n < 1000) return n < 10 && n % 1 ? n.toFixed(digits) : n < 100 && n % 1 ? n.toFixed(Math.max(0, digits - 1)) : Math.floor(n).toString();
    if (style === "sci") return n.toExponential(2).replace("+", "");
    const e = Math.floor(Math.log10(n) / 3);
    if (style === "eng") {
        const v = n / Math.pow(1000, e);
        return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0)) + "e" + e * 3;
    }
    if (e >= SUF.length) return n.toExponential(2).replace("+", "");
    const v = n / Math.pow(1000, e);
    return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0)) + SUF[e];
}

function kilo(n: number, digits: number): string {
    if (!Number.isFinite(n)) return "0";
    if (n < 0) return "-" + kilo(-n, digits);
    if (n < 1000) return small(n, digits);
    if (n < 1e6) return (n / 1e3).toFixed(n < 1e4 ? 2 : n < 1e5 ? 1 : 0) + "K";
    const e = Math.floor(Math.log10(n) / 3);
    if (e - 2 < KILO_SUF.length) return (n / Math.pow(10, e * 3)).toFixed(digits) + KILO_SUF[e - 2];
    return sciOf(n, digits);
}

function grouped(n: number, digits: number): string {
    if (!Number.isFinite(n)) return "0";
    if (n < 0) return "-" + grouped(-n, digits);
    if (n < 1000) return small(n, digits);
    if (n < 1e6) return Math.floor(n).toLocaleString("en-US");
    return sciOf(n, digits);
}

const COMPACT_UNITS = [[1e9, "B"], [1e6, "M"], [1e3, "K"]] as const;

function compact(n: number, full: boolean): string {
    if (!Number.isFinite(n)) return "–";
    if (full) return Math.round(n).toLocaleString("en-US");
    const abs = Math.abs(n);
    for (const [value, sfx] of COMPACT_UNITS) {
        if (abs >= value) {
            const x = n / value;
            const text = Math.abs(x) < 10 ? x.toFixed(2) : x.toFixed(1);
            return text.replace(/\.?0+$/, "") + sfx;
        }
    }
    if (abs < 10 && !Number.isInteger(n)) return n.toFixed(1);
    return String(Math.round(n));
}

/**
 * Formats a number in one of the kit's styles (see the table at the top of this file). `digits` is the decimals for
 * small fractions and mantissas (default 2); the compact and full styles ignore it.
 */
export function formatNumber(n: number, style: NumberStyle = "suffix", digits = 2): string {
    switch (style) {
        case "kilo": return kilo(n, digits);
        case "grouped": return grouped(n, digits);
        case "compact": return compact(n, false);
        case "full": return compact(n, true);
        default: return suffix(n, digits, style);
    }
}

/** A formatter bound to one style, for a game's `fmt`: `export const fmt = numberFormatter("kilo")`. */
export const numberFormatter = (style: NumberStyle) => (n: number, digits = 2) => formatNumber(n, style, digits);

/** "+1.2K/s". Positive rates get a plus sign. */
export function formatRate(n: number, style: NumberStyle = "suffix", digits = 2): string {
    return `${n > 0 ? "+" : ""}${formatNumber(n, style, digits)}/s`;
}

/** A coarse age for time away and saves: "45 s", "12 min", "3.5 h". */
export function formatAge(sec: number): string {
    if (sec < 90) return `${Math.floor(sec)} s`;
    if (sec < 5400) return `${Math.floor(sec / 60)} min`;
    return `${(sec / 3600).toFixed(1)} h`;
}

/** A countdown clock: "0:07", "12:30". Rounds up, never below zero. */
export function formatClock(sec: number): string {
    const s = Math.max(0, Math.ceil(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** A short duration: "45s", "3m 20s", "2h 5m". */
export function formatDuration(sec: number): string {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), x = sec % 60;
    return h ? `${h}h ${m}m` : m ? `${m}m ${x}s` : `${x}s`;
}

/** "1 star", "3 stars". Pass `many` for irregular plurals. */
export const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
