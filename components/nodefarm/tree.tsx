"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { createPortal } from "react-dom";
import { TreeBackdrop, TreeDust, type TreeBackdropHandle } from "./tree-backdrop";
import { TreeSprite, type SpriteState } from "./tree-sprite";
import { SPRITE_CELLS } from "@/lib/nodefarm/tree-sprites";
import { cardReveal, irisFrom, readTry, type TreeTry } from "./tree-try";
import * as Engine from "@/lib/nodefarm/engine";
import { BRANCHES, TREE, fmt, hasNode, nodeOpen, treeFx, treeNode, type State, type TreeNode } from "@/lib/nodefarm/engine";

/**
 * The prestige tree menu: a full-screen web of nodes with a camera you pan, pinch and zoom.
 * Layout comes from the engine (`TREE` x and y, in tree units). Only nodes near what you own are drawn:
 * one step out they are readable, two steps out they are encrypted silhouettes, further out they are hidden.
 * Picking a node glides the camera to it and opens a card anchored at the node.
 */
const U = 165; // px per tree unit at zoom 1
const KMIN = 0.3;
const KMAX = 1.8;
const SZ = { minor: 88, notable: 112, keystone: 152, core: 152 } as const;
const GLIDE_MS = 560;
const BCOL = Object.fromEntries(BRANCHES.map((b) => [b.id, b.color])) as Record<string, string>;
const BNAME = Object.fromEntries(BRANCHES.map((b) => [b.id, b.name])) as Record<string, string>;
const KIND = { minor: "MINOR", notable: "NOTABLE", keystone: "KEYSTONE" } as const;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

type Vis = "shown" | "fog" | "hidden";

/** Steps from the core along the links, so the opening can decrypt the tree ring by ring. */
const RING: Map<string, number> = (() => {
    const d = new Map<string, number>();
    const q: string[] = [];
    for (const n of TREE) if (n.links.includes("core")) { d.set(n.id, 1); q.push(n.id); }
    for (let i = 0; i < q.length; i++) {
        const r = d.get(q[i])!;
        for (const l of treeNode(q[i]).links) if (l !== "core" && !d.has(l)) { d.set(l, r + 1); q.push(l); }
    }
    return d;
})();
const BOOT_MS: Record<TreeTry["open"], number> = { boot: 1400, iris: 800, zoom: 1150 };
const CLOSE_MS = 340;
type NodeState = "owned" | "ready" | "open" | "locked";
type Extra = TreeNode & { flavor?: string; sprite?: string };

/** The node's icon: the art thread's sprite when the sheet has this key, else the older shared sheet. */
function NodeIcon({ n, st, fog }: { n: TreeNode | null; st: NodeState; fog: boolean }) {
    const key = n ? (n as Extra).sprite ?? n.id : "core";
    if (SPRITE_CELLS[key]) {
        // locked nodes stay a dark silhouette until they touch something you own (Nate picked this, 2026-11-12)
        const ss: SpriteState = fog || st === "locked" ? "hidden" : st === "owned" ? "owned" : "open";
        return (
            <>
                <TreeSprite sprite={key} state={ss} className="nf-tn-spr" />
                {fog && <i className="nf-tn-q nf-tn-qo">?</i>}
            </>
        );
    }
    return fog ? <i className="nf-tn-q">?</i> : <i className="nf-tn-ic" />;
}

// The upgrades data may ship its own reveal rule (`nodeVis`); until then, graph distance from what you own decides.
const engineVis = (Engine as unknown as { nodeVis?: (s: State, n: TreeNode) => Vis }).nodeVis;
function visMap(s: State): Map<string, Vis> {
    const out = new Map<string, Vis>();
    if (engineVis) {
        for (const n of TREE) out.set(n.id, engineVis(s, n));
        return out;
    }
    const dist = new Map<string, number>();
    const q: string[] = [];
    for (const n of TREE) if (hasNode(s, n.id)) { dist.set(n.id, 0); q.push(n.id); }
    for (const n of TREE) if (!dist.has(n.id) && n.links.includes("core")) { dist.set(n.id, 1); q.push(n.id); }
    for (let i = 0; i < q.length; i++) {
        const d = dist.get(q[i])!;
        if (d >= 2) continue;
        for (const l of treeNode(q[i]).links) if (l !== "core" && !dist.has(l)) { dist.set(l, d + 1); q.push(l); }
    }
    for (const n of TREE) {
        const d = dist.get(n.id);
        out.set(n.id, d === undefined || d > 2 ? "hidden" : d === 2 ? "fog" : "shown");
    }
    return out;
}

function stateOf(s: State, n: TreeNode): NodeState {
    if (hasNode(s, n.id)) return "owned";
    if (!nodeOpen(s, n)) return "locked";
    return s.ap >= n.cost ? "ready" : "open";
}

/** What the owned nodes add up to, as plain rows for the readout. The engine's own `treeTotals` wins when it has one. */
const engineTotals = (Engine as unknown as { treeTotals?: (s: State) => [string, string][] }).treeTotals;
function totals(s: State): [string, string][] {
    if (engineTotals) return engineTotals(s);
    const f = treeFx(s);
    const pct = (x: number) => `+${Math.round(x * 100)}%`;
    const rows: [string, string][] = [];
    if (f.bytes) rows.push(["Bytes", pct(f.bytes)]);
    if (f.global) rows.push(["Everything", pct(f.global)]);
    if (f.reboot) rows.push(["Reboot power", pct(f.reboot)]);
    if (f.multGain) rows.push(["Multiplier buttons", pct(f.multGain)]);
    if (f.discount < 1) rows.push(["Button prices", `-${Math.round((1 - f.discount) * 100)}%`]);
    const mats = Object.values(f.mats);
    if (mats.length) rows.push(["Materials boosted", String(mats.length)]);
    if (f.start) rows.push(["Reboot keeps", `${f.start} s of Bytes`]);
    if (f.offline) rows.push(["Offline cap", `+${f.offline} h`]);
    if (f.overclock) rows.push(["Overclock length", `+${f.overclock} s`]);
    if (f.ocMult) rows.push(["Overclock power", `+x${f.ocMult}`]);
    if (f.ap) rows.push(["AP on Ascend", pct(f.ap)]);
    if (f.goals) rows.push(["Goal bonus", `+${Math.round(f.goals * 100)}% each`]);
    if (f.drone) rows.push(["Drone speed", pct(f.drone)]);
    if (f.droneMax) rows.push(["Drone levels", `+${f.droneMax}`]);
    if (f.droneCost < 1) rows.push(["Drone prices", `-${Math.round((1 - f.droneCost) * 100)}%`]);
    if (f.droneOff) rows.push(["Drones away", pct(f.droneOff)]);
    return rows;
}

