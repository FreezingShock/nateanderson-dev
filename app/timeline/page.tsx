import { PageHead, Section } from "@/components/cm/ui";
import { TimelineOverview } from "@/components/timeline-overview";
import { TimelineExplorer } from "@/components/timeline-explorer";
import { phases } from "@/lib/timeline-data";

// Statically generated and re-checked hourly: statuses ("done" / "now" /
// "upcoming") and progress are computed from real dates at render time, so
// the page moves forward on its own as time passes, with no edits needed.
export const revalidate = 3600;

const HORIZONS = [
    {
        title: "Environmental Engineering Firm",
        when: "Early career",
        description:
            "2–3 years with a leading sustainable infrastructure firm. Build the professional network and real-world project experience.",
    },
    {
        title: "Thought Leadership",
        when: "Mid-career",
        description:
            "Write on philosophy and engineering, speak at conferences, and position as a voice for authentic, ethical design.",
    },
    {
        title: "Independent Practice",
        when: "Long-term",
        description:
            "Founder of a design-focused sustainability consultancy, applying systems thinking to complex environmental challenges.",
    },
    {
        title: "Fractured Islands Impact",
        when: "Ongoing",
        description:
            "Grow Fractured Islands to 100K+ active players and prove games can teach systems thinking at scale.",
    },
];

export default function TimelinePage() {
    // One clock reading shared by every component, so the server-rendered
    // HTML and the client hydration agree exactly.
    const nowMs = Date.now();

    return (
        <>
            <PageHead
                label="Journey"
                title={["Timeline"]}
                lead="The complete pathway from senior year to a 2031 launch, with real dates, live countdowns and every milestone in between. Where I am, and where I'm heading."
            />

            <section id="overview" className="cm-section" style={{ scrollMarginTop: 96 }}>
                <div className="cm-wrap">
                    <TimelineOverview nowMs={nowMs} />
                </div>
            </section>

            <section className="cm-section">
                <div className="cm-wrap">
                    <TimelineExplorer phases={phases} nowMs={nowMs} />
                </div>
            </section>

            <Section
                id="horizons"
                label="Future horizons"
                title="After the degree."
                blurb="After the BS in Civil Engineering (2031): a trajectory toward impact in environmental infrastructure, sustainable design and systems thinking applied to real-world challenges."
            >
                <div className="cm-cols3" style={{ gap: 16 }}>
                    <div className="cm-panel tick" style={{ gridColumn: "1 / -1" }}>
                        <div className="cm-hbar">
                            <span className="live">Spring 2031</span>
                            <span>Milestone</span>
                        </div>
                        <div className="cm-body-pad" style={{ display: "grid", gap: 8 }}>
                            <h3 className="cm-h2" style={{ margin: 0 }}>Launch</h3>
                            <p className="cm-body" style={{ margin: 0, maxWidth: "70ch" }}>
                                The point the whole plan builds toward: launching a sustainable infrastructure and urban design business or project, backed by an engineering degree, an executed portfolio, proven athletic leadership and a network of mentors.
                            </p>
                        </div>
                    </div>
                    {HORIZONS.map((goal) => (
                        <div key={goal.title} className="cm-panel">
                            <div className="cm-hbar">
                                <span>{goal.when}</span>
                            </div>
                            <div className="cm-body-pad" style={{ display: "grid", gap: 8 }}>
                                <h3 className="cm-h3" style={{ margin: 0 }}>{goal.title}</h3>
                                <p className="cm-body" style={{ margin: 0 }}>{goal.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </Section>
        </>
    );
}

export const metadata = { title: "Timeline" };
