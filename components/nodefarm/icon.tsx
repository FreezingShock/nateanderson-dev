import type { CSSProperties } from "react";

// Colour icon sheet for Node Farm, drawn by scripts/naos-art/nodefarm-icons.py (32 x 32 cells, one row). Cell order below
// must match ICONS in that script. Sizes are whole multiples of the art (32 or 64) so the pixels stay square; the CSS lives in
// app/camino/nodefarm.css (.nf-ic, .l, .r).
const ORDER = ["bytes", "mult", "reboot", "copper", "silicon", "quartz", "aether", "ascend", "alert", "lock", "spark"] as const;
export type NfIconName = (typeof ORDER)[number];

export function NfIcon({ name, large = false, responsive = false, className = "" }: { name: NfIconName; large?: boolean; responsive?: boolean; className?: string }) {
    const i = ORDER.indexOf(name);
    return <span aria-hidden="true" className={`nf-ic${large ? " l" : ""}${responsive ? " r" : ""} ${className}`.trim()} style={{ ["--i" as string]: i } as CSSProperties} />;
}
