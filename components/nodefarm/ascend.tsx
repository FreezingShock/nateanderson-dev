"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BRANCHES, MATS, PERKS, TREE, TUNE, apEach, apGlobal, apOnAscend, canAscend, derive, fmt, hasNode, mountSlots, nodeVis, statDef, type MatId, type State } from "@/lib/nodefarm/engine";
import { NfIcon } from "./icon";

// The Ascend window (2026-11-12 rework): the art is the stage, the Aether charge climbs beside the tower, a three-step
// ledger shows the flow (Aether -> Ascend -> AP), and the tree gets a gateway panel with a live miniature of what you have
// revealed. Styles: app/camino/nodefarm-ascend.css (classes nf-ax*; nf-asc* belonged to the old panel).
// Rows carry data-cx-i so the shared code-reveal primitive (lib/nodefarm/cx.ts) can print them in order.

type D = ReturnType<typeof derive>;
type PerkId = (typeof PERKS)[number]["id"];
const HOLD_MS = 1200;
const SEGS = 12;
const RINGS = 5; // the five rings on the tower in scene-ascend, lit from the bottom as Aether climbs

/** Press and hold to Ascend. A quick tap or an assistive-tech click falls back to the old two-step confirm. */
function HoldAscend({ ready, gain, confirm, onAscend }: { ready: boolean; gain: number; confirm: boolean; onAscend: (now?: boolean) => void }) {
    const [hold, setHold] = useState(false);
    const [nudge, setNudge] = useState(false);
    const t = useRef<number | undefined>(undefined);
    const started = useRef(0);
    const fired = useRef(false);
    const keyed = useRef(false);
    const stop = (done = false) => {
        window.clearTimeout(t.current);
        t.current = undefined;
        if (!done && started.current && performance.now() - started.current < HOLD_MS) {
            setNudge(true);
            window.setTimeout(() => setNudge(false), 1600);
        }
        started.current = 0;
        setHold(false);
    };
    const start = () => {
        if (!ready || t.current) return;
        fired.current = false;
        started.current = performance.now();
        setHold(true);
        setNudge(false);
        t.current = window.setTimeout(() => {
            fired.current = true;
            stop(true);
            onAscend(true);
        }, HOLD_MS);
    };
    useEffect(() => () => window.clearTimeout(t.current), []);
    return (
        <button
            type="button"
            className="nf-ax-go"
            disabled={!ready}
            data-hold={hold ? "" : undefined}
            data-confirm={confirm ? "" : undefined}
            style={{ ["--hold" as string]: `${HOLD_MS}ms` } as CSSProperties}
            onPointerDown={(e) => { if (e.button === 0) { e.currentTarget.setPointerCapture?.(e.pointerId); start(); } }}
            onPointerUp={() => stop()}
            onPointerCancel={() => stop()}
            onLostPointerCapture={() => { if (t.current) stop(); }}
            onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); keyed.current = true; start(); } }}
            onKeyUp={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); keyed.current = false; if (t.current) stop(); } }}
            onBlur={() => { if (t.current) stop(); }}
            onContextMenu={(e) => e.preventDefault()}
            onClick={(e) => {
                // pointer and key presses are handled by the hold; a click with no press behind it (screen readers) confirms twice
                if (e.detail === 0 && !keyed.current && !fired.current && ready) onAscend(false);
            }}
        >
            <i className="nf-ax-go-fill" aria-hidden="true" />
            <span className="nf-ax-go-t">
                {!ready ? `Need ${fmt(TUNE.ascendAether)} Aether` : confirm ? `Confirm: wipe and gain ${gain} AP` : hold ? "Keep holding" : nudge ? "Keep holding to Ascend" : `Hold to Ascend · +${gain} AP`}
            </span>
        </button>
    );
}

