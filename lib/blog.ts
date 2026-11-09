import type { BlogSectionProps } from "@/components/blog-section";
import type { PostBody } from "@/lib/blog-types";

// Single source of truth for blog content — read by /blog (every category)
// and by the landing page's Recent Posts section. Add a post here and both
// update; nothing is duplicated.
export const BLOG_SECTION_IDS = ["essays", "research", "poetry", "devlog", "snippets"] as const;

export const blogSections: BlogSectionProps[] = [
    {
        title: "Essays & Articles",
        description: "Long-form writing on design systems, game development, philosophy, and engineering. Deep dives into problems I'm thinking about.",
        color: "var(--cm-amber)",
        posts: [
            {
                id: "essay-sample",
                slug: "sample-essay",
                title: "Sample essay (draft)",
                excerpt: "Placeholder essay for testing the post layout. Replace its body with your own writing.",
                date: "",
                status: "draft",
                color: "var(--cm-amber)",
                body: {
                    kind: "essay",
                    blocks: [
                        { t: "p", text: "This is placeholder text. It exists to check line length, paragraph spacing and the reading gauge on a phone. Nothing here is an essay of yours." },
                        { t: "h", text: "A heading inside the essay" },
                        { t: "p", text: "Replace these blocks with your own writing. Keep paragraphs short enough to read on a phone without zooming, and the layout does the rest." },
                        { t: "quote", text: "Placeholder pull quote, to check the cited block style.", cite: "Placeholder source" },
                        { t: "list", items: ["First placeholder point", "Second placeholder point", "Third placeholder point"] },
                        { t: "code", text: "const note = \"placeholder\";" },
                        { t: "p", text: "Closing placeholder paragraph." },
                    ],
                },
            },
        ],
    },
    {
        title: "Research & Notes",
        description: "Research notes on sustainable systems, climate adaptation, circular design, and sustainable infrastructure. Thinking in public.",
        color: "var(--cm-good)",
        posts: [
            {
                id: "research-1",
                title: "Coming Soon",
                excerpt: "Research on sustainable infrastructure and climate adaptation strategies.",
                date: "",
                status: "coming-soon",
                color: "var(--cm-good)",
            },
        ],
    },
    {
        title: "Poetry & Creative",
        description: "Poetry, short prose, and creative explorations. Kierkegaard-inspired existential meditations and design philosophy.",
        color: "var(--cm-violet)",
        posts: [
            {
                id: "poem-sample",
                slug: "sample-poem",
                title: "Sample poem (draft)",
                excerpt: "Placeholder poem for testing stanza spacing and line breaks.",
                date: "",
                status: "draft",
                color: "var(--cm-violet)",
                body: {
                    kind: "poem",
                    epigraph: { text: "Placeholder epigraph. Replace it or remove it.", cite: "placeholder" },
                    stanzas: [
                        ["placeholder line one, kept as its own row", "placeholder line two, short on purpose", "placeholder line three, long enough to wrap on a phone"],
                        ["a second stanza starts after a gap", "so the breaks show up on a small screen"],
                        ["replace these lines with your own poem", "every line break is kept exactly as typed"],
                    ],
                    note: "Layout test only. Swap the stanzas for your own lines; each entry is one printed line.",
                },
            },
        ],
    },
    {
        title: "Dev & Design Log",
        description: "Technical writeups on building things. CAD, SketchUp, web development, game systems, and design iteration.",
        color: "var(--cm-cyan)",
        posts: [
            {
                id: "devlog-1",
                title: "Coming Soon",
                excerpt: "Technical notes from building Fractured Islands and design experiments.",
                date: "",
                status: "coming-soon",
                color: "var(--cm-cyan)",
            },
        ],
    },
    {
        title: "Snippets & Ideas",
        description: "Short-form observations, design patterns, code snippets, and random thoughts. Quick hits on things worth sharing.",
        color: "var(--cm-cyan)",
        posts: [
            {
                id: "quote-sample",
                slug: "sample-quote",
                title: "Sample quote (draft)",
                excerpt: "Placeholder quote card for testing the quote layout.",
                date: "",
                status: "draft",
                color: "var(--cm-cyan)",
                body: {
                    kind: "quote",
                    text: "Placeholder quote. Swap in a line you want to keep, and the card sets it at full size.",
                    attribution: "Placeholder attribution",
                    source: "Layout test, not a real quote",
                    note: ["This note sits under the card. Use it to say why the line stuck with you."],
                },
            },
        ],
    },
];

export interface RecentPost {
    id: string;
    title: string;
    excerpt: string;
    date: string;
    color: string;
    category: string;
    sectionId: string;
}

// Newest published posts first. Empty until the first post is published —
// callers show "coming soon" teasers in that case.
export function getRecentPosts(limit = 3): RecentPost[] {
    return blogSections
        .flatMap((section, i) =>
            section.posts
                .filter((post) => post.status === "published")
                .map((post) => ({
                    id: post.id,
                    title: post.title,
                    excerpt: post.excerpt,
                    date: post.date,
                    color: post.color,
                    category: section.title,
                    sectionId: BLOG_SECTION_IDS[i],
                }))
        )
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, limit);
}

/** Every post that has a page at /blog/[slug] (anything with a body), in blog order. */
export function getPostRoutes(): { slug: string; post: BlogSectionProps["posts"][number]; sectionTitle: string; sectionNo: string }[] {
    return blogSections.flatMap((section, i) =>
        section.posts
            .filter((post) => post.slug && post.body)
            .map((post) => ({
                slug: post.slug as string,
                post,
                sectionTitle: section.title,
                sectionNo: String(i + 1).padStart(2, "0"),
            }))
    );
}

export function getPost(slug: string) {
    return getPostRoutes().find((r) => r.slug === slug);
}

/** Previous and next post in blog order, for the plates at the end of a post. */
export function getPostNeighbours(slug: string) {
    const all = getPostRoutes();
    const i = all.findIndex((r) => r.slug === slug);
    if (i < 0) return { prev: null, next: null };
    return {
        prev: i > 0 ? all[i - 1] : null,
        next: i < all.length - 1 ? all[i + 1] : null,
    };
}
