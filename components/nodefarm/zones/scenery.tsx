"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ERAS, eraLabel, isLayered } from "@/lib/nodefarm/zones/scenery";

/**
 * The ground behind the board: the era's dither scene, pinned to the viewport so it shows in the gaps wherever you are on the board. Panels stay solid, so numbers
 * never sit on art. When the era changes the new scene fades in over the old one (steps, so it reads as dither, not a
 * blur) and the old one is dropped. Decorative: aria-hidden, no pointer events. Styles: app/camino/nodefarm/scenery.css.
 * Layered eras (9 on) add two children: a far layer the compositor drifts sideways, and the near layer with its animated
 * overlay stepped by CSS. No JS runs per frame.
 */
export function Scenery({ era }: { era: number }) {
    const [layers, setLayers] = useState<{ id: number; era: number }[]>([{ id: 0, era }]);
    const seq = useRef(0);
    const timer = useRef<number | undefined>(undefined);

    useEffect(() => {
        setLayers((cur) => {
            if (cur[cur.length - 1].era === era) return cur;
            seq.current += 1;
            return [...cur.slice(-1), { id: seq.current, era }];
        });
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setLayers((cur) => cur.slice(-1)), 1800);
        return () => window.clearTimeout(timer.current);
    }, [era]);

    return (
        <div className="nf-scn" aria-hidden="true">
            <div className="nf-scn-stick">
                {layers.map((l, i) => {
                    const deep = isLayered(l.era);
                    const drift = ERAS[l.era]?.drift ?? 0;
                    return (
                        <i key={l.id} className="nf-scn-l" data-era={l.era} data-deep={deep ? "" : undefined} data-out={i < layers.length - 1 ? "" : undefined}>
                            {deep && <b className="nf-scn-far" data-drift={drift ? "" : undefined} style={drift ? ({ "--drift": `${drift}s` } as CSSProperties) : undefined} />}
                            {deep && <b className="nf-scn-near" />}
                        </i>
                    );
                })}
            </div>
        </div>
    );
}

/** A framed window of the same scene, for the empty space under the core. */
export function SceneWindow({ era }: { era: number }) {
    return (
        <div className="nf-scn-win" aria-hidden="true">
            <i key={era} className="nf-scn-win-i" data-era={era} data-deep={isLayered(era) ? "" : undefined} />
            <span className="nf-scn-cap">{eraLabel(era)}</span>
        </div>
    );
}
