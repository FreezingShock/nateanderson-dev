// Single source of truth for the /timeline page (and anything else that needs
// to know the plan): phases, events, real dates and the helpers that turn
// dates into status/progress. Edit here and the whole page follows.
//
// Dates are ISO (YYYY-MM-DD). `start`/`end` drive status ("done", "now",
// "upcoming") and progress, so keep them accurate; `when` is only the human
// label on the card. Events render in the order listed, so keep each phase
// chronological. `special: true` marks the super-special milestones that get
// the animated rainbow ("chroma") treatment.

export type PhaseId = "high-school" | "smc" | "cal-poly" | "personal";

export type TimelineIconName =
    | "BookOpen"
    | "GraduationCap"
    | "Award"
    | "Zap"
    | "Rocket"
    | "CheckCircle"
    | "Lightbulb"
    | "Flag"
    | "Trophy"
    | "Send"
    | "Palette"
    | "Footprints"
    | "Briefcase"
    | "Users"
    | "Target"
    | "Sun"
    | "Compass"
    | "Code2"
    | "Leaf"
    | "Brain"
    | "PenLine"
    | "Mountain"
    | "CalendarCheck"
    | "Smartphone";

// What kind of thing an event is. Color carries meaning across the whole page:
// the same category is the same color in every phase, and the toolbar legend
// filters by it.
export type Category =
    | "academics"
    | "exams"
    | "applications"
    | "athletics"
    | "portfolio"
    | "career"
    | "milestone"
    | "mind"
    | "build";

export const CATEGORIES: Record<Category, { label: string; color: string }> = {
    academics: { label: "Coursework", color: "var(--cm-cyan)" },
    exams: { label: "Exams", color: "var(--cm-alert)" },
    applications: { label: "Applications", color: "var(--cm-cyan)" },
    athletics: { label: "Athletics", color: "var(--cm-good)" },
    portfolio: { label: "Portfolio", color: "var(--cm-violet)" },
    career: { label: "Career", color: "var(--cm-amber)" },
    milestone: { label: "Landmarks", color: "var(--cm-amber)" },
    mind: {
        label: "Mind",
        color: "color-mix(in oklch, var(--cm-violet) 60%, white)",
    },
    build: { label: "Building", color: "var(--cm-cyan)" },
};

export interface TimelineEventData {
    id: string;
    title: string;
    description: string;
    /** Human label shown on the card, e.g. "May 3 – 13, 2027". */
    when: string;
    start: string;
    /** Omit for a single-day event. */
    end?: string;
    /** Open-ended, never "done" (independent work that runs alongside school). */
    ongoing?: boolean;
    /** An idea with no date yet. */
    planned?: boolean;
    category: Category;
    type: "major" | "minor";
    icon: TimelineIconName;
    tags?: string[];
    details?: string[];
    /** Super-special milestone: animated rainbow border, title and marker. */
    special?: boolean;
}

export interface TimelinePhaseData {
    id: PhaseId;
    title: string;
    /** Short name for chips and the journey bar. */
    short: string;
    /** Range label under the title. */
    range: string;
    description: string;
    color: string;
    icon: TimelineIconName;
    start: string;
    end: string;
    events: TimelineEventData[];
}

export const JOURNEY_START = "2026-09-01";
export const JOURNEY_END = "2031-05-31";

export const KEY_DATES = {
    apStart: "2027-05-03",
    apEnd: "2027-05-13",
    graduation: "2027-06-10",
} as const;

