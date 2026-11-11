import Link from "next/link";
import { Section } from "@/components/cm/ui";
import { blogSections, getRecentPosts } from "@/lib/blog";

function formatDate(iso: string) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// Reads the same data as /blog. Shows the newest published posts; until the first post ships it shows
// a teaser per category instead of an empty block.
export function RecentPosts() {
    const recent = getRecentPosts(3);
    const teasers = blogSections.slice(0, 3);
    if (blogSections.length === 0) return null;
    return (
        <Section
            ctos
            id="blog"
            no="05"
            label="Recent posts"
            title={recent.length > 0 ? "Latest writing." : "Writing is on the way."}
            blurb={recent.length > 0 ? "The latest essays, notes and experiments." : "The first posts are on the way."}
            more={{ href: "/blog", label: "All writing" }}
        >
            <div className="cm-cols3">
                {recent.length > 0
                    ? recent.map((p) => (
                          <Link key={p.id} href={`/blog#${p.sectionId}`} className="cm-card link">
                              <span className="cm-state">{p.category}</span>
                              <b>{p.title}</b>
                              <p>{p.excerpt}</p>
                              <span className="st">{formatDate(p.date)}</span>
                          </Link>
                      ))
                    : teasers.map((s) => (
                          <Link key={s.title} href="/blog" className="cm-card link">
                              <span className="cm-tag flat" style={{ alignSelf: "flex-start" }}>Coming soon</span>
                              <b>{s.title}</b>
                              <p>{s.description}</p>
                              <span className="st">Blog</span>
                          </Link>
                      ))}
            </div>
        </Section>
    );
}
