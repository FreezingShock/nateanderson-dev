// Content for the landing page's Timeline View. Kept as plain data so it is
// easy to edit as plans change. The 2027 side mirrors dates already on the
// full /timeline page; the next-months side comes from the current goals in
// the vault (see 8 - Claude/North Star.md, "Immediate Actions").
export interface UpcomingMonth {
    label: string;
    year: string;
    color: string;
    goals: string[];
}

export interface UpcomingMilestone {
    when: string;
    title: string;
    detail: string;
    color: string;
}

export const NEXT_MONTHS: UpcomingMonth[] = [
    {
        label: "October",
        year: "2026",
        color: "var(--cm-cyan)",
        goals: [
            "Email SLO admissions for the Construction Management admit rate",
            "Book an SLO student-led tour",
            "Pick the first real portfolio project",
        ],
    },
    {
        label: "November",
        year: "2026",
        color: "var(--cm-amber)",
        goals: [
            "Submit CSU Apply to SLO and Pomona by Nov 20 (hard deadline Nov 30)",
            "Start the first portfolio design: a SketchUp redesign of a local space",
        ],
    },
    {
        label: "December",
        year: "2026",
        color: "var(--cm-good)",
        goals: [
            "File the FAFSA or Dream Act application by Dec 15",
            "Ask my counselor about adding calculus and physics senior year",
            "Finish the semester strong",
        ],
    },
];

export const NEXT_YEAR: { year: string; blurb: string; milestones: UpcomingMilestone[] } = {
    year: "2027",
    blurb: "The pivot year: finish high school, lock in college, and turn planning into shipped work.",
    milestones: [
        {
            when: "Spring",
            title: "First polished portfolio piece",
            detail: "One finished, presentable design project, not just sketches.",
            color: "var(--cm-violet)",
        },
        {
            when: "May",
            title: "AP exam week",
            detail: "Statistics, Biology, Government and the Studio Art portfolio.",
            color: "var(--cm-cyan)",
        },
        {
            when: "June",
            title: "High school graduation",
            detail: "Senior Project capstone presented; the college pathway begins.",
            color: "var(--cm-alert)",
        },
        {
            when: "September",
            title: "College begins",
            detail: "Cal Poly SLO Construction Management, or Pomona CEM, with calculus and physics from day one.",
            color: "var(--cm-cyan)",
        },
    ],
};
