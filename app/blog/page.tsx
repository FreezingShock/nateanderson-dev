import Link from "next/link";
import { PageHead, Stat } from "@/components/cm/ui";
import { BlogSection } from "@/components/blog-section";
import { blogSections, BLOG_SECTION_IDS } from "@/lib/blog";

export const metadata = {
    title: "Blog",
    description:
        "Essays, research notes, poetry, dev logs and snippets. Thinking in public.",
};

export default function BlogPage() {
    const allPosts = blogSections.flatMap((s) => s.posts);
    const published = allPosts.filter((p) => p.status === "published").length;
    const planned = allPosts.length - published;

    return (
        <>
            <PageHead
                label="Writing"
                title={["Blog & Essays"]}
                lead="Notes on systems design, game dev, philosophy, and whatever else is worth writing down. Long essays, research, poetry, technical writeups, and quick thoughts."
            >
                <div className="cm-cols4" style={{ marginTop: "var(--cm-s5)" }}>
                    <Stat
                        label="Sections"
                        value={String(blogSections.length)}
                        note="Five kinds of writing"
                    />
                    <Stat
                        label="Published"
                        value={String(published).padStart(2, "0")}
                        note={
                            published === 0
                                ? "First post in progress"
                                : "Live now"
                        }
                    />
                    <Stat
                        label="Planned"
                        value={String(planned).padStart(2, "0")}
                        note="Queued up or in draft"
                    />
                </div>
                <nav
                    className="cm-row"
                    aria-label="Blog sections"
                    style={{ marginTop: "var(--cm-s5)" }}
                >
                    {blogSections.map((s, i) => (
                        <a
                            key={s.title}
                            className="cm-chip"
                            style={{ textDecoration: "none" }}
                            href={`#${BLOG_SECTION_IDS[i]}`}
                        >
                            {s.title}
                        </a>
                    ))}
                </nav>
            </PageHead>

            <section className="cm-section" aria-label="Section index">
                <div className="cm-wrap">
                    <span className="cm-lbl">Index</span>
                    <div
                        className="cm-table-wrap"
                        style={{ overflowX: "auto", marginTop: "var(--cm-s4)" }}
                    >
                        <table className="cm-table" style={{ width: "100%" }}>
                            <thead>
                                <tr>
                                    <th scope="col">No</th>
                                    <th scope="col">Section</th>
                                    <th scope="col">Posts</th>
                                    <th scope="col">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {blogSections.map((s, i) => {
                                    const live = s.posts.filter(
                                        (p) => p.status === "published"
                                    ).length;
                                    return (
                                        <tr key={s.title}>
                                            <td>
                                                {String(i + 1).padStart(2, "0")}
                                            </td>
                                            <td>
                                                <Link
                                                    href={`#${BLOG_SECTION_IDS[i]}`}
                                                >
                                                    {s.title}
                                                </Link>
                                            </td>
                                            <td>{s.posts.length}</td>
                                            <td>
                                                <span
                                                    className={`cm-state ${live > 0 ? "live" : ""}`}
                                                >
                                                    {live > 0
                                                        ? `${live} published`
                                                        : "Coming soon"}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {blogSections.map((section, idx) => (
                <section
                    key={section.title}
                    id={BLOG_SECTION_IDS[idx]}
                    className="cm-section"
                    style={{ scrollMarginTop: 80 }}
                >
                    <BlogSection
                        {...section}
                        no={String(idx + 1).padStart(2, "0")}
                    />
                </section>
            ))}

            <section className="cm-section">
                <div className="cm-wrap">
                    <div
                        className="cm-panel tick cm-hatch"
                        style={{ padding: 24, display: "grid", gap: 12 }}
                    >
                        <span className="cm-lbl">Reading notes</span>
                        <p
                            className="cm-body"
                            style={{ margin: 0, maxWidth: "62ch" }}
                        >
                            Posts are written when they are ready, not on a
                            schedule. The newest ones show up on the home page
                            under Recent posts.
                        </p>
                        <div className="cm-row">
                            <Link className="cm-btn" href="/">
                                Back to home
                            </Link>
                            <Link className="cm-btn" href="/about">
                                About me
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
