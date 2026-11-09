"use client";

import { memo, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Collapse } from "@/components/collapse";
import { FilterChips, type FilterChip } from "@/components/filter-chips";
import { STUDY_AREAS, type Course, type StudyArea } from "@/lib/studies-data";

// The senior-year class list: filter by area, open a class for its goals and materials in place, or jump
// to its own page. Nothing important is hover-only, so it works on a phone.

const CourseCard = memo(function CourseCard({
    course,
    open,
    onToggle,
}: {
    course: Course;
    open: boolean;
    onToggle: (slug: string) => void;
}) {
    const area = STUDY_AREAS[course.area];
    const panelId = `${course.slug}-panel`;

    return (
        <div className="cm-panel st-panel-fill" data-rx="">
            <div className="cm-hbar">
                <span>{area.label}</span>
                <span className="st-hbar-end">
                    {course.ap && <span className="st-ap">AP</span>}
                    <span>{course.status}</span>
                </span>
            </div>
            <div className="cm-body-pad" style={{ display: "grid", gap: 10 }}>
                <h3 className="cm-h3" style={{ margin: 0 }}><span className="st-tt">{course.title}</span></h3>
                <p className="cm-body" style={{ margin: 0 }}>{course.description}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {course.focus.slice(0, 4).map((item) => (
                        <span key={item} className="cm-pill">{item}</span>
                    ))}
                </div>

                <button
                    type="button"
                    className="cm-chip"
                    style={{ justifyContent: "space-between", width: "100%", padding: "10px 10px" }}
                    onClick={() => onToggle(course.slug)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    aria-pressed={open}
                >
                    Goals &amp; materials
                    <span aria-hidden="true">{open ? "−" : "+"}</span>
                </button>

                <Collapse open={open} id={panelId}>
                    <div style={{ display: "grid", gap: 14, paddingTop: 4 }}>
                        <div style={{ display: "grid", gap: 6 }}>
                            <span className="cm-lbl">Learning goals</span>
                            <ul className="st-list">
                                {course.goals.map((g) => (
                                    <li key={g}>{g}</li>
                                ))}
                            </ul>
                        </div>
                        <div style={{ display: "grid", gap: 6 }}>
                            <span className="cm-lbl">Work &amp; materials</span>
                            <ul className="st-list">
                                {course.materials.map((m) => (
                                    <li key={m}>{m}</li>
                                ))}
                            </ul>
                        </div>
                        <Link href={`/studies/${course.slug}`} className="cm-more">
                            Open the class page →
                        </Link>
                    </div>
                </Collapse>
            </div>
        </div>
    );
});

export function CourseExplorer({ courses }: { courses: Course[] }) {
    const [area, setArea] = useState<string | null>(null);
    const [open, setOpen] = useState<Record<string, boolean>>({});

    const chips: FilterChip[] = useMemo(
        () =>
            (Object.keys(STUDY_AREAS) as StudyArea[]).map((key) => ({
                key,
                label: STUDY_AREAS[key].label,
                color: STUDY_AREAS[key].color,
                count: courses.filter((c) => c.area === key).length,
            })),
        [courses]
    );
    const visible = area ? courses.filter((c) => c.area === area) : courses;

    const toggle = useCallback((slug: string) => setOpen((o) => ({ ...o, [slug]: !o[slug] })), []);
    const anyOpen = visible.some((c) => open[c.slug]);
    const setAll = (value: boolean) => setOpen(Object.fromEntries(courses.map((c) => [c.slug, value])));

    return (
        <div style={{ display: "grid", gap: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <FilterChips chips={chips} active={area} onChange={setArea} total={courses.length} />
                <button type="button" className="cm-chip" onClick={() => setAll(!anyOpen)}>
                    {anyOpen ? "Collapse all" : "Expand all"}
                </button>
            </div>
            <div className="st-courses">
                {visible.map((course) => (
                    <CourseCard key={course.slug} course={course} open={!!open[course.slug]} onToggle={toggle} />
                ))}
            </div>
        </div>
    );
}
