// Content for /about. Colors are Camino tokens (not hard-coded hex)
// so they follow the theme, and anything factual comes from Nate's own notes.
// Removed on purpose: the old page carried placeholder text ("[YOUR FAVORITE
// ESSAY…]", "[to fill]"), invented upcoming races with made-up target times,
// and a philosophy list claiming books were "read" that are still queued.

export type AboutIconName =
    | "Code2"
    | "Palette"
    | "Brain"
    | "Zap"
    | "Users"
    | "Leaf"
    | "Layers"
    | "Settings"
    | "Footprints"
    | "GraduationCap"
    | "Gamepad2"
    | "Globe";

// ------------------------------------------------------------------ skills

export type SkillCategory =
    "gamedev" | "design" | "web" | "engineering" | "leadership";

export const SKILL_CATEGORIES: Record<
    SkillCategory,
    { label: string; color: string }
> = {
    gamedev: { label: "Game Dev", color: "var(--cm-amber)" },
    design: { label: "Design", color: "var(--cm-cyan)" },
    web: { label: "Web Dev", color: "var(--cm-cyan)" },
    engineering: { label: "Engineering", color: "var(--cm-good)" },
    leadership: { label: "Leadership", color: "var(--cm-violet)" },
};

export interface Skill {
    name: string;
    /** 1–5 */
    level: number;
    description: string;
    icon: AboutIconName;
    category: SkillCategory;
}

export const LEVELS = [
    { label: "Learning", color: "var(--cm-alert)" },
    { label: "Intermediate", color: "var(--cm-amber)" },
    { label: "Proficient", color: "var(--cm-amber)" },
    { label: "Advanced", color: "var(--cm-good)" },
    { label: "Expert", color: "var(--cm-cyan)" },
];

export const skills: Skill[] = [
    {
        name: "Game Systems",
        level: 3,
        description:
            "Stat systems, progression mechanics, UI architecture and player engagement loops.",
        icon: "Zap",
        category: "gamedev",
    },
    {
        name: "CAD & SketchUp",
        level: 2,
        description:
            "Architectural design, space planning and landscape visualization for portfolio projects.",
        icon: "Palette",
        category: "design",
    },
    {
        name: "Digital Art",
        level: 3,
        description:
            "Illustration, concept art and design exploration across multiple mediums.",
        icon: "Palette",
        category: "design",
    },
    {
        name: "Tailwind CSS",
        level: 3,
        description:
            "Responsive design, utility-first workflows and custom theming with design tokens. This site runs on one.",
        icon: "Palette",
        category: "design",
    },
    {
        name: "Next.js & React",
        level: 3,
        description:
            "Full-stack web development, server components and static rendering. Built this whole site.",
        icon: "Code2",
        category: "web",
    },
    {
        name: "TypeScript",
        level: 3,
        description:
            "Type-safe architecture, type systems and component design patterns.",
        icon: "Code2",
        category: "web",
    },
    {
        name: "Systems Thinking",
        level: 4,
        description:
            "Interconnected mechanics, optimization and constraint identification, applied to game design and engineering alike.",
        icon: "Brain",
        category: "engineering",
    },
    {
        name: "Problem Solving",
        level: 4,
        description:
            "A debug-focused mindset, constraint thinking and creative solutions under pressure.",
        icon: "Brain",
        category: "engineering",
    },
    {
        name: "Environmental Design",
        level: 2,
        description:
            "Sustainable systems, landscape design and urban design principles (the Senior Project's focus).",
        icon: "Leaf",
        category: "engineering",
    },
    {
        name: "Project Planning",
        level: 3,
        description:
            "Roadmapping, milestone tracking, iterative development and an execution focus.",
        icon: "Brain",
        category: "engineering",
    },
    {
        name: "Leadership",
        level: 3,
        description:
            "Athletic team leadership, mentoring, discipline and resilience: captain of Cross Country and Track.",
        icon: "Users",
        category: "leadership",
    },
    {
        name: "Communication",
        level: 3,
        description:
            "Technical writing, design documentation and clear explanation of complex systems.",
        icon: "Users",
        category: "leadership",
    },
];

// -------------------------------------------------------------- philosophy

export const beliefs = [
    {
        title: "Agnosticism",
        color: "var(--cm-cyan)",
        description:
            "We can't know ultimate truths, but staying open to questioning matters. It shapes an empirical, systems-thinking approach.",
    },
    {
        title: "Egg Theory",
        color: "var(--cm-cyan)",
        description:
            "We are one consciousness experiencing itself subjectively. It informs a humane, interconnected worldview in design.",
    },
];

// From the Senior Project's design philosophy: what "authentic" design means.
export const designPrinciples = [
    {
        title: "Authenticity over trend",
        color: "var(--cm-violet)",
        description:
            "Solve what's actually broken, not what looks cool. If a space is empty because it's uncomfortable, adding benches and calling it fixed isn't a solution.",
    },
    {
        title: "Ethical design choices",
        color: "var(--cm-good)",
        description:
            "Every choice has consequences, and I own them: material impact, who can actually use the space, and who will maintain it.",
    },
    {
        title: "Constraints as forcing functions",
        color: "var(--cm-amber)",
        description:
            "Budget, land and climate limits don't cap creativity. They force honest solutions. Poor soil? Design for it.",
    },
    {
        title: "Community choice matters",
        color: "var(--cm-cyan)",
        description:
            "Design shapes what's possible: where the paths go, where people gather. If the space ends up empty, the design failed, however it looks.",
    },
];

// ---------------------------------------------------------------- building

export interface BuildingItem {
    title: string;
    color: string;
    status: string;
    description: string;
    href: string;
    cta: string;
}

export const building: BuildingItem[] = [
    {
        title: "sfvOS",
        color: "var(--cm-cyan)",
        status: "In development",
        description:
            "A live city builder on real San Fernando Valley open data: open a neighborhood, then rebuild its real streets, lots and buildings.",
        href: "/creations/sfvos",
        cta: "See the project",
    },
    {
        title: "This Website",
        color: "var(--cm-cyan)",
        status: "Always building",
        description:
            "A living project: renovation studies, design work and creations, changing in public with every commit.",
        href: "/history",
        cta: "Read the changelog",
    },
    {
        title: "College Path",
        color: "var(--cm-good)",
        status: "Senior year",
        description:
            "Freshman admission to Cal Poly SLO Construction Management or Cal Poly Pomona Construction Engineering & Management, with community college as the fallback.",
        href: "/timeline",
        cta: "Open the timeline",
    },
    {
        title: "Games for fun",
        color: "var(--cm-amber)",
        status: "Playable",
        description:
            "Small browser games I made on the side: Outline Guesser and Flag Guesser, each with a daily puzzle and an unlimited mode.",
        href: "/creations/games",
        cta: "Play them",
    },
];

// ----------------------------------------------------------------- running

export const runningStats = [
    { label: "XC 3-mile PR", value: "15:36", color: "var(--cm-amber)" },
    { label: "1600m", value: "4:36", color: "var(--cm-good)" },
    { label: "Years running", value: "4", color: "var(--cm-cyan)" },
    { label: "Role", value: "Captain", color: "var(--cm-violet)" },
];

export const runningPlan = [
    {
        when: "Now",
        title: "Captain of Cross Country & Track",
        detail: "Leading the team through senior year.",
        color: "var(--cm-violet)",
        href: "/timeline#personal-5",
    },
];