/** The art with the charge: a segmented Aether column beside the tower and a beacon that lights when it is full. */
function Stage({ s, gain }: { s: State; gain: number }) {
    const pct = Math.min(1, s.aether / TUNE.ascendAether);
    const lit = Math.floor(pct * SEGS);
    const ready = gain > 0;
    return (
        <section className="nf-ax-stage" data-cx-i="0" data-ready={ready ? "" : undefined} aria-label="Aether charge">
            <div className="nf-ax-art" aria-hidden="true">
                <span className="nf-ax-tower">
                    {Array.from({ length: RINGS }, (_, i) => <i key={i} className="nf-ax-ring" data-on={i < Math.floor(pct * RINGS) ? "" : undefined} style={{ ["--i" as string]: i } as CSSProperties} />)}
                    <i className="nf-ax-beacon" />
                </span>
                <i className="nf-ax-scan" />
            </div>
            <div className="nf-ax-code" aria-hidden="true">
                <span>ASCEND.SYS // NODE-01{s.life.ascends ? ` // RUN ${String(s.life.ascends + 1).padStart(2, "0")}` : ""}</span>
                <span><b>aether</b> {fmt(Math.min(s.aether, TUNE.ascendAether))} / {fmt(TUNE.ascendAether)} <em>{Math.floor(pct * 100)}%</em></span>
                <span><b>status</b> <em data-st={ready ? "ready" : "charge"}>{ready ? "READY" : "CHARGING"}</em></span>
            </div>
            <div className="nf-ax-col" role="meter" aria-label="Aether toward Ascend" aria-valuemin={0} aria-valuemax={TUNE.ascendAether} aria-valuenow={Math.min(s.aether, TUNE.ascendAether)}>
                {Array.from({ length: SEGS }, (_, i) => <i key={i} data-on={SEGS - 1 - i < lit ? "" : undefined} />)}
            </div>
        </section>
    );
}

/** Aether -> Ascend -> AP, as three plain data steps joined by a trace. */
function Flow({ s, d, gain, confirm, onAscend }: { s: State; d: D; gain: number; confirm: boolean; onAscend: (now?: boolean) => void }) {
    const after = apGlobal(s, gain) / apGlobal(s);
    const deep = (["runes", "starglass", "voidsteel", "chrono"] as const).filter((m) => s[m] > 0);
    const ready = canAscend(s);
    return (
        <section className="nf-ax-flow" data-cx-i="1">
            <ol className="nf-ax-steps" data-ready={ready ? "" : undefined}>
                <li style={{ ["--c" as string]: statDef("aether").color }}>
                    <span className="nf-ax-k" data-cx-scr="">01 // Charge</span>
                    <span className="nf-ax-v"><NfIcon name="aether" /><b>{fmt(s.aether)}</b><small>/ {fmt(TUNE.ascendAether)} Aether</small></span>
                    <span className="nf-bar sm" aria-hidden="true"><i style={{ width: `${Math.min(100, (s.aether / TUNE.ascendAether) * 100)}%` }} /></span>
                    {deep.length > 0 && <small className="nf-ax-n">Deep materials add AP too: {deep.map((m) => `${statDef(m).name} ${fmt(s[m])}`).join(", ")}</small>}
                </li>
                <li style={{ ["--c" as string]: "#ff2d8a" }}>
                    <span className="nf-ax-k" data-cx-scr="">02 // Ascend</span>
                    <span className="nf-ax-v"><NfIcon name="ascend" /><b>{gain > 0 ? `+${gain}` : "0"}</b><small>AP on Ascend</small></span>
                    <small className="nf-ax-n">Wipes the whole run. Keeps goals, perks, the tree and lifetime stats.</small>
                </li>
                <li style={{ ["--c" as string]: "var(--cm-cyan)" }}>
                    <span className="nf-ax-k" data-cx-scr="">03 // Spend or hold</span>
                    <span className="nf-ax-v"><b>{s.ap}</b><small>AP held · each +{Math.round(apEach(s) * 100)}% to everything</small></span>
                    <span className="nf-ax-g"><small>Global</small><b>×{fmt(d.global)}</b>{gain > 0 && <><em aria-hidden="true">→</em><b data-up="">×{fmt(d.global * after)}</b></>}</span>
                </li>
            </ol>
            <HoldAscend ready={ready} gain={gain} confirm={confirm} onAscend={onAscend} />
        </section>
    );
}

