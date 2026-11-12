"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { sfx } from "@/lib/sound/sounds";
import { fmt, fmtTime, statDef, type StatId } from "@/lib/nodefarm/engine";
import { NfIcon } from "./icon";

export interface Away {
    /** seconds actually banked (capped) */
    secs: number;
    /** seconds really spent away */
    gap: number;
    /** the standby window, in seconds */
    cap: number;
    capped: boolean;
    /** buttons the Drones pressed while you were away */
    drones: number;
    gain: Record<string, number>;
}

const ORDER: StatId[] = ["bytes", "copper", "silicon", "quartz", "aether", "runes", "starglass", "voidsteel", "chrono"];
const COUNT_MS = 1500;

/** Full-screen "welcome back" report. Everything is already banked when it opens; Collect only closes it. */
export function AwayReport({ away, era, reduced, onClose }: { away: Away; era: number; reduced: boolean; onClose: () => void }) {
    const [p, setP] = useState(reduced ? 1 : 0);
    const btn = useRef<HTMLButtonElement>(null);
    const back = useRef<HTMLElement | null>(null);
    const [host, setHost] = useState<Element | null>(null);

    useEffect(() => setHost(document.body), []);

    // count everything up together; a tap or key skips to the end
    useEffect(() => {
        if (reduced) return;
        let raf = 0;
        const t0 = performance.now();
        const step = (now: number) => {
            const k = Math.min(1, (now - t0) / COUNT_MS);
            setP(1 - Math.pow(1 - k, 3));
            if (k < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [reduced]);

    // focus, scroll lock, restore (once the portal exists)
    useEffect(() => {
        if (!host) return;
        back.current = document.activeElement as HTMLElement | null;
        btn.current?.focus();
        const html = document.documentElement;
        const prev = html.style.overflow;
        html.style.overflow = "hidden";
        sfx("nfGoal");
        return () => {
            html.style.overflow = prev;
            back.current?.focus?.();
        };
    }, [host]);

    const done = p >= 1;
    const skip = () => setP(1);
    const close = () => { sfx("nfBuy", { tier: 3 }); onClose(); };

    // keys work wherever focus is: Esc closes, Tab stays on the button
    const key = useRef<(e: KeyboardEvent) => void>(() => {});
    key.current = (e) => {
        if (e.key === "Escape") { e.preventDefault(); close(); }
        else if (e.key === "Tab") { e.preventDefault(); btn.current?.focus(); }
        else if (!done && e.key === "Enter") { e.preventDefault(); skip(); }
    };
    useEffect(() => {
        const h = (e: KeyboardEvent) => key.current(e);
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, []);

    const rows = ORDER.filter((id) => (away.gain[id] ?? 0) > 0);
    const rate = away.secs > 0 ? (away.gain.bytes ?? 0) / away.secs : 0;
    const fill = away.cap > 0 ? Math.min(1, away.secs / away.cap) : 1;

    if (!host) return null;
    return createPortal(
        <div
            className="nf-aw"
            data-era={era}
            data-done={done || undefined}
            role="dialog"
            aria-modal="true"
            aria-labelledby="nf-aw-title"
            aria-describedby="nf-aw-sum"
            onClick={() => { if (!done) skip(); }}
        >
            <div className="nf-aw-bar">
                <span>naOS // node.farm // standby report</span>
                <span className="nf-aw-bar-r">{away.capped ? "WINDOW FULL" : "LINK RESTORED"}</span>
            </div>

            <div className="nf-aw-body">
                <section className="nf-aw-panel">
                    <i className="nf-aw-br" aria-hidden="true" />
                    <p className="nf-aw-kicker">Link lost · node held on standby</p>
                    <h2 id="nf-aw-title" className="nf-aw-title">While you were gone</h2>
                    <p className="nf-aw-time" aria-hidden="true">{fmtTime(away.secs * p)}</p>
                    <p id="nf-aw-sum" className="nf-aw-sum">
                        {fmtTime(away.secs)} banked{away.capped ? `. You were away ${fmtTime(away.gap)}, but standby holds ${fmtTime(away.cap)}.` : "."}
                        {" "}{rows.map((id) => `${fmt(away.gain[id])} ${statDef(id).name}`).join(", ")} collected.
                    </p>

                    <div className="nf-aw-meter" aria-hidden="true">
                        <div className="nf-aw-meter-h"><span>Standby window</span><span>{fmtTime(away.secs)} / {fmtTime(away.cap)}</span></div>
                        <div className="nf-aw-track"><i style={{ width: `${fill * p * 100}%` }} /></div>
                    </div>

                    <ul className="nf-aw-gain" aria-hidden="true">
                        {rows.map((id, i) => {
                            const def = statDef(id);
                            return (
                                <li key={id} style={{ ["--c" as string]: def.color, ["--d" as string]: `${i * 90}ms` }}>
                                    <NfIcon name={id as "bytes"} large />
                                    <span className="nf-aw-name">{def.name}</span>
                                    <b>+{fmt(away.gain[id] * p)}</b>
                                </li>
                            );
                        })}
                    </ul>

                    <dl className="nf-aw-facts">
                        {rate > 0 && <div><dt>Avg rate</dt><dd>{fmt(rate)} Bytes/s</dd></div>}
                        {away.drones > 0 && <div><dt>Drone presses</dt><dd>{fmt(away.drones)}</dd></div>}
                        <div><dt>Away</dt><dd>{fmtTime(away.gap)}</dd></div>
                        <div><dt>Window</dt><dd>{fmtTime(away.cap)}</dd></div>
                    </dl>

                    {away.capped && <p className="nf-aw-note">Standby was full for {fmtTime(away.gap - away.cap)}. Standby cells in Ascend add 4 hours each.</p>}

                    <button ref={btn} type="button" className="nf-aw-go" onClick={(e) => { e.stopPropagation(); if (done) close(); else skip(); }}>
                        {done ? "Collect and resume" : "Skip"}
                    </button>
                </section>
            </div>
        </div>,
        host,
    );
}
