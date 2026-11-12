"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

// Shared parts for the older Node Farm windows (Map, Goals, Records, Menu), rebuilt 2026-11-12 to the Ascend window's level:
// an art banner with a code readout on top, sections in corner-bracket frames, and dotted `key ..... value` data lines.
// Art: public/naos/nodefarm/win-<art>.webp (scripts/naos-art/nodefarm-window-art.py). Styles: app/camino/nodefarm-windows.css (nf-wk*).

export type WinArt = "map" | "goals" | "records" | "menu";

/** The banner at the top of a window: dithered art standing on a halftone floor, a code readout at the left and an
 *  optional big figure at the right. */
export function WinBanner({ art, color, readout, big, bigLabel }: { art: WinArt; color: string; readout: [string, ReactNode][]; big?: ReactNode; bigLabel?: string }) {
    return (
        <header className="nf-wk-ban" data-art={art} data-cx-i="0" style={{ ["--c" as string]: color } as CSSProperties}>
            <span className="nf-wk-art" aria-hidden="true"><i /></span>
            <span className="nf-wk-scan" aria-hidden="true" />
            <dl className="nf-wk-code">
                {readout.map(([k, v], i) => (
                    <div key={k}>{i === 0 ? <dt className="nf-wk-path">{k}</dt> : <dt>{k}</dt>}<dd>{v}</dd></div>
                ))}
            </dl>
            {big !== undefined && (
                <p className="nf-wk-big">
                    <b>{big}</b>
                    {bigLabel && <span>{bigLabel}</span>}
                </p>
            )}
        </header>
    );
}

/** A section in a corner-bracket frame, with a mono path line as its heading. */
export function Frame({ path, title, note, color, i, className = "", children, aside }: { path: string; title?: string; note?: ReactNode; color?: string; i?: number; className?: string; children: ReactNode; aside?: ReactNode }) {
    return (
        <section className={`nf-wk-fr ${className}`.trim()} data-cx-i={i} style={color ? ({ ["--c" as string]: color } as CSSProperties) : undefined}>
            <header className="nf-wk-fh">
                <span className="nf-wk-p">{path}</span>
                {title && <h3>{title}</h3>}
                {aside && <span className="nf-wk-fa">{aside}</span>}
            </header>
            {note && <p className="nf-wk-note">{note}</p>}
            {children}
        </section>
    );
}

/** Plain data lines with a dotted leader between key and value. */
export function DataLines({ rows, className = "" }: { rows: [string, ReactNode][]; className?: string }) {
    return (
        <dl className={`nf-wk-dl ${className}`.trim()}>
            {rows.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><i aria-hidden="true" /><dd>{v}</dd></div>
            ))}
        </dl>
    );
}

/** Press and hold to confirm (same feel as Hold to Ascend). A click with no press behind it (screen readers, keyboard
 *  without hold) falls back to two clicks: the first arms it, the second within 4 s fires. */
export function HoldButton({ ms = 1600, label, holding, armed, onFire, className = "" }: { ms?: number; label: string; holding: string; armed: string; onFire: () => void; className?: string }) {
    const [hold, setHold] = useState(false);
    const [arm, setArm] = useState(false);
    const t = useRef<number | undefined>(undefined);
    const armT = useRef<number | undefined>(undefined);
    const fired = useRef(false);
    const pressed = useRef(false);
    const stop = () => {
        window.clearTimeout(t.current);
        t.current = undefined;
        setHold(false);
    };
    const start = () => {
        if (t.current) return;
        fired.current = false;
        setHold(true);
        t.current = window.setTimeout(() => {
            fired.current = true;
            stop();
            setArm(false);
            onFire();
        }, ms);
    };
    useEffect(() => () => { window.clearTimeout(t.current); window.clearTimeout(armT.current); }, []);
    return (
        <button
            type="button"
            className={`nf-wk-hold ${className}`.trim()}
            data-hold={hold ? "" : undefined}
            data-armed={arm ? "" : undefined}
            style={{ ["--hold" as string]: `${ms}ms` } as CSSProperties}
            onPointerDown={(e) => { if (e.button === 0) { pressed.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); start(); } }}
            onPointerUp={() => { if (t.current) stop(); }}
            onPointerCancel={() => stop()}
            onLostPointerCapture={() => { if (t.current) stop(); }}
            onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); pressed.current = true; start(); } }}
            onKeyUp={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (t.current) stop(); } }}
            onBlur={() => { if (t.current) stop(); }}
            onContextMenu={(e) => e.preventDefault()}
            onClick={(e) => {
                const viaPress = pressed.current;
                pressed.current = false;
                if (viaPress || e.detail !== 0 || fired.current) return;
                if (arm) { setArm(false); onFire(); return; }
                setArm(true);
                window.clearTimeout(armT.current);
                armT.current = window.setTimeout(() => setArm(false), 4000);
            }}
        >
            <i className="nf-wk-hold-fill" aria-hidden="true" />
            <span>{hold ? holding : arm ? armed : label}</span>
        </button>
    );
}
