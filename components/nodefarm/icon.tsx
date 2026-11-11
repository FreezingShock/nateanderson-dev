import type { CSSProperties } from "react";

// Colour icon sheet for Node Farm, drawn by scripts/naos-art/nodefarm-icons.py (32 x 32 cells, one row). Cell order below
// must match ICONS in that script. Sizes are whole multiples of the art (32 or 64) so the pixels stay square; the CSS lives in
// app/camino/nodefarm.css (.nf-ic, .l, .r).
const ORDER = ["bytes", "mult", "reboot", "copper", "silicon", "quartz", "aether", "ascend", "alert", "lock", "spark", "runes", "starglass", "voidsteel", "chrono"] as const;
export type NfIconName = (typeof ORDER)[number];

export function NfIcon({ name, large = false, responsive = false, className = "" }: { name: NfIconName; large?: boolean; responsive?: boolean; className?: string }) {
    const i = ORDER.indexOf(name);
    return <span aria-hidden="true" className={`nf-ic${large ? " l" : ""}${responsive ? " r" : ""} ${className}`.trim()} style={{ ["--i" as string]: i } as CSSProperties} />;
}

// One 32 px sprite per button tier: ten rows (stat) by six columns (tier), drawn by scripts/naos-art/nodefarm-tier-icons.py.
// Row order below must match ROWS in that script.
const TIER_ROWS = ["mult", "reboot", "copper", "silicon", "quartz", "aether", "runes", "starglass", "voidsteel", "chrono"] as const;

export function NfTierIcon({ stat, tier }: { stat: string; tier: number }) {
    const r = TIER_ROWS.indexOf(stat as (typeof TIER_ROWS)[number]);
    if (r < 0) return null;
    return <span aria-hidden="true" className="nf-tic" style={{ ["--r" as string]: r, ["--t" as string]: tier } as CSSProperties} />;
}
