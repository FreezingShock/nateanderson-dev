"use client";

import { useEffect, useRef, useState } from "react";
import { codeReveal } from "@/lib/nodefarm/cx";
import { scrambleNow } from "@/lib/motion/engine";
import { createPortal } from "react-dom";
import { sfx } from "@/lib/sound/sounds";
import { MATS, fmt, fmtTime, statDef, type StatId } from "@/lib/nodefarm/engine";
import { NfIcon } from "./icon";
import type { SysGroup } from "@/lib/nodefarm/offline";

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
    /** what the scripts, Drones, rigs, Lab and zone events did meanwhile */
    sys: SysGroup[];
}

const ORDER: StatId[] = ["bytes", ...MATS];
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
        codeReveal(panel.current, { dir: "in", style: "crt", rows: "[data-cx-i]", sound: false, ms: 420 });
        wrap.current?.querySelectorAll<HTMLElement>(".nf-aw-bar [data-cx-scr]").forEach((t) => scrambleNow(t));
        return () => {
            html.style.overflow = prev;
            back.current?.focus?.();
        };
    }, [host]);

    const done = p >= 1;
    const skip = () => setP(1);
    // closing deletes the panel out (code reveal), fades the backdrop, then hands back to the game
    const panel = useRef<HTMLElement>(null);
    const wrap = useRef<HTMLDivElement>(null);
    const leaving = useRef(false);
    const close = () => {
        if (leaving.current) return;
        leaving.current = true;
        sfx("nfBuy", { tier: 3 });
        wrap.current?.setAttribute("data-out", "");
        codeReveal(panel.current, { dir: "out", style: "crt", rows: "[data-cx-i]" }).then(onClose);
    };

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
            ref={wrap}
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
                <span><span className="sr-only">naOS // node.farm // standby report</span><span aria-hidden="true" data-cx-scr="">naOS // node.farm // standby report</span></span>
                <span className="nf-aw-bar-r">{away.capped ? "WINDOW FULL" : "LINK RESTORED"}</span>
            </div>

            <div className="nf-aw-body">
                <section className="nf-aw-panel" ref={panel}>
                    <i className="nf-aw-br" aria-hidden="true" />
                    <p className="nf-aw-kicker" data-cx-i="0">Link lost · node held on standby</p>
                    <h2 id="nf-aw-title" className="nf-aw-title" data-cx-i="1">While you were gone</h2>
                    <p className="nf-aw-time" aria-hidden="true" data-cx-i="2">{fmtTime(away.secs * p)}</p>
                    <p id="nf-aw-sum" className="nf-aw-sum" data-cx-i="3">
                        {fmtTime(away.secs)} banked{away.capped ? `. You were away ${fmtTime(away.gap)}, but standby holds ${fmtTime(away.cap)}.` : "."}
                        {" "}{rows.map((id) => `${fmt(away.gain[id])} ${statDef(id).name}`).join(", ")} collected.{away.sys.length ? ` ${away.sys.map((g) => `${g.title}: ${g.lines.map((l) => `${l.label} ${l.value}`).join(", ")}`).join(". ")}.` : ""}
                    </p>

                    <div className="nf-aw-meter" aria-hidden="true" data-cx-i="4">
                        <div className="nf-aw-meter-h"><span>Standby window</span><span>{fmtTime(away.secs)} / {fmtTime(away.cap)}</span></div>
                        <div className="nf-aw-track"><i style={{ width: `${fill * p * 100}%` }} /></div>
                    </div>

                    <ul className="nf-aw-gain" aria-hidden="true" data-cx-i="5">
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

                    <dl className="nf-aw-facts" data-cx-i="6">
                        {rate > 0 && <div><dt>Avg rate</dt><dd>{fmt(rate)} Bytes/s</dd></div>}
                                                <div><dt>Away</dt><dd>{fmtTime(away.gap)}</dd></div>
                        <div><dt>Window</dt><dd>{fmtTime(away.cap)}</dd></div>
                    </dl>

                    {away.sys.length > 0 && (
                        <div className="nf-aw-sys" data-cx-i="7">
                            {away.sys.map((g) => (
                                <section key={g.id} aria-label={g.title}>
                                    <h3>{g.title}</h3>
                                    <dl>{g.lines.map((l) => <div key={l.label}><dt>{l.label}</dt><dd>{l.value}</dd></div>)}</dl>
                                </section>
                            ))}
                        </div>
                    )}

                    {away.capped && <p className="nf-aw-note" data-cx-i="7">Standby was full for {fmtTime(away.gap - away.cap)}. Standby cells in Ascend add 4 hours each.</p>}

                    <button ref={btn} type="button" className="nf-aw-go" data-cx-i="7" onClick={(e) => { e.stopPropagation(); if (done) close(); else skip(); }}>
                        {done ? "Collect and resume" : "Skip"}
                    </button>
                </section>
            </div>
        </div>,
        host,
    );
}
