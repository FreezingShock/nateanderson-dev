import Link from "next/link";
import { PageHead, Section } from "@/components/cm/ui";
import { StudiesOverview } from "@/components/studies-overview";
import { CourseExplorer } from "@/components/course-explorer";
import { PathwayRail, ProgramCardView, ReadingQueue, ToolRoadmap } from "@/components/studies-sections";
import { courses, personalStudies } from "@/lib/studies-data";

// Statically generated, refreshed hourly: progress bars and countdown starting values are computed from
// real dates at render time, so the page keeps moving forward on its own.
export const revalidate = 3600;

export default function StudiesPage() {
    // One clock reading shared by every component, so server HTML and client hydration agree.
    const nowMs = Date.now();

    return (
        <>
            <PageHead
                label="Learning"
                title={["Studies"]}
                lead="The complete educational pathway: this year's classes, the community college transfer, university specialization, and the independent research running alongside all of it. Systems thinking across technical, creative and philosophical work."
            />

            <Section
                id="overview"
                no="01"
                label="The school year"
                title="Where senior year stands."
                blurb="Where senior year stands, and the dates it's all building toward, counting down live."
            >
                <StudiesOverview nowMs={nowMs} />
            </Section>

            <Section
                id="classes"
                no="02"
                label="Senior year classes"
                title="Six classes."
                blurb="Six interdisciplinary classes building toward environmental engineering and systems thinking. Filter by area, and open any class for its goals and materials."
            >
                <CourseExplorer courses={courses} />
            </Section>

            <Section
                id="pathway"
                no="03"
                label="Education pathway"
                title="High school to 2031."
                blurb="From high school through Santa Monica College to Cal Poly Pomona and a 2031 degree, with live progress through each stage."
            >
                <PathwayRail nowMs={nowMs} />
            </Section>

            <Section
                id="personal"
                no="04"
                label="Personal studies"
                title="Self-directed."
                blurb="Self-directed learning alongside formal coursework: philosophy, sustainable systems and design practice. These areas inform and deepen all of the academic work."
            >
                <div className="cm-cols3">
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
            >
                <ReadingQueue />
            </Section>

            <Section
                id="tools"
                no="06"
                label="Tools roadmap"
                title="In order."
                blurb="The design and engineering toolset, in the order it gets learned: SketchUp, then Revit and AutoCAD, then Civil 3D."
            >
                <ToolRoadmap />
            </Section>

            <section className="cm-section">
                <div className="cm-wrap" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
        </>
    );
}

export const metadata = { title: "Studies" };
