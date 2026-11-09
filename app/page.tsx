import Link from "next/link";
import { Suspense } from "react";
import { getProjects, getRecentRenovations } from "@/lib/content";
import { allGames } from "@/lib/creations-data";
import { NOW_FEED, PATH, PILLARS, PROFILE_LEAD } from "@/lib/identity";
import { navItems } from "@/lib/nav";
import { Section } from "@/components/cm/ui";
import { CountUp } from "@/components/cm/reveal";
import { ScrollType, Scramble } from "@/components/cm/motion";
import { NaosArt, NaosBackdrop } from "@/components/cm/naos-art";
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
        <div className="ctos">
            <NaosBackdrop src="/naos/bg-home.png" />
            <header className="cm-hero" id="top">
                <div className="cm-grid-bg" aria-hidden="true" />
                <div className="cm-persp" aria-hidden="true" />
                <span className="cm-ctos-tag" aria-hidden="true">naOS</span>
                <NaosArt src="/naos/islands.png" width={300} height={200} variant="hero" eager />
                <div className="ring" aria-hidden="true" data-mx-par="0.12" />
                <span className="cm-tag t1" aria-hidden="true" data-mx-par="0.2">Class of <i>2027</i></span>
                <span className="cm-tag live t2" aria-hidden="true" data-mx-par="0.08">Now shipping <i>Fractured Islands</i></span>
                <span className="cm-read live float t3" aria-hidden="true" data-mx-par="0.16">Graduation / June 2031</span>
                <div className="cm-wrap">
                    <div className="hero-grid">
                        <div className="hero-copy cm-stage">
                        <span className="cm-lbl">Portfolio / Southern California / nateanderson.dev</span>
                        <h1 style={{ margin: 0 }}>
                            <span className="cm-highlight wipe hero-title" style={{ display: "inline-flex", flexDirection: "column" }}>
                                <span><span className="hx">Nate Anderson</span></span>
                                <span className="hero-line"><span className="hx">
                                    <span className="hw hw-builds" data-scr-hover>builds</span>{" "}
                                    <span className="hw hw-games" data-scr-hover>games,</span>
                                </span></span>
                                <span className="hero-line"><span className="hx">
                                    <span className="hw hw-renders" data-scr-hover>renders</span>{" "}
                                    <span className="hw-amp" aria-hidden="true">&amp;</span>{" "}
                                    <span className="hw hw-systems" data-scr-hover>systems.</span>
                                </span></span>
                            </span>
                        </h1>
                        <ScrollType
                            as="p"
                            auto
                            className="cm-lead"
                            style={{ margin: 0 }}
                            text="Headed to Cal Poly SLO for Construction Management. Currently shipping Fractured Islands: Ascension, a Roblox progression game built in Luau."
                        />
                        <nav className="hero-cta" aria-label="Start here">
                            <Link className="hcta hcta-main" href="/creations/projects" data-scr-hover>
                                <span className="hcta-no" aria-hidden="true">01</span>
                                <span className="hcta-txt"><b data-scr-text>View projects</b><small>/creations/projects</small></span>
                                <span className="hcta-arr" aria-hidden="true">→</span>
                            </Link>
                            <Link className="hcta" href="/about" data-scr-hover>
                                <span className="hcta-no" aria-hidden="true">02</span>
                                <span className="hcta-txt"><b data-scr-text>About me</b><small>/about</small></span>
                                <span className="hcta-arr" aria-hidden="true">→</span>
                            </Link>
                            <Link className="hcta" href="/creations/games" data-scr-hover>
                                <span className="hcta-no" aria-hidden="true">03</span>
                                <span className="hcta-txt"><b data-scr-text>Play the games</b><small>/creations/games</small></span>
                                <span className="hcta-arr" aria-hidden="true">→</span>
                            </Link>
                        </nav>
                        <div className="meta stats">
                            <div><div className="cm-lbl">Projects</div>{projects.length > 0 ? <CountUp className="big" value={projects.length} /> : <span className="big none" aria-label="None yet">—</span>}</div>
                            <div><div className="cm-lbl">Renovations</div>{renovations.length > 0 ? <CountUp className="big" value={renovations.length} /> : <span className="big none" aria-label="None yet">—</span>}</div>
                            <div><div className="cm-lbl">Playable games</div>{playable > 0 ? <CountUp className="big" value={playable} /> : <span className="big none" aria-label="None yet">—</span>}</div>
                        </div>
                        </div>
                        <aside className="hero-status id" aria-label="Current status" data-mx="slide-r">
                            <div className="id-top">
                                <Scramble className="id-sys" replay text="naOS // status" />
                                <span className="id-live"><i aria-hidden="true" />Live</span>
                            </div>
                            <div className="id-main">
                                <div className="id-badge" aria-hidden="true"><b>na</b><span>2027</span></div>
                                <dl className="id-rows">
                                    <div><dt>Based</dt><dd><Scramble replay text="Southern California" /></dd></div>
                                    <div><dt>Studying</dt><dd><Scramble replay text="Construction management" /></dd></div>
                                    <div><dt>Shipping</dt><dd><Link href="/creations"><Scramble replay text="Fractured Islands: Ascension" /></Link></dd></div>
                                    <div><dt>Built in</dt><dd><Scramble replay text="Luau, TypeScript, Blender" /></dd></div>
                                    <div><dt>Graduation</dt><dd><Scramble replay text="2031" /></dd></div>
                                </dl>
                            </div>
                            <div className="id-foot" aria-hidden="true">
                                <span className="id-bars"><i /><i /><i /><i /><i /></span>
                                <span>signal / strong</span>
                                <span>33.7N 117.9W</span>
                            </div>
                        </aside>
                    </div>
                </div>
            </header>

            <Section
                    ctos
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
                            <Link key={p.slug} className="cm-card link" href={`/creations/${p.slug}`}>
                                    <div className="cm-viz">
                                        <span className="cm-tag flat">{p.category}</span>
                                        <span className="glyph" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                                    </div>
                                    <b>{p.title}</b>
                                    <p>{p.description}</p>
                                    <span className="st">{p.tags.slice(0, 3).join(" / ")}</span>
                                </Link>
                        ))}
                    </div>
                </Section>

            <Section ctos id="profile" no="02" label="Profile" title="Who I am, and where I'm headed.">
                <div className="pf">
                    <div className="cm-panel pf-id">
                        <div className="cm-hbar"><span>Profile</span><span>Class of 2027</span></div>
                        <ScrollType as="p" className="pf-lead" text={PROFILE_LEAD} />
                        <dl className="pf-pillars">
                            {PILLARS.map((p) => (
                                <div key={p.label}>
                                    <dt>{p.label}</dt>
                                    <dd>{p.headline}</dd>
                                    <small>{p.detail}</small>
                                </div>
                            ))}
                        </dl>
                        <div className="p-foot" aria-hidden="true"><span className="id-bars"><i /><i /><i /><i /><i /></span><span>naOS / profile</span><span>class of 2027</span></div>
                    </div>
                    <div className="cm-panel tick pf-now">
                        <div className="cm-hbar"><span>Now</span><span>Feed</span></div>
                        <ul className="pf-feed">
                            {NOW_FEED.map((l) => (
                                <li key={l.tag}><span className="cm-state live">{l.tag}</span><span>{l.text}</span></li>
                            ))}
                        </ul>
                        <div className="p-foot" aria-hidden="true"><span className="id-bars"><i /><i /><i /><i /><i /></span><span>feed / live</span><span>{NOW_FEED.length} items</span></div>
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
                        <div className="p-foot" aria-hidden="true"><span className="id-bars"><i /><i /><i /><i /><i /></span><span>path / {PATH.length} steps</span><span>to 2031</span></div>
                    </div>
                </div>
            </Section>

            <Suspense fallback={<SiteStatsSkeleton />}>
                <SiteStats />
            </Suspense>

            <TimelinePreview />
            <RecentPosts />

            <Section ctos id="explore" no="06" label="Explore" title="Explore the site.">
                <div className="cm-grid">
                    {navItems
                        .filter((n) => n.href !== "/")
                        .map((n, i) => (
                            <Link key={n.href} className="cm-card link" href={n.href}>
                                    <span className="cm-state">{n.no}</span>
                                    <b>{n.title}</b>
                                    <p>{n.blurb}</p>
                                    <span className="st">{n.href}</span>
                                </Link>
                        ))}
                </div>
            </Section>
        </div>
    );
}
