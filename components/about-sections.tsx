import Link from "next/link";
import { Meter } from "@/components/cm/ui";
import { CountUp, Reveal } from "@/components/cm/reveal";
import { ABOUT_ICONS } from "@/components/about-icons";
import { beliefs, building, designPrinciples, runningPlan, runningStats } from "@/lib/about-data";
import { READING_STATUS, readingQueue } from "@/lib/studies-data";
import { KEY_DATES, daysUntil, phases, progressBetween } from "@/lib/timeline-data";

// Static sections of /about. Server components, rendered once to HTML.

const kw = (text: string) => <strong>{text}</strong>;

const buildTone = (status: string) => (/development|always|senior|playable/i.test(status) ? "live" : "");

export function AboutStory({ nowMs }: { nowMs: number }) {
    const daysToGrad = daysUntil(KEY_DATES.graduation, nowMs);
    const facts = [
        { icon: "GraduationCap" as const, value: "Class of 2027", label: "Senior year" },
        { icon: "Footprints" as const, value: "4 years", label: "Running competitively" },
        { icon: "Globe" as const, value: "SoCal", label: "Home, for good" },
    ];

    return (
        <div className="cm-split">
            <div className="cm-prose">
                <p style={{ color: "var(--cm-fg)", fontSize: "var(--cm-t-lead)" }}>
                    I&apos;m {kw("Nate")}, a senior in high school in Southern California studying toward a degree in{" "}
                    {kw("Environmental Engineering")}. I build games, render systems, and design spaces, always with an eye
                    toward sustainable, interconnected systems.
                </p>
                <p>
                    I think through {kw("philosophy")} (Kierkegaard&apos;s ethics, agnosticism, interconnected systems), execute
                    through {kw("discipline")} (competitive running, strength training, precision), and create through{" "}
                    {kw("systems thinking")} (game mechanics, urban design, code architecture).
                </p>
                <p>
                    By Spring 2031, my goal: launch a {kw("sustainable infrastructure/urban design business")} after completing
                    my degree at Cal Poly Pomona, with financial freedom and athletic leadership woven through the journey.
                </p>
            </div>
            <div className="cm-panel tick">
                <div className="cm-hbar"><span>Profile</span><span>Class of 2027</span></div>
                <dl className="cm-kv two" style={{ ["--cols" as string]: 2 }}>
                    {facts.map((f) => {
                        const Icon = ABOUT_ICONS[f.icon];
                        return (
                            <div key={f.label}>
                                <dt>{f.label}</dt>
                                <dd style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                                    <Icon className="cm-ico" aria-hidden="true" />
                                    {f.value}
                                </dd>
                            </div>
                        );
                    })}
                    <div>
                        <dt>Days to graduation</dt>
                        <dd style={{ color: "var(--cm-cyan)", fontSize: 22 }}>
                            {daysToGrad > 0 ? <CountUp value={daysToGrad} /> : "Done"}
                        </dd>
                    </div>
                </dl>
            </div>
        </div>
    );
}

export function BuildingCards() {
    return (
        <div className="cm-grid">
            {building.map((item, i) => (
                <Reveal key={item.title} delay={(i % 3) * 70}>
                    <Link href={item.href} className="cm-card link" style={{ height: "100%" }}>
                        <span className={`cm-tag flat ${buildTone(item.status)}`} style={{ alignSelf: "flex-start" }}>{item.status}</span>
                        <b style={{ fontSize: 17, marginTop: 6 }}>{item.title}</b>
                        <p>{item.description}</p>
                        <span className="st">{item.cta} →</span>
                    </Link>
                </Reveal>
            ))}
        </div>
    );
}

export function RunningSection() {
    return (
        <div style={{ display: "grid", gap: "var(--cm-s5)" }}>
            <dl className="cm-panel tick cm-kv" style={{ ["--cols" as string]: 4 }}>
                {runningStats.map((s) => (
                    <div key={s.label}>
                        <dt>{s.label}</dt>
                        <dd style={{ fontSize: 26 }}>{s.value}</dd>
                    </div>
                ))}
            </dl>

            <div className="cm-hatch" style={{ padding: 14 }}>
                <span className="cm-read good" style={{ color: "var(--cm-good)" }}>
                    Exceeds Santa Monica College&apos;s recruiting standards
                </span>
                <span className="cm-note" style={{ display: "inline", marginLeft: 8 }}>on the recruited-athlete path into college running.</span>
            </div>

            <div className="cm-split">
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
                        discipline and leadership, qualities I bring to all areas of work. Racing as a recruited athlete
                        through college (SMC to Cal Poly Pomona) is part of my long-term vision.
                    </p>
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
