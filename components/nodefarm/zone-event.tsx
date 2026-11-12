"use client";

import "@/app/camino/nodefarm-zoneevents.css";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { cxPlay } from "@/lib/nodefarm/cx";
import { ZE_TUNE, fmt, statDef, type State, type StatId, type ZoneEvActive } from "@/lib/nodefarm/engine";
import { mineAmount, patchCost, zeEffect, zeTitle, zoneEvDef, zoneLabel, type ZeChoice } from "@/lib/nodefarm/zoneevents";

const clock = (sec: number) => `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.floor(Math.max(0, sec) % 60)).padStart(2, "0")}`;

/** The readout a zone event puts on its zone's panel: tag and clock, one plain effect line, a countdown bar, and for a vein or a
 *  fault the two answers with what each one does. It is part of the panel, so a folded zone still shows it. A Resonance shows on
 *  both zones it lifts. */
export function ZoneEvent({ s, zone, e, onChoose, cardId }: { s: State; zone: StatId; e: ZoneEvActive; onChoose: (id: number, c: ZeChoice) => void; cardId?: number | null }) {
    const def = zoneEvDef(e.kind);
    const box = useRef<HTMLDivElement>(null);
    useEffect(() => { cxPlay(box.current, { style: "decrypt", bare: true, sound: false, rows: ":scope > *" }); }, [e.id]);
    const home = e.zone === zone;
    const open = (e.kind === "vein" || e.kind === "fault") && !e.picked && cardId !== e.id;
    const pct = Math.max(0, Math.min(100, (e.left / e.total) * 100));
    const cost = e.kind === "fault" ? patchCost(s) : 0;
    const canPatch = s.bytes >= cost;
    return (
        <div ref={box} className="nf-ze" data-kind={e.kind} role="status" style={{ ["--k" as string]: def.color } as CSSProperties}>
            <div className="nf-ze-t">
                <b>// {def.code}</b>
                <span>{home ? "zone event" : `from ${zoneLabel(e.zone)}`}</span>
                <time>{clock(e.left)}</time>
            </div>
            <p className="nf-ze-l">{zeEffect(s, e)}.</p>
            <span className="nf-bar sm" aria-hidden="true"><i style={{ width: `${pct}%`, background: def.color }} /></span>
            {home && open && e.kind === "vein" && (
                <div className="nf-ze-c">
                    <button type="button" className="nf-mini" onClick={() => onChoose(e.id, "mine")}>Mine it now: +{fmt(mineAmount(s, e.zone))} {statDef(e.zone).name}</button>
                    <button type="button" className="nf-mini" onClick={() => onChoose(e.id, "run")}>Let it run: ×{ZE_TUNE.vein} for {clock(e.left)}</button>
                </div>
            )}
            {home && open && e.kind === "fault" && (
                <div className="nf-ze-c">
                    <button type="button" className="nf-mini" disabled={!canPatch} onClick={() => onChoose(e.id, "patch")}>Patch it: {fmt(cost)} Bytes{canPatch ? "" : " (not enough yet)"}</button>
                    <button type="button" className="nf-mini" onClick={() => onChoose(e.id, "wait")}>Wait it out: {clock(e.left)}</button>
                </div>
            )}
        </div>
    );
}

const CARD_MS = 7000;
/** The centered announcement for a new zone event, in the quick-time cards' look. It never blocks the board (no scrim). A plain
 *  event closes itself after a few seconds; a vein or a fault stays until you answer or tap Later, then its answers live on the
 *  zone's own readout. */
export function ZoneEventCard({ s, id, onChoose, onClose, reduced }: { s: State; id: number | null; onChoose: (id: number, c: ZeChoice) => void; onClose: () => void; reduced: boolean }) {
    const [host, setHost] = useState<Element | null>(null);
    const e = id == null ? undefined : s.ze?.act.find((x) => x.id === id && x.left > 0);
    const card = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const pick = () => { const fs = document.fullscreenElement; setHost(fs && fs !== document.documentElement ? fs : document.body); };
        pick();
        document.addEventListener("fullscreenchange", pick);
        return () => document.removeEventListener("fullscreenchange", pick);
    }, []);
    const ask = !!e && (e.kind === "vein" || e.kind === "fault") && !e.picked;
    const there = !!e;
    useEffect(() => {
        if (!there) return;
        cxPlay(card.current, { style: "decrypt", bare: true, sound: false, rows: ":scope > :not(.nf-zc-br)" });
        if (ask) return;
        const t = setTimeout(onClose, CARD_MS);
        return () => clearTimeout(t);
    }, [id, there, ask, onClose]);
    useEffect(() => { if (id != null && !e) onClose(); }, [id, e, onClose]);
    if (!host || !e) return null;
    const def = zoneEvDef(e.kind);
    const cost = e.kind === "fault" ? patchCost(s) : 0;
    const canPatch = s.bytes >= cost;
    const pct = Math.max(0, Math.min(100, (e.left / e.total) * 100));
    const answer = (c: ZeChoice) => { onChoose(e.id, c); onClose(); };
    return createPortal(
        <div className="ctos nf-ev-host">
            <div className="nf-zc-wrap" data-reduced={reduced ? "" : undefined}>
                <div ref={card} className="nf-zc" role="status" data-kind={e.kind} style={{ ["--k" as string]: def.color } as CSSProperties}>
                    {(["tl", "tr", "bl", "br"] as const).map((c) => <i key={c} className="nf-zc-br" data-c={c} aria-hidden="true" />)}
                    <div className="nf-zc-top"><b>ZONE EVENT // {def.code}</b><span>{zoneLabel(e.zone)}</span></div>
                    <h3 className="nf-zc-name">{zeTitle(e.kind, e.zone)}</h3>
                    <p className="nf-zc-line">{zeEffect(s, e)} for {clock(e.left)}.</p>
                    <span className="nf-bar sm" aria-hidden="true"><i style={{ width: `${pct}%`, background: def.color }} /></span>
                    {ask && e.kind === "vein" && (
                        <div className="nf-zc-c">
                            <button type="button" className="nf-mini" onClick={() => answer("mine")}>Mine it now: +{fmt(mineAmount(s, e.zone))} {statDef(e.zone).name}</button>
                            <button type="button" className="nf-mini" onClick={() => answer("run")}>Let it run: ×{ZE_TUNE.vein} for {clock(e.left)}</button>
                        </div>
                    )}
                    {ask && e.kind === "fault" && (
                        <div className="nf-zc-c">
                            <button type="button" className="nf-mini" disabled={!canPatch} onClick={() => answer("patch")}>Patch it: {fmt(cost)} Bytes{canPatch ? "" : " (not enough yet)"}</button>
                            <button type="button" className="nf-mini" onClick={() => answer("wait")}>Wait it out: {clock(e.left)}</button>
                        </div>
                    )}
                    <button type="button" className="nf-mini nf-zc-x" onClick={onClose}>{ask ? "Decide later" : "Dismiss"}</button>
                </div>
            </div>
        </div>,
        host,
    );
}
