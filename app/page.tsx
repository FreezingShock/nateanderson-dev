import Link from "next/link";
import { Suspense } from "react";
import { getProjects, getRecentRenovations } from "@/lib/content";
import { allGames } from "@/lib/creations-data";
import { NOW_FEED, PATH, PILLARS, PROFILE_LEAD } from "@/lib/identity";
import { navItems } from "@/lib/nav";
import { Section } from "@/components/cm/ui";
import { CountUp, Reveal } from "@/components/cm/reveal";
import { ScrollType } from "@/components/cm/motion";
import { SiteStats, SiteStatsSkeleton } from "@/components/home/site-stats";
import { TimelinePreview } from "@/components/home/timeline-preview";
import { RecentPosts } from "@/components/home/recent-posts";
import "@/components/home/home.css";

export const revalidate = 60; // re-check Supabase for new content every 60s

export default async function Home() {
    const [projects, renovations] = await Promise.all([getProjects(), getRecentRenovations()]);
    const featured = [...projects, ...renovations].slice(0, 3);
    const playable = allGames().filter((g) => g.status === "playable").length;

    return (
        <>
            <header className="cm-hero" id="top">
                <div className="cm-grid-bg" aria-hidden="true" />
                <div className="ring" aria-hidden="true" data-mx-par="0.12" />
                <span className="cm-tag t1" aria-hidden="true" data-mx-par="0.2">Class of <i>2027</i></span>
                <span className="cm-tag live t2" aria-hidden="true" data-mx-par="0.08">Now shipping <i>Fractured Islands</i></span>
                <span className="cm-read live float t3" aria-hidden="true" data-mx-par="0.16">Launch / Spring 2031</span>
                <div className="cm-wrap">
                    <div className="hero-grid">
                        <div className="hero-copy cm-stage">
                        <span className="cm-lbl">Portfolio / Southern California / nateanderson.dev</span>
                        <h1 style={{ margin: 0 }}>
                            <span className="cm-highlight wipe" style={{ display: "inline-flex", flexDirection: "column" }}>
                                <span>Nate Anderson</span>
                                <span>builds games, renders</span>
                                <span>and systems.</span>
                            </span>
                        </h1>
                        <ScrollType
                            as="p"
                            auto
                            className="cm-lead"
                            style={{ margin: 0 }}
                            text="Studying toward environmental engineering. Currently shipping Fractured Islands: Ascension, a Roblox progression game built in Luau."
                        />
                        <div className="cm-row">
                            <Link className="cm-btn solid" href="/creations/projects">View projects</Link>
                            <Link className="cm-btn" href="/about">About me</Link>
                            <Link className="cm-btn" href="/creations/games">Play the games</Link>
                        </div>
                        <div className="meta">
                            <div><div className="cm-lbl">Projects</div>{projects.length > 0 ? <CountUp className="big" value={projects.length} /> : <span className="big none" aria-label="None yet">—</span>}</div>
                            <div><div className="cm-lbl">Renovations</div>{renovations.length > 0 ? <CountUp className="big" value={renovations.length} /> : <span className="big none" aria-label="None yet">—</span>}</div>
                            <div><div className="cm-lbl">Playable games</div>{playable > 0 ? <CountUp className="big" value={playable} /> : <span className="big none" aria-label="None yet">—</span>}</div>
                        </div>
                        </div>
                        <aside className="hero-status" aria-label="Current status" data-mx="slide-r">
                            <div className="cm-panel tick">
                                <div className="cm-hbar"><span className="live">Status</span><span>Now</span></div>
                                <dl className="cm-kv">
                                    <div><dt>Based</dt><dd>Southern California</dd></div>
                                    <div><dt>Studying</dt><dd>Environmental engineering</dd></div>
                                    <div><dt>Shipping</dt><dd><Link href="/creations">Fractured Islands: Ascension</Link></dd></div>
                                    <div><dt>Built in</dt><dd>Luau, TypeScript, Blender</dd></div>
                                    <div><dt>Launch</dt><dd>Spring 2031</dd></div>
                                </dl>
                            </div>
                        </aside>
                    </div>
                </div>
            </header>

            <Section
                    id="work"
                    no="01"
                    label="Selected work"
                    title="The work that best shows how I build."
                    blurb="Solo-built games, real renovation studies, and the systems thinking that connects them."
                    more={{ href: "/creations/projects", label: "View all" }}
                >
                    <div className="cm-grid">
                        {featured.length === 0 && (
                            <div className="cm-card" style={{ gridColumn: "1 / -1" }}>
                                <span className="cm-state">Syncing</span>
                                <b>Featured work loads from the project library.</b>
                                <p>If nothing appears, the library is offline for a moment. The full list is one click away.</p>
                                <Link className="st" href="/creations/projects">/creations/projects</Link>
                            </div>
                        )}
                        {featured.map((p, i) => (
                            <Reveal key={p.slug} delay={(i % 3) * 70}>
                                <Link className="cm-card link" href={`/creations/${p.slug}`} style={{ height: "100%" }}>
                                    <div className="cm-viz">
                                        <span className="cm-tag flat">{p.category}</span>
                                        <span className="glyph" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                                    </div>
                                    <b>{p.title}</b>
                                    <p>{p.description}</p>
                                    <span className="st">{p.tags.slice(0, 3).join(" / ")}</span>
                                </Link>
                            </Reveal>
                        ))}
                    </div>
                </Section>

            <Section id="profile" no="02" label="Profile" title="Who I am, and where I'm headed.">
                <div className="pf">
                    <div className="cm-panel pf-id">
                        <div className="cm-hbar"><span>Profile</span><span>Class of 2027</span></div>
                        <p className="pf-lead">{PROFILE_LEAD}</p>
                        <dl className="pf-pillars">
                            {PILLARS.map((p) => (
                                <div key={p.label}>
                                    <dt>{p.label}</dt>
                                    <dd>{p.headline}</dd>
                                    <small>{p.detail}</small>
                                </div>
                            ))}
                        </dl>
                    </div>
                    <div className="cm-panel tick pf-now">
                        <div className="cm-hbar"><span>Now</span><span>Feed</span></div>
                        <ul className="pf-feed">
                            {NOW_FEED.map((l) => (
                                <li key={l.tag}><span className="cm-state live">{l.tag}</span><span>{l.text}</span></li>
                            ))}
                        </ul>
                    </div>
                    <div className="cm-panel pf-path">
                        <div className="cm-hbar"><span>Heading toward</span><span>2031</span></div>
                        <ol className="pf-steps">
                            {PATH.map((s) => (
                                <li key={s.title} className={s.current ? "cur" : undefined}>
                                    <span className="cm-lbl">{s.when}</span>
                                    <b>{s.title}</b>
                                    <p>{s.detail}</p>
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>
            </Section>

            <Suspense fallback={<SiteStatsSkeleton />}>
                <SiteStats />
            </Suspense>

            <TimelinePreview />
            <RecentPosts />

            <Section id="explore" no="06" label="Explore" title="Explore the site.">
                <div className="cm-grid">
                    {navItems
                        .filter((n) => n.href !== "/")
                        .map((n, i) => (
                            <Reveal key={n.href} delay={(i % 3) * 70}>
                                <Link className="cm-card link" href={n.href} style={{ height: "100%" }}>
                                    <span className="cm-state">{n.no}</span>
                                    <b>{n.title}</b>
                                    <p>{n.blurb}</p>
                                    <span className="st">{n.href}</span>
                                </Link>
                            </Reveal>
                        ))}
                </div>
            </Section>
        </>
    );
}
