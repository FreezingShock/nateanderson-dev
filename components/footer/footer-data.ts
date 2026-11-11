// Shared footer content. Every fact here is already on the site (identity, about, timeline, creations).
import type { PixelName } from "@/components/cm/pixel-icons";
import { PATH, PILLARS } from "@/lib/identity";
import { building, runningStats } from "@/lib/about-data";
import { navItems } from "@/lib/nav";

export const FOOTER_TAGLINE =
    "Building games, renders, and systems, and aiming for construction management at Cal Poly SLO.";

export const SOCIALS: { label: string; href: string; icon: PixelName; preferred?: boolean }[] = [
    { label: "GitHub", href: "https://github.com/FreezingShock", icon: "github" },
    { label: "Discord", href: "https://discord.com/users/724456022722215966", icon: "discord" },
    { label: "Instagram", href: "https://instagram.com/nate9anderson", icon: "instagram" },
    { label: "TikTok", href: "https://www.tiktok.com/@nate9anderson", icon: "tiktok" },
    { label: "YouTube", href: "https://www.youtube.com/channel/UC_MMqRncSjzBoT2aDRhXj7Q", icon: "youtube" },
    { label: "Email", href: "mailto:nateanderson36b2@gmail.com", icon: "mail", preferred: true },
];

export const ABOUT_LINKS: { label: string; href: string; icon: PixelName }[] = [
    { label: "Who I am", href: "/about#hero", icon: "eye" },
    { label: "Running", href: "/about#running", icon: "footprints" },
    { label: "Philosophy", href: "/about#philosophy", icon: "brain" },
    { label: "Skills", href: "/about#skills", icon: "zap" },
    { label: "Education path", href: "/about#timeline", icon: "book" },
];

// Icon for each top-level page, same order as the nav.
const PAGE_ICON: Record<string, PixelName> = {
    "/": "home",
    "/creations": "creations",
    "/timeline": "timeline",
    "/studies": "studies",
    "/blog": "blog",
    "/history": "history",
    "/about": "about",
};

export const PAGE_LINKS = navItems.map((n) => ({
    href: n.href,
    label: n.label,
    no: n.no,
    icon: PAGE_ICON[n.href] ?? ("home" as PixelName),
}));

const PILLAR_ICON: Record<string, PixelName> = { Build: "code", Make: "brush", Run: "footprints", Think: "brain" };

export const PILLAR_ITEMS = PILLARS.map((p) => ({ ...p, icon: PILLAR_ICON[p.label] ?? ("bulb" as PixelName) }));

export { PATH, runningStats, building };
