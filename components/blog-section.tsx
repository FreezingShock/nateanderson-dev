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

export function BlogSection({
    title,
    description,
    posts,
    no,
    color,
}: BlogSectionProps & { no: string }) {
    const count = posts.length;
    return (
        <div
            className="cm-wrap"
            style={{ display: "grid", gap: "var(--cm-s5)" }}
        >
            <div className="cm-sec-head" style={{ marginBottom: 0 }}>
                <div>
                    <span className="cm-lbl">
                        {no} / {title}
                    </span>
                    <h2 className="cm-h2">{title}</h2>
                    <p
                        className="cm-body"
                        style={{ margin: 0, maxWidth: "62ch" }}
                    >
                        {description}
                    </p>
                </div>
            </div>
            {count > 0 ? (
                <div
                    style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns:
                            "repeat(auto-fill, minmax(min(100%, 300px), 360px))",
                    }}
                >
                    {posts.map((post) => {
                        const isPublished = post.status === "published";
                        const inner = (
                            <>
                                <div
                                    className="cm-viz"
                                    style={{
                                        aspectRatio: "auto",
                                        minHeight: 72,
                                        display: "flex",
                                        alignItems: "flex-start",
                                        padding: 10,
                                        borderBottom: `2px solid ${color}`,
                                    }}
                                >
                                    <span
                                        className={`cm-tag flat ${isPublished ? "live" : ""}`}
                                    >
                                        {statusLabel(post.status)}
                                    </span>
                                </div>
                                <b>
                                    {isPublished || post.title !== "Coming Soon"
                                        ? post.title
                                        : `Next up in ${title.toLowerCase()}`}
                                </b>
                                <p>{post.excerpt}</p>
                                {post.date ? (
                                    <span className="st">
                                        {formatDate(post.date)}
                                    </span>
                                ) : (
                                    <span className="st">Queued</span>
                                )}
                            </>
                        );
                        return isPublished ? (
                            <article key={post.id} className="cm-card">
                                {inner}
                            </article>
                        ) : (
                            <article
                                key={post.id}
                                className="cm-card"
                                aria-label={`${post.title}, ${statusLabel(post.status).toLowerCase()}`}
                            >
                                {inner}
                            </article>
                        );
                    })}
                </div>
            ) : (
                <div
                    className="cm-panel cm-hatch"
                    style={{ padding: 24, display: "grid", gap: 8 }}
                >
                    <span className="cm-read warm">No posts yet</span>
                    <p
                        className="cm-body"
                        style={{ margin: 0, maxWidth: "62ch" }}
                    >
                        Nothing in {title.toLowerCase()} is published yet. The
                        first one will land here when it is ready.
                    </p>
                </div>
            )}
        </div>
    );
}
