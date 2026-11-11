import { px, type PixelComponent } from "@/components/cm/pixel-icons";

const Ic = {
    Brush: px("brush"),
    CalendarDays: px("calendar"),
    Code2: px("code"),
    Flag: px("flag"),
    Gamepad2: px("gamepad"),
    Hammer: px("hammer"),
    InfinityIcon: px("infinity"),
    Map: px("map"),
    Palette: px("palette"),
    Pencil: px("pen"),
    Boxes: px("boxes"),
};

// Everything on the Creations pages that isn't a Supabase project row.
// Server-only: icons are component references, which can't cross into
// client components (the pages render them as elements).
// Edit titles and blurbs here and every page updates.

export interface CreationCategory {
    id: "games" | "projects" | "renovations" | "artwork";
    href: string;
    title: string;
    color: string;
    icon: PixelComponent;
    blurb: string;
    tags: string[];
}

export const CATEGORIES: CreationCategory[] = [
    {
        id: "games",
        href: "/creations/games",
        title: "Web App Games",
        color: "var(--cm-good)",
        icon: Ic.Gamepad2,
        blurb: "Playable in the browser: daily puzzles, unlimited practice, incremental progression and tycoon games.",
        tags: ["Daily", "Unlimited", "Incremental", "Tycoon"],
    },
    {
        id: "projects",
        href: "/creations/projects",
        title: "Projects",
        color: "var(--cm-cyan)",
        icon: Ic.Code2,
        blurb: "Coding projects: solo-built, systems-driven, shipped or in progress.",
        tags: ["Coding", "Games", "Systems"],
    },
    {
        id: "renovations",
        href: "/creations/renovations",
        title: "Renovations",
        color: "var(--cm-amber)",
        icon: Ic.Hammer,
        blurb: "Real places studied, measured, modeled and redesigned to be greener and more inviting.",
        tags: ["3D", "Design"],
    },
    {
        id: "artwork",
        href: "/creations/artwork",
        title: "Artwork",
        color: "var(--cm-violet)",
        icon: Ic.Palette,
        blurb: "The AP Art portfolio, 3D renders and drawings: the creative side of the engineering work.",
        tags: ["AP Art", "3D", "Drawing"],
    },
];

export const categoryById = (id: CreationCategory["id"]) =>
    CATEGORIES.find((c) => c.id === id)!;

// ---- Outside links for Supabase project rows ----
// The projects query doesn't read an href column, so a project that lives somewhere else gets its link here, keyed by
// the row's slug. Keep the slug in sync with the row in public.projects.

// ---- Case-study screenshots for project pages ----
// The first shot is the large lead image; the rest form the gallery. Files live in public/creations/<slug>/.

export interface ProjectShot {
    src: string;
    alt: string;
    caption: string;
}

export const PROJECT_GALLERY: Record<string, ProjectShot[]> = {
    nexus: [
        {
            src: "/creations/nexus/buildings.webp",
            alt: "Nexus in play: a small town by a river, with the build menu open on cottages, terrace houses and towers.",
            caption: "The build menu. Roads, zones, buildings, services, parks and terrain sit along the bottom, with coins and residents at the top.",
        },
        {
            src: "/creations/nexus/welcome.webp",
            alt: "The Nexus title screen: a Hello, new mayor panel with a Start my town button over an isometric village.",
            caption: "The title screen. A small village by the river is waiting for a mayor.",
        },
    ],
    deepstack: [
        {
            src: "/creations/deepstack/carry-word-desk.webp",
            alt: "Deepstack on desktop: the word paleontology, with a text box to write the definition in your own words.",
            caption: "A word on the desk. Write its meaning in your own words before the candle burns down.",
        },
        {
            src: "/creations/deepstack/landing-desk.webp",
            alt: "Deepstack on desktop: the landing between words, offering three ways on, with the depth and floor shown at the top.",
            caption: "The landing between words. Each choice costs something, and the next floor shows up in the sidebar.",
        },
    ],
};

