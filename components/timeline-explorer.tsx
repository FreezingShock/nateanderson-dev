"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Collapse } from "@/components/collapse";
import { Meter } from "@/components/cm/ui";
import { useActiveSection } from "@/lib/use-active-section";
import {
    CATEGORIES,
    getStatus,
    progressBetween,
    type Category,
    type EventStatus,
    type TimelineEventData,
    type TimelinePhaseData,
} from "@/lib/timeline-data";

// The interactive heart of /timeline. Data is static, so this is server-rendered HTML that hydrates into
// a handful of toggles: per-event detail panels, per-phase collapse, expand/collapse all, a milestones-only
// filter and a category legend that filters too. Panel open/close is a CSS grid-rows transition, and rows
// are memoized so toggling one doesn't re-render the rest.

const STATUS_LABEL: Record<EventStatus, string> = {
    done: "Done",
    now: "Now",
    upcoming: "Upcoming",
    ongoing: "Ongoing",
    planned: "Planned",
};

const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

// A phase is "live" when today falls inside it. Only live phases start expanded; past and future phases start
// collapsed and mount their milestones the first time they are opened, which keeps the first paint small.
const isLivePhase = (phase: TimelinePhaseData, nowMs: number) => {
    const p = progressBetween(phase.start, phase.end, nowMs);
    return p > 0 && p < 1;
};

interface EventRowProps {
    event: TimelineEventData;
    status: EventStatus;
    open: boolean;
    onToggle: (id: string) => void;
}

const EventRow = memo(function EventRow({ event, status, open, onToggle }: EventRowProps) {
    const special = !!event.special;
    const hasDetails = !!event.details?.length;
    const detailsId = `${event.id}-details`;
    const live = status === "now";
    const state = status === "now" ? "now" : status === "done" ? "done" : "";
    // Detail panels mount the first time they open and then stay mounted, so closing keeps its animation.
    const [detailsSeen, setDetailsSeen] = useState(open);
    if (open && !detailsSeen) setDetailsSeen(true);

    const header = (
        <>
            <span style={{ display: "grid", gap: 8, minWidth: 0, flex: 1 }}>
                <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                    <span className="cm-lbl" style={{ color: live ? "var(--cm-cyan)" : undefined }}>
                        {event.when}
                    </span>
                    <span className={live ? "cm-pill on" : "cm-pill"}>{STATUS_LABEL[status]}</span>
                    {special && <span className="cm-tag live flat">Milestone</span>}
                </span>
                <span className="cm-h3" style={{ margin: 0 }}>
                    {event.title}
                </span>
            </span>
            {hasDetails && (
                <span aria-hidden="true" className="cm-lbl" style={{ flexShrink: 0 }}>
                    {open ? "−" : "+"}
                </span>
            )}
        </>
    );

    return (
        <li id={event.id} className={`tl-ev ${state} tl-s-${status}`.trim()} style={{ scrollMarginTop: 120 }}>
            <div className="cm-panel" style={{ opacity: status === "upcoming" || status === "planned" ? 0.85 : 1 }}>
                {hasDetails ? (
                    <button
                        type="button"
                        onClick={() => onToggle(event.id)}
                        aria-expanded={open}
                        aria-controls={detailsId}
                        className="cm-body-pad"
                        style={{ display: "flex", width: "100%", alignItems: "flex-start", justifyContent: "space-between", gap: 12, textAlign: "left", background: "none", border: 0, color: "inherit", cursor: "pointer", font: "inherit" }}
                    >
                        {header}
                    </button>
                ) : (
                    <div className="cm-body-pad" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                        {header}
                    </div>
                )}

                <div className="cm-body-pad" style={{ paddingTop: 0, display: "grid", gap: 10 }}>
                    <p className="cm-body" style={{ margin: 0 }}>{event.description}</p>

                    {event.tags && event.tags.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {event.tags.map((tag) => (
                                <span key={tag} className="cm-pill">{tag}</span>
                            ))}
                        </div>
                    )}

                    {hasDetails && (open || detailsSeen) && (
                        <Collapse open={open} id={detailsId}>
                            <ul style={{ margin: 0, padding: "12px 0 0 18px", display: "grid", gap: 6, borderTop: "1px solid var(--cm-hair)" }}>
                                {event.details!.map((detail) => (
                                    <li key={detail} style={{ color: "var(--cm-mute)", listStyle: "square" }}>
                                        {detail}
                                    </li>
                                ))}
                            </ul>
                        </Collapse>
                    )}
                </div>
            </div>
        </li>
    );
});

