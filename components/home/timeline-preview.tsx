import { Section } from "@/components/cm/ui";
import { NEXT_MONTHS, NEXT_YEAR } from "@/lib/upcoming";

// Timeline view: the next few months as a rail, and a preview of next year. The full plan lives on /timeline.
export function TimelinePreview() {
    return (
        <Section
            ctos
            id="timeline"
            no="04"
            label="Timeline view"
            title="Right now, and the year ahead."
            blurb="What I'm working toward right now and a look at the year ahead."
            more={{ href: "/timeline", label: "Full timeline" }}
        >
            <div className="cm-split">
                <div>
                    <span className="cm-lbl">Next 3 months</span>
                    <ol className="cm-rail" style={{ margin: "14px 0 0" }}>
                        {NEXT_MONTHS.map((m, i) => (
                            <li key={m.label} className={i === 0 ? "now" : ""}>
                                <div className="cm-panel">
                                    <div className="cm-hbar">
                                        <span className={i === 0 ? "live" : ""}>{m.label}</span>
                                        <span>{i === 0 ? `${m.year} / Now` : m.year}</span>
                                    </div>
                                    <ul className="cm-body-pad" style={{ margin: 0, paddingLeft: 30, display: "grid", gap: 6 }}>
                                        {m.goals.map((g) => (
                                            <li key={g} style={{ color: "var(--cm-mute)", listStyle: "square" }}>{g}</li>
                                        ))}
                                    </ul>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
                <div>
                    <span className="cm-lbl">Next year</span>
                    <div className="cm-panel tick" style={{ marginTop: 14 }}>
                        <div className="cm-hbar">
                            <span>{NEXT_YEAR.year}</span>
                            <span>Preview</span>
                        </div>
                        <p className="cm-body-pad cm-note" style={{ paddingBottom: 0 }}>{NEXT_YEAR.blurb}</p>
                        <dl className="cm-body-pad" style={{ margin: 0, display: "grid", gap: 14 }}>
                            {NEXT_YEAR.milestones.map((m) => (
                                <div key={m.title} style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 10 }}>
                                    <dt className="cm-state live">{m.when}</dt>
                                    <dd style={{ margin: 0 }}>
                                        <b className="cm-sub">{m.title}</b>
                                        <p className="cm-note">{m.detail}</p>
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                </div>
            </div>
        </Section>
    );
}
