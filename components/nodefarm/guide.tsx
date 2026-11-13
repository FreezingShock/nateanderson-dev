"use client";

import { createContext, memo, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type RefObject } from "react";
import { cxPlay, useCodeReveal } from "@/lib/nodefarm/cx";
import { apOnAscend, button, canAfford, canAscend, droneCost, droneMax, fmt, statDef, type Derived, type State, type StatId } from "@/lib/nodefarm/engine";
import { DRONE_NAMES, etaText, incomeOf, telemetry, type NxIcon, type Step, type Target, type TipInfo } from "@/lib/nodefarm/guide";
import { NfIcon, type NfIconName } from "./icon";

// ---- the next step console: always under the HUD. An animated plate for the kind of step, what to do and why, a live meter
// with the rate and time left, a button that does the step when it can (or takes you to it), and a row of live readouts for
// every system (next zone, Ascend, AP, goals, lab, drones) that each jump to where they live. Art: scripts/naos-art/nodefarm-next-art.py.
const PLATES = ["grow", "reboot", "decrypt", "build", "drone", "ascend", "tree", "lab", "compile", "goal", "done"] as const;
type Plate = (typeof PLATES)[number];
const NX_ICONS: NxIcon[] = ["target", "map", "ascend", "ap", "key", "goal", "lab", "drone", "clock", "tree", "intel", "play", "lock"];
const PLATE_C: Record<Plate, string> = { grow: "#b6f04a", reboot: "#ff2d8a", decrypt: "#ffc53a", build: "", drone: "#6bffc9", ascend: "#ff2d8a", tree: "#a98bff", lab: "#9fd0ff", compile: "#9fd0ff", goal: "#ffc53a", done: "#2fd8e8" };
const PLATE_TAG: Record<Plate, string> = { grow: "growth", reboot: "reboot", decrypt: "decrypt", build: "build", drone: "drones", ascend: "ascend", tree: "prestige", lab: "research", compile: "payload", goal: "goal", done: "complete" };
const STORE = "nf-next-v1";

function plateOf(id: string): { p: Plate; stat?: StatId } {
    if (id === "first-mult" || id === "grow") return { p: "grow", stat: "mult" };
    if (id === "first-reboot") return { p: "reboot" };
    if (id === "spend-ap" || id === "finish-tree" || id === "open-handover" || id === "handover" || id === "flash-fw") return { p: "tree" };
    if (id === "event") return { p: "goal" };
    if (id === "lab-research") return { p: "lab" };
    if (id === "lab-compile") return { p: "compile" };
    if (id === "first-drone") return { p: "drone" };
    if (id === "ascend" || id === "reach-ascend") return { p: "ascend" };
    if (id.startsWith("decrypt-")) return { p: "decrypt", stat: id.slice(8) as StatId };
    if (id.startsWith("first-")) return { p: "build", stat: id.slice(6) as StatId };
    if (id.startsWith("goal-")) return { p: "goal" };
    return { p: "done" };
}

export function NxIc({ name }: { name: NxIcon }) {
    return <span aria-hidden="true" className="nf-nx-i" style={{ ["--i" as string]: NX_ICONS.indexOf(name) } as CSSProperties} />;
}

/** What the big button does: the step itself when it can be done from here, otherwise open or point at it. */
function primaryOf(s: State, step: Step): { kind: "do" | "go"; label: string; detail: string; icon: NxIcon } {
    const t = step.target;
    if (t?.stat !== undefined && t.tier !== undefined && canAfford(s, t.stat, t.tier)) {
        const b = button(s, t.stat, t.tier);
        return { kind: "do", label: t.stat === "reboot" ? "Reboot now" : `Buy ${statDef(t.stat).short} T${t.tier + 1}`, detail: `${fmt(b.cost)} ${statDef(b.pays).short}`, icon: "play" };
    }
    if (t?.drone !== undefined && s.drones[t.drone] < droneMax(s) && s.aether >= droneCost(s, t.drone)) {
        return { kind: "do", label: `Build ${DRONE_NAMES[t.drone]}`, detail: `${fmt(droneCost(s, t.drone))} AE`, icon: "play" };
    }
    if (t?.win === "stress") return { kind: "go", label: "Open stress tests", detail: "permanent rewards", icon: "play" };
    if (t?.win === "handover") return { kind: "go", label: "Open Handover", detail: s.hand.keys > 0 ? `${fmt(s.hand.keys)} Keys` : "Keys and Firmware", icon: "key" };
    if (t?.sched) return { kind: "go", label: "Open Scripts", detail: "learned and learning", icon: "play" };
    if (t?.dtree) return { kind: "go", label: "Open Drone tree", detail: "spend Cores", icon: "drone" };
    if (t?.win === "tree") return { kind: "go", label: "Open tree", detail: `${fmt(s.ap)} AP to spend`, icon: "tree" };
    if (t?.win === "ascend") return { kind: "go", label: "Open Ascend", detail: canAscend(s) ? `+${fmt(apOnAscend(s))} AP` : "perks and reset", icon: "ascend" };
    if (t?.win === "goals") return { kind: "go", label: "Open goals", detail: "rewards and tiers", icon: "goal" };
    if (t?.win === "lab") return { kind: "go", label: "Open lab", detail: `${fmt(s.lab.intel)} Intel`, icon: "lab" };
    if (t?.lab) return { kind: "go", label: "Go to lab", detail: "compile, then deploy", icon: "lab" };
    if (t?.drone !== undefined) return { kind: "go", label: "Show me", detail: "Drone bay", icon: "target" };
    if (t?.stat) return { kind: "go", label: "Show me", detail: `${statDef(t.stat).name} T${(t.tier ?? 0) + 1}`, icon: "target" };
    return { kind: "go", label: "Show me", detail: "", icon: "target" };
}

