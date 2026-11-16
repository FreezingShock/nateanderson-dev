"use client";

// The burst on every burner buy: a square ring and eight pixel sparks in the element's own colour (the row sets --c).
// It sits inside the tier button that was bought, so it starts where the press was. Each tier button gets one, and only
// the one whose tier matches the level gain draws. It is keyed on the row's level, so a fast run of buys restarts one
// burst instead of stacking them. A tier II or III buy makes a bigger burst. Styles: app/camino/starwright-burst.css.
// Motion is off under reduced motion.
import type { CSSProperties } from "react";
import { useGain } from "@/components/game-kit/hooks";
import "@/app/camino/starwright-burst.css";

const SPARKS = 8;
/** Tier I adds 1 level, tier II 10, tier III 100 (TIER_LEVELS). A milestone doubling adds nothing here. */
const tierOf = (gained: number) => (gained >= 100 ? 2 : gained >= 10 ? 1 : 0);
const SIZE = ["s", "m", "l"] as const;

export function BuyBurst({ n, tier }: { n: number; tier: number }) {
    const hit = useGain(n);
    if (!hit || tierOf(hit.gained) !== tier) return null;
    return (
        <i key={hit.key} className="sw-burst" data-size={SIZE[tier] ?? "s"} aria-hidden="true">
            {Array.from({ length: SPARKS }, (_, k) => (
                <b key={k} style={{ "--a": `${k * (360 / SPARKS)}deg` } as CSSProperties} />
            ))}
        </i>
    );
}
