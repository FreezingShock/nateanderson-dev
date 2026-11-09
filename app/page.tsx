import Link from "next/link";
import { Suspense } from "react";
import { getProjects, getRecentRenovations } from "@/lib/content";
import { allGames } from "@/lib/creations-data";
import { GOALS, INTERESTS, NOW_FEED, ROLES } from "@/lib/identity";
import { navItems } from "@/lib/nav";
import { Section } from "@/components/cm/ui";
import { CountUp, Reveal } from "@/components/cm/reveal";
import { SiteStats, SiteStatsSkeleton } from "@/components/home/site-stats";
import { TimelinePreview } from "@/components/home/timeline-preview";
import { RecentPosts } from "@/components/home/recent-posts";

export const revalidate = 60; // re-check Supabase for new content every 60s

export default async function Home() {
    const [projects, renovations] = await Promise.all([getProjects(), getRecentRenovations()]);
    const stack = Array.from(new Set([...projects, ...renovations].flatMap((p) => p.tags)));
    const featured = [...projects, ...renovations].slice(0, 3);
    const playable = allGames().filter((g) => g.status === "playable").length;

    return (
        <>
            <header className="cm-hero" id="top">
                <div className="cm-grid-bg" aria-hidden="true" />
                <div className="ring" aria-hidden="true" />
                <span className="cm-tag t1" aria-hidden="true">Class of <i>2027</i></span>
                <span className="cm-tag live t2" aria-hidden="true">Now shipping <i>Fractured Islands</i></span>
                <span className="cm-read live float t3" aria-hidden="true">Launch / Spring 2031</span>
                <div className="cm-wrap">
                    <span className="cm-lbl">Portfolio / Southern California / nateanderson.dev</span>
                    <h1 style={{ margin: 0 }}>
                        <span className="cm-highlight wipe" style={{ display: "inline-flex", flexDirection: "column" }}>
                            <span>Nate Anderson</span>
                            <span>builds games, renders</span>
                            <span>and systems.</span>
                        </span>
                    </h1>
                    <p className="cm-lead" style={{ margin: 0 }}>
                        Studying toward environmental engineering. Currently shipping Fractured Islands: Ascension, a
                        Roblox progression game built in Luau.
                    </p>
                    <div className="cm-row">
                        <Link className="cm-btn solid" href="/creations/projects">View projects</Link>
                        <Link className="cm-btn" href="/about">About me</Link>
                        <Link className="cm-btn" href="/creations/games">Play the games</Link>
                    </div>
                    <div className="meta">
                        <div><div className="cm-lbl">Projects</div><CountUp className="big" value={projects.length} /></div>
                        <div><div className="cm-lbl">Renovations</div><CountUp className="big" value={renovations.length} /></div>
                        <div><div className="cm-lbl">Playable games</div><CountUp className="big" value={playable} /></div>
                    </div>
                </div>
            </header>

            {featured.length > 0 && (
                <Section
                    id="work"
                    no="01"
                    label="Selected work"
                    title="The work that best shows how I build."
                    blurb="Solo-built games, real renovation studies, and the systems thinking that connects them."
                    more={{ href: "/creations/projects", label: "View all" }}
                >
                    <div className="cm-grid">
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
            )}

            <Section id="profile" no="02" label="Profile" title="Roles, interests and goals.">
                <div className="cm-split">
                    <div className="cm-stack">
                        <div className="cm-panel tick">
                            <div className="cm-hbar"><span>Now</span><span>Feed</span></div>
                            <ol className="cm-stream wrap">
                                {NOW_FEED.map((l) => (
                                    <li key={l}>{l}</li>
                                ))}
                            </ol>
                        </div>
                    </div>
                    <div className="cm-panel">
                        <div className="cm-hbar"><span>Profile</span><span>Class of 2027</span></div>
                        <div className="cm-prow"><span className="cm-lbl">Roles</span><div className="cm-row-gap">{ROLES.map((r) => <span key={r} className="cm-pill">{r}</span>)}</div></div>
                        <div className="cm-prow"><span className="cm-lbl">Interests</span><div className="cm-row-gap">{INTERESTS.map((r) => <span key={r} className="cm-pill">{r}</span>)}</div></div>
                        <div className="cm-prow"><span className="cm-lbl">Heading toward</span><div className="cm-row-gap">{GOALS.map((r) => <span key={r} className="cm-pill">{r}</span>)}</div></div>
                        {stack.length > 0 && (
                            <div className="cm-prow"><span className="cm-lbl">Builds with</span><div className="cm-row-gap">{stack.map((r) => <span key={r} className="cm-pill on">{r}</span>)}</div></div>
                        )}
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
