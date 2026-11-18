"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PixelIcon } from "@/components/cm/pixel-icons";
import { GLASS_CLASS, useGuessProgress, type Mode, type ModeStats } from "@/components/games/guess-kit";
import { GuessModeTabs, MODE_PANEL_ID } from "@/components/games/mode-tabs";
import {
    MAX_SUBMISSIONS,
    OP_SIGN,
    OP_WORD,
    applyStep,
    clearTape,
    dailyNumber,
    dailyPuzzle,
    generate,
    newRound,
    randomSeed,
    scoreRound,
    solutionLines,
    solve,
    submit,
    tapeOf,
    undo,
    type Op,
    type Outcome,
    type Round,
} from "@/lib/ledger/engine";
import { LEDGER_NAME } from "@/lib/ledger/name";
import { LEDGER_SAVE, emptyLedgerSave, freshDaily, type LedgerSave } from "@/lib/ledger/save";
import { formatCountdown, todayPT } from "@/lib/outline-game";
import { loadSave, writeSave } from "@/lib/saves/core";
import { cn } from "@/lib/utils";

// Ledger on the page: an adding-machine tape. Six numbers and a target. Tap a number, an operator, then a second number,
// and the result prints on the tape as a new tile. Submit a tile as your answer; each one reports how far off it is.
// The engine (lib/ledger/engine.ts) does every rule; this file only draws the tape and carries the input.
//
// Keys: 1 to 6 pick the tile in that position, + - x / pick the operator, Enter submits the picked tile,
// Backspace undoes the last step, Escape clears the pick.

const STORAGE_STATS_KEY = "ledger-stats-v1";
const STORAGE_UNLOCK_KEY = "ledger-unlimited-unlocked-v1";
const OP_FROM_KEY: Record<string, Op> = {
    "+": "+",
    "-": "-",
    "−": "-",
    "*": "*",
    x: "*",
    X: "*",
    "×": "*",
    "/": "/",
    "÷": "/",
};
const OPS_IN_ORDER: Op[] = ["+", "-", "*", "/"];

const local = (): Storage | null => {
    try {
        return typeof window === "undefined" ? null : window.localStorage;
    } catch {
        return null;
    }
};

const samePuzzle = (a: Round["puzzle"], b: Round["puzzle"]) =>
    a.target === b.target && a.numbers.length === b.numbers.length && a.numbers.every((n, i) => n === b.numbers[i]);

