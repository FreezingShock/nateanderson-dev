import Link from "next/link";
import { PageHead, Section } from "@/components/cm/ui";
import {
    AboutStory,
    BuildingCards,
    PathGlance,
    PhilosophySection,
    RunningSection,
} from "@/components/about-sections";
import { SystemsExplorer } from "@/components/systems-explorer";
import { SkillsExplorer } from "@/components/skills-explorer";

// Statically generated, refreshed hourly: the days-to-graduation figure and the path progress bars come
// from real dates at render time.
export const revalidate = 3600;

export default function AboutPage() {
    // One clock reading shared by every component, so server HTML and client hydration agree exactly.
    const nowMs = Date.now();

    return (
        <>
            <PageHead
                label="About / Who I am"
                title={["Who I Am"]}
                lead="Engineer, builder, runner, systems thinker. This page is the comprehensive story: how the parts connect."
            />
            <Section id="hero" no="01" label="Who I am" title="How the parts connect.">
                <AboutStory nowMs={nowMs} />
            </Section>
            <Section id="building" no="02" label="What I'm building" title="What I'm building now.">
                <BuildingCards />
            </Section>
            <Section id="running" no="03" label="Running & athletics" title="Running & athletics.">
                <RunningSection />
            </Section>
            <Section id="roblox" no="04" label="Fractured Islands" title="Fractured Islands: system design.">
                <SystemsExplorer />
            </Section>
            <Section id="philosophy" no="05" label="Philosophy" title="Philosophy & thinking.">
                <PhilosophySection />
            </Section>
            <Section
                id="skills"
                no="06"
                label="Skills"
                title="Skills & expertise."
                blurb="Skills organized by domain. Each reflects hands-on experience and active development."
            >
                <SkillsExplorer />
            </Section>
            <Section
                id="timeline"
                no="07"
                label="The path"
                title="Four years, three stages, one destination."
                blurb="The full plan, with every milestone, lives on the timeline."
            >
                <PathGlance nowMs={nowMs} />
            </Section>
            <section className="cm-section">
                <div className="cm-wrap">
                    <div className="cm-panel tick sign">
                        <div className="cm-hbar"><span>What&apos;s next</span><span>Living document</span></div>
                        <div className="cm-body-pad cm-stack">
                            <p className="cm-prose">
                                This page is a living document. Each section will deepen as projects launch, the portfolio
                                grows, and plans materialize. To see the work in progress:
                            </p>
                            <div className="cm-row">
                                <Link className="cm-btn solid" href="/creations/projects">View projects</Link>
                                <Link className="cm-btn" href="/blog">Read essays</Link>
                                <Link className="cm-btn" href="/timeline">Full timeline</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}

export const metadata = { title: "About" };
