"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { createPortal } from "react-dom";
import { TreeBackdrop, TreeDust, type TreeBackdropHandle } from "./tree-backdrop";
import { TreeSprite, type SpriteState } from "./tree-sprite";
import { SPRITE_CELLS } from "@/lib/nodefarm/tree-sprites";
import { cardGlitch } from "./card-glitch";
import { LabBackdrop } from "./lab-backdrop";
import { FwBackdrop } from "./fw-backdrop";
import { HangarBackdrop } from "./hangar-backdrop";
import { BRANCHES, TREE, fmt, nodeCost, nodeLevel, nodeOpen, nodeVis, treeNode, treeSpent, treeTotals, type Branch, type State, type TreeKind } from "@/lib/nodefarm/engine";

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
const KIND = { minor: "MINOR", notable: "NOTABLE", keystone: "KEYSTONE" } as const;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

type Vis = "shown" | "fog" | "hidden";

/** One node as the menu sees it. The prestige tree (TREE) and the Exploit Lab research tree (LAB) both fit this. */
export interface MenuNode {
    id: string; branch: string; kind: TreeKind; name: string; blurb: string; flavor?: string; cost: number; links: string[]; x: number; y: number; ix: number; sprite?: string;
    /** the deeper prestige tree: junction (needs every `req`), fork (owning `excl` locks it until you swap), ranked (bought up to `ranks` times) */
    form?: "junction" | "fork" | "ranked"; req?: string[]; excl?: string; ranks?: number;
}
/**
 * What the menu needs to draw a tree. The same camera, tiles, card, links and reveal run both trees; the model swaps the
 * data, the currency and the words, and `theme` picks the look (the research tree is the blue "lab" skin, nodefarm-lab.css).
 */
export interface TreeModel {
    theme: "prestige" | "lab" | "root" | "hangar";
    /** bar title after "naOS // node.farm // " */
    title: string;
    /** dialog label, also used in sentences ("Prestige tree map") */
    label: string;
    nodes: MenuNode[];
    sections: { id: string; name: string; blurb: string; color: string }[];
    /** owned node ids */
    owned: string[];
    /** the currency you have, and its short name */
    wallet: number;
    unit: string;
    open: (n: MenuNode) => boolean;
    vis: (n: MenuNode) => Vis;
    /** what the owned nodes add up to, as label and value rows */
    totals: () => [string, string][];
    totalsLabel: string;
    /** the card's line under an owned node's price */
    keptNote: string;
    /** the buy button's word */
    buyWord: string;
    /** the core's card */
    core: { kicker: string; name: string; fx: string; quote: string; color: string };
    /** the controls line prompt, such as "~/tree $" */
    prompt: string;
    /** the fogged node's card line */
    fogText: string;
    /** free respec (prestige tree only) */
    respec: boolean;
    /** how far out "fit" may zoom: [phone, desktop]. A small tree can show all of itself at once. */
    fitMin?: [number, number];
    /** an extra fact line on a node's card (the lab shows what a recipe compiles into) */
    spec?: (n: MenuNode) => string | null;
    /** ranks owned (0 when not owned); default 1 for an owned node */
    level?: (n: MenuNode) => number;
    /** what the next purchase costs (ranked nodes climb); default n.cost */
    price?: (n: MenuNode) => number;
    /** currency a respec would refund; default the sum of owned costs */
    spent?: () => number;
}

/** The prestige tree as a model (the default). */
export function prestigeModel(s: State): TreeModel {
    return {
        theme: "prestige", title: "prestige tree", label: "Prestige tree", nodes: TREE, sections: BRANCHES, owned: s.tree, wallet: s.ap, unit: "AP",
        open: (n) => nodeOpen(s, treeNode(n.id)), vis: (n) => nodeVis(s, treeNode(n.id)), totals: () => treeTotals(s), totalsLabel: "Tree gives",
        level: (n) => nodeLevel(s, n.id), price: (n) => nodeCost(s, treeNode(n.id)), spent: () => treeSpent(s),
        keptNote: "kept through Ascend", buyWord: "Install", prompt: "~/tree $", respec: true,
        fogText: "Signal too weak to read. Buy a node next to it to decrypt this one.",
        core: { kicker: "core.root", name: "The core", fx: "Every section grows out of here. A node opens once it touches the core or a node you own; the next ring decrypts as you buy toward it.", quote: "Respec is free and refunds every AP.", color: "#e8f6ff" },
    };
}

