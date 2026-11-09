import { MC_SYMBOL_NAMES, type McSymbolName } from "@/lib/account/symbols";
import { equippedOf, type Equipped } from "@/lib/account/cosmetics";

// Everything about a profile that is a free choice (as opposed to a cosmetic a game unlocks): avatar, banner
// colors, accent override, card style, the widget layout and a few text lines. It is stored as one small JSON
// object on the profile row and passed through `cleanCustom` on every write, so the server never keeps anything
// this file does not describe. Pure data and pure functions: no game code, safe for server and browser.

export type AvatarKind = "generated" | "glyph" | "upload";
export type AvatarTone = "vivid" | "deep" | "pastel" | "mono";
export type AvatarFx = "none" | "float" | "spin" | "pulse" | "glow";
export const AVATAR_FX: { id: AvatarFx; label: string }[] = [
    { id: "none", label: "Still" },
    { id: "float", label: "Float" },
    { id: "pulse", label: "Pulse" },
    { id: "spin", label: "Spin" },
    { id: "glow", label: "Glow" },
];
export interface AvatarSpec {
    kind: AvatarKind;
    /** glyph: how the symbol moves. */
    fx?: AvatarFx;
    /** glyph: which symbol is drawn. */
    glyph?: McSymbolName;
    /** generated + glyph: base hue 0-359. Missing means "from the user id". */
    hue?: number;
    tone?: AvatarTone;
    /** upload: bumps on every new upload so browsers refetch the file. */
    v?: number;
}

export type CardStyle = "glass" | "solid" | "glow" | "pixel";
export const CARD_STYLES: { id: CardStyle; label: string; blurb: string }[] = [
    { id: "glass", label: "Glass", blurb: "Frosted and soft, the site default." },
    { id: "solid", label: "Solid", blurb: "Flat dark panels, no blur." },
    { id: "glow", label: "Glow", blurb: "Panels edged with your accent color." },
    { id: "pixel", label: "Pixel", blurb: "Chunky Minecraft-style borders, like the game menus." },
];

export interface BannerSpec {
    /** cosmetic: the equipped banner. custom: your own two-color gradient. */
    mode: "cosmetic" | "custom";
    /** custom only: a free animated overlay. (Earned banner effects come with the banner cosmetics.) */
    fx: "none" | "stars" | "blobs" | "waves";
    a: string;
    b: string;
    angle: number;
}

export type WidgetId = "about" | "fi" | "titles" | "unlocks" | "locker" | "games";
export type WidgetSize = "s" | "m" | "l" | "f";
export interface WidgetSlot {
    id: WidgetId;
    size: WidgetSize;
    hidden?: boolean;
}
export const WIDGETS: Record<WidgetId, { label: string; blurb: string; symbol: McSymbolName; color: string; ownerOnly?: boolean; sizes: WidgetSize[] }> = {
    about: { label: "About", blurb: "Your bio, pronouns and status.", symbol: "flower", color: "var(--cm-violet)", sizes: ["s", "m", "l", "f"] },
    fi: { label: "Fractured Idle", blurb: "The game's profile card: level, tier, stats and skills.", symbol: "wisdom", color: "var(--cm-cyan)", sizes: ["l", "f"] },
    titles: { label: "Titles and badges", blurb: "Every title and level badge, owned or locked.", symbol: "pristine", color: "var(--cm-amber)", sizes: ["m", "l", "f"] },
    locker: { label: "Equipped look", blurb: "What you are wearing: symbol, banner, frame and accent.", symbol: "defense", color: "var(--cm-good)", sizes: ["s", "m", "l"] },
    unlocks: { label: "Next unlocks", blurb: "The cosmetics you are closest to earning. Only you see this.", symbol: "forge", color: "var(--cm-good)", ownerOnly: true, sizes: ["s", "m", "l"] },
    games: { label: "More games", blurb: "A pointer to the games that save to your account. Only you see this.", symbol: "arrow", color: "var(--cm-amber)", ownerOnly: true, sizes: ["s", "m", "l"] },
};
export const WIDGET_IDS = Object.keys(WIDGETS) as WidgetId[];
export const SIZE_COLS: Record<WidgetSize, string> = { s: "lg:col-span-4", m: "lg:col-span-6", l: "lg:col-span-8", f: "lg:col-span-12" };
export const SIZE_LABEL: Record<WidgetSize, string> = { s: "Small", m: "Medium", l: "Large", f: "Full width" };

export const DEFAULT_LAYOUT: WidgetSlot[] = [
    { id: "fi", size: "f" },
    { id: "about", size: "m" },
    { id: "locker", size: "m" },
    { id: "titles", size: "l" },
    { id: "unlocks", size: "s" },
    { id: "games", size: "s", hidden: true },
];

export interface Custom {
    avatar: AvatarSpec;
    banner: BannerSpec;
    /** A free accent color that overrides the equipped accent cosmetic. */
    accent: string | null;
    card: CardStyle;
    layout: WidgetSlot[];
    pronouns: string;
    status: string;
}

export const DEFAULT_CUSTOM: Custom = {
    avatar: { kind: "generated" },
    banner: { mode: "cosmetic", fx: "none", a: "#3b1d6e", b: "#1b3a6e", angle: 135 },
    accent: null,
    card: "glass",
    layout: DEFAULT_LAYOUT,
    pronouns: "",
    status: "",
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const GLYPHS = MC_SYMBOL_NAMES;
const TONES: AvatarTone[] = ["vivid", "deep", "pastel", "mono"];
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "");
const int = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d);

