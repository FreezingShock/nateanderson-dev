import type { BlogSectionProps } from "@/components/blog-section";
import type { PostBody } from "@/lib/blog-types";

// Single source of truth for blog content — read by /blog (every category)
// and by the landing page's Recent Posts section. Add a post here and both
// update; nothing is duplicated.
export const BLOG_SECTION_IDS = ["essays", "research", "poetry", "devlog", "snippets"] as const;

export const blogSections: BlogSectionProps[] = [];

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
