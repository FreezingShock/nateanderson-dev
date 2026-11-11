"use client";

import { PixelIcon, px } from "@/components/cm/pixel-icons";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import dynamic from "next/dynamic";
import { FlagRound } from "@/components/games/flag-round";
import { GameSummary } from "@/components/games/game-summary";
import {
    Burst,
    KeyLegend,
    focusGameInput,
    useGameKeys,
    CountryCombobox,
    COLOR,
    EMPTY_STATS,
    FilterPanel,
    GuessRow,
    StatsPanel,
    load,
    makeGuess,
    save,
    type AllStats,
    type Guess,
    type Mode,
    type Status,
    type Unit,
} from "@/components/games/guess-kit";
import { GLASS_CLASS } from "@/components/games/guess-kit";
import { cn } from "@/lib/utils";
import { sfx } from "@/lib/sound/sounds";
import neighborData from "@/lib/data/neighbors.json";
import {
    ARROW_EMOJI,
    EMPTY_NEIGHBOR_STATE,
    MAX_GUESSES,
    MAX_HINTS,
    dailyCountry,
    dailyNumber,
    dayNumber,
    direction8,
    flagSrc,
    flagStatus,
    makeFlagOptions,
    pctSquares,
    poolFor,
    scoreGame,
    secondsToNextDaily,
    seededShuffle,
    todayPT,
    type Country,
    type FlagState,
    type GameResults,
    type NeighborState,
} from "@/lib/outline-game";

const GlobeHint = px("globe");
const BulbHint = px("bulb");
const FlagHint = px("flag");

// A Worldle-style country outline guesser. Outlines are built from Natural
// Earth data (scripts/build-outlines.mjs), 238 countries and territories.
// Distance and direction are measured between each country's main landmass
// centre; closeness is 100 - distance / 20,000 km, as a percent.

// Round 2 (map, d3-geo and the world TopoJSON) loads only when it is opened.
const NeighborRound = dynamic(
    () =>
        import("@/components/games/neighbor-round").then(
            (m) => m.NeighborRound
        ),
    {
        ssr: false,
        loading: () => (
            <p className="py-16 text-center text-muted-foreground">
                Loading the map...
            </p>
        ),
    }
);
const NEIGHBORS = neighborData as Record<string, string[]>;

const K = {
    stats: "outline-stats-v1",
    daily: "outline-daily-v2",
    unit: "outline-unit",
    mode: "outline-mode",
    filters: "outline-filters",
};

