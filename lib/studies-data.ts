// Single source of truth for /studies and /studies/[slug]. The course list
// and the course detail pages used to each hold their own copy of this data
// (with different color values), so they could drift; both now read from here.

import { KEY_DATES } from "@/lib/timeline-data";

export type StudyIconName =
    | "GraduationCap"
    | "PieChart"
    | "Microscope"
    | "Mic"
    | "Palette"
    | "Scale"
    | "BookOpen"
    | "Lightbulb"
    | "Leaf"
    | "Briefcase"
    | "Compass"
    | "Ruler";

export type StudyArea = "design" | "stem" | "civics";

export const STUDY_AREAS: Record<StudyArea, { label: string; color: string }> =
    {
        design: { label: "Design & Art", color: "var(--cm-violet)" },
        stem: { label: "Science & Math", color: "var(--cm-good)" },
        civics: { label: "Civics & Speaking", color: "var(--cm-cyan)" },
    };

export interface Course {
    slug: string;
    title: string;
    area: StudyArea;
    color: string;
    icon: StudyIconName;
    /** Short blurb for the card. */
    description: string;
    /** Longer intro for the course's own page. */
    fullDescription: string;
    tags: string[];
    focus: string[];
    goals: string[];
    /** Work and materials the class produces (not links). */
    materials: string[];
    timeline: string;
    status: "In Progress" | "Completed" | "Upcoming";
    /** Has an AP exam (or portfolio submission) in the May window. */
    ap: boolean;
    /** Timeline events (ids from lib/timeline-data) this class connects to. */
    related: string[];
}

export const AP_WINDOW = {
    label: "May 3 – 13, 2027",
    start: KEY_DATES.apStart,
    end: KEY_DATES.apEnd,
};

