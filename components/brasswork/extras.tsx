"use client";
import { uiIconStyle } from "@/lib/automation/icons/ui";

// Small extras around the Brasswork stage: photo mode (P), the key sheet (?) and the welcome-back report. They sit on
// top of the HUD and use the brass kit's bw-* classes. The host passes in a snapshot function and the away report.
import { useCallback, useEffect, useState } from "react";
import { Codex } from "./codex";
import "./extras.css";

export const MOODS = ["Auto", "Day", "Dusk", "Night"] as const;
export type Mood = (typeof MOODS)[number];

export type AwayReport = { seconds: number; gains: { name: string; amount: number }[] };

const KEYS: { group: string; rows: [string, string][] }[] = [
    {
        group: "Building",
        rows: [
            ["1 to 9", "Pick a machine from the palette"],
            ["Click or drag", "Place; drag lays a run of belt"],
            ["R", "Rotate the ghost"],
            ["X", "Switch to delete mode"],
            ["Delete", "Remove what you hover"],
            ["Ctrl+Z / Ctrl+Y", "Undo and redo"],
            ["Esc", "Cancel the tool"],
        ],
    },
    {
        group: "Camera",
        rows: [
            ["Drag", "Orbit"],
            ["W A S D", "Pan across the floor (hold)"],
            ["Arrow keys", "Pan across the floor"],
            ["+ and -", "Zoom"],
            ["T", "Top-down view"],
            ["Space (held)", "Drag to pan"],
        ],
    },
    {
        group: "Other",
        rows: [
            ["P", "Photo of the island"],
            ["C", "Machine codex"],
            ["L", "Cycle the light: auto, day, dusk, night"],
            ["H", "This sheet"],
        ],
    },
];

const typing = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
};

const fmtAway = (s: number) => {
    const m = Math.round(s / 60);
    if (m < 60) return `${Math.max(1, m)} min`;
    const h = Math.floor(m / 60);
    return h >= 24 ? `${Math.floor(h / 24)} d ${h % 24} h` : `${h} h ${m % 60} min`;
};
const fmtN = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));

export function BrassworkExtras({ snapshot, away, mood, onMood }: { snapshot: () => string | null; away: AwayReport | null; mood: Mood; onMood: (m: Mood) => void }) {
    const [sheet, setSheet] = useState(false);
    const [codex, setCodex] = useState(false);
    const [flash, setFlash] = useState(0);
    const [report, setReport] = useState<AwayReport | null>(away);
    useEffect(() => setReport(away), [away]);

    const photo = useCallback(() => {
        const url = snapshot();
        if (!url) return;
        const a = document.createElement("a");
        a.href = url;
        a.download = `brasswork-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
        a.click();
        setFlash((n) => n + 1);
    }, [snapshot]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key === "p" || e.key === "P") {
                if (!e.repeat) photo();
            } else if (e.key === "c" || e.key === "C") setCodex((c) => !c);
            else if (e.key === "l" || e.key === "L") onMood(MOODS[(MOODS.indexOf(mood) + 1) % MOODS.length]);
            else if (e.key === "h" || e.key === "H") setSheet((s) => !s);
            else if (e.key === "Escape") {
                setSheet(false);
                setCodex(false);
                setReport(null);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [photo, mood, onMood]);

    return (
        <>
            <div className="bx-tools">
                <button type="button" className="bw-btn bx-btn" onClick={photo} title="Photo (P)" aria-label="Take a photo of the island">
                    <span className="ab-ico bx-ico" style={uiIconStyle("photo", 20)} aria-hidden="true" />
                    <span className="bx-lbl">Photo</span>
                </button>
                <button type="button" className="bw-btn bx-btn" onClick={() => onMood(MOODS[(MOODS.indexOf(mood) + 1) % MOODS.length])} title="Light (L)" aria-label={`Light: ${mood}. Click to change`}>
                    <span className="ab-ico bx-ico" style={uiIconStyle("light", 20)} aria-hidden="true" />
                    <span className="bx-lbl">Light: {mood}</span>
                </button>
                <button type="button" className="bw-btn bx-btn" onClick={() => setCodex(true)} title="Codex (C)" aria-label="Open the machine codex">
                    <span className="ab-ico bx-ico" style={uiIconStyle("codex", 20)} aria-hidden="true" />
                    <span className="bx-lbl">Codex</span>
                </button>
                <button type="button" className="bw-btn bx-btn" onClick={() => setSheet(true)} title="Keys (H)" aria-label="Show keys">
                    <span className="ab-ico bx-ico" style={uiIconStyle("keys", 20)} aria-hidden="true" />
                    <span className="bx-lbl">Keys</span>
                </button>
            </div>
            {codex && <Codex onClose={() => setCodex(false)} />}
            {flash > 0 && <div key={flash} className="bx-flash" aria-hidden />}
            {sheet && (
                <div className="bx-scrim" onClick={() => setSheet(false)}>
                    <div className="bx-card" role="dialog" aria-label="Keys" onClick={(e) => e.stopPropagation()}>
                        <h2 className="bw-title">Keys</h2>
                        {KEYS.map((g) => (
                            <section key={g.group}>
                                <h3 className="bx-h">{g.group}</h3>
                                {g.rows.map(([k, label]) => (
                                    <div className="bw-row" key={k}>
                                        <span className="bx-key">{k}</span>
                                        <span>{label}</span>
                                    </div>
                                ))}
                            </section>
                        ))}
                        <button type="button" className="bw-btn" onClick={() => setSheet(false)}>
                            Close
                        </button>
                    </div>
                </div>
            )}
            {report && (
                <div className="bx-scrim" onClick={() => setReport(null)}>
                    <div className="bx-card" role="dialog" aria-label="Welcome back" onClick={(e) => e.stopPropagation()}>
                        <h2 className="bw-title">While you were away</h2>
                        <p className="bx-lead">The workshop kept running for {fmtAway(report.seconds)}.</p>
                        {report.gains.length ? (
                            report.gains.map((g) => (
                                <div className="bw-row" key={g.name}>
                                    <span>{g.name}</span>
                                    <span className="bx-key">+{fmtN(g.amount)}</span>
                                </div>
                            ))
                        ) : (
                            <p className="bx-lead">Nothing came off the belts. Check that your drills have power and a belt to the hub.</p>
                        )}
                        <button type="button" className="bw-btn" onClick={() => setReport(null)}>
                            Back to work
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
