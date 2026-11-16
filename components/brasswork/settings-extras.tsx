"use client";
// The host-side rows of the Settings window: lighting, and save export / import / leave. Kept out of the HUD because
// they need the host's mood state and the game's save slot.
import Link from "next/link";
import { useRef, useState } from "react";
import { ArtGauge } from "@/components/brasswork-art";
import { Row } from "@/components/automation/settings-window";
import { deserialize } from "@/lib/automation/sim/save";
import { MOODS, type Mood } from "./extras";
import { tipAttr } from "@/components/brasswork-ui/tip";

const SAVE_KEY = "brasswork-save-v1";

export function LightingRow({ mood, onMood }: { mood: Mood; onMood: (m: Mood) => void }) {
    const i = Math.max(0, MOODS.indexOf(mood));
    return (
        <div className="bws-row bws-dialrow">
            <ArtGauge value={i / (MOODS.length - 1)} size={56} label={`Lighting: ${mood}`} />
            <div className="bws-text">
                <span className="bws-name">Lighting</span>
                <span className="bws-hint">Auto follows the clock. Shows live behind this panel.</span>
            </div>
            {/* A range like the volume sliders: one stop per mood, Auto at the left end. */}
            <span className="bwa-range bws-step">
                <input
                    type="range"
                    min={0}
                    max={MOODS.length - 1}
                    step={1}
                    value={i}
                    aria-label="Lighting"
                    aria-valuetext={mood}
                    onChange={(e) => onMood(MOODS[Number(e.target.value)])}
                />
                <output>{mood}</output>
            </span>
        </div>
    );
}

export function SaveRows() {
    const file = useRef<HTMLInputElement>(null);
    const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

    const exportSave = () => {
        window.dispatchEvent(new Event("bw:save")); // the host writes the live world first
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return setMsg({ text: "Nothing to export yet.", bad: true });
            const { text } = JSON.parse(raw) as { text: string };
            const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = `brasswork-save-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setMsg({ text: "Save file downloaded." });
        } catch {
            setMsg({ text: "Could not read the save.", bad: true });
        }
    };

    const importSave = async (f: File | undefined) => {
        if (!f) return;
        try {
            const text = await f.text();
            deserialize(text); // throws on anything that is not a good Brasswork save
            localStorage.setItem(SAVE_KEY, JSON.stringify({ text, savedAt: Date.now() }));
            setMsg({ text: "Save loaded. Reloading..." });
            setTimeout(() => window.location.reload(), 400);
        } catch (e) {
            setMsg({ text: `That file is not a usable save (${e instanceof Error ? e.message : "unknown error"}).`, bad: true });
        }
    };

    return (
        <>
            <Row icon="blueprints" label="Save file" hint="Back up to a file, or load one (replaces this workshop).">
                <span className="bws-actions">
                    <button type="button" className="bws-action" {...tipAttr({ title: "Export save", tag: "Save file", text: "Download this workshop as a file you can keep or move to another browser." })} onClick={exportSave}>Export</button>
                    <button type="button" className="bws-action" {...tipAttr({ title: "Import save", tag: "Save file", text: "Load a save file. It replaces the workshop in this browser." })} onClick={() => file.current?.click()}>Import</button>
                    <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { void importSave(e.target.files?.[0]); e.target.value = ""; }} />
                </span>
                {msg && <span className="bws-msg" data-bad={msg.bad ? "true" : undefined} role="status" style={{ gridColumn: "1 / -1" }}>{msg.text}</span>}
            </Row>
            <Row icon="back" label="Back to games" hint="Leave the workshop. It saves as you go.">
                <Link prefetch={false} href="/creations/games#automation" className="bws-action">Leave workshop</Link>
            </Row>
        </>
    );
}
