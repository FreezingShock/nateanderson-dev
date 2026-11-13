import { useEffect, useRef, useState, type CSSProperties } from "react";
import { SPRITE_CELLS, SPRITE_PX } from "@/lib/nodefarm/tree-sprites";
import "@/app/camino/nodefarm-tree-art.css";

/**
 * One prestige tree node's icon: a shaded pixel sprite on a transparent background (the menu draws the frame around it).
 *   sprite  key in lib/nodefarm/tree-sprites.ts (the node's `sprite`, or its id)
 *   state   "owned" (full colour, an occasional shine), "open" (full colour), "locked" (two greys), "hidden" (dark silhouette)
 *   scale   css px per art px (default 2: minor 64, notable 80, keystone 128 css px)
 * Art: scripts/naos-art/nodefarm-tree-sprites.py -> public/naos/nodefarm/tree-spr-{s,m,l}. Styles: app/camino/nodefarm-tree-art.css.
 */
export type SpriteState = "hidden" | "locked" | "open" | "owned";

const COL: Record<SpriteState, number> = { owned: 0, open: 0, locked: 4, hidden: 5 };

/** a stable 0..1 number per key, so owned shines do not all fire together */
function phase(key: string) {
    let h = 7;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return (h % 1000) / 1000;
}

export function spriteSize(sprite: string, scale = 2) {
    const c = SPRITE_CELLS[sprite];
    return (c ? SPRITE_PX[c[0]] : SPRITE_PX.s) * scale;
}

/**
 * lazy: the sheet is requested only once the sprite is near the screen. For sprites in folded panels, which are laid out
 * (so their background would download) but not seen. Sticky once near. Default off: the tree menu's sprites load as before.
 */
export function TreeSprite({ sprite, state, scale = 2, className, lazy = false }: { sprite: string; state: SpriteState; scale?: number; className?: string; lazy?: boolean }) {
    const el = useRef<HTMLElement>(null);
    const [near, setNear] = useState(!lazy);
    useEffect(() => {
        if (!lazy || near) return;
        const node = el.current;
        if (!node || typeof IntersectionObserver === "undefined") {
            setNear(true);
            return;
        }
        const io = new IntersectionObserver((e) => {
            if (e.some((x) => x.isIntersecting)) {
                setNear(true);
                io.disconnect();
            }
        }, { rootMargin: "400px 0px" });
        io.observe(node);
        return () => io.disconnect();
    }, [lazy, near]);
    const cell = SPRITE_CELLS[sprite];
    const sz = cell ? cell[0] : "s";
    const px = SPRITE_PX[sz] * scale;
    const style = {
        "--px": `${px}px`,
        "--row": cell ? cell[1] : 0,
        "--col": COL[state],
        "--ph": `${(-phase(sprite) * 7).toFixed(2)}s`,
    } as CSSProperties;
    return (
        <i
            ref={el}
            className={`nf-ts${className ? ` ${className}` : ""}`}
            data-sz={sz}
            data-st={state}
            data-miss={cell ? undefined : ""}
            data-lazy={lazy ? "" : undefined}
            data-near={near ? "" : undefined}
            style={style}
            aria-hidden="true"
        />
    );
}