export function Ledger() {
    const rootRef = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(false);
    const [save, setSave] = useState<LedgerSave>(emptyLedgerSave);
    const [date, setDate] = useState("");
    const [picked, setPicked] = useState<number | null>(null);
    const [op, setOp] = useState<Op | null>(null);
    const [message, setMessage] = useState("");
    const [confirmRestart, setConfirmRestart] = useState(false);
    const [showStats, setShowStats] = useState(false);

    const mode = save.mode;
    const round: Round | null = mode === "daily" ? (save.daily?.round ?? null) : save.unlimited;
    const playing = !!round && round.status === "playing";

    const {
        stats,
        unlocked,
        justUnlocked,
        countdown,
        loadProgress,
        recordFinish,
    } = useGuessProgress({
        app: "ledger",
        statsKey: STORAGE_STATS_KEY,
        unlockKey: STORAGE_UNLOCK_KEY,
        mode,
        status: round?.status ?? "playing",
    });

    const tape = useMemo(() => (round ? tapeOf(round.puzzle, round.steps) : null), [round]);
    const tapeOk = tape && tape.ok ? tape.tape : null;
    const solution = useMemo(
        () => (round && round.status !== "playing" ? solve(round.puzzle) : null),
        // Keyed on the puzzle and status, so a finished round solves once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [round?.puzzle.target, round?.puzzle.numbers.join(","), round?.status]
    );

    // ---- Storage ----

    const persist = useCallback((next: LedgerSave) => {
        setSave(next);
        writeSave(local(), LEDGER_SAVE, next);
    }, []);

    const commitRound = (next: Round) => {
        if (mode === "daily") {
            if (!date) return;
            persist({ ...save, daily: { date, round: next } });
        } else {
            persist({ ...save, unlimited: next });
        }
    };

    // First load: the saved round for today, or a fresh daily; Unlimited only when it is open on this device.
    useEffect(() => {
        const today = todayPT();
        const stored = loadSave(local(), LEDGER_SAVE).state ?? emptyLedgerSave();
        const unlockedNow = loadProgress();
        const todays = dailyPuzzle(today).puzzle;
        const keepDaily =
            !!stored.daily && stored.daily.date === today && samePuzzle(stored.daily.round.puzzle, todays);
        const startMode: Mode = stored.mode === "unlimited" && unlockedNow ? "unlimited" : "daily";
        const next: LedgerSave = {
            mode: startMode,
            daily: keepDaily ? stored.daily : freshDaily(today, todays),
            unlimited:
                startMode === "unlimited" && !stored.unlimited
                    ? newRound(generate(randomSeed()).puzzle)
                    : stored.unlimited,
        };
        setDate(today);
        persist(next);
        setReady(true);
    }, [loadProgress, persist]);

    // ---- Moves ----

    /** Runs one engine move on the open round. Failed moves only say why. Finishing records the stats once. */
    const act = (run: (r: Round) => Outcome) => {
        if (!round) return;
        const out = run(round);
        setMessage(out.message);
        if (!out.ok) return;
        commitRound(out.round);
        setPicked(null);
        setOp(null);
        if (round.status === "playing" && out.round.status !== "playing") {
            recordFinish(out.round.status, out.round.submissions.length);
        }
    };

    const tileValue = (id: number) => (tapeOk ? tapeOk.values[id] : undefined);

    const tapTile = (id: number) => {
        if (!round || !playing) return;
        if (picked === id) {
            setPicked(null);
            setOp(null);
            setMessage("Tile put back.");
            return;
        }
        if (picked !== null && op !== null) {
            const a = picked;
            act((r) => applyStep(r, { a, op, b: id }));
            return;
        }
        setPicked(id);
        setOp(null);
        setMessage(`${tileValue(id)} picked. Choose an operator, then a second number.`);
    };

    const tapOp = (o: Op) => {
        if (!round || !playing) return;
        if (picked === null) {
            setMessage("Pick a number first, then an operator.");
            return;
        }
        if (op === o) {
            setOp(null);
            setMessage(`${OP_WORD[o]} cleared. ${tileValue(picked)} still picked.`);
            return;
        }
        setOp(o);
        setMessage(`${OP_WORD[o]}. Now pick the second number.`);
    };

    const submitPicked = () => {
        if (!round || !playing) return;
        if (picked === null) {
            setMessage("Pick a number on the tape to submit it.");
            return;
        }
        const id = picked;
        act((r) => submit(r, id));
    };

    const restart = () => {
        if (!round || !date) return;
        const busy = round.status === "playing" && (round.steps.length > 0 || round.submissions.length > 0);
        if (busy && !confirmRestart) {
            setConfirmRestart(true);
            window.setTimeout(() => setConfirmRestart(false), 3000);
            return;
        }
        setConfirmRestart(false);
        if (mode === "daily") {
            commitRound(newRound(dailyPuzzle(date).puzzle));
            setMessage("Restarted. The same six numbers and target.");
        } else {
            commitRound(newRound(generate(randomSeed()).puzzle));
            setMessage("New puzzle.");
        }
        setPicked(null);
        setOp(null);
    };

    const switchMode = (next: Mode) => {
        if (next === mode) return;
        if (next === "unlimited" && !unlocked) return;
        const s: LedgerSave = { ...save, mode: next };
        if (next === "unlimited" && !s.unlimited) s.unlimited = newRound(generate(randomSeed()).puzzle);
        persist(s);
        setPicked(null);
        setOp(null);
        setMessage("");
    };

    // ---- Keys ----
    // The listener calls the latest render's handler (set after every render), so it always sees the current round.
    const onKey = (e: KeyboardEvent) => {
        if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
        const t = e.target as HTMLElement | null;
        if (t?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
        const root = rootRef.current;
        if (!root || !round) return;
        const r = root.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;

        if (/^[1-6]$/.test(e.key)) {
            e.preventDefault();
            if (!playing || !tapeOk) return;
            const id = tapeOk.available[Number(e.key) - 1];
            if (id === undefined) {
                setMessage(`Only ${tapeOk.available.length} numbers are on the tape.`);
                return;
            }
            tapTile(id);
            return;
        }
        const o = OP_FROM_KEY[e.key];
        if (o) {
            e.preventDefault();
            tapOp(o);
            return;
        }
        if (e.key === "Enter") {
            // Enter on a tile or operator submits the pick (it does not tap that button). Other buttons keep their own Enter.
            if (t?.closest?.("button, a, [role='button']") && !t.closest(".ldg-tile, .ldg-op")) return;
            e.preventDefault();
            if (playing) submitPicked();
            else if (mode === "unlimited") restart();
            return;
        }
        if (e.key === "Backspace") {
            e.preventDefault();
            if (playing) act(undo);
            return;
        }
        if (e.key === "Escape" && picked !== null) {
            e.preventDefault();
            setPicked(null);
            setOp(null);
            setMessage("Pick cleared.");
        }
    };
    const latestKey = useRef(onKey);
    useEffect(() => {
        latestKey.current = onKey;
    });
    useEffect(() => {
        const listener = (e: KeyboardEvent) => latestKey.current(e);
        window.addEventListener("keydown", listener);
        return () => window.removeEventListener("keydown", listener);
    }, []);

    // ---- Render ----

    if (!ready || !round || !tapeOk) {
        return (
            <p className="py-24 text-center text-muted-foreground" aria-live="polite">
                {tape && !tape.ok ? "This save could not be read. A new puzzle will start." : "Opening the ledger..."}
            </p>
        );
    }

    const { puzzle } = round;
    const finished = round.status !== "playing";
    const result = finished ? scoreRound(round) : null;
    const dailyNo = date ? dailyNumber(date) : 0;
    const s: ModeStats = stats[mode];
    const lines = solution ? solutionLines(puzzle, solution) : [];
    const dailyDone = save.daily?.round.status !== "playing" && !!save.daily;

    return (
        <div ref={rootRef} className={cn(GLASS_CLASS, "ldg")} role="group" aria-label={LEDGER_NAME}>
            <GuessModeTabs
                mode={mode}
                unlocked={unlocked}
                justUnlocked={justUnlocked}
                dailyMeta={`#${dailyNo} · ${dailyDone ? "done today" : "today"}`}
                unlimitedMeta="New each round"
                onSelect={switchMode}
            />
            <div className="gk-tools">
                {!(mode === "daily" && finished) && (
                    <button
                        type="button"
                        data-action="restart"
                        onClick={restart}
                        className={cn("gk-tool", confirmRestart && "is-on")}
                        aria-label={
                            mode === "daily"
                                ? "Restart today's puzzle"
                                : finished
                                  ? "Next puzzle"
                                  : "Restart with a new puzzle"
                        }
                    >
                        <PixelIcon name="reset" className="size-3.5" />
                        {confirmRestart ? "Sure?" : mode === "unlimited" && finished ? "Next puzzle" : "Restart"}
                    </button>
                )}
                <button
                    type="button"
                    aria-pressed={showStats}
                    onClick={() => setShowStats((v) => !v)}
                    className={cn("gk-tool", showStats && "is-on")}
                >
                    <PixelIcon name="chart" className="size-3.5" /> Stats
                </button>
            </div>

            <div
                key={mode}
                id={MODE_PANEL_ID}
                role="tabpanel"
                aria-labelledby={`gk-tab-${mode}`}
                className="gk-stage"
                data-dir={mode === "unlimited" ? "r" : "l"}
            >
                {showStats && <LedgerStats mode={mode} s={s} />}

                <section className="ldg-target" aria-label={`Target ${puzzle.target}`}>
                    <span className="ldg-kicker">Target</span>
                    <span className="ldg-target-num" aria-hidden="true">
                        {puzzle.target}
                    </span>
                    <span className="ldg-kicker">
                        {mode === "daily" ? `Daily #${dailyNo}` : "Unlimited"} · {MAX_SUBMISSIONS - round.submissions.length} entries left
                    </span>
                </section>

                <ol className="ldg-tape" aria-label="Tape">
                    {tapeOk.lines.length === 0 && playing && (
                        <li className="ldg-tape-empty">
                            The tape is clear. Pick a number, an operator, then a second number.
                        </li>
                    )}
                    {tapeOk.lines.map((line, i) => (
                        <li key={i}>
                            <span className="ldg-line-no" aria-hidden="true">
                                {String(i + 1).padStart(2, "0")}
                            </span>
                            <span className="ldg-line">{line}</span>
                        </li>
                    ))}
                </ol>

                <ul className="ldg-tiles" aria-label="Numbers on the tape">
                    {tapeOk.available.map((id, pos) => {
                        const value = tapeOk.values[id];
                        const given = id < puzzle.numbers.length;
                        const isPicked = picked === id;
                        return (
                            <li key={id}>
                                <button
                                    type="button"
                                    className="ldg-tile"
                                    data-kind={given ? "given" : "step"}
                                    aria-pressed={isPicked}
                                    aria-keyshortcuts={String(pos + 1)}
                                    aria-label={`Number ${value}, ${given ? "given" : `step ${id - puzzle.numbers.length + 1}`}, key ${pos + 1}`}
                                    disabled={!playing}
                                    onClick={() => tapTile(id)}
                                >
                                    <span className="ldg-tile-pos" aria-hidden="true">
                                        {pos + 1}
                                    </span>
                                    <span className="ldg-tile-val" aria-hidden="true">
                                        {value}
                                    </span>
                                    <span className="ldg-tile-kind" aria-hidden="true">
                                        {isPicked ? "picked" : given ? "given" : `step ${id - puzzle.numbers.length + 1}`}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>

                <div className="ldg-ops" role="group" aria-label="Operators">
                    {OPS_IN_ORDER.map((o) => (
                        <button
                            key={o}
                            type="button"
                            className="ldg-op"
                            aria-label={OP_WORD[o]}
                            aria-pressed={op === o}
                            disabled={!playing}
                            onClick={() => tapOp(o)}
                        >
                            <span aria-hidden="true">{OP_SIGN[o]}</span>
                        </button>
                    ))}
                </div>

                <div className="ldg-actions">
                    <button
                        type="button"
                        className="ldg-btn"
                        aria-label="Undo the last step"
                        disabled={!playing || round.steps.length === 0}
                        onClick={() => act(undo)}
                    >
                        Undo
                    </button>
                    <button
                        type="button"
                        className="ldg-btn"
                        aria-label="Clear the tape"
                        disabled={!playing || round.steps.length === 0}
                        onClick={() => act(clearTape)}
                    >
                        Clear
                    </button>
                    <button
                        type="button"
                        className="ldg-btn ldg-btn-submit"
                        aria-label={picked !== null ? `Submit ${tileValue(picked)} as the answer` : "Submit the picked number"}
                        disabled={!playing || picked === null}
                        onClick={submitPicked}
                    >
                        Submit
                    </button>
                </div>

                <p role="status" aria-live="polite" className="ldg-status">
                    {message || (playing ? `Entry ${round.submissions.length + 1} of ${MAX_SUBMISSIONS}.` : "")}
                </p>

                <ol className="ldg-entries" aria-label="Entries">
                    {Array.from({ length: MAX_SUBMISSIONS }, (_, i) => {
                        const sub = round.submissions[i];
                        return (
                            <li key={i} className={cn("ldg-entry", sub && sub.off === 0 && "is-exact")}>
                                <span className="ldg-line-no" aria-hidden="true">
                                    {String(i + 1).padStart(2, "0")}
                                </span>
                                {sub ? (
                                    <>
                                        <span className="ldg-entry-val">{sub.value}</span>
                                        <span className="ldg-entry-off">{sub.off === 0 ? "exact" : `off by ${sub.off}`}</span>
                                    </>
                                ) : (
                                    <span className="ldg-entry-empty">{playing && i === round.submissions.length ? "next entry" : "empty"}</span>
                                )}
                            </li>
                        );
                    })}
                </ol>

                {finished && result && (
                    <section className="ldg-result" aria-label="Result">
                        <p className="ldg-result-head">
                            {result.won ? `Exact in ${result.used}. ${result.points} points.` : "Out of entries."}
                        </p>
                        {!result.won && result.bestOff !== null && (
                            <p className="ldg-result-sub">Best entry was off by {result.bestOff}.</p>
                        )}
                        {mode === "daily" ? (
                            <p className="ldg-result-sub">Next daily in {formatCountdown(countdown)}.</p>
                        ) : null}
                        {lines.length > 0 && (
                            <>
                                <p className="ldg-kicker">One way to make {puzzle.target}</p>
                                <ol className="ldg-solution">
                                    {lines.map((line, i) => (
                                        <li key={i}>{line}</li>
                                    ))}
                                </ol>
                            </>
                        )}
                        {/* Share slot: a shared result card goes here. Left empty on purpose. */}
                        <div id="ledger-share-slot" className="ldg-share-slot" />
                    </section>
                )}

                <p className="ldg-keys">
                    1 to 6 pick · + − × ÷ operator · Enter submit · Backspace undo · Esc clear
                </p>
            </div>
        </div>
    );
}

/** Streak and distribution for Ledger. Its own panel, in the ledger accent, not the guessers' cyan. */
function LedgerStats({ mode, s }: { mode: Mode; s: ModeStats }) {
    const max = Math.max(1, ...s.dist);
    return (
        <div className="cm-panel ldg-stats">
            <p className="ldg-kicker">{mode === "daily" ? "Daily" : "Unlimited"} stats</p>
            <div className="ldg-stats-grid">
                {(
                    [
                        ["Played", s.played],
                        ["Win %", s.played ? Math.round((s.won / s.played) * 100) : 0],
                        ["Streak", s.streak],
                        ["Best", s.best],
                    ] as const
                ).map(([label, v]) => (
                    <div key={label}>
                        <p className="ldg-stat-num">{v}</p>
                        <p className="ldg-stat-label">{label}</p>
                    </div>
                ))}
            </div>
            <div className="ldg-dist">
                {s.dist.map((n, i) => (
                    <div key={i} className="ldg-dist-row">
                        <span className="ldg-dist-no">{i + 1}</span>
                        <div className="ldg-dist-bar">
                            <div style={{ width: `${Math.max(n ? 8 : 0, (n / max) * 100)}%` }}>{n || ""}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

