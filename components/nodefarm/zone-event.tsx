"use client";

import "@/app/camino/nodefarm-events.css";
import "@/app/camino/nodefarm-zoneevents.css";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { cxPlay } from "@/lib/nodefarm/cx";
import { ZE_TUNE, fmt, statDef, type State, type StatId, type ZoneEvActive } from "@/lib/nodefarm/engine";
import { EVENT_TUNE, RARITY } from "@/lib/nodefarm/events";
import { keyIsTyping } from "@/lib/nodefarm/keys";
import { nfx } from "@/lib/nodefarm/sound";
import { mineAmount, patchCost, rogueOffers, zeEffect, zeTitle, zoneEvDef, zoneLabel, type ZeChoice } from "@/lib/nodefarm/zoneevents";
import { NfIcon, type NfIconName } from "./icon";

// the card's sounds play in the "events" mix
const sfx = (n: Parameters<typeof nfx>[0], a: unknown = {}) => nfx(n, a, "events");
/** Event keys stay quiet while typing, with a modifier held, or under search or the console. */
const evKeyOff = (e: KeyboardEvent) => keyIsTyping(e) || !!document.querySelector(".nv-scrim, .cn-panel");
const ROGUE_NAMES = ["Quarantine", "Exploit", "Harvest"];
const ROGUE_LINES = ["Lock it away and bank what it carried.", "Turn it on itself. The node runs hot for longer.", "Strip it for parts. Raw material, straight in."];
const GLYPHS = "░▒▓█▚▞▙▟";
const noise = (n: number) => Array.from({ length: n }, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]).join("");

/** Rogue process: pick one of the shown outcomes. */
function Rogue({ s, e, onPick }: { s: State; e: ZoneEvActive; onPick: (i: number) => void }) {
    const opts = rogueOffers(s, e);
    useEffect(() => {
        const onKey = (ev: KeyboardEvent) => {
            if (evKeyOff(ev)) return;
            if (ev.key >= "1" && ev.key <= String(opts.length)) onPick(Number(ev.key) - 1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onPick, opts.length]);
    return (
        <div className="nf-ev-body">
            <div className="nf-ev-opts">
                {opts.map((o, i) => (
                    <button key={i} type="button" className="nf-ev-opt" style={{ ["--c" as string]: RARITY[o.rarity].color } as CSSProperties} onClick={() => onPick(i)}>
                        <NfIcon name={o.stat as NfIconName} />
                        <span>
                            <b>{i + 1} · {ROGUE_NAMES[i]}</b>
                            <small>{o.label}, {o.note}. {ROGUE_LINES[i]}</small>
                        </span>
                    </button>
                ))}
            </div>
            <p className="nf-ev-state">All {opts.length} are <span style={{ color: RARITY[opts[0].rarity].color }}>{RARITY[opts[0].rarity].name.toLowerCase()}</span> this time.</p>
        </div>
    );
}

/** Cold storage: hold to decrypt rows; let go to pause; cash out to keep what is open. Nothing is lost by stopping. */
function Vault({ s, reduced, onCash }: { s: State; reduced: boolean; onCash: (rows: number) => void }) {
    const rows = EVENT_TUNE.vaultRows;
    const [held, setHeld] = useState(false);
    const [prog, setProg] = useState(0);
    const progRef = useRef(0);
    const t0 = useRef(0);
    const base = useRef(0);
    const raf = useRef(0);
    const [labels] = useState(() => {
        const ids = (["bytes", "mult", "reboot", "copper", "silicon", "quartz", "aether", "runes"] as const).filter((x) => x === "bytes" || (s[x] as number) > 0);
        return Array.from({ length: rows }, (_, i) => {
            const id = ids[i % ids.length];
            return { addr: `0x${(0x1f + i * 9).toString(16).toUpperCase()}`, name: statDef(id).name.toUpperCase().padEnd(13, " "), val: fmt((s[id] as number) * (0.2 + Math.random() * 0.6)) };
        });
    });
    const [, tick] = useState(0);
    // the frame loop and the cash-out read everything through refs, so re-renders never restart or cancel them
    const cash = useRef(onCash);
    cash.current = onCash;
    const loop = useRef(() => {});
    loop.current = () => {
        if (!t0.current) return;
        const v = Math.min(rows, base.current + (performance.now() - t0.current) / EVENT_TUNE.vaultRowMs);
        if (Math.floor(v) > Math.floor(progRef.current)) sfx("tap");
        progRef.current = v;
        setProg(v);
        if (v >= rows) { t0.current = 0; setHeld(false); cash.current(rows); return; }
        raf.current = requestAnimationFrame(() => loop.current());
    };
    const press = useCallback(() => {
        if (t0.current || progRef.current >= rows) return;
        t0.current = performance.now();
        base.current = progRef.current;
        setHeld(true);
        raf.current = requestAnimationFrame(() => loop.current());
        sfx("charge", { r: 1, ms: (rows - progRef.current) * EVENT_TUNE.vaultRowMs });
    }, [rows]);
    const release = useCallback(() => {
        if (!t0.current) return;
        cancelAnimationFrame(raf.current);
        t0.current = 0;
        setHeld(false);
    }, []);
    useEffect(() => {
        const dn = (e: KeyboardEvent) => { if (!evKeyOff(e) && e.code === "Space" && !e.repeat) { e.preventDefault(); press(); } };
        const up = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); release(); } };
        window.addEventListener("keydown", dn);
        window.addEventListener("keyup", up);
        return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
    }, [press, release]);
    useEffect(() => () => cancelAnimationFrame(raf.current), []);
    useEffect(() => {
        if (!held || reduced) return;
        const iv = setInterval(() => tick((x) => x + 1), 90);
        return () => clearInterval(iv);
    }, [held, reduced]);
    const opened = Math.floor(prog);
    return (
        <div className="nf-ev-body">
            <pre className="nf-ev-vault" aria-label={`${opened} of ${rows} rows decrypted`}>
                {labels.map((l, i) => (
                    <span key={i} data-open={i < opened ? "" : undefined} data-cur={i === opened && held ? "" : undefined}>
                        {l.addr}{"  "}{i < opened ? `${l.name}${l.val}` : noise(16)}
                        {"\n"}
                    </span>
                ))}
            </pre>
            <div className="nf-ev-bar" aria-hidden="true"><i style={{ transform: `scaleX(${prog / rows})` }} /></div>
            <button
                type="button"
                className="nf-ev-hold"
                data-held={held ? "" : undefined}
                onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); press(); }}
                onPointerUp={release}
                onPointerCancel={release}
                onContextMenu={(e) => e.preventDefault()}
                onKeyDown={(e) => { if (e.code === "Space" || e.code === "Enter") e.preventDefault(); }}
            >
                {held ? `Decrypting · ${opened} of ${rows}` : opened ? `Hold to keep going · ${opened} of ${rows}` : "Hold to decrypt"}
            </button>
            <div className="nf-ev-state">
                {opened ? <button type="button" className="nf-ev-mini" onClick={() => onCash(opened)}>Cash out {opened} {opened === 1 ? "row" : "rows"}</button> : "Every open row is paid out."}
            </div>
        </div>
    );
}