/** Effect text with its numbers picked out ("+20% Bytes" -> <b>+20%</b> Bytes). */
function Fx({ text }: { text: string }) {
    const parts = text.split(/([+-]?x?\d+(?:\.\d+)?\s?(?:%|s\b|h\b|AP\b)?|twice)/g);
    return <>{parts.map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p))}</>;
}

/** Name that decrypts in when the card changes node. Always settles on the real text. */
function ScrambleName({ text, reduced }: { text: string; reduced: boolean }) {
    const el = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        const node = el.current;
        if (!node) return;
        node.textContent = text;
        if (reduced) return;
        const glyphs = "01<>/#_$%&*+=?";
        let f = 0;
        const total = 9;
        const id = window.setInterval(() => {
            f++;
            const keep = Math.floor((f / total) * text.length);
            node.textContent = text.slice(0, keep) + [...text.slice(keep)].map((c) => (c === " " ? " " : glyphs[(Math.random() * glyphs.length) | 0])).join("");
            if (f >= total) { window.clearInterval(id); node.textContent = text; }
        }, 28);
        return () => { window.clearInterval(id); node.textContent = text; };
    }, [text, reduced]);
    return <span ref={el} aria-hidden="true">{text}</span>;
}

export function TreeMenu({ s, reduced, onBuy, onRespec, onClose }: { s: State; reduced: boolean; onBuy: (id: string) => void; onRespec: () => number; onClose: () => void }) {
    const root = useRef<HTMLDivElement>(null);
    const view = useRef<HTMLDivElement>(null);
    const world = useRef<HTMLDivElement>(null);
    const card = useRef<HTMLElement>(null);
    const lead = useRef<HTMLSpanElement>(null);
    const bd = useRef<TreeBackdropHandle>(null);
    /** camera: the world point at the centre of the view (px at zoom 1, core = 0,0) and the zoom */
    const cam = useRef({ cx: 0, cy: 0, k: 1 });
    const glide = useRef(0);
    /** view size, the view's top inside the menu, and how much of the view's top the bar covers */
    const dims = useRef({ w: 800, h: 600, vt: 44, st: 0 });
    const ptrs = useRef(new Map<number, { x: number; y: number }>());
    const gest = useRef({ total: 0, suppress: false, pinch: 0, mx: 0, my: 0 });
    const hovT = useRef<number | undefined>(undefined);
    const cardFor = useRef<string | null>(null);
    const sideFor = useRef<{ id: string | null; side: string }>({ id: null, side: "r" });
    /** drawn nodes in world px, for the card's placement */
    const drawn = useRef<{ id: string; x: number; y: number; sz: number }[]>([]);
    const prevVis = useRef<Map<string, Vis> | null>(null);
    const [sel, setSel] = useState<string>("");
    const [hov, setHov] = useState<string | null>(null);
    const hovRef = useRef<string | null>(null);
    hovRef.current = hov;
    const lastPt = useRef({ x: -1, y: -1 });
    const [flash, setFlash] = useState<string | null>(null);
    const [fresh, setFresh] = useState<Set<string>>(() => new Set());
    const [confirm, setConfirm] = useState(false);
    const [msg, setMsg] = useState("");
    const [showTot, setShowTot] = useState(false);
    /** opening and closing: "in" plays the boot sequence, "out" the collapse before the menu unmounts */
    const [tr] = useState<TreeTry>(readTry);
    const [boot, setBoot] = useState<"in" | "done" | "out">(reduced ? "done" : "in");
    const bootRef = useRef(boot);
    bootRef.current = boot;
    const bootT = useRef<number[]>([]);
    /** the controls line folds to a small prompt after the first touch, so it never sits over nodes */
    const [hintMin, setHintMin] = useState(false);
    const [coarse, setCoarse] = useState(false);
    /** desktop: the site's top corners stay, the tree's bar sits between them and the dock waits behind a tab */
    const [chrome, setChrome] = useState(false);
    const [dockOpen, setDockOpen] = useState(false);

    const vis = useMemo(() => visMap(s), [s, s.tree.length]); // eslint-disable-line react-hooks/exhaustive-deps
    drawn.current = useMemo(() => [{ id: "core", x: 0, y: 0, sz: SZ.core }, ...TREE.filter((n) => (vis.get(n.id) ?? "hidden") !== "hidden").map((n) => ({ id: n.id, x: n.x * U, y: n.y * U, sz: SZ[n.kind] }))], [vis]);
    const seen = (id: string) => id === "core" || (vis.get(id) ?? "hidden") !== "hidden";

    // world bounds of everything on screen, so the camera can't wander off into empty space
    const bounds = useMemo(() => {
        // all drawn nodes bound the camera; the readable ones (not fogged) are what Fit frames
        const box = (keep: (id: string) => boolean) => {
            let x0 = -U, x1 = U, y0 = -U, y1 = U;
            for (const n of TREE) if (keep(n.id)) {
                x0 = Math.min(x0, n.x * U); x1 = Math.max(x1, n.x * U);
                y0 = Math.min(y0, n.y * U); y1 = Math.max(y1, n.y * U);
            }
            return { x0, x1, y0, y1 };
        };
        return { ...box(seen), fit: box((id) => vis.get(id) === "shown") };
    }, [vis]); // eslint-disable-line react-hooks/exhaustive-deps
    const bRef = useRef(bounds);
    bRef.current = bounds;

    const endBoot = useCallback(() => {
        if (bootRef.current !== "in") return;
        bootT.current.forEach((x) => window.clearTimeout(x));
        bootT.current = [];
        setBoot("done");
    }, []);
    const closing = useRef(false);
    /** close plays the collapse (a CRT line), then hands back to the game */
    const close = useCallback(() => {
        if (closing.current) return;
        closing.current = true;
        if (reduced) return onClose();
        bootT.current.forEach((x) => window.clearTimeout(x));
        setBoot("out");
        window.setTimeout(onClose, CLOSE_MS);
    }, [onClose, reduced]);

    const measure = () => {
        const b = view.current?.getBoundingClientRect();
        const r = root.current?.getBoundingClientRect();
        const bar = root.current?.querySelector(".nf-tm-bar")?.getBoundingClientRect();
        const vt = b && r ? b.top - r.top : 44;
        const st = b && bar ? Math.max(0, bar.bottom - b.top) : 0;
        dims.current = { w: b?.width || 800, h: b?.height || 600, vt, st };
        bd.current?.resize(dims.current.w, dims.current.h);
        return dims.current;
    };

    /** Put the card next to whichever node it belongs to, in screen space (it does not scale with the world). */
    const placeCard = useCallback(() => {
        const c = card.current, ln = lead.current, id = cardFor.current;
        if (!c || !ln) return;
        if (!id) { c.style.visibility = "hidden"; ln.style.visibility = "hidden"; return; }
        const n = id === "core" ? null : treeNode(id);
        const { w, h, vt: top, st } = dims.current;
        const { cx, cy, k } = cam.current;
        const sx = w / 2 + ((n ? n.x * U : 0) - cx) * k;
        const sy = top + h / 2 + ((n ? n.y * U : 0) - cy) * k;
        const r = ((n ? SZ[n.kind] : SZ.core) / 2) * k + 10;
        const cw = c.offsetWidth, ch = c.offsetHeight;
        const gap = 22;
        // try each side, score how much of the other drawn nodes the card would cover, keep the least-covering side
        // (with a little stickiness, so the card does not hop around while the camera moves)
        type Side = "r" | "l" | "b" | "t";
        const place = (sd: Side): [number, number] => {
            const l0 = sd === "r" ? sx + r + gap : sd === "l" ? sx - r - gap - cw : sx - cw / 2;
            const t0 = sd === "b" ? sy + r + gap : sd === "t" ? sy - r - gap - ch : sy - Math.min(48, ch / 2);
            return [clamp(l0, 12, w - cw - 12), clamp(t0, top + st + 12, top + h - ch - 12)];
        };
        const fits = (sd: Side) => sd === "r" ? sx + r + gap + cw <= w - 12 : sd === "l" ? sx - r - gap - cw >= 12 : sd === "b" ? sy + r + gap + ch <= top + h - 8 : sy - r - gap - ch >= top + st + 8;
        const others = drawn.current.filter((o) => o.id !== id);
        const cover = (l0: number, t0: number) => {
            let a = 0;
            for (const o of others) {
                const ox = w / 2 + (o.x - cx) * k, oy = top + h / 2 + (o.y - cy) * k, orr = (o.sz / 2) * k + 6;
                const ix = Math.min(l0 + cw, ox + orr) - Math.max(l0, ox - orr), iy = Math.min(t0 + ch, oy + orr) - Math.max(t0, oy - orr);
                if (ix > 0 && iy > 0) a += ix * iy;
            }
            // covering the node itself (after clamping) is the worst case
            const sx0 = Math.min(l0 + cw, sx + r) - Math.max(l0, sx - r), sy0 = Math.min(t0 + ch, sy + r) - Math.max(t0, sy - r);
            if (sx0 > 0 && sy0 > 0) a += sx0 * sy0 * 6;
            return a;
        };
        const sides: Side[] = (["r", "l", "b", "t"] as Side[]).filter(fits);
        if (!sides.length) sides.push(w < 700 ? "b" : "r");
        const prev = sideFor.current.id === id ? sideFor.current.side : null;
        let side: Side = sides[0], best = Infinity;
        for (const sd of sides) {
            const [l0, t0] = place(sd);
            const sc = cover(l0, t0) * (sd === prev ? 0.7 : 1) + (sd === "r" ? 0 : 400);
            if (sc < best) { best = sc; side = sd; }
        }
        sideFor.current = { id, side };
        const [left, tp] = place(side);
        c.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(tp)}px, 0)`;
        c.style.visibility = "visible";
        c.dataset.side = side;
        // leader line from the node's edge to the card
        if (side === "r" || side === "l") {
            const x0 = side === "r" ? sx + r - 10 : left + cw;
            const x1 = side === "r" ? left : sx - r + 10;
            const y = clamp(sy, tp + 10, tp + ch - 10);
            ln.style.transform = `translate3d(${Math.round(Math.min(x0, x1))}px, ${Math.round(y)}px, 0)`;
            ln.style.width = `${Math.max(0, Math.abs(x1 - x0))}px`;
            ln.style.height = "2px";
        } else {
            const y0 = side === "b" ? sy + r - 10 : tp + ch;
            const y1 = side === "b" ? tp : sy - r + 10;
            const x = clamp(sx, left + 10, left + cw - 10);
            ln.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(Math.min(y0, y1))}px, 0)`;
            ln.style.width = "2px";
            ln.style.height = `${Math.max(0, Math.abs(y1 - y0))}px`;
        }
        ln.style.visibility = "visible";
    }, []);

    const apply = useCallback(() => {
        const wEl = world.current, r = root.current;
        if (!wEl || !r) return;
        const { w, h } = dims.current;
        const { cx, cy, k } = cam.current;
        const x = w / 2 - cx * k, y = h / 2 - cy * k;
        wEl.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${k.toFixed(4)})`;
        bd.current?.move(x, y, k);
        const lod = k < 0.5 ? "far" : "near";
        if (r.dataset.lod !== lod) r.dataset.lod = lod;
        placeCard();
    }, [placeCard]);

    const limit = (cx: number, cy: number, k: number) => {
        const b = bRef.current;
        const pad = 1.6 * U;
        k = clamp(k, KMIN, KMAX);
        return { cx: clamp(cx, b.x0 - pad, b.x1 + pad), cy: clamp(cy, b.y0 - pad, b.y1 + pad), k };
    };
    const stop = () => { if (glide.current) cancelAnimationFrame(glide.current); glide.current = 0; };
    const jump = useCallback((cx: number, cy: number, k: number) => {
        stop();
        cam.current = limit(cx, cy, k);
        apply();
    }, [apply]); // eslint-disable-line react-hooks/exhaustive-deps
    /** Eased camera move. Zoom eases in log space so a zoom-in does not swing past the target. */
    const flyTo = useCallback((cx: number, cy: number, k: number, ms = GLIDE_MS) => {
        const to = limit(cx, cy, k);
        if (reduced) return jump(to.cx, to.cy, to.k);
        stop();
        const from = { ...cam.current };
        const t0 = performance.now();
        const lk0 = Math.log(from.k), lk1 = Math.log(to.k);
        const step = (t: number) => {
            const p = easeInOut(clamp((t - t0) / ms, 0, 1));
            cam.current = { cx: from.cx + (to.cx - from.cx) * p, cy: from.cy + (to.cy - from.cy) * p, k: Math.exp(lk0 + (lk1 - lk0) * p) };
            apply();
            glide.current = p < 1 ? requestAnimationFrame(step) : 0;
        };
        glide.current = requestAnimationFrame(step);
    }, [apply, jump, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

    const zoomAt = useCallback((px: number, py: number, f: number, animate = false) => {
        const { w, h } = dims.current;
        const { cx, cy, k } = cam.current;
        const nk = clamp(k * f, KMIN, KMAX);
        const wx = cx + (px - w / 2) / k, wy = cy + (py - h / 2) / k;
        const ncx = wx - (px - w / 2) / nk, ncy = wy - (py - h / 2) / nk;
        if (animate) flyTo(ncx, ncy, nk, 260);
        else jump(ncx, ncy, nk);
    }, [flyTo, jump]);

    /** Zoom to fit everything that is visible. */
    const fitTarget = (maxK = 1.05) => {
        const { w, h, st } = measure();
        const b = bRef.current.fit;
        const bw = b.x1 - b.x0 + 2.6 * U, bh = b.y1 - b.y0 + 2.6 * U;
        // never fit so far out that the nodes turn into dots: past this, panning shows the rest
        const k = clamp(Math.min(w / bw, (h - st) / bh), w < 700 ? 0.42 : 0.56, maxK);
        return { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2 - st / 2 / k, k };
    };
    const fit = useCallback((animate = true, maxK = 1.05) => {
        const t = fitTarget(maxK);
        if (animate) flyTo(t.cx, t.cy, t.k); else jump(t.cx, t.cy, t.k);
    }, [flyTo, jump]); // eslint-disable-line react-hooks/exhaustive-deps

    /** Bring a node into focus: glide over, zoom in a little, and leave room for its card. */
    const focusNode = useCallback((id: string) => {
        const { w, h: vh, st } = measure();
        const n = id === "core" ? null : treeNode(id);
        const nx = n ? n.x * U : 0, ny = n ? n.y * U : 0;
        const k = clamp(Math.max(cam.current.k, w < 700 ? 0.78 : 1.0), KMIN, w < 700 ? 1.0 : 1.25);
        // desktop: node a little left of centre so the card fits on its right; phone: node in the upper third, card below
        const sx = w < 700 ? w / 2 : w * 0.4;
        // (inside the part of the view the bar does not cover)
        const sy = st + (w < 700 ? (vh - st) * 0.3 : (vh - st) * 0.48);
        flyTo(nx - (sx - w / 2) / k, ny - (sy - vh / 2) / k, k);
    }, [flyTo]);

    // first view: fit what is visible (it starts small, so this lands close in). The menu can open while the page is
    // still transformed by a transition, so watch the view's size and refit until the player touches the camera.
    const touched = useRef(false);
    useEffect(() => {
        const el = view.current;
        const raf = requestAnimationFrame(() => {
            if (bootRef.current !== "in") return fit(false);
            // boot: start close on the core, then pull back to the fitted view while the rings decrypt
            const t = fitTarget();
            if (tr.open === "iris") return jump(t.cx, t.cy, t.k);
            if (tr.open === "zoom") {
                // straight through the core: start far past the usual zoom limit, then fall back to the fitted view
                stop();
                cam.current = { cx: 0, cy: 0, k: 5.5 };
                apply();
                bootT.current.push(window.setTimeout(() => { if (!touched.current) flyTo(t.cx, t.cy, t.k, 900); }, 60));
                return;
            }
            jump(0, 0, Math.min(KMAX, t.k * 2.3));
            bootT.current.push(window.setTimeout(() => { if (!touched.current) flyTo(t.cx, t.cy, t.k, 950); }, 230));
        });
        const ro = new ResizeObserver(() => {
            measure();
            if (touched.current || bootRef.current === "in") apply();
            else fit(false);
        });
        if (el) ro.observe(el);
        return () => { cancelAnimationFrame(raf); ro.disconnect(); stop(); window.clearTimeout(hovT.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // modal behaviour: body class (lifts the board above the page), Escape, focus in and back out
    const selRef = useRef(sel);
    selRef.current = sel;
    useEffect(() => {
        const prev = document.activeElement as HTMLElement | null;
        document.body.classList.add("nf-win-open", "nf-tm-open");
        root.current?.querySelector<HTMLElement>(".nf-tm-x")?.focus();
        setCoarse(window.matchMedia("(pointer: coarse)").matches);
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") { if (bootRef.current === "in" && !e.repeat) endBoot(); return; }
            // the site map, search and console open above the tree on desktop: their Escape is theirs
            if (document.querySelector(".nv-scrim")) return;
            e.stopPropagation();
            // first Escape lets go of the picked node, the second closes the tree
            if (selRef.current) { setSel(""); setHov(null); } else close();
        };
        window.addEventListener("keydown", onKey, true);
        return () => {
            window.removeEventListener("keydown", onKey, true);
            document.body.classList.remove("nf-win-open", "nf-tm-open");
            prev?.focus?.();
        };
    }, [close]); // eslint-disable-line react-hooks/exhaustive-deps

    // the boot ends on its own, or early on any key, click or wheel
    useEffect(() => {
        if (bootRef.current !== "in") return;
        const t = window.setTimeout(() => setBoot((b) => (b === "in" ? "done" : b)), BOOT_MS[tr.open]);
        const list = bootT.current;
        return () => { window.clearTimeout(t); list.forEach((x) => window.clearTimeout(x)); };
    }, []);

    // desktop framing: the tree's bar slots between the site's top-left and top-right clusters, which stay usable
    useEffect(() => {
        const mq = window.matchMedia("(min-width: 900px)");
        const lay = () => {
            if (tr.frame === "bounds") return layBounds();
            if (tr.frame === "full") return;
            const a = document.querySelector(".nv-top .nv-start")?.getBoundingClientRect();
            const b = document.querySelector(".nv-top .nv-tools")?.getBoundingClientRect();
            const on = mq.matches && !!a && !!b && a.width > 0 && b.width > 0;
            document.body.classList.toggle("nf-tm-chrome", on);
            setChrome(on);
            const el = root.current;
            if (!on || !el || !a || !b) return;
            el.style.setProperty("--tm-l", `${Math.round(a.right + 10)}px`);
            el.style.setProperty("--tm-r", `${Math.round(window.innerWidth - b.left + 10)}px`);
            el.style.setProperty("--tm-t", `${Math.round(a.top)}px`);
            el.style.setProperty("--tm-h", `${Math.round(a.height)}px`);
        };
        // preview: the tree as a window over the game board only, site bar and dock left as they are
        const layBounds = () => {
            const el = root.current, g = document.querySelector(".nf")?.getBoundingClientRect();
            if (!el || !g || !mq.matches) { document.body.classList.remove("nf-tm-bounds"); el?.removeAttribute("data-frame"); return; }
            const nav = document.querySelector(".nv-top")?.getBoundingClientRect();
            const dock = document.querySelector(".cm-dock")?.getBoundingClientRect();
            const top = Math.max(g.top, (nav?.bottom ?? 0) + 12);
            const bottom = Math.min(g.bottom, (dock && dock.height ? dock.top : window.innerHeight) - 12);
            document.body.classList.add("nf-tm-bounds");
            el.dataset.frame = "bounds";
            Object.assign(el.style, { top: `${Math.round(top)}px`, left: `${Math.round(Math.max(12, g.left))}px`, width: `${Math.round(Math.min(g.width, window.innerWidth - 24))}px`, height: `${Math.round(Math.max(320, bottom - top))}px` });
        };
        lay();
        const o = irisFrom(), rr = root.current?.getBoundingClientRect();
        if (o && rr) { root.current!.style.setProperty("--ix", `${Math.round(o.x - rr.left)}px`); root.current!.style.setProperty("--iy", `${Math.round(o.y - rr.top)}px`); }
        window.addEventListener("resize", lay);
        mq.addEventListener("change", lay);
        return () => { window.removeEventListener("resize", lay); mq.removeEventListener("change", lay); document.body.classList.remove("nf-tm-chrome", "nf-tm-bounds"); };
    }, []);

    // the dock tab: the site's page dock slides up over the tree, the tab rides on top of it
    useEffect(() => {
        const on = dockOpen && chrome;
        document.body.classList.toggle("nf-tm-dock", on);
        if (on) {
            const d = document.querySelector(".cm-dock")?.getBoundingClientRect();
            if (d) root.current?.style.setProperty("--dock-gap", `${Math.round(window.innerHeight - d.top + 10)}px`);
        }
        return () => document.body.classList.remove("nf-tm-dock");
    }, [dockOpen, chrome]);

    // wheel zoom has to be a non-passive listener to stop the page from scrolling
    useEffect(() => {
        const el = view.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            touched.current = true;
            endBoot();
            setHintMin(true);
            const b = el.getBoundingClientRect();
            const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
            zoomAt(e.clientX - b.left, e.clientY - b.top, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0016)));
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [zoomAt, endBoot]);

    // nodes that just came into view (or out of the fog) play a decrypt reveal
    useEffect(() => {
        const prev = prevVis.current;
        prevVis.current = vis;
        if (!prev) return;
        const up = new Set<string>();
        for (const [id, v] of vis) { const p = prev.get(id); if (p !== v && v !== "hidden") up.add(id); }
        if (!up.size) return;
        setFresh(up);
        const t = window.setTimeout(() => setFresh(new Set()), 1100);
        return () => window.clearTimeout(t);
    }, [vis]);

    const shown = hov ?? (sel || null);
    // the card closes with the shared code reveal, so it keeps the last node's content while the rows delete
    const [leaving, setLeaving] = useState<string | null>(null);
    const [prevShown, setPrevShown] = useState<string | null>(shown);
    if (prevShown !== shown) { setPrevShown(shown); setLeaving(shown ? null : prevShown); }
    const cardId = shown ?? leaving;
    cardFor.current = cardId;
    useLayoutEffect(() => { measure(); placeCard(); });
    useLayoutEffect(() => {
        const el = card.current;
        if (!el) return;
        if (shown) { void cardReveal(el, "in", tr.anim); return; }
        if (!leaving) return;
        const id = leaving;
        void cardReveal(el, "out", tr.anim).then(() => setLeaving((l) => (l === id ? null : l)));
    }, [shown, leaving]);
    useEffect(() => { bd.current?.focus(shown && shown !== "core" ? treeNode(shown).branch : null); }, [shown]);

    // ---- pointers: one finger or the mouse pans, two fingers pinch
    const pos = (e: RPointerEvent) => {
        const b = view.current!.getBoundingClientRect();
        return { x: e.clientX - b.left, y: e.clientY - b.top };
    };
    const down = (e: RPointerEvent) => {
        stop();
        touched.current = true;
        endBoot();
        setHintMin(true);
        ptrs.current.set(e.pointerId, pos(e));
        if (ptrs.current.size === 1) { gest.current.total = 0; gest.current.suppress = false; }
        if (ptrs.current.size === 2) {
            const [a, b] = [...ptrs.current.values()];
            gest.current.pinch = Math.hypot(a.x - b.x, a.y - b.y);
            gest.current.mx = (a.x + b.x) / 2;
            gest.current.my = (a.y + b.y) / 2;
            gest.current.suppress = true;
        }
    };
    const move = (e: RPointerEvent) => {
        const old = ptrs.current.get(e.pointerId);
        if (!old) return;
        const now = pos(e);
        ptrs.current.set(e.pointerId, now);
        const g = gest.current;
        if (ptrs.current.size >= 2) {
            const [a, b] = [...ptrs.current.values()];
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            if (g.pinch > 0 && dist > 0) zoomAt(mx, my, dist / g.pinch);
            const k = cam.current.k;
            jump(cam.current.cx - (mx - g.mx) / k, cam.current.cy - (my - g.my) / k, k);
            g.pinch = dist;
            g.mx = mx;
            g.my = my;
            return;
        }
        const dx = now.x - old.x, dy = now.y - old.y;
        g.total += Math.abs(dx) + Math.abs(dy);
        if (g.total > 6) {
            if (!g.suppress) { g.suppress = true; try { view.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ } }
            const k = cam.current.k;
            jump(cam.current.cx - dx / k, cam.current.cy - dy / k, k);
        }
    };
    const up = (e: RPointerEvent) => {
        ptrs.current.delete(e.pointerId);
        if (ptrs.current.size < 2) gest.current.pinch = 0;
        if (ptrs.current.size === 0) window.setTimeout(() => { gest.current.suppress = false; }, 0);
    };

    const keys = (e: RKeyboardEvent) => {
        touched.current = true;
        if (e.key === "Tab") {
            const f = [...root.current!.querySelectorAll<HTMLElement>("button:not([disabled]), [tabindex='0']")].filter((el) => el.offsetParent !== null);
            const first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            return;
        }
        const { w, h } = dims.current;
        const st = 90 / cam.current.k;
        const { cx, cy, k } = cam.current;
        if (e.key === "ArrowLeft") jump(cx - st, cy, k);
        else if (e.key === "ArrowRight") jump(cx + st, cy, k);
        else if (e.key === "ArrowUp") jump(cx, cy - st, k);
        else if (e.key === "ArrowDown") jump(cx, cy + st, k);
        else if (e.key === "+" || e.key === "=") zoomAt(w / 2, h / 2, 1.25, true);
        else if (e.key === "-" || e.key === "_") zoomAt(w / 2, h / 2, 0.8, true);
        else if (e.key === "0") fit();
        else if (e.key === "Home") flyTo(0, 0, cam.current.k);
        else return;
        if ((e.target as HTMLElement).tagName !== "BUTTON" || e.key.startsWith("Arrow")) e.preventDefault();
    };

    const ensureVisible = (n: TreeNode) => {
        const { w, h, st } = dims.current;
        const { cx, cy, k } = cam.current;
        const sx = w / 2 + (n.x * U - cx) * k, sy = h / 2 + (n.y * U - cy) * k;
        if (sx < 80 || sx > w - 80 || sy < st + 80 || sy > h - 120) focusNode(n.id);
    };

    // hover shows the card, with a short grace period so the pointer can travel from the node onto the card
    const hoverOn = (id: string) => {
        window.clearTimeout(hovT.current);
        if (glide.current || ptrs.current.size) return;
        if (hovRef.current !== id) setHov(id);
    };
    const hoverOff = () => { window.clearTimeout(hovT.current); hovT.current = window.setTimeout(() => setHov(null), 160); };

    // 3D tilt toward the pointer, written straight to the node (no React state per move)
    const tilt = (e: RPointerEvent<HTMLElement>, id: string) => {
        if (e.pointerType !== "mouse") return;
        const moved = Math.abs(e.clientX - lastPt.current.x) + Math.abs(e.clientY - lastPt.current.y) > 1;
        lastPt.current = { x: e.clientX, y: e.clientY };
        if (moved) hoverOn(id);
        if (reduced) return;
        const el = e.currentTarget, b = el.getBoundingClientRect();
        const px = (e.clientX - b.left) / b.width - 0.5, py = (e.clientY - b.top) / b.height - 0.5;
        el.style.setProperty("--ry", `${(px * 26).toFixed(1)}deg`);
        el.style.setProperty("--rx", `${(-py * 26).toFixed(1)}deg`);
    };
    const untilt = (e: RPointerEvent<HTMLElement>) => { e.currentTarget.style.removeProperty("--rx"); e.currentTarget.style.removeProperty("--ry"); };

    const pick = (id: string) => {
        setHintMin(true);
        if (sel === id) return;
        setSel(id);
        setHov(null);
        focusNode(id);
    };

    const owned = s.tree.length;
    const selNode = sel && sel !== "core" ? treeNode(sel) : null;
    const near = useMemo(() => new Set(selNode ? [selNode.id, ...selNode.links] : sel === "core" ? ["core", ...TREE.filter((n) => n.links.includes("core")).map((n) => n.id)] : []), [sel]); // eslint-disable-line react-hooks/exhaustive-deps

    // links are circuit traces: a straight run, a 45 degree bend, a straight run (vias at the bends), on a dark bed.
    // Owned traces light up and carry packets outward (one packet path per section).
    const links = useMemo(() => {
        const out: { key: string; d: string; vias: [number, number][]; col: string; st: "on" | "edge" | "off"; fog: boolean; near: boolean }[] = [];
        const have = (id: string) => id === "core" || s.tree.includes(id);
        for (const n of TREE) for (const l of n.links) {
            if (l !== "core" && n.id > l) continue;
            const m = l === "core" ? null : treeNode(l);
            if (!seen(n.id) || (m && !seen(m.id))) continue;
            // draw from the inner end outward, so packets flow away from the core
            let a = { x: m ? m.x * U : 0, y: m ? m.y * U : 0, id: l }, b = { x: n.x * U, y: n.y * U, id: n.id };
            if (Math.hypot(a.x, a.y) > Math.hypot(b.x, b.y)) [a, b] = [b, a];
            const ha = have(a.id), hb = have(b.id);
            const dx = b.x - a.x, dy = b.y - a.y, adx = Math.abs(dx), ady = Math.abs(dy);
            const sx = Math.sign(dx), sy = Math.sign(dy), dg = Math.min(adx, ady), run = (Math.max(adx, ady) - dg) / 2;
            const p1: [number, number] = adx >= ady ? [a.x + sx * run, a.y] : [a.x, a.y + sy * run];
            const p2: [number, number] = [p1[0] + sx * dg, p1[1] + sy * dg];
            const f = (v: number) => v.toFixed(1);
            const bent = dg > 4 && run > 4;
            out.push({
                key: a.id + "-" + b.id, col: BCOL[n.branch],
                d: `M${f(a.x)} ${f(a.y)}L${f(p1[0])} ${f(p1[1])}L${f(p2[0])} ${f(p2[1])}L${f(b.x)} ${f(b.y)}`,
                vias: bent ? [p1, p2] : [],
                st: ha && hb ? "on" : ha || hb ? "edge" : "off",
                fog: vis.get(n.id) === "fog" || (!!m && vis.get(m.id) === "fog"),
                near: !!sel && (near.has(a.id) && near.has(b.id)),
            });
        }
        return out;
    }, [s.tree.length, vis, sel, near]); // eslint-disable-line react-hooks/exhaustive-deps
    const packets = useMemo(() => {
        const by: Record<string, string> = {};
        for (const l of links) if (l.st === "on") by[l.col] = (by[l.col] ?? "") + l.d;
        return Object.entries(by);
    }, [links]);

    // section labels sit just past the furthest visible node of each section
    const labels = useMemo(() => BRANCHES.map((b) => {
        const mine = TREE.filter((n) => n.branch === b.id);
        const ax = mine.reduce((a, n) => a + n.x, 0), ay = mine.reduce((a, n) => a + n.y, 0);
        const th = Math.atan2(ay, ax);
        const far = mine.filter((n) => seen(n.id)).reduce((m, n) => Math.max(m, Math.hypot(n.x, n.y)), 0);
        return { b, th, r: far ? far + 0.85 : 0, got: mine.filter((n) => hasNode(s, n.id)).length, total: mine.length };
    }), [vis, s.tree.length]); // eslint-disable-line react-hooks/exhaustive-deps

    const rows = totals(s);
    const spent = s.tree.reduce((a, id) => a + (TREE.find((n) => n.id === id)?.cost ?? 0), 0);
    const ready = TREE.filter((n) => seen(n.id) && stateOf(s, n) === "ready").length;

    const buy = (id: string) => {
        onBuy(id);
        setFlash(id);
        window.setTimeout(() => setFlash((f) => (f === id ? null : f)), 900);
    };
    const respec = () => {
        if (!s.tree.length) return;
        if (!confirm) { setConfirm(true); window.setTimeout(() => setConfirm(false), 4000); return; }
        const back = onRespec();
        setConfirm(false);
        setSel("");
        setMsg(`Tree cleared. ${fmt(back)} AP refunded.`);
        window.setTimeout(() => setMsg(""), 4000);
        requestAnimationFrame(() => fit());
    };

    // the boot sequence's terminal lines (real counts, taken once at open)
    const bootLines = useMemo(() => {
        const inRange = TREE.filter((n) => vis.get(n.id) === "shown").length;
        const fog = TREE.filter((n) => vis.get(n.id) === "fog").length;
        return [
            "naos@node-01:~$ tree --mount",
            `> read ${TREE.length} nodes ......... ok`,
            `> decrypt ${inRange} in range ...... ok`,
            fog ? `> ${fog} encrypted // signal weak` : "> no encrypted nodes left",
            `> ${owned} installed // ${fmt(s.ap)} AP free`,
        ];
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // the card's content
    const cn = cardId && cardId !== "core" ? (treeNode(cardId) as Extra) : null;
    const cvis = cn ? vis.get(cn.id) : null;
    const cst = cn ? stateOf(s, cn) : null;
    const fogCard = cvis === "fog";
    const pinned = !!shown && shown === sel;

    // portaled to <body> so no page transition or scroll reveal transform can shift the fixed layer
    return createPortal(
        <div className="ctos nf-tm-host">
        <div className="nf-tm" ref={root} role="dialog" aria-modal="true" aria-label="Prestige tree" data-lod="near" data-focus={sel ? "" : undefined} data-boot={boot} data-open={tr.open} data-type={tr.type} data-chrome={chrome ? "" : undefined} onKeyDown={keys}>
            <header className="nf-tm-bar">
                <span className="nf-tm-t">naOS // node.farm // prestige tree</span>
                <span className="nf-tm-ap" aria-live="polite"><b>{fmt(s.ap)}</b> AP<small>{owned}/{TREE.length} nodes{ready ? ` // ${ready} ready` : ""}</small></span>
                <button type="button" className="nf-tm-b" data-danger={confirm ? "" : undefined} disabled={!owned} onClick={respec} title="Take every node back and refund its AP. Free.">
                    {confirm ? `Confirm: refund ${fmt(spent)} AP` : "Respec"}
                </button>
                <button type="button" className="nf-tm-x" onClick={close} aria-label="Close the tree"><i /></button>
            </header>
            <div
                className="nf-tm-view"
                ref={view}
                tabIndex={0}
                role="group"
                aria-label="Prestige tree map. Drag to pan, scroll or pinch to zoom, arrow keys pan, plus and minus zoom, 0 fits the tree."
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={up}
                onClickCapture={(e) => { if (gest.current.suppress) { e.stopPropagation(); e.preventDefault(); } }}
                onClick={(e) => { if (e.target === view.current || e.target === world.current) { setSel(""); setHov(null); } }}
            >
                <TreeBackdrop ref={bd} unit={U} />
                <div className="nf-tm-world" ref={world}>
                    {labels.map(({ b, th, r, got, total }) => r > 0 && (
                        <div key={b.id} className="nf-tm-sec" data-side={Math.cos(th) > 0.35 ? "r" : Math.cos(th) < -0.35 ? "l" : "c"} style={{ left: Math.cos(th) * r * U, top: Math.sin(th) * r * U, ["--c" as string]: b.color } as CSSProperties}>
                            <b>{b.name}</b>
                            <small>{got}/{total} // {b.blurb}</small>
                        </div>
                    ))}
                    <svg className="nf-tm-links" width={2} height={2} aria-hidden="true">
                        {links.map((l) => <path key={"b" + l.key} className="nf-tl-bed" d={l.d} data-st={l.st} data-fog={l.fog ? "" : undefined} style={{ ["--c" as string]: l.col } as CSSProperties} />)}
                        {links.map((l) => <path key={l.key} className="nf-tl" d={l.d} data-st={l.st} data-fog={l.fog ? "" : undefined} data-near={l.near ? "" : undefined} style={{ ["--c" as string]: l.col } as CSSProperties} />)}
                        {links.map((l) => l.vias.map(([x, y], i) => <rect key={l.key + "v" + i} className="nf-tl-via" x={x - 6} y={y - 6} width={12} height={12} data-st={l.st} data-fog={l.fog ? "" : undefined} data-near={l.near ? "" : undefined} style={{ ["--c" as string]: l.col } as CSSProperties} />))}
                        {!reduced && packets.map(([col, d]) => <path key={col} className="nf-tl-pk" d={d} style={{ ["--c" as string]: col } as CSSProperties} />)}
                    </svg>
                    <button
                        type="button"
                        className="nf-tn nf-tn-core"
                        data-kind="core"
                        data-st="owned"
                        data-sel={sel === "core" ? "" : undefined}
                        data-dim={sel && !near.has("core") ? "" : undefined}
                        aria-label="Core. Every section starts here."
                        style={{ ["--sz" as string]: `${SZ.core}px`, ["--c" as string]: "#e8f6ff", ["--col" as string]: 4, ["--row" as string]: 7 } as CSSProperties}
                        onClick={() => pick("core")}
                        
                        onPointerLeave={(e) => { hoverOff(); untilt(e); }}
                        onPointerMove={(e) => tilt(e, "core")}
                        onFocus={() => setHov("core")}
                        onBlur={() => setHov(null)}
                    >
                        <span className="nf-tn-shadow" />
                        <span className="nf-tn-halo" />
                        <span className="nf-tn-body"><span className="nf-tn-face"><NodeIcon n={null} st="owned" fog={false} /></span></span>
                        <span className="nf-tn-l">core</span>
                    </button>
                    {TREE.map((n) => {
                        const v = vis.get(n.id) ?? "hidden";
                        if (v === "hidden") return null;
                        const st = stateOf(s, n);
                        const fog = v === "fog";
                        return (
                            <button
                                key={n.id}
                                type="button"
                                className="nf-tn"
                                data-kind={n.kind}
                                data-st={st}
                                data-vis={v}
                                data-sel={sel === n.id ? "" : undefined}
                                data-dim={sel && !near.has(n.id) ? "" : undefined}
                                data-flash={flash === n.id ? "" : undefined}
                                data-new={fresh.has(n.id) ? "" : undefined}
                                aria-label={fog ? `Encrypted ${KIND[n.kind].toLowerCase()} node in ${BNAME[n.branch]}.` : `${n.name}, ${BNAME[n.branch]}, ${KIND[n.kind].toLowerCase()}, ${st === "owned" ? "owned" : st === "locked" ? "locked" : `${n.cost} AP`}. ${n.blurb}`}
                                aria-pressed={sel === n.id}
                                style={{ left: n.x * U, top: n.y * U, ["--ring" as string]: Math.min(RING.get(n.id) ?? 1, 8), ["--sz" as string]: `${SZ[n.kind]}px`, ["--c" as string]: BCOL[n.branch], ["--col" as string]: n.ix % 8, ["--row" as string]: Math.floor(n.ix / 8) } as CSSProperties}
                                onClick={() => pick(n.id)}
                                
                                onPointerLeave={(e) => { hoverOff(); untilt(e); }}
                                onPointerMove={(e) => tilt(e, n.id)}
                                onFocus={() => { setHov(n.id); ensureVisible(n); }}
                                onBlur={() => setHov(null)}
                            >
                                <span className="nf-tn-shadow" />
                                {n.kind === "keystone" && <span className="nf-tn-halo" />}
                                <span className="nf-tn-body">
                                    <span className="nf-tn-face"><NodeIcon n={n} st={st} fog={fog} /></span>
                                </span>
                                <span className="nf-tn-l">{fog ? "encrypted" : n.name}</span>
                                {!fog && st !== "owned" && <span className="nf-tn-cost">{n.cost} AP</span>}
                            </button>
                        );
                    })}
                </div>
                <TreeDust />
            </div>
            <span className="nf-tm-zoom" role="group" aria-label="Zoom">
                <button type="button" className="nf-tm-b sq" aria-label="Zoom in" onClick={() => { const { w, h } = dims.current; zoomAt(w / 2, h / 2, 1.33, true); }}>+</button>
                <button type="button" className="nf-tm-b" onClick={() => fit()}>Fit</button>
                <button type="button" className="nf-tm-b sq" aria-label="Zoom out" onClick={() => { const { w, h } = dims.current; zoomAt(w / 2, h / 2, 0.75, true); }}>-</button>
            </span>
            <span className="nf-tm-lead" ref={lead} aria-hidden="true" style={{ ["--c" as string]: cn ? BCOL[cn.branch] : "#e8f6ff" } as CSSProperties} />
            <aside
                className="nf-tm-card"
                ref={card}
                key={cardId ?? "none"}
                data-st={fogCard ? "fog" : cst ?? "core"}
                data-pinned={pinned ? "" : undefined}
                data-kind={cn?.kind ?? "core"}
                style={{ ["--c" as string]: cn ? BCOL[cn.branch] : "#e8f6ff", visibility: "hidden" } as CSSProperties}
                aria-live="polite"
                onPointerEnter={() => window.clearTimeout(hovT.current)}
                onPointerLeave={() => { if (hov && hov !== sel) hoverOff(); }}
            >
                {cardId && (cn ? (
                    <>
                        <span className="nf-tm-k" data-cx-i="0">
                            <span>{BNAME[cn.branch].toLowerCase()}.{cn.kind}</span>
                            <span className="nf-tm-st">{fogCard ? "ENCRYPTED" : cst === "owned" ? "OWNED" : cst === "locked" ? "LOCKED" : cst === "ready" ? "READY" : "AVAILABLE"}</span>
                        </span>
                        <b className="nf-tm-n" data-cx-i="1">{fogCard ? <ScrambleName text="????????" reduced={reduced} /> : <ScrambleName text={cn.name} reduced={reduced} />}<span className="sr-only">{fogCard ? "Encrypted node" : cn.name}</span></b>
                        {fogCard ? (
                            <p className="nf-tm-fx" data-cx-i="2"><i aria-hidden="true">err</i><span>Signal too weak to read. Buy a node next to it to decrypt this one.</span></p>
                        ) : (
                            <>
                                <p className="nf-tm-fx" data-cx-i="2"><i aria-hidden="true">fx</i><span><Fx text={cn.blurb} /></span></p>
                                {cn.flavor && <blockquote className="nf-tm-flv" data-cx-i="3"><p>{cn.flavor}</p></blockquote>}
                            </>
                        )}
                        {!fogCard && cst === "locked" && (
                            <p className="nf-tm-need" data-cx-i="4">// needs a neighbour: {cn.links.filter((l) => l !== "core" && seen(l) && vis.get(l) !== "fog").map((l) => treeNode(l).name).join(", ") || "decrypt the path first"}</p>
                        )}
                        {!fogCard && (
                            <div className="nf-tm-a" data-cx-i="5">
                                <span className="nf-tm-cost"><b>{cst === "owned" ? "Owned" : `${cn.cost} AP`}</b><small>{cst === "owned" ? "kept through Ascend" : `you have ${fmt(s.ap)}`}</small></span>
                                {cst !== "owned" && (
                                    <button type="button" className="nf-tm-buy" disabled={cst !== "ready"} onClick={() => buy(cn.id)}>
                                        {cst === "locked" ? "Locked" : cst === "open" ? `Need ${fmt(cn.cost - s.ap)} more` : "Install"}
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <span className="nf-tm-k" data-cx-i="0"><span>core.root</span><span className="nf-tm-st">ONLINE</span></span>
                        <b className="nf-tm-n" data-cx-i="1"><ScrambleName text="The core" reduced={reduced} /><span className="sr-only">The core</span></b>
                        <p className="nf-tm-fx" data-cx-i="2"><i aria-hidden="true">sys</i><span>Every section grows out of here. A node opens once it touches the core or a node you own; the next ring decrypts as you buy toward it.</span></p>
                        <blockquote className="nf-tm-flv" data-cx-i="3"><p>Respec is free and refunds every AP.</p></blockquote>
                    </>
                ))}
                {msg && <p className="nf-tm-msg" role="status">{msg}</p>}
            </aside>
            {!sel && !hov && boot !== "in" && (
                <button type="button" className="nf-tm-hint" data-min={hintMin ? "" : undefined} aria-expanded={!hintMin} aria-label={hintMin ? "Show the tree controls" : "Hide the tree controls"} onClick={() => setHintMin((m) => !m)}>
                    <span className="nf-tm-ps">~/tree $</span>
                    <span className="nf-tm-hc" key={hintMin ? "min" : "full"}>
                        {hintMin
                            ? (ready ? <><b>{ready}</b> ready</> : "help")
                            : <>{ready ? <><b>{ready}</b> ready to install // </> : null}{coarse ? (ready ? "tap one to read it" : "tap: read // drag: pan // pinch: zoom") : "click: read // drag: pan // scroll: zoom"}</>}
                    </span>
                    <i className="nf-tm-caret" aria-hidden="true" />
                </button>
            )}
            {msg && !shown && <p className="nf-tm-toast" role="status">{msg}</p>}
            {chrome && (
                <button type="button" className="nf-tm-dockb" aria-expanded={dockOpen} aria-label={dockOpen ? "Hide the page dock" : "Show the page dock"} onClick={() => setDockOpen((v) => !v)}>
                    <i aria-hidden="true" />&lt;/&gt; pages
                </button>
            )}
            {boot === "in" && tr.open === "boot" && (
                <div className="nf-tm-boot" aria-hidden="true">
                    <div className="nf-tm-boot-t">
                        {bootLines.map((l, i) => <span key={i} style={{ ["--n" as string]: l.length, ["--d" as string]: `${80 + i * 150}ms` } as CSSProperties}>{l}</span>)}
                    </div>
                </div>
            )}
            {rows.length > 0 && (
                <>
                    <button type="button" className="nf-tm-b nf-tm-totb" aria-expanded={showTot} onClick={() => setShowTot((v) => !v)}>Tree gives</button>
                    <dl className="nf-tm-tot" data-open={showTot ? "" : undefined} aria-label="What the tree gives you">
                        <dt className="nf-tm-th">Tree gives</dt><dd className="nf-tm-th" />
                        {rows.map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{val}</dd></div>)}
                    </dl>
                </>
            )}
        </div>
        </div>,
        document.body,
    );
}
