import { PageHead, Section } from "@/components/cm/ui";
import { NaosArt } from "@/components/cm/naos-art";
import { Scramble } from "@/components/cm/motion";
import { TimelineOverview } from "@/components/timeline-overview";
import { TimelineExplorer } from "@/components/timeline-explorer";
import { phases } from "@/lib/timeline-data";
import "./timeline.css";
import { pageMeta } from "@/lib/seo";

// Statically generated and re-checked hourly: statuses ("done" / "now" /
// "upcoming") and progress are computed from real dates at render time, so
// the page moves forward on its own as time passes, with no edits needed.
export const revalidate = 3600;

const HORIZONS = [
    {
        title: "Construction Management Firm",
        when: "Early career",
        description:
            "2–3 years with a construction firm. Build the professional network and real-world project experience.",
    },
    {
        title: "Thought Leadership",
        when: "Mid-career",
        description:
            "Write on philosophy and engineering, speak at conferences, and position as a voice for authentic, ethical design.",
    },
    {
        title: "Fractured Islands Impact",
        when: "Ongoing",
        description:
            "Grow Fractured Islands to 100K+ active players and prove games can teach systems thinking at scale.",
    },
];

const MILESTONES = phases.reduce((n, p) => n + p.events.length, 0);

// Panel footer strip: the same signal bars and mono caption as the homepage status card.
function PanelFoot({ left, right }: { left: string; right: string }) {
    return (
        <div className="p-foot" aria-hidden="true">
            <span className="id-bars"><i /><i /><i /><i /><i /></span>
            <span>{left}</span>
            <span>{right}</span>
        </div>
    );
}

export default function TimelinePage() {
    // One clock reading shared by every component, so the server-rendered
    // HTML and the client hydration agree exactly.
    const nowMs = Date.now();

    return (
        <div className="ctos tl-page">
            {/* Original 1-bit terrace art (scripts/naos-art/generate.py). Replaces the generic header overlay on this page. */}
            <NaosArt src="/naos/timeline-route.png" width={320} height={220} variant="hero" eager className="tl-art" />
            <PageHead
                label="Journey"
                title={["Timeline"]}
                lead="The complete pathway from senior year to graduation in 2031, with real dates, live countdowns and every milestone in between. Where I am, and where I'm heading."
            >
                <div className="id-top tl-status">
                    <span className="id-live"><i />naOS // journey</span>
                    <span className="id-sys"><Scramble text={`${phases.length} phases / ${MILESTONES} milestones`} /></span>
                </div>
            </PageHead>

            <Section
                id="overview"
                no="01"
                label="Right now"
                title="The route, live."
                blurb="The fixed dates, the whole journey on one axis, and what comes next. Everything counts down from today."
                ctos
            >
                <TimelineOverview nowMs={nowMs} />
            </Section>

            <Section
                id="phases"
                no="02"
                label="The full route"
                title="Every phase, in order."
                blurb="Each phase opens to its milestones. Filter by category, show only the milestones, or expand the whole plan."
                ctos
            >
                <TimelineExplorer phases={phases} nowMs={nowMs} />
            </Section>

            <Section
                id="horizons"
                no="03"
                label="Future horizons"
                title="After the degree."
                blurb="After the degree in 2031: a trajectory toward impact in construction and sustainable design, applying systems thinking to real projects."
                ctos
            >
                <div className="tl-goals">
                    {HORIZONS.map((goal, i) => (
                        <div key={goal.title} className="cm-panel tl-goal">
                            <div className="cm-hbar">
                                <span>{goal.when}</span>
                                <span>{String(i + 1).padStart(2, "0")}</span>
                            </div>
                            <div className="cm-body-pad" style={{ display: "grid", gap: 8 }}>
                                <h3 className="cm-h3" style={{ margin: 0 }}>{goal.title}</h3>
                                <p className="cm-body" style={{ margin: 0 }}>{goal.description}</p>
                            </div>
                            <PanelFoot left="naOS / horizon" right={goal.when.toLowerCase()} />
                        </div>
                    ))}
                </div>
            </Section>
        </div>
    );
}

export const metadata = pageMeta({
    title: "Timeline",
    description: "The pathway from senior year to graduation in 2031, with real dates, live countdowns and every milestone in between.",
    path: "/timeline",
});