export const PROJECT_LINKS: Record<string, { href: string; label: string }> = {
    "nexus": { href: "https://playnexus.dev", label: "Play on playnexus.dev" },
    "sfvos": { href: "https://github.com/FreezingShock/sfvOS", label: "View the code on GitHub" },
    "deepstack": { href: "https://github.com/FreezingShock/Deepstack", label: "View the code on GitHub" },
};

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
    icon: PixelComponent;
    blurb: string;
    features: string[];
    /** Set only for games that actually have a route. */
    href?: string;
}

export interface GameMode {
    id: "daily" | "unlimited" | "incremental" | "tycoon";
    title: string;
    color: string;
    icon: PixelComponent;
    tagline: string;
    about: string;
    games: Game[];
}

export const GAME_MODES: GameMode[] = [
    {
        id: "daily",
        title: "Daily Games",
        color: "var(--cm-amber)",
        icon: Ic.CalendarDays,
        tagline: "One puzzle a day, the same for everyone.",
        about: "A new puzzle every day at midnight Pacific. Guess, share your result, come back tomorrow. Streaks and stats stay in your browser.",
        games: [
            {
                slug: "daily-outline",
                title: "Daily Outline",
                status: "playable",
                icon: Ic.Map,
                blurb: "One country outline a day, the same for everyone. Six guesses with distance, direction and closeness.",
                features: ["238 countries and territories", "Streaks and stats", "Shareable result"],
                href: "/creations/games/outline-guesser?mode=daily",
            },
            {
                slug: "daily-flag",
                title: "Daily Flag",
                status: "playable",
                icon: Ic.Flag,
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
        icon: Ic.InfinityIcon,
        tagline: "Practice mode: as many rounds as you want.",
        about: "The same guessing games with no daily limit, for learning and high scores. Rounds are quick and everything runs in the browser.",
        games: [
            {
                slug: "flag-guesser",
                title: "Flag Guesser",
                status: "playable",
                icon: Ic.Flag,
                blurb: "Endless mystery flags from all 239 countries and territories, with difficulty and region filters, tile-flip reveals and hints.",
                features: ["All 239 flags", "Difficulty and region filters", "Hints and give up"],
                href: "/creations/games/flag-guesser",
            },
            {
                slug: "outline-guesser",
                title: "Outline Guesser",
                status: "playable",
                icon: Ic.Map,
                blurb: "Endless country outlines: every country, island and territory, with arrows, distances, hints and a give-up button.",
                features: ["Hints and give up", "km or miles", "Stats"],
                href: "/creations/games/outline-guesser",
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
    icon: PixelComponent;
    blurb: string;
    slots: string[];
}

export const ART_COLLECTIONS: ArtCollection[] = [
    {
        id: "ap-art",
        title: "AP Art Portfolio",
        color: "var(--cm-violet)",
        icon: Ic.Brush,
        blurb: "The Sustained Investigation and Selected Works for AP Art and Design, with the thinking behind each piece.",
        slots: ["Sustained Investigation 1", "Sustained Investigation 2", "Sustained Investigation 3", "Selected Work 1", "Selected Work 2", "Selected Work 3"],
    },
    {
        id: "blender",
        title: "3D Renders",
        color: "var(--cm-cyan)",
        icon: Ic.Boxes,
        blurb: "3D renders: renovation studies, environments and experiments.",
        slots: ["Environment study", "Material test", "Lighting study", "Model breakdown", "Wireframe"],
    },
    {
        id: "drawings",
        title: "Drawings",
        color: "var(--cm-amber)",
        icon: Ic.Pencil,
        blurb: "Sketches and finished drawings, traditional and digital.",
        slots: ["Sketchbook page", "Figure study", "Landscape", "Ink drawing", "Digital piece", "Doodle"],
    },
];
