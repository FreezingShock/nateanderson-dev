"use client";

// A short, skippable first-run guide. It follows the factory's own state, so a finished step ticks itself off.
// It never blocks play: the panel is a corner card, and skipping or finishing it remembers the choice.
import { useEffect, useState } from "react";
import type { HudData } from "@/lib/automation/types";
import { firstRunSteps, readFirstRunDone, writeFirstRunDone } from "@/lib/brasswork/first-run";
import "./first-run.css";

export function FirstRunGuide({ data }: { data: HudData }) {
    const [done, setDone] = useState<boolean | null>(null);
    const [minimised, setMinimised] = useState(false);

    useEffect(() => {
        setDone(readFirstRunDone());
        // Phones start folded to a tab so the stage keeps most of the screen.
        if (window.matchMedia("(max-width: 600px)").matches) setMinimised(true);
    }, []);

    // Once every step is done, remember it and close the guide without a fanfare.
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
    const finish = () => {
        writeFirstRunDone();
        setDone(true);
    };

    if (minimised) {
        return (
            <button type="button" className="bw-guide-tab" onClick={() => setMinimised(false)} aria-expanded={false}>
                Guide {current + 1}/{steps.length}
            </button>
        );
    }

    return (
        <section className="bw-guide" aria-label="First-run guide">
            <header className="bw-guide-head">
                <span className="bw-guide-count">
                    Step {current + 1} of {steps.length}
                </span>
                <button type="button" className="bw-guide-link" onClick={() => setMinimised(true)}>
                    Minimise
                </button>
                <button type="button" className="bw-guide-link" onClick={finish}>
                    Skip guide
                </button>
            </header>
            <ol className="bw-guide-steps" aria-label="Steps">
                {steps.map((s, i) => (
                    <li key={s.id} data-state={s.done ? "done" : i === current ? "current" : "todo"}>
                        <span className="bw-guide-mark" aria-hidden="true">
                            {s.done ? "✓" : i + 1}
                        </span>
                        <span>{s.title}</span>
                    </li>
                ))}
            </ol>
            <p className="bw-guide-hint">{step.hint}</p>
        </section>
    );
}
