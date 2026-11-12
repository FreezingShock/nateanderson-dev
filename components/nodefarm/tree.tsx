"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as RKeyboardEvent } from "react";
import { BRANCHES, TREE, fmt, hasNode, nodeOpen, treeFx, treeNode, type State, type TreeNode } from "@/lib/nodefarm/engine";

/** The prestige tree menu: a full-screen web of nodes you pan and zoom. Layout comes from the engine (`TREE` x and y, in units). */
const U = 110; // px per tree unit at zoom 1
const R = 10; // world radius in units, a little past the outermost keystones
const KMIN = 0.2;
const KMAX = 2;
const SPAN = 2 * R * U;
const BCOL = Object.fromEntries(BRANCHES.map((b) => [b.id, b.color])) as Record<string, string>;
const BNAME = Object.fromEntries(BRANCHES.map((b) => [b.id, b.name])) as Record<string, string>;
const KIND = { minor: "MINOR", notable: "NOTABLE", keystone: "KEYSTONE" } as const;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function stateOf(s: State, n: TreeNode): "owned" | "ready" | "open" | "locked" {
    if (hasNode(s, n.id)) return "owned";
    if (!nodeOpen(s, n)) return "locked";
    return s.ap >= n.cost ? "ready" : "open";
}

/** What the owned nodes add up to, as plain rows for the readout. */
function totals(s: State): [string, string][] {
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

export function TreeMenu({ s, reduced, onBuy, onRespec, onClose }: { s: State; reduced: boolean; onBuy: (id: string) => void; onRespec: () => number; onClose: () => void }) {
    const root = useRef<HTMLDivElement>(null);
    const view = useRef<HTMLDivElement>(null);
    const world = useRef<HTMLDivElement>(null);
    const v = useRef({ x: 0, y: 0, k: 1 });
    const ptrs = useRef(new Map<number, { x: number; y: number }>());
    const gest = useRef({ total: 0, suppress: false, pinch: 0, mx: 0, my: 0 });
    const animT = useRef<number | undefined>(undefined);
    const [sel, setSel] = useState<string>(() => TREE.find((n) => stateOf(s, n) === "ready")?.id ?? "");
    const [hov, setHov] = useState<string | null>(null);
    const [flash, setFlash] = useState<string | null>(null);
    const [confirm, setConfirm] = useState(false);
    const [msg, setMsg] = useState("");

    const apply = useCallback((animate = false) => {
        const w = world.current, r = root.current;
        if (!w || !r) return;
        const { x, y, k } = v.current;
        if (animate && !reduced) {
            w.dataset.anim = "";
            window.clearTimeout(animT.current);
            animT.current = window.setTimeout(() => delete w.dataset.anim, 420);
        }
        w.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
        r.style.setProperty("--px", `${x * 0.25}px`);
        r.style.setProperty("--py", `${y * 0.25}px`);
        const lod = k < 0.55 ? "far" : "near";
        if (r.dataset.lod !== lod) r.dataset.lod = lod;
    }, [reduced]);

    const size = () => {
        const b = view.current?.getBoundingClientRect();
        return { w: b?.width ?? 800, h: b?.height ?? 600 };
    };
    const set = useCallback((x: number, y: number, k: number, animate = false) => {
        const { w, h } = size();
        k = clamp(k, KMIN, KMAX);
        const lim = (R * U * k) * 0.9;
        v.current = { x: clamp(x, w / 2 - lim, w / 2 + lim), y: clamp(y, h / 2 - lim, h / 2 + lim), k };
        apply(animate);
    }, [apply]);
    const zoomAt = useCallback((cx: number, cy: number, f: number, animate = false) => {
        const { x, y, k } = v.current;
        const nk = clamp(k * f, KMIN, KMAX);
        const r = nk / k;
        set(cx - (cx - x) * r, cy - (cy - y) * r, nk, animate);
    }, [set]);
    const fit = useCallback((animate = true) => {
        const { w, h } = size();
        set(w / 2, h / 2, (Math.min(w, h) / SPAN) * 0.98, animate);
    }, [set]);
    const home = useCallback((animate = false) => {
        const { w, h } = size();
        set(w / 2, h / 2, clamp(Math.min(w, h) / (2 * 4.8 * U), 0.55, 1), animate);
    }, [set]);
    const centerOn = useCallback((n: TreeNode | null, animate = true) => {
        const { w, h } = size();
        const k = Math.max(v.current.k, 0.8);
        // leave room for the side panel on a wide screen
        const off = w >= 900 ? -170 : 0;
        set(w / 2 + off - (n ? n.x * U : 0) * k, h / 2 - (n ? n.y * U : 0) * k - (w < 900 ? 60 : 0), k, animate);
    }, [set]);

    // first view: on the player's frontier if they own nodes, otherwise the core
    useEffect(() => {
        const last = [...s.tree].reverse().map((id) => TREE.find((n) => n.id === id)).find(Boolean) ?? null;
        // wait a frame: the body class that clears page transforms (below) has to be on before the view can be measured
        const raf = requestAnimationFrame(() => {
            home();
            if (last) centerOn(last, false);
        });
        const onResize = () => apply();
        window.addEventListener("resize", onResize);
        return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); window.clearTimeout(animT.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // modal behaviour: body class (lifts the board above the page), Escape, focus in and back out
    useEffect(() => {
        const prev = document.activeElement as HTMLElement | null;
        document.body.classList.add("nf-win-open", "nf-tm-open");
        root.current?.querySelector<HTMLElement>(".nf-tm-x")?.focus();
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
        window.addEventListener("keydown", onKey, true);
        return () => {
            window.removeEventListener("keydown", onKey, true);
            document.body.classList.remove("nf-win-open", "nf-tm-open");
            prev?.focus?.();
        };
    }, [onClose]);

    // wheel zoom has to be a non-passive listener to stop the page from scrolling
    useEffect(() => {
        const el = view.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const b = el.getBoundingClientRect();
            const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
            zoomAt(e.clientX - b.left, e.clientY - b.top, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0016)));
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [zoomAt]);

    // ---- pointers: one finger or the mouse pans, two fingers pinch
    const pos = (e: React.PointerEvent) => {
        const b = view.current!.getBoundingClientRect();
        return { x: e.clientX - b.left, y: e.clientY - b.top };
    };
    const down = (e: React.PointerEvent) => {
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
    const move = (e: React.PointerEvent) => {
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
            set(v.current.x + (mx - g.mx), v.current.y + (my - g.my), v.current.k);
            g.pinch = dist;
            g.mx = mx;
            g.my = my;
            return;
        }
        const dx = now.x - old.x, dy = now.y - old.y;
        g.total += Math.abs(dx) + Math.abs(dy);
        if (g.total > 6) {
            if (!g.suppress) { g.suppress = true; try { view.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ } }
            set(v.current.x + dx, v.current.y + dy, v.current.k);
        }
    };
    const up = (e: React.PointerEvent) => {
        ptrs.current.delete(e.pointerId);
        if (ptrs.current.size < 2) gest.current.pinch = 0;
        if (ptrs.current.size === 0) window.setTimeout(() => { gest.current.suppress = false; }, 0);
    };

    const keys = (e: RKeyboardEvent) => {
        if (e.key === "Tab") {
            const f = [...root.current!.querySelectorAll<HTMLElement>("button:not([disabled]), [tabindex='0']")];
            const first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            return;
        }
        const { w, h } = size();
        const st = 90;
        if (e.key === "ArrowLeft") set(v.current.x + st, v.current.y, v.current.k);
        else if (e.key === "ArrowRight") set(v.current.x - st, v.current.y, v.current.k);
        else if (e.key === "ArrowUp") set(v.current.x, v.current.y + st, v.current.k);
        else if (e.key === "ArrowDown") set(v.current.x, v.current.y - st, v.current.k);
        else if (e.key === "+" || e.key === "=") zoomAt(w / 2, h / 2, 1.25, true);
        else if (e.key === "-" || e.key === "_") zoomAt(w / 2, h / 2, 0.8, true);
        else if (e.key === "0") fit();
        else if (e.key === "Home") centerOn(null);
        else return;
        if ((e.target as HTMLElement).tagName !== "BUTTON" || e.key.startsWith("Arrow")) e.preventDefault();
    };

    const ensureVisible = (n: TreeNode) => {
        const { w, h } = size();
        const { x, y, k } = v.current;
        const sx = x + n.x * U * k, sy = y + n.y * U * k;
        if (sx < 60 || sx > w - 60 || sy < 60 || sy > h - 160) centerOn(n);
    };

    const owned = s.tree.length;
    const nodes = useMemo(() => TREE, []);
    const links = useMemo(() => {
        const out: { a: string; b: string; ax: number; ay: number; bx: number; by: number; col: string }[] = [];
        for (const n of TREE) for (const l of n.links) {
            if (l === "core") out.push({ a: "core", b: n.id, ax: 0, ay: 0, bx: n.x * U, by: n.y * U, col: BCOL[n.branch] });
            else if (n.id < l) { const m = treeNode(l); out.push({ a: n.id, b: l, ax: n.x * U, ay: n.y * U, bx: m.x * U, by: m.y * U, col: BCOL[n.branch] }); }
        }
        return out;
    }, []);
    const have = (id: string) => id === "core" || s.tree.includes(id);

    const shown = hov ?? sel;
    const node = shown && shown !== "core" ? treeNode(shown) : null;
    const nst = node ? stateOf(s, node) : null;
    const rows = totals(s);
    const spent = s.tree.reduce((a, id) => a + (TREE.find((n) => n.id === id)?.cost ?? 0), 0);

    const buy = (id: string) => {
        onBuy(id);
        setFlash(id);
        window.setTimeout(() => setFlash((f) => (f === id ? null : f)), 700);
    };
    const respec = () => {
        if (!s.tree.length) return;
        if (!confirm) { setConfirm(true); window.setTimeout(() => setConfirm(false), 4000); return; }
        const back = onRespec();
        setConfirm(false);
        setMsg(`Tree cleared. ${fmt(back)} AP refunded.`);
        window.setTimeout(() => setMsg(""), 4000);
    };

    return (
        <div className="nf-tm" ref={root} role="dialog" aria-modal="true" aria-label="Prestige tree" data-lod="near" onKeyDown={keys}>
            <div className="nf-tm-bg" aria-hidden="true" />
            <header className="nf-tm-bar">
                <span className="nf-tm-t">naOS // node.farm // prestige tree</span>
                <span className="nf-tm-ap" aria-live="polite"><b>{fmt(s.ap)}</b> AP<small>{owned}/{TREE.length} nodes</small></span>
                <button type="button" className="nf-tm-b" data-danger={confirm ? "" : undefined} disabled={!owned} onClick={respec} title="Take every node back and refund its AP. Free.">
                    {confirm ? `Confirm: refund ${fmt(spent)} AP` : "Respec"}
                </button>
                <button type="button" className="nf-tm-x" onClick={onClose} aria-label="Close the tree"><i /></button>
            </header>
            <div
                className="nf-tm-view"
                ref={view}
                tabIndex={0}
                role="group"
                aria-label="Prestige tree map. Drag to pan, scroll or pinch to zoom, arrow keys pan, plus and minus zoom, 0 fits the whole tree."
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={up}
                onClickCapture={(e) => { if (gest.current.suppress) { e.stopPropagation(); e.preventDefault(); } }}
            >
                <div className="nf-tm-world" ref={world}>
                    {BRANCHES.map((b, i) => (
                        <div key={b.id} className="nf-tm-wedge" data-arm={b.id} style={{ ["--c" as string]: b.color, ["--from" as string]: `${i * 72 - 36}deg`, width: SPAN, height: SPAN } as CSSProperties} aria-hidden="true" />
                    ))}
                    {[2.2, 4.4, 6.0].map((r) => <i key={r} className="nf-tm-ring" aria-hidden="true" style={{ width: r * 2 * U, height: r * 2 * U }} />)}
                    <svg className="nf-tm-links" width={SPAN} height={SPAN} viewBox={`${-SPAN / 2} ${-SPAN / 2} ${SPAN} ${SPAN}`} aria-hidden="true">
                        {links.map((l) => {
                            const a = have(l.a), b = have(l.b);
                            const st = a && b ? "on" : a || b ? "edge" : "off";
                            return <line key={l.a + l.b} x1={l.ax} y1={l.ay} x2={l.bx} y2={l.by} data-st={st} style={{ ["--c" as string]: l.col }} />;
                        })}
                    </svg>
                    {BRANCHES.map((b, i) => {
                        const th = -Math.PI / 2 + (i * 2 * Math.PI) / BRANCHES.length;
                        const mine = TREE.filter((n) => n.branch === b.id);
                        return (
                            <div key={b.id} className="nf-tm-sec" style={{ left: Math.cos(th) * 9.15 * U, top: Math.sin(th) * 9.15 * U, ["--c" as string]: b.color } as CSSProperties}>
                                <b>{b.name}</b>
                                <small>{mine.filter((n) => hasNode(s, n.id)).length}/{mine.length} // {b.blurb}</small>
                            </div>
                        );
                    })}
                    <button type="button" className="nf-tn nf-tn-core" data-kind="core" data-st="owned" data-sel={sel === "core" ? "" : undefined} aria-label="Core. Every section starts here." style={{ ["--col" as string]: 4, ["--row" as string]: 7 } as CSSProperties} onClick={() => setSel("core")} onPointerEnter={(e) => { if (e.pointerType === "mouse") setHov("core"); }} onPointerLeave={() => setHov(null)}>
                        <i className="nf-tn-ic" /><span className="nf-tn-l">core</span>
                    </button>
                    {nodes.map((n) => {
                        const st = stateOf(s, n);
                        return (
                            <button
                                key={n.id}
                                type="button"
                                className="nf-tn"
                                data-kind={n.kind}
                                data-st={st}
                                data-sel={sel === n.id ? "" : undefined}
                                data-flash={flash === n.id ? "" : undefined}
                                aria-label={`${n.name}, ${BNAME[n.branch]}, ${KIND[n.kind].toLowerCase()}, ${st === "owned" ? "owned" : st === "locked" ? "locked" : `${n.cost} AP`}. ${n.blurb}`}
                                aria-pressed={sel === n.id}
                                style={{ left: n.x * U, top: n.y * U, ["--c" as string]: BCOL[n.branch], ["--col" as string]: n.ix % 8, ["--row" as string]: Math.floor(n.ix / 8) } as CSSProperties}
                                onClick={() => setSel(n.id)}
                                onPointerEnter={(e) => { if (e.pointerType === "mouse") setHov(n.id); }}
                                onPointerLeave={() => setHov(null)}
                                onFocus={() => ensureVisible(n)}
                            >
                                <i className="nf-tn-ic" />
                                <span className="nf-tn-l">{n.name}{st === "owned" ? "" : ` · ${n.cost}`}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
            <span className="nf-tm-zoom" role="group" aria-label="Zoom">
                <button type="button" className="nf-tm-b sq" aria-label="Zoom out" onClick={() => { const { w, h } = size(); zoomAt(w / 2, h / 2, 0.75, true); }}>-</button>
                <button type="button" className="nf-tm-b" onClick={() => fit()}>Fit</button>
                <button type="button" className="nf-tm-b sq" aria-label="Zoom in" onClick={() => { const { w, h } = size(); zoomAt(w / 2, h / 2, 1.33, true); }}>+</button>
            </span>
            <aside className="nf-tm-card" data-st={nst ?? "core"} style={{ ["--c" as string]: node ? BCOL[node.branch] : "#ffffff" } as CSSProperties} aria-live="polite">
                {node ? (
                    <>
                        <span className="nf-tm-k">{BNAME[node.branch]} // {KIND[node.kind]} // {nst === "owned" ? "OWNED" : nst === "locked" ? "LOCKED" : "AVAILABLE"}</span>
                        <b className="nf-tm-n">{node.name}</b>
                        <p>{node.blurb}</p>
                        {nst === "locked" && (
                            <p className="nf-tm-need">Buy a node next to it first: {node.links.filter((l) => l !== "core").map((l) => treeNode(l).name).join(", ")}.</p>
                        )}
                        <div className="nf-tm-a">
                            <small>{node.cost} AP · you have {fmt(s.ap)}</small>
                            <button type="button" className="nf-mini" disabled={nst !== "ready"} onClick={() => buy(node.id)}>
                                {nst === "owned" ? "Owned" : nst === "locked" ? "Locked" : s.ap < node.cost ? `Need ${node.cost - s.ap} more` : `Buy · ${node.cost} AP`}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <span className="nf-tm-k">{shown === "core" ? "CORE // FREE" : "PRESTIGE TREE"}</span>
                        <b className="nf-tm-n">{shown === "core" ? "The core" : "Pick a node"}</b>
                        <p>{shown === "core" ? "Every section starts from here. A node opens once it touches the core or a node you own." : "Tap or hover a node to read it. Drag to pan, pinch or scroll to zoom. Nodes next to what you own glow when you can afford them. Respec is free and refunds every AP."}</p>
                    </>
                )}
                {msg && <p className="nf-tm-msg" role="status">{msg}</p>}
            </aside>
            {rows.length > 0 && (
                <dl className="nf-tm-tot" aria-label="What the tree gives you">
                    <dt className="nf-tm-th">Tree gives</dt><dd className="nf-tm-th" />
                    {rows.map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{val}</dd></div>)}
                </dl>
            )}
        </div>
    );
}
