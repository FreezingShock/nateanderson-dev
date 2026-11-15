"use client";

// Starwright settings and the welcome-back card. Settings live in lib/starwright/settings.ts (kept in this browser, apart from
// the save). The block sits in the Menu; the card shows what the star did while you were away. Styles: app/camino/starwright-qol.css.
import { useEffect, useState } from "react";
import "@/app/camino/starwright-qol.css";
import { AUTO_NOVA_STEPS, AUTO_VISITOR_STEPS, UNLOCKS, cycle, getSettings, onSettings, setSettings, unlocked, type Settings } from "@/lib/starwright/settings";
import type { State } from "@/lib/starwright/engine";

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