export const phases: TimelinePhaseData[] = [
    {
        id: "high-school",
        title: "High School Senior Year",
        short: "Senior Year",
        range: "September 2026 — Summer 2027",
        description:
            "The final year before college. Six interdisciplinary courses, college applications, the SAT retake, the Senior Project, AP exams and graduation, all pointed at an environmental engineering pathway.",
        color: "var(--cm-cyan)",
        icon: "BookOpen",
        start: "2026-09-01",
        end: "2027-08-31",
        events: [
            {
                id: "hs-1",
                title: "Senior Year Begins",
                description:
                    "Six courses (Senior Project, AP Stats, AP Bio, Communications, Studio Art, AP Gov) building toward environmental engineering, with Kierkegaard's philosophy applied to design work.",
                when: "Sept 2026 — Ongoing",
                start: "2026-09-01",
                end: "2027-06-10",
                category: "academics",
                type: "major",
                icon: "BookOpen",
                tags: ["Coursework", "6 Courses"],
                details: [
                    "Senior Project: public space transformation research",
                    "AP Statistics: quantitative analysis and hypothesis testing",
                    "AP Biology: systems thinking and ecology",
                    "Communications: public speaking and presentation design",
                    "AP Studio Art: visual portfolio development (12–15 pieces)",
                    "AP Government: constitutional law and political systems",
                ],
            },
            {
                id: "hs-11",
                title: "SMC Coach Outreach",
                description:
                    "The first move of the recruiting process: introducing myself to Santa Monica College's cross-country program.",
                when: "By Sept 30, 2026",
                start: "2026-09-28",
                end: "2026-09-30",
                category: "athletics",
                type: "minor",
                icon: "Send",
                tags: ["Recruiting", "Cross-Country"],
                details: [
                    "Introduce myself with race results, graduation year and engineering interest",
                    "Ask about recruited-athlete status, scholarship availability and the transfer pathway to Cal Poly Pomona",
                ],
            },
            {
                id: "hs-2",
                title: "Essays & Recommendation Letters",
                description:
                    "Getting the application story written down while there's plenty of runway: personal narrative first, letters second.",
                when: "October 2026",
                start: "2026-10-01",
                end: "2026-10-31",
                category: "applications",
                type: "minor",
                icon: "PenLine",
                tags: ["Essays", "Applications"],
                details: [
                    "Draft 2–3 versions of the SMC essay and personal narrative by the end of October",
                    "Ask two teachers who know my ambitions for recommendation letters by mid-October",
                    "SMC is open-admission, so the essays carry the narrative and the letters are a bonus",
                ],
            },
            {
                id: "hs-12",
                title: "Transfer Mapping & Logistics",
                description:
                    "Mapping exactly what the SMC → Cal Poly Pomona route requires, and how the daily logistics will work.",
                when: "October 2026",
                start: "2026-10-01",
                end: "2026-10-31",
                category: "applications",
                type: "minor",
                icon: "Compass",
                tags: ["Transfer", "Planning"],
                details: [
                    "Use ASSIST.org to pull the SMC → Cal Poly Pomona Civil Engineering course agreements",
                    "Get high school transcripts and AP score reports ready",
                    "Weigh commuting against living near campus during cross-country season",
                ],
            },
            {
                id: "hs-16",
                title: "Senior Project: Sites & Research",
                description:
                    "Choosing the neglected outdoor spaces to redesign and studying what actually makes public spaces work.",
                when: "Oct 2026 — Jan 2027",
                start: "2026-10-01",
                end: "2027-01-31",
                category: "academics",
                type: "minor",
                icon: "Leaf",
                tags: ["Senior Project", "Research"],
                details: [
                    "Choose the sites: learning facilities and shopping centers",
                    "Study authentic precedents: spaces that actually get used, not just beautiful renderings",
                    "Community needs assessment: what's broken, and why is the space empty?",
                    "Sustainability research: local durable materials, native plants, honest water management, accessibility",
                ],
            },
            {
                id: "hs-13",
                title: "SAT Prep Sprint",
                description:
                    "Three focused months of steady practice, aimed squarely at the reading section where scores jump the most.",
                when: "Oct — Dec 2026",
                start: "2026-10-01",
                end: "2026-12-31",
                category: "exams",
                type: "minor",
                icon: "Brain",
                tags: ["SAT", "Prep"],
                details: [
                    "Khan Academy's personalized practice, 10+ hours on weak areas",
                    "2–3 timed, full-length official practice tests by December",
                    "Review every wrong answer: what's the pattern?",
                    "Focus on reading comprehension: dense passages from science and philosophy, and pacing",
                ],
            },
            {
                id: "hs-3",
                title: "First Portfolio Project",
                description:
                    "The first real design piece: a SketchUp redesign of a local space, documented from the existing conditions forward.",
                when: "Nov 2026 — Feb 2027",
                start: "2026-11-01",
                end: "2027-02-28",
                category: "portfolio",
                type: "major",
                icon: "Palette",
                tags: ["Portfolio", "SketchUp", "Design"],
                details: [
                    "Choose and survey the space, then document what's there",
                    "Model the redesign in SketchUp",
                    "Write up the reasoning so the process is part of the piece",
                    "Complete by February 2027; it also feeds the Recent Renovations section of this site",
                ],
            },
            {
                id: "hs-4",
                title: "SMC Application",
                description:
                    "Prepare in December, submit after the SAT, and line up the transfer pathway to Cal Poly Pomona.",
                when: "Dec 2026 — Jan 2027",
                start: "2026-12-01",
                end: "2027-01-31",
                category: "applications",
                type: "major",
                icon: "Send",
                tags: ["SMC", "Transfer"],
                details: [
                    "Prepare the application in December (rolling admissions)",
                    "Submit the Santa Monica College application in January, after the SAT",
                    "Acceptance is expected within about two weeks",
                    "Confirm backup schools",
                ],
            },
            {
                id: "hs-14",
                title: "SAT Registration Deadline",
                description: "The last day to register for the January test.",
                when: "Dec 15, 2026",
                start: "2026-12-15",
                category: "exams",
                type: "minor",
                icon: "CalendarCheck",
                tags: ["SAT", "Deadline"],
            },
            {
                id: "hs-5",
                title: "SAT Retake",
                description:
                    "One more attempt at a stronger score, after months of steady prep.",
                when: "January 2027",
                start: "2027-01-01",
                end: "2027-01-31",
                category: "exams",
                type: "minor",
                icon: "Target",
                tags: ["SAT", "Exam"],
                details: [
                    "Sit the January SAT (arrive early, bring ID)",
                    "Send scores to the colleges that need them",
                    "Decide whether another attempt is worth it",
                ],
            },
            {
                id: "hs-15",
                title: "Senior Project: Analysis & Concepts",
                description:
                    "Turning research into a clear problem statement and several honest design directions.",
                when: "February 2027",
                start: "2027-02-01",
                end: "2027-02-28",
                category: "academics",
                type: "minor",
                icon: "Lightbulb",
                tags: ["Senior Project", "Design"],
                details: [
                    "Site analysis and problem statement: define the authentic problem to solve",
                    "2–3 design concepts that show multiple solutions to real constraints",
                ],
            },
            {
                id: "hs-6",
                title: "AP Studio Art Portfolio Push",
                description:
                    "The long build toward the AP Studio Art submission: breadth, concentration and a body of work with a point of view.",
                when: "Feb — Apr 2027",
                start: "2027-02-01",
                end: "2027-04-30",
                category: "portfolio",
                type: "minor",
                icon: "Palette",
                tags: ["Studio Art", "Portfolio"],
                details: [
                    "12–15 finished pieces across the breadth and concentration sections",
                    "Steady checkpoints so nothing lands in the last week",
                    "Document the process alongside the finished work",
                ],
            },
            {
                id: "hs-17",
                title: "SMC Acceptance & Athlete Confirmation",
                description:
                    "The answers arrive: admission to Santa Monica College and confirmation of recruited-athlete status.",
                when: "Feb — Mar 2027",
                start: "2027-02-01",
                end: "2027-03-31",
                category: "applications",
                type: "major",
                icon: "CheckCircle",
                tags: ["SMC", "Recruiting"],
                details: [
                    "Expected SMC acceptance",
                    "Confirm recruited-athlete status with the cross-country coach",
                    "Finalize the housing or commute plan for fall 2027",
                ],
            },
            {
                id: "hs-18",
                title: "Senior Project: Final Design & Spec",
                description:
                    "Refining the chosen concept into portfolio-ready documentation, with every choice defensible.",
                when: "March 2027",
                start: "2027-03-01",
                end: "2027-03-31",
                category: "academics",
                type: "minor",
                icon: "PenLine",
                tags: ["Senior Project", "Documentation"],
                details: [
                    "Iterate with community feedback",
                    "Sustainability analysis: quantify the environmental choices",
                    "Portfolio documentation that shows the thinking, not just the drawings",
                ],
            },
            {
                id: "hs-19",
                title: "Senior Project: Implementation Plan",
                description:
                    "Proving the design could actually be built, and maintained by the people who'd have to.",
                when: "April 2027",
                start: "2027-04-01",
                end: "2027-04-30",
                category: "academics",
                type: "minor",
                icon: "Compass",
                tags: ["Senior Project", "Planning"],
                details: [
                    "How it actually gets built: phasing, materials and cost",
                    "Maintenance realism: design for who will really maintain it",
                ],
            },
            {
                id: "hs-7",
                title: "AP Exam Window",
                description:
                    "Two weeks of AP testing: Statistics, Biology and Government exams, plus the Studio Art portfolio submission.",
                when: "May 3 – 13, 2027",
                start: KEY_DATES.apStart,
                end: KEY_DATES.apEnd,
                category: "exams",
                type: "major",
                icon: "Award",
                special: true,
                tags: ["Exams", "Statistics", "Biology", "Government"],
                details: [
                    "May 3 – 13: the full AP testing window",
                    "Target: 4–5 on each exam, based on AP history",
                    "Studio Art portfolio submitted before the window closes",
                    "The last big checkpoint before graduation",
                ],
            },
            {
                id: "hs-8",
                title: "Senior Project Presentation",
                description:
                    "The capstone: presenting the public-space transformation research to stakeholders.",
                when: "Late May – early June 2027",
                start: "2027-05-14",
                end: "2027-06-05",
                category: "academics",
                type: "minor",
                icon: "Users",
                tags: ["Capstone", "Presentation"],
                details: [
                    "Final Senior Project presentation to stakeholders",
                    "The research, the design thinking and the case for the change",
                    "Doubles as the first executed portfolio piece for college",
                ],
            },
            {
                id: "hs-9",
                title: "High School Graduation",
                description:
                    "June 10, 2027: the official end of high school, and the start of the college pathway.",
                when: "June 10, 2027",
                start: KEY_DATES.graduation,
                category: "milestone",
                type: "major",
                icon: "GraduationCap",
                special: true,
                tags: ["Graduation", "Milestone"],
                details: [
                    "Senior Project capstone complete",
                    "College applications settled (SMC, backup schools)",
                    "Ready for the community college transfer pathway",
                ],
            },
            {
                id: "hs-10",
                title: "Summer Before SMC",
                description:
                    "The runway between graduation and the first day of college: logistics, base training and a head start.",
                when: "Summer 2027",
                start: "2027-06-11",
                end: "2027-08-31",
                category: "athletics",
                type: "minor",
                icon: "Sun",
                tags: ["Prep", "Running"],
                details: [
                    "Finalize the athletic scholarship details",
                    "Build the running base for cross-country season",
                    "Placement, orientation, registration and the housing or commute plan",
                ],
            },
        ],
    },
    {
        id: "smc",
        title: "Santa Monica College Transfer Pathway",
        short: "Santa Monica College",
        range: "September 2027 — May 2029",
        description:
            "Two years of STEM prerequisites while competing as a recruited cross-country athlete. A strong, affordable foundation before upper-level engineering specialization.",
        color: "var(--cm-cyan)",
        icon: "Rocket",
        start: "2027-09-01",
        end: "2029-05-31",
        events: [
            {
                id: "smc-1",
                title: "SMC Enrollment & Fall 2027",
                description:
                    "Start at Santa Monica College as a recruited cross-country athlete. Foundational STEM coursework: Calculus I, Physics I, Chemistry I.",
                when: "Fall 2027",
                start: "2027-09-01",
                end: "2027-12-20",
                category: "academics",
                type: "major",
                icon: "Rocket",
                tags: ["Transfer", "STEM", "Athlete"],
                details: [
                    "Calculus I & II sequence",
                    "Physics I & II (with labs)",
                    "Chemistry I & II (with labs)",
                    "Engineering design electives and CAD",
                    "General education breadth requirements",
                    "Maintain a 3.5+ GPA for a competitive transfer",
                ],
            },
            {
                id: "smc-2",
                title: "First Cross-Country Season",
                description:
                    "Racing for SMC: the start of a leadership path that runs through both colleges.",
                when: "Fall 2027",
                start: "2027-09-01",
                end: "2027-11-30",
                category: "athletics",
                type: "minor",
                icon: "Footprints",
                tags: ["Athletics", "Cross-Country"],
                details: [
                    "Compete as a recruited athlete",
                    "Balance the training load with a full STEM schedule",
                    "Build toward the captain role",
                ],
            },
            {
                id: "smc-3",
                title: "Midpoint: Spring 2028",
                description:
                    "Halfway through SMC. Solidify the math foundation and plan the transfer.",
                when: "Spring 2028",
                start: "2028-01-15",
                end: "2028-05-31",
                category: "academics",
                type: "minor",
                icon: "CheckCircle",
                tags: ["Checkpoint"],
                details: [
                    "Complete the Calculus sequence (I & II)",
                    "Finish Physics I, start Physics II",
                    "Begin Chemistry II",
                    "Meet with the Cal Poly Pomona transfer advisor",
                ],
            },
            {
                id: "smc-5",
                title: "Two Portfolio Projects Complete",
                description:
                    "Two finished design portfolio pieces, plus real CAD and Revit skills, ready for the next step.",
                when: "Spring 2028 — Spring 2029",
                start: "2028-01-15",
                end: "2029-05-31",
                category: "portfolio",
                type: "minor",
                icon: "Palette",
                tags: ["Portfolio", "CAD", "Revit"],
                details: [
                    "Two polished design projects by the end of SMC",
                    "Skills: Revit, AutoCAD, technical drawing and project documentation",
                    "Each piece documents the thinking, not just the drawings",
                ],
            },
            {
                id: "smc-4",
                title: "Transfer Applications",
                description:
                    "The application window for Cal Poly Pomona, with units, grades and prerequisites locked in.",
                when: "Fall 2028",
                start: "2028-09-01",
                end: "2028-11-30",
                category: "applications",
                type: "major",
                icon: "Send",
                tags: ["Transfer", "Applications"],
                details: [
                    "Submit the Cal Poly Pomona transfer application, declaring the major",
                    "60+ transferable semester units and the general education pattern complete or on track",
                    "Earn the Associate Degree for Transfer in Engineering, if available",
                    "Keep the GPA above the 3.5 target",
                ],
            },
            {
                id: "smc-8",
                title: "Captain Year at SMC",
                description:
                    "Stepping into a leadership role on the team: discipline, teamwork and resilience, all rehearsals for founding something.",
                when: "2028 — 2029",
                start: "2028-09-01",
                end: "2029-05-31",
                category: "athletics",
                type: "minor",
                icon: "Trophy",
                tags: ["Athletics", "Leadership"],
                details: [
                    "Goal: captain or vice-captain of the SMC cross-country team",
                    "Team management is practice for building a company",
                ],
            },
            {
                id: "smc-6",
                title: "Transfer to Cal Poly Pomona",
                description:
                    "Finish SMC and transfer to Cal Poly Pomona as a junior, with four semesters to go until the degree.",
                when: "May 2029",
                start: "2029-05-01",
                end: "2029-05-31",
                category: "milestone",
                type: "major",
                icon: "Zap",
                special: true,
                tags: ["Transfer", "Milestone"],
                details: [
                    "All STEM prerequisites complete (Calc, Physics, Chem)",
                    "General education requirements finished",
                    "Accept Cal Poly Pomona admission as a junior",
                    "Prepare for upper-level engineering courses",
                ],
            },
        ],
    },
    {
        id: "cal-poly",
        title: "Cal Poly Pomona: Civil Engineering",
        short: "Cal Poly Pomona",
        range: "September 2029 — May 2031",
        description:
            "Transfer as a junior and finish in two years, specializing in Environmental Engineering. A capstone project, a growing network and the first real steps toward a business.",
        color: "var(--cm-good)",
        icon: "Leaf",
        start: "2029-09-01",
        end: "2031-05-31",
        events: [
            {
                id: "cpp-1",
                title: "Junior Year at Cal Poly Pomona",
                description:
                    "Upper-level Civil Engineering coursework with the Environmental specialization. Capstone planning starts.",
                when: "Fall 2029",
                start: "2029-09-01",
                end: "2029-12-20",
                category: "academics",
                type: "major",
                icon: "Rocket",
                tags: ["Upper-Level", "Specialization"],
                details: [
                    "Water Resources Engineering",
                    "Environmental Engineering (focus)",
                    "Sustainable Infrastructure Design",
                    "Civil Engineering electives",
                    "Capstone project (two semesters)",
                    "Summer internships with environmental firms",
                ],
            },
            {
                id: "cpp-2",
                title: "Leading the Cross-Country Team",
                description:
                    "Carrying the athletic leadership thread into Pomona: discipline, teamwork and resilience.",
                when: "2029 — 2031",
                start: "2029-09-01",
                end: "2031-05-31",
                category: "athletics",
                type: "minor",
                icon: "Footprints",
                tags: ["Athletics", "Leadership"],
                details: [
                    "Goal: captain of the Pomona cross-country team, likely by senior year",
                    "Keep racing competitively through the end of college",
                ],
            },
            {
                id: "cpp-7",
                title: "Building the Founding Network",
                description:
                    "Professors, mentors and potential co-founders: the people who make a launch possible.",
                when: "2029 — 2031",
                start: "2029-09-01",
                end: "2031-05-31",
                category: "career",
                type: "minor",
                icon: "Users",
                tags: ["Network", "Mentors"],
                details: [
                    "Build 3–5 real mentor relationships with professors and professionals",
                    "Find collaborators and potential co-founders",
                    "Advisors for post-graduation planning",
                ],
            },
            {
                id: "cpp-3",
                title: "Capstone Planning",
                description:
                    "Midpoint: the capstone proposal and team formation.",
                when: "Spring 2030",
                start: "2030-01-15",
                end: "2030-05-31",
                category: "portfolio",
                type: "minor",
                icon: "Lightbulb",
                tags: ["Capstone"],
                details: [
                    "Form the capstone team (3–4 engineers)",
                    "Choose a real-world infrastructure challenge",
                    "Proposal and budget planning",
                    "Start the literature review and design analysis",
                ],
            },
            {
                id: "cpp-4",
                title: "Summer Internship",
                description:
                    "Real-world project experience with an environmental engineering firm.",
                when: "Summer 2030",
                start: "2030-06-01",
                end: "2030-08-31",
                category: "career",
                type: "minor",
                icon: "Briefcase",
                tags: ["Internship", "Career"],
                details: [
                    "Work on live infrastructure or environmental projects",
                    "Build the professional experience that starts the career",
                    "Skills: environmental impact assessment and compliance",
                ],
            },
            {
                id: "cpp-5",
                title: "Capstone Build",
                description:
                    "Two semesters designing and delivering the capstone: the proof-of-concept that anchors the portfolio.",
                when: "Fall 2030 — Spring 2031",
                start: "2030-09-01",
                end: "2031-04-30",
                category: "portfolio",
                type: "major",
                icon: "Zap",
                tags: ["Capstone", "Design"],
                details: [
                    "Design development with the capstone team",
                    "Analysis, modeling and iteration",
                    "Final presentation and documentation",
                    "Brings the portfolio to 4–5 executed projects",
                ],
            },
            {
                id: "cpp-8",
                title: "The Business Idea Takes Shape",
                description:
                    "By senior year at Pomona, a clear idea for the business or project, and first steps toward launching it.",
                when: "Fall 2030 — Spring 2031",
                start: "2030-09-01",
                end: "2031-05-31",
                category: "career",
                type: "minor",
                icon: "Rocket",
                tags: ["Founding", "Planning"],
                details: [
                    "A clear concept in sustainable infrastructure and urban design",
                    "First concrete steps toward launch, backed by the portfolio and the network",
                ],
            },
            {
                id: "cpp-6",
                title: "Graduation: BS Civil Engineering",
                description:
                    "The bachelor's degree in Civil Engineering with the Environmental specialization, and the start of a professional career.",
                when: "May 2031",
                start: "2031-05-01",
                end: "2031-05-31",
                category: "milestone",
                type: "major",
                icon: "GraduationCap",
                special: true,
                tags: ["Graduation", "Degree", "Career-Ready"],
                details: [
                    "Capstone final presentation",
                    "Degree conferred: BS Civil Engineering",
                    "Environmental specialization recognized",
                    "Launch the business or project the whole plan has been building toward",
                ],
            },
        ],
    },
    {
        id: "personal",
        title: "Personal Studies & Ongoing Work",
        short: "Personal Studies",
        range: "Ongoing",
        description:
            "Independent research and creative work running in parallel with formal education: philosophy, sustainable systems, design practice, game development, running, writing and this website.",
        color: "var(--cm-violet)",
        icon: "Brain",
        start: "2026-09-01",
        end: "2031-05-31",
        events: [
            {
                id: "personal-1",
                title: "Philosophy & Existentialism",
                description:
                    "Deep independent study of Kierkegaard, Sartre and existential frameworks, and how authentic philosophy informs design practice and engineering ethics.",
                when: "Sept 2026 — Career",
                start: "2026-09-01",
                ongoing: true,
                category: "mind",
                type: "major",
                icon: "Lightbulb",
                tags: ["Philosophy", "Self-Directed"],
                details: [
                    "Reading now: Fear and Trembling. Next: Either/Or, then The Concept of Anxiety",
                    "Kierkegaard's authenticity as a design principle: avoid fake solutions",
                    "Individual responsibility: design has ethical weight",
                    "A philosophical framework for engineering and life decisions",
                ],
            },
            {
                id: "personal-2",
                title: "Fractured Islands: Ascension",
                description:
                    "A long-running solo Roblox game project: a systems-driven incremental RPG combining button simulators with skill-based progression.",
                when: "2026 — Indefinite",
                start: "2026-09-01",
                ongoing: true,
                category: "build",
                type: "major",
                icon: "Zap",
                tags: ["Game Dev", "Solo Project", "Luau"],
                details: [
                    "Roadmap: the Ascension Menu, then the Stat System, then the 100+ attribute system",
                    "Dual progression model (button sim + skill tree)",
                    "Combo system, bestiary and time-based milestones",
                    "Systems thinking that transfers straight into engineering work",
                ],
            },
            {
                id: "personal-3",
                title: "Sustainable Systems Research",
                description:
                    "Independent investigation of climate adaptation, circular design and regenerative systems, feeding the Senior Project and future engineering work.",
                when: "Fall 2026 — Career",
                start: "2026-09-01",
                ongoing: true,
                category: "mind",
                type: "minor",
                icon: "Leaf",
                tags: ["Sustainability", "Research"],
                details: [
                    "Climate modeling and adaptation strategies",
                    "Circular economy and regenerative design",
                    "Water systems and ecological restoration",
                    "Integration with the Senior Project research",
                ],
            },
            {
                id: "personal-4",
                title: "Design & CAD Practice",
                description:
                    "Daily creative work: sketching, visual thinking and CAD skill development, connecting Studio Art to engineering design thinking.",
                when: "Daily practice",
                start: "2026-09-01",
                ongoing: true,
                category: "portfolio",
                type: "minor",
                icon: "Palette",
                tags: ["Creativity", "Skills", "CAD"],
                details: [
                    "The tool progression: SketchUp, then Revit, then Civil 3D",
                    "Concept sketching and technical drawing",
                    "Blender studies of real places, feeding the Recent Renovations section",
                    "A bridge between artistic and technical thinking",
                ],
            },
            {
                id: "personal-5",
                title: "Running & Cross-Country",
                description:
                    "Four years of running, and captain of the Cross Country and Track team this year. The plan keeps racing through both colleges.",
                when: "Year-round",
                start: "2026-09-01",
                ongoing: true,
                category: "athletics",
                type: "minor",
                icon: "Footprints",
                tags: ["Athletics", "Captain"],
                details: [
                    "Training built around the recruiting and college seasons",
                    "Daily progress over grinding: calm, paced and consistent",
                    "Staying as fit as possible: cardio and strength, not just running",
                ],
            },
            {
                id: "personal-6",
                title: "This Website",
                description:
                    "nateanderson.dev started as a portfolio and keeps evolving: an ever-improving personal site, and the home for renovation pieces and Blender studies.",
                when: "Always building",
                start: "2026-09-01",
                ongoing: true,
                category: "build",
                type: "minor",
                icon: "Code2",
                tags: ["Web", "Portfolio"],
                details: [
                    "Every change is public on the Site History page",
                    "New sections, pages and experiments ship continuously",
                ],
            },
            {
                id: "personal-7",
                title: "Poetry, Writing & Drawing",
                description:
                    "Writing about feelings is a core outlet: dark-romantic poetry, alongside drawing and other creative experiments.",
                when: "Ongoing",
                start: "2026-09-01",
                ongoing: true,
                category: "mind",
                type: "minor",
                icon: "PenLine",
                tags: ["Poetry", "Creative"],
                details: [
                    "Poetry and personal writing as regular practice",
                    "Drawing as a genuine creative outlet",
                    "Kept deliberately separate from the professional track: let it breathe",
                ],
            },
            {
                id: "personal-8",
                title: "Adventure & Travel",
                description:
                    "Deliberately enjoying life alongside the building: hiking, travel and time outdoors, especially before 20.",
                when: "Alongside everything",
                start: "2026-09-01",
                ongoing: true,
                category: "athletics",
                type: "minor",
                icon: "Mountain",
                tags: ["Outdoors", "Balance"],
                details: [
                    "Hiking, mountain biking and trips are part of the plan, not a reward for after it",
                    "Calm and paced, not grinding: burnout doesn't compound, progress does",
                ],
            },
            {
                id: "personal-9",
                title: "App Store Apps",
                description:
                    "A planned set of passion-project iOS apps, starting with a workout-gamification idea that turns real exercise into in-game progression.",
                when: "Someday soon",
                start: "2026-09-01",
                planned: true,
                category: "build",
                type: "minor",
                icon: "Smartphone",
                tags: ["iOS", "Gamification", "Planned"],
                details: [
                    "Steps and calories drive in-game progress and multipliers",
                    "Shares its progression design language with Fractured Islands",
                    "Idea stage: waiting on funding the Apple developer account",
                ],
            },
        ],
    },
];

