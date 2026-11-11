import Link from "next/link";
import { PageHead, Section } from "@/components/cm/ui";
import { StudyStatus } from "@/components/studies-status";
import { StudiesOverview } from "@/components/studies-overview";
import { CourseExplorer } from "@/components/course-explorer";
import { PathwayRail, ProgramCardView, ReadingQueue, ToolRoadmap } from "@/components/studies-sections";
import { courses, personalStudies } from "@/lib/studies-data";
import "./studies.css";
import { pageMeta } from "@/lib/seo";

// Statically generated, refreshed hourly: progress bars and countdown starting values are computed from
// real dates at render time, so the page keeps moving forward on its own.
import { NaosBackdrop } from "@/components/cm/naos-art";
export const revalidate = 3600;

export default function StudiesPage() {
    // One clock reading shared by every component, so server HTML and client hydration agree.
    const nowMs = Date.now();

    return (
        <div className="ctos st-page" data-entrance="stack">
            <NaosBackdrop src="/naos/bg-studies.webp" />
            <PageHead
                label="Learning"
                title={["Studies"]}
                lead="The complete educational pathway: this year's classes, the community college transfer, university specialization, and the independent research running alongside all of it. Systems thinking across technical, creative and philosophical work."
            >
                <StudyStatus nowMs={nowMs} />
            </PageHead>

            <Section
                id="overview"
                no="01"
                label="The school year"
                title="Where senior year stands."
                blurb="The dates this year builds toward, counting down live, and how far through the year I am."
                ctos
            >
                <StudiesOverview nowMs={nowMs} />
            </Section>

            <Section
                id="classes"
                no="02"
                label="Senior year classes"
                title="Six classes."
                blurb="Six interdisciplinary classes building toward construction management and systems thinking. Filter by area, or open a class for its goals and materials."
                ctos
            >
                <CourseExplorer courses={courses} />
            </Section>

            <Section
                id="pathway"
                no="03"
                label="Education pathway"
                title="High school to 2031."
                blurb="From high school through Cal Poly SLO or Pomona to a 2031 degree, with live progress through each stage."
                ctos
            >
                <PathwayRail nowMs={nowMs} />
            </Section>

            <Section
                id="personal"
                no="04"
                label="Personal studies"
                title="Self-directed."
                blurb="Self-directed learning next to formal coursework: philosophy, sustainable systems and design practice. Each area feeds the academic work."
                ctos
            >
                <div className="cm-cols3 st-personal">
                    {personalStudies.map((p) => (
                        <ProgramCardView key={p.title} program={p} />
                    ))}
                </div>
            </Section>

            <Section
                id="reading"
                no="05"
                label="Reading queue"
                title="On the shelf."
                blurb="What's on the shelf, in the order it's getting read."
                ctos
            >
                <ReadingQueue />
            </Section>

            <Section
                id="tools"
                no="06"
                label="Tools roadmap"
                title="In order."
                blurb="The design and engineering toolset, in the order it gets learned: SketchUp, then Revit and AutoCAD, then Civil 3D."
                ctos
            >
                <ToolRoadmap />
            </Section>

            <section className="cm-section">
                <div className="cm-wrap" data-rx-auto="" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {[
                        { href: "/timeline", label: "Full timeline" },
                        { href: "/about", label: "About me" },
                        { href: "/creations", label: "See the work" },
                    ].map((l) => (
                        <Link key={l.href} href={l.href} className="cm-chip">
                            {l.label} →
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}

export const metadata = pageMeta({
    title: "Studies",
    description: "The pathway from this year's classes to a university specialization, plus the independent research running alongside it.",
    path: "/studies",
});
