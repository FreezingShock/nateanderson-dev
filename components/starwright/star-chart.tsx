"use client";

// The Constellations and Pulsar map. Each star is a drawn medallion (public/starwright/ui/node-<id>-<state>.png) labelled like a
// catalogue star: its name, a Bayer-style designation and the buff in its constellation's colour. Clicking a star zooms the
// map onto it and opens a card beside it with the buff written large; clicking a ready star again, Enter, or the card's button
// lights it. Clicking empty sky zooms back out, and a second click closes the map.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { CONSTELLATIONS, TUNE, type Perk } from "@/lib/starwright/data";
import { H, W, renderBackdrop } from "@/lib/starwright/art";
import { fmt, perkReady } from "@/lib/starwright/engine";
import { play } from "@/lib/starwright/sound";
import { Gl, Ic, dockOrigin, ui } from "./sw-ui";

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

/** True on phones and small tablets, where the map shows one constellation at a time instead of squeezing all four in. */
function useNarrow(): boolean {
    const [n, setN] = useState(() => typeof window !== "undefined" && window.innerWidth <= 900);
    useEffect(() => {
        const on = () => setN(window.innerWidth <= 900);
        window.addEventListener("resize", on);
        return () => window.removeEventListener("resize", on);
    }, []);
    return n;
}

