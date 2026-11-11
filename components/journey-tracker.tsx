"use client";

import { PixelIcon } from "@/components/cm/pixel-icons";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Meter } from "@/components/cm/ui";
import { CountUp } from "@/components/cm/reveal";
import { cn } from "@/lib/utils";
import {
    JOURNEY_DAYS,
    JOURNEY_END,
    JOURNEY_START,
    daysUntil,
    dayNum,
    ptClock,
    type EventStatus,
} from "@/lib/timeline-data";

// The interactive journey: a year/month axis for the whole Sept 2026 to May 2031 stretch, hoverable
// milestones with hover tags, and live clock + progress gauges underneath.
//
// Performance notes: the axis is static (one 60s tick moves the "today" marker); the 1-second clock lives
// in its own small component so only it re-renders; the tooltip is a single element (portalled to <body>,
// since a fixed tooltip inside an overflow container would be clipped) mounted only while a marker is
// hovered or pinned.

export interface JourneyMarker {
    id: string;
    title: string;
    when: string;
    start: string;
    description: string;
    tags?: string[];
    color: string;
    categoryLabel: string;
    status: EventStatus;
    special: boolean;
    /** Anchor the tooltip's link jumps to. */
    href: string;
}

export interface JourneyBand {
    id: string;
    short: string;
    color: string;
    start: string;
    end: string;
}

const TZ = "America/Los_Angeles";
const timeFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
});
const dateFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
});
const shortDateFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
});
const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

// Layout (px). The axis is a fixed-height stack: years, phases, the main line
// with its milestones, then month ticks and letters.
const YEAR_TOP = 0;
const YEAR_H = 26;
const BAND_TOP = 32;
const BAND_H = 26;
const AXIS_Y = 92;
const TICK_TOP = 116;
const TRACK_H = 150;

const posNum = (n: number) =>
    ((n - dayNum(JOURNEY_START)) / JOURNEY_DAYS) * 100;
const pos = (date: string) => posNum(dayNum(date));

function useNow(initial: number, ms: number) {
    const [now, setNow] = useState(initial);
    useEffect(() => {
        setNow(Date.now());
        const id = setInterval(() => setNow(Date.now()), ms);
        return () => clearInterval(id);
    }, [ms]);
    return now;
}

/** "in 3 months", "2 days ago", "in 4.6 years": short and human. */
function humanize(days: number) {
    const abs = Math.abs(days);
    let text: string;
    if (abs === 0) return "today";
    if (abs < 14) text = `${abs} day${abs === 1 ? "" : "s"}`;
    else if (abs < 60) text = `${Math.round(abs / 7)} weeks`;
    else if (abs < 700) text = `${Math.round(abs / 30.4)} months`;
    else text = `${(abs / 365.25).toFixed(1)} years`;
    return days > 0 ? `in ${text}` : `${text} ago`;
}

// ---------------------------------------------------------------- tooltip

function Tip({
    marker,
    rect,
    pinned,
    now,
    onEnter,
    onLeave,
    onClose,
}: {
    marker: JourneyMarker;
    rect: DOMRect;
    pinned: boolean;
    now: number;
    onEnter: () => void;
    onLeave: () => void;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
    const width = Math.min(340, window.innerWidth - 16);

    // Measure once rendered, then place above the marker (or below if there isn't room), clamped to the viewport.
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const h = el.offsetHeight;
        let left = rect.left + rect.width / 2 - width / 2;
        left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
        let top = rect.top - h - 14;
        if (top < 8) top = rect.bottom + 14;
        setPlace({ left, top });
    }, [rect, width, marker.id]);

    const days = daysUntil(marker.start, now);
    const statusText = marker.status === "now" ? "Happening now" : marker.status === "done" ? "Completed" : humanize(days);

    return createPortal(
        <div
            ref={ref}
            id="journey-tip"
            role="tooltip"
            onPointerEnter={onEnter}
            onPointerLeave={onLeave}
            className={cn("cm-panel solid cm-enter", marker.special && "live")}
            style={{
                position: "fixed",
                zIndex: 60,
                left: place?.left ?? -9999,
                top: place?.top ?? 0,
                width,
                visibility: place ? "visible" : "hidden",
            }}
        >
            <div className="cm-hbar">
                <span className={marker.status === "now" ? "live" : ""}>{marker.categoryLabel}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {marker.status === "done" && <PixelIcon name="check" className="cm-ico" style={{ width: 11, height: 11 }} />}
                    {statusText}
                </span>
            </div>
            <div className="cm-body-pad" style={{ display: "grid", gap: 8 }}>
                {marker.special && <span className="cm-tag live flat" style={{ justifySelf: "start" }}>Milestone</span>}
                <b style={{ font: "700 19px/1.1 var(--cm-display)" }}>{marker.title}</b>
                <span className="cm-state live">{marker.when}</span>
                <p className="cm-note" style={{ color: "var(--cm-fg)", opacity: 0.85 }}>{marker.description}</p>
                {marker.tags && marker.tags.length > 0 && (
                    <div className="cm-row-gap">
                        {marker.tags.map((tag) => (
                            <span key={tag} className="cm-pill">{tag}</span>
                        ))}
                    </div>
                )}
                <div className="cm-row" style={{ justifyContent: "space-between", borderTop: "1px solid var(--cm-hair)", paddingTop: 10 }}>
                    <a href={marker.href} onClick={onClose} className="cm-more" style={{ border: 0, padding: 0 }}>
                        View on the timeline →
                    </a>
                    {!pinned && <span className="cm-coord">click to pin</span>}
                </div>
            </div>
        </div>,
        document.body
    );
}