export const courses: Course[] = [
    {
        slug: "senior-project",
        title: "Senior Project",
        area: "design",
        color: "var(--cm-amber)",
        icon: "GraduationCap",
        description:
            "Landscape design and outdoor space transformation. Exploring how thoughtful design revitalizes neglected public spaces through evidence-based methodology.",
        fullDescription:
            "A comprehensive capstone exploring how thoughtful design can revitalize neglected public spaces. It combines research, evidence-based design methodology, user behavior analysis and systems thinking to create sustainable solutions for real places, grounded in a philosophy of authenticity over trend.",
        tags: ["Design", "Engineering", "Research", "Leadership", "Capstone"],
        focus: [
            "Public space design",
            "User behavior analysis",
            "Systems thinking",
            "Sustainable planning",
            "Stakeholder engagement",
        ],
        goals: [
            "Define an authentic problem, not just an attractive redesign",
            "Develop 2–3 design concepts that answer real constraints",
            "Produce portfolio-ready final design documentation",
            "Show how the design would actually be built and maintained",
            "Connect Kierkegaard's authenticity to design practice",
        ],
        materials: [
            "Site analysis and problem statement",
            "Design concepts and final specification",
            "Implementation plan",
            "Final presentation to stakeholders",
        ],
        timeline: "September 2026 – early June 2027",
        status: "In Progress",
        ap: false,
        related: ["hs-16", "hs-15", "hs-18", "hs-19", "hs-8"],
    },
    {
        slug: "ap-statistics",
        title: "AP Statistics",
        area: "stem",
        color: "var(--cm-alert)",
        icon: "PieChart",
        description:
            "Statistical analysis, probability, and data interpretation. Mastering quantitative reasoning for research and decision-making.",
        fullDescription:
            "Master quantitative reasoning through probability theory, statistical inference and data analysis. This course builds the mathematical foundation for research, environmental modeling and informed decision-making.",
        tags: ["Mathematics", "Data Analysis", "Research Methods", "AP Exam"],
        focus: [
            "Hypothesis testing",
            "Probability distributions",
            "Regression analysis",
            "Data visualization",
            "Experimental design",
        ],
        goals: [
            "Score 4–5 on the AP Statistics exam",
            "Master hypothesis testing procedures",
            "Build proficiency with regression analysis",
            "Apply statistics to environmental data",
        ],
        materials: [
            "Practice problem sets",
            "AP exam free-response archive",
            "Real-world datasets (Kaggle, Census)",
        ],
        timeline: "September 2026 – May 2027",
        status: "In Progress",
        ap: true,
        related: ["hs-1", "hs-7"],
    },
    {
        slug: "ap-biology",
        title: "AP Biology",
        area: "stem",
        color: "var(--cm-good)",
        icon: "Microscope",
        description:
            "Cellular and organismal biology, ecology, and genetics. Building foundational understanding of living systems and environmental interconnectedness.",
        fullDescription:
            "Build a foundational understanding of living systems and environmental interconnectedness. From cellular processes to ecosystem dynamics, this course emphasizes systems thinking and the interconnected nature of life.",
        tags: ["Life Sciences", "Laboratory", "Systems", "AP Exam", "Ecology"],
        focus: [
            "Cell structure and function",
            "Genetics and evolution",
            "Ecology and ecosystems",
            "Photosynthesis & respiration",
            "Energy flow in systems",
        ],
        goals: [
            "Score 4–5 on the AP Biology exam",
            "Master photosynthesis and cellular respiration",
            "Understand population and ecosystem dynamics",
            "Connect cellular biology to ecosystems and systems thinking",
        ],
        materials: [
            "Lab reports and data analysis",
            "Concept maps by unit",
            "AP exam free-response responses",
        ],
        timeline: "September 2026 – May 2027",
        status: "In Progress",
        ap: true,
        related: ["hs-1", "hs-7"],
    },
    {
        slug: "intro-communications",
        title: "Intro to Communications & Public Speaking",
        area: "civics",
        color: "var(--cm-cyan)",
        icon: "Mic",
        description:
            "Communication theory, interpersonal dynamics, and public speaking. Developing articulate presentation and persuasive messaging skills.",
        fullDescription:
            "Develop articulate presentation skills and authentic self-expression in professional and public contexts. Learn communication models, audience analysis and persuasive messaging techniques.",
        tags: [
            "Communication",
            "Public Speaking",
            "Interpersonal Skills",
            "Presentation",
        ],
        focus: [
            "Communication models",
            "Public speaking techniques",
            "Presentation design",
            "Audience analysis",
            "Persuasive messaging",
        ],
        goals: [
            "Deliver 5+ polished presentations",
            "Develop a confident public speaking voice",
            "Master audience analysis techniques",
            "Apply it to the Senior Project stakeholder presentation",
        ],
        materials: [
            "Speech recordings and feedback",
            "Presentation design templates",
            "Audience analysis worksheets",
        ],
        timeline: "September 2026 – May 2027",
        status: "In Progress",
        ap: false,
        related: ["hs-1", "hs-8"],
    },
    {
        slug: "ap-studio-art",
        title: "AP 2-D Studio Art",
        area: "design",
        color: "var(--cm-violet)",
        icon: "Palette",
        description:
            "Visual composition, design principles, and artistic expression. Developing a portfolio demonstrating conceptual depth and technical mastery.",
        fullDescription:
            "Develop a cohesive portfolio demonstrating conceptual depth and technical mastery. Explore design principles, media techniques and a personal artistic voice through sustained inquiry.",
        tags: ["Visual Arts", "Design", "Portfolio", "Creativity", "AP Exam"],
        focus: [
            "Composition and balance",
            "Color theory",
            "Drawing fundamentals",
            "Mixed media techniques",
            "Conceptual development",
        ],
        goals: [
            "Complete 12–15 portfolio pieces",
            "Develop 4–5 pieces in depth (the concentration)",
            "Demonstrate range across media and subjects",
            "Write a compelling artist statement",
            "Submit the AP portfolio for review",
        ],
        materials: [
            "Portfolio pieces (12–15 images)",
            "Media exploration studies",
            "Artist statement",
        ],
        timeline: "September 2026 – May 2027",
        status: "In Progress",
        ap: true,
        related: ["hs-6", "hs-7"],
    },
    {
        slug: "ap-government",
        title: "AP Government & Politics",
        area: "civics",
        color: "var(--cm-cyan)",
        icon: "Scale",
        description:
            "Constitutional law, political systems, and Supreme Court case studies. Understanding the mechanics of American democracy and civic governance.",
        fullDescription:
            "Understand American democracy through constitutional law, political systems and landmark Supreme Court decisions. Master the mechanisms that shape civic governance.",
        tags: ["Government", "Law", "Civics", "Politics", "AP Exam"],
        focus: [
            "Constitutional law & interpretation",
            "Supreme Court decisions & impact",
            "Political ideologies & systems",
            "Federalism & separation of powers",
            "Civil liberties & rights",
        ],
        goals: [
            "Score 4–5 on the AP Government exam",
            "Master 20+ key Supreme Court cases",
            "Understand constitutional principles",
            "Connect civic understanding to personal responsibility",
        ],
        materials: [
            "Supreme Court case briefs",
            "Constitutional framework guide",
            "AP exam free-response archive",
        ],
        timeline: "September 2026 – May 2027",
        status: "In Progress",
        ap: true,
        related: ["hs-1", "hs-7"],
    },
];

export const courseBySlug = Object.fromEntries(
    courses.map((c) => [c.slug, c])
) as Record<string, Course>;

// ---------------------------------------------------------------- pathway

export interface Program {
    title: string;
    color: string;
    icon: StudyIconName;
    description: string;
    institution?: string;
    timeline: string;
    courses: string[];
}

export interface PathwayStage {
    /** Matches a phase id in lib/timeline-data (for dates and progress). */
    phaseId: "high-school" | "college";
    title: string;
    blurb: string;
    color: string;
    icon: StudyIconName;
    programs: Program[];
}

