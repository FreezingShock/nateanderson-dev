import Link from "next/link";
import { PageHead, Stat } from "@/components/cm/ui";
import { Scramble } from "@/components/cm/motion";
import { NaosBackdrop } from "@/components/cm/naos-art";
import { BlogSection } from "@/components/blog-section";
import { blogSections, BLOG_SECTION_IDS } from "@/lib/blog";
import "./blog-naos.css";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
    title: "Blog",
    description: "Essays, research notes, poetry, dev logs and snippets. Thinking in public.",
    path: "/blog",
});

export default function BlogPage() {
    const allPosts = blogSections.flatMap((s) => s.posts);
    const published = allPosts.filter((p) => p.status === "published").length;
    const planned = allPosts.length - published;
    // Sections with no posts yet stay off the page: only real content shows up here.
    const sections = blogSections
        .map((section, i) => ({ section, id: BLOG_SECTION_IDS[i], no: String(i + 1).padStart(2, "0") }))
        .filter((x) => x.section.posts.length > 0);
    const hasSections = sections.length > 0;

    return (
        <div className="ctos">
            <NaosBackdrop src="/naos/bg-blog.png" />
            <div className="blog-hero">
                <PageHead
                    label="Writing / naOS"
                    title={["blog &", "essays"]}
                    lead="Notes on systems design, game dev, philosophy, and whatever else is worth writing down. Long essays, research, poetry, technical writeups, and quick thoughts."
                >
                    <div className="meta stats blog-stats">
                        {hasSections && (
                            <Stat
                                label="Sections"
                                value={String(sections.length).padStart(2, "0")}
                                note="Kinds of writing"
                            />
                        )}
                        <Stat
                            label="Published"
                            value={String(published).padStart(2, "0")}
                            note={published === 0 ? "Nothing live yet" : "Live now"}
                        />
                        <Stat
                            label="Planned"
                            value={String(planned).padStart(2, "0")}
                            note="Queued up or in draft"
                        />
                    </div>
                    {hasSections && (
                        <nav className="cm-row cta blog-jump" aria-label="Blog sections">
                            {sections.map(({ section: s, id, no }, i) => (
                                <a
                                    key={s.title}
                                    className={`cta-b${i === 0 ? " a" : ""}`}
                                    href={`#${id}`}
                                >
                                    <i>{no}</i>
                                    <span>{s.title}</span>
                                    <em aria-hidden="true">→</em>
                                </a>
                            ))}
                        </nav>
                    )}
                </PageHead>
            </div>

            {hasSections ? (
            <>
            <section className="cm-section ruled" aria-label="Section index">
                <span className="cm-sec-rule" data-mx="line" aria-hidden="true" />
                <div className="cm-wrap" data-rx-auto="">
                    <div className="blog-index">
                        <div className="id-top">
                            <Scramble className="id-sys" replay text="naOS // blog index" />
                            <span className="id-live">
                                <i aria-hidden="true" />
                                Live
                            </span>
                        </div>
                        <div className="cm-table-wrap blog-index-wrap">
                            <table className="cm-table blog-table">
                                <thead>
                                    <tr>
                                        <th scope="col">No</th>
                                        <th scope="col">Section</th>
                                        <th scope="col">Posts</th>
                                        <th scope="col">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sections.map(({ section: s, id, no }) => {
                                        const live = s.posts.filter((p) => p.status === "published").length;
                                        return (
                                            <tr key={s.title}>
                                                <td>{no}</td>
                                                <td>
                                                    <Link href={`#${id}`}>{s.title}</Link>
                                                </td>
                                                <td>{String(s.posts.length).padStart(2, "0")}</td>
                                                <td>
                                                    <span className={`cm-state ${live > 0 ? "live" : ""}`}>
                                                        {live > 0 ? `${live} published` : "Coming soon"}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="id-foot" aria-hidden="true">
                            <span className="id-bars">
                                <i />
                                <i />
                                <i />
                                <i />
                                <i />
                            </span>
                            <span>{sections.length} sections</span>
                            <span>{published} live</span>
                        </div>
                    </div>
                </div>
            </section>

            {sections.map(({ section, id, no }) => (
                <section
                    key={section.title}
                    id={id}
                    className="cm-section ruled blog-sec"
                    style={{ scrollMarginTop: 80 }}
                >
                    <span className="cm-sec-rule" data-mx="line" aria-hidden="true" />
                    <BlogSection {...section} no={no} />
                </section>
            ))}
            </>
            ) : (
            <section className="cm-section ruled blog-empty-sec" aria-label="Writing status">
                <span className="cm-sec-rule" data-mx="line" aria-hidden="true" />
                <div className="cm-wrap" data-rx-auto="">
                    <div className="blog-empty">
                        <div className="id-top">
                            <Scramble className="id-sys" replay text="naOS // blog index" />
                            <span className="id-live">
                                <i aria-hidden="true" />
                                Empty
                            </span>
                        </div>
                        <div className="blog-empty-body">
                            <h2 className="blog-empty-title">
                                <span className="cm-highlight solo blog-empty-hl">
                                    <span>nothing live yet</span>
                                </span>
                            </h2>
                            <p className="cm-body blog-empty-copy">
                                Posts appear here once they are finished. Each one gets its own page, and the newest
                                shows up on the home page under Recent posts.
                            </p>
                        </div>
                        <div className="id-foot" aria-hidden="true">
                            <span className="id-bars">
                                <i />
                                <i />
                                <i />
                                <i />
                                <i />
                            </span>
                            <span>0 sections</span>
                            <span>0 live</span>
                        </div>
                    </div>
                </div>
            </section>
            )}

            <section className="cm-section">
                <div className="cm-wrap" data-rx-auto="">
                    <div className="cm-panel blog-note">
                        <div className="cm-hbar">
                            <span>Reading notes</span>
                            <span>Not on a schedule</span>
                        </div>
                        <p className="cm-body blog-note-copy">
                            Posts are written when they are ready, not on a schedule. The newest ones show up on the
                            home page under Recent posts.
                        </p>
                        <div className="p-foot" aria-hidden="true">
                            <span className="id-bars">
                                <i />
                                <i />
                                <i />
                                <i />
                                <i />
                            </span>
                            <span>blog / queue</span>
                            <span>{planned} planned</span>
                        </div>
                        <div className="cm-row cta blog-note-links">
                            <Link className="cta-b a" href="/">
                                <i>←</i>
                                <span>Back to home</span>
                                <em aria-hidden="true">→</em>
                            </Link>
                            <Link className="cta-b" href="/about">
                                <i>02</i>
                                <span>About me</span>
                                <em aria-hidden="true">→</em>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
