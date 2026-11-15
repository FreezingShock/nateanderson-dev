"use client";

// The Constellations and Pulsar map. Each star is a drawn medallion (public/starwright/ui/node-<id>-<state>.png) labelled like a
// catalogue star: its name, a Bayer-style designation and the buff in its constellation's colour. Clicking a star zooms the
// map onto it and opens a card beside it with the buff written large; clicking a ready star again, Enter, or the card's button
// lights it. Clicking empty sky zooms back out, and a second click closes the map.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { CONSTELLATIONS, type Perk } from "@/lib/starwright/data";
import { H, W, renderBackdrop } from "@/lib/starwright/art";
import { fmt, perkReady } from "@/lib/starwright/engine";
import { Gl, Ic, ui } from "./sw-ui";

const GREEK = ["α", "β", "γ", "δ", "ε", "ζ", "η", "θ"];
const LATIN: Record<string, string> = { lantern: "Lanternae", kiln: "Fornacis", anvil: "Incudis", loom: "Telae", pulsar: "Pulsaris" };
const PULSAR_COLOR = "#9fd0ff";
const ZOOM = 2.1;

type Buff = { big: string; what: string };
/** The buff of a star, as a large number and a short label. */
function buffs(p: Perk): Buff[] {
    const out: Buff[] = [];
    const fx = p.fx as Record<string, number>;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    for (const [k, v] of Object.entries(fx)) {
        if (k === "inflow") out.push({ big: `×${v}`, what: "hydrogen inflow" });
        else if (k === "fuse") out.push({ big: `×${v}`, what: "every fusion" });
        else if (k === "heat") out.push({ big: `×${v}`, what: "core heat" });
        else if (k === "gate") out.push({ big: `−${pct(v)}`, what: "heat to fuse" });
        else if (k === "planet") out.push({ big: `+${pct(v)}`, what: "planet power" });
        else if (k === "stardust") out.push({ big: `×${v}`, what: "stardust" });
        else if (k === "need") out.push({ big: `−${pct(v)}`, what: "iron to collapse" });
        else if (k === "startH") out.push({ big: `+${v >= 1000 ? `${Math.round(v / 1000)}K` : v}`, what: "start hydrogen" });
        else if (k === "auto") out.push({ big: v >= 5 ? "all" : `+${v}`, what: "autoburn rows" });
        else if (k === "keepPlanets") out.push({ big: "keep", what: "planets in a supernova" });
        else if (k === "offline") out.push({ big: `+${v}h`, what: "away time" });
        else if (k === "global") out.push({ big: `×${v}`, what: "everything" });
        else if (k === "heavy") out.push({ big: `×${v}`, what: "gold and uranium" });
        else if (k === "keepStardust") out.push({ big: pct(v), what: "stardust kept" });
        else if (k === "horizon") out.push({ big: `÷${Math.round(1 / v)}`, what: "uranium for a hole" });
    }
    if (out.length === 0) out.push({ big: "free", what: "first star of each constellation" });
    return out;
}

type St = "own" | "buy" | "near" | "lock";

