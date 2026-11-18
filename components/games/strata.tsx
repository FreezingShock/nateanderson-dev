"use client";

// Strata: a hidden five-letter word, six tries. Daily (one word for everyone, new at midnight Pacific) and Unlimited
// (random words, open after a daily). Pure rules live in lib/strata; this file is the board, keyboard and results.
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { loadSave, writeSave } from "@/lib/saves/core";
import { GuessModeTabs, MODE_PANEL_ID } from "@/components/games/mode-tabs";
import { useGuessProgress, type Mode, type Status } from "@/components/games/guess-kit";
import { dayNumber, formatCountdown, todayPT } from "@/lib/outline-game";
import {
    MAX_GUESSES,
    STRATA_EPOCH,
    WORD_LENGTH,
    checkGuess,
    dailyAnswer,
    keyStates,
    outcome,
    randomAnswer,
    scoreGuess,
    type Mark,
} from "@/lib/strata/engine";
import { STRATA_SAVE, type Round, type StrataSave } from "@/lib/strata/save";

// The one place the game's name is written. Renaming the game is a change to this constant and the page title.
export const STRATA_NAME = "Strata";

const APP = "strata";
const STATS_KEY = "strata-stats-v1";
const UNLOCK_KEY = "strata-unlimited-unlocked-v1";
const ROWS = Array.from({ length: MAX_GUESSES }, (_, i) => i);
const KEYS = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["enter", "z", "x", "c", "v", "b", "n", "m", "back"],
];

const MARK_WORD: Record<Mark, string> = {
    correct: "correct",
    present: "wrong place",
    absent: "not in word",
};

const dayIndex = (date: string) => dayNumber(date) - dayNumber(STRATA_EPOCH);

function newDaily(date: string): Round {
    return { date, answer: dailyAnswer(dayIndex(date)), rows: [] };
}

function newUnlimited(previous?: string): Round {
    let answer = randomAnswer(Math.random);
    if (answer === previous) answer = randomAnswer(Math.random);
    return { date: "", answer, rows: [] };
}

