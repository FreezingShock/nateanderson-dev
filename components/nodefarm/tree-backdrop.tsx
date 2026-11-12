"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { TREE, BRANCHES, type Branch } from "@/lib/nodefarm/engine";
import { createParallax, paintLayer, type PLayer, type PView } from "./parallax";
import "@/app/camino/nodefarm-tree-art.css";

/**
 * The prestige tree's backdrop: three tiling dither layers that move at different rates with the camera (parallax), plus a
 * world layer (the core halo and one nebula per section) that moves 1:1 with the nodes.
 *
 * The menu owns the camera and calls the handle; nothing here re-renders on a move, it only writes transforms.
 *   move(x, y, k)   the world transform the menu applies: translate(x px, y px) scale(k)
 *   resize(w, h)    the view size in px (on mount and on resize)
 *   focus(branch)   tint toward one section (hover or select), or null
 * TreeDust (below) is a fourth, nearest layer that the menu renders ABOVE its nodes: dust that drifts past in front of
 * the tree and moves faster than the nodes (depth > 1), which is what sells the depth. It follows the backdrop's camera
 * by itself; the menu only places it.
 * Art: scripts/naos-art/nodefarm-tree-bg.py -> public/naos/nodefarm/tree-bg-0..2, tree-dust, tree-core, tree-sec-<branch>.
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
/** how far each layer follows the camera (0 = fixed to the screen, 1 = glued to the nodes), far to near (Nate picked "strong depth") */
const DEPTH = [0.1, 0.45, 0.85];
/** how much of the zoom each layer takes */
const ZOOM = [0.15, 0.55, 0.95];
/** the dust in front of the nodes: moves and zooms faster than the world */
const DUST = { depth: 1.35, zoom: 1.25 };
/** only this layer drifts while idle (it needs one extra tile of width for it) */
const DRIFT = 1;
/** this layer also sways in a slow loop, so it needs this much slack on every side */
const SWAY = 2;
const SLACK = 40;

// the backdrop and the dust share one camera; the dust registers here and the backdrop paints it on every move
const shared: { view: PView | null; dust: Set<PLayer> } = { view: null, dust: new Set() };
const dustLayer = (el: HTMLElement): PLayer => ({ el, depth: DUST.depth, zoom: DUST.zoom, cell: T, extraW: 1 });

/** world size of the halo and the section nebulae in css px at zoom 1 (art px x 2 and x 4) */
const CORE = 800;
const SEC = 1024;

export const TreeBackdrop = forwardRef<TreeBackdropHandle, { unit?: number }>(function TreeBackdrop({ unit = 110 }, ref) {
    const root = useRef<HTMLDivElement>(null);
    const layers = useRef<(HTMLDivElement | null)[]>([]);
    const world = useRef<HTMLDivElement>(null);

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
        const ls: (PLayer | null)[] = DEPTH.map(() => null);
        const px = createParallax({
            layers: () => {
                const out: PLayer[] = [];
                layers.current.forEach((el, i) => {
                    if (!el) return;
                    if (!ls[i] || ls[i]!.el !== el) ls[i] = { el, depth: DEPTH[i], zoom: ZOOM[i], cell: T, extraW: i === DRIFT ? 1 : 0, slack: i === SWAY ? SLACK : 0 };
                    out.push(ls[i]!);
                });
                return out;
            },
            world: () => world.current,
            root: () => root.current,
            after: (v, settle) => {
                shared.view = v;
                shared.dust.forEach((L) => paintLayer(L, v, settle));
                // below 1:1 the dither would alias into moire, so let the browser average it into a soft glow
                const r = root.current;
                if (r) {
                    const soft = v.k < 0.95;
                    if (soft !== (r.dataset.soft !== undefined)) {
                        if (soft) r.dataset.soft = "";
                        else delete r.dataset.soft;
                    }
                }
            },
        });
        return {
            move: px.move,
            resize: px.resize,
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

/** Dust that drifts in front of the nodes. Render it after the world (above the nodes); it never takes pointer events. */
export function TreeDust() {
    const el = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!el.current) return;
        const L = dustLayer(el.current);
        shared.dust.add(L);
        if (shared.view?.w) paintLayer(L, shared.view, true);
        return () => { shared.dust.delete(L); };
    }, []);
    return (
        <div className="nf-dust" aria-hidden="true">
            <div ref={el} className="nf-bd-l nf-dust-l">
                <i className="nf-bd-d" />
            </div>
        </div>
    );
}
