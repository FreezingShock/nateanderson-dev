"use client";

import { PixelIcon } from "@/components/cm/pixel-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import flagSchedule from "@/lib/data/daily-flag-schedule.json";
import {
    Burst,
    COLOR,
    CountryCombobox,
    EMPTY_STATS,
    FilterPanel,
    GLASS_CLASS,
    GLASS_STYLE,
    GuessRow,
    KeyLegend,
    StatsPanel,
    focusGameInput,
    useGameKeys,
    load,
    makeGuess,
    save,
    type AllStats,
    type Guess,
    type Mode,
    type Status,
    type Unit,
} from "@/components/games/guess-kit";
import { cn } from "@/lib/utils";
import { sfx } from "@/lib/sound/sounds";
import {
    ARROW_EMOJI,
    MAX_GUESSES,
    MAX_HINTS,
    dailyCountry,
    dailyNumber,
    dayNumber,
    direction8,
    flagSrc,
    pctSquares,
    poolFor,
    secondsToNextDaily,
    seededShuffle,
    todayPT,
    type Country,
} from "@/lib/outline-game";

// A Worldle-style flag guesser. The flag starts hidden behind a 3 x 2 grid of
// tiles; one tile is already turned over and every wrong guess turns over
// another, so the sixth guess sees the whole flag. Each guess also shows the
// distance, direction and closeness to the right country (the same clues as
// the Outline Guesser), and there are three hints. Daily uses its own fixed
// schedule (lib/data/daily-flag-schedule.json); Unlimited has difficulty and
// region filters. All 239 flags are served from /public/flags.

const K = {
    stats: "flag-stats-v1",
    daily: "flag-daily-v1",
    unit: "flag-unit",
    mode: "flag-mode",
    filters: "flag-filters",
};
const COLS = 3;
const TILES = 6;
const SCHEDULE = flagSchedule as string[];

/** Order the six tiles turn over in, fixed for a given puzzle. */
const tileOrder = (seed: number) => seededShuffle([0, 1, 2, 3, 4, 5], seed);
const dailySeed = (date: string, code: string) =>
    dayNumber(date) * 31 + code.charCodeAt(0) * 7 + code.charCodeAt(1);

