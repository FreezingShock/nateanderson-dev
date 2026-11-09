export interface NavItem {
    href: string;
    /** Short word for the top bar. */
    label: string;
    /** The page's real title, used by the launcher. */
    title: string;
    /** Two-digit index shown in the launcher and the footer map. */
    no: string;
    blurb: string;
}

// Single source of truth for site navigation: the top bar, the "/" launcher, the footer and the
// home page's "Explore" grid all read this list.
export const navItems: NavItem[] = [
    { href: "/", label: "Home", title: "Nate Anderson", no: "00", blurb: "Start here." },
    { href: "/creations", label: "Creations", title: "Creations", no: "01", blurb: "Games, projects, renovation studies and artwork." },
    { href: "/timeline", label: "Timeline", title: "Timeline", no: "02", blurb: "The pathway from senior year to a 2031 launch." },
    { href: "/studies", label: "Studies", title: "Studies", no: "03", blurb: "Coursework, pathway, reading queue and tool roadmap." },
    { href: "/blog", label: "Blog", title: "Blog & Essays", no: "04", blurb: "Essays, research, poetry, dev log and snippets." },
    { href: "/history", label: "History", title: "Site History", no: "05", blurb: "This site's changelog, live from GitHub." },
    { href: "/about", label: "About", title: "About Me", no: "06", blurb: "Who I am and how the parts connect." },
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
