"use client";
import { uiIconStyle } from "@/lib/automation/icons/ui";

// Small extras around the Brasswork stage: photo mode (P), the key sheet (?) and the welcome-back report. They sit on
// top of the HUD and use the brass kit's bw-* classes. The host passes in a snapshot function and the away report.
import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/brasswork-art";
import { Codex } from "./codex";
import "./extras.css";
import { tipAttr } from "@/components/brasswork-ui/tip";
import { useCoarsePointer } from "@/components/automation/use-coarse-pointer";

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
    // On touch the Tools tap opens its menu; a tap tag there would cover the first rows, so it is left off.
    const coarse = useCoarsePointer();
    const [sheet, setSheet] = useState(false);
    const [codex, setCodex] = useState(false);
    const [toolsOpen, setToolsOpen] = useState(false);
    const toolsRef = useRef<HTMLDivElement>(null);
    // The Tools panel closes on Escape and on any click or tap outside it.
    useEffect(() => {
        if (!toolsOpen) return;
        const onDown = (e: PointerEvent) => {
            if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) setToolsOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setToolsOpen(false);
        };
        window.addEventListener("pointerdown", onDown);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("pointerdown", onDown);
            window.removeEventListener("keydown", onKey);
        };
    }, [toolsOpen]);
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
            } else if (e.key === "c" || e.key === "C") setCodex(true); // the codex closes itself on C or Escape, so its exit plays
            else if (e.key === "l" || e.key === "L") onMood(MOODS[(MOODS.indexOf(mood) + 1) % MOODS.length]);
            else if (e.key === "h" || e.key === "H") setSheet((s) => !s);
            else if (e.key === "Escape") {
                setSheet(false);
                setReport(null);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [photo, mood, onMood]);

    return (
        <>
            {/* One Tools button replaces the four separate icon buttons. Each row says what it does in plain words. */}
            <div className="bx-tools" ref={toolsRef}>
                <button
                    type="button"
                    className="bw-btn bx-btn bx-tools-toggle"
                    aria-expanded={toolsOpen}
                    {...(coarse ? {} : tipAttr({ title: "Tools", tag: "Menu", text: "Take a photo, open the machine guide, or read the keyboard shortcuts." }))}
                    onClick={() => setToolsOpen((v) => !v)}
                >
                    <span className="bx-lbl">Tools</span>
                </button>
                {toolsOpen && (
                    <div className="bx-tools-menu" role="menu" aria-label="Tools">
                        <button type="button" role="menuitem" className="bx-tools-item" {...tipAttr({ title: "Take a photo", tag: "Tools", text: "Save a picture of the island as it looks now." })} onClick={() => { setToolsOpen(false); photo(); }}>
                            Take a photo <kbd>P</kbd>
                        </button>
                        <button type="button" role="menuitem" className="bx-tools-item" {...tipAttr({ title: "Machine guide", tag: "Tools", text: "Every machine and belt, what it makes and what it takes." })} onClick={() => { setToolsOpen(false); setCodex(true); }}>
                            Machine guide <kbd>C</kbd>
                        </button>
                        <button type="button" role="menuitem" className="bx-tools-item" {...tipAttr({ title: "Keyboard shortcuts", tag: "Tools", text: "The keys for tools, camera and undo." })} onClick={() => { setToolsOpen(false); setSheet(true); }}>
                            Keyboard shortcuts <kbd>H</kbd>
                        </button>
                    </div>
                )}
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
                            <EmptyState scene="idle">Nothing came off the belts. Check that your drills have power and a belt to the hub.</EmptyState>
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
