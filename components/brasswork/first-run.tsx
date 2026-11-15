"use client";

// The starter quest. Its state lives in useFirstRunQuest (the host calls it and passes the result to the HUD). The
// HUD owns where the scroll sits: it opens from a Quest button in the build dock, one section at a time. The scroll
// unrolls on open and rolls back up on close. Finishing or skipping it writes the done flag, so it never returns.
import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { HudData } from "@/lib/automation/types";
import { iconStyle } from "@/lib/automation/icons";
import { firstRunSteps, readFirstRunDone, writeFirstRunDone, type FirstRunStep } from "@/lib/brasswork/first-run";
import { openHubMenu } from "@/components/automation/hub-menu";
import "./quest-scroll.css";
import { tipAttr } from "@/components/brasswork-ui/tip";

export type QuestState = {
    steps: FirstRunStep[];
    /** Index of the first unfinished step. */
    current: number;
    finished: number;
    /** Ends the quest for good (Skip). */
    onFinish: () => void;
};

const STEP_ICON: Record<string, string> = { drill: "drill", kiln: "kiln", belt: "belt", delivery: "hub" };

/**
 * Tracks the starter quest against the factory's state. Returns null when there is no quest to show: it has not
 * loaded yet, it was finished before, or every step is already done (in which case it is marked done).
 */
export function useFirstRunQuest(data: HudData): QuestState | null {
    const [done, setDone] = useState<boolean | null>(null);

    useEffect(() => {
        setDone(readFirstRunDone());
    }, []);

    const steps = firstRunSteps(data);
    const current = steps.findIndex((s) => !s.done);
    const allDone = current === -1;

    useEffect(() => {
        if (allDone && done === false) {
            writeFirstRunDone();
            setDone(true);
        }
    }, [allDone, done]);

    const onFinish = useCallback(() => {
        writeFirstRunDone();
        setDone(true);
    }, []);

    if (done !== false || allDone) return null;
    return { steps, current, finished: steps.filter((s) => s.done).length, onFinish };
}

/** The parchment scroll. `closing` plays the roll-up; `onClose` is called on Escape and the Roll up button. */
export function QuestScroll({ quest, closing, onClose }: { quest: QuestState; closing: boolean; onClose: () => void }) {
    useEffect(() => {
        if (closing) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [closing, onClose]);

    const { steps, current, finished, onFinish } = quest;
    const step = steps[Math.max(current, 0)];
    const total = steps.length;

    return (
        <section className="ab-quest" data-closing={closing ? "true" : undefined} aria-label="Starter quest">
            <div className="ab-quest-roll" aria-hidden="true" />
            <div className="ab-quest-paper">
                <header className="ab-quest-head">
                    <span className="ab-quest-title">Starter quest</span>
                    <span className="ab-quest-count">{finished} of {total} done</span>
                </header>

                <div className="ab-quest-bar" role="img" aria-label={`${finished} of ${total} quests done`}>
                    {steps.map((s) => (
                        <span key={s.id} data-done={s.done} />
                    ))}
                </div>

                <div className="ab-quest-now">
                    <span className="ab-quest-seal" aria-hidden="true">
                        <span style={iconStyle(STEP_ICON[step.id] ?? step.id, 36) as CSSProperties} />
                    </span>
                    <div className="ab-quest-copy">
                        <span className="ab-quest-label">Now</span>
                        <strong className="ab-quest-step">{step.title}</strong>
                        <span className="ab-quest-hint">{step.hint}</span>
                    </div>
                </div>

                <ol className="ab-quest-list" aria-label="All quests">
                    {steps.map((s, i) => (
                        <li key={s.id} data-state={s.done ? "done" : i === current ? "current" : "todo"}>
                            <span className="ab-quest-mark" aria-hidden="true">{s.done ? "✓" : i + 1}</span>
                            <span>{s.title}</span>
                        </li>
                    ))}
                </ol>

                <footer className="ab-quest-actions">
                    <button type="button" className="ab-quest-btn ab-quest-btn-quiet" {...tipAttr({ title: "Skip quest", tag: "Scroll", text: "Put the starter steps away for good. Everything else still works the same." })} onClick={onFinish}>Skip quest</button>
                    {step.id === "delivery" && current >= 0 && (
                        <button
                            type="button"
                            className="ab-quest-btn"
                            {...tipAttr({ title: "Open hub", tag: "Scroll", text: "The hub is where delivered items go. Its requests unlock the next machines." })}
                            onClick={() => { onClose(); openHubMenu(); }}
                        >
                            Open hub
                        </button>
                    )}
                    <button type="button" className="ab-quest-btn" onClick={onClose}>Roll up</button>
                </footer>
            </div>
            <div className="ab-quest-roll" aria-hidden="true" />
        </section>
    );
}