export const pathway: PathwayStage[] = [
    {
        phaseId: "high-school",
        title: "Senior Year",
        blurb: "Six interdisciplinary classes, the Senior Project and the CSU applications.",
        color: "var(--cm-cyan)",
        icon: "BookOpen",
        // The classes themselves are the explorer above; this stage just
        // anchors the pathway.
        programs: [],
    },
    {
        phaseId: "college",
        title: "Cal Poly SLO or Pomona",
        blurb: "Construction Management at SLO is the focus. Construction Engineering & Management at Pomona is the fallback.",
        color: "var(--cm-good)",
        icon: "Compass",
        programs: [
            {
                title: "Construction Management",
                color: "var(--cm-cyan)",
                icon: "GraduationCap",
                description:
                    "Cal Poly SLO's ACCE-accredited B.S. in Construction Management, 123 units. The focus of the plan.",
                institution: "Cal Poly San Luis Obispo",
                timeline: "Fall 2027 – June 2031 (4 years)",
                courses: [
                    "Calculus I",
                    "General Physics I",
                    "Structural Principles I",
                    "Intro to Structural Systems",
                ],
            },
            {
                title: "Construction Engineering & Management",
                color: "var(--cm-good)",
                icon: "Leaf",
                description:
                    "Cal Poly Pomona's B.S. in Construction Engineering and Management, 124 units. The fallback, and more engineering-heavy.",
                institution: "Cal Poly Pomona",
                timeline: "Fall 2027 – June 2031 (4 years)",
                courses: [
                    "Calculus I-III",
                    "Linear Algebra & Differential Equations",
                    "Physics I-II and Chemistry",
                    "Statics",
                ],
            },
        ],
    },
];

// --------------------------------------------------------------- personal

export const personalStudies: Program[] = [
    {
        title: "Philosophy & Existentialism",
        color: "color-mix(in oklch, var(--cm-violet) 60%, white)",
        icon: "BookOpen",
        description:
            "Independent study of Kierkegaard, Sartre and existential philosophy. How do authentic philosophical frameworks inform design practice and ethical decision-making?",
        timeline: "Ongoing",
        courses: ["Kierkegaard", "Existentialism", "Design Ethics"],
    },
    {
        title: "Sustainable Systems Research",
        color: "var(--cm-good)",
        icon: "Leaf",
        description:
            "Climate adaptation strategies, circular design and regenerative systems, connecting personal research to the Senior Project and future engineering work.",
        timeline: "Fall 2026 – ongoing",
        courses: ["Climate Modeling", "Regenerative Design", "Water Systems"],
    },
    {
        title: "Design & Creativity Practice",
        color: "var(--cm-amber)",
        icon: "Palette",
        description:
            "Sketching, visual thinking and design iteration: daily creative practice connecting Studio Art to engineering design thinking.",
        timeline: "Daily practice",
        courses: ["Digital Design Tools", "SketchUp", "CAD Fundamentals"],
    },
];

export type ReadingStatus = "reading" | "next" | "planned" | "reference";

export interface ReadingItem {
    title: string;
    author?: string;
    status: ReadingStatus;
    note: string;
}

export const READING_STATUS: Record<
    ReadingStatus,
    { label: string; color: string }
> = {
    reading: { label: "Reading now", color: "var(--cm-good)" },
    next: { label: "Up next", color: "var(--cm-cyan)" },
    planned: { label: "Planned", color: "var(--cm-amber)" },
    reference: { label: "Reference", color: "var(--cm-violet)" },
};

export const readingQueue: ReadingItem[] = [
    {
        title: "Fear and Trembling",
        author: "Søren Kierkegaard",
        status: "reading",
        note: "Faith, courage and the absurd: a study in commitment and decision-making.",
    },
    {
        title: "Either/Or",
        author: "Søren Kierkegaard",
        status: "next",
        note: "The aesthetic versus the ethical way of living, and a lens on authentic design.",
    },
    {
        title: "The Concept of Anxiety",
        author: "Søren Kierkegaard",
        status: "planned",
        note: "Anxiety as the dizziness of freedom, relevant to designing under uncertainty.",
    },
    {
        title: "Being and Nothingness",
        author: "Jean-Paul Sartre",
        status: "reference",
        note: "The foundational text of existentialism, kept close for reference.",
    },
    {
        title: "Sustainable Design texts",
        status: "planned",
        note: "Planned for college, alongside the math and physics.",
    },
    {
        title: "Environmental ethics & climate adaptation",
        status: "planned",
        note: "Literature connecting responsibility to real infrastructure decisions.",
    },
];

export interface SkillStage {
    label: string;
    when: string;
    color: string;
    icon: StudyIconName;
    skills: string[];
}

export const toolRoadmap: SkillStage[] = [
    {
        label: "Now",
        when: "2026 – 2027",
        color: "var(--cm-amber)",
        icon: "Palette",
        skills: [
            "SketchUp basics",
            "Concept sketching",
            "Portfolio documentation",
        ],
    },
    {
        label: "College years",
        when: "2027 – 2031",
        color: "var(--cm-cyan)",
        icon: "Ruler",
        skills: [
            "Construction scheduling",
            "Cost estimating",
            "Contracts and project management",
        ],
    },
];
