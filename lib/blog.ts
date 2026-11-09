import type { BlogSectionProps } from "@/components/blog-section";

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
                id: "essay-1",
                title: "Coming Soon",
                excerpt: "Essays exploring the intersection of philosophy, design, and engineering.",
                date: "",
                status: "coming-soon",
                color: "var(--cm-amber)",
            },
        ],
    },
    {
        title: "Research & Notes",
        description: "Research notes on sustainable systems, climate adaptation, circular design, and environmental engineering. Thinking in public.",
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
                id: "poetry-1",
                title: "Coming Soon",
                excerpt: "Poetry and creative writing exploring authentic existence and design practice.",
                date: "",
                status: "coming-soon",
                color: "var(--cm-violet)",
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
                id: "snippet-1",
                title: "Coming Soon",
                excerpt: "Quick observations and design patterns collected from daily work.",
                date: "",
                status: "coming-soon",
                color: "var(--cm-cyan)",
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