/** Make any value into a valid layout: known widgets only, each once, every widget present. */
export function cleanLayout(v: unknown): WidgetSlot[] {
    const seen = new Set<WidgetId>();
    const out: WidgetSlot[] = [];
    if (Array.isArray(v)) {
        for (const x of v.slice(0, 12)) {
            const id = (x as WidgetSlot | null)?.id;
            if (!id || !(id in WIDGETS) || seen.has(id)) continue;
            seen.add(id);
            const sizes = WIDGETS[id].sizes;
            const size = sizes.includes((x as WidgetSlot).size) ? (x as WidgetSlot).size : DEFAULT_LAYOUT.find((d) => d.id === id)!.size;
            out.push({ id, size, ...((x as WidgetSlot).hidden ? { hidden: true } : {}) });
        }
    }
    for (const d of DEFAULT_LAYOUT) if (!seen.has(d.id)) out.push({ ...d });
    return out;
}

/** Validate untrusted JSON into a Custom. Unknown or malformed parts fall back to defaults. */
export function cleanCustom(v: unknown): Custom {
    const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
    const av = o.avatar && typeof o.avatar === "object" ? (o.avatar as Record<string, unknown>) : {};
    const bn = o.banner && typeof o.banner === "object" ? (o.banner as Record<string, unknown>) : {};
    const kind: AvatarKind = av.kind === "glyph" || av.kind === "upload" ? av.kind : "generated";
    const avatar: AvatarSpec = { kind };
    if (kind === "glyph" && AVATAR_FX.some((f) => f.id === av.fx)) avatar.fx = av.fx as AvatarFx;
    if (kind === "glyph") avatar.glyph = GLYPHS.includes(av.glyph as McSymbolName) ? (av.glyph as McSymbolName) : "wisdom";
    if (kind !== "upload" && typeof av.hue === "number") avatar.hue = int(av.hue, 0, 359, 0);
    if (kind !== "upload" && TONES.includes(av.tone as AvatarTone)) avatar.tone = av.tone as AvatarTone;
    if (kind === "upload") avatar.v = int(av.v, 0, 9e15, 0);
    return {
        avatar,
        banner: {
            mode: bn.mode === "custom" ? "custom" : "cosmetic",
            fx: bn.fx === "stars" || bn.fx === "blobs" || bn.fx === "waves" ? bn.fx : "none",
            a: HEX.test(String(bn.a)) ? String(bn.a).toLowerCase() : DEFAULT_CUSTOM.banner.a,
            b: HEX.test(String(bn.b)) ? String(bn.b).toLowerCase() : DEFAULT_CUSTOM.banner.b,
            angle: int(bn.angle, 0, 360, 135),
        },
        accent: HEX.test(String(o.accent)) ? String(o.accent).toLowerCase() : null,
        card: CARD_STYLES.some((c) => c.id === o.card) ? (o.card as CardStyle) : "glass",
        layout: cleanLayout(o.layout),
        pronouns: text(o.pronouns, 20),
        status: text(o.status, 40),
    };
}

/** What a profile looks like to the site: the stored custom object merged over the defaults. */
export const customOf = (raw: unknown): Custom => cleanCustom(raw);

type Styled = { cosmetics?: Equipped | null; custom?: unknown };
/** The accent a profile shows: its free accent color if set, else the equipped accent cosmetic. */
export const accentOf = (u: Styled): string => customOf(u.custom).accent ?? equippedOf(u.cosmetics).accent.color ?? "#55ffff";

/** The CSS background of a profile's banner: its own gradient if it made one, else the equipped banner. */
export function bannerBg(u: Styled): string {
    const c = customOf(u.custom).banner;
    if (c.mode === "custom") return `linear-gradient(${c.angle}deg, ${c.a}, ${c.b})`;
    return equippedOf(u.cosmetics).banner.bg ?? "#0b0820";
}

/** The animated effect behind a profile's banner, or "none". */
export function bannerFx(u: Styled): string {
    const c = customOf(u.custom).banner;
    return c.mode === "custom" ? c.fx : (equippedOf(u.cosmetics).banner.fx ?? "none");
}

export const AVATAR_BUCKET = "avatars";
export const avatarUrl = (userId: string, v: number | undefined) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${userId}/avatar.webp?v=${v ?? 0}`;

// Avatar tones: how a base hue turns into the two gradient stops of a generated or glyph avatar.
export function avatarColors(hue: number, tone: AvatarTone = "vivid"): [string, string] {
    switch (tone) {
        case "deep":
            return [`hsl(${hue} 70% 38%)`, `hsl(${(hue + 40) % 360} 75% 24%)`];
        case "pastel":
            return [`hsl(${hue} 75% 82%)`, `hsl(${(hue + 40) % 360} 75% 72%)`];
        case "mono":
            return [`hsl(${hue} 8% 70%)`, `hsl(${hue} 10% 40%)`];
        default:
            return [`hsl(${hue} 85% 68%)`, `hsl(${(hue + 55) % 360} 85% 58%)`];
    }
}

export const hueOfId = (seed: string) => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
    return h;
};

/** Handles are lowercase letters, digits and underscore, 3 to 20 long. */
export const cleanHandle = (s: string) => s.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
export const validHandle = (s: string) => /^[a-z0-9_]{3,20}$/.test(s);

/** Where a profile lives. Everyone has a handle (one is claimed on first sight); the id is only a fallback. */
export const profileHref = (u: { id: string; handle?: string | null }, query = "") => `/u/${u.handle ?? u.id}${query}`;
