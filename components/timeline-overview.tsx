import Link from "next/link";
import {
    JourneyTracker,
    type JourneyBand,
    type JourneyMarker,
} from "@/components/journey-tracker";
import {
    TimelineCountdowns,
    type Countdown,
} from "@/components/timeline-countdowns";
import {
    CATEGORIES,
    KEY_DATES,
    allEvents,
    getStatus,
    getUpNext,
    phases,
} from "@/lib/timeline-data";

const COUNTDOWNS: Countdown[] = [
    {
        label: "AP Exam Window",
        sublabel: "May 3 – 13, 2027",
        date: KEY_DATES.apStart,
        icon: "Award",
        special: true,
    },
    {
        label: "Graduation Day",
        sublabel: "June 10, 2027",
        date: KEY_DATES.graduation,
        icon: "GraduationCap",
        special: true,
    },
    {
        label: "Santa Monica College",
        sublabel: "Fall 2027",
        date: "2027-09-01",
        icon: "Rocket",
    },
];

// The events shown as markers on the journey axis: every rainbow milestone
// plus each major event, plus the finish line itself (Launch). Data is
// prepared here on the server; the interactive axis is a client component.
function buildMarkers(nowMs: number): JourneyMarker[] {
    const fromEvents = allEvents()
        .filter(
            (e) =>
                e.phase.id !== "personal" && (e.special || e.type === "major")
        )
        .map<JourneyMarker>((e) => ({
            id: e.id,
            title: e.title,
            when: e.when,
            start: e.start,
            description: e.description,
            tags: e.tags,
            color: CATEGORIES[e.category].color,
            categoryLabel: CATEGORIES[e.category].label,
            status: getStatus(e, nowMs),
            special: !!e.special,
            href: `#${e.id}`,
        }));
    return [
        ...fromEvents,
        {
            id: "launch",
            title: "Launch",
            when: "Spring 2031",
            start: "2031-05-31",
            description:
                "The point the whole plan builds toward: launching a sustainable infrastructure and urban design business or project, backed by an engineering degree, an executed portfolio, athletic leadership and a network of mentors.",
            tags: ["Founding", "Sustainability"],
            color: "var(--cm-amber)",
            categoryLabel: "Finish line",
            status: "upcoming",
            special: true,
            href: "#horizons",
        },
    ];
}

// Server component: static structure plus the live countdown island.
export function TimelineOverview({ nowMs }: { nowMs: number }) {
    const events = allEvents();
    const total = phases.reduce((n, p) => n + p.events.length, 0);
    const done = events.filter((e) => getStatus(e, nowMs) === "done").length;
    const markers = buildMarkers(nowMs);
    const upNext = getUpNext(4, nowMs);
    const bands: JourneyBand[] = phases
        .filter((p) => p.id !== "personal")
        .map((p) => ({
            id: p.id,
            short: p.short,
            color: p.color,
            start: p.start,
            end: p.end,
        }));

    return (
        <div style={{ display: "grid", gap: "var(--cm-s7)" }}>
            <div style={{ display: "grid", gap: 14 }}>
                <div>
                    <span className="cm-lbl">The big dates</span>
                    <p className="cm-body" style={{ margin: "8px 0 0" }}>
                        The fixed points everything else is built around, counting down live.
                    </p>
                </div>
                <TimelineCountdowns items={COUNTDOWNS} nowMs={nowMs} />
            </div>

            {/* The whole journey: interactive year/month axis with hoverable milestones, plus live clock and progress gauges. */}
            <JourneyTracker markers={markers} bands={bands} nowMs={nowMs} total={total} done={done} />

            {/* Up next */}
            <div style={{ display: "grid", gap: 14 }}>
                <span className="cm-lbl">Up next</span>
                <div className="cm-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
                    {upNext.map((e) => (
                        <Link key={e.id} href={`#${e.id}`} className="cm-card link">
                            <span className={`cm-state ${e.special ? "live" : ""}`}>{e.when}</span>
                            <b>{e.title}</b>
                            <span className="st">{CATEGORIES[e.category].label}{e.special ? " / Milestone" : ""} →</span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
