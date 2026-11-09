import dailySchedule from "@/lib/data/daily-schedule.json";

// Pure helpers for the Outline Guesser (no React): geography maths, name
// matching, seeded daily picks and Pacific-time dates.

export interface Country {
    /** ISO 3166-1 alpha-2 code (XK for Kosovo). */
    c: string;
    /** Display name. */
    n: string;
    /** Continent. */
    k: string;
    /** Difficulty tier: 0 easy, 1 medium, 2 hard, 3 expert. */
    t: number;
    lat: number;
    lon: number;
    /** SVG path in a 100x100 box. */
    d: string;
}

export const MAX_GUESSES = 6;
export const MAX_HINTS = 3;
/** Half the Earth's circumference: the farthest two points can be. */
const MAX_KM = 20_000;
const R_KM = 6371;
const rad = Math.PI / 180;

export function haversineKm(a: Country, b: Country): number {
    const dLat = (b.lat - a.lat) * rad;
    const dLon = (b.lon - a.lon) * rad;
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial compass bearing from a to b, degrees clockwise from north. */
export function bearingDeg(a: Country, b: Country): number {
    const y = Math.sin((b.lon - a.lon) * rad) * Math.cos(b.lat * rad);
    const x =
        Math.cos(a.lat * rad) * Math.sin(b.lat * rad) -
        Math.sin(a.lat * rad) *
            Math.cos(b.lat * rad) *
            Math.cos((b.lon - a.lon) * rad);
    return (Math.atan2(y, x) / rad + 360) % 360;
}

/** Snap a bearing to one of 8 compass directions (0 = N, 1 = NE, ...). */
export const direction8 = (deg: number) => Math.round(deg / 45) % 8;
export const ARROW_EMOJI = ["⬆️", "↗️", "➡️", "↘️", "⬇️", "↙️", "⬅️", "↖️"];
export const DIRECTION_NAME = [
    "north", "northeast", "east", "southeast",
    "south", "southwest", "west", "northwest",
];

/** 0-100 closeness: 100 is the answer, 0 is the far side of the planet. */
export function proximityPct(km: number, correct: boolean): number {
    if (correct) return 100;
    return Math.min(99, Math.max(0, Math.round((1 - km / MAX_KM) * 100)));
}

export const pctColor = (pct: number) =>
    pct >= 80
        ? "var(--cm-good)"
        : pct >= 60
          ? "var(--cm-amber)"
          : pct >= 35
            ? "var(--cm-amber)"
            : "var(--cm-alert)";

/** Five-square proximity bar for share text. */
export function pctSquares(pct: number): string {
    const on = Math.round(pct / 20);
    const sq = pct >= 80 ? "🟩" : pct >= 60 ? "🟨" : pct >= 35 ? "🟧" : "🟥";
    return sq.repeat(on) + "⬛".repeat(5 - on);
}

export const KM_PER_MILE = 1.609344;
export const formatDistance = (km: number, unit: "km" | "mi") =>
    `${Math.round(unit === "km" ? km : km / KM_PER_MILE).toLocaleString("en-US")} ${unit}`;

// ---- Names ----

export const normalize = (s: string) =>
    s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

// Other names people type, by ISO code.
export const ALIASES: Record<string, string[]> = {
    US: ["usa", "america", "united states of america", "us"],
    GB: ["uk", "britain", "great britain", "england", "scotland", "wales"],
    AE: ["uae", "emirates"],
    CD: ["drc", "congo kinshasa", "democratic republic of the congo"],
    CG: ["congo", "congo brazzaville"],
    CI: ["cote d ivoire"],
    CZ: ["czech republic"],
    MM: ["burma"],
    TL: ["east timor"],
    SZ: ["swaziland"],
    MK: ["macedonia"],
    CV: ["cape verde"],
    KR: ["korea", "republic of korea"],
    KP: ["dprk"],
    TR: ["turkiye"],
    NL: ["holland"],
    VA: ["vatican", "holy see"],
    PS: ["gaza", "west bank"],
    RU: ["russian federation"],
    TW: ["republic of china"],
    BS: ["the bahamas"],
    GM: ["the gambia"],
    FM: ["federated states of micronesia"],
    ST: ["sao tome"],
    AX: ["aland"],
    TF: ["french southern and antarctic lands", "kerguelen"],
    SH: ["st helena"],
    KN: ["st kitts", "st kitts and nevis"],
    LC: ["st lucia"],
    VC: ["st vincent"],
    PM: ["st pierre and miquelon"],
    MF: ["st martin"],
    SX: ["st maarten"],
    BL: ["st barthelemy", "st barts"],
    HK: ["hong kong sar"],
    MO: ["macao"],
    GS: ["south georgia"],
    HM: ["heard island"],
    VG: ["bvi"],
    VI: ["us virgin islands", "usvi"],
    IO: ["biot"],
};

export function searchNames(
    countries: Country[],
    query: string,
    limit = 8
): Country[] {
    const q = normalize(query);
    if (!q) return [];
    const scored: [number, Country][] = [];
    for (const c of countries) {
        const names = [c.n, ...(ALIASES[c.c] ?? [])].map(normalize);
        let best = Infinity;
        for (const n of names) {
            if (n === q) best = Math.min(best, 0);
            else if (n.startsWith(q)) best = Math.min(best, 1);
            else if (n.split(" ").some((w) => w.startsWith(q))) {
                best = Math.min(best, 2);
            } else if (n.includes(q)) best = Math.min(best, 3);
        }
        if (best < Infinity) scored.push([best, c]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1].n.localeCompare(b[1].n));
    return scored.slice(0, limit).map(([, c]) => c);
}

/** Exact (name or alias) match, ignoring case and accents. */
export function findExact(countries: Country[], query: string) {
    const q = normalize(query);
    if (!q) return undefined;
    return countries.find(
        (c) =>
            normalize(c.n) === q ||
            (ALIASES[c.c] ?? []).some((a) => normalize(a) === q)
    );
}

// ---- Daily puzzle ----

/** Pacific-time calendar date, YYYY-MM-DD. */
export function todayPT(now = Date.now()): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Los_Angeles",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(now);
}

