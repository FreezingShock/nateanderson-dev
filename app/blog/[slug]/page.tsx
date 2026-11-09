import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/cm/ui";
import { ReadingGauge } from "@/components/blog-reading-gauge";
import { EssayView, PoemView, QuoteView } from "@/components/blog-post-views";
import { getPost, getPostNeighbours, getPostRoutes } from "@/lib/blog";
import { POST_KIND_LABEL, bodyWordCount, poemLineCount } from "@/lib/blog-types";
import { SITE_NAME } from "@/lib/seo";
import "./post.css";

export const dynamicParams = false;

export function generateStaticParams() {
    return getPostRoutes().map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const route = getPost(slug);
    if (!route) return { title: "Post not found" };
    const { post } = route;
    const isDraft = post.status === "draft";
    const fullTitle = `${post.title} · ${SITE_NAME}`;
    return {
        title: post.title,
        description: post.excerpt,
        openGraph: {
            type: "article",
            title: fullTitle,
            description: post.excerpt,
            url: `/blog/${slug}`,
        },
        twitter: { card: "summary_large_image", title: fullTitle, description: post.excerpt },
        // Drafts stay reachable for review but are kept out of search results.
        robots: isDraft ? { index: false, follow: false } : undefined,
    };
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    });
}

export default async function BlogPostPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const route = getPost(slug);
    if (!route || !route.post.body) notFound();

    const { post, sectionTitle, sectionNo } = route;
    const body = post.body!;
    const kind = body.kind;
    const { prev, next } = getPostNeighbours(slug);
    const isDraft = post.status === "draft";
    const minutes = Math.max(1, Math.round(bodyWordCount(body) / 220));

    const statusCell = isDraft
        ? { label: "Status", value: "Draft" }
        : { label: "Published", value: post.date ? formatDate(post.date) : "Undated" };

    const lengthCell =
        body.kind === "poem"
            ? { label: "Lines", value: String(poemLineCount(body)).padStart(2, "0") }
            : { label: "Read", value: `${minutes} min` };

    return (
        <div className={`ctos post-page post-${kind}`}>
            <PageHead
                label={`${POST_KIND_LABEL[kind]} / ${sectionNo} ${sectionTitle}`}
                title={[post.title]}
                lead={kind === "essay" ? post.excerpt : undefined}
                back={{ href: "/blog", label: "Back to blog" }}
            />

            <section className="cm-section post-sec" aria-label="Post details">
                <div className="cm-wrap" data-rx-auto="">
                    {isDraft && (
                        <div className="post-draft" role="note">
                            <span className="cm-tag flat">Draft preview</span>
                            <span>
                                Marked draft in lib/blog.ts, so it is hidden from search engines. Content may be
                                placeholder text.
                            </span>
                        </div>
                    )}
                    {kind !== "essay" && post.excerpt && <p className="post-dek">{post.excerpt}</p>}
                    <div className="post-strip" id="post-strip">
                        <div>
                            <span className="cm-lbl">Type</span>
                            <span className="post-strip-val">{POST_KIND_LABEL[kind]}</span>
                        </div>
                        <div>
                            <span className="cm-lbl">{statusCell.label}</span>
                            <span className="post-strip-val">{statusCell.value}</span>
                        </div>
                        <div>
                            <span className="cm-lbl">{lengthCell.label}</span>
                            <span className="post-strip-val">{lengthCell.value}</span>
                        </div>
                        {kind === "essay" && (
                            <div className="post-strip-gauge">
                                <ReadingGauge targetId="post-body" />
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section id="post-body" className="cm-section post-body-sec" style={{ scrollMarginTop: 80 }}>
                <div className="cm-wrap">
                    {body.kind === "essay" && <EssayView blocks={body.blocks} />}
                    {body.kind === "quote" && <QuoteView body={body} />}
                    {body.kind === "poem" && <PoemView body={body} />}
                </div>
            </section>

            <section className="cm-section post-end" aria-label="More posts">
                <div className="cm-wrap" data-rx-auto="">
                    <div className="cm-row cta post-pn">
                        {prev ? (
                            <Link className="cta-b" href={`/blog/${prev.slug}`}>
                                <i>←</i>
                                <span>{prev.post.title}</span>
                                <em aria-hidden="true">→</em>
                            </Link>
                        ) : (
                            <Link className="cta-b" href="/blog">
                                <i>←</i>
                                <span>Back to blog</span>
                                <em aria-hidden="true">→</em>
                            </Link>
                        )}
                        {next ? (
                            <Link className="cta-b a" href={`/blog/${next.slug}`}>
                                <i>→</i>
                                <span>{next.post.title}</span>
                                <em aria-hidden="true">→</em>
                            </Link>
                        ) : (
                            <Link className="cta-b a" href="/blog">
                                <i>↺</i>
                                <span>All posts</span>
                                <em aria-hidden="true">→</em>
                            </Link>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}