export function FlagGuesser() {
    const [countries, setCountries] = useState<Country[] | null>(null);
    const [mode, setMode] = useState<Mode>("unlimited");
    const [answer, setAnswer] = useState<Country | null>(null);
    const [guesses, setGuesses] = useState<Guess[]>([]);
    const [status, setStatus] = useState<Status>("playing");
    const [hints, setHints] = useState(0);
    const [gaveUp, setGaveUp] = useState(false);
    const [confirmGiveUp, setConfirmGiveUp] = useState(false);
    const [confirmRestart, setConfirmRestart] = useState(false);
    const [freshIndex, setFreshIndex] = useState(-1);
    const [round, setRound] = useState(0);
    const [order, setOrder] = useState<number[]>([0, 1, 2, 3, 4, 5]);
    const [unit, setUnit] = useState<Unit>("km");
    const [stats, setStats] = useState<AllStats>({
        daily: EMPTY_STATS(),
        unlimited: EMPTY_STATS(),
    });
    const [showStats, setShowStats] = useState(false);
    const [copied, setCopied] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [difficulties, setDifficulties] = useState<number[]>([]);
    const [regions, setRegions] = useState<string[]>([]);
    const [deck, setDeck] = useState<Country[]>([]);
    const dailyDate = useMemo(() => ({ current: "" }), []);
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
    const pool = useMemo(
        () => (countries ? poolFor(countries, difficulties, regions) : []),
        [countries, difficulties, regions]
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
        (from: Country[], previous?: string) => {
            if (from.length === 0) return;
            let d = deck;
            if (d.length === 0) d = seededShuffle(from, Math.random() * 1e9);
            const next = [...d];
            let pick = next.pop()!;
            if (pick.c === previous && next.length) pick = next.pop()!;
            setDeck(next);
            setAnswer(pick);
            setOrder(tileOrder(Math.random() * 1e9));
            setGuesses([]);
            setStatus("playing");
            setHints(0);
            setGaveUp(false);
            setConfirmGiveUp(false);
            setFreshIndex(-1);
            setRound((r) => r + 1);
        },
        [deck]
    );

    const startDaily = useCallback(
        (list: Country[]) => {
            const date = todayPT();
            dailyDate.current = date;
            const target = dailyCountry(list, date, SCHEDULE);
            const saved = load<{
                date: string;
                answer: string;
                guesses: Guess[];
                status: Status;
                hints: number;
                gaveUp: boolean;
            } | null>(K.daily, null);
            setAnswer(target);
            setOrder(tileOrder(dailySeed(date, target.c)));
            setConfirmGiveUp(false);
            setFreshIndex(-1);
            setRound((r) => r + 1);
            if (saved && saved.date === date && saved.answer === target.c) {
                setGuesses(saved.guesses);
                setStatus(saved.status);
                setHints(saved.hints);
                setGaveUp(saved.gaveUp);
            } else {
                setGuesses([]);
                setStatus("playing");
                setHints(0);
                setGaveUp(false);
            }
        },
        [dailyDate]
    );

    // First load: unit, stats, filters, and the mode (?mode=daily wins).
    useEffect(() => {
        if (!countries) return;
        setUnit(load<Unit>(K.unit, "km"));
        const saved = load<Partial<AllStats>>(K.stats, {});
        setStats({
            daily: { ...EMPTY_STATS(), ...saved.daily },
            unlimited: { ...EMPTY_STATS(), ...saved.unlimited },
        });
        const f = load<{ d: number[]; r: string[] }>(K.filters, {
            d: [],
            r: [],
        });
        setDifficulties(f.d);
        setRegions(f.r);
        const fromUrl = new URLSearchParams(window.location.search).get("mode");
        const initial: Mode =
            fromUrl === "daily" || fromUrl === "unlimited"
                ? fromUrl
                : load<Mode>(K.mode, "unlimited");
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
        else startUnlimited(pool, answer?.c);
    };

    const applyFilters = (d: number[], r: string[]) => {
        if (!countries) return;
        setDifficulties(d);
        setRegions(r);
        save(K.filters, { d, r });
        const next = poolFor(countries, d, r);
        if (next.length > 0) {
            setDeck([]);
            startUnlimited(next, answer?.c);
        }
    };

    // Persist the daily as it changes.
    useEffect(() => {
        if (mode !== "daily" || !answer || !dailyDate.current) return;
        save(K.daily, {
            date: dailyDate.current,
            answer: answer.c,
            guesses,
            status,
            hints,
            gaveUp,
        });
    }, [mode, answer, guesses, status, hints, gaveUp, dailyDate]);

    // Countdown to the next daily.
    useEffect(() => {
        if (mode !== "daily" || status === "playing") return;
        const tick = () => setCountdown(secondsToNextDaily());
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [mode, status]);

    // ---- Finishing ----
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

    const guessed = useMemo(
        () => new Set(guesses.map((g) => g.code)),
        [guesses]
    );

    const onPick = (target: Country) => {
        if (!answer || status !== "playing") return;
        const g = makeGuess(target, answer);
        sfx(g.pct === 100 ? "granted" : "deny");
        const next = [...guesses, g];
        setGuesses(next);
        setFreshIndex(next.length - 1);
        if (g.pct === 100) finish("won", next.length);
        else if (next.length >= MAX_GUESSES) finish("lost", next.length);
    };

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

    const restartGame = () => {
        if (!countries) return;
        if (status === "playing" && guesses.length > 0 && !confirmRestart) {
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
        } else {
            startUnlimited(pool, answer?.c);
        }
    };

    const share = async () => {
        if (!answer) return;
        const head =
            mode === "daily"
                ? `Flag Guesser #${dailyNumber(dailyDate.current)}`
                : "Flag Guesser";
        const score =
            status === "won"
                ? `${guesses.length}/${MAX_GUESSES}`
                : `X/${MAX_GUESSES}`;
        const rows = guesses.map((g) =>
            g.pct === 100
                ? "🟩🟩🟩🟩🟩 🎉"
                : `${pctSquares(g.pct)} ${ARROW_EMOJI[direction8(g.bearing)]}`
        );
        const text = [
            `${head} ${score}${hints ? ` (${hints} hint${hints > 1 ? "s" : ""})` : ""}`,
            ...rows,
            `${window.location.origin}/creations/games/flag-guesser`,
        ].join("\n");
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {}
    };

    if (!countries || !answer) {
        return (
            <p className="py-24 text-center text-muted-foreground">
                Loading the flags...
            </p>
        );
    }

    // ---- Derived ----
    const playing = status === "playing";
    const s = stats[mode];
    // One tile is open from the start; each guess turns over another.
    const openCount = playing ? Math.min(TILES, 1 + guesses.length) : TILES;
    const open = new Set(order.slice(0, openCount));
    const justFlipped =
        playing && guesses.length > 0 ? order[openCount - 1] : -1;
    const fmtCountdown = (n: number) =>
        [Math.floor(n / 3600), Math.floor((n % 3600) / 60), n % 60]
            .map((x) => String(x).padStart(2, "0"))
            .join(":");
    const pill = (on: boolean) =>
        cn(
            "rounded-[2px] border px-3 py-1 font-mono text-xs font-semibold transition-colors",
            on
                ? "border-[var(--cm-cyan)] bg-[var(--cm-cyan)]/15 text-[var(--cm-cyan)]"
                : "border-border text-muted-foreground hover:text-foreground"
        );
    const letters = answer.n.replace(/[^\p{L}]/gu, "").length;
    const hintList = [
        { key: "k", text: `Continent: ${answer.k}` },
        { key: "l", text: `Starts with "${answer.n[0]}", ${letters} letters` },
        { key: "o", text: "Its outline" },
    ].slice(0, hints);

    return (
        <div ref={rootRef} className={GLASS_CLASS} style={GLASS_STYLE}>
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
                                : "Restart with a new flag"
                        }
                    >
                        <PixelIcon name="reset" className="size-3.5" />
                        {confirmRestart ? "Sure?" : "Restart"}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const next: Unit = unit === "km" ? "mi" : "km";
                            setUnit(next);
                            save(K.unit, next);
                        }}
                        className={pill(false)}
                        aria-label={`Distance in ${unit}, switch units`}
                    >
                        {unit}
                    </button>
                    <button
                        type="button"
                        aria-pressed={showStats}
                        onClick={() => setShowStats((v) => !v)}
                        className={cn(
                            pill(showStats),
                            "inline-flex items-center gap-1"
                        )}
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

            {/* The flag, behind a 3 x 2 grid of tiles */}
            <div
                key={`${answer.c}-${round}`}
                className={cn(
                    "relative mx-auto w-full max-w-[24rem] overflow-hidden rounded-[2px] border border-border/60 bg-slate-950 p-3",
                    status === "won" && "og-win"
                )}
            >
                <div
                    className="fg-board grid aspect-[4/3] w-full grid-cols-3 grid-rows-2"
                    data-done={!playing}
                    style={{ gap: playing ? 6 : 0 }}
                    role="img"
                    aria-label={
                        playing
                            ? `Mystery flag, ${openCount} of ${TILES} tiles revealed`
                            : `Flag of ${answer.n}`
                    }
                >
                    {Array.from({ length: TILES }, (_, i) => {
                        const isOpen = open.has(i);
                        const rank = order.indexOf(i);
                        return (
                            <div
                                key={i}
                                className={cn(
                                    "fg-tile",
                                    justFlipped === i && "fg-just-flipped"
                                )}
                                data-open={isOpen}
                                style={{
                                    // The final reveal ripples across the board.
                                    transitionDelay: playing
                                        ? "0s"
                                        : `${rank * 0.09}s`,
                                }}
                            >
                                <div className="fg-face fg-cover grid place-items-center">
                                    <PixelIcon name="shapes" className="size-6 text-slate-600" />
                                </div>
                                <div
                                    className="fg-face fg-back"
                                    style={{
                                        backgroundImage: `url(${flagSrc(answer.c)})`,
                                        backgroundSize: `${COLS * 100}% 200%`,
                                        backgroundPosition: `${(i % COLS) * 50}% ${Math.floor(i / COLS) * 100}%`,
                                        backgroundRepeat: "no-repeat",
                                    }}
                                />
                            </div>
                        );
                    })}
                </div>
                {status === "won" && <Burst />}
                {!playing && (
                    <div className="og-hint absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-2 pt-8 text-center">
                        <p className="font-sans text-lg font-bold text-white">
                            {answer.n}
                        </p>
                    </div>
                )}
            </div>
            <p className="mt-2 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {playing ? `${openCount} of ${TILES} tiles revealed` : "Full flag"}
            </p>

            {/* Hints */}
            {hintList.length > 0 && (
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {hintList.map((h) => (
                        <span
                            key={h.key}
                            className="og-hint inline-flex items-center gap-1.5 rounded-[2px] border px-3 py-1 text-xs font-semibold"
                            style={{
                                color: "var(--cm-amber)",
                                borderColor:
                                    "color-mix(in oklch, var(--cm-amber) 50%, transparent)",
                                backgroundColor:
                                    "color-mix(in oklch, var(--cm-amber) 10%, transparent)",
                            }}
                        >
                            {h.key === "o" ? (
                                <svg
                                    viewBox="0 0 100 100"
                                    className="size-7 rounded bg-slate-950 p-0.5"
                                    aria-hidden
                                >
                                    <path d={answer.d} fill="#fff" fillRule="evenodd" />
                                </svg>
                            ) : h.key === "k" ? (
                                <PixelIcon name="globe" className="size-3.5" />
                            ) : (
                                <PixelIcon name="bulb" className="size-3.5" />
                            )}
                            {h.text}
                        </span>
                    ))}
                </div>
            )}

            {/* Guess input, or the result */}
            {playing ? (
                <div className="mt-4">
                    <CountryCombobox
                        countries={countries}
                        guessed={guessed}
                        onPick={onPick}
                        label="Guess the flag's country"
                    />
                    <div className="mt-1 flex items-center justify-between gap-2">
                        <button
                            type="button"
                            disabled={hints >= MAX_HINTS}
                            data-action="hint"
                            onClick={() =>
                                setHints((h) => Math.min(MAX_HINTS, h + 1))
                            }
                            className="inline-flex items-center gap-1.5 rounded-[2px] border px-3 py-1 font-mono text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                            style={{
                                color: "var(--cm-amber)",
                                borderColor:
                                    "color-mix(in oklch, var(--cm-amber) 45%, transparent)",
                            }}
                        >
                            <PixelIcon name="bulb" className="size-3.5" /> Hint ({hints}/
                            {MAX_HINTS})
                        </button>
                        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                            Guess {Math.min(guesses.length + 1, MAX_GUESSES)} /{" "}
                            {MAX_GUESSES}
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
                        style={{
                            color:
                                status === "won"
                                    ? "var(--cm-good)"
                                    : "var(--cm-alert)",
                        }}
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
                        It was{" "}
                        <strong className="text-foreground">{answer.n}</strong>.
                    </p>
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
                            {copied ? (
                                <PixelIcon name="check" className="size-4" />
                            ) : (
                                <PixelIcon name="share" className="size-4" />
                            )}
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
                                    borderColor:
                                        "color-mix(in oklch, var(--cm-good) 55%, transparent)",
                                    backgroundColor:
                                        "color-mix(in oklch, var(--cm-good) 12%, transparent)",
                                }}
                            >
                                <PixelIcon name="reset" className="size-4" /> Next flag
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
                </div>
            )}

            {/* Guess history: six slots */}
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
                            {i === guesses.length && playing
                                ? `Guess ${i + 1} / ${MAX_GUESSES}`
                                : ""}
                        </div>
                    );
                })}
            </div>

            <KeyLegend />

            <p className="mt-6 text-center text-xs text-muted-foreground">
                {countries.length} flags. Flags from the flag-icons project
                (MIT). Closeness is 100% minus distance / 20,000 km.
            </p>
        </div>
    );
}