export function dayNumber(date: string): number {
    const [y, m, d] = date.split("-").map(Number);
    return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Seconds until the next Pacific-time midnight. */
export function secondsToNextDaily(now = Date.now()): number {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "America/Los_Angeles",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    })
        .format(now)
        .split(":")
        .map(Number);
    return 86_400 - (parts[0] * 3600 + parts[1] * 60 + parts[2]);
}

function mulberry32(seed: number) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function seededShuffle<T>(list: T[], seed: number): T[] {
    const rand = mulberry32(seed);
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** Day 0 of the fixed daily schedule (Pacific time). */
export const DAILY_EPOCH = "2026-09-28";

/** Puzzle number shown to players: #1 is the epoch day. */
export const dailyNumber = (date: string) =>
    dayNumber(date) - dayNumber(DAILY_EPOCH) + 1;

/**
 * The daily country: a committed, fixed order (lib/data/daily-schedule.json)
 * indexed by days since DAILY_EPOCH. It depends only on the date, so every
 * browser gets the same country and later data changes never move it.
 */
export function dailyCountry(
    countries: Country[],
    date: string,
    schedule: readonly string[] = dailySchedule
): Country {
    const n = schedule.length;
    const offset = dayNumber(date) - dayNumber(DAILY_EPOCH);
    const byCode = new Map(countries.map((c) => [c.c, c]));
    for (let i = 0; i < n; i++) {
        const code = schedule[(((offset + i) % n) + n) % n];
        const hit = byCode.get(code);
        if (hit) return hit;
    }
    return countries[0];
}

// ---- Difficulty and region filters (Unlimited mode) ----

export const DIFFICULTIES = [
    { id: 0, label: "Easy", color: "var(--cm-good)" },
    { id: 1, label: "Medium", color: "var(--cm-amber)" },
    { id: 2, label: "Hard", color: "var(--cm-amber)" },
    { id: 3, label: "Expert", color: "var(--cm-alert)" },
] as const;

export const REGIONS = [
    { id: "Africa", label: "Africa", color: "var(--cm-dim)" },
    { id: "Asia", label: "Asia", color: "var(--cm-dim)" },
    { id: "Europe", label: "Europe", color: "var(--cm-dim)" },
    { id: "North America", label: "N. America", color: "var(--cm-dim)" },
    { id: "South America", label: "S. America", color: "var(--cm-dim)" },
    { id: "Oceania", label: "Oceania", color: "var(--cm-dim)" },
    { id: "Polar", label: "Polar", color: "var(--cm-dim)" },
] as const;

/** Region id for a country (Antarctica and the open-ocean islands: Polar). */
export const regionOf = (c: Country) =>
    c.k === "Antarctica" || c.k.startsWith("Seven seas") ? "Polar" : c.k;

/** Countries matching the chosen difficulty tiers and regions (empty = all). */
export function poolFor(
    countries: Country[],
    difficulties: number[],
    regions: string[]
): Country[] {
    return countries.filter(
        (c) =>
            (difficulties.length === 0 || difficulties.includes(c.t)) &&
            (regions.length === 0 || regions.includes(regionOf(c)))
    );
}

// ---- Round 2 (Neighbours) state, shared by the game and its lazy round ----

export interface NeighborState {
    guesses: string[];
    status: "playing" | "won" | "lost";
    hints: number;
}
export const EMPTY_NEIGHBOR_STATE: NeighborState = {
    guesses: [],
    status: "playing",
    hints: 0,
};

// ---- Round 3 (Flag) ----

export const FLAG_CHOICES = 6;
export const FLAG_CHANCES = 3;

/** Flags are served from /public/flags (scripts/copy-flags.mjs). */
export const flagSrc = (code: string) => `/flags/${code.toLowerCase()}.svg`;

export interface FlagState {
    /** Country codes shown as flag choices, in display order. */
    options: string[];
    /** Codes picked so far. */
    picks: string[];
}

export type RoundStatus = "playing" | "won" | "lost";

export function flagStatus(f: FlagState | null, answer: string): RoundStatus {
    if (!f) return "playing";
    if (f.picks.includes(answer)) return "won";
    return f.picks.length >= FLAG_CHANCES ? "lost" : "playing";
}

/**
 * Six flags to choose from: the answer, two from the same continent (the
 * tricky ones) and three from anywhere. `seed` makes the board reproducible
 * (the daily uses the date so everyone sees the same six).
 */
export function makeFlagOptions(
    countries: Country[],
    answer: Country,
    seed: number
): string[] {
    const others = countries
        .filter((c) => c.c !== answer.c)
        .sort((a, b) => a.c.localeCompare(b.c));
    const near = seededShuffle(
        others.filter((c) => c.k === answer.k),
        seed
    ).slice(0, 2);
    const nearCodes = new Set(near.map((c) => c.c));
    const far = seededShuffle(
        others.filter((c) => !nearCodes.has(c.c)),
        seed + 1
    ).slice(0, FLAG_CHOICES - 1 - near.length);
    return seededShuffle(
        [answer, ...near, ...far].map((c) => c.c),
        seed + 2
    );
}

// ---- Score ----

export interface GameResults {
    r1: { status: RoundStatus; guesses: number; hints: number };
    /** null when the country has no land neighbours (round skipped). */
    r2: { total: number; found: number; played: boolean } | null;
    r3: { status: RoundStatus; picks: number; played: boolean };
}

const R1_POINTS = [50, 42, 34, 26, 18, 10];
const R3_POINTS = [20, 12, 6];

export interface Score {
    r1: number;
    r2: number;
    r3: number;
    total: number;
    max: number;
    pct: number;
    rating: string;
}

/**
 * Round 1 is worth 50 (fewer guesses, more points; 3 off per hint), round 2
 * 30 (by neighbours found), round 3 20 (by chances used). Countries without
 * land neighbours have no round 2, so the score is out of 70 and shown as a
 * percent. Skipped rounds score 0.
 */
export function scoreGame(r: GameResults): Score {
    const r1 =
        r.r1.status === "won"
            ? Math.max(
                  5,
                  (R1_POINTS[r.r1.guesses - 1] ?? 10) - r.r1.hints * 3
              )
            : 0;
    const r2 =
        r.r2 && r.r2.played && r.r2.total > 0
            ? Math.round((r.r2.found / r.r2.total) * 30)
            : 0;
    const r3 = r.r3.status === "won" ? (R3_POINTS[r.r3.picks - 1] ?? 6) : 0;
    const max = 50 + (r.r2 ? 30 : 0) + 20;
    const total = r1 + r2 + r3;
    const pct = Math.round((total / max) * 100);
    const rating =
        pct >= 95
            ? "Perfect"
            : pct >= 80
              ? "Great"
              : pct >= 60
                ? "Good"
                : pct >= 35
                  ? "Getting there"
                  : "Keep practicing";
    return { r1, r2, r3, total, max, pct, rating };
}
