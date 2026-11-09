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
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function BlogSection({ title, description, posts, no }: BlogSectionProps & { no: string }) {
    return (
        <div className="cm-wrap" style={{ display: "grid", gap: "var(--cm-s5)" }}>
            <div className="cm-sec-head" style={{ marginBottom: 0 }}>
                <div>
                    <span className="cm-lbl">{no} / {title}</span>
                    <h2 className="cm-h2">{title}</h2>
                    <p className="cm-body" style={{ margin: 0 }}>{description}</p>
                </div>
            </div>
            {posts.length > 0 ? (
                <div className="cm-grid">
                    {posts.map((post) => (
                        <article key={post.id} className="cm-card">
                            <div className="cm-viz" style={{ aspectRatio: "21 / 9" }}>
                                <span className={`cm-tag flat ${post.status === "published" ? "live" : ""}`}>
                                    {post.status === "published" ? "Published" : post.status === "draft" ? "Draft" : "Coming soon"}
                                </span>
                            </div>
                            <b>{post.title}</b>
                            <p>{post.excerpt}</p>
                            {post.date && <span className="st">{formatDate(post.date)}</span>}
                        </article>
                    ))}
                </div>
            ) : (
                <div className="cm-panel cm-hatch" style={{ padding: 24 }}>
                    <span className="cm-read warm">No posts yet. Check back soon for {title.toLowerCase()}.</span>
                </div>
            )}
        </div>
    );
}