export function Strata() {
    const [mode, setMode] = useState<Mode>("daily");
    const [daily, setDaily] = useState<Round | null>(null);
    const [unlimited, setUnlimited] = useState<Round | null>(null);
    const [draft, setDraft] = useState("");
    const [msg, setMsg] = useState("");
    const [shake, setShake] = useState(0);
    const [ready, setReady] = useState(false);
    const [today, setToday] = useState(() => todayPT());

    const round = mode === "daily" ? daily : unlimited;
    const status: Status = round ? outcome(round.rows, round.answer) : "playing";

    const { stats, unlocked, justUnlocked, countdown, loadProgress, recordFinish } = useGuessProgress({
        app: APP,
        statsKey: STATS_KEY,
        unlockKey: UNLOCK_KEY,
        mode,
        status,
    });

    // First load: restore the saved rounds, keep today's daily in step with the calendar, and open the saved mode.
    useEffect(() => {
        const isUnlocked = loadProgress();
        const saved = loadSave(window.localStorage, STRATA_SAVE).state;
        const now = todayPT();
        setToday(now);
        const d =
            saved?.daily && saved.daily.date === now && saved.daily.answer === dailyAnswer(dayIndex(now))
                ? saved.daily
                : newDaily(now);
        setDaily(d);
        setUnlimited(saved?.unlimited ?? null);
        setMode(saved?.mode === "unlimited" && isUnlocked ? "unlimited" : "daily");
        setReady(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // A daily left open past midnight rolls over to the new word. The clock is checked every 30 seconds.
    useEffect(() => {
        if (!ready) return;
        const id = window.setInterval(() => setToday(todayPT()), 30_000);
        return () => window.clearInterval(id);
    }, [ready]);
    useEffect(() => {
        if (!ready) return;
        setDaily((cur) => (cur && cur.date === today ? cur : newDaily(today)));
    }, [ready, today]);

    // Persist both rounds and the open mode whenever they change.
    useEffect(() => {
        if (!ready) return;
        const save: StrataSave = { mode, daily, unlimited };
        writeSave(window.localStorage, STRATA_SAVE, save);
    }, [ready, mode, daily, unlimited]);

    const setRound = useCallback(
        (next: Round) => (mode === "daily" ? setDaily(next) : setUnlimited(next)),
        [mode]
    );

    const pickMode = (next: Mode) => {
        if (next === mode || !ready) return;
        if (next === "unlimited" && !unlocked) return;
        setMode(next);
        setDraft("");
        setMsg("");
        if (next === "unlimited" && !unlimited) setUnlimited(newUnlimited());
    };

    const startNext = () => {
        setUnlimited(newUnlimited(unlimited?.answer));
        setDraft("");
        setMsg("");
    };

    // ---- Input ----
    const submit = () => {
        if (!round || status !== "playing") return;
        if (draft.length < WORD_LENGTH) {
            setMsg("Not enough letters.");
            setShake((n) => n + 1);
            return;
        }
        const word = draft.toLowerCase();
        const check = checkGuess(word);
        if (!check.ok) {
            setMsg(check.reason === "unknown" ? "Not in the word list." : "Letters only, five of them.");
            setShake((n) => n + 1);
            return;
        }
        if (round.rows.includes(word)) {
            setMsg("You already tried that word.");
            setShake((n) => n + 1);
            return;
        }
        const rows = [...round.rows, word];
        const next: Round = { ...round, rows };
        setRound(next);
        setDraft("");
        const result = outcome(rows, round.answer);
        if (result === "won") {
            setMsg(`Solved in ${rows.length} of ${MAX_GUESSES}.`);
            recordFinish("won", rows.length);
        } else if (result === "lost") {
            setMsg(`Out of tries. The word was ${round.answer.toUpperCase()}.`);
            recordFinish("lost", rows.length);
        } else {
            setMsg("");
        }
    };

    const type = useCallback(
        (ch: string) => {
            if (!round || status !== "playing") return;
            setDraft((d) => (d.length < WORD_LENGTH ? d + ch : d));
            setMsg("");
        },
        [round, status]
    );

    const erase = useCallback(() => {
        if (!round || status !== "playing") return;
        setDraft((d) => d.slice(0, -1));
        setMsg("");
    }, [round, status]);

    // Physical keyboard: letters, Backspace and Enter, unless a modifier is held or focus is in a text field.
    // A key left focused after a tap must not act twice, so Enter here always submits and cancels that key's click.
    // The New word button keeps its own Enter. Space on an on-screen letter key does nothing (it would type the letter).
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const t = e.target as HTMLElement | null;
            if (t && (t.closest("input, textarea, select, [contenteditable='true']") || t.isContentEditable)) return;
            if (e.key === " " && t instanceof HTMLButtonElement) {
                if (t.classList.contains("st-key")) e.preventDefault();
                return;
            }
            if (e.key === "Enter") {
                if (t instanceof HTMLButtonElement && t.classList.contains("st-next-btn")) return;
                e.preventDefault();
                submit();
            } else if (e.key === "Backspace") {
                e.preventDefault();
                erase();
            } else if (/^[a-zA-Z]$/.test(e.key)) {
                type(e.key.toLowerCase());
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    // ---- Derived ----
    const marks = useMemo(
        () => (round ? round.rows.map((g) => scoreGuess(g, round.answer)) : []),
        [round]
    );
    const letterStates = useMemo(
        () => keyStates(round ? round.rows.map((g, i) => ({ guess: g, marks: marks[i] })) : []),
        [round, marks]
    );
    const dailyNo = dayIndex(today) + 1;
    const dailyMeta = `Puzzle #${dailyNo}`;
    const unlimitedMeta = "Random words";
    const s = stats[mode];
    const latest = round ? round.rows.length - 1 : -1;
    const playing = status === "playing";

    return (
        <div className="st-root" data-status={status}>
            <GuessModeTabs
                mode={mode}
                unlocked={unlocked}
                justUnlocked={justUnlocked}
                dailyMeta={dailyMeta}
                unlimitedMeta={unlimitedMeta}
                onSelect={pickMode}
            />

            <div id={MODE_PANEL_ID} role="tabpanel" aria-labelledby={`gk-tab-${mode}`} className="st-panel">
                <div className="st-head">
                    <p className="st-title">{mode === "daily" ? `Daily puzzle #${dailyNo}` : "Unlimited"}</p>
                    <p className="st-sub">
                        {mode === "daily"
                            ? "One word for everyone. Six tries."
                            : "A random word each round. Six tries."}
                    </p>
                </div>

                <div role="group" aria-label="Guesses" className="st-board">
                    {ROWS.map((r) => {
                        const word = round?.rows[r];
                        const isCurrent = round && r === round.rows.length;
                        // The current row remounts on each refused guess, so the shake plays again.
                        return (
                            <div
                                key={isCurrent ? `cur-${shake}` : r}
                                role="group"
                                aria-label={`Guess ${r + 1}`}
                                className={cn("st-row", isCurrent && shake > 0 && "is-shake")}
                            >
                                {Array.from({ length: WORD_LENGTH }, (_, c) => {
                                    if (word !== undefined) {
                                        const m = marks[r][c];
                                        const ch = word[c];
                                        const label = `${ch.toUpperCase()}, ${MARK_WORD[m]}`;
                                        return (
                                            <span
                                                key={c}
                                                role="img"
                                                aria-label={label}
                                                data-mark={m}
                                                className={cn("st-tile", `is-${m}`, r === latest && "is-flip")}
                                                style={{ "--i": c } as CSSProperties}
                                            >
                                                {m === "absent" ? ch : ch.toUpperCase()}
                                            </span>
                                        );
                                    }
                                    const typed = isCurrent ? draft[c] : undefined;
                                    return (
                                        <span
                                            key={c}
                                            className={cn("st-tile", typed ? "is-typed" : "is-empty")}
                                            aria-hidden={typed ? undefined : "true"}
                                        >
                                            {typed ? typed.toUpperCase() : ""}
                                        </span>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>

                <p role="status" aria-live="polite" className="st-msg">
                    {msg}
                </p>

                {status !== "playing" && round && (
                    <div className="st-result">
                        <p className="st-result-line">
                            {status === "won" ? `Solved in ${round.rows.length} of ${MAX_GUESSES}` : `The word was ${round.answer.toUpperCase()}`}
                        </p>
                        {mode === "daily" ? (
                            <p className="st-next">
                                Next word in <span className="tabular-nums">{formatCountdown(countdown)}</span>
                            </p>
                        ) : (
                            <button type="button" className="st-next-btn" onClick={startNext}>
                                New word
                            </button>
                        )}
                        {/* Reserved for the share action (another branch). Empty on purpose. */}
                        <div className="st-share-slot" data-slot="share" />
                    </div>
                )}

                <div role="group" aria-label="Keyboard" className="st-keys">
                    {KEYS.map((row, ri) => (
                        <div key={ri} className="st-key-row">
                            {row.map((k) => {
                                if (k === "enter" || k === "back") {
                                    const isEnter = k === "enter";
                                    return (
                                        <button
                                            key={k}
                                            type="button"
                                            className="st-key st-key-wide"
                                            disabled={!playing}
                                            onClick={isEnter ? submit : erase}
                                            aria-label={isEnter ? "Enter" : "Delete"}
                                        >
                                            {isEnter ? "Enter" : "Del"}
                                        </button>
                                    );
                                }
                                const state = letterStates[k];
                                return (
                                    <button
                                        key={k}
                                        type="button"
                                        className="st-key"
                                        data-state={state}
                                        disabled={!playing}
                                        onClick={() => type(k)}
                                        aria-label={state ? `${k.toUpperCase()}, ${MARK_WORD[state]}` : k.toUpperCase()}
                                    >
                                        {k.toUpperCase()}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>

                <div className="st-stats" aria-label={`${mode === "daily" ? "Daily" : "Unlimited"} stats`}>
                    {[
                        ["Played", s.played],
                        ["Win %", s.played ? Math.round((s.won / s.played) * 100) : 0],
                        ["Streak", s.streak],
                        ["Best", s.best],
                    ].map(([label, v]) => (
                        <div key={label as string}>
                            <p className="st-stat-n tabular-nums">{v}</p>
                            <p className="st-stat-l">{label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
