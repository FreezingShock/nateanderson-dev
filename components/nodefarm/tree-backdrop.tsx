"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { TREE, BRANCHES, type Branch } from "@/lib/nodefarm/engine";
import "@/app/camino/nodefarm-tree-art.css";

/**
 * The prestige tree's backdrop: three tiling dither layers that move at different rates with the camera (parallax), plus a
 * world layer (the core halo and one nebula per section) that moves 1:1 with the nodes.
 *
 * The menu owns the camera and calls the handle; nothing here re-renders on a move, it only writes transforms.
 *   move(x, y, k)   the world transform the menu applies: translate(x px, y px) scale(k)
 *   resize(w, h)    the view size in px (on mount and on resize)
 *   focus(branch)   tint toward one section (hover or select), or null
 * Art: scripts/naos-art/nodefarm-tree-bg.py -> public/naos/nodefarm/tree-bg-0..2, tree-core, tree-sec-<branch>.
 * Styles: app/camino/nodefarm-tree-art.css. Decorative: aria-hidden, no pointer events.
 */
export interface TreeBackdropHandle {
    move(x: number, y: number, k: number): void;
    resize(w: number, h: number): void;
    focus(branch: Branch | null): void;
}

/** art px per tile and css px per art px */
const TILE = 512;
const PX = 2;
const T = TILE * PX;
/** how far each layer follows the camera (0 = fixed to the screen, 1 = glued to the nodes), far to near */
const DEPTH = [0.08, 0.35, 0.6];
/** how much of the zoom each layer takes */
const ZOOM = [0.1, 0.4, 0.7];
/** layer scale, rounded to 2 percent steps so zooming only repaints a layer now and then */
const scaleOf = (i: number, k: number) => Math.round((1 + (k - 1) * ZOOM[i]) * 50) / 50;
/** only this layer drifts while idle (it needs one extra tile of width for it) */
const DRIFT = 1;
/** world size of the halo and the section nebulae in css px at zoom 1 (art px x 2 and x 4) */
const CORE = 800;
const SEC = 1024;

export const TreeBackdrop = forwardRef<TreeBackdropHandle, { unit?: number }>(function TreeBackdrop({ unit = 110 }, ref) {
    const root = useRef<HTMLDivElement>(null);
    const layers = useRef<(HTMLDivElement | null)[]>([]);
    const world = useRef<HTMLDivElement>(null);
    const view = useRef({ w: 0, h: 0, x: 0, y: 0, k: 1 });

    // each section's nebula sits at the middle of its nodes
    const secs = useMemo(
        () =>
            BRANCHES.map((b) => {
                const ns = TREE.filter((n) => n.branch === b.id);
                const cx = ns.reduce((a, n) => a + n.x, 0) / Math.max(1, ns.length);
                const cy = ns.reduce((a, n) => a + n.y, 0) / Math.max(1, ns.length);
                return { id: b.id, x: cx * unit, y: cy * unit };
            }),
        [unit],
    );

    useImperativeHandle(ref, () => {
        // per layer: the scale it was last sized for, so a pan only writes a translate
        const sized: number[] = DEPTH.map(() => 0);
        const paint = () => {
            const { w, h, x, y, k } = view.current;
            if (!w || !h) return;
            // camera centre in world px at zoom 1
            const cx = (w / 2 - x) / k;
            const cy = (h / 2 - y) / k;
            layers.current.forEach((el, i) => {
                if (!el) return;
                const s = scaleOf(i, k);
                const ts = T * s;
                if (sized[i] !== s) {
                    // the layer is the view plus one tile (two for the drifting one), with the tile drawn at this scale:
                    // a layout and paint, but only when the zoom crosses a 2 percent step
                    sized[i] = s;
                    el.style.width = `${Math.ceil(w + ts * (i === DRIFT ? 2 : 1))}px`;
                    el.style.height = `${Math.ceil(h + ts)}px`;
                    el.style.setProperty("--t", `${ts.toFixed(2)}px`);
                }
                const mod = (v: number) => ((v % ts) + ts) % ts;
                const lx = mod(w / 2 - cx * DEPTH[i] * k) - ts;
                const ly = mod(h / 2 - cy * DEPTH[i] * k) - ts;
                el.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
            });
            if (world.current) world.current.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${k.toFixed(4)})`;
            // below 1:1 the dither would alias into moire, so let the browser average it into a soft glow
            const r = root.current;
            if (r) {
                const soft = k < 0.95;
                if (soft !== (r.dataset.soft !== undefined)) {
                    if (soft) r.dataset.soft = "";
                    else delete r.dataset.soft;
                }
            }
        };
        return {
            move(x, y, k) {
                Object.assign(view.current, { x, y, k });
                paint();
            },
            resize(w, h) {
                if (w === view.current.w && h === view.current.h) return;
                Object.assign(view.current, { w, h });
                sized.fill(0);
                paint();
            },
            focus(branch) {
                const r = root.current;
                if (!r) return;
                if (branch) r.dataset.focus = branch;
                else delete r.dataset.focus;
            },
        };
    }, []);

    return (
        <div ref={root} className="nf-bd" aria-hidden="true">
            {DEPTH.map((_, i) => (
                <div key={i} ref={(el) => { layers.current[i] = el; }} className="nf-bd-l" data-l={i}>
                    <i className="nf-bd-d" />
                </div>
            ))}
            <div ref={world} className="nf-bd-w">
                {secs.map((s) => (
                    <i key={s.id} className="nf-bd-sec" data-sec={s.id} style={{ left: s.x, top: s.y, width: SEC, height: SEC }} />
                ))}
                <i className="nf-bd-core" style={{ width: CORE, height: CORE }} />
            </div>
            <i className="nf-bd-vig" />
        </div>
    );
});
