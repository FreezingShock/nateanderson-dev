import type { MetadataRoute } from "next";
import { allGames } from "@/lib/creations-data";
import { GAMES } from "@/lib/games/registry";
import { courses } from "@/lib/studies-data";

const SITE = "https://nateanderson.dev";

// Public static pages. Not listed: /dev/* and /automation-preview (noindex), /api/*, /blog/[slug] (no posts yet),
// and /creations/[slug] (project rows come from Supabase, so they are not known at build time).
const STATIC_PATHS = [
    "/",
    "/about",
    "/blog",
    "/creations",
    "/creations/artwork",
    "/creations/games",
    "/creations/projects",
    "/creations/renovations",
    "/history",
    "/studies",
    "/timeline",
];

export default function sitemap(): MetadataRoute.Sitemap {
    // Games come from the same two places the site links to them. Links with a query string are not pages to index.
    const gamePaths = [...allGames().map((g) => g.href), ...Object.values(GAMES).map((g) => g.path)].filter(
        (p): p is string => Boolean(p) && !p!.includes("?"),
    );
    const studyPaths = courses.map((c) => `/studies/${c.slug}`);
    const paths = [...new Set([...STATIC_PATHS, ...gamePaths, ...studyPaths])];
    const lastModified = new Date();
    return paths.map((path) => ({
        url: path === "/" ? SITE : `${SITE}${path}`,
        lastModified,
        changeFrequency: "weekly",
        priority: path === "/" ? 1 : 0.8,
    }));
}