// ------------------------------------------------------------------- axis

function Axis({ markers, bands, nowMs }: { markers: JourneyMarker[]; bands: JourneyBand[]; nowMs: number }) {
    const now = useNow(nowMs, 60_000);
    const clock = ptClock(now);
    const nowPct = clock.journeyFrac * 100;
    const scrollRef = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState<{
        marker: JourneyMarker;
        rect: DOMRect;
        pinned: boolean;
    } | null>(null);
    const hideTimer = useRef(0);

    // Calendar years crossing the journey, and every month tick.
    const years = useMemo(() => {
        const out: { year: number; left: number; width: number }[] = [];
        const y0 = Number(JOURNEY_START.slice(0, 4));
        const y1 = Number(JOURNEY_END.slice(0, 4));
        for (let y = y0; y <= y1; y++) {
            const s = Math.max(dayNum(`${y}-01-01`), dayNum(JOURNEY_START));
            const e = Math.min(
                dayNum(`${y}-12-31`) + 1,
                dayNum(JOURNEY_END) + 1
            );
            out.push({
                year: y,
                left: posNum(s),
                width: posNum(e) - posNum(s),
            });
        }
        return out;
    }, []);
    const months = useMemo(() => {
        const out: {
            key: string;
            left: number;
            mid: number;
            letter: string;
            jan: boolean;
            y: number;
            m: number;
        }[] = [];
        let y = Number(JOURNEY_START.slice(0, 4));
        let m = Number(JOURNEY_START.slice(5, 7));
        const endY = Number(JOURNEY_END.slice(0, 4));
        const endM = Number(JOURNEY_END.slice(5, 7));
        while (y < endY || (y === endY && m <= endM)) {
            const start = dayNum(`${y}-${String(m).padStart(2, "0")}-01`);
            const ny = m === 12 ? y + 1 : y;
            const nm = m === 12 ? 1 : m + 1;
            const next = Math.min(
                dayNum(`${ny}-${String(nm).padStart(2, "0")}-01`),
                dayNum(JOURNEY_END) + 1
            );
            out.push({
                key: `${y}-${m}`,
                left: posNum(start),
                mid: (posNum(start) + posNum(next)) / 2,
                letter: MONTHS[m - 1][0],
                jan: m === 1,
                y,
                m,
            });
            y = ny;
            m = nm;
        }
        return out;
    }, []);

    // Start the (mobile) scroller centered on today.
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || el.scrollWidth <= el.clientWidth) return;
        el.scrollLeft = Math.max(
            0,
            (el.scrollWidth * nowPct) / 100 - el.clientWidth / 2
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const clearHide = () => window.clearTimeout(hideTimer.current);
    const scheduleHide = useCallback(() => {
        window.clearTimeout(hideTimer.current);
        hideTimer.current = window.setTimeout(
            () => setActive((a) => (a && !a.pinned ? null : a)),
            140
        );
    }, []);
    const show = (marker: JourneyMarker, el: HTMLElement, pinned: boolean) => {
        clearHide();
        setActive({ marker, rect: el.getBoundingClientRect(), pinned });
    };
    const close = useCallback(() => {
        window.clearTimeout(hideTimer.current);
        setActive(null);
    }, []);

    // Unpin on outside click / Escape; hide when the page or scroller moves
    // (a fixed tooltip would otherwise float away from its marker).
    useEffect(() => {
        if (!active) return;
        const onDown = (e: PointerEvent) => {
            const t = e.target as Element | null;
            if (!t?.closest?.("#journey-tip, [data-journey-marker]")) close();
        };
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
        const scroller = scrollRef.current;
        document.addEventListener("pointerdown", onDown);
        document.addEventListener("keydown", onKey);
        window.addEventListener("scroll", close, { passive: true });
        window.addEventListener("resize", close);
        scroller?.addEventListener("scroll", close, { passive: true });
        return () => {
            document.removeEventListener("pointerdown", onDown);
            document.removeEventListener("keydown", onKey);
            window.removeEventListener("scroll", close);
            window.removeEventListener("resize", close);
            scroller?.removeEventListener("scroll", close);
        };
    }, [active, close]);

    useEffect(() => () => window.clearTimeout(hideTimer.current), []);

    return (
        <>
            <p className="cm-coord sm:hidden" style={{ margin: "0 0 8px" }}>Swipe to explore ↔</p>
            <div ref={scrollRef} style={{ overflowX: "auto", padding: "40px 8px 8px", scrollbarWidth: "thin" }}>
                <div style={{ position: "relative", margin: "0 16px", minWidth: 820, height: TRACK_H }}>
                    {/* year bands */}
                    {years.map((y, i) => (
                        <div
                            key={y.year}
                            className="cm-lbl"
                            style={{
                                position: "absolute",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                left: `${y.left}%`,
                                width: `calc(${y.width}% - 3px)`,
                                top: YEAR_TOP,
                                height: YEAR_H,
                                marginLeft: 1.5,
                                border: `1px solid ${y.year === clock.year ? "var(--cm-cyan)" : "var(--cm-hair)"}`,
                                color: y.year === clock.year ? "var(--cm-cyan)" : "var(--cm-mute)",
                                background: i % 2 ? "rgba(226,238,240,.04)" : "transparent",
                                letterSpacing: ".18em",
                            }}
                        >
                            {y.year}
                            {y.width < 12 && <span className="sr-only"> (partial year)</span>}
                        </div>
                    ))}

                    {/* year boundary guides */}
                    {years.slice(1).map((y) => (
                        <span
                            key={y.year}
                            aria-hidden
                            style={{
                                position: "absolute",
                                width: 1,
                                left: `${y.left}%`,
                                top: YEAR_H + 2,
                                height: TICK_TOP - YEAR_H + 6,
                                background: "repeating-linear-gradient(to bottom, var(--cm-hair-hi) 0 3px, transparent 3px 7px)",
                            }}
                        />
                    ))}

                    {/* phase bands: paper plates with the phase name */}
                    {bands.map((b, i) => (
                        <div
                            key={b.id}
                            className="cm-hbar"
                            title={b.short}
                            style={{
                                position: "absolute",
                                overflow: "hidden",
                                left: `${pos(b.start)}%`,
                                width: `${posNum(dayNum(b.end) + 1) - pos(b.start)}%`,
                                top: BAND_TOP,
                                height: BAND_H,
                                justifyContent: "center",
                                padding: "0 4px",
                                background: i % 2 ? "var(--cm-paper-mute)" : "var(--cm-paper)",
                                color: i % 2 ? "var(--cm-paper)" : "var(--cm-ink-0)",
                                borderLeft: "1px solid var(--cm-void)",
                            }}
                        >
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "inherit" }}>{b.short}</span>
                        </div>
                    ))}

                    {/* the main line, filled up to today */}
                    <div style={{ position: "absolute", left: 0, right: 0, top: AXIS_Y - 2, height: 4 }} className="cm-meter">
                        <i style={{ ["--v" as string]: `${Math.max(nowPct, 0.4)}%`, transition: "none" }} />
                    </div>

                    {/* month ticks */}
                    {months.map((mo) => {
                        const current = mo.y === clock.year && mo.m === clock.month;
                        return (
                            <span key={mo.key}>
                                <span
                                    aria-hidden
                                    style={{
                                        position: "absolute",
                                        width: 1,
                                        left: `${mo.left}%`,
                                        top: TICK_TOP,
                                        height: mo.jan ? 12 : 7,
                                        background: mo.jan ? "var(--cm-fg)" : "var(--cm-hair-hi)",
                                    }}
                                />
                                <span
                                    aria-hidden
                                    className="cm-coord"
                                    style={{
                                        position: "absolute",
                                        transform: "translateX(-50%)",
                                        left: `${mo.mid}%`,
                                        top: TICK_TOP + 16,
                                        color: current ? "var(--cm-cyan)" : "var(--cm-mute)",
                                        fontWeight: current ? 600 : 400,
                                    }}
                                    title={`${MONTHS[mo.m - 1]} ${mo.y}`}
                                >
                                    {mo.letter}
                                </span>
                            </span>
                        );
                    })}

                    {/* today */}
                    <div aria-hidden style={{ position: "absolute", zIndex: 20, pointerEvents: "none", left: `${nowPct}%`, top: -30, height: TICK_TOP + 14 }}>
                        <span
                            className="cm-tag live flat"
                            style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                transform: nowPct < 8 ? "translateX(-12px)" : nowPct > 92 ? "translateX(calc(-100% + 12px))" : "translateX(-50%)",
                            }}
                        >
                            Today <i>{shortDateFmt.format(now)}</i>
                        </span>
                        <span style={{ position: "absolute", left: 0, width: 1, top: 22, bottom: 0, background: "var(--cm-cyan)", transform: "translateX(-0.5px)" }} />
                    </div>

                    {/* milestones */}
                    {markers.map((m) => {
                        const isActive = active?.marker.id === m.id;
                        const size = m.special ? 14 : 10;
                        return (
                            <button
                                key={m.id}
                                type="button"
                                data-journey-marker
                                aria-label={`${m.title}, ${m.when}`}
                                aria-describedby={isActive ? "journey-tip" : undefined}
                                aria-expanded={isActive}
                                className="group"
                                style={{
                                    position: "absolute",
                                    display: "grid",
                                    placeItems: "center",
                                    width: 32,
                                    height: 32,
                                    padding: 0,
                                    border: 0,
                                    background: "transparent",
                                    cursor: "pointer",
                                    transform: "translate(-50%, -50%)",
                                    left: `${pos(m.start)}%`,
                                    top: AXIS_Y,
                                    zIndex: isActive ? 40 : m.special ? 30 : 10,
                                }}
                                onPointerEnter={(e) => {
                                    if (e.pointerType === "mouse") show(m, e.currentTarget, false);
                                }}
                                onPointerLeave={(e) => {
                                    if (e.pointerType === "mouse") scheduleHide();
                                }}
                                onFocus={(e) => show(m, e.currentTarget, false)}
                                onBlur={scheduleHide}
                                onClick={(e) => {
                                    if (isActive && active?.pinned) close();
                                    else show(m, e.currentTarget, true);
                                }}
                            >
                                <span
                                    style={{
                                        display: "block",
                                        width: size,
                                        height: size,
                                        background: m.special || m.status === "now" ? "var(--cm-cyan)" : m.status === "done" ? "var(--cm-paper)" : "var(--cm-void)",
                                        border: `1px solid ${m.special || m.status === "now" ? "var(--cm-cyan)" : "var(--cm-paper)"}`,
                                        outline: isActive ? "2px solid var(--cm-cyan)" : m.special ? "1px solid var(--cm-cyan)" : "none",
                                        outlineOffset: 2,
                                        transition: "transform .15s",
                                    }}
                                />
                            </button>
                        );
                    })}
                </div>
            </div>
            <p className="cm-row cm-coord" style={{ gap: 16, margin: "8px 0 0" }}>
                <span><span style={{ display: "inline-block", width: 8, height: 8, background: "var(--cm-paper)", marginRight: 6 }} />Done</span>
                <span><span style={{ display: "inline-block", width: 8, height: 8, border: "1px solid var(--cm-paper)", marginRight: 6 }} />Upcoming</span>
                <span><span style={{ display: "inline-block", width: 8, height: 8, background: "var(--cm-cyan)", marginRight: 6 }} />Now / milestone</span>
            </p>

            {active && (
                <Tip marker={active.marker} rect={active.rect} pinned={active.pinned} now={now} onEnter={clearHide} onLeave={scheduleHide} onClose={close} />
            )}
        </>
    );
}

