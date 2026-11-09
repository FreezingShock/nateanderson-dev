"use client";

import { useEffect, useState } from "react";
import { CountUp } from "@/components/cm/reveal";
import { TIMELINE_ICONS } from "@/components/timeline-icons";
import { daysUntil, type TimelineIconName } from "@/lib/timeline-data";

export interface Countdown {
    label: string;
    sublabel: string;
    /** ISO date the countdown runs to. */
    date: string;
    icon: TimelineIconName;
    special?: boolean;
}

// Live "days to go" readouts. The day count is computed in the browser (the page is statically generated, so a
// count baked in at build time would be stale within a day), starting from the server's value so the first
// paint matches, then refreshing every minute.
export function TimelineCountdowns({ items, nowMs }: { items: Countdown[]; nowMs: number }) {
    const [now, setNow] = useState(nowMs);
    useEffect(() => {
        setNow(Date.now());
        const id = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(id);
    }, []);

    return (
        <div className="cm-cols3">
            {items.map((item) => {
                const days = daysUntil(item.date, now);
                const Icon = TIMELINE_ICONS[item.icon];
                return (
                    <div key={item.label} className={`cm-panel tick ${item.special ? "live" : ""}`}>
                        <div className="cm-hbar">
                            <span className={days > 0 && item.special ? "live" : ""}>{item.label}</span>
                            <span>{item.sublabel}</span>
                        </div>
                        <div className="cm-body-pad cm-row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
                            <div>
                                <div className="cm-num big" style={{ fontSize: 44, color: item.special ? "var(--cm-cyan)" : "var(--cm-fg)" }}>
                                    {days > 0 ? <CountUp value={days} /> : days === 0 ? "Today" : "Done"}
                                </div>
                                <div className="cm-lbl">
                                    {days > 0 ? (days === 1 ? "day until" : "days until") : days === 0 ? "it's" : "it happened"}
                                </div>
                            </div>
                            <Icon className="cm-ico" style={{ width: 24, height: 24, color: "var(--cm-dim)" }} aria-hidden="true" />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
