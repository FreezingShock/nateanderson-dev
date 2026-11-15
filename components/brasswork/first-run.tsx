"use client";

// The starter quest tracker. It follows the factory's own state, so a finished quest ticks itself off. It sits in the
// stage corner, folds to a tab, hides while a drawer or sheet is open, and never blocks play.
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { HudData } from "@/lib/automation/types";
import { iconStyle } from "@/lib/automation/icons";
import { firstRunSteps, readFirstRunDone, writeFirstRunDone } from "@/lib/brasswork/first-run";
import "./first-run.css";

const STEP_ICON: Record<string, string> = { drill: "drill", kiln: "kiln", belt: "belt", delivery: "hub" };

export function FirstRunGuide({ data }: { data: HudData }) {
    const [done, setDone] = useState<boolean | null>(null);
    // Starts folded to a one-line strip on every screen, so the island stays in view. Opening it shows the full list.
    const [folded, setFolded] = useState(true);

    useEffect(() => {
        setDone(readFirstRunDone());
    }, []);

    // Escape folds the expanded list back to its strip, so the stage is never left covered by accident.
    useEffect(() => {
        if (folded) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFolded(true); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [folded]);

    const steps = firstRunSteps(data);
    const current = steps.findIndex((s) => !s.done);
    const allDone = current === -1;

    useEffect(() => {
        if (allDone && done === false) {
            writeFirstRunDone();
            setDone(true);
        }
    }, [allDone, done]);

    if (done !== false || allDone) return null;

    const step = steps[current];
    const finished = steps.filter((s) => s.done).length;
    const finish = () => {
        writeFirstRunDone();
        setDone(true);
    };

    if (folded) {
        return (
            <button type="button" className="bw-quest-tab" onClick={() => setFolded(false)} aria-expanded={false} aria-label={`Starter quest, ${finished} of ${steps.length} done. Now: ${step.title}. Open list`}>
                <span className="bw-quest-tab-label">Starter quest</span>
                <span className="bw-quest-tab-count">{finished}/{steps.length}</span>
                <span className="bw-quest-tab-step">{step.title}</span>
            </button>
        );
    }

    return (
        <section className="bw-quest" aria-label="Starter quest">
            <header className="bw-quest-head">
                <span className="bw-quest-title">Starter quest</span>
                <span className="bw-quest-count">{finished}/{steps.length}</span>
            </header>

            <div className="bw-quest-bar" role="img" aria-label={`${finished} of ${steps.length} quests done`}>
                {steps.map((s) => (
                    <span key={s.id} data-done={s.done} />
                ))}
            </div>

            <div className="bw-quest-now">
                <span className="bw-quest-icon" aria-hidden="true">
                    <span style={iconStyle(STEP_ICON[step.id] ?? step.id, 40) as CSSProperties} />
                </span>
                <div className="bw-quest-copy">
                    <span className="bw-quest-label">Now</span>
                    <strong className="bw-quest-step">{step.title}</strong>
                    <span className="bw-quest-hint">{step.hint}</span>
                </div>
            </div>

            <ol className="bw-quest-list" aria-label="All quests">
                {steps.map((s, i) => (
                    <li key={s.id} data-state={s.done ? "done" : i === current ? "current" : "todo"}>
                        <span className="bw-quest-mark" aria-hidden="true">{s.done ? "✓" : i + 1}</span>
                        <span>{s.title}</span>
                    </li>
                ))}
            </ol>

            <footer className="bw-quest-actions">
                <button type="button" className="bw-quest-btn" onClick={() => setFolded(true)}>Minimise</button>
                <button type="button" className="bw-quest-btn" onClick={finish}>Skip</button>
            </footer>
        </section>
    );
}
