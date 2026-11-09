import { courses } from "@/lib/studies-data";

export interface NavChild {
    href: string;
    /** Short label shown in the site map. */
    label: string;
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
export const navItems: NavItem[] = [
    { href: "/", label: "Home", title: "Nate Anderson", no: "00", blurb: "Start here." },
    {
        href: "/creations",
        label: "Creations",
        title: "Creations",
        no: "01",
        blurb: "Games, projects, renovation studies and artwork.",
        children: [
            { href: "/creations/games", label: "All games" },
            { href: "/creations/games/outline-guesser", label: "Outline Guesser" },
            { href: "/creations/games/flag-guesser", label: "Flag Guesser" },
            { href: "/creations/projects", label: "Projects" },
            { href: "/creations/renovations", label: "Renovations" },
            { href: "/creations/artwork", label: "Artwork" },
        ],
    },
    { href: "/timeline", label: "Timeline", title: "Timeline", no: "02", blurb: "The pathway from senior year to graduation in 2031." },
    {
        href: "/studies",
        label: "Studies",
        title: "Studies",
        no: "03",
        blurb: "Coursework, pathway, reading queue and tool roadmap.",
        children: courses.map((c) => ({ href: `/studies/${c.slug}`, label: c.title })),
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
            { href: "/about#running", label: "Running & athletics" },
            { href: "/about#roblox", label: "Fractured Islands" },
            { href: "/about#skills", label: "Skills" },
        ],
    },
];

// Deep links the launcher offers on top of the pages.
export const launcherLinks: { href: string; label: string; group: string }[] = [
    { href: "/creations/games/outline-guesser", label: "Outline Guesser", group: "Play" },
    { href: "/creations/games/flag-guesser", label: "Flag Guesser", group: "Play" },
    { href: "/creations/games", label: "All games", group: "Play" },
    { href: "/creations/projects", label: "Projects", group: "Creations" },
    { href: "/creations/renovations", label: "Renovations", group: "Creations" },
    { href: "/creations/artwork", label: "Artwork", group: "Creations" },
    { href: "/about#running", label: "Running & athletics", group: "About" },
    { href: "/about#roblox", label: "Fractured Islands", group: "About" },
    { href: "/about#skills", label: "Skills", group: "About" },
];
