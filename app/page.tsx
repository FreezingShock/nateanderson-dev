import Link from "next/link";
import { Suspense } from "react";
import { allGames } from "@/lib/creations-data";
import { NOW_FEED, PATH, PILLARS, PROFILE_LEAD } from "@/lib/identity";
import { navItems } from "@/lib/nav";
import { Section } from "@/components/cm/ui";
import { ScrollType, Scramble } from "@/components/cm/motion";
import { NaosArt, NaosBackdrop } from "@/components/cm/naos-art";
import { SiteStats, SiteStatsSkeleton } from "@/components/home/site-stats";
import { TimelinePreview } from "@/components/home/timeline-preview";
import { FeaturedCards, FeaturedSkeleton } from "@/components/home/featured-work";
import { HeroStats, HeroStatsFallback } from "@/components/home/hero-stats";
import { RecentPosts } from "@/components/home/recent-posts";
import "@/components/home/home.css";

export const revalidate = 60; // re-check Supabase for new content every 60s

// Nothing here waits on the network: the library lookups live in <FeaturedCards />, behind a Suspense boundary, so
// the hero and every section paint at once and the cards stream in when Supabase answers.
export default function Home() {
    const playable = allGames().filter((g) => g.status === "playable").length;

    return (
        <div className="ctos" data-entrance="dither">
            <NaosBackdrop src="/naos/bg-home.webp" />
            <header className="cm-hero" id="top">
                <div className="cm-grid-bg" aria-hidden="true" />
                <div className="cm-persp" aria-hidden="true" />
                <NaosArt src="/naos/islands.webp" width={300} height={200} variant="hero" eager />
                <div className="ring" aria-hidden="true" data-mx-par="0.12" />
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
                            text="Headed to Cal Poly SLO for Construction Management. Currently shipping Nexus, a cozy offline city builder at playnexus.dev."
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
                            <Suspense fallback={<HeroStatsFallback playable={playable} />}>
                                <HeroStats playable={playable} />
                            </Suspense>
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
                                    <div><dt>Shipping</dt><dd><Link href="/creations/projects"><Scramble replay text="Nexus at playnexus.dev" /></Link></dd></div>
                                    <div><dt>Built in</dt><dd><Scramble replay text="TypeScript, Three.js, JavaScript" /></dd></div>
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
                        <Suspense fallback={<FeaturedSkeleton />}>
                            <FeaturedCards />
                        </Suspense>
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
                                    <dd>{p.headline}<small>{p.detail}</small></dd>
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
