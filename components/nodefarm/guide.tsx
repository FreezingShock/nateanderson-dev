"use client";

import { createContext, memo, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { cxPlay, useCodeReveal } from "@/lib/nodefarm/cx";
import { fmt } from "@/lib/nodefarm/engine";
import { etaText, type Step, type TipInfo } from "@/lib/nodefarm/guide";
import { NfIcon, type NfIconName } from "./icon";

// ---- the "next step" strip: always under the HUD. One line on what to do, one on why, how close you are, and a GO button
// that opens the right zone and scrolls to the glowing button.
export function GuideStrip({ step, onGo, onMap, mapOpen }: { step: Step; onGo: () => void; onMap: () => void; mapOpen: boolean }) {
    const pct = Math.round(step.frac * 100);
    const eta = etaText(step.eta);
    const t = step.target;
    // the sprite of whatever the step points at, so the strip reads at a glance (2026-11-12 refresh)
    const icon: NfIconName = t?.drone !== undefined ? "aether" : t?.win === "tree" || t?.win === "ascend" ? "ascend" : t?.win === "goals" ? "spark" : (t?.stat as NfIconName | undefined) ?? "spark";
    return (
        <aside className="nf-guide" data-step={step.id} aria-label="Next step">
            <span className="nf-gd-ic" aria-hidden="true"><NfIcon name={icon} large /></span>
            <div className="nf-gd-text">
                <span className="nf-gd-k"><span aria-hidden="true">$ next </span>{"// "}{step.kicker}</span>
                <b className="nf-gd-t">{step.title}</b>
                <p className="nf-gd-why">{step.why}</p>
            </div>
            <div className="nf-gd-meter">
                <span className="nf-bar nf-gd-bar" role="progressbar" aria-label={step.title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                    <i style={{ width: `${pct}%` }} />
                </span>
                <small>
                    {step.unit ? <>{fmt(step.cur)} / {fmt(step.need)} {step.unit}</> : <>{pct}%</>}
                    {eta && <> · about {eta}</>}
                </small>
            </div>
            <div className="nf-gd-act">
                <button type="button" className="nf-gd-go" onClick={onGo}>
                    <NfIcon name="spark" /> Show me <kbd className="nf-kbd" aria-hidden="true">G</kbd>
                </button>
                <button type="button" className="nf-gd-map" aria-haspopup="dialog" aria-pressed={mapOpen} onClick={onMap}>
                    Map
                </button>
            </div>
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