export function OutlineGuesser() {
    const [countries, setCountries] = useState<Country[] | null>(null);
    const [mode, setMode] = useState<Mode>("unlimited");
    const [answer, setAnswer] = useState<Country | null>(null);
    const [guesses, setGuesses] = useState<Guess[]>([]);
    const [status, setStatus] = useState<Status>("playing");
    const [hints, setHints] = useState(0);
    const [gaveUp, setGaveUp] = useState(false);
    const [confirmGiveUp, setConfirmGiveUp] = useState(false);
    const [freshIndex, setFreshIndex] = useState(-1);
    const [round, setRound] = useState(0);
    const [unit, setUnit] = useState<Unit>("km");
    const [stats, setStats] = useState<AllStats>({
        daily: EMPTY_STATS(),
        unlimited: EMPTY_STATS(),
    });
    const [showStats, setShowStats] = useState(false);
    const [copied, setCopied] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [stage, setStage] = useState<1 | 2 | 3 | 4>(1);
    const [flag, setFlag] = useState<FlagState | null>(null);
    const [confirmRestart, setConfirmRestart] = useState(false);
    const [nb, setNb] = useState<NeighborState>(EMPTY_NEIGHBOR_STATE);
    // Unlimited-mode filters; an empty list means "all".
    const [difficulties, setDifficulties] = useState<number[]>([]);
    const [regions, setRegions] = useState<string[]>([]);

    const deck = useRef<Country[]>([]);
    const dailyDate = useRef("");
    const rootRef = useRef<HTMLDivElement>(null);
    useGameKeys(rootRef);
    // A new puzzle puts the cursor in the country box.
    useEffect(() => {
        if (round > 0) focusGameInput(rootRef.current);
    }, [round]);

    const byCode = useMemo(
        () => new Map((countries ?? []).map((c) => [c.c, c])),
        [countries]
    );

    // Land neighbours of the current answer (empty for island countries).
    const nbCodes = useMemo(
        () => (answer ? (NEIGHBORS[answer.c] ?? []) : []),
        [answer]
    );

    // ---- Loading ----
    useEffect(() => {
        let cancelled = false;
        import("@/lib/data/outlines.json").then((m) => {
            if (!cancelled) setCountries(m.default as Country[]);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const startUnlimited = useCallback(
        (pool: Country[], previous?: string) => {
            if (deck.current.length === 0) {
                deck.current = seededShuffle(pool, Math.random() * 1e9);
            }
            let next = deck.current.pop()!;
            if (next.c === previous && deck.current.length) {
                next = deck.current.pop()!;
            }
            setAnswer(next);
            setGuesses([]);
            setStatus("playing");
            setHints(0);
            setGaveUp(false);
            setStage(1);
            setNb(EMPTY_NEIGHBOR_STATE);
            setFlag(null);
            setConfirmGiveUp(false);
            setFreshIndex(-1);
            setRound((r) => r + 1);
        },
        []
    );

    const startDaily = useCallback((list: Country[]) => {
        const date = todayPT();
        dailyDate.current = date;
        const target = dailyCountry(list, date);
        const saved = load<{
            date: string;
            answer: string;
            guesses: Guess[];
            status: Status;
            hints: number;
            gaveUp: boolean;
            nb?: NeighborState;
            flag?: FlagState | null;
        } | null>(K.daily, null);
        setAnswer(target);
        setStage(1);
        setConfirmGiveUp(false);
        setFreshIndex(-1);
        setRound((r) => r + 1);
        if (saved && saved.date === date && saved.answer === target.c) {
            setGuesses(saved.guesses);
            setStatus(saved.status);
            setHints(saved.hints);
            setGaveUp(saved.gaveUp);
            setNb(saved.nb ?? EMPTY_NEIGHBOR_STATE);
            setFlag(saved.flag ?? null);
        } else {
            setNb(EMPTY_NEIGHBOR_STATE);
            setFlag(null);
            setGuesses([]);
            setStatus("playing");
            setHints(0);
            setGaveUp(false);
        }
    }, []);

    // First load: unit, stats, and which mode to open (?mode=daily wins).
    useEffect(() => {
        if (!countries) return;
        setUnit(load<Unit>(K.unit, "km"));
        const saved = load<Partial<AllStats>>(K.stats, {});
        setStats({
            daily: { ...EMPTY_STATS(), ...saved.daily },
            unlimited: { ...EMPTY_STATS(), ...saved.unlimited },
        });
        const fromUrl = new URLSearchParams(window.location.search).get("mode");
        const initial: Mode =
            fromUrl === "daily" || fromUrl === "unlimited"
                ? fromUrl
                : load<Mode>(K.mode, "unlimited");
        const f = load<{ d: number[]; r: string[] }>(K.filters, {
            d: [],
            r: [],
        });
        setDifficulties(f.d);
        setRegions(f.r);
        setMode(initial);
        if (initial === "daily") startDaily(countries);
        else startUnlimited(poolFor(countries, f.d, f.r));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [countries]);

    const switchMode = (next: Mode) => {
        if (!countries || next === mode) return;
        setMode(next);
        save(K.mode, next);
        if (next === "daily") startDaily(countries);
        else startUnlimited(poolFor(countries, difficulties, regions), answer?.c);
    };

    const pool = useMemo(
        () => (countries ? poolFor(countries, difficulties, regions) : []),
        [countries, difficulties, regions]
    );

    // Changing a filter starts a fresh round from the new pool.
    const applyFilters = (d: number[], r: string[]) => {
        if (!countries) return;
        setDifficulties(d);
        setRegions(r);
        save(K.filters, { d, r });
        deck.current = [];
        const next = poolFor(countries, d, r);
        if (next.length > 0) startUnlimited(next, answer?.c);
    };

    // Persist the daily puzzle as it changes.
    useEffect(() => {
        if (mode !== "daily" || !answer || !dailyDate.current) return;
        save(K.daily, {
            date: dailyDate.current,
            answer: answer.c,
            guesses,
            status,
            hints,
            gaveUp,
            nb,
            flag,
        });
    }, [mode, answer, guesses, status, hints, gaveUp, nb, flag]);

    // Countdown to the next daily.
    useEffect(() => {
        if (mode !== "daily" || status === "playing") return;
        const tick = () => setCountdown(secondsToNextDaily());
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [mode, status]);

    // ---- Finishing a game ----
    const finish = useCallback(
        (result: "won" | "lost", used: number) => {
            setStatus(result);
            setStats((prev) => {
                const today = todayPT();
                // A replayed daily doesn't count twice.
                if (mode === "daily" && prev.daily.last === today) return prev;
                const s = { ...prev[mode], dist: [...prev[mode].dist] };
                s.played += 1;
                if (result === "won") {
                    s.won += 1;
                    s.dist[used - 1] += 1;
                    const continues =
                        mode === "unlimited" ||
                        (s.last !== "" &&
                            dayNumber(today) - dayNumber(s.last) === 1);
                    s.streak = continues ? s.streak + 1 : 1;
                    s.best = Math.max(s.best, s.streak);
                } else {
                    s.streak = 0;
                }
                if (mode === "daily") s.last = today;
                const next = { ...prev, [mode]: s };
                save(K.stats, next);
                return next;
            });
        },
        [mode]
    );

    // ---- Input ----
    const guessedCodes = useMemo(
        () => new Set(guesses.map((g) => g.code)),
        [guesses]
    );

    const onPick = useCallback(
        (target: Country) => {
            if (!answer || status !== "playing") return;
            const g = makeGuess(target, answer);
            sfx(g.pct === 100 ? "granted" : "deny");
            const next = [...guesses, g];
            setGuesses(next);
            setFreshIndex(next.length - 1);
            if (g.pct === 100) finish("won", next.length);
            else if (next.length >= MAX_GUESSES) finish("lost", next.length);
        },
        [answer, status, guesses, finish]
    );

    const giveUp = () => {
        if (!confirmGiveUp) {
            setConfirmGiveUp(true);
            setTimeout(() => setConfirmGiveUp(false), 3000);
            return;
        }
        setGaveUp(true);
        setConfirmGiveUp(false);
        finish("lost", guesses.length);
    };

    // ---- Results of all three rounds (for the summary and share text) ----
    const game = useMemo(() => {
        const found = nb.guesses.filter((g) => nbCodes.includes(g)).length;
        const r3Status = flagStatus(flag, answer?.c ?? "");
        const results: GameResults = {
            r1: { status, guesses: guesses.length, hints },
            r2:
                nbCodes.length > 0
                    ? {
                          total: nbCodes.length,
                          found,
                          played: nb.guesses.length > 0,
                      }
                    : null,
            r3: {
                status: r3Status,
                picks: flag?.picks.length ?? 0,
                played: !!flag && flag.picks.length > 0,
            },
        };
        return { results, score: scoreGame(results) };
    }, [status, guesses.length, hints, nb, nbCodes, flag, answer]);

    const share = async () => {
        if (!answer) return;
        const head =
            mode === "daily"
                ? `Outline Guesser #${dailyNumber(dailyDate.current)}`
                : "Outline Guesser";
        const r1Score =
            status === "won" ? `${guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
        const rows = guesses.map((g) =>
            g.pct === 100
                ? "🟩🟩🟩🟩🟩 🎉"
                : `${pctSquares(g.pct)} ${ARROW_EMOJI[direction8(g.bearing)]}`
        );
        const lines = [
            `${head} ${game.score.pct}% ${game.score.rating}`,
            `🌍 Country ${r1Score}${hints ? ` (${hints} hint${hints > 1 ? "s" : ""})` : ""}`,
            ...rows,
        ];
        if (nbCodes.length > 0) {
            lines.push(
                game.results.r2?.played
                    ? `🗺️ Neighbours ${game.results.r2.found}/${nbCodes.length} ${nb.guesses
                          .map((g) => (nbCodes.includes(g) ? "🟩" : "🟥"))
                          .join("")}`
                    : "🗺️ Neighbours skipped"
            );
        }
        lines.push(
            game.results.r3.played
                ? `🏳️ Flag ${
                      game.results.r3.status === "won"
                          ? `${game.results.r3.picks}/3`
                          : "X/3"
                  }`
                : "🏳️ Flag skipped"
        );
        lines.push(`${window.location.origin}/creations/games/outline-guesser`);
        const text = lines.join("\n");
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {}
    };

    const changeUnit = () => {
        const next: Unit = unit === "km" ? "mi" : "km";
        setUnit(next);
        save(K.unit, next);
    };

    // ---- Derived ----
    const playing = status === "playing";
    const hintList = answer
        ? [
              { icon: GlobeHint, text: `Continent: ${answer.k}` },
              {
                  icon: BulbHint,
                  text: `Starts with "${answer.n[0]}", ${answer.n.replace(/[^\p{L}]/gu, "").length} letters`,
              },
              { icon: FlagHint, text: "flag" },
          ].slice(0, hints)
        : [];
    const shapeFill =
        status === "won"
            ? "var(--cm-good)"
            : status === "lost"
              ? "var(--cm-alert)"
              : "#ffffff";
    const s = stats[mode];
    const fmtCountdown = (n: number) =>
        [Math.floor(n / 3600), Math.floor((n % 3600) / 60), n % 60]
            .map((x) => String(x).padStart(2, "0"))
            .join(":");

    if (!countries || !answer) {
        return (
            <p className="py-24 text-center text-muted-foreground">
                Loading the world map...
            </p>
        );
    }

    const pill = (on: boolean) =>
        cn(
            "rounded-[2px] border px-3 py-1 font-mono text-xs font-semibold transition-colors",
            on
                ? "border-[var(--cm-cyan)] bg-[var(--cm-cyan)]/15 text-[var(--cm-cyan)]"
                : "border-border text-muted-foreground hover:text-foreground"
        );

    // ---- Moving between rounds ----
    const openRound = (n: 1 | 2 | 3 | 4) => {
        if (n === 3 && !flag && answer && countries) {
            const seed =
                mode === "daily"
                    ? dayNumber(dailyDate.current) * 7919
                    : Math.floor(Math.random() * 1e9);
            setFlag({
                options: makeFlagOptions(countries, answer, seed),
                picks: [],
            });
        }
        setStage(n);
    };

    const restartGame = () => {
        if (!countries) return;
        const inProgress =
            status === "playing"
                ? guesses.length > 0
                : (stage === 2 &&
                      nb.status === "playing" &&
                      nb.guesses.length > 0) ||
                  (stage === 3 &&
                      !!flag &&
                      flagStatus(flag, answer.c) === "playing" &&
                      flag.picks.length > 0);
        if (inProgress && !confirmRestart) {
            setConfirmRestart(true);
            setTimeout(() => setConfirmRestart(false), 3000);
            return;
        }
        setConfirmRestart(false);
        if (mode === "daily") {
            try {
                localStorage.removeItem(K.daily);
            } catch {}
            startDaily(countries);
        } else if (pool.length > 0) {
            startUnlimited(pool, answer.c);
        }
    };

    const bigButton = (
        label: string,
        onClick: () => void,
        color: string
    ) => (
        <button
            type="button"
            data-primary
            autoFocus
            onClick={onClick}
            className="inline-flex items-center gap-2 rounded-[2px] border px-5 py-2.5 font-sans text-sm font-bold transition-transform hover:-translate-y-0.5"
            style={{
                color,
                borderColor: `color-mix(in oklch, ${color} 60%, transparent)`,
                backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)`,
            }}
        >
            {label}
            <PixelIcon name="arrowR" className="size-4" />
        </button>
    );
    const skipToSummary = (
        <button
            type="button"
            onClick={() => openRound(4)}
            className="font-mono text-xs uppercase tracking-wider text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
            Skip to summary
        </button>
    );
    // What follows round 1: neighbours, or straight to the flag on an island.
    const nav1 = (
        <div className="mt-4 flex flex-col items-center gap-2.5">
            {nbCodes.length > 0
                ? bigButton(
                      nb.guesses.length === 0
                          ? "Play next round"
                          : nb.status === "playing"
                            ? "Continue neighbours round"
                            : "Neighbours round",
                      () => openRound(2),
                      "var(--cm-amber)"
                  )
                : bigButton(
                      "Play next round: flag",
                      () => openRound(3),
                      "var(--cm-good)"
                  )}
            {skipToSummary}
        </div>
    );
    const nav2 = (
        <div className="mt-4 flex flex-col items-center gap-2.5">
            {bigButton("Play next round: flag", () => openRound(3), "var(--cm-good)")}
            {skipToSummary}
        </div>
    );
    const nav3 = (
        <div className="mt-4 flex flex-col items-center gap-2.5">
            {bigButton("See summary", () => openRound(4), "var(--cm-cyan)")}
        </div>
    );

    const actions = (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
                type="button"
                onClick={share}
                className="inline-flex items-center gap-2 rounded-[2px] border px-4 py-2 font-sans text-sm font-bold transition-transform hover:-translate-y-0.5"
                style={{
                    color: COLOR,
                    borderColor: `color-mix(in oklch, ${COLOR} 55%, transparent)`,
                    backgroundColor: `color-mix(in oklch, ${COLOR} 12%, transparent)`,
                }}
            >
                {copied ? <PixelIcon name="check" className="size-4" /> : <PixelIcon name="share" className="size-4" />}
                {copied ? "Copied!" : "Share"}
            </button>
            {mode === "unlimited" ? (
                <button
                    type="button"
                    data-primary
                    autoFocus
                    onClick={() => startUnlimited(pool, answer.c)}
                    className="inline-flex items-center gap-2 rounded-[2px] border px-4 py-2 font-sans text-sm font-bold transition-transform hover:-translate-y-0.5"
                    style={{
                        color: "var(--cm-good)",
                        borderColor: "color-mix(in oklch, var(--cm-good) 55%, transparent)",
                        backgroundColor: "color-mix(in oklch, var(--cm-good) 12%, transparent)",
                    }}
                >
                    <PixelIcon name="reset" className="size-4" /> Next country
                </button>
            ) : (
                <>
                    <span className="font-mono text-sm tabular-nums text-muted-foreground">
                        Next daily in {fmtCountdown(countdown)}
                    </span>
                    <button
                        type="button"
                        data-primary
                        autoFocus
                        onClick={() => switchMode("unlimited")}
                        className="inline-flex items-center gap-2 rounded-[2px] border px-4 py-2 font-sans text-sm font-bold"
                    >
                        <PixelIcon name="shuffle" className="size-4" /> Play unlimited
                    </button>
                </>
            )}
        </div>
    );

    return (
        <div
            ref={rootRef}
            className={GLASS_CLASS}
        >
            {/* Mode + tools */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1.5" role="group" aria-label="Mode">
                    <button
                        type="button"
                        aria-pressed={mode === "daily"}
                        onClick={() => switchMode("daily")}
                        className={pill(mode === "daily")}
                    >
                        Daily
                    </button>
                    <button
                        type="button"
                        aria-pressed={mode === "unlimited"}
                        onClick={() => switchMode("unlimited")}
                        className={pill(mode === "unlimited")}
                    >
                        Unlimited
                    </button>
                </div>
                <div className="flex gap-1.5">
                    <button
                        type="button"
                        data-action="restart"
                        onClick={restartGame}
                        className={cn(
                            pill(confirmRestart),
                            "inline-flex items-center gap-1"
                        )}
                        aria-label={
                            mode === "daily"
                                ? "Restart the daily puzzle"
                                : "Restart with a new country"
                        }
                    >
                        <PixelIcon name="reset" className="size-3.5" />
                        {confirmRestart ? "Sure?" : "Restart"}
                    </button>
                    <button
                        type="button"
                        onClick={changeUnit}
                        className={pill(false)}
                        aria-label={`Distance in ${unit}, switch units`}
                    >
                        {unit}
                    </button>
                    <button
                        type="button"
                        aria-pressed={showStats}
                        onClick={() => setShowStats((v) => !v)}
                        className={cn(pill(showStats), "inline-flex items-center gap-1")}
                    >
                        <PixelIcon name="chart" className="size-3.5" /> Stats
                    </button>
                </div>
            </div>

            {mode === "unlimited" && (
                <FilterPanel
                    difficulties={difficulties}
                    regions={regions}
                    poolSize={pool.length}
                    onChange={applyFilters}
                />
            )}

            {showStats && <StatsPanel mode={mode} s={s} />}

            {/* Round stepper: three rounds and a summary. Rounds 2 to 4 open
                once round 1 is over, and any of them can be skipped. */}
            <div className="mb-4 flex flex-wrap items-center justify-center gap-1.5">
                {(
                    [
                        [1, "Country"],
                        [2, "Neighbours"],
                        [3, "Flag"],
                        [4, "Summary"],
                    ] as const
                ).map(([n, label]) => {
                    const locked =
                        n > 1 && (playing || (n === 2 && nbCodes.length === 0));
                    const current = stage === n;
                    const done =
                        n === 1
                            ? !playing
                            : n === 2
                              ? nbCodes.length > 0 && nb.status !== "playing"
                              : n === 3
                                ? flagStatus(flag, answer.c) !== "playing"
                                : false;
                    return (
                        <button
                            key={n}
                            type="button"
                            disabled={locked}
                            aria-current={current ? "step" : undefined}
                            title={
                                n === 2 && nbCodes.length === 0 && !playing
                                    ? "No land neighbours: an island"
                                    : locked
                                      ? "Finish round 1 first"
                                      : undefined
                            }
                            onClick={() => openRound(n)}
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-[2px] border px-2.5 py-1 font-mono text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                                current
                                    ? "border-[var(--cm-cyan)] bg-[var(--cm-cyan)]/15 text-[var(--cm-cyan)]"
                                    : "border-border text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <span className="font-mono text-[11px]">
                                {done ? <PixelIcon name="check" className="size-3" /> : n === 4 ? "★" : n}
                            </span>
                            {label}
                        </button>
                    );
                })}
            </div>

            {stage === 2 && answer && nbCodes.length > 0 && (
                <div className="og-hint">
                    <NeighborRound
                        key={`${answer.c}-${round}`}
                        answer={answer}
                        countries={countries}
                        neighborCodes={nbCodes}
                        initial={nb}
                        onChange={setNb}
                        footer={nav2}
                    />
                </div>
            )}

            {stage === 3 && flag && (
                <div className="og-hint">
                    <FlagRound
                        key={`${answer.c}-${round}`}
                        answer={answer}
                        countries={countries}
                        state={flag}
                        onChange={setFlag}
                        footer={nav3}
                    />
                </div>
            )}

            {stage === 4 && (
                <div className="og-hint">
                    <GameSummary
                        key={`${answer.c}-${round}`}
                        answer={answer}
                        results={game.results}
                        score={game.score}
                        heading={
                            mode === "daily"
                                ? `Daily #${dailyNumber(dailyDate.current)}`
                                : "Unlimited"
                        }
                        goto={(n) => openRound(n)}
                        footer={actions}
                    />
                </div>
            )}

            {stage === 1 && (
                <div className="og-hint">
            {/* The outline */}
            <div
                key={`${answer.c}-${round}`}
                className={cn(
                    "relative mx-auto grid aspect-square w-full max-w-[22rem] place-items-center overflow-hidden rounded-[2px] border border-border/60 bg-slate-950 p-6",
                    status === "won" && "og-win"
                )}
                style={{
                    backgroundImage:
                        "linear-gradient(color-mix(in oklch, var(--cm-cyan) 7%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklch, var(--cm-cyan) 7%, transparent) 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                }}
            >
                <svg
                    viewBox="0 0 100 100"
                    role="img"
                    aria-label={
                        playing
                            ? "Outline of the mystery country"
                            : `Outline of ${answer.n}`
                    }
                    className="og-shape size-full"
                    style={{
                        filter: `drop-shadow(0 0 ${status === "won" ? 10 : 6}px color-mix(in oklch, ${shapeFill} 55%, transparent))`,
                    }}
                >
                    <path
                        d={answer.d}
                        fill={shapeFill}
                        fillRule="evenodd"
                        stroke={shapeFill}
                        strokeWidth={0.6}
                        strokeLinejoin="round"
                        style={{ transition: "fill 0.6s, stroke 0.6s" }}
                    />
                </svg>
                {status === "won" && <Burst />}
                {!playing && (
                    <div className="og-hint absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8 text-center">
                        <p className="font-sans text-lg font-bold text-white">
                            {answer.n}
                        </p>
                    </div>
                )}
            </div>

            {/* Hints */}
            {hintList.length > 0 && (
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {hintList.map((h, i) => {
                        const Icon = h.icon;
                        return (
                            <span
                                key={i}
                                className="og-hint inline-flex items-center gap-1.5 rounded-[2px] border px-3 py-1 text-xs font-semibold"
                                style={{
                                    color: "var(--cm-amber)",
                                    borderColor: "color-mix(in oklch, var(--cm-amber) 50%, transparent)",
                                    backgroundColor: "color-mix(in oklch, var(--cm-amber) 10%, transparent)",
                                }}
                            >
                                {h.text === "flag" ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={flagSrc(answer.c)}
                                        alt="Flag hint"
                                        width={28}
                                        height={19}
                                        className="h-4 w-auto rounded-[2px]"
                                    />
                                ) : (
                                    <Icon className="size-3.5" />
                                )}
                                {h.text === "flag" ? "Its flag" : h.text}
                            </span>
                        );
                    })}
                </div>
            )}

            {/* Guess input */}
            {playing ? (
                <div className="mt-4">
                    <CountryCombobox
                        countries={countries}
                        guessed={guessedCodes}
                        onPick={onPick}
                    />
                    <div className="mt-1 flex items-center justify-between gap-2">
                        <button
                            type="button"
                            disabled={hints >= MAX_HINTS}
                            data-action="hint"
                            onClick={() => setHints((h) => Math.min(MAX_HINTS, h + 1))}
                            className="inline-flex items-center gap-1.5 rounded-[2px] border px-3 py-1 font-mono text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                            style={{
                                color: "var(--cm-amber)",
                                borderColor: "color-mix(in oklch, var(--cm-amber) 45%, transparent)",
                            }}
                        >
                            <PixelIcon name="bulb" className="size-3.5" /> Hint ({hints}/{MAX_HINTS})
                        </button>
                        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                            Guess {Math.min(guesses.length + 1, MAX_GUESSES)} / {MAX_GUESSES}
                        </span>
                        <button
                            type="button"
                            data-action="giveup"
                            onClick={giveUp}
                            className="rounded-[2px] border px-3 py-1 font-mono text-xs font-semibold transition-colors"
                            style={{
                                color: "var(--cm-alert)",
                                borderColor: `color-mix(in oklch, var(--cm-alert) ${confirmGiveUp ? 90 : 45}%, transparent)`,
                                backgroundColor: confirmGiveUp
                                    ? "color-mix(in oklch, var(--cm-alert) 14%, transparent)"
                                    : undefined,
                            }}
                        >
                            {confirmGiveUp ? "Really give up?" : "Give up"}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="og-hint mt-4 text-center">
                    <p
                        className="font-sans text-xl font-bold"
                        style={{ color: status === "won" ? "var(--cm-good)" : "var(--cm-alert)" }}
                    >
                        {status === "won"
                            ? guesses.length === 1
                                ? "First try. Unreal."
                                : `Got it in ${guesses.length}!`
                            : gaveUp
                              ? "You gave up."
                              : "Out of guesses."}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        It was <strong className="text-foreground">{answer.n}</strong>.
                    </p>
                    {nav1}
                </div>
            )}

            {/* Guess history: six slots, like Worldle */}
            <div className="mt-5 space-y-1.5" role="list" aria-live="polite">
                {Array.from({ length: MAX_GUESSES }, (_, i) => {
                    const g = guesses[i];
                    const c = g ? byCode.get(g.code) : undefined;
                    if (g && c) {
                        return (
                            <GuessRow
                                key={g.code}
                                guess={g}
                                country={c}
                                unit={unit}
                                fresh={i === freshIndex}
                            />
                        );
                    }
                    return (
                        <div
                            key={`empty-${i}`}
                            role="listitem"
                            className={cn(
                                "flex h-9 items-center justify-center rounded-[2px] border border-dashed font-mono text-[11px] uppercase tracking-wider text-muted-foreground/70",
                                i === guesses.length && playing
                                    ? "border-border bg-foreground/5"
                                    : "border-border/50"
                            )}
                        >
                            {i === guesses.length && playing ? `Guess ${i + 1} / ${MAX_GUESSES}` : ""}
                        </div>
                    );
                })}
            </div>

                </div>
            )}

            <KeyLegend />

            <p className="mt-6 text-center text-xs text-muted-foreground">
                {countries.length} countries and territories. Outlines from Natural
                Earth (public domain). Closeness is 100% minus distance / 20,000 km.
            </p>
        </div>
    );
}
