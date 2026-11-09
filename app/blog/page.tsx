import { PageHead } from "@/components/cm/ui";
import { BlogSection } from "@/components/blog-section";
import { blogSections, BLOG_SECTION_IDS } from "@/lib/blog";

export default function BlogPage() {
    return (
        <>
            <PageHead
                label="Writing"
                title={["Blog & Essays"]}
                lead="Notes on systems design, game dev, philosophy, and whatever else is worth writing down. Long essays, research, poetry, technical writeups, and quick thoughts."
            >
                <nav className="cm-row" aria-label="Blog sections">
                    {blogSections.map((s, i) => (
                        <a key={s.title} className="cm-chip" style={{ textDecoration: "none" }} href={`#${BLOG_SECTION_IDS[i]}`}>
                            {s.title}
                        </a>
                    ))}
                </nav>
            </PageHead>
            {blogSections.map((section, idx) => (
                <section key={section.title} id={BLOG_SECTION_IDS[idx]} className="cm-section">
                    <BlogSection {...section} no={String(idx + 1).padStart(2, "0")} />
                </section>
            ))}
        </>
    );
}

export const metadata = { title: "Blog" };