export type EventStatus = "done" | "now" | "upcoming" | "ongoing" | "planned";

const DAY = 24 * 60 * 60 * 1000;

/** Today's calendar date in Pacific time ("YYYY-MM-DD"). Pinning the zone
 *  means the server (UTC) and every visitor's browser agree on what day it is. */
export function todayPT(now = Date.now()): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Los_Angeles",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(now);
}

/** Days since the epoch for an ISO date, using UTC arithmetic (no DST, no zone drift). */
export function dayNum(date: string): number {
    const [y, m, d] = date.split("-").map(Number);
    return Date.UTC(y, m - 1, d) / DAY;
}

export function getStatus(
    event: TimelineEventData,
    now = Date.now()
): EventStatus {
    if (event.planned) return "planned";
    if (event.ongoing) return "ongoing";
    const today = dayNum(todayPT(now));
    if (today > dayNum(event.end ?? event.start)) return "done";
    if (today >= dayNum(event.start)) return "now";
    return "upcoming";
}

/** 0–1: how far through a date range (inclusive) today is. */
export function progressBetween(
    start: string,
    end: string,
    now = Date.now()
): number {
    const s = dayNum(start);
    const e = dayNum(end) + 1;
    return Math.min(1, Math.max(0, (dayNum(todayPT(now)) - s) / (e - s)));
}

