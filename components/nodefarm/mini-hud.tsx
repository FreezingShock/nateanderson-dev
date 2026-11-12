"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { fmt } from "@/lib/nodefarm/engine";
import { etaText, type Step } from "@/lib/nodefarm/guide";
import { NfIcon } from "./icon";

// A slim readout that appears under the site bar once the real HUD and next-step strip have scrolled away, so the Bytes
// number, the rate and what to do next stay in sight while you work down a long board. Plain data line, sharp edges.
// Styles: app/camino/nodefarm-windows.css (`.nf-mh`). Hidden while any window, the tree, an event or the report is open.
export function MiniHud({ bytes, rate, step, onGo, paused }: { bytes: number; rate: number; step: Step; onGo: () => void; paused: boolean }) {
    const [show, setShow] = useState(false);
    const [host, setHost] = useState<Element | null>(null);
    useEffect(() => {
        let raf = 0;
        const calc = () => {
            raf = 0;
            const hud = document.querySelector(".nf-hud");
            const strip = document.querySelector(".nf-guide");
            const nf = document.querySelector(".nf");
            if (!hud || !strip || !nf) return setShow(false);
            const gone = strip.getBoundingClientRect().bottom < 64;
            const inGame = nf.getBoundingClientRect().bottom > 220;
            // phones: the tab grid is the way around, so never cover it
            const tabs = document.querySelector<HTMLElement>(".nf-tabs");
            const tr = tabs && getComputedStyle(tabs).display !== "none" ? tabs.getBoundingClientRect() : null;
            const tabsInView = !!tr && tr.bottom > 64 && tr.top < window.innerHeight - 100;
            setShow(gone && inGame && !tabsInView);
        };
        const on = () => { if (!raf) raf = requestAnimationFrame(calc); };
        const fs = () => { const f = document.fullscreenElement; setHost(f && f !== document.documentElement ? f : document.body); on(); };
        fs();
        window.addEventListener("scroll", on, { passive: true, capture: true });
        window.addEventListener("resize", on);
        document.addEventListener("fullscreenchange", fs);
        on();
        return () => {
            if (raf) cancelAnimationFrame(raf);
            window.removeEventListener("scroll", on, true);
            window.removeEventListener("resize", on);
            document.removeEventListener("fullscreenchange", fs);
        };
    }, []);
    if (!host) return null;
    const eta = etaText(step.eta);
    const pct = Math.round(step.frac * 100);
    const live = show && !paused;
    return createPortal(
        <div className="ctos nf-ev-host">
            <div className="nf-mh" data-show={live ? "" : undefined} inert={!live} role="status" aria-label="Progress">
                <span className="nf-mh-n"><NfIcon name="bytes" /><b>{fmt(bytes)}</b><small>+{fmt(rate)}/s</small></span>
                <span className="nf-mh-s">
                    <span className="nf-mh-t"><small aria-hidden="true">$ next //</small>{step.title}</span>
                    <em>{step.unit ? `${fmt(step.cur)} / ${fmt(step.need)} ${step.unit}` : `${pct}%`}{eta ? ` · about ${eta}` : ""}</em>
                </span>
                <button type="button" className="nf-mh-go" onClick={onGo}>Show me</button>
                <i className="nf-mh-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></i>
            </div>
        </div>,
        host,
    );
}
