import Link from "next/link";
import {
    READING_STATUS,
    pathway,
    readingQueue,
    toolRoadmap,
    type Program,
    type ReadingStatus,
} from "@/lib/studies-data";
import { Meter } from "@/components/cm/ui";
import { phases, progressBetween } from "@/lib/timeline-data";

// Static sections of /studies. All server components: they render once as HTML.

export function ProgramCardView({ program }: { program: Program }) {
    return (
        <div className="cm-panel st-panel-fill">
            <div className="cm-hbar">
                <span>{program.institution ?? "Self-directed"}</span>
                <span>{program.timeline}</span>
            </div>
            <div className="cm-body-pad" style={{ display: "grid", gap: 10 }}>
                <h4 className="cm-h3" style={{ margin: 0 }}><span className="st-tt">{program.title}</span></h4>
                <p className="cm-body" style={{ margin: 0 }}>{program.description}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {program.courses.map((c) => (
                        <span key={c} className="cm-pill">{c}</span>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function PathwayRail({ nowMs }: { nowMs: number }) {
    return (
        <ol className="cm-rail" style={{ margin: 0 }}>
            {pathway.map((stage) => {
                const phase = phases.find((p) => p.id === stage.phaseId)!;
                const progress = progressBetween(phase.start, phase.end, nowMs);
                const pct = Math.round(progress * 100);
                const state = progress >= 1 ? "done" : progress > 0 ? "now" : "";
                return (
                    <li key={stage.phaseId} className={state}>
                        <div className="cm-panel tick">
                            <div className="cm-hbar">
                                <span className={state === "now" ? "live" : ""}>{phase.range}</span>
                                <span>{progress >= 1 ? "Complete" : progress > 0 ? "In progress" : "Not started"}</span>
                            </div>
                            <div className="cm-body-pad" style={{ display: "grid", gap: 10 }}>
                                <h3 className="cm-h2" style={{ margin: 0 }}>{stage.title}</h3>
                                <p className="cm-body" style={{ margin: 0, maxWidth: "70ch" }}>{stage.blurb}</p>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{ flex: 1 }}>
                                        <Meter value={pct} label={`${stage.title} progress`} />
                                    </div>
                                    <span className="cm-coord">{pct}%</span>
                                </div>
                                <Link href={`/timeline#${stage.phaseId}`} className="cm-more">
                                    See it on the timeline →
                                </Link>
                            </div>
                        </div>

                        {stage.programs.length > 0 ? (
                            <div className="cm-cols3" style={{ marginTop: 12 }}>
                                {stage.programs.map((p) => (
                                    <ProgramCardView key={p.title} program={p} />
                                ))}
                            </div>
                        ) : (
                            <Link href="#classes" className="cm-more" style={{ marginTop: 12, display: "inline-block" }}>
                                The six classes are above →
                            </Link>
                        )}
                    </li>
                );
            })}
        </ol>
    );
}

export function ReadingQueue() {
    const counts = readingQueue.reduce(
        (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
        {} as Record<ReadingStatus, number>
    );
    return (
        <div style={{ display: "grid", gap: 18 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(Object.keys(READING_STATUS) as ReadingStatus[]).map((s) => (
                    <span key={s} className={s === "reading" ? "cm-pill on" : "cm-pill"}>
                        {READING_STATUS[s].label}
                        <span style={{ opacity: 0.7 }}>{counts[s] ?? 0}</span>
                    </span>
                ))}
            </div>
            <div className="cm-cols3">
                {readingQueue.map((item) => {
                    const st = READING_STATUS[item.status];
                    return (
                        <div key={item.title} className="cm-panel" style={{ height: "100%" }}>
                            <div className="cm-hbar">
                                <span className={item.status === "reading" ? "live" : ""}>{st.label}</span>
                                {item.author && <span>{item.author}</span>}
                            </div>
                            <div className="cm-body-pad" style={{ display: "grid", gap: 8 }}>
                                <h4 className="cm-h3" style={{ margin: 0 }}>{item.title}</h4>
                                <p className="cm-body" style={{ margin: 0 }}>{item.note}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function ToolRoadmap() {
    return (
        <div className="cm-cols3">
            {toolRoadmap.map((stage, i) => (
                <div key={stage.label} className="cm-panel" style={{ height: "100%" }}>
                    <div className="cm-hbar">
                        <span>{String(i + 1).padStart(2, "0")} / {stage.when}</span>
                    </div>
                    <div className="cm-body-pad" style={{ display: "grid", gap: 10 }}>
                        <h4 className="cm-h3" style={{ margin: 0 }}>{stage.label}</h4>
                        <ul className="st-list">
                            {stage.skills.map((s) => (
                                <li key={s}>{s}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            ))}
        </div>
    );
}
