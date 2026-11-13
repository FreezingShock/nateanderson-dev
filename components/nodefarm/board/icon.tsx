"use client";

import type { CSSProperties } from "react";
import { nfArt } from "@/lib/nodefarm/art/art-version";
import "@/app/camino/nodefarm/icons64.css";

// Sprites only animate while they are on screen. One shared IntersectionObserver flips data-vis on each sprite, and the CSS
// pauses every sprite without it, so a long board of zones costs only what is in view (no React state, no re-render).
let io: IntersectionObserver | null = null;
function watch(el: HTMLElement | null) {
    if (!el || typeof IntersectionObserver === "undefined") return;
    io ??= new IntersectionObserver((entries) => {
        for (const e of entries) (e.target as HTMLElement).toggleAttribute("data-vis", e.isIntersecting);
    }, { rootMargin: "64px" });
    io.observe(el);
    return () => io?.unobserve(el);
}

// Colour icon sheet for Node Farm, 64 x 64 cells, 29 across, eight frames down, drawn by scripts/naos-art/nodefarm-icons64.py.
// Cell order below must match ICON_ORDER in that script. The CSS lives in app/camino/nodefarm/base.css (.nf-ic, .l, .r).
const ORDER = ["bytes", "mult", "reboot", "copper", "silicon", "quartz", "aether", "ascend", "alert", "lock", "spark", "runes", "starglass", "voidsteel", "chrono", "engrams", "paradox", "origin", "nebula", "pulsars", "singularity", "spores", "mycelium", "pollen", "bloom", "basalt", "magma", "geodes", "sunstone"] as const;
export type NfIconName = (typeof ORDER)[number];

export function NfIcon({ name, large = false, responsive = false, className = "" }: { name: NfIconName; large?: boolean; responsive?: boolean; className?: string }) {
    const i = ORDER.indexOf(name);
    return <span ref={watch} aria-hidden="true" className={`nf-ic${large ? " l" : ""}${responsive ? " r" : ""} ${className}`.trim()} style={{ ["--i" as string]: i } as CSSProperties} />;
}

// 64 px button sprites: one sheet per stat (six tiers across, eight frames down), drawn by scripts/naos-art/nodefarm-icons64.py
// from scripts/naos-art/nodefarm_tiers64_<stat>.py. scripts/nodefarm/stamp-art.mjs checks every button stat is listed and every
// sheet exists at 384 x 512 (the old 32 px tiers-anim fallback is retired).
const TIC64 = ["mult", "reboot", "copper", "silicon", "quartz", "aether", "runes", "starglass", "voidsteel", "chrono", "nebula", "pulsars", "singularity", "engrams", "paradox", "origin", "spores", "mycelium", "pollen", "bloom", "basalt", "magma", "geodes", "sunstone"] as const;

export function NfTierIcon({ stat, tier }: { stat: string; tier: number }) {
    if ((TIC64 as readonly string[]).includes(stat)) {
        return <span ref={watch} aria-hidden="true" className="nf-tic nf-tic64" style={{ ["--t" as string]: tier, backgroundImage: `url(${nfArt(`tic-${stat}.webp`)})` } as CSSProperties} />;
    }
    return null;
}
