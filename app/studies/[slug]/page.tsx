import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHead, Section, Meter } from "@/components/cm/ui";
import {
    AP_WINDOW,
    STUDY_AREAS,
    courseBySlug,
    courses,
} from "@/lib/studies-data";
import {
    CATEGORIES,
    KEY_DATES,
    allEvents,
    daysUntil,
    phases,
    progressBetween,
} from "@/lib/timeline-data";

export const revalidate = 3600;

export async function generateStaticParams() {
    return courses.map((c) => ({ slug: c.slug }));
}

export default async function CourseDetailPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const course = courseBySlug[slug];
    if (!course) notFound();

    const nowMs = Date.now();
    const area = STUDY_AREAS[course.area];

    const index = courses.findIndex((c) => c.slug === slug);
    const prev = courses[(index - 1 + courses.length) % courses.length];
    const next = courses[(index + 1) % courses.length];

    const events = allEvents();
    const related = course.related
        .map((id) => events.find((e) => e.id === id))
        .filter((e): e is NonNullable<typeof e> => !!e);

    const hs = phases.find((p) => p.id === "high-school")!;
    const courseProgress = progressBetween(
        hs.start,
        KEY_DATES.graduation,
        nowMs
    );
    const daysToExam = daysUntil(AP_WINDOW.start, nowMs);

    const facts = [
        { label: "Timeline", value: course.timeline },
        { label: "Area", value: area.label },
        {
            label: course.ap ? "AP exam window" : "Status",
            value: course.ap ? AP_WINDOW.label : course.status,
        },
    ];
    const pct = Math.round(courseProgress * 100);

    return (
        <>
            <PageHead
                label={course.ap ? "AP course" : "Course"}
                title={[course.title]}
                lead={course.fullDescription}
                back={{ href: "/studies", label: "Back to studies" }}
            />

            <section id="detail" className="cm-section" style={{ scrollMarginTop: 96 }}>
                <div className="cm-wrap" style={{ display: "grid", gap: 16 }}>
                    <div className="cm-cols3">
                        {facts.map((f) => (
                            <div key={f.label} className="cm-panel">
                                <div className="cm-hbar">
                                    <span>{f.label}</span>
                                </div>
                                <div className="cm-body-pad">
                                    <p className="cm-h3" style={{ margin: 0 }}>{f.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="cm-split">
                        <div className="cm-panel tick">
                            <div className="cm-hbar">
                                <span className="live">Through the school year</span>
                                <span>{pct}%</span>
                            </div>
                            <div className="cm-body-pad" style={{ display: "grid", gap: 8 }}>
                                <Meter value={pct} label="Through the school year" />
                                <span className="cm-coord">Sept 2026 → June 10, 2027</span>
                            </div>
                        </div>
                        {course.ap && (
                            <div className="cm-panel">
                                <div className="cm-hbar">
                                    <span>Days to the AP window</span>
                                </div>
                                <div className="cm-body-pad">
                                    <div className="cm-num big">{daysToExam > 0 ? daysToExam : "Now"}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <Section id="goals" label="Goals & materials" title="What the class covers.">
                <div className="cm-split">
                    <div className="cm-panel">
                        <div className="cm-hbar"><span>Key focus areas</span></div>
                        <ul className="cm-body-pad" style={{ margin: 0, paddingLeft: 30, display: "grid", gap: 8 }}>
                            {course.focus.map((item) => (
                                <li key={item} style={{ color: "var(--cm-mute)", listStyle: "square" }}>{item}</li>
                            ))}
                        </ul>
                    </div>
                    <div className="cm-panel">
                        <div className="cm-hbar"><span>Learning goals</span></div>
                        <ul className="cm-body-pad" style={{ margin: 0, paddingLeft: 30, display: "grid", gap: 8 }}>
                            {course.goals.map((goal) => (
                                <li key={goal} style={{ color: "var(--cm-mute)", listStyle: "square" }}>{goal}</li>
                            ))}
                        </ul>
                    </div>
                </div>
                <div className="cm-panel" style={{ marginTop: 16 }}>
                    <div className="cm-hbar"><span>Work &amp; materials</span></div>
                    <div className="cm-body-pad" style={{ display: "grid", gap: 14 }}>
                        <div className="cm-cols3">
                            {course.materials.map((m) => (
                                <div key={m} className="cm-panel"><div className="cm-body-pad">
                                    <span className="cm-body">{m}</span></div>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {course.tags.map((tag) => (
                                <span key={tag} className="cm-pill">{tag}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </Section>

            {related.length > 0 && (
                <Section id="related" label="On the timeline" title="Where it shows up.">
                    <div className="cm-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                        {related.map((e) => (
                            <Link key={e.id} href={`/timeline#${e.id}`} className="cm-card link">
                                <span className={`cm-state ${e.special ? "live" : ""}`}>{e.when}</span>
                                <b>{e.title}</b>
                                <span className="st">{CATEGORIES[e.category].label} →</span>
                            </Link>
                        ))}
                    </div>
                </Section>
            )}

            <section className="cm-section">
                <div className="cm-wrap">
                    <div className="cm-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                        {[
                            { c: prev, dir: "← Previous class" },
                            { c: next, dir: "Next class →" },
                        ].map(({ c, dir }) => (
                            <Link key={dir} href={`/studies/${c.slug}`} className="cm-card link">
                                <span className="cm-state">{dir}</span>
                                <b>{c.title}</b>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
}