export function GuideStrip({ s, d, step, onGo, onDo, onCell, onMap, mapOpen }: {
    s: State;
    d: Derived;
    step: Step;
    onGo: () => void;
    /** do the step directly (press the button / build the Drone); false when it could not */
    onDo: () => boolean;
    onCell: (t: Target) => void;
    onMap: () => void;
    mapOpen: boolean;
}) {
    const pct = Math.round(step.frac * 100);
    const eta = etaText(step.eta);
    const { p, stat } = plateOf(step.id);
    const color = PLATE_C[p] || (stat ? statDef(stat).color : "#2fd8e8");
    const prim = primaryOf(s, step);
    const rate = step.pay ? incomeOf(s, d, step.pay) : 0;
    const cells = telemetry(s, d);
    const done = step.frac >= 1;
    // the readout row can be folded away (remembered per browser)
    const [folded, setFolded] = useState(false);
    useEffect(() => { try { setFolded(localStorage.getItem(STORE) === "0"); } catch {} }, []);
    const fold = () => { const v = !folded; setFolded(v); try { localStorage.setItem(STORE, v ? "0" : "1"); } catch {} };
    // a new step decrypts in (the unlock look); the first paint does not
    const text = useRef<HTMLDivElement>(null);
    const prev = useRef(step.id);
    useEffect(() => {
        if (prev.current !== step.id) cxPlay(text.current, { bare: true, ms: 360, rows: ":scope > *", style: "decrypt" });
        prev.current = step.id;
    }, [step.id]);
    return (
        <aside className="nf-guide nf-nx" data-step={step.id} data-plate={p} data-done={done ? "" : undefined} aria-label="Next step" style={{ ["--c" as string]: color } as CSSProperties}>
            <div className="nf-nx-plate" aria-hidden="true" style={{ ["--p" as string]: PLATES.indexOf(p) } as CSSProperties}>
                {stat && <span className="nf-nx-stat"><NfIcon name={stat as NfIconName} /></span>}
                <span className="nf-nx-tag">{PLATE_TAG[p]}</span>
            </div>
            <div className="nf-gd-text" ref={text}>
                <span className="nf-gd-k"><span aria-hidden="true">$ next </span>{"// "}{step.kicker}</span>
                <b className="nf-gd-t">{step.title}</b>
                <p className="nf-gd-why">{step.why}</p>
            </div>
            <div className="nf-gd-meter">
                <div className="nf-nx-mh">
                    <b>{step.meter ?? (step.unit ? `${fmt(step.cur)} / ${fmt(step.need)} ${step.unit}` : step.need > 1 ? `${fmt(step.cur)} / ${fmt(step.need)}` : `${pct}%`)}</b>
                    <span>{done ? "ready" : `${pct}%`}</span>
                </div>
                <span className="nf-bar nf-gd-bar" role="progressbar" aria-label={step.title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                    <i style={{ width: `${pct}%` }} />
                </span>
                <dl className="nf-nx-dl">
                    <div><dt><NxIc name="clock" /> eta</dt><dd>{done ? "now" : eta || (step.pay ? "start producing" : "ready when you are")}</dd></div>
                    {step.pay && <div><dt><NxIc name="intel" /> rate</dt><dd>{rate > 0 ? `+${fmt(rate)} ${statDef(step.pay).short}/s` : "not producing"}</dd></div>}
                </dl>
            </div>
            <div className="nf-gd-act">
                <button type="button" className="nf-gd-go" data-kind={prim.kind} onClick={() => { if (prim.kind === "do") { if (!onDo()) onGo(); } else onGo(); }}>
                    <NxIc name={prim.icon} />
                    <span><b>{prim.label}</b>{prim.detail && <small>{prim.detail}</small>}</span>
                </button>
                <div className="nf-nx-sec">
                    {prim.kind === "do" && <button type="button" className="nf-gd-map" onClick={onGo}><NxIc name="target" /> Find</button>}
                    <button type="button" className="nf-gd-map" aria-haspopup="dialog" aria-pressed={mapOpen} onClick={onMap}><NxIc name="map" /> Map</button>
                    <button type="button" className="nf-gd-map nf-nx-fold" aria-expanded={!folded} aria-controls="nf-nx-cells" onClick={fold} title={folded ? "Show live readouts" : "Hide live readouts"}>{folded ? "+" : "−"}<span className="sr-only">{folded ? "Show live readouts" : "Hide live readouts"}</span></button>
                </div>
            </div>
            {step.also && step.also.length > 0 && (
                <ul className="nf-nx-also" aria-label="Also ready">
                    {step.also.map((a) => (
                        <li key={a.id}>
                            <button type="button" onClick={() => a.target && onCell(a.target)}><span aria-hidden="true">+ </span>{a.text}</button>
                        </li>
                    ))}
                </ul>
            )}
            {!folded && (
                <ul className="nf-nx-cells" id="nf-nx-cells" aria-label="Live progress">
                    {cells.map((c) => (
                        <li key={c.id}>
                            <button type="button" className="nf-nx-cell" data-state={c.state} disabled={c.state === "locked" || !c.target} style={{ ["--c" as string]: c.color } as CSSProperties} onClick={() => c.target && onCell(c.target)}>
                                <NxIc name={c.state === "locked" ? "lock" : c.icon} />
                                <span className="nf-nx-cl">{c.label}{c.state === "ready" && <em> {"// ready"}</em>}</span>
                                <b>{c.value}</b>
                                <small>{c.sub}</small>
                                <i aria-hidden="true"><i style={{ width: `${Math.round(c.frac * 100)}%` }} /></i>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </aside>
    );
}

// ---- tooltips. One layer at the root of the game, placed from the button's box; a quartz button is clipped, so the tip cannot live inside it.
export interface TipState {
    el: HTMLElement;
    build: () => TipInfo;
    guided?: boolean;
}
export interface TipApi {
    /** show a tip for `el`; with `ms` it hides itself after that long (for touch, where there is no hover) */
    show: (el: HTMLElement, build: () => TipInfo, opts?: { ms?: number; guided?: boolean }) => void;
    hide: (el?: HTMLElement) => void;
}
export const TipCtx = createContext<TipApi>({ show() {}, hide() {} });
/** The tip's own store: showing or hiding one re-renders only <Tip>, never the board. */
export interface TipStore {
    get: () => TipState | null;
    set: (f: TipState | null | ((cur: TipState | null) => TipState | null)) => void;
    sub: (fn: () => void) => () => void;
}

export const Tip = memo(function Tip({ host, store }: { host: RefObject<HTMLElement | null>; store: TipStore }) {
    const live = useSyncExternalStore(store.sub, store.get, () => null);
    // the numbers in a tip follow the game, about four times a second while one is showing
    const [, again] = useState(0);
    useEffect(() => {
        if (!live) return;
        const iv = setInterval(() => again((n) => n + 1), 250);
        return () => clearInterval(iv);
    }, [live]);
    const ref = useRef<HTMLDivElement>(null);
    // keep the last tip on screen while it deletes out; a new target reprints it (code reveal, lib/nodefarm/cx.ts)
    const last = useRef<TipState | null>(null);
    if (live) last.current = live;
    const shown = useCodeReveal(ref, !!live, { bare: true, ms: 200, rows: ":scope > *" });
    const tip = live ?? (shown ? last.current : null);
    const target = live?.el ?? null;
    const prevTarget = useRef<HTMLElement | null>(null);
    useEffect(() => {
        if (target && prevTarget.current && target !== prevTarget.current) cxPlay(ref.current, { bare: true, ms: 200, rows: ":scope > *" });
        prevTarget.current = target;
    }, [target]);
    useLayoutEffect(() => {
        const t = ref.current;
        const h = host.current;
        if (!t || !h || !tip || !tip.el.isConnected) return;
        const hr = h.getBoundingClientRect();
        const ar = tip.el.getBoundingClientRect();
        const w = t.offsetWidth;
        const ht = t.offsetHeight;
        // above the button when there is room below the site bar, otherwise under it
        const above = ar.top - ht - 10 > 72;
        const left = Math.max(0, Math.min(ar.left - hr.left + ar.width / 2 - w / 2, hr.width - w));
        t.style.left = `${left}px`;
        t.style.top = `${(above ? ar.top - ht - 10 : ar.bottom + 10) - hr.top}px`;
        t.dataset.side = above ? "up" : "down";
        t.style.setProperty("--ax", `${Math.max(14, Math.min(w - 14, ar.left - hr.left + ar.width / 2 - left))}px`);
    });
    if (!tip || !tip.el.isConnected) return null;
    const c = tip.build();
    return (
        <div ref={ref} className="nf-tip" role="tooltip" data-tone={c.tone} style={{ ["--c" as string]: c.color }}>
            <div className="nf-tip-h">
                <span>{tip.guided ? "NEXT STEP // " : ""}{c.kicker}</span>
                <b>{c.title}</b>
            </div>
            {c.note && <p className="nf-tip-n">{c.note}</p>}
            <dl className="nf-tip-d">
                {c.rows.map(([k, v]) => (
                    <div key={k}><dt>{k}</dt><i aria-hidden="true" /><dd>{v}</dd></div>
                ))}
            </dl>
            <p className="nf-tip-s">{c.status}</p>
        </div>
    );
});
