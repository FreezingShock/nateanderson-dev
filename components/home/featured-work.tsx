import Link from "next/link";
import { getProjects, getRecentRenovations, type Project } from "@/lib/content";

// "Selected work" cards. The Supabase lookups live here, not on the home page, so the page can stream: the hero and
// sections paint while these resolve inside their <Suspense> boundary. Markup matches the cards that shipped inline.
export async function FeaturedCards() {
    const [projects, renovations] = await Promise.all([getProjects(), getRecentRenovations()]);
    const offline = projects.offline || renovations.offline;
    const featured: Project[] = [...projects.items, ...renovations.items].slice(0, 3);

    if (featured.length === 0) {
        // Two different states: a failed read says so, and an empty library reads as standby, not as a fault.
        return offline ? (
            <div className="cm-card" style={{ gridColumn: "1 / -1" }} role="status">
                <span className="cm-state warn">Feed offline</span>
                <b>Featured work did not load.</b>
                <p>The project library is not responding right now. It retries on its own, and the full list is one click away.</p>
                <Link className="st" href="/creations/projects">/creations/projects</Link>
            </div>
        ) : (
            <div className="cm-card" style={{ gridColumn: "1 / -1" }}>
                <span className="cm-state">Standby</span>
                <b>Nothing featured yet.</b>
                <p>Projects land here once they are added. The full list is one click away.</p>
                <Link className="st" href="/creations/projects">/creations/projects</Link>
            </div>
        );
    }

    return (
        <>
            {featured.map((p, i) => (
                // data-rx="" matches what the naOS section tags on its grid children, so streamed cards still reveal.
                <Link key={p.slug} className="cm-card link" href={`/creations/${p.slug}`} data-rx="">
                    <div className="cm-viz">
                        <span className="cm-tag flat">{p.category}</span>
                        <span className="glyph" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                    </div>
                    <b>{p.title}</b>
                    <p>{p.description}</p>
                    <span className="st">{p.tags.slice(0, 3).join(" / ")}</span>
                </Link>
            ))}
        </>
    );
}

/** Three placeholder cards at the same size while the library loads. Decorative: the real cards replace them. */
export function FeaturedSkeleton() {
    return (
        <>
            {[0, 1, 2].map((i) => (
                <div key={i} className="cm-card featured-skel" aria-hidden="true">
                    <span className="cm-state">Loading</span>
                </div>
            ))}
        </>
    );
}
