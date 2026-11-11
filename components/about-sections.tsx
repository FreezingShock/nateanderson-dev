import Link from "next/link";
import { Meter } from "@/components/cm/ui";
import { ScrollType } from "@/components/cm/motion";
import { beliefs, building, designPrinciples, runningPlan, runningStats } from "@/lib/about-data";
import { READING_STATUS, readingQueue } from "@/lib/studies-data";
import { phases, progressBetween } from "@/lib/timeline-data";

// Static sections of /about. Server components, rendered once to HTML. The page wraps them in .ctos, so the naOS
// panels, card variety and scrubbed reveals come from app/camino/ctos.css and the layout lives in app/about/about.css.

const kw = (text: string) => <strong>{text}</strong>;

const buildTone = (status: string) => (/development|always|senior|playable/i.test(status) ? "live" : "");

// The three verbs from the story: how I think, execute and create.
const verbs = [
    { verb: "Think", name: "Philosophy", detail: "Kierkegaard's ethics, agnosticism, interconnected systems" },
    { verb: "Execute", name: "Discipline", detail: "Competitive running, strength training, precision" },
    { verb: "Create", name: "Systems thinking", detail: "Game mechanics, urban design, code architecture" },
];

export function AboutStory() {
    return (
        <div className="about-story">
            <div>
                <ScrollType
                    as="p"
                    className="about-lede"
                    text="I'm Nate, a senior in high school in Southern California. I'm headed to Cal Poly SLO for Construction Management, with Cal Poly Pomona as a goal and community college as my fallback. I build games, render systems, and design spaces, always with an eye toward sustainable, interconnected systems."
                />
            </div>
            <div className="cm-panel">
                <div className="cm-hbar"><span>How I work</span><span>Think / execute / create</span></div>
                <dl className="about-verbs">
                    {verbs.map((v) => (
                        <div key={v.verb}>
                            <dt>{v.verb}</dt>
                            <dd>
                                {v.name}
                                <small>{v.detail}</small>
                            </dd>
                        </div>
                    ))}
                </dl>
                <div className="p-foot" aria-hidden="true">
                    <span className="id-bars"><i /><i /><i /><i /><i /></span>
                    <span>story / 3 of 3</span>
                    <span>naOS / about</span>
                </div>
            </div>
        </div>
    );
}

export function BuildingCards() {
    return (
        <div className="cm-grid">
            {building.map((item) => (
                <Link key={item.title} href={item.href} className="cm-card link" style={{ height: "100%" }}>
                    <span className={`cm-tag flat ${buildTone(item.status)}`} style={{ alignSelf: "flex-start" }}>{item.status}</span>
                    <b style={{ fontSize: 17, marginTop: 6 }}>{item.title}</b>
                    <p>{item.description}</p>
                    <span className="st">{item.cta} →</span>
                </Link>
            ))}
        </div>
    );
}

export function RunningSection() {
    return (
        <div className="about-run">
            <div className="meta stats" style={{ ["--cols" as string]: runningStats.length }}>
                {runningStats.map((s) => (
                    <div key={s.label}>
                        <div className="cm-lbl">{s.label}</div>
                        <span className="big" style={{ color: s.color }}>{s.value}</span>
                    </div>
                ))}
            </div>

            <div className="about-flag">
                <span className="cm-state live">Training</span>
                <span>Base of 35 miles a week</span>
                <span className="cm-note">Cross country and track, captain for senior year.</span>
            </div>

            <div className="about-split">
                <div>
                    <span className="cm-lbl">The running plan</span>
                    <ol className="cm-rail" style={{ margin: "14px 0 0", padding: "0 0 0 22px" }}>
                        {runningPlan.map((step, i) => (
                            <li key={step.title} className={i === 0 ? "now" : ""}>
                                <Link href={step.href} className="cm-card link" style={{ textDecoration: "none" }}>
                                    <span className="cm-state live">{step.when}</span>
                                    <b>{step.title}</b>
                                    <p>{step.detail}</p>
                                </Link>
                            </li>
                        ))}
                    </ol>
                </div>
                <div className="cm-panel">
                    <div className="cm-hbar"><span>Training philosophy</span><span>Cross country</span></div>
                    <p className="cm-body-pad cm-prose" style={{ margin: 0 }}>
                        Consistent training, mental resilience and continuous improvement. Cross country has shaped my
                        discipline and leadership, qualities I bring to all areas of work.
                    </p>
                    <div className="p-foot" aria-hidden="true">
                        <span className="id-bars"><i /><i /><i /><i /><i /></span>
                        <span>training / base</span>
                        <span>base / 35 mi</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function PhilosophySection() {
    const books = readingQueue.filter((r) => r.author);
    return (
        <div style={{ display: "grid", gap: "var(--cm-s7)" }}>
            <p className="cm-prose" style={{ margin: 0 }}>
                Philosophy shapes how I build. {kw("Kierkegaard")} informs authenticity and ethical choice.{" "}
                {kw("Agnosticism and Egg Theory")} ground my systems thinking in humility and interconnection.
            </p>

            <div style={{ display: "grid", gap: 14 }}>
                <span className="cm-lbl">Core beliefs</span>
                <div className="cm-cols3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                    {beliefs.map((b) => (
                        <div key={b.title} className="cm-card">
                            <b>{b.title}</b>
                            <p>{b.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
                <span className="cm-lbl">What &ldquo;authentic&rdquo; design means</span>
                <div className="cm-cols3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                    {designPrinciples.map((p, i) => (
                        <div key={p.title} className="cm-card">
                            <span className="cm-state">Principle {i + 1}</span>
                            <b>{p.title}</b>
                            <p>{p.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
                <div className="cm-row" style={{ justifyContent: "space-between" }}>
                    <span className="cm-lbl">On the shelf</span>
                    <Link className="cm-more" href="/studies#reading">The full reading queue →</Link>
                </div>
                <div className="cm-cols3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                    {books.map((b) => {
                        const st = READING_STATUS[b.status];
                        return (
                            <div key={b.title} className="cm-card">
                                <div className="cm-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                                    <b>{b.title}</b>
                                    <span className={`cm-state ${b.status === "reading" ? "live" : ""}`}>{st.label}</span>
                                </div>
                                <span className="cm-coord">{b.author}</span>
                                <p>{b.note}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// Reads the same dates and progress as /timeline and links there for the detail.
export function PathGlance({ nowMs }: { nowMs: number }) {
    const stages = phases.filter((p) => p.id !== "personal");
    return (
        <div className="cm-cols3">
            {stages.map((p) => {
                const progress = Math.round(progressBetween(p.start, p.end, nowMs) * 100);
                return (
                    <Link key={p.id} href={`/timeline#${p.id}`} className="cm-card link" style={{ gap: 8 }}>
                        <span className="cm-state live">{p.range}</span>
                        <b style={{ fontSize: 17 }}>{p.title}</b>
                        <p>{p.description}</p>
                        <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                            <div className="cm-row" style={{ justifyContent: "space-between" }}>
                                <span className="cm-lbl">Progress</span>
                                <span className="cm-num" style={{ fontSize: 11 }}>{progress}%</span>
                            </div>
                            <Meter value={progress} label={`${p.title} progress`} />
                        </div>
                        <span className="st">On the timeline →</span>
                    </Link>
                );
            })}
        </div>
    );
}