// ---------------------------------------------------------------- tickers

function Gauge({ label, value, decimals, sub, tone }: { label: string; value: number; decimals: number; sub: string; tone?: "warn" | "good" }) {
    return (
        <div style={{ display: "grid", gap: 6 }}>
            <div className="cm-row" style={{ justifyContent: "space-between" }}>
                <span className="cm-lbl">{label}</span>
                <span className="cm-num" style={{ fontSize: 12 }}>{(value * 100).toFixed(decimals)}%</span>
            </div>
            <Meter value={value * 100} tone={tone} label={label} />
            <span className="cm-coord">{sub}</span>
        </div>
    );
}

function LiveTickers({ nowMs, total, done }: { nowMs: number; total: number; done: number }) {
    const now = useNow(nowMs, 1000);
    const c = ptClock(now);
    const [timeMain, meridiem] = timeFmt.format(now).split(/\s+/);
    const daysLeftYear = c.daysInYear - c.dayOfYear;
    const daysLeftMonth = c.daysInMonth - c.day;
    const secLeft = Math.round((1 - c.dayFrac) * 86400);
    const hLeft = Math.floor(secLeft / 3600);
    const mLeft = Math.floor((secLeft % 3600) / 60);
    const toLaunch = daysUntil(JOURNEY_END, now);

    return (
        <div className="tl-split">
            <div className="cm-panel tick live">
                <div className="cm-hbar"><span className="live">Right now</span><span>Pacific time</span></div>
                <div className="cm-body-pad" style={{ display: "grid", gap: 10 }}>
                    <p className="cm-num" style={{ margin: 0, fontSize: 44, lineHeight: 1, color: "var(--cm-cyan)" }} suppressHydrationWarning>
                        {timeMain}
                        <span className="cm-lbl" style={{ marginLeft: 8 }}>{meridiem}</span>
                    </p>
                    <p style={{ margin: 0, font: "700 17px/1.2 var(--cm-display)" }} suppressHydrationWarning>{dateFmt.format(now)}</p>
                    <p className="cm-coord" style={{ margin: 0 }}>
                        Day {c.dayOfYear} of {c.daysInYear} · {toLaunch.toLocaleString("en-US")} days to the finish line
                    </p>
                </div>
                <dl className="cm-kv two" style={{ borderTop: "1px solid var(--cm-hair)" }}>
                    <div><dt>Milestones planned</dt><dd><CountUp value={total} /></dd></div>
                    <div><dt>Already done</dt><dd><CountUp value={done} /></dd></div>
                </dl>
            </div>
            <div className="cm-panel">
                <div className="cm-hbar"><span>Progress gauges</span><span>Live</span></div>
                <div className="cm-body-pad" style={{ display: "grid", gap: 18 }}>
                    <Gauge label="Today" value={c.dayFrac} decimals={1} sub={`${hLeft}h ${mLeft}m left today`} />
                    <Gauge label={MONTHS[c.month - 1]} value={c.monthFrac} decimals={2} sub={`${daysLeftMonth} days left in ${MONTHS[c.month - 1]}`} />
                    <Gauge label={String(c.year)} value={c.yearFrac} decimals={2} sub={`${daysLeftYear} days left in ${c.year}`} />
                    <Gauge label="The whole journey" value={c.journeyFrac} decimals={2} sub={`${toLaunch.toLocaleString("en-US")} days until May 31, 2031`} />
                </div>
            </div>
        </div>
    );
}

// ------------------------------------------------------------------ export

export function JourneyTracker({
    markers,
    bands,
    nowMs,
    total,
    done,
}: {
    markers: JourneyMarker[];
    bands: JourneyBand[];
    nowMs: number;
    total: number;
    done: number;
}) {
    return (
        <div>
            <div className="cm-panel tick">
                <div className="cm-hbar"><span>The whole journey</span><span>Sept 2026 → May 2031</span></div>
                <div className="cm-body-pad">
                    <p className="cm-coord" style={{ margin: 0 }}>Hover a marker for details.</p>
                    <Axis markers={markers} bands={bands} nowMs={nowMs} />
                </div>
            </div>
            <LiveTickers nowMs={nowMs} total={total} done={done} />
        </div>
    );
}
