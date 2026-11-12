"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { HAND_TUNE, protoDef, ROMAN, type ProtoId } from "@/lib/nodefarm/engine";

/** What the Handover moment shows: who left, what they were paid, who comes in, and the note left on the desk. */
export interface HandCutInfo {
    /** the Handover just done (1 = the first) */
    n: number;
    keys: number;
    /** the protocol the cycle that just ended ran (null on the first Handover), and its rank after this Handover */
    from: ProtoId | null;
    fromRank: number;
    to: ProtoId;
    note: string;
}

const FRAMES = 8;
const STEP = 560; // ms per frame: about 4.5 s in all
// which line of the readout shows on each frame
const BEAT = [0, 0, 0, 1, 2, 2, 3, 3];

/**
 * The Handover moment: a full-screen cut over the game. Art is one 320 x 180 dither sheet of eight frames
 * (public/naos/nodefarm/handover-cut, scripts/naos-art/nodefarm-handover-art.py `cut`): the old operator's desk with the
 * lamp on, the lamp going out, one key held on the screen, then the screen booting for the next operator. A readout
 * types under it. Any click, tap or key skips it; under reduced motion it shows the last frame and closes on its own.
 */
export function HandoverCut({ info, reduced, onDone }: { info: HandCutInfo; reduced: boolean; onDone: () => void }) {
    const [f, setF] = useState(reduced ? FRAMES - 1 : 0);
    const [out, setOut] = useState(false);
    // portalled to <body> (like the offline report) so no transformed ancestor can trap the fixed overlay
    const [host, setHost] = useState<Element | null>(null);
    useEffect(() => setHost(document.body), []);
    const done = useRef(false);
    const skip = useRef<HTMLButtonElement>(null);
    const opened = useRef(typeof performance === "undefined" ? 0 : performance.now());
    const finish = () => {
        if (done.current) return;
        done.current = true;
        setOut(true);
        window.setTimeout(onDone, reduced ? 0 : 380);
    };
    useEffect(() => {
        if (!host) return;
        skip.current?.focus({ preventScroll: true });
    }, [host]);
    useEffect(() => {
        if (reduced) {
            const t = window.setTimeout(finish, 2600);
            return () => window.clearTimeout(t);
        }
        const iv = window.setInterval(() => setF((x) => (x + 1 < FRAMES ? x + 1 : x)), STEP);
        const t = window.setTimeout(finish, STEP * FRAMES + 1100);
        return () => { window.clearInterval(iv); window.clearTimeout(t); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        const t0 = performance.now();
        const onKey = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();
            // a key still held from the hold-to-hand-over button must not skip the cut the moment it opens
            if (e.repeat || performance.now() - t0 < 400) return;
            finish();
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const to = protoDef(info.to);
    const from = info.from ? protoDef(info.from) : null;
    const beat = BEAT[f];
    const lines = [
        { k: "0", c: from?.color ?? "#3dff6e", text: `operator ${String(info.n).padStart(2, "0")} // logging off`, sub: from ? `${from.op}'s protocol ran this cycle${info.fromRank ? `, now rank ${ROMAN[info.fromRank]}${info.fromRank >= HAND_TUNE.rankMax ? " (max)" : ""}` : ""}` : "the first operator's shift is over" },
        { k: "1", c: "#ffc53a", text: "lamp off // tree, AP, perks and Drones wiped", sub: "goals, logs, research and the hangar stay" },
        { k: "2", c: "#ffc53a", text: `+${info.keys} Keys`, sub: "left on the desk for whoever sits down next" },
        { k: "3", c: to.color, text: `operator ${String(info.n + 1).padStart(2, "0")} // logged in`, sub: `${to.op}'s protocol: ${to.name}` },
    ];
    if (!host) return null;
    return createPortal(
        <div className="nf-hcut" data-out={out ? "" : undefined} data-reduced={reduced ? "" : undefined} role="dialog" aria-modal="true" aria-label={`Handover ${info.n}`} onClick={() => { if (performance.now() - opened.current > 400) finish(); }}>
            <div className="nf-hcut-stage" style={{ ["--f" as string]: f, ["--n" as string]: FRAMES } as CSSProperties}>
                <i className="nf-hcut-art" aria-hidden="true" />
                <i className="nf-hcut-scan" aria-hidden="true" />
            </div>
            <div className="nf-hcut-read" aria-live="polite">
                <span className="nf-hcut-k">HANDOVER {String(info.n).padStart(2, "0")}</span>
                {lines.map((l, i) => (
                    <p key={l.k} className="nf-hcut-l" data-on={reduced || i <= beat ? "" : undefined} data-now={!reduced && i === beat ? "" : undefined} style={{ ["--c" as string]: l.c } as CSSProperties}>
                        <b>{l.text}</b>
                        <small>{l.sub}</small>
                    </p>
                ))}
                {info.note && <q className="nf-hcut-note" data-on={reduced || beat >= 2 ? "" : undefined}>{info.note}</q>}
            </div>
            <button ref={skip} type="button" className="nf-hcut-skip" onClick={(e) => { e.stopPropagation(); finish(); }}>Skip</button>
        </div>,
        host,
    );
}
