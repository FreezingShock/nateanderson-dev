import {
    Brush,
    Building2,
    CalendarDays,
    Castle,
    Code2,
    Flag,
    Gamepad2,
    Hammer,
    Infinity as InfinityIcon,
    Map,
    Palette,
    Pencil,
    Repeat,
    Sprout,
    Type,
    Boxes,
    TrendingUp,
    Landmark,
    type LucideIcon,
} from "lucide-react";

// Everything on the Creations pages that isn't a Supabase project row.
// Server-only: icons are component references, which can't cross into
// client components (the pages render them as elements).
// Titles and blurbs for games and artwork are WORKING PLACEHOLDERS: edit
// them here and every page updates.

export interface CreationCategory {
    id: "games" | "projects" | "renovations" | "artwork";
    href: string;
    title: string;
    color: string;
    icon: LucideIcon;
    blurb: string;
    tags: string[];
}

export const CATEGORIES: CreationCategory[] = [
    {
        id: "games",
        href: "/creations/games",
        title: "Web App Games",
        color: "var(--cm-good)",
        icon: Gamepad2,
        blurb: "Playable in the browser, right here on the site: daily puzzles, unlimited practice, incremental progression and tycoon games.",
        tags: ["Daily", "Unlimited", "Incremental", "Tycoon"],
    },
    {
        id: "projects",
        href: "/creations/projects",
        title: "Projects",
        color: "var(--cm-cyan)",
        icon: Code2,
        blurb: "Coding and Roblox projects: solo-built, systems-driven, shipped and in progress.",
        tags: ["Coding", "Roblox", "Systems"],
    },
    {
        id: "renovations",
        href: "/creations/renovations",
        title: "Renovations",
        color: "var(--cm-amber)",
        icon: Hammer,
        blurb: "Real places studied, measured, modeled and redesigned to be greener and more inviting, starting with Topanga Willows.",
        tags: ["Topanga Willows", "Blender", "Design"],
    },
    {
        id: "artwork",
        href: "/creations/artwork",
        title: "Artwork",
        color: "var(--cm-violet)",
        icon: Palette,
        blurb: "The AP Art portfolio, Blender renders and drawings: the creative practice around the engineering.",
        tags: ["AP Art", "Blender", "Drawing"],
    },
];

export const categoryById = (id: CreationCategory["id"]) =>
    CATEGORIES.find((c) => c.id === id)!;

// ---- Philosophy (draft copy: Nate to rewrite in his own voice) ----

export interface Principle {
    title: string;
    color: string;
    text: string;
}

export const PRINCIPLES: Principle[] = [
    {
        title: "Systems over screens",
        color: "var(--cm-cyan)",
        text: "Every project starts as a system: inputs, loops, feedback. The interface comes second. Good systems are still fun when nobody is looking.",
    },
    {
        title: "Play is how I learn",
        color: "var(--cm-good)",
        text: "Games are the fastest way to make an idea stick, mine or anyone else's. If I can turn something into a loop worth repeating, I understand it.",
    },
    {
        title: "Build small, ship, grow",
        color: "var(--cm-amber)",
        text: "One playable thing beats ten perfect plans. Each creation ships small and earns its next feature by being used.",
    },
    {
        title: "Real places, real care",
        color: "var(--cm-violet)",
        text: "Renovation studies point the same skills at the physical world: measure it honestly, model it, then make it greener.",
    },
];

// ---- Games ----

export type GameStatus = "playable" | "building" | "planned";

export const GAME_STATUS: Record<GameStatus, { label: string; color: string }> = {
    playable: { label: "Playable", color: "var(--cm-good)" },
    building: { label: "In Development", color: "var(--cm-amber)" },
    planned: { label: "Planned", color: "var(--cm-violet)" },
};

export interface Game {
    slug: string;
    title: string;
    status: GameStatus;
    icon: LucideIcon;
    blurb: string;
    features: string[];
    /** Set only for games that actually have a route. */
    href?: string;
}

export interface GameMode {
    id: "daily" | "unlimited" | "incremental" | "tycoon";
    title: string;
    color: string;
    icon: LucideIcon;
    tagline: string;
    about: string;
    games: Game[];
}

