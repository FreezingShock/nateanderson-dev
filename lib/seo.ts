import type { Metadata } from "next";

export const SITE_NAME = "Nate's Portfolio";
const DEFAULT_DESCRIPTION =
    "Games, renders, and systems — built while studying construction management.";

/**
 * One place for a page's title, description and social tags. The title goes through the root
 * layout template ("%s · Nate's Portfolio"), so the og:title is spelled out here to match it.
 * Images come from the route's own opengraph-image file. Pass `image` only when the route has none.
 */
export function pageMeta({
    title,
    description = DEFAULT_DESCRIPTION,
    path,
    image,
}: {
    title: string;
    description?: string;
    path: string;
    /** Only for pages without their own opengraph-image: point at the section's image (e.g. "/creations/opengraph-image"). */
    image?: string;
}): Metadata {
    const fullTitle = `${title} · ${SITE_NAME}`;
    const images = image ? [image] : undefined;
    return {
        title,
        description,
        alternates: { canonical: path },
        openGraph: {
            type: "website",
            locale: "en_US",
            siteName: SITE_NAME,
            title: fullTitle,
            description,
            url: path,
            ...(images && { images }),
        },
        twitter: {
            card: "summary_large_image",
            title: fullTitle,
            description,
            ...(images && { images }),
        },
    };
}

/** Schema.org JSON-LD for the homepage: the site and the person it is about. Only facts the site already states. */
export function homeJsonLd() {
    const site = "https://nateanderson.dev";
    return {
        "@context": "https://schema.org",
        "@graph": [
            { "@type": "WebSite", "@id": `${site}/#website`, url: site, name: SITE_NAME, description: DEFAULT_DESCRIPTION, inLanguage: "en-US", publisher: { "@id": `${site}/#person` } },
            { "@type": "Person", "@id": `${site}/#person`, name: "Nate Anderson", url: site, sameAs: ["https://github.com/FreezingShock"] },
        ],
    };
}
