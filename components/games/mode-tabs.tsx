"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { PixelIcon } from "@/components/cm/pixel-icons";
import { cn } from "@/lib/utils";
import { Burst, type Mode } from "@/components/games/guess-kit";

// The Daily / Unlimited switch on both guessers. Two sharp naOS tabs share one
// white block that slides under the active tab. Unlimited shows a padlock until
// a daily has been finished on this device, and a locked tab shakes instead of
// opening. Follows the ARIA tabs pattern: arrow keys move between tabs.

export const MODE_PANEL_ID = "gk-mode-panel";

interface TabDef {
    id: Mode;
    no: string;
    label: string;
    meta: string;
    locked: boolean;
}

export function GuessModeTabs({
    mode,
    unlocked,
    justUnlocked,
    dailyMeta,
    unlimitedMeta,
    onSelect,
}: {
    mode: Mode;
    unlocked: boolean;
    /** True for a few seconds after the daily that opened Unlimited. */
    justUnlocked: boolean;
    dailyMeta: string;
    unlimitedMeta: string;
    onSelect: (next: Mode) => void;
}) {
    const tabs: TabDef[] = [
        { id: "daily", no: "01", label: "Daily", meta: dailyMeta, locked: false },
        {
            id: "unlimited",
            no: "02",
            label: "Unlimited",
            meta: unlocked ? unlimitedMeta : "Finish a daily to open",
            locked: !unlocked,
        },
    ];
    const index = mode === "daily" ? 0 : 1;
    const [nudge, setNudge] = useState<Mode | null>(null);
    const buttons = useRef<Partial<Record<Mode, HTMLButtonElement | null>>>({});

    useEffect(() => {
        if (!nudge) return;
        const id = window.setTimeout(() => setNudge(null), 600);
        return () => window.clearTimeout(id);
    }, [nudge]);

    const activate = (t: TabDef) => {
        if (t.locked) {
            setNudge(t.id);
            return;
        }
        onSelect(t.id);
    };

    const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, at: number) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const next = tabs[(at + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
        buttons.current[next.id]?.focus();
        if (!next.locked) onSelect(next.id);
    };

    return (
        <div role="tablist" aria-label="Game mode" className="gk-tabs">
            <span
                aria-hidden="true"
                className="gk-tabs-ink"
                style={{ transform: `translate3d(${index * 100}%, 0, 0)` }}
            />
            {/* One cyan wipe across the bar when Unlimited opens. */}
            {justUnlocked && <span aria-hidden="true" className="gk-tabs-sweep" />}
            {tabs.map((t, i) => {
                const on = mode === t.id;
                return (
                    <button
                        key={t.id}
                        ref={(el) => {
                            buttons.current[t.id] = el;
                        }}
                        type="button"
                        role="tab"
                        id={`gk-tab-${t.id}`}
                        aria-selected={on}
                        aria-controls={MODE_PANEL_ID}
                        aria-disabled={t.locked || undefined}
                        tabIndex={on ? 0 : -1}
                        onClick={() => activate(t)}
                        onKeyDown={(e) => onKeyDown(e, i)}
                        className={cn(
                            "gk-tab",
                            on && "is-on",
                            t.locked && "is-locked",
                            nudge === t.id && "is-nudge",
                            justUnlocked && t.id === "unlimited" && "is-fresh"
                        )}
                    >
                        <span className="gk-tab-no" aria-hidden="true">
                            {t.no}
                        </span>
                        <span className="gk-tab-name">
                            {t.locked ? (
                                <PixelIcon name="lock" className="size-3.5" />
                            ) : t.id === "unlimited" && justUnlocked ? (
                                // Mounts with the unlock, so the padlock pops open once.
                                <span className="gk-unlock-icon" aria-hidden="true">
                                    <PixelIcon name="unlock" className="size-3.5" />
                                </span>
                            ) : null}
                            {t.label}
                        </span>
                        <span className="gk-tab-meta">{t.meta}</span>
                        {t.id === "unlimited" && justUnlocked && <Burst />}
                    </button>
                );
            })}
        </div>
    );
}