export const GAME_MODES: GameMode[] = [
    {
        id: "daily",
        title: "Daily Games",
        color: "var(--cm-amber)",
        icon: CalendarDays,
        tagline: "One puzzle a day, the same for everyone.",
        about: "A new puzzle every day at midnight Pacific. Guess, share your result, come back tomorrow. Streaks and stats stay in your browser.",
        games: [
            {
                slug: "daily-word",
                title: "Daily Word",
                status: "planned",
                icon: Type,
                blurb: "A Wordle-style five-letter word, with a site-themed twist.",
                features: ["6 guesses", "Streak tracking", "Shareable result grid"],
            },
            {
                slug: "daily-outline",
                title: "Daily Outline",
                status: "playable",
                icon: Map,
                blurb: "One country outline a day, the same for everyone. Six guesses with distance, direction and closeness.",
                features: ["238 countries and territories", "Streaks and stats", "Shareable result"],
                href: "/creations/games/outline-guesser?mode=daily",
            },
            {
                slug: "daily-flag",
                title: "Daily Flag",
                status: "playable",
                icon: Flag,
                blurb: "One mystery flag a day, the same for everyone, revealed one tile at a time with distance and direction clues.",
                features: ["Tile-flip reveal", "3 hints", "Streaks and stats"],
                href: "/creations/games/flag-guesser?mode=daily",
            },
        ],
    },
    {
        id: "unlimited",
        title: "Unlimited Games",
        color: "var(--cm-cyan)",
        icon: InfinityIcon,
        tagline: "Practice mode: as many rounds as you want.",
        about: "The same guessing games with no daily limit, for learning and high scores. Rounds are quick and everything runs in the browser.",
        games: [
            {
                slug: "flag-guesser",
                title: "Flag Guesser",
                status: "playable",
                icon: Flag,
                blurb: "Endless mystery flags from all 239 countries and territories, with difficulty and region filters, tile-flip reveals and hints.",
                features: ["All 239 flags", "Difficulty and region filters", "Hints and give up"],
                href: "/creations/games/flag-guesser",
            },
            {
                slug: "outline-guesser",
                title: "Outline Guesser",
                status: "playable",
                icon: Map,
                blurb: "Endless country outlines: every country, island and territory, with arrows, distances, hints and a give-up button.",
                features: ["Hints and give up", "km or miles", "Stats"],
                href: "/creations/games/outline-guesser",
            },
            {
                slug: "capital-quiz",
                title: "Capital Quiz",
                status: "planned",
                icon: Landmark,
                blurb: "Match capitals to countries at speed.",
                features: ["Multiple choice and typed", "Continent packs"],
            },
        ],
    },
    {
        id: "incremental",
        title: "Incremental Progression Games",
        color: "var(--cm-violet)",
        icon: Repeat,
        tagline: "Numbers go up, systems unlock, progress persists.",
        about: "Slow-burn progression games that live on this site. Come back, collect, upgrade, prestige. The long-term goal is a small universe of connected incremental games sharing one save.",
        games: [
            {
                slug: "eco-loop",
                title: "Eco Loop",
                status: "planned",
                icon: Sprout,
                blurb: "Restore a dead landscape one system at a time: soil, water, plants, wildlife.",
                features: ["Interlocking resource loops", "Environmental engineering themes"],
            },
        ],
    },
    {
        id: "tycoon",
        title: "Tycoon Games",
        color: "var(--cm-amber)",
        icon: TrendingUp,
        tagline: "Build it, run it, balance the books.",
        about: "Management games where economy and design decisions compound. Planned to borrow from real renovation and civil-engineering ideas.",
        games: [
            {
                slug: "green-city",
                title: "Green City Tycoon",
                status: "planned",
                icon: Building2,
                blurb: "Grow a city without wrecking the watershed.",
                features: ["Zoning and utilities", "Sustainability score"],
            },
            {
                slug: "reno-tycoon",
                title: "Renovation Tycoon",
                status: "planned",
                icon: Castle,
                blurb: "Buy, redesign and flip run-down spaces into thriving ones.",
                features: ["Budget vs. vision", "Ties to the renovation studies"],
            },
        ],
    },
];

export const allGames = () => GAME_MODES.flatMap((m) => m.games);

// ---- Artwork (placeholders: drop real images in later) ----

export interface ArtCollection {
    id: string;
    title: string;
    color: string;
    icon: LucideIcon;
    blurb: string;
    slots: string[];
}

export const ART_COLLECTIONS: ArtCollection[] = [
    {
        id: "ap-art",
        title: "AP Art Portfolio",
        color: "var(--cm-violet)",
        icon: Brush,
        blurb: "The Sustained Investigation and Selected Works for AP Art and Design, with the thinking behind each piece.",
        slots: ["Sustained Investigation 1", "Sustained Investigation 2", "Sustained Investigation 3", "Selected Work 1", "Selected Work 2", "Selected Work 3"],
    },
    {
        id: "blender",
        title: "Blender Renders",
        color: "var(--cm-cyan)",
        icon: Boxes,
        blurb: "3D renders: renovation studies, environments and experiments.",
        slots: ["Topanga Willows", "Environment study", "Material test", "Lighting study", "Model breakdown", "Wireframe"],
    },
    {
        id: "drawings",
        title: "Drawings",
        color: "var(--cm-amber)",
        icon: Pencil,
        blurb: "Sketches and finished drawings, traditional and digital.",
        slots: ["Sketchbook page", "Figure study", "Landscape", "Ink drawing", "Digital piece", "Doodle"],
    },
];