export function TimelineExplorer({
    phases,
    nowMs,
}: {
    phases: TimelinePhaseData[];
    nowMs: number;
}) {
    // Status is computed once per render from the server's clock so server and
    // client HTML match exactly (no hydration mismatch).
    const statuses = useMemo(() => {
        const map: Record<string, EventStatus> = {};
        for (const phase of phases)
            for (const e of phase.events) map[e.id] = getStatus(e, nowMs);
        return map;
    }, [phases, nowMs]);

    // Details start open only for the major thing happening right now.
    const [open, setOpen] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        for (const phase of phases)
            for (const e of phase.events)
                initial[e.id] = statuses[e.id] === "now" && e.type === "major";
        return initial;
    });
    // Past and future phases start collapsed (see isLivePhase). Same clock on the server and the client, so the
    // first HTML matches what hydrates.
    const [collapsedPhases, setCollapsedPhases] = useState<
        Record<string, boolean>
    >(() =>
        Object.fromEntries(
            phases.filter((p) => !isLivePhase(p, nowMs)).map((p) => [p.id, true])
        )
    );
    // Phases whose milestones have been mounted at least once. Live phases are mounted from the first render, so
    // the server HTML still contains them and deep links work without JS.
    const [seenPhases, setSeenPhases] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(
            phases.filter((p) => isLivePhase(p, nowMs)).map((p) => [p.id, true])
        )
    );
    useLayoutEffect(() => {
        setSeenPhases((s) => {
            const fresh = phases.filter((p) => !collapsedPhases[p.id] && !s[p.id]);
            if (fresh.length === 0) return s;
            const next = { ...s };
            for (const p of fresh) next[p.id] = true;
            return next;
        });
    }, [collapsedPhases, phases]);
    const [milestonesOnly, setMilestonesOnly] = useState(false);
    const [hiddenCats, setHiddenCats] = useState<
        Partial<Record<Category, boolean>>
    >({});

    const activePhase = useActiveSection(
        useMemo(() => phases.map((p) => p.id), [phases])
    );

    const categoryCounts = useMemo(() => {
        const counts = {} as Record<Category, number>;
        for (const key of CATEGORY_KEYS) counts[key] = 0;
        for (const phase of phases)
            for (const e of phase.events) counts[e.category]++;
        return counts;
    }, [phases]);

    const filtersActive =
        milestonesOnly || CATEGORY_KEYS.some((k) => hiddenCats[k]);

    const visibleByPhase = useMemo(() => {
        const map: Record<string, TimelineEventData[]> = {};
        for (const phase of phases) {
            map[phase.id] = phase.events.filter(
                (e) =>
                    !hiddenCats[e.category] &&
                    (!milestonesOnly || e.type === "major" || e.special)
            );
        }
        return map;
    }, [phases, milestonesOnly, hiddenCats]);

    const toggleEvent = useCallback(
        (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] })),
        []
    );

    const setAll = useCallback(
        (value: boolean) => {
            const next: Record<string, boolean> = {};
            for (const phase of phases)
                for (const e of phase.events) next[e.id] = value;
            setOpen(next);
            if (value) setCollapsedPhases({});
        },
        [phases]
    );
    const allPhasesCollapsed = phases.every((p) => collapsedPhases[p.id]);

    // Deep links (#hs-7, #smc, …) must work even when the target is inside a
    // collapsed phase, is hidden by a filter, or has its details closed:
    // reveal it first, then scroll once the panels have finished animating.
    const cullingTimer = useRef(0);
    const reveal = useCallback(
        (id: string, smooth: boolean) => {
            const owner = phases.find(
                (p) => p.id === id || p.events.some((e) => e.id === id)
            );
            // Not a phase or event (#overview, #horizons, …): nothing to
            // expand, but it still needs the safe-scroll treatment below,
            // because it sits past the culled phases.
            if (!owner && !document.getElementById(id)) return false;
            if (owner) {
                setCollapsedPhases((c) => ({ ...c, [owner.id]: false }));
                if (owner.id !== id) {
                    setMilestonesOnly(false);
                    setHiddenCats({});
                    setOpen((o) => ({ ...o, [id]: true }));
                }
            }
            // Off-screen phases are skipped with `content-visibility: auto`,
            // so their heights are estimates until they render. A long
            // programmatic scroll crosses them, they render at their real
            // heights, and the target slides out from under the scroll (it
            // landed thousands of pixels off). So: render every phase for the
            // duration of the jump. Once they've all rendered, the browser
            // remembers their true sizes, so turning culling back on
            // afterwards keeps the layout stable.
            const root = document.documentElement;
            root.classList.add("tl-cv-off");
            window.clearTimeout(cullingTimer.current);
            window.setTimeout(() => {
                const target = document.getElementById(id);
                if (target) {
                    // Smooth only for short hops; a multi-screen smooth scroll
                    // is slow and disorienting, so long jumps are instant.
                    const near =
                        Math.abs(target.getBoundingClientRect().top) <
                        window.innerHeight * 3;
                    target.scrollIntoView({
                        behavior: smooth && near ? "smooth" : "auto",
                        block: !owner || owner.id === id ? "start" : "center",
                    });
                }
                cullingTimer.current = window.setTimeout(
                    () => root.classList.remove("tl-cv-off"),
                    1200
                );
            }, 350);
            return true;
        },
        [phases]
    );

    useEffect(() => {
        if (window.location.hash) reveal(window.location.hash.slice(1), false);

        function onClick(event: MouseEvent) {
            const anchor = (event.target as Element | null)?.closest?.(
                "a[href^='#']"
            );
            if (!anchor) return;
            // Not stopping propagation: the nav bubble's own click handler
            // (which closes its panel) must still run.
            if (reveal((anchor.getAttribute("href") ?? "").slice(1), true)) {
                window.history.replaceState(
                    null,
                    "",
                    anchor.getAttribute("href")
                );
            }
        }
        // Back/forward buttons and hand-edited hashes change the URL without a
        // click on any link (and without a mount), so they need their own hook.
        function onHashChange() {
            reveal(window.location.hash.slice(1), true);
        }
        document.addEventListener("click", onClick);
        window.addEventListener("hashchange", onHashChange);
        return () => {
            document.removeEventListener("click", onClick);
            window.removeEventListener("hashchange", onHashChange);
        };
    }, [reveal]);

    return (
        <div>
            <div className="cm-panel tl-filter" style={{ marginBottom: 32 }}>
                <div className="cm-body-pad" style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {phases.map((phase) => (
                                <a
                                    key={phase.id}
                                    href={`#${phase.id}`}
                                    className="cm-chip"
                                    aria-current={activePhase === phase.id ? "true" : undefined}
                                >
                                    {phase.short}
                                </a>
                            ))}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            <button type="button" className="cm-chip" aria-pressed={milestonesOnly} onClick={() => setMilestonesOnly((v) => !v)}>
                                Milestones only
                            </button>
                            <button type="button" className="cm-chip" onClick={() => setAll(true)}>
                                Expand all
                            </button>
                            <button
                                type="button"
                                className="cm-chip"
                                onClick={() => {
                                    setAll(false);
                                    setCollapsedPhases(allPhasesCollapsed ? {} : Object.fromEntries(phases.map((p) => [p.id, true])));
                                }}
                            >
                                {allPhasesCollapsed ? "Open phases" : "Collapse all"}
                            </button>
                        </div>
                    </div>

                    <div className="tl-cats" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, borderTop: "1px solid var(--cm-hair)", paddingTop: 12 }}>
                        {CATEGORY_KEYS.map((key) => (
                            <button
                                key={key}
                                type="button"
                                className="cm-chip"
                                aria-pressed={!hiddenCats[key]}
                                onClick={() => setHiddenCats((h) => ({ ...h, [key]: !h[key] }))}
                            >
                                {CATEGORIES[key].label}
                                <span style={{ opacity: 0.7 }}>{categoryCounts[key]}</span>
                            </button>
                        ))}
                        {filtersActive && (
                            <button
                                type="button"
                                className="cm-chip"
                                style={{ marginLeft: "auto" }}
                                onClick={() => {
                                    setMilestonesOnly(false);
                                    setHiddenCats({});
                                }}
                            >
                                Reset filters
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="tl-phases" style={{ display: "grid", gap: 56 }}>
                {phases.map((phase, pi) => {
                    const collapsed = !!collapsedPhases[phase.id];
                    const events = visibleByPhase[phase.id];
                    const done = phase.events.filter((e) => statuses[e.id] === "done").length;
                    const pct = Math.round(progressBetween(phase.start, phase.end, nowMs) * 100);

                    return (
                        <section key={phase.id} id={phase.id} className="tl-phase" style={{ scrollMarginTop: 96 }}>
                            <div className="cm-panel tick" data-rx="" data-rx-inh="">
                                <button
                                    type="button"
                                    className="cm-hbar"
                                    style={{ width: "100%", cursor: "pointer", textAlign: "left" }}
                                    onClick={() => setCollapsedPhases((c) => ({ ...c, [phase.id]: !c[phase.id] }))}
                                    aria-expanded={!collapsed}
                                    aria-controls={`${phase.id}-events`}
                                >
                                    <span className={pct > 0 && pct < 100 ? "live" : ""}>
                                        {String(pi + 1).padStart(2, "0")} / {phase.range}
                                    </span>
                                    <span>{collapsed ? "Show" : "Hide"}</span>
                                </button>
                                <div className="cm-body-pad" style={{ display: "grid", gap: 12 }}>
                                    <h3 className="cm-h2" style={{ margin: 0 }}>{phase.title}</h3>
                                    <p className="cm-body" style={{ margin: 0, maxWidth: "70ch" }}>{phase.description}</p>
                                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 16px" }}>
                                        <span className="cm-coord">
                                            {phase.events.length} milestones · {done} done
                                        </span>
                                        <div style={{ display: "flex", flex: 1, minWidth: 160, alignItems: "center", gap: 10 }}>
                                            <div style={{ flex: 1 }}>
                                                <Meter value={pct} label={`${phase.title} progress`} />
                                            </div>
                                            <span className="cm-coord" style={{ minWidth: 80, textAlign: "right" }}>
                                                {pct >= 100 ? "Complete" : pct > 0 ? `${pct}% through` : "Not started"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Collapse open={!collapsed} className="" id={`${phase.id}-events`}>
                                <div style={{ paddingTop: 24 }}>
                                    {!seenPhases[phase.id] ? null : events.length === 0 ? (
                                        <p className="cm-body" style={{ border: "1px dashed var(--cm-hair-hi)", padding: 20, textAlign: "center", margin: 0 }}>
                                            Nothing in this phase matches the current filters.
                                        </p>
                                    ) : (
                                        <ol className="cm-rail" style={{ margin: 0 }}>
                                            {events.map((event) => (
                                                <EventRow
                                                    key={event.id}
                                                    event={event}
                                                    status={statuses[event.id]}
                                                    open={!!open[event.id]}
                                                    onToggle={toggleEvent}
                                                />
                                            ))}
                                        </ol>
                                    )}
                                </div>
                            </Collapse>
                        </section>
                    );
                })}
            </div>
        </div>
    );
}
