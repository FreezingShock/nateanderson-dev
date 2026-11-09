"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import {
    FLAG_CHANCES,
    flagSrc,
    flagStatus,
    type Country,
    type FlagState,
} from "@/lib/outline-game";
import { cn } from "@/lib/utils";

// Round 3 of the Outline Guesser: which of six flags belongs to the country?
// Three chances. The six come from all 239 flags (lib/outline-game.ts
// makeFlagOptions); the board itself is fixed by the parent so it survives a
// reload and is identical for everyone on the daily.

const GREEN = "var(--cm-good)";
const RED = "var(--cm-alert)";

export function FlagRound({
    answer,
    countries,
    state,
    onChange,
    footer,
}: {
    answer: Country;
    countries: Country[];
    state: FlagState;
    onChange: (s: FlagState) => void;
    /** Shown once the round is over. */
    footer: ReactNode;
}) {
    const byCode = useMemo(
        () => new Map(countries.map((c) => [c.c, c])),
        [countries]
    );
    const status = flagStatus(state, answer.c);
    const playing = status === "playing";
    const wrongPicks = state.picks.filter((p) => p !== answer.c);
    const chancesLeft = FLAG_CHANCES - wrongPicks.length;
    const gridRef = useRef<HTMLDivElement>(null);
    // Which pick to animate (only the newest one, not a restored board).
    const [fresh, setFresh] = useState<string | null>(null);

    // Keyboard: 1-6 pick a flag, arrows move between them, and the cursor
    // always sits on a flag you can still choose.
    const buttons = () =>
        Array.from(
            gridRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []
        );
    const focusFlag = (from: number, dir: 1 | -1) => {
        const list = buttons();
        for (let n = 1; n <= list.length; n++) {
            const b = list[(from + dir * n + list.length * 2) % list.length];
            if (b && !b.disabled) {
                b.focus({ preventScroll: true });
                return;
            }
        }
    };
    useEffect(() => {
        if (!playing) return;
        const first = buttons().find((b) => !b.disabled);
        first?.focus({ preventScroll: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.picks.length, playing]);
    useEffect(() => {
        if (!playing) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
            const el = gridRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            if (r.bottom < 0 || r.top > window.innerHeight) return;
            const n = Number(e.key);
            if (n >= 1 && n <= state.options.length) {
                const b = buttons()[n - 1];
                if (b && !b.disabled) {
                    e.preventDefault();
                    b.click();
                }
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playing, state.options.length, state.picks.length]);
    const onGridKey = (e: React.KeyboardEvent) => {
        const list = buttons();
        const i = list.indexOf(document.activeElement as HTMLButtonElement);
        if (i < 0) return;
        const cols = 3;
        const move: Record<string, number> = {
            ArrowRight: 1,
            ArrowLeft: -1,
            ArrowDown: cols,
            ArrowUp: -cols,
        };
        const d = move[e.key];
        if (!d) return;
        e.preventDefault();
        const target = list[i + d];
        if (target && !target.disabled) target.focus({ preventScroll: true });
        else focusFlag(i, d > 0 ? 1 : -1);
    };

    const pick = (code: string) => {
        if (!playing || state.picks.includes(code)) return;
        setFresh(code);
        onChange({ ...state, picks: [...state.picks, code] });
        if (code !== answer.c) {
            gridRef.current?.animate(
                [
                    { transform: "translateX(0)" },
                    { transform: "translateX(-7px)" },
                    { transform: "translateX(6px)" },
                    { transform: "translateX(-4px)" },
                    { transform: "translateX(0)" },
                ],
                { duration: 380 }
            );
        }
    };

    return (
        <div>
            <h3
                className="text-center font-sans text-base font-bold sm:text-lg"
                style={{ color: "var(--cm-cyan)" }}
            >
                Which flag is {answer.n}&apos;s?
            </h3>
            <p className="mt-1 text-center font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {playing
                    ? `${chancesLeft} ${chancesLeft === 1 ? "chance" : "chances"} left`
                    : status === "won"
                      ? "Correct!"
                      : "Out of chances"}
            </p>

            <div
                ref={gridRef}
                onKeyDown={onGridKey}
                className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"
            >
                {state.options.map((code) => {
                    const picked = state.picks.includes(code);
                    const isAnswer = code === answer.c;
                    const wrong = picked && !isAnswer;
                    const right = isAnswer && (picked || !playing);
                    const dim = !playing && !isAnswer && !picked;
                    const name = byCode.get(code)?.n ?? code;
                    return (
                        <button
                            key={code}
                            type="button"
                            disabled={!playing || picked}
                            onClick={() => pick(code)}
                            aria-label={
                                playing || picked || isAnswer
                                    ? `Flag choice${right ? `: ${name}, correct` : wrong ? `: ${name}, wrong` : ""}`
                                    : "Flag choice"
                            }
                            className={cn(
                                "group relative overflow-hidden rounded-[2px] border-2 bg-card/60 p-1.5 transition-all duration-300",
                                playing && !picked && "hover:-translate-y-1 hover:",
                                right && fresh === code && "og-win",
                                wrong && fresh === code && "og-shake",
                                dim && "opacity-35 grayscale"
                            )}
                            style={{
                                borderColor: right
                                    ? GREEN
                                    : wrong
                                      ? RED
                                      : "var(--border)",
                            }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={flagSrc(code)}
                                alt=""
                                width={160}
                                height={120}
                                loading="eager"
                                draggable={false}
                                className={cn(
                                    "aspect-[4/3] w-full rounded-md object-cover transition-transform duration-300",
                                    playing && !picked && "group-hover:scale-[1.03]",
                                    wrong && "opacity-40 grayscale"
                                )}
                            />
                            {(right || wrong) && (
                                <span
                                    className="og-hint absolute inset-0 grid place-items-center"
                                    aria-hidden
                                >
                                    <span
                                        className="grid size-12 place-items-center rounded-[2px] text-black"
                                        style={{
                                            backgroundColor: right ? GREEN : RED,
                                        }}
                                    >
                                        {right ? (
                                            <Check className="size-7" strokeWidth={3.5} />
                                        ) : (
                                            <X className="size-7" strokeWidth={3.5} />
                                        )}
                                    </span>
                                </span>
                            )}
                            {(right || wrong || !playing) && (
                                <span className="og-hint mt-1.5 block truncate text-center text-xs font-semibold">
                                    {name}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {!playing && (
                <div className="og-hint mt-5 text-center">
                    <p
                        className="font-sans text-xl font-bold"
                        style={{ color: status === "won" ? GREEN : RED }}
                    >
                        {status === "won"
                            ? wrongPicks.length === 0
                                ? "First pick. Flawless."
                                : `Found it in ${state.picks.length}!`
                            : `That was ${answer.n}'s flag.`}
                    </p>
                    {footer}
                </div>
            )}
        </div>
    );
}