export function StarChart({ title, list, owned, cur, curName, onBuy, onClose, constellations, leaving, deep }: { title: string; list: Perk[]; owned: string[]; cur: number; curName: string; onBuy: (id: string) => void; onClose: () => void; constellations?: boolean; leaving?: boolean; deep?: { n: number; cost: number; onBuy: () => void } }) {
    const [sel, setSel] = useState<string | null>(null);
    const [lit, setLit] = useState<string | null>(null);
    const [card, setCard] = useState<{ x: number; y: number; side: "r" | "l" } | null>(null);
    const narrow = useNarrow();
    const scrollEl = useRef<HTMLDivElement | null>(null);
    const [box, setBox] = useState<{ w: number; h: number } | null>(null);
    useEffect(() => {
        const el = scrollEl.current;
        if (!el) return;
        const read = () => setBox({ w: el.clientWidth, h: el.clientHeight });
        read();
        const ro = new ResizeObserver(read);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    const [reg, setReg] = useState(0);
    // Constellation map: one constellation at a time on every screen (phones and desktop alike); the pulsar map stays whole.
    const regions = constellations ? CONSTELLATIONS.map((c) => c.id as string) : [];
    const region = regions.length ? Math.min(reg, regions.length - 1) : -1;
    const bg = useRef<HTMLCanvasElement | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const rootEl = useRef<HTMLDivElement | null>(null);
    // the sky opens as an iris growing out of the dock tile that was pressed
    useLayoutEffect(() => {
        const o = dockOrigin();
        if (o && rootEl.current) { rootEl.current.style.setProperty("--ox", `${o.x}px`); rootEl.current.style.setProperty("--oy", `${o.y}px`); }
    }, []);
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
    // The part of the sky on screen: one constellation at a time on the constellation map, the whole pulsar map on a wide screen.
    const vb = (() => {
        if (region < 0 && !narrow) return { x: 0, y: 0, w: 1000, h: 600 };
        const part = region >= 0 ? list.filter((p) => p.con === regions[region]) : list;
        const xs = part.map((p) => P(p)[0]), ys = part.map((p) => P(p)[1]);
        const x0 = Math.min(...xs) - 95, x1 = Math.max(...xs) + 95;
        const y0 = Math.min(...ys) - 75, y1 = Math.max(...ys) + 85;
        let w = Math.max(260, x1 - x0), h = Math.max(200, y1 - y0);
        let x = x0, y = y0;
        // the box is the size of the screen area: widen or heighten the crop to match it, so no blank bands appear
        if (box && box.w > 0 && box.h > 0) {
            const a = box.w / box.h;
            if (w / h < a) { const nw = h * a; x -= (nw - w) / 2; w = nw; } else { const nh = w / a; y -= (nh - h) / 2; h = nh; }
        }
        return { x, y, w, h };
    })();
    const vcx = vb.x + vb.w / 2;
    const vcy = narrow ? vb.y + vb.h * 0.4 : 300;
    const flip = useCallback((d: number) => {
        if (regions.length < 2) return;
        const nx = Math.max(0, Math.min(regions.length - 1, region + d));
        if (nx === region) return;
        setReg(nx); setSel(null); play("page", { dir: d });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [regions.length, region]);

    const buy = useCallback((p: Perk) => {
        if (stateOf(p) !== "buy") return;
        onBuy(p.id);
        play("perk", { con: p.con });
        setLit(p.id);
        window.setTimeout(() => setLit((v) => (v === p.id ? null : v)), 900);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [owned, cur, onBuy]);

    // Place the card beside the zoomed star once the zoom has settled, and again on resize.
    useLayoutEffect(() => {
        setCard(null);
        if (!sel) return;
        const place = () => {
            const svg = svgRef.current;
            const node = svg?.querySelector(`[data-id="${sel}"]`) as SVGGElement | null;
            const m = svg?.getScreenCTM();
            if (!svg || !node || !m) return;
            // The zoom puts the star at (500, cy) in map units; its labels extend by the box of its group, scaled by the zoom.
            const k = narrow ? 2.6 : ZOOM;
            const bb = node.getBBox();
            const toScreen = (x: number, y: number) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
            const right = toScreen(vcx + (bb.x + bb.width) * k, vcy);
            const left = toScreen(vcx + bb.x * k, vcy);
            const vw = window.innerWidth;
            const side = right.x + 330 < vw ? "r" : "l";
            setCard({ x: side === "r" ? right.x + 12 : left.x - 12, y: right.y, side });
        };
        const t = window.setTimeout(place, 640);
        window.addEventListener("resize", place);
        return () => { window.clearTimeout(t); window.removeEventListener("resize", place); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sel, narrow, region]);

    useEffect(() => {
        const key = (e: KeyboardEvent) => {
            if (regions.length > 1 && !picked) {
                if (e.key === "ArrowRight") { e.preventDefault(); flip(1); }
                else if (e.key === "ArrowLeft") { e.preventDefault(); flip(-1); }
            }
            if (!picked) return;
            if (e.key === "Enter" || e.key === "b" || e.key === "B") { e.preventDefault(); buy(picked); }
        };
        window.addEventListener("keydown", key);
        return () => window.removeEventListener("keydown", key);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [picked, buy, flip, regions.length]);

    const clickStar = (p: Perk) => {
        if (sel === p.id && stateOf(p) === "buy") buy(p);
        else { if (sel !== p.id) play("click"); setSel(p.id); }
    };
    const clickSky = () => { if (sel) setSel(null); else onClose(); };

    const [zx, zy] = picked ? P(picked) : [500, 300];
    const k = narrow ? 2.6 : ZOOM;
    const zoom = picked ? `translate(${vcx - zx * k}px, ${vcy - zy * k}px) scale(${k})` : "none";
    const ready = list.filter((p) => stateOf(p) === "buy").length;
    const pst = picked ? stateOf(picked) : null;

    return (
        <div ref={rootEl} className="sw-chart" data-map={constellations ? "stars" : "pulsar"} role="dialog" aria-modal="true" aria-label={title} data-kind="iris" data-region={region >= 0 ? "" : undefined} data-leaving={leaving ? "" : undefined} data-zoomed={picked ? "" : undefined}>
            <canvas ref={bg} width={W} height={H} className="sw-chart-bg" aria-hidden="true" />
            <div className="sw-chart-top">
                <h2><Gl n={constellations ? "star" : "pulse"} s={1} /> {title}</h2>
                <span><Ic n={constellations ? "stat-dust" : "stat-neutron"} s={1} /> {curName} <b>{fmt(cur)}</b></span>
                {ready > 0 && <span className="sw-ready">{ready} ready to light</span>}
                <button type="button" className="sw-x" onClick={onClose} aria-label="Close" data-tip="Close|Esc or click empty sky twice"><Gl n="cross" s={1} /></button>
            </div>
            <div ref={scrollEl} className="sw-chart-scroll" onClick={(e) => { if (e.target === e.currentTarget) clickSky(); }}>
                <svg ref={svgRef} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="sw-svg" role="group" aria-label={title} onClick={(e) => { if ((e.target as Element).tagName === "svg") clickSky(); }}>
                    <g className="sw-zoom" style={{ transform: zoom }}>
                        {!constellations && (
                            <g className="sw-psr" transform="translate(620 380)">
                                <g className="sw-beam"><path d="M0 0 L-60 -700 L60 -700 Z" /><path d="M0 0 L-60 700 L60 700 Z" /></g>
                                <circle r="70" className="sw-psr-ring" />
                                <circle r="120" className="sw-psr-ring" data-far="" />
                                <image href={ui("pulsar-core")} x={-36} y={-36} width={72} height={72} className="sw-nodeart" />
                                <text y="56" className="sw-conname" textAnchor="middle">PSR SOL</text>
                                <text y="72" className="sw-conlat" textAnchor="middle">Pulsaris · {owned.length}/{list.length}</text>
                            </g>
                        )}
                        {list.map((p) => p.req.map((r) => {
                            const a = list.find((x) => x.id === r);
                            if (!a) return null;
                            const [x1, y1] = P(a), [x2, y2] = P(p);
                            const on = owned.includes(a.id) && owned.includes(p.id);
                            const next = owned.includes(a.id) && !owned.includes(p.id);
                            return (
                                <g key={`${r}-${p.id}`} className="sw-edge" data-lit={on ? "" : undefined} data-next={next ? "" : undefined} data-off={region >= 0 && p.con !== regions[region] ? "" : undefined} style={{ stroke: color(p) }}>
                                    {on && <line x1={x1} y1={y1} x2={x2} y2={y2} className="sw-edge-glow" />}
                                    <line x1={x1} y1={y1} x2={x2} y2={y2} />
                                </g>
                            );
                        }))}
                        {list.map((p, ni) => {
                            const [x, y] = P(p);
                            const st = stateOf(p);
                            const b = buffs(p)[0];
                            const art = st === "own" ? "own" : st === "lock" ? "lock" : "open";
                            return (
                                <g key={p.id} data-id={p.id} className="sw-node" data-st={st} data-sel={sel === p.id ? "" : undefined} data-lit={lit === p.id ? "" : undefined} data-off={region >= 0 && p.con !== regions[region] ? "" : undefined} transform={`translate(${x} ${y})`} style={{ "--c": color(p), "--i": ni } as CSSProperties} role="button" tabIndex={0} data-tip={`${p.name}|${b.big} ${b.what}|${st === "own" ? "lit" : `${fmt(p.cost)} ${curName}`}`} aria-label={`${p.name}, ${b.big} ${b.what}, ${st === "own" ? "lit" : `costs ${p.cost}`}`} onClick={(e) => { e.stopPropagation(); clickStar(p); }} onKeyDown={(e) => { if (e.key === " ") { e.preventDefault(); clickStar(p); } }}>
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
                        {constellations && CONSTELLATIONS.map((c) => {
                            const ps = list.filter((p) => p.con === c.id);
                            const x = ps.reduce((a, p) => a + P(p)[0], 0) / ps.length, y = Math.min(...ps.map((p) => P(p)[1])) - 40;
                            const n = ps.filter((p) => owned.includes(p.id)).length;
                            return (
                                <g key={c.id} className="sw-con" data-off={region >= 0 && c.id !== regions[region] ? "" : undefined} data-lock={n === 0 ? "" : undefined} style={{ fill: c.color }}>
                                    <text x={x} y={y} className="sw-conname" textAnchor="middle">{c.name.toUpperCase()}</text>
                                    <text x={x} y={y + 15} className="sw-conlat" textAnchor="middle">{LATIN[c.id]} · {n}/{ps.length}</text>
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
            {deep && <Deep deep={deep} cur={cur} open={list.every((p) => owned.includes(p.id)) || deep.n > 0} left={list.filter((p) => !owned.includes(p.id)).length} />}
            {regions.length > 1 && (
                <div className="sw-pg-nav sw-chart-nav" role="group" aria-label="Constellations">
                    <button type="button" className="sw-pg-btn" disabled={region === 0} onClick={() => flip(-1)} aria-label="Previous constellation" data-tip="Previous|Left arrow"><Gl n="back" s={1} /></button>
                    <span className="sw-pg-dots" aria-live="polite" style={{ "--c": CONSTELLATIONS.find((c) => c.id === regions[region])?.color } as CSSProperties}>
                        {regions.map((r, i) => <i key={r} data-on={i === region ? "" : undefined} />)}
                        <b>{CONSTELLATIONS.find((c) => c.id === regions[region])?.name}</b>
                    </span>
                    <button type="button" className="sw-pg-btn" data-next disabled={region >= regions.length - 1} onClick={() => flip(1)} aria-label="Next constellation" data-tip="Next|Right arrow"><Gl n="back" s={1} /></button>
                </div>
            )}
            <p className="sw-chart-foot">{constellations ? "Stardust lights stars. They stay through every supernova and reset on a neutron star." : "Neutrons light the pulsar map. It stays until a black hole."} Click a star to look closer.</p>
        </div>
    );
}

/** Deep stars: the endless last row once every star is lit. One clear button, the count, and what the next one adds. */
function Deep({ deep, cur, open, left }: { deep: { n: number; cost: number; onBuy: () => void }; cur: number; open: boolean; left: number }) {
    const [pop, setPop] = useState(0);
    const can = open && cur >= deep.cost;
    const pct = Math.round(TUNE.deepBonus * 100);
    return (
        <div className="sw-deep" data-open={open ? "" : undefined} data-can={can ? "" : undefined} style={{ "--c": "#ffd27a" } as CSSProperties}>
            <span className="sw-deep-art" key={pop} style={{ backgroundImage: `url("${ui(`node-deep-${open ? (deep.n > 0 ? "own" : "open") : "lock"}`)}")` }} />
            <div className="sw-deep-copy">
                <b>Deep stars <em>{deep.n}</em></b>
                <span>{open ? <>Each adds <strong>+{pct}%</strong> to everything. Now <strong>+{Math.round(TUNE.deepBonus * deep.n * 100)}%</strong>.</> : `Light every star to reach them. ${left} left.`}</span>
            </div>
            {open && (
                <button type="button" className="sw-sc-buy sw-deep-buy" disabled={!can} onClick={() => { deep.onBuy(); setPop((v) => v + 1); play("deep"); }} data-tip={`Deep star|+${pct}% everything|${fmt(deep.cost)} stardust`}>
                    <span>{can ? "Light one" : `Need ${fmt(deep.cost - cur)}`}</span>
                    <em><Ic n="stat-dust" s={1} /> {fmt(deep.cost)}</em>
                </button>
            )}
        </div>
    );
}