function Perks({ s, onPerk }: { s: State; onPerk: (id: PerkId) => void }) {
    return (
        <section className="nf-ax-perks" data-cx-i="3">
            <header className="nf-sys-h"><h3>Perks</h3><p>{s.ap} AP to spend. Perks survive every Ascend.</p></header>
            <ul>
                {PERKS.map((p, i) => {
                    const lvl = s.perks[p.id];
                    const cost = p.cost(lvl);
                    const maxed = lvl >= p.max;
                    return (
                        <li key={p.id} data-maxed={maxed ? "" : undefined} data-can={!maxed && s.ap >= cost ? "" : undefined}>
                            <span className="nf-ax-pn" aria-hidden="true">P{i + 1}</span>
                            <span className="nf-ax-pt">
                                <b>{p.name}</b>
                                <small>{p.blurb}</small>
                                <span className="nf-ax-pips" aria-label={`Level ${lvl} of ${p.max}`}>
                                    {Array.from({ length: p.max }, (_, k) => <i key={k} data-on={k < lvl ? "" : undefined} />)}
                                </span>
                            </span>
                            <span className="nf-ax-lv">LV {lvl}/{p.max}</span>
                            <button type="button" className="nf-mini" disabled={maxed || s.ap < cost} onClick={() => onPerk(p.id)}>
                                {maxed ? "Max" : `${cost} AP`}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

/** Live miniature of the tree: only what the tree itself would show (owned, buyable, fog). */
function MiniTree({ s }: { s: State }) {
    const vis = new Map(TREE.map((n) => [n.id, nodeVis(s, n)]));
    const color = Object.fromEntries(BRANCHES.map((b) => [b.id, b.color]));
    const shown = TREE.filter((n) => vis.get(n.id) !== "hidden");
    const at = (id: string) => (id === "core" ? { x: 0, y: 0 } : TREE.find((n) => n.id === id)!);
    const links: [string, string, boolean][] = [];
    for (const n of shown) for (const l of n.links) {
        if (l !== "core" && (vis.get(l) === "hidden" || l < n.id)) continue;
        links.push([n.id, l, hasNode(s, n.id) && (l === "core" || hasNode(s, l))]);
    }
    // zoom to what is revealed, so the miniature grows outward as the tree opens up
    const R = Math.min(11, Math.max(4.6, ...shown.map((n) => Math.max(Math.abs(n.x), Math.abs(n.y)) + 1.4)));
    return (
        <svg className="nf-ax-mini" viewBox={`${-R} ${-R} ${R * 2} ${R * 2}`} aria-hidden="true">
            <g className="nf-ax-spokes">
                {BRANCHES.map((b, i) => {
                    const th = -Math.PI / 2 + (i * 2 * Math.PI) / BRANCHES.length;
                    return <line key={b.id} x1={Math.cos(th) * 1.4} y1={Math.sin(th) * 1.4} x2={Math.cos(th) * 10.4} y2={Math.sin(th) * 10.4} stroke={b.color} />;
                })}
            </g>
            <g className="nf-ax-links">
                {links.map(([a, b, on]) => { const A = at(a), B = at(b); return <line key={a + b} x1={A.x} y1={A.y} x2={B.x} y2={B.y} data-on={on ? "" : undefined} />; })}
            </g>
            {shown.map((n) => {
                const v = vis.get(n.id);
                const own = hasNode(s, n.id);
                const r = n.kind === "keystone" ? 0.85 : n.kind === "notable" ? 0.7 : 0.55;
                return (
                    <rect key={n.id} x={n.x - r} y={n.y - r} width={r * 2} height={r * 2} className="nf-ax-nd" data-st={own ? "own" : v === "fog" ? "fog" : "open"}
                        style={{ ["--c" as string]: color[n.branch] } as CSSProperties} />
                );
            })}
            <rect className="nf-ax-core" x={-1} y={-1} width={2} height={2} />
        </svg>
    );
}

/** The way into the full-screen tree. A short dial-in plays here, then the tree menu runs its own opening. */
function Gateway({ s, onTree }: { s: State; onTree: () => void }) {
    const [go, setGo] = useState(false);
    const owned = s.tree.length;
    const open = () => {
        if (go) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return onTree();
        setGo(true);
        window.setTimeout(() => { setGo(false); onTree(); }, 240);
    };
    return (
        <section className="nf-ax-gate" data-cx-i="2" data-go={go ? "" : undefined}>
            <header className="nf-sys-h">
                <h3>Prestige tree</h3>
                <p>{TREE.length} upgrades in five sections, bought with AP and kept through every Ascend. {s.ap} AP to spend, {owned} of {TREE.length} owned.</p>
            </header>
            <button type="button" className="nf-ax-portal" onClick={open} aria-label="Open the prestige tree">
                <span className="nf-ax-portal-art" aria-hidden="true"><i className="nf-ax-sweep" /><MiniTree s={s} /></span>
                <ul className="nf-ax-secs" aria-hidden="true">
                    {BRANCHES.map((b) => {
                        const mine = TREE.filter((n) => n.branch === b.id);
                        return <li key={b.id} style={{ ["--c" as string]: b.color }}><b>{b.name}</b><small>{mine.filter((n) => hasNode(s, n.id)).length}/{mine.length}</small></li>;
                    })}
                </ul>
                <span className="nf-ax-cmd" aria-hidden="true"><em>&gt;</em> open /prestige/tree<i /></span>
            </button>
        </section>
    );
}

/** Mounted drives (Forge nodes): pick materials whose producers survive Ascend. */
function Mounts({ s, onMount }: { s: State; onMount: (slot: number, mat: MatId | null) => void }) {
    const slots = mountSlots(s);
    if (!slots) return null;
    return (
        <section className="nf-mounts" data-cx-i="4">
            <header className="nf-sys-h">
                <h3>Mounted drives</h3>
                <p>The producers of a mounted material survive every Ascend. Change a pick any time; only what is mounted when you Ascend is kept.</p>
            </header>
            {Array.from({ length: slots }, (_, i) => {
                const cur = s.mounts[i];
                return (
                    <div key={i} className="nf-mount" role="group" aria-label={`Drive ${i + 1}`}>
                        <span className="nf-mount-k">DRIVE {String(i + 1).padStart(2, "0")} // {cur ? `${statDef(cur).name.toUpperCase()}, ${fmt(s.prod[cur])} producers` : "EMPTY"}</span>
                        <div className="nf-mount-b">
                            {MATS.map((m) => {
                                const other = s.mounts.includes(m) && cur !== m;
                                return (
                                    <button key={m} type="button" className="nf-mini" aria-pressed={cur === m} disabled={other} style={{ ["--c" as string]: statDef(m).color }} onClick={() => onMount(i, cur === m ? null : m)} title={other ? "Already on another drive" : undefined}>
                                        {statDef(m).short}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </section>
    );
}

export function AscendPanel({ s, d, confirm, onAscend, onPerk, onTree, onMount }: { s: State; d: D; confirm: boolean; onAscend: (now?: boolean) => void; onPerk: (id: PerkId) => void; onTree: () => void; onMount: (slot: number, mat: MatId | null) => void }) {
    const gain = apOnAscend(s);
    return (
        <div className="nf-sys nf-ax">
            <Stage s={s} gain={gain} />
            <Flow s={s} d={d} gain={gain} confirm={confirm} onAscend={onAscend} />
            <Gateway s={s} onTree={onTree} />
            <Perks s={s} onPerk={onPerk} />
            <Mounts s={s} onMount={onMount} />
        </div>
    );
}