/** Steps from the core along the links, so the opening can decrypt the tree ring by ring. */
function ringsOf(nodes: MenuNode[]): Map<string, number> {
    const by = new Map(nodes.map((n) => [n.id, n]));
    const d = new Map<string, number>();
    const q: string[] = [];
    for (const n of nodes) if (n.links.includes("core")) { d.set(n.id, 1); q.push(n.id); }
    for (let i = 0; i < q.length; i++) {
        const r = d.get(q[i])!;
        for (const l of by.get(q[i])!.links) if (l !== "core" && !d.has(l)) { d.set(l, r + 1); q.push(l); }
    }
    return d;
}
const BOOT_MS = 1150;
const CLOSE_MS = 320;
type NodeState = "owned" | "ready" | "open" | "locked";

/** The node's icon: the art thread's sprite when the sheet has this key, else the older shared sheet. */
function NodeIcon({ n, st, fog, core }: { n: MenuNode | null; st: NodeState; fog: boolean; core?: string }) {
    const key = n ? n.sprite ?? n.id : core ?? "core";
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

function visMap(m: TreeModel): Map<string, Vis> {
    const out = new Map<string, Vis>();
    for (const n of m.nodes) out.set(n.id, m.vis(n));
    return out;
}

const levelOf = (m: TreeModel, n: MenuNode) => m.level?.(n) ?? (m.owned.includes(n.id) ? 1 : 0);
const priceOf = (m: TreeModel, n: MenuNode) => m.price?.(n) ?? n.cost;
/** A ranked node with ranks left: owned (lit), but still for sale. */
const moreRanks = (m: TreeModel, n: MenuNode) => !!n.ranks && m.owned.includes(n.id) && levelOf(m, n) < n.ranks;
/** What buying this node does right now: buy, next rank, or swap the other side of a fork. */
function buyState(m: TreeModel, n: MenuNode): NodeState {
    if (m.owned.includes(n.id) && !moreRanks(m, n)) return "owned";
    if (!m.open(n)) return "locked";
    return m.wallet + (n.excl && m.owned.includes(n.excl) ? priceOf(m, n) : 0) >= priceOf(m, n) ? "ready" : "open";
}
/** The tile's look: a ranked node with ranks left still looks owned. */
function stateOf(m: TreeModel, n: MenuNode): NodeState {
    return m.owned.includes(n.id) ? "owned" : buyState(m, n);
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

type TreeMenuProps = { s: State; /** which tree to draw (default: the prestige tree) */ model?: TreeModel; /** changes whenever the tree, AP or anything else the menu shows changes (the State object itself is mutated in place) */ ver: string; reduced: boolean; onBuy: (id: string) => void; onRespec?: () => number; onClose: () => void };

/** The game re-renders ten times a second; the menu only needs to follow when what it shows changes. */
export const TreeMenu = memo(TreeMenuInner, (a, b) => a.s === b.s && a.ver === b.ver && a.reduced === b.reduced && a.model?.theme === b.model?.theme);

function TreeMenuInner({ s, model, reduced, onBuy, onRespec, onClose }: TreeMenuProps) {
    const m = model ?? prestigeModel(s);
    const lab = m.theme === "lab";
    const root_ = m.theme === "root"; // the Handover Firmware tree (green phosphor skin, nodefarm-handover.css)
    const hangar = m.theme === "hangar";
    // per-model lookups (the node list is a constant per model, so these only build once per theme)
    const { byId, BCOL, BNAME, RING } = useMemo(() => ({
        byId: new Map(m.nodes.map((n) => [n.id, n])),
        BCOL: Object.fromEntries(m.sections.map((b) => [b.id, b.color])) as Record<string, string>,
        BNAME: Object.fromEntries(m.sections.map((b) => [b.id, b.name])) as Record<string, string>,
        RING: ringsOf(m.nodes),
    }), [m.theme]); // eslint-disable-line react-hooks/exhaustive-deps
    const treeNode = (id: string) => byId.get(id)!;
    const TREE = m.nodes;
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

    const vis = useMemo(() => visMap(m), [s, m.theme, m.owned.length]); // eslint-disable-line react-hooks/exhaustive-deps
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
        const k = clamp(Math.min(w / bw, (h - st) / bh), (m.fitMin ?? [0.42, 0.56])[w < 700 ? 0 : 1], maxK);
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
            // zoom through the core (Nate's pick): start far past the usual zoom limit inside the core, then fall back to
            // the fitted view while the rings unfold outward
            const t = fitTarget();
            stop();
            cam.current = { cx: 0, cy: 0, k: 3.4 };
            apply();
            bootT.current.push(window.setTimeout(() => { if (!touched.current) flyTo(t.cx, t.cy, t.k, 900); }, 60));
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
        const t = window.setTimeout(() => setBoot((b) => (b === "in" ? "done" : b)), BOOT_MS);
        const list = bootT.current;
        return () => { window.clearTimeout(t); list.forEach((x) => window.clearTimeout(x)); };
    }, []);

    // desktop framing: the tree's bar slots between the site's top-left and top-right clusters, which stay usable
    useEffect(() => {
        const mq = window.matchMedia("(min-width: 900px)");
        const lay = () => {
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
        lay();
        window.addEventListener("resize", lay);
        mq.addEventListener("change", lay);
        return () => { window.removeEventListener("resize", lay); mq.removeEventListener("change", lay); document.body.classList.remove("nf-tm-chrome"); };
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
        if (shown) { void cardGlitch(el, "in"); return; }
        if (!leaving) return;
        const id = leaving;
        void cardGlitch(el, "out").then(() => setLeaving((l) => (l === id ? null : l)));
    }, [shown, leaving]);
    useEffect(() => { bd.current?.focus(shown && shown !== "core" ? (treeNode(shown).branch as Branch) : null); }, [shown]);

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

    const ensureVisible = (n: MenuNode) => {
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

    const owned = m.owned.length;
    const selNode = sel && sel !== "core" ? treeNode(sel) : null;
    const near = useMemo(() => new Set(selNode ? [selNode.id, ...selNode.links] : sel === "core" ? ["core", ...TREE.filter((n) => n.links.includes("core")).map((n) => n.id)] : []), [sel]); // eslint-disable-line react-hooks/exhaustive-deps

    // links are circuit traces: a straight run, a 45 degree bend, a straight run (vias at the bends), on a dark bed.
    // Owned traces light up and carry packets outward (one packet path per section).
    const links = useMemo(() => {
        const out: { key: string; d: string; vias: [number, number][]; col: string; st: "on" | "edge" | "off"; fog: boolean; near: boolean }[] = [];
        const have = (id: string) => id === "core" || m.owned.includes(id);
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
    }, [m.owned, vis, sel, near]); // eslint-disable-line react-hooks/exhaustive-deps
    const packets = useMemo(() => {
        const by: Record<string, string> = {};
        for (const l of links) if (l.st === "on") by[l.col] = (by[l.col] ?? "") + l.d;
        return Object.entries(by);
    }, [links]);

    // section labels sit just past the furthest visible node of each section
    const labels = useMemo(() => m.sections.map((b) => {
        const mine = TREE.filter((n) => n.branch === b.id);
        const ax = mine.reduce((a, n) => a + n.x, 0), ay = mine.reduce((a, n) => a + n.y, 0);
        const th = Math.atan2(ay, ax);
        const far = mine.filter((n) => seen(n.id)).reduce((m, n) => Math.max(m, Math.hypot(n.x, n.y)), 0);
        // the deeper tips are big ranked tiles with pips above them, so their label sits a little further out
        return { b, th, r: far ? far + (far > 12 ? 1.35 : 0.85) : 0, got: mine.filter((n) => m.owned.includes(n.id)).length, total: mine.length };
    }), [vis, m.owned]); // eslint-disable-line react-hooks/exhaustive-deps

    const rows = m.totals();
    const spent = m.spent ? m.spent() : m.owned.reduce((a, id) => a + (byId.get(id)?.cost ?? 0), 0);
    // ready to buy: new nodes and ranks left, not fork swaps (a swap is a choice, not progress)
    const ready = TREE.filter((n) => seen(n.id) && buyState(m, n) === "ready" && !(n.excl && m.owned.includes(n.excl))).length;

    const buy = (id: string) => {
        onBuy(id);
        setFlash(id);
        window.setTimeout(() => setFlash((f) => (f === id ? null : f)), 900);
    };
    const respec = () => {
        if (!m.owned.length || !onRespec) return;
        if (!confirm) { setConfirm(true); window.setTimeout(() => setConfirm(false), 4000); return; }
        const back = onRespec();
        setConfirm(false);
        setSel("");
        setMsg(`Tree cleared. ${fmt(back)} ${m.unit} refunded.`);
        window.setTimeout(() => setMsg(""), 4000);
        requestAnimationFrame(() => fit());
    };

    // the card's content
    const cn = cardId && cardId !== "core" ? treeNode(cardId) : null;
    const cvis = cn ? vis.get(cn.id) : null;
    const cst = cn ? buyState(m, cn) : null;
    const clv = cn ? levelOf(m, cn) : 0;
    const cprice = cn ? priceOf(m, cn) : 0;
    const cswap = cn?.excl && m.owned.includes(cn.excl) ? treeNode(cn.excl) : null;
    const fogCard = cvis === "fog";
    const pinned = !!shown && shown === sel;

    // portaled to <body> so no page transition or scroll reveal transform can shift the fixed layer
    return createPortal(
        <div className="ctos nf-tm-host">
        <div className="nf-tm" ref={root} role="dialog" aria-modal="true" aria-label={m.label} data-theme={m.theme} data-lod="near" data-focus={sel ? "" : undefined} data-boot={boot} data-chrome={chrome ? "" : undefined} onKeyDown={keys}>
            <header className="nf-tm-bar">
                <span className="nf-tm-t">{lab && <i className="nf-tm-ps1" aria-hidden="true">PS ~/lab&gt;</i>}{root_ && <i className="nf-tm-ps1" aria-hidden="true">root@node0:/fw#</i>}{hangar && <i className="nf-tm-ps1" aria-hidden="true">~/hangar $</i>}naOS // node.farm // {m.title}</span>
                <span className="nf-tm-ap" aria-live="polite"><b>{fmt(m.wallet)}</b> {m.unit}<small>{owned}/{TREE.length} nodes{ready ? ` // ${ready} ready` : ""}</small></span>
                {m.respec && onRespec && (
                    <button type="button" className="nf-tm-b" data-danger={confirm ? "" : undefined} disabled={!owned} onClick={respec} title={`Take every node back and refund its ${m.unit}. Free.`}>
                        {confirm ? `Confirm: refund ${fmt(spent)} ${m.unit}` : "Respec"}
                    </button>
                )}
                <button type="button" className="nf-tm-x" onClick={close} aria-label="Close the tree"><i /></button>
            </header>
            <div
                className="nf-tm-view"
                ref={view}
                tabIndex={0}
                role="group"
                aria-label={`${m.label} map. Drag to pan, scroll or pinch to zoom, arrow keys pan, plus and minus zoom, 0 fits the tree.`}
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={up}
                onClickCapture={(e) => { if (gest.current.suppress) { e.stopPropagation(); e.preventDefault(); } }}
                onClick={(e) => { if (e.target === view.current || e.target === world.current) { setSel(""); setHov(null); } }}
            >
                {lab ? <LabBackdrop ref={bd} unit={U} /> : root_ ? <FwBackdrop ref={bd} unit={U} /> : hangar ? <HangarBackdrop ref={bd} unit={U} /> : <TreeBackdrop ref={bd} unit={U} />}
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
                        <span className="nf-tn-body"><span className="nf-tn-face"><NodeIcon n={null} st="owned" fog={false} core={lab ? "rx_core" : root_ ? "fw_core" : hangar ? "dx_core" : undefined} /></span></span>
                        <span className="nf-tn-l">core</span>
                    </button>
                    {TREE.map((n) => {
                        const v = vis.get(n.id) ?? "hidden";
                        if (v === "hidden") return null;
                        const st = stateOf(m, n);
                        const bst = buyState(m, n);
                        const fog = v === "fog";
                        const lv = levelOf(m, n);
                        const swapOut = !!n.excl && m.owned.includes(n.excl);
                        return (
                            <button
                                key={n.id}
                                type="button"
                                className="nf-tn"
                                data-kind={n.kind}
                                data-form={n.form}
                                data-swap={swapOut && !fog ? "" : undefined}
                                data-more={moreRanks(m, n) && bst === "ready" ? "" : undefined}
                                data-st={st}
                                data-vis={v}
                                data-sel={sel === n.id ? "" : undefined}
                                data-dim={sel && !near.has(n.id) ? "" : undefined}
                                data-flash={flash === n.id ? "" : undefined}
                                data-new={fresh.has(n.id) ? "" : undefined}
                                aria-label={fog ? `Encrypted ${KIND[n.kind].toLowerCase()} node in ${BNAME[n.branch]}.` : `${n.name}, ${BNAME[n.branch]}, ${KIND[n.kind].toLowerCase()}, ${n.ranks ? `rank ${lv} of ${n.ranks}, ` : ""}${bst === "owned" ? "owned" : bst === "locked" ? "locked" : `${fmt(priceOf(m, n))} ${m.unit}`}. ${n.blurb}`}
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
                                {!fog && n.form && <span className="nf-tn-form" aria-hidden="true">{n.form === "ranked" ? <>{Array.from({ length: n.ranks ?? 1 }, (_, i) => <i key={i} data-on={i < lv ? "" : undefined} />)}</> : n.form === "fork" ? (swapOut ? "swap" : "fork") : "junction"}</span>}
                                {!fog && bst !== "owned" && <span className="nf-tn-cost">{fmt(priceOf(m, n))} {m.unit}</span>}
                            </button>
                        );
                    })}
                </div>
                {!lab && !root_ && !hangar && <TreeDust />}
            </div>
            <span className="nf-tm-zoom" role="group" aria-label="Zoom">
                <button type="button" className="nf-tm-b sq" aria-label="Zoom in" onClick={() => { const { w, h } = dims.current; zoomAt(w / 2, h / 2, 1.33, true); }}>+</button>
                <button type="button" className="nf-tm-b" onClick={() => fit()}>Fit</button>
                <button type="button" className="nf-tm-b sq" aria-label="Zoom out" onClick={() => { const { w, h } = dims.current; zoomAt(w / 2, h / 2, 0.75, true); }}>-</button>
            </span>
            <span className="nf-tm-lead" ref={lead} aria-hidden="true" style={{ ["--c" as string]: cn ? BCOL[cn.branch] : m.core.color } as CSSProperties} />
            <aside
                className="nf-tm-card"
                ref={card}
                key={cardId ?? "none"}
                data-st={fogCard ? "fog" : cst ?? "core"}
                data-pinned={pinned ? "" : undefined}
                data-kind={cn?.kind ?? "core"}
                style={{ ["--c" as string]: cn ? BCOL[cn.branch] : m.core.color, visibility: "hidden" } as CSSProperties}
                aria-live="polite"
                onPointerEnter={() => window.clearTimeout(hovT.current)}
                onPointerLeave={() => { if (hov && hov !== sel) hoverOff(); }}
            >
                {cardId && (cn ? (
                    <>
                        <span className="nf-tm-k" data-cx-i="0">
                            <span>{BNAME[cn.branch].toLowerCase()}.{fogCard ? cn.kind : cn.form ?? cn.kind}</span>
                            <span className="nf-tm-st">{fogCard ? "ENCRYPTED" : cn.ranks && clv ? `RANK ${clv}/${cn.ranks}` : cst === "owned" ? "OWNED" : cst === "locked" ? "LOCKED" : cswap ? "SWAP" : cst === "ready" ? "READY" : "AVAILABLE"}</span>
                        </span>
                        <b className="nf-tm-n" data-cx-i="1">{fogCard ? <ScrambleName text="????????" reduced={reduced} /> : <ScrambleName text={cn.name} reduced={reduced} />}<span className="sr-only">{fogCard ? "Encrypted node" : cn.name}</span></b>
                        {fogCard ? (
                            <p className="nf-tm-fx" data-cx-i="2"><i aria-hidden="true">err</i><span>{m.fogText}</span></p>
                        ) : (
                            <>
                                <p className="nf-tm-fx" data-cx-i="2"><i aria-hidden="true">fx</i><span><Fx text={cn.blurb} /></span></p>
                                {m.spec?.(cn) && <p className="nf-tm-spec" data-cx-i="2">{m.spec(cn)}</p>}
                                {cn.flavor && <blockquote className="nf-tm-flv" data-cx-i="3"><p>{cn.flavor}</p></blockquote>}
                            </>
                        )}
                        {!fogCard && cst === "locked" && (cn.req ? (
                            <p className="nf-tm-need" data-cx-i="4">// needs both: {cn.req.map((r) => `${m.owned.includes(r) ? "[x]" : "[ ]"} ${seen(r) && vis.get(r) !== "fog" ? treeNode(r).name : `a ${BNAME[treeNode(r).branch]} node, still encrypted`}`).join("  ")}</p>
                        ) : (
                            <p className="nf-tm-need" data-cx-i="4">// needs a neighbour: {cn.links.filter((l) => l !== "core" && seen(l) && vis.get(l) !== "fog").map((l) => treeNode(l).name).join(", ") || "decrypt the path first"}</p>
                        ))}
                        {!fogCard && cn.form === "fork" && cn.excl && (
                            <p className="nf-tm-need" data-cx-i="4" data-tone="fork">// fork: pick one. {cswap ? `Swapping refunds ${cswap.name} and takes this instead, free.` : m.owned.includes(cn.id) ? `${seen(cn.excl) ? treeNode(cn.excl).name : "The other side"} is locked; buy it to swap.` : `Owning this locks ${seen(cn.excl) && vis.get(cn.excl) !== "fog" ? treeNode(cn.excl).name : "the other side"}.`}</p>
                        )}
                        {!fogCard && cn.ranks && (
                            <p className="nf-tm-need" data-cx-i="4" data-tone="rank">// ranked: buy it up to {cn.ranks} times, the price climbs each rank. {clv ? `${clv} of ${cn.ranks} owned.` : "None owned yet."}</p>
                        )}
                        {!fogCard && (
                            <div className="nf-tm-a" data-cx-i="5">
                                <span className="nf-tm-cost"><b>{cst === "owned" ? (cn.ranks ? "Maxed" : "Owned") : cswap ? "Free swap" : `${fmt(cprice)} ${m.unit}`}</b><small>{cst === "owned" ? m.keptNote : `you have ${fmt(m.wallet)}`}</small></span>
                                {cst !== "owned" && (
                                    <button type="button" className="nf-tm-buy" disabled={cst !== "ready"} onClick={() => buy(cn.id)}>
                                        {cst === "locked" ? "Locked" : cst === "open" ? `Need ${fmt(cprice - m.wallet)} more` : cswap ? "Swap" : clv ? `Rank ${clv + 1}` : m.buyWord}
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <span className="nf-tm-k" data-cx-i="0"><span>{m.core.kicker}</span><span className="nf-tm-st">ONLINE</span></span>
                        <b className="nf-tm-n" data-cx-i="1"><ScrambleName text={m.core.name} reduced={reduced} /><span className="sr-only">{m.core.name}</span></b>
                        <p className="nf-tm-fx" data-cx-i="2"><i aria-hidden="true">sys</i><span>{m.core.fx}</span></p>
                        <blockquote className="nf-tm-flv" data-cx-i="3"><p>{m.core.quote}</p></blockquote>
                    </>
                ))}
                {msg && <p className="nf-tm-msg" role="status">{msg}</p>}
            </aside>
            {!sel && !hov && boot !== "in" && (
                <button type="button" className="nf-tm-hint" data-min={hintMin ? "" : undefined} aria-expanded={!hintMin} aria-label={hintMin ? "Show the tree controls" : "Hide the tree controls"} onClick={() => setHintMin((m) => !m)}>
                    <span className="nf-tm-ps">{m.prompt}</span>
                    <span className="nf-tm-hc" key={hintMin ? "min" : "full"}>
                        {hintMin
                            ? (ready ? <><b>{ready}</b> ready</> : "help")
                            : <>{ready ? <><b>{ready}</b> ready to {m.buyWord.toLowerCase()} // </> : null}{coarse ? (ready ? "tap one to read it" : "tap: read // drag: pan // pinch: zoom") : "click: read // drag: pan // scroll: zoom"}</>}
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
            {rows.length > 0 && (
                <>
                    <button type="button" className="nf-tm-b nf-tm-totb" aria-expanded={showTot} onClick={() => setShowTot((v) => !v)}>{m.totalsLabel}</button>
                    <dl className="nf-tm-tot" data-open={showTot ? "" : undefined} aria-label={`What the ${m.label.toLowerCase()} gives you`}>
                        <dt className="nf-tm-th">{m.totalsLabel}</dt><dd className="nf-tm-th" />
                        {rows.map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{val}</dd></div>)}
                    </dl>
                </>
            )}
        </div>
        </div>,
        document.body,
    );
}