/** Whole days from today until `date` (0 = today, negative once passed). */
export function daysUntil(date: string, now = Date.now()): number {
    return dayNum(date) - dayNum(todayPT(now));
}

export function allEvents() {
    return phases.flatMap((phase) =>
        phase.events.map((event) => ({ ...event, phase }))
    );
}

/** The next few concrete steps, soonest first: anything upcoming, plus events
 *  already underway but short enough (about a quarter or less) to count as a
 *  "next step" rather than a year-long backdrop like the school year itself. */
export function getUpNext(limit = 4, now = Date.now()) {
    return allEvents()
        .filter((e) => {
            if (e.phase.id === "personal") return false;
            const status = getStatus(e, now);
            if (status === "upcoming") return true;
            if (status === "now")
                return dayNum(e.end ?? e.start) - dayNum(e.start) <= 92;
            return false;
        })
        .sort((a, b) => dayNum(a.start) - dayNum(b.start))
        .slice(0, limit);
}

export const JOURNEY_DAYS = dayNum(JOURNEY_END) + 1 - dayNum(JOURNEY_START);

const PT_PARTS = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
});

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** The current moment in Pacific time, with how far through the day, month,
 *  year and whole journey it is (all 0–1, down to the second). */
export function ptClock(now = Date.now()) {
    const p: Record<string, number> = {};
    for (const part of PT_PARTS.formatToParts(now)) {
        if (part.type !== "literal") p[part.type] = Number(part.value);
    }
    const { year, month, day, hour, minute, second } = p;
    const dayFrac = (hour * 3600 + minute * 60 + second) / 86400;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const daysInYear = isLeap(year) ? 366 : 365;
    const dayOfYear =
        (Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / DAY + 1;
    const todayNum = Date.UTC(year, month - 1, day) / DAY;
    const journeyFrac = Math.min(
        1,
        Math.max(0, (todayNum + dayFrac - dayNum(JOURNEY_START)) / JOURNEY_DAYS)
    );
    return {
        year,
        month,
        day,
        hour,
        minute,
        second,
        dayFrac,
        monthFrac: (day - 1 + dayFrac) / daysInMonth,
        yearFrac: (dayOfYear - 1 + dayFrac) / daysInYear,
        journeyFrac,
        daysInMonth,
        daysInYear,
        dayOfYear,
    };
}