const clock = (sec: number) => `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.floor(Math.max(0, sec) % 60)).padStart(2, "0")}`;

/** The readout a zone event puts on its zone's panel: tag and clock, one plain effect line, a countdown bar, and for a vein or a
 *  fault the two answers with what each one does. It is part of the panel, so a folded zone still shows it. A Resonance shows on
 *  both zones it lifts. */
export function ZoneEvent({ s, zone, e, onChoose, cardId, onOpen }: { s: State; zone: StatId; e: ZoneEvActive; onChoose: (id: number, c: ZeChoice) => void; cardId?: number | null; onOpen?: (id: number) => void }) {
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
            {home && (e.kind === "rogue" || e.kind === "vault") && cardId !== e.id && (
                <div className="nf-ze-c">
                    <button type="button" className="nf-mini" onClick={() => onOpen?.(e.id)}>{e.kind === "rogue" ? "Choose what to do" : "Open the vault"}</button>
                </div>
            )}
        </div>
    );
}

const CARD_MS = 7000;
/** The centered announcement for a new zone event, in the old quick-time cards' look. It never blocks the board (no scrim). A plain
 *  event closes itself after a few seconds; a vein or a fault stays until you answer or tap Later, then its answers live on the
 *  zone's own readout. */
export function ZoneEventCard({ s, id, onChoose, onVault, onClose, reduced }: { s: State; id: number | null; onChoose: (id: number, c: ZeChoice) => void; onVault: (id: number, rows: number) => void; onClose: () => void; reduced: boolean }) {
    const [host, setHost] = useState<Element | null>(null);
    const e = id == null ? undefined : s.ze?.act.find((x) => x.id === id && x.left > 0);
    const card = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const pick = () => { const fs = document.fullscreenElement; setHost(fs && fs !== document.documentElement ? fs : document.body); };
        pick();
        document.addEventListener("fullscreenchange", pick);
        return () => document.removeEventListener("fullscreenchange", pick);
    }, []);
    const ask = !!e && (e.kind === "vein" || e.kind === "fault" ? !e.picked : e.kind === "rogue" || e.kind === "vault");
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
                    <p className="nf-zc-line">{zeEffect(s, e)}{e.kind === "rogue" || e.kind === "vault" ? `. Open for ${clock(e.left)}.` : ` for ${clock(e.left)}.`}</p>
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
                    {e.kind === "rogue" && <Rogue s={s} e={e} onPick={(i) => answer(`p${i}` as ZeChoice)} />}
                    {e.kind === "vault" && <Vault s={s} reduced={reduced} onCash={(rows) => { onVault(e.id, rows); onClose(); }} />}
                    <button type="button" className="nf-mini nf-zc-x" onClick={onClose}>{ask ? "Decide later" : "Dismiss"}</button>
                </div>
            </div>
        </div>,
        host,
    );
}
