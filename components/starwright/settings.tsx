"use client";

// Starwright settings and the welcome-back card. Settings live in lib/starwright/settings.ts (kept in this browser, apart from
// the save). The block sits in the Menu; the card shows what the star did while you were away. Styles: app/camino/starwright-qol.css.
import { useEffect, useState } from "react";
import "@/app/camino/starwright-qol.css";
import { AUTO_NOVA_STEPS, AUTO_VISITOR_STEPS, UNLOCKS, cycle, getSettings, onSettings, setSettings, unlocked, type Settings } from "@/lib/starwright/settings";
import type { State } from "@/lib/starwright/engine";
import { readBackup, writeBackup } from "@/lib/starwright/session";
import { fmtAge } from "@/lib/starwright/engine";

/** The current settings, re-read when the console or the menu changes them. */
export function useSettings(): Settings {
    const [v, setV] = useState<Settings>(() => getSettings());
    useEffect(() => onSettings(() => setV(getSettings())), []);
    return v;
}

function Row({ label, tip, value, onClick, locked, children }: { label: string; tip: string; value: string; onClick?: () => void; locked?: string; children?: never }) {
    return (
        <li className="sw-setrow" data-locked={locked ? "" : undefined}>
            <span className="sw-setname" data-tip={`${label}|${tip}`}>{label}</span>
            {locked ? (
                <span className="sw-setlock">{locked}</span>
            ) : (
                <button type="button" className="sw-tog" onClick={onClick} aria-label={`${label}: ${value}. Press to change.`}>{value}</button>
            )}
        </li>
    );
}

function BackupRow({ s }: { s: State }) {
    const [msg, setMsg] = useState("");
    const [at, setAt] = useState<number | null>(null);
    useEffect(() => { setAt(readBackup(window.localStorage)?.savedAt ?? null); }, []);
    const label = msg || "Back up now";
    return (
        <Row
            label="Backup"
            tip="Keeps a copy of this star in this browser, for sw restore. One is also kept before a neutron star, a black hole, an import or a reset, and every 10 minutes."
            value={at && !msg ? `${label} · last ${fmtAge((Date.now() - at) / 1000)} ago` : label}
            onClick={() => { const ok = writeBackup(window.localStorage, s, true); setMsg(ok ? "Saved" : "Browser refused"); if (ok) setAt(Date.now()); window.setTimeout(() => setMsg(""), 2500); }}
        />
    );
}

export function SettingsBlock({ s }: { s: State }) {
    const v = useSettings();
    const nova = unlocked(s, "autoNova");
    const vis = unlocked(s, "autoVisitor");
    return (
        <div className="sw-set">
            <h3 className="sw-h3">Settings</h3>
            <ul>
                <Row label="Scene" tip="Full draws the whole art at 30 frames a second. Simple draws 15 and is lighter on slow machines." value={v.fx === "full" ? "Full" : "Simple"} onClick={() => setSettings({ fx: v.fx === "full" ? "simple" : "full" })} />
                <Row label="Notices" tip="The little notes over the scene: ignitions, milestones, visitors." value={v.notices ? "On" : "Off"} onClick={() => setSettings({ notices: !v.notices })} />
                <Row label="Welcome back" tip="A card with what the star did while you were away." value={v.welcome ? "On" : "Off"} onClick={() => setSettings({ welcome: !v.welcome })} />
                <Row
                    label="Auto supernova"
                    tip="Goes supernova by itself once the core passes this share of its collapse. Waiting longer seeds more stardust."
                    value={v.autoNova ? `At ${v.autoNova * 100}%` : "Off"}
                    onClick={() => setSettings({ autoNova: cycle(AUTO_NOVA_STEPS, v.autoNova) })}
                    locked={nova ? undefined : `${UNLOCKS.autoNova.need} (${Math.min(10, s.novasAll)}/10)`}
                />
                <Row
                    label="Auto visitors"
                    tip="Answers a waiting visitor for you: the lump of output, or the timed boost."
                    value={v.autoVisitor === "off" ? "Off" : v.autoVisitor === "lump" ? "Lump" : "Boost"}
                    onClick={() => setSettings({ autoVisitor: cycle(AUTO_VISITOR_STEPS, v.autoVisitor) })}
                    locked={vis ? undefined : `${UNLOCKS.autoVisitor.need} (${Math.min(12, s.visitors)}/12)`}
                />
                <BackupRow s={s} />
            </ul>
        </div>
    );
}

/** A card over the scene: what the star did while you were away, or a problem with the save. Clicking it, or Esc, dismisses it. */
export function AwayCard({ title, lines, onClose }: { title: string; lines: string[]; onClose: () => void }) {
    return (
        <button type="button" className="sw-away sw-away2 sw-panel" onClick={onClose} aria-label={`${title}. Dismiss.`}>
            <b>{title}</b>
            {lines.map((x, i) => <span key={i} className="sw-away-line">{x}</span>)}
            <span className="sw-away-x">dismiss</span>
        </button>
    );
}

const HINT_KEY = "sw-hint-v1";

/** On a phone the star is pinned on top and the ladder sits below the fold. Shows a small cue once, until the player scrolls. */
export function ScrollHint() {
    const [on, setOn] = useState(false);
    useEffect(() => {
        const root = document.querySelector<HTMLElement>(".sw-root");
        let seen = false;
        try { seen = !!window.localStorage.getItem(HINT_KEY); } catch { /* private mode */ }
        if (!root || seen || !window.matchMedia("(max-width: 900px) and (pointer: coarse)").matches) return;
        const done = () => {
            setOn(false);
            try { window.localStorage.setItem(HINT_KEY, "1"); } catch { /* private mode */ }
            root.removeEventListener("scroll", done);
        };
        const show = window.setTimeout(() => setOn(true), 2500);
        const hide = window.setTimeout(done, 12000);
        root.addEventListener("scroll", done, { passive: true });
        return () => { window.clearTimeout(show); window.clearTimeout(hide); root.removeEventListener("scroll", done); };
    }, []);
    if (!on) return null;
    return <div className="sw-hint2" aria-hidden="true">Scroll for the ladder<i /></div>;
}
