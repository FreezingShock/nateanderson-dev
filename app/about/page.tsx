import Link from "next/link";
import { Section } from "@/components/cm/ui";
import { CountUp } from "@/components/cm/reveal";
import { Scramble, ScrollType } from "@/components/cm/motion";
import {
    AboutStory,
    BuildingCards,
    PathGlance,
    PhilosophySection,
    RunningSection,
} from "@/components/about-sections";
import { SystemsExplorer } from "@/components/systems-explorer";
import { SkillsExplorer } from "@/components/skills-explorer";
import { KEY_DATES, daysUntil } from "@/lib/timeline-data";
import "./about.css";

// Statically generated, refreshed hourly: the days-to-graduation figure and the path progress bars come
// from real dates at render time.
export const revalidate = 3600;

export default function AboutPage() {
    // One clock reading shared by every component, so server HTML and client hydration agree exactly.
    const nowMs = Date.now();
    const daysToGrad = daysUntil(KEY_DATES.graduation, nowMs);

    return (
        <div className="ctos about">
            <header className="cm-head about-head" id="top">
                <div className="cm-grid-bg" aria-hidden="true" />
                <div className="cm-persp" aria-hidden="true" />
                <span className="cm-ctos-tag" aria-hidden="true">naOS</span>
                <div className="cm-wrap about-hero">
                    <div className="about-copy cm-stage">
                        <Scramble className="cm-lbl" text="About / Who I am" />
                        <h1 style={{ margin: 0 }}>
                            <span className="cm-highlight wipe about-title">
                                <span><span className="hx">Who I am.</span></span>
                                <span><span className="hx">How it connects.</span></span>
                            </span>
                        </h1>
                        <ScrollType
                            as="p"
                            auto
                            className="about-lead"
                            text="Engineer, builder, runner, systems thinker. This page is the comprehensive story: how the parts connect."
                        />
                    </div>
                    <aside className="about-id id" aria-label="Profile card" data-mx="slide-r">
                        <div className="id-top">
                            <Scramble className="id-sys" replay text="naOS // about" />
                            <span className="id-live"><i aria-hidden="true" />Live</span>
                        </div>
                        <div className="id-main">
                            <div className="id-badge" aria-hidden="true"><b>na</b><span>2027</span></div>
                            <dl className="id-rows">
                                <div><dt>Based</dt><dd><Scramble replay text="Southern California" /></dd></div>
                                <div><dt>Studying</dt><dd><Scramble replay text="Environmental engineering" /></dd></div>
                                <div><dt>Running</dt><dd><Scramble replay text="4 years, captain" /></dd></div>
                                <div><dt>Shipping</dt><dd><Link href="/creations/fractured-islands"><Scramble replay text="Fractured Islands: Ascension" /></Link></dd></div>
                                <div>
                                    <dt>Days to graduation</dt>
                                    <dd>{daysToGrad > 0 ? <CountUp value={daysToGrad} /> : "Done"}</dd>
                                </div>
                            </dl>
                        </div>
                        <div className="id-foot" aria-hidden="true">
                            <span className="id-bars"><i /><i /><i /><i /><i /></span>
                            <span>profile / class of 2027</span>
                            <span>33.7N 117.9W</span>
                        </div>
                    </aside>
                </div>
            </header>

            <Section ctos id="hero" no="01" label="Who I am" title="How the parts connect.">
                <AboutStory />
            </Section>
            <Section ctos id="building" no="02" label="What I'm building" title="What I'm building now.">
                <BuildingCards />
            </Section>
            <Section ctos id="running" no="03" label="Running & athletics" title="Running & athletics.">
                <RunningSection />
            </Section>
            <Section ctos id="roblox" no="04" label="Fractured Islands" title="Fractured Islands: system design.">
                <SystemsExplorer />
            </Section>
            <Section ctos id="philosophy" no="05" label="Philosophy" title="Philosophy & thinking.">
                <PhilosophySection />
            </Section>
            <Section
                ctos
                id="skills"
                no="06"
                label="Skills"
                title="Skills & expertise."
                blurb="Skills organized by domain. Each reflects hands-on experience and active development."
            >
                <SkillsExplorer />
            </Section>
            <Section
                ctos
                id="timeline"
                no="07"
                label="The path"
                title="Four years, three stages, one destination."
                blurb="The full plan, with every milestone, lives on the timeline."
            >
                <PathGlance nowMs={nowMs} />
            </Section>
            <section className="cm-section ruled">
                <div className="cm-wrap" data-rx-auto="">
                    <div className="cm-panel about-next">
                        <div className="cm-hbar"><span>What&apos;s next</span><span>Living document</span></div>
                        <div className="cm-body-pad">
                            <p className="cm-prose">
                                This page is a living document. Each section will deepen as projects launch, the portfolio
                                grows, and plans materialize. To see the work in progress:
                            </p>
                        </div>
                        <div className="cm-row cta" style={{ padding: "0 var(--cm-s5) var(--cm-s5)" }}>
                            <Link className="cta-b a" href="/creations/projects"><i>01</i><span>View projects</span><em aria-hidden="true">→</em></Link>
                            <Link className="cta-b b" href="/blog"><i>02</i><span>Read essays</span><em aria-hidden="true">→</em></Link>
                            <Link className="cta-b c" href="/timeline"><i>03</i><span>Full timeline</span><em aria-hidden="true">→</em></Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

export const metadata = { title: "About" };