export function StarChart({ title, list, owned, cur, curName, onBuy, onClose, constellations, leaving }: { title: string; list: Perk[]; owned: string[]; cur: number; curName: string; onBuy: (id: string) => void; onClose: () => void; constellations?: boolean; leaving?: boolean }) {
    const [sel, setSel] = useState<string | null>(null);
    const [lit, setLit] = useState<string | null>(null);
    const [card, setCard] = useState<{ x: number; y: number; side: "r" | "l" } | null>(null);
    const bg = useRef<HTMLCanvasElement | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    useEffect(() => {
        const ctx = bg.current?.getContext("2d");
        if (!ctx) return;
        const img = ctx.createImageData(W, H);
        renderBackdrop(img, 0);
        ctx.putImageData(img, 0, 0);
    }, []);
    const color = (p: Perk) => CONSTELLATIONS.find((c) => c.id === p.con)?.color ?? PULSAR_COLOR;
    const P = (p: Perk): [number, number] => [p.at[0] * 10, p.at[1] * 5.6 + 20];
    const stateOf = (p: Perk): St => (owned.includes(p.id) ? "own" : perkReady(list, owned, p) ? (cur >= p.cost ? "buy" : "near") : "lock");
    const desig = (p: Perk) => `${GREEK[list.filter((x) => x.con === p.con).indexOf(p)] ?? ""} ${LATIN[p.con] ?? ""}`;
    const picked = list.find((p) => p.id === sel) ?? null;

    const buy = useCallback((p: Perk) => {
        if (stateOf(p) !== "buy") return;
        onBuy(p.id);
        setLit(p.id);
        window.setTimeout(() => setLit((v) => (v === p.id ? null : v)), 900);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [owned, cur, onBuy]);

    // Place the card beside the zoomed star once the zoom has settled, and again on resize.
    useLayoutEffect(() => {
        setCard(null);
        if (!sel) return;
        const place = () => {
            const node = svgRef.current?.querySelector(`[data-id="${sel}"] .sw-nodeart`);
            if (!node) return;
            const r = node.getBoundingClientRect();
            const vw = window.innerWidth;
            const side = r.right + 340 < vw ? "r" : "l";
            setCard({ x: side === "r" ? r.right + 12 : r.left - 12, y: r.top + r.height / 2, side });
        };
        const t = window.setTimeout(place, 540);
        window.addEventListener("resize", place);
        return () => { window.clearTimeout(t); window.removeEventListener("resize", place); };
    }, [sel]);

    useEffect(() => {
        const key = (e: KeyboardEvent) => {
            if (!picked) return;
            if (e.key === "Enter" || e.key === "b" || e.key === "B") { e.preventDefault(); buy(picked); }
        };
        window.addEventListener("keydown", key);
        return () => window.removeEventListener("keydown", key);
    }, [picked, buy]);

    const clickStar = (p: Perk) => {
        if (sel === p.id && stateOf(p) === "buy") buy(p);
        else setSel(p.id);
    };
    const clickSky = () => { if (sel) setSel(null); else onClose(); };

    const [zx, zy] = picked ? P(picked) : [500, 300];
    const narrow = typeof window !== "undefined" && window.innerWidth <= 900;
    const k = narrow ? 2.6 : ZOOM;
    const zoom = picked ? `translate(${500 - zx * k}px, ${(narrow ? 200 : 300) - zy * k}px) scale(${k})` : "none";
    const ready = list.filter((p) => stateOf(p) === "buy").length;
    const pst = picked ? stateOf(picked) : null;

    return (
        <div className="sw-chart" role="dialog" aria-modal="true" aria-label={title} data-kind="iris" data-leaving={leaving ? "" : undefined} data-zoomed={picked ? "" : undefined}>
            <canvas ref={bg} width={W} height={H} className="sw-chart-bg" aria-hidden="true" />
            <div className="sw-chart-top">
                <h2><Gl n={constellations ? "star" : "pulse"} s={1} /> {title}</h2>
                <span><Ic n={constellations ? "stat-dust" : "stat-neutron"} s={1} /> {curName} <b>{fmt(cur)}</b></span>
                {ready > 0 && <span className="sw-ready">{ready} ready to light</span>}
                <button type="button" className="sw-x" onClick={onClose} aria-label="Close" data-tip="Close|Esc or click empty sky twice"><Gl n="cross" s={1} /></button>
            </div>
            <div className="sw-chart-scroll" onClick={(e) => { if (e.target === e.currentTarget) clickSky(); }}>
                <svg ref={svgRef} viewBox="0 0 1000 600" className="sw-svg" role="group" aria-label={title} onClick={(e) => { if ((e.target as Element).tagName === "svg") clickSky(); }}>
                    <g className="sw-zoom" style={{ transform: zoom }}>
                        {list.map((p) => p.req.map((r) => {
                            const a = list.find((x) => x.id === r);
                            if (!a) return null;
                            const [x1, y1] = P(a), [x2, y2] = P(p);
                            const on = owned.includes(a.id) && owned.includes(p.id);
                            const next = owned.includes(a.id) && !owned.includes(p.id);
                            return (
                                <g key={`${r}-${p.id}`} className="sw-edge" data-lit={on ? "" : undefined} data-next={next ? "" : undefined} style={{ stroke: color(p) }}>
                                    {on && <line x1={x1} y1={y1} x2={x2} y2={y2} className="sw-edge-glow" />}
                                    <line x1={x1} y1={y1} x2={x2} y2={y2} />
                                </g>
                            );
                        }))}
                        {constellations && CONSTELLATIONS.map((c) => {
                            const ps = list.filter((p) => p.con === c.id);
                            const x = ps.reduce((a, p) => a + P(p)[0], 0) / ps.length, y = Math.min(...ps.map((p) => P(p)[1])) - 40;
                            const n = ps.filter((p) => owned.includes(p.id)).length;
                            return (
                                <g key={c.id} className="sw-con" style={{ fill: c.color }}>
                                    <text x={x} y={y} className="sw-conname" textAnchor="middle">{c.name.toUpperCase()}</text>
                                    <text x={x} y={y + 15} className="sw-conlat" textAnchor="middle">{LATIN[c.id]} · {n}/{ps.length}</text>
                                </g>
                            );
                        })}
                        {list.map((p) => {
                            const [x, y] = P(p);
                            const st = stateOf(p);
                            const b = buffs(p)[0];
                            const art = st === "own" ? "own" : st === "lock" ? "lock" : "open";
                            return (
                                <g key={p.id} data-id={p.id} className="sw-node" data-st={st} data-sel={sel === p.id ? "" : undefined} data-lit={lit === p.id ? "" : undefined} transform={`translate(${x} ${y})`} style={{ "--c": color(p) } as CSSProperties} role="button" tabIndex={0} data-tip={`${p.name}|${b.big} ${b.what}|${st === "own" ? "lit" : `${fmt(p.cost)} ${curName}`}`} aria-label={`${p.name}, ${b.big} ${b.what}, ${st === "own" ? "lit" : `costs ${p.cost}`}`} onClick={(e) => { e.stopPropagation(); clickStar(p); }} onKeyDown={(e) => { if (e.key === " ") { e.preventDefault(); clickStar(p); } }}>
                                    <circle r="34" className="sw-hit" />
                                    {st === "buy" && <image className="sw-ring" href={ui(`ring-${p.con}`)} x={-28} y={-28} width={56} height={56} />}
                                    <image className="sw-nodeart" href={ui(`node-${p.id}-${art}`)} x={-20} y={-20} width={40} height={40} />
                                    {lit === p.id && <circle r="20" className="sw-burst" />}
                                    <text y="34" className="sw-nodename" textAnchor="middle">{p.name}</text>
                                    <text y="47" className="sw-nodebuff" textAnchor="middle">{b.big} {b.what}</text>
                                    <text y="60" className="sw-nodedes" textAnchor="middle">{desig(p)}</text>
                                </g>
                            );
                        })}
                    </g>
                </svg>
            </div>
            {picked && card && (
                <div className="sw-starcard" data-side={card.side} data-st={pst} style={{ "--c": color(picked), left: card.x, top: card.y } as CSSProperties} key={picked.id} role="region" aria-label={picked.name}>
                    <div className="sw-sc-head">
                        <span className="sw-sc-art" style={{ backgroundImage: `url("${ui(`node-${picked.id}-${pst === "own" ? "own" : pst === "lock" ? "lock" : "open"}`)}")` }} />
                        <div>
                            <b>{picked.name}</b>
                            <span>{desig(picked)} · {CONSTELLATIONS.find((c) => c.id === picked.con)?.name ?? "Pulsar"}</span>
                        </div>
                    </div>
                    <div className="sw-sc-buffs">
                        {buffs(picked).map((b) => (
                            <p key={b.what}><strong>{b.big}</strong><span>{b.what}</span></p>
                        ))}
                    </div>
                    <p className="sw-sc-desc">{picked.desc}</p>
                    {pst === "own" ? (
                        <p className="sw-sc-own">Lit. It shines until {constellations ? "a neutron star" : "a black hole"}.</p>
                    ) : (
                        <>
                            {picked.req.length > 0 && pst === "lock" && <p className="sw-sc-need">Light {picked.req.map((r) => list.find((x) => x.id === r)?.name).join(" and ")} first.</p>}
                            <button type="button" className="sw-sc-buy" disabled={pst !== "buy"} onClick={() => buy(picked)}>
                                <span>{pst === "buy" ? "Light it" : pst === "near" ? `Need ${fmt(picked.cost - cur)} more` : "Locked"}</span>
                                <em><Ic n={constellations ? "stat-dust" : "stat-neutron"} s={1} /> {fmt(picked.cost)}</em>
                            </button>
                            {pst === "buy" && <p className="sw-sc-hint">Click the star again or press Enter</p>}
                        </>
                    )}
                    <i className="sw-cn" data-c="tl" /><i className="sw-cn" data-c="tr" /><i className="sw-cn" data-c="bl" /><i className="sw-cn" data-c="br" />
                </div>
            )}
            <p className="sw-chart-foot">{constellations ? "Stardust lights stars. They stay through every supernova and reset on a neutron star." : "Neutrons light the pulsar map. It stays until a black hole."} Click a star to look closer.</p>
        </div>
    );
}
