import { courses } from "@/lib/studies-data";
import type { PixelName } from "@/components/cm/pixel-icons";
import { allGames } from "@/lib/creations-data";

export interface NavChild {
    href: string;
    /** Short label shown in the site map. */
    label: string;
    /** Pixel icon shown beside it in the site map. */
    icon?: PixelName;
}

export interface NavItem {
    href: string;
    /** Short word for the top bar. */
    label: string;
    /** The page's real title, used by the launcher and the site map. */
    title: string;
    /** Two-digit index shown in the launcher, the site map and the dock. */
    no: string;
    blurb: string;
    /** Subpages, shown under the section in the site map. Keep them in reading order. */
    children?: NavChild[];
}

// Single source of truth for site navigation: the top bar, the dock, the site map, the "/" launcher, the footer
// and the home page's "Explore" grid all read this list.
// Games are read from the Creations data, so a new game with a route shows up here with no edit to this file.
// Icons are optional; a game without one gets the gamepad.
const GAME_ICON: Record<string, PixelName> = {
    "outline-guesser": "shapes",
    "flag-guesser": "flag",
};

const COURSE_ICON: Record<string, PixelName> = {
    "senior-project": "rocket",
    "ap-statistics": "chart",
    "ap-biology": "leaf",
    "intro-communications": "send",
    "ap-studio-art": "palette",
    "ap-government": "globe",
};

export const navItems: NavItem[] = [
    { href: "/", label: "Home", title: "Nate Anderson", no: "00", blurb: "Start here." },
    {
        href: "/creations",
        label: "Creations",
        title: "Creations",
        no: "01",
        blurb: "Games, projects, renovation studies and artwork.",
        children: [
            { href: "/creations/games", label: "All games", icon: "gamepad" },
            // Only the plain game routes: the daily links (?mode=daily) point at the same games.
            ...allGames()
                .filter((g) => g.href && !g.href.includes("?"))
                .map((g) => ({ href: g.href as string, label: g.title, icon: GAME_ICON[g.slug] ?? "gamepad" })),
            { href: "/creations/projects", label: "Projects", icon: "code" },
            { href: "/creations/renovations", label: "Renovations", icon: "hammer" },
            { href: "/creations/artwork", label: "Artwork", icon: "brush" },
        ],
    },
    { href: "/timeline", label: "Timeline", title: "Timeline", no: "02", blurb: "The pathway from senior year to graduation in 2031." },
    {
        href: "/studies",
        label: "Studies",
        title: "Studies",
        no: "03",
        blurb: "Coursework, pathway, reading queue and tool roadmap.",
        children: courses.map((c) => ({ href: `/studies/${c.slug}`, label: c.title, icon: COURSE_ICON[c.slug] })),
    },
    {
        href: "/blog",
        label: "Blog",
        title: "Blog & Essays",
        no: "04",
        blurb: "Essays, research, poetry, dev log and snippets.",
    },
    { href: "/history", label: "History", title: "Site History", no: "05", blurb: "This site's changelog, live from GitHub." },
    {
        href: "/about",
        label: "About",
        title: "About Me",
        no: "06",
        blurb: "Who I am and how the parts connect.",
        children: [
            { href: "/about#running", label: "Running & athletics", icon: "footprints" },
            { href: "/about#skills", label: "Skills", icon: "zap" },
        ],
    },
];

// Deep links the launcher offers on top of the pages. Individual games are not listed here: the search reads them from
// lib/creations-data.ts, so a new game shows up in search as soon as it is added there.
export const launcherLinks: { href: string; label: string; group: string }[] = [
    { href: "/creations/games", label: "All games", group: "Games" },
    { href: "/creations/projects", label: "Projects", group: "Creations" },
    { href: "/creations/renovations", label: "Renovations", group: "Creations" },
    { href: "/creations/artwork", label: "Artwork", group: "Creations" },
    { href: "/about#running", label: "Running & athletics", group: "About" },
    { href: "/about#skills", label: "Skills", group: "About" },
];
