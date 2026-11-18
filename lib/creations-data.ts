import { px, type PixelComponent } from "@/components/cm/pixel-icons";
import { LEDGER_NAME } from "@/lib/ledger/name";

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
    Sun: px("sun"),
    Pencil: px("pen"),
    Boxes: px("boxes"),
    Brain: px("brain"),
    Crane: px("crane"),
    Layers: px("layers"),
    Settings: px("settings"),
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
        blurb: "Playable in the browser, sorted into geography, incremental and automation games.",
        tags: ["Geography", "Incremental", "Automation"],
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

// ---- Live previews: a project that runs in the browser is embedded on its page, not only linked ----
// Only sites that allow framing belong here (no X-Frame-Options or frame-ancestors that block this origin).

export const PROJECT_PREVIEW: Record<string, { src: string; title: string }> = {
    nexus: { src: "https://playnexus.dev", title: "Nexus, live" },
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
    /** How the game is played, shown as a tag on its card. */
    format?: "Daily" | "Unlimited" | "Daily + Unlimited";
    /** Set only for games that actually have a route. */
    href?: string;
    /** Card screenshot under /public. Real captures of the built game, 960 by 600. */
    shot?: string;
    /** The game's own colour, used on its hub card only. */
    accent?: string;
    /** Short labels for the card's tag panels. Shortened from `features`. */
    tags?: string[];
}

export interface GameMode {
    /** Section id on the Games hub; also the #anchor the Creations overview links to. */
    id: "geography" | "puzzle" | "incremental" | "automation";
    title: string;
    color: string;
    icon: PixelComponent;
    tagline: string;
    about: string;
    /** Shown in place of cards while a section has no playable game. Never filler cards. */
    coming?: string;
    games: Game[];
}

export const GAME_MODES: GameMode[] = [
    {
        id: "geography",
        title: "Geography",
        color: "var(--cm-cyan)",
        icon: Ic.Map,
        tagline: "Geography games, right here in your browser.",
        about: "A new daily puzzle at midnight Pacific. Finish one and its unlimited practice opens too. Streaks and stats stay in your browser.",
        games: [
            {
                slug: "flag-guesser",
                title: "Flag Guesser",
                status: "playable",
                icon: Ic.Flag,
                format: "Daily + Unlimited",
                blurb: "A mystery flag a day, the same for everyone, then endless flags from all 239 countries and territories once you finish a daily.",
                features: ["Tile-flip reveal", "Daily puzzle, then unlimited", "Difficulty and region filters"],
                href: "/creations/games/flag-guesser",
                shot: "/games/shots/flag-guesser.webp",
                accent: "#2fd8e8",
                tags: ["Tile flip", "3 hints", "Daily + unlimited"],
            },
            {
                slug: "outline-guesser",
                title: "Outline Guesser",
                status: "playable",
                icon: Ic.Map,
                format: "Daily + Unlimited",
                blurb: "A country outline a day, the same for everyone, then endless outlines of every country, island and territory once you finish a daily.",
                features: ["Daily puzzle, then unlimited", "Neighbours and flag rounds", "km or miles"],
                href: "/creations/games/outline-guesser",
                shot: "/games/shots/outline-guesser.webp",
                accent: "#2fd8e8",
                tags: ["238 countries", "Daily + unlimited", "km or mi"],
            },
            // gen-anchor: games:geography
        ],
    },
    {
        id: "puzzle",
        title: "Puzzle",
        color: "var(--cm-amber)",
        icon: Ic.Brain,
        tagline: "One puzzle a day, the same for everyone.",
        about: "Word and number puzzles with a new one at midnight Pacific. Finish a daily and its unlimited practice opens too. Streaks and stats stay in your browser.",
        coming: "The first daily puzzles are in development. They go live in this section when they are playable.",
        games: [
            // puzzle-card: word (insert the word puzzle's card ABOVE this line)
            // The two markers sit on separate lines on purpose, so two branches adding a card here do not conflict.
            {
                slug: "ledger",
                title: LEDGER_NAME,
                status: "playable",
                icon: px("book"),
                format: "Daily + Unlimited",
                blurb: "Six numbers and a target on an adding-machine tape. Combine them with + - x and /, one step at a time. A new puzzle a day, the same for everyone, then endless ones once you finish a daily.",
                features: ["Adding-machine tape", "Daily puzzle, then unlimited", "Keyboard and touch"],
                href: "/creations/games/ledger",
                shot: "/games/shots/ledger.webp",
                accent: "#7fd6a4",
                tags: ["6 numbers", "Daily + unlimited", "6 entries"],
            },
            // puzzle-card: number (insert the number puzzle's card ABOVE this line)
        ],
    },
    {
        id: "incremental",
        title: "Incremental",
        color: "var(--cm-good)",
        icon: Ic.Layers,
        tagline: "Idle games that keep growing while you're away.",
        about: "Buttons, multipliers and resets, with progress saved in your browser. Close the tab and your progress keeps earning, up to a limit.",
        coming: "The next incremental game is in development. It goes live in this section when it is playable.",
        games: [
            {
                slug: "node-farm",
                title: "Node Farm",
                status: "playable",
                icon: Ic.Boxes,
                blurb: "Hack a core, buy button tiers for Multipliers and Reboots, then farm Copper, Silicon, Quartz and Aether. Each stat boosts the one below it.",
                features: ["7 chained stats", "Offline progress", "Ascend for perks"],
                href: "/creations/games/node-farm",
                shot: "/games/shots/node-farm.webp",
                accent: "#9be564",
                tags: ["7 stats", "Offline", "Ascend"],
            },
            {
                slug: "starwright",
                title: "Starwright",
                status: "playable",
                icon: Ic.Sun,
                blurb: "You are a star. Fuse hydrogen up the periodic table, collapse into a supernova, then chart constellations that make the next star burn brighter.",
                features: ["10 element ladder", "Supernova, neutron star, black hole", "Planets and constellations"],
                href: "/creations/games/starwright",
                shot: "/games/shots/starwright.webp",
                accent: "#ff8a4c",
                tags: ["10 elements", "Supernova", "Constellations"],
            },
            {
                slug: "groundbreak",
                title: "Groundbreak",
                status: "playable",
                icon: Ic.Crane,
                blurb: "Run a construction company in the Bay Area. Twelve materials, each boosting the next, build a cutaway job floor by floor, and keep the skyline when you incorporate.",
                features: ["12 chained materials", "Zoomable cutaway site", "Permanent skyline"],
                href: "/creations/games/groundbreak",
                shot: "/games/shots/groundbreak.webp",
                accent: "#f2b84b",
                tags: ["12 materials", "Cutaway", "Skyline"],
            },
            // gen-anchor: games:incremental
        ],
    },
    {
        id: "automation",
        title: "Automation",
        color: "var(--cm-violet)",
        icon: Ic.Settings,
        tagline: "Build the machine that does the work.",
        about: "Automation games are about setting up systems that run on their own, then improving them.",
        coming: "Next up. More automation games are planned.",
        games: [
            {
                slug: "brasswork",
                title: "Brasswork",
                status: "playable",
                icon: Ic.Settings,
                blurb: "A clockwork-workshop factory on a 3D voxel island. Place machines on a grid, refine ores into parts, and send expeditions out from the workshop.",
                features: ["3D island", "Machines on a grid", "Expeditions"],
                href: "/creations/games/brasswork",
                shot: "/games/shots/brasswork.webp",
                accent: "#c99a4b",
                tags: ["3D island", "Grid", "Expeditions"],
            },
            // gen-anchor: games:automation
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
