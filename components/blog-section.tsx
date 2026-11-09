import { ScrollType, Scramble, Slab } from "@/components/cm/motion";

export interface BlogPost {
    id: string;
    title: string;
    excerpt: string;
    date: string;
    status: "published" | "draft" | "coming-soon";
    color: string;
}

export interface BlogSectionProps {
    title: string;
    description: string;
    color: string;
    posts: BlogPost[];
}

function formatDate(iso: string) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    });
}

function statusLabel(status: BlogPost["status"]) {
    if (status === "published") return "Published";
    if (status === "draft") return "Draft";
    return "Coming soon";
}

/**
 * One blog section in the naOS treatment: scrambled `NN / Name` label, slab-revealed white title block, scroll-typed
 * blurb, then post plates (the Status-card look from the homepage, with a white header bar and a dither footer).
 * The wrapper carries `data-rx-auto`, so the reveal engine tags the plates and their text itself.
 */
export function BlogSection({
    title,
    description,
    posts,
    no,
}: BlogSectionProps & { no: string }) {
    const count = posts.length;
    const live = posts.filter((p) => p.status === "published").length;

    return (
        <div className="cm-wrap" data-rx-auto="">
            <div className="cm-sec-head">
                <div>
                    <Scramble className="cm-lbl" replay text={`${no} / ${title}`} />
                    <h2 className="cm-h2" data-rx="slab">
                        <Slab>{title}</Slab>
                    </h2>
                    <ScrollType text={description} className="cm-body" style={{ margin: 0 }} />
                </div>
                <span className={`cm-state ${live > 0 ? "live" : ""}`}>
                    {live > 0 ? `${live} published` : `${count} queued`}
                </span>
            </div>

            {count > 0 ? (
                <div className="cm-cols3 blog-grid">
                    {posts.map((post, i) => {
                        const isPublished = post.status === "published";
                        const shownTitle =
                            isPublished || post.title !== "Coming Soon"
                                ? post.title
                                : `Next up in ${title.toLowerCase()}`;
                        const inner = (
                            <>
                                <div className="bp-top">
                                    <span>
                                        {no}.{String(i + 1).padStart(2, "0")}
                                    </span>
                                    <span className={`cm-tag flat ${isPublished ? "live" : ""}`}>
                                        {statusLabel(post.status)}
                                    </span>
                                </div>
                                <b>{shownTitle}</b>
                                <p>{post.excerpt}</p>
                                <div className="p-foot">
                                    <span className="id-bars" aria-hidden="true">
                                        <i />
                                        <i />
                                        <i />
                                        <i />
                                        <i />
                                    </span>
                                    <span className="st">{post.date ? formatDate(post.date) : "Queued"}</span>
                                </div>
                            </>
                        );
                        return isPublished ? (
                            <article key={post.id} className="cm-card blog-post">
                                {inner}
                            </article>
                        ) : (
                            <article
                                key={post.id}
                                className="cm-card blog-post"
                                aria-label={`${post.title}, ${statusLabel(post.status).toLowerCase()}`}
                            >
                                {inner}
                            </article>
                        );
                    })}
                </div>
            ) : (
                <div className="cm-panel cm-hatch" style={{ padding: 24, display: "grid", gap: 8 }}>
                    <span className="cm-read warm">No posts yet</span>
                    <p className="cm-body" style={{ margin: 0, maxWidth: "62ch" }}>
                        Nothing in {title.toLowerCase()} is published yet. The first one will land here when it is ready.
                    </p>
                </div>
            )}
        </div>
    );
}
