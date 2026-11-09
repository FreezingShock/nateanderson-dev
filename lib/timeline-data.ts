// Single source of truth for the /timeline page (and anything else that needs
// to know the plan): phases, events, real dates and the helpers that turn
// dates into status/progress. Edit here and the whole page follows.
//
// Dates are ISO (YYYY-MM-DD). `start`/`end` drive status ("done", "now",
// "upcoming") and progress, so keep them accurate; `when` is only the human
// label on the card. Events render in the order listed, so keep each phase
// chronological. `special: true` marks the super-special milestones that get
// the animated rainbow ("chroma") treatment.

export type PhaseId = "high-school" | "college" | "personal";

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
            "The final year before college. Six interdisciplinary courses, college applications, the Senior Project, AP exams and graduation, all pointed at a construction management and engineering path.",
        color: "var(--cm-cyan)",
        icon: "BookOpen",
        start: "2026-09-01",
        end: "2027-08-31",
        events: [
            {
                id: "hs-1",
                title: "Senior Year Begins",
                description:
                    "Six courses (Senior Project, AP Stats, AP Bio, Communications, Studio Art, AP Gov), with Kierkegaard's philosophy applied to design work.",
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
                id: "hs-2",
                title: "Essays & Recommendation Letters",
                description:
                    "Getting the application story written down before the CSU Apply deadline.",
                when: "October 2026",
                start: "2026-10-01",
                end: "2026-10-31",
                category: "applications",
                type: "minor",
                icon: "PenLine",
                tags: ["Essays", "Applications"],
                details: [
                    "Draft the CSU Apply personal insight responses by the end of October",
                    "Ask two teachers who know my ambitions for recommendation letters by mid-October",
                ],
            },
            {
                id: "hs-12",
                title: "College Plan Checks",
                description:
                    "Confirming the SLO Construction Management and Pomona CEM requirements before the applications go in.",
                when: "October 2026",
                start: "2026-10-01",
                end: "2026-10-31",
                category: "applications",
                type: "minor",
                icon: "Compass",
                tags: ["Transfer", "Planning"],
                details: [
                    "Email SLO admissions for the Construction Management admit rate",
                    "Book a student-led SLO tour with the Architecture & Environmental Design visit",
                    "Ask my counselor about adding calculus and physics senior year",
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
                title: "CSU Apply Deadline",
                description:
                    "Submit CSU Apply to Cal Poly SLO (Construction Management) and Cal Poly Pomona (Construction Engineering & Management).",
                when: "Nov 2026",
                start: "2026-11-01",
                end: "2026-11-30",
                category: "applications",
                type: "major",
                icon: "Send",
                tags: ["CSU Apply", "Applications"],
                details: [
                    "Target submission: November 20",
                    "Hard deadline: November 30",
                    "Financial aid: FAFSA or Dream Act filed by December 15, then Cal Grant GPA verification by March 2",
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
                title: "Admit Decisions",
                description:
                    "Admit decisions arrive from SLO and Pomona. The choice is made by May 1.",
                when: "Mar — May 2027",
                start: "2027-03-01",
                end: "2027-05-01",
                category: "applications",
                type: "major",
                icon: "CheckCircle",
                tags: ["Decisions", "Applications"],
                details: [
                    "Choose by May 1, 2027",
                    "Pomona CEM is the fallback if SLO says no",
                    "Moorpark community college is the spring alternate if neither works out",
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
                    "College decision made: SLO Construction Management or Pomona CEM",
                    "Ready for the first day at SLO or Pomona",
                ],
            },
            {
                id: "hs-10",
                title: "Summer Before College",
                description:
                    "The runway between graduation and the first day of college: orientation, registration and housing.",
                when: "Summer 2027",
                start: "2027-06-11",
                end: "2027-08-31",
                category: "athletics",
                type: "minor",
                icon: "Sun",
                tags: ["Prep", "Running"],
                details: [
                    "Placement, orientation and registration",
                    "Housing or commute plan settled",
                ],
            },
        ],
    },
    {
        id: "college",
        title: "College: Cal Poly SLO or Cal Poly Pomona",
        short: "College",
        range: "September 2027 — June 2031",
        description:
            "Freshman admission to Cal Poly SLO Construction Management, with Cal Poly Pomona Construction Engineering & Management as the fallback. Both are four-year degrees. Community college is the spring alternate.",
        color: "var(--cm-good)",
        icon: "Rocket",
        start: "2027-09-01",
        end: "2031-06-30",
        events: [
            {
                id: "col-1",
                title: "Freshman Year",
                description:
                    "Move in at whichever school admits, and start the math and physics chain right away.",
                when: "Fall 2027",
                start: "2027-09-01",
                end: "2027-12-20",
                category: "academics",
                type: "major",
                icon: "Rocket",
                tags: ["Freshman", "Calculus", "Physics"],
                details: [
                    "SLO Construction Management: Calculus I and General Physics I",
                    "Pomona CEM: Calculus I-III, differential equations, two physics courses and chemistry",
                ],
            },
            {
                id: "col-2",
                title: "First Summer Internship",
                description:
                    "The first real job experience in the field, placed through the program.",
                when: "Summer 2028",
                start: "2028-06-01",
                end: "2028-08-31",
                category: "career",
                type: "minor",
                icon: "Briefcase",
                tags: ["Internship", "Career"],
            },
            {
                id: "col-3",
                title: "Second Summer Internship",
                description: "A second summer in the field, building on the first.",
                when: "Summer 2029",
                start: "2029-06-01",
                end: "2029-08-31",
                category: "career",
                type: "minor",
                icon: "Briefcase",
                tags: ["Internship", "Career"],
            },
            {
                id: "col-4",
                title: "Senior Project",
                description:
                    "The senior project in the final year before graduation.",
                when: "Fall 2030",
                start: "2030-09-01",
                end: "2030-12-20",
                category: "portfolio",
                type: "major",
                icon: "Zap",
                tags: ["Capstone", "Senior Year"],
            },
            {
                id: "col-5",
                title: "Graduation",
                description:
                    "The bachelor's degree: B.S. Construction Management from SLO, or B.S. Construction Engineering & Management from Pomona.",
                when: "June 2031",
                start: "2031-06-01",
                end: "2031-06-30",
                category: "milestone",
                type: "major",
                icon: "GraduationCap",
                special: true,
                tags: ["Graduation", "Degree"],
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
