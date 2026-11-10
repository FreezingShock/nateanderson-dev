"use client";

import { useEffect, useState, type ReactNode } from "react";
import { px, type PixelComponent } from "@/components/cm/pixel-icons";
import {
    MAX_GUESSES,
    flagSrc,
    type Country,
    type GameResults,
    type Score,
} from "@/lib/outline-game";

const Globe2 = px("globe");
const MapIcon = px("map");
const Flag = px("flag");

// The end-of-game summary: the total score and one card per round, with a
// Review button back into each. Rounds you skipped show as skipped (0).

const RATING_COLOR: Record<string, string> = {
    Perfect: "var(--cm-amber)",
    Great: "var(--cm-good)",
    Good: "var(--cm-cyan)",
    "Getting there": "var(--cm-amber)",
    "Keep practicing": "var(--cm-alert)",
};

function CountUp({ to }: { to: number }) {
    const [v, setV] = useState(0);
    useEffect(() => {
        const start = performance.now() + 250;
        let raf = 0;
        const tick = (now: number) => {
            const t = Math.min(1, Math.max(0, (now - start) / 1100));
            setV(Math.round(to * (1 - (1 - t) ** 3)));
            if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [to]);
    return <>{v}</>;
}

function RoundCard({
    icon: Icon,
    title,
    detail,
    points,
    max,
    color,
    muted,
    delay,
    onReview,
}: {
    icon: PixelComponent;
    title: string;
    detail: string;
    points: number;
    max: number;
    color: string;
    muted?: boolean;
    delay: number;
    onReview?: () => void;
}) {
    return (
        <div
            className="og-row flex items-center gap-3 rounded-[2px] border p-3 text-left"
            style={{
                animationDelay: `${delay}s`,
                borderColor: `color-mix(in oklch, ${color} ${muted ? 20 : 45}%, transparent)`,
                backgroundColor: `color-mix(in oklch, ${color} ${muted ? 3 : 8}%, transparent)`,
            }}
        >
            <span
                className="grid size-10 shrink-0 place-items-center rounded-[2px]"
                style={{
                    color,
                    backgroundColor: `color-mix(in oklch, ${color} 16%, transparent)`,
                }}
            >
                <Icon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
                <span
                    className="block font-sans text-sm font-bold"
                    style={{ color }}
                >
                    {title}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                    {detail}
                </span>
            </span>
            <span className="text-right">
                <span
                    className="block font-mono text-lg font-bold tabular-nums"
                    style={{ color }}
                >
                    {points}
                    <span className="text-xs text-muted-foreground">/{max}</span>
                </span>
                {onReview && (
                    <button
                        type="button"
                        onClick={onReview}
                        className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                        Review
                    </button>
                )}
            </span>
        </div>
    );
}

export function GameSummary({
    answer,
    results,
    score,
    heading,
    goto,
    footer,
}: {
    answer: Country;
    results: GameResults;
    score: Score;
    heading: string;
    goto: (stage: 1 | 2 | 3) => void;
    footer: ReactNode;
}) {
    const { r1, r2, r3 } = results;
    const ratingColor = RATING_COLOR[score.rating] ?? "var(--cm-cyan)";

    const r1Detail =
        r1.status === "won"
            ? `Got it in ${r1.guesses}/${MAX_GUESSES}${r1.hints ? `, ${r1.hints} hint${r1.hints > 1 ? "s" : ""}` : ""}`
            : "Not found";
    const r2Detail = !r2
        ? "No land neighbours (island)"
        : !r2.played
          ? "Skipped"
          : `${r2.found}/${r2.total} neighbours found`;
    const r3Detail = !r3.played
        ? "Skipped"
        : r3.status === "won"
          ? `Correct on pick ${r3.picks}/3`
          : "Missed";

    return (
        <div className="text-center">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {heading}
            </p>
            <div className="mt-2 flex items-center justify-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={flagSrc(answer.c)}
                    alt=""
                    width={48}
                    height={36}
                    className="h-7 w-auto rounded-[3px] shadow"
                />
                <h3 className="font-sans text-xl font-bold">{answer.n}</h3>
            </div>

            <div className="mt-5">
                <p
                    className="font-mono text-6xl font-bold tabular-nums"
                    style={{
                        color: ratingColor,
                    }}
                >
                    <CountUp to={score.pct} />
                    <span className="text-3xl">%</span>
                </p>
                <p
                    className="og-hint mt-1 font-sans text-lg font-bold"
                    style={{ color: ratingColor, animationDelay: "1s" }}
                >
                    {score.rating}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                    {score.total} of {score.max} points
                </p>
                <div className="mx-auto mt-3 h-2.5 max-w-xs overflow-hidden rounded-[2px] bg-foreground/10">
                    <div
                        className="h-full rounded-[2px] transition-[width] duration-[1200ms] ease-out"
                        style={{
                            width: `${score.pct}%`,
                            backgroundColor: ratingColor,
                        }}
                    />
                </div>
            </div>

            <div className="mt-6 space-y-2">
                <RoundCard
                    icon={Globe2}
                    title="Round 1: Country"
                    detail={r1Detail}
                    points={score.r1}
                    max={50}
                    color="var(--cm-cyan)"
                    delay={0.1}
                    onReview={() => goto(1)}
                />
                {r2 ? (
                    <RoundCard
                        icon={MapIcon}
                        title="Round 2: Neighbours"
                        detail={r2Detail}
                        points={score.r2}
                        max={30}
                        color="var(--cm-amber)"
                        muted={!r2.played}
                        delay={0.25}
                        onReview={() => goto(2)}
                    />
                ) : (
                    <p className="og-row rounded-[2px] border border-dashed border-border/60 p-2.5 text-xs text-muted-foreground" style={{ animationDelay: "0.25s" }}>
                        Round 2: {r2Detail}. The score is out of {score.max}.
                    </p>
                )}
                <RoundCard
                    icon={Flag}
                    title="Round 3: Flag"
                    detail={r3Detail}
                    points={score.r3}
                    max={20}
                    color="var(--cm-good)"
                    muted={!r3.played}
                    delay={0.4}
                    onReview={() => goto(3)}
                />
            </div>

            {footer}
        </div>
    );
}
