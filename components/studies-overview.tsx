import { CountUp } from "@/components/cm/reveal";
import { Meter } from "@/components/cm/ui";
import { TimelineCountdowns, type Countdown } from "@/components/timeline-countdowns";
import { courses, AP_WINDOW } from "@/lib/studies-data";
import { KEY_DATES, phases, progressBetween } from "@/lib/timeline-data";

const COUNTDOWNS: Countdown[] = [
    {
        label: "AP Exam Window",
        sublabel: AP_WINDOW.label,
        date: KEY_DATES.apStart,
        icon: "Award",
        special: true,
    },
    {
        label: "Senior Project Presentation",
        sublabel: "Late May 2027",
        date: "2027-05-14",
        icon: "Users",
    },
    {
        label: "Graduation Day",
        sublabel: "June 10, 2027",
        date: KEY_DATES.graduation,
        icon: "GraduationCap",
        special: true,
    },
];

// Server component: the school-year picture at a glance. Dates come from the same source as the Timeline
// page, so the two can never disagree.
export function StudiesOverview({ nowMs }: { nowMs: number }) {
    const hs = phases.find((p) => p.id === "high-school")!;
    const yearPct = Math.round(progressBetween(hs.start, KEY_DATES.graduation, nowMs) * 1000) / 10;
    const apPct = Math.round(progressBetween(hs.start, KEY_DATES.apStart, nowMs) * 1000) / 10;
    const apCount = courses.filter((c) => c.ap).length;

    return (
        <div style={{ display: "grid", gap: "var(--cm-s6)" }}>
            <TimelineCountdowns items={COUNTDOWNS} nowMs={nowMs} />

            <div className="cm-split">
                <div className="cm-panel tick">
                    <div className="cm-hbar">
                        <span className="live">Progress</span>
                        <span>Senior year</span>
                    </div>
                    <div className="cm-body-pad" style={{ display: "grid", gap: 18 }}>
                        <div style={{ display: "grid", gap: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span className="cm-lbl">Senior year</span>
                                <span className="cm-num">{yearPct.toFixed(1)}%</span>
                            </div>
                            <Meter value={yearPct} label="Senior year progress" />
                            <span className="cm-coord">Sept 2026 → Graduation, June 10, 2027</span>
                        </div>
                        <div style={{ display: "grid", gap: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span className="cm-lbl">Road to AP exams</span>
                                <span className="cm-num">{apPct.toFixed(1)}%</span>
                            </div>
                            <Meter value={apPct} tone="warn" label="Road to AP exams progress" />
                            <span className="cm-coord">Sept 2026 → May 3, 2027</span>
                        </div>
                    </div>
                </div>

                <div className="cm-panel">
                    <div className="cm-hbar">
                        <span>Load</span>
                        <span>This year</span>
                    </div>
                    <div className="cm-body-pad" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                        {[
                            { value: courses.length, label: "Classes" },
                            { value: apCount, label: "AP exams" },
                            { value: 1, label: "Capstone" },
                        ].map((s) => (
                            <div key={s.label}>
                                <div className="cm-lbl">{s.label}</div>
                                <div className="cm-num big">
                                    <CountUp value={s.value} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
