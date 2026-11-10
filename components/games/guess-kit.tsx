"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type RefObject,
} from "react";
import { ArrowUp, Dices, Globe2, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    DIFFICULTIES,
    DIRECTION_NAME,
    MAX_GUESSES,
    REGIONS,
    bearingDeg,
    direction8,
    findExact,
    flagSrc,
    formatDistance,
    haversineKm,
    pctColor,
    proximityPct,
    searchNames,
    type Country,
} from "@/lib/outline-game";

// Pieces shared by the Outline Guesser and the Flag Guesser: the guess rows
// (distance, arrow, closeness), confetti burst, stats and filter panels,
// country search box, and localStorage helpers.

export const COLOR = "var(--cm-cyan)";

// ---- Keyboard ----
//
// One handler per game (attached to a ref on its panel):
//   Enter          Guess (or focus the box when it is empty)
//   Enter / Space  once a phase is over: Play next round / Next country /
//                  See summary (Space never submits a guess, so names with
//                  spaces can be typed)
//   Alt+D/H/G/R    dice, hint, give up, restart
//   any letter     jumps into the country box (replacing a picked country)
// Buttons opt in with data-primary / data-action; keys pressed while focus is
// in the site nav, the dock or another control are left alone.

const ACTION_KEYS: Record<string, string> = {
    d: "dice",
    h: "hint",
    g: "giveup",
    r: "restart",
};

const finePointer = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: fine)").matches;

/** Focus the country box (only with a mouse: a phone would open its keyboard). */
export function focusGameInput(root: HTMLElement | null, force = false) {
    if (!root || (!force && !finePointer())) return;
    const input = root.querySelector<HTMLInputElement>(
        'input[role="combobox"]:not([readonly])'
    );
    input?.focus({ preventScroll: true });
}

export function useGameKeys(rootRef: RefObject<HTMLElement | null>) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const root = rootRef.current;
            if (!root || e.defaultPrevented || e.isComposing) return;
            // Only while the game is on screen.
            const r = root.getBoundingClientRect();
            if (r.bottom < 0 || r.top > window.innerHeight) return;
            const t = e.target as HTMLElement | null;
            const home = !t || t === document.body || root.contains(t);
            if (!home) return;

            if (e.altKey && !e.ctrlKey && !e.metaKey) {
                const action = ACTION_KEYS[e.key.toLowerCase()];
                if (!action) return;
                const b = root.querySelector<HTMLElement>(
                    `[data-action="${action}"]:not(:disabled)`
                );
                if (b) {
                    e.preventDefault();
                    b.click();
                }
                return;
            }
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            const typing = !!t?.closest(
                'input, textarea, select, [contenteditable="true"]'
            );
            if (typing) return;
            const onControl = !!t?.closest(
                'button, a, summary, [role="option"], [role="button"]'
            );

            if (e.key === " " || e.key === "Enter") {
                // A focused button or link activates itself.
                if (onControl) return;
                const primary = root.querySelector<HTMLElement>(
                    "[data-primary]:not(:disabled)"
                );
                if (!primary) return;
                // Space only moves on between phases; guessing is Enter.
                if (primary.dataset.role === "guess" && e.key === " ") return;
                e.preventDefault();
                if (primary.dataset.role === "guess") {
                    const input = root.querySelector<HTMLInputElement>(
                        'input[role="combobox"]'
                    );
                    if (input && !input.value.trim()) {
                        input.focus({ preventScroll: true });
                        return;
                    }
                }
                primary.click();
                return;
            }

            // Type anywhere to start guessing.
            if (e.key.length === 1 && /\S/.test(e.key)) {
                const input = root.querySelector<HTMLInputElement>(
                    'input[role="combobox"]:not([readonly])'
                );
                if (input) {
                    input.focus({ preventScroll: true });
                    input.select();
                }
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [rootRef]);
}

/** Small legend of the shortcuts (hidden on touch screens). */
export function KeyLegend() {
    const key = (k: string) => (
        <kbd className="rounded border border-border bg-foreground/5 px-1.5 py-0.5 font-mono text-[10px]">
            {k}
        </kbd>
    );
    return (
        <p className="mt-5 hidden flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground [@media(pointer:fine)]:flex">
            <span>{key("Enter")} guess</span>
            <span>
                {key("Enter")} {key("Space")} next round
            </span>
            <span>{key("Alt")}+{key("D")} dice</span>
            <span>{key("Alt")}+{key("H")} hint</span>
            <span>{key("Alt")}+{key("G")} give up</span>
            <span>{key("Alt")}+{key("R")} restart</span>
        </p>
    );
}

/** Camino panel behind a whole game. */
export const GLASS_CLASS = "cm-panel tick relative max-w-xl p-4 sm:p-6";
export const GLASS_STYLE: CSSProperties = {};

export type Mode = "daily" | "unlimited";
export type Status = "playing" | "won" | "lost";
export type Unit = "km" | "mi";

export interface Guess {
    code: string;
    km: number;
    bearing: number;
    pct: number;
}
export interface ModeStats {
    played: number;
    won: number;
    streak: number;
    best: number;
    last: string;
    dist: number[];
}
export type AllStats = Record<Mode, ModeStats>;

export const EMPTY_STATS = (): ModeStats => ({
    played: 0,
    won: 0,
    streak: 0,
    best: 0,
    last: "",
    dist: Array(MAX_GUESSES).fill(0),
});


export function load<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}
export function save(key: string, value: unknown) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {}
}

export function makeGuess(guess: Country, answer: Country): Guess {
    const correct = guess.c === answer.c;
    const km = correct ? 0 : haversineKm(guess, answer);
    return {
        code: guess.c,
        km,
        bearing: correct ? 0 : bearingDeg(guess, answer),
        pct: proximityPct(km, correct),
    };
}

/** Counts up to `to` once when a fresh row appears. */
function CountUp({ to, animate }: { to: number; animate: boolean }) {
    const [v, setV] = useState(animate ? 0 : to);
    useEffect(() => {
        if (!animate) return;
        const start = performance.now() + 550;
        let raf = 0;
        const tick = (now: number) => {
            const t = Math.min(1, Math.max(0, (now - start) / 800));
            setV(Math.round(to * (1 - (1 - t) ** 3)));
            if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [to, animate]);
    return <>{animate ? v : to}%</>;
}

export function GuessRow({
    guess,
    country,
    unit,
    fresh,
}: {
    guess: Guess;
    country: Country;
    unit: Unit;
    fresh: boolean;
}) {
    const correct = guess.pct === 100;
    const color = pctColor(guess.pct);
    const dir = direction8(guess.bearing);
    // Cells reveal one after another when the row is new.
    const delay = (i: number): CSSProperties =>
        fresh ? { animationDelay: `${0.15 + i * 0.22}s` } : { animation: "none" };

    return (
        <div
            className={cn(
                "grid grid-cols-[1fr_auto_2.25rem_3.25rem] items-center gap-2 rounded-[2px] border px-3 py-1.5 text-sm",
                fresh ? "og-row" : ""
            )}
            style={{
                borderColor: `color-mix(in oklch, ${color} 45%, transparent)`,
                backgroundColor: `color-mix(in oklch, ${color} 9%, transparent)`,
            }}
            role="listitem"
            aria-label={
                correct
                    ? `${country.n}, correct`
                    : `${country.n}, ${formatDistance(guess.km, unit)} away, target is ${DIRECTION_NAME[dir]}, ${guess.pct} percent`
            }
        >
            <span
                className="og-cell truncate font-semibold uppercase tracking-wide"
                style={delay(0)}
            >
                {country.n}
            </span>
            <span
                className="og-cell font-mono text-xs tabular-nums text-muted-foreground"
                style={delay(1)}
            >
                {formatDistance(guess.km, unit)}
            </span>
            <span className="grid place-items-center" style={delay(2)}>
                {correct ? (
                    <PartyPopper
                        className={cn("size-5", fresh && "og-arrow")}
                        style={
                            {
                                color,
                                "--rot": "0deg",
                                ...delay(2),
                            } as CSSProperties
                        }
                    />
                ) : (
                    <ArrowUp
                        className={cn("size-5", fresh && "og-arrow")}
                        strokeWidth={3}
                        style={
                            {
                                color,
                                "--rot": `${dir * 45}deg`,
                                transform: `rotate(${dir * 45}deg)`,
                                ...delay(2),
                            } as CSSProperties
                        }
                    />
                )}
            </span>
            <span
                className="og-cell text-right font-mono text-sm font-bold tabular-nums"
                style={{ color, ...delay(3) }}
            >
                <CountUp to={guess.pct} animate={fresh} />
            </span>
        </div>
    );
}

export function Burst() {
    const bits = useMemo(
        () =>
            Array.from({ length: 22 }, (_, i) => {
                const a = (i / 22) * Math.PI * 2 + Math.random() * 0.3;
                const r = 90 + Math.random() * 90;
                return {
                    bx: `${Math.cos(a) * r}px`,
                    by: `${Math.sin(a) * r}px`,
                    color: [
                        "var(--cm-cyan)",
                        "var(--cm-amber)",
                        "var(--cm-good)",
                        "var(--cm-fg)",
                        "var(--cm-amber)",
                    ][i % 5],
                    delay: `${Math.random() * 0.15}s`,
                };
            }),
        []
    );
    return (
        <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 z-10"
        >
            {bits.map((b, i) => (
                <span
                    key={i}
                    className="og-burst absolute size-2 rounded-sm"
                    style={
                        {
                            backgroundColor: b.color,
                            "--bx": b.bx,
                            "--by": b.by,
                            animationDelay: b.delay,
                        } as CSSProperties
                    }
                />
            ))}
        </div>
    );
}

const toggleIn = <T,>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

/** Difficulty and region chips for Unlimited mode. */
export function FilterPanel({
    difficulties,
    regions,
    poolSize,
    onChange,
}: {
    difficulties: number[];
    regions: string[];
    poolSize: number;
    onChange: (d: number[], r: string[]) => void;
}) {
    const toggle = toggleIn;
    return (
            <div className="mb-3 space-y-2 rounded-[2px] border border-border/50 bg-foreground/5 p-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="w-20 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                Difficulty
                            </span>
                            {DIFFICULTIES.map((d) => {
                                const on = difficulties.includes(d.id);
                                return (
                                    <button
                                        key={d.id}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() =>
                                            onChange(toggle(difficulties, d.id), regions)
                                        }
                                        className="cm-chip"
                                    >
                                        <span className="dot" style={{ background: on ? "currentColor" : d.color }} />
                                        {d.label}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="w-20 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                Region
                            </span>
                            {REGIONS.map((r) => {
                                const on = regions.includes(r.id);
                                return (
                                    <button
                                        key={r.id}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() =>
                                            onChange(difficulties, toggle(regions, r.id))
                                        }
                                        className="cm-chip"
                                    >
                                        <span className="dot" style={{ background: on ? "currentColor" : r.color }} />
                                        {r.label}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            <span>
                                {poolSize === 0
                                    ? "Nothing matches: loosen a filter"
                                    : `${poolSize} in pool${
                                          difficulties.length + regions.length === 0
                                              ? " (everything)"
                                              : ""
                                      }`}
                            </span>
                            {difficulties.length + regions.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => onChange([], [])}
                                    className="underline underline-offset-2 hover:text-foreground"
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                    </div>
    );
}

/** Played / win % / streak / best plus the guess-count histogram. */
export function StatsPanel({
    mode,
    s,
}: {
    mode: Mode;
    s: ModeStats;
}) {
    return (
            <div className="cm-panel og-hint mb-3 p-4">
                        <p className="font-sans text-sm font-bold" style={{ color: COLOR }}>
                            {mode === "daily" ? "Daily" : "Unlimited"} stats
                        </p>
                        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                            {[
                                ["Played", s.played],
                                ["Win %", s.played ? Math.round((s.won / s.played) * 100) : 0],
                                ["Streak", s.streak],
                                ["Best", s.best],
                            ].map(([label, v]) => (
                                <div key={label}>
                                    <p className="font-mono text-xl font-bold tabular-nums" style={{ color: COLOR }}>
                                        {v}
                                    </p>
                                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                        {label}
                                    </p>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 space-y-1">
                            {s.dist.map((n, i) => {
                                const max = Math.max(1, ...s.dist);
                                return (
                                    <div key={i} className="flex items-center gap-2 text-xs">
                                        <span className="w-3 font-mono text-muted-foreground">{i + 1}</span>
                                        <div className="h-4 flex-1 rounded bg-foreground/10">
                                            <div
                                                className="flex h-full items-center justify-end rounded px-1.5 font-mono text-[10px] font-bold text-black transition-[width] duration-700"
                                                style={{
                                                    width: `${Math.max(n ? 8 : 0, (n / max) * 100)}%`,
                                                    backgroundColor: COLOR,
                                                }}
                                            >
                                                {n || ""}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
    );
}

/**
 * Country search box with autocomplete, a Guess button and inline errors.
 * It reports only valid, new picks; duplicates and typos shake the form.
 */
export function CountryCombobox({
    countries,
    guessed,
    onPick,
    label = "Guess a country",
    disabled = false,
}: {
    countries: Country[];
    guessed: Set<string>;
    onPick: (c: Country) => void;
    label?: string;
    disabled?: boolean;
}) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const [notice, setNotice] = useState("");
    const formRef = useRef<HTMLFormElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const guessRef = useRef<HTMLButtonElement>(null);

    // Ready to type as soon as a round starts (mouse users only).
    useEffect(() => {
        if (finePointer()) inputRef.current?.focus({ preventScroll: true });
    }, []);

    // A picked country flashes cyan and focus moves to Guess (not the
    // text box), so the visitor isn't dropped back into typing.
    const landed = useCallback(() => {
        inputRef.current?.blur();
        guessRef.current?.focus({ preventScroll: true });
        inputRef.current?.animate(
            [
                {
                    backgroundColor:
                        "color-mix(in oklch, var(--cm-cyan) 55%, transparent)",
                    boxShadow: "0 0 0 3px var(--cm-cyan)",
                },
                {
                    backgroundColor:
                        "color-mix(in oklch, var(--cm-cyan) 22%, transparent)",
                    boxShadow: "0 0 0 2px var(--cm-cyan)",
                },
                { backgroundColor: "transparent", boxShadow: "0 0 0 0 transparent" },
            ],
            { duration: 1100, easing: "ease-out" }
        );
        guessRef.current?.animate(
            [
                { transform: "scale(1)" },
                { transform: "scale(1.12)" },
                { transform: "scale(1)" },
            ],
            { duration: 450, delay: 150, easing: "ease-out" }
        );
    }, []);

    // ---- Dice: cycle through every country, fast then slowing to a stop ----
    const [rolling, setRolling] = useState<Country | null>(null);
    const step = useRef(0);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const spinning = useRef(false);
    const last = useRef("");
    const latest = useRef({ countries, guessed });
    latest.current = { countries, guessed };

    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
        },
        []
    );

    const roll = useCallback(() => {
        const STEPS = 20;
        const pickOne = () => {
            const { countries: all, guessed: used } = latest.current;
            const free = all.filter((c) => !used.has(c.c) && c.c !== last.current);
            return free.length ? free[Math.floor(Math.random() * free.length)] : null;
        };
        // Clicking again mid-spin sends it back to full speed, so spamming
        // the dice keeps the names flying past.
        step.current = 0;
        if (spinning.current) return;
        if (
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
            const c = pickOne();
            if (c) {
                setQuery(c.n);
                requestAnimationFrame(landed);
            }
            return;
        }
        spinning.current = true;
        setOpen(false);
        setNotice("");
        const tick = () => {
            const c = pickOne();
            if (!c) {
                spinning.current = false;
                setRolling(null);
                return;
            }
            last.current = c.c;
            if (step.current >= STEPS) {
                // Landed: put the country in the box, ready to guess.
                spinning.current = false;
                setRolling(null);
                setQuery(c.n);
                requestAnimationFrame(landed);
                return;
            }
            setRolling(c);
            const delay = 35 + (step.current / STEPS) ** 2.4 * 260;
            step.current += 1;
            timer.current = setTimeout(tick, delay);
        };
        tick();
    }, [landed]);

    const suggestions = useMemo(
        () => searchNames(countries, query),
        [countries, query]
    );
    const shake = () =>
        formRef.current?.animate(
            [
                { transform: "translateX(0)" },
                { transform: "translateX(-7px)" },
                { transform: "translateX(6px)" },
                { transform: "translateX(-4px)" },
                { transform: "translateX(0)" },
            ],
            { duration: 380 }
        );

    const submit = (picked?: Country) => {
        if (disabled) return;
        const target =
            picked ??
            findExact(countries, query) ??
            (suggestions.length === 1 ? suggestions[0] : undefined);
        if (!target) {
            setNotice("Pick a country or territory from the list.");
            shake();
            return;
        }
        if (guessed.has(target.c)) {
            setNotice(`You already guessed ${target.n}.`);
            shake();
            return;
        }
        setNotice("");
        setQuery("");
        setOpen(false);
        setActive(0);
        onPick(target);
        inputRef.current?.focus();
    };

    return (
        <form
            ref={formRef}
            onSubmit={(e) => {
                e.preventDefault();
                if (open && suggestions[active] && !findExact(countries, query)) {
                    submit(suggestions[active]);
                } else submit();
            }}
        >
            <div className="relative flex gap-2">
                <div className="relative flex-1">
                    <input
                        ref={inputRef}
                        value={query}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="Country, territory..."
                        aria-label={label}
                        role="combobox"
                        aria-expanded={open && suggestions.length > 0}
                        aria-autocomplete="list"
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setOpen(true);
                            setActive(0);
                            setNotice("");
                        }}
                        onFocus={() => setOpen(true)}
                        onBlur={() => setTimeout(() => setOpen(false), 120)}
                        onKeyDown={(e) => {
                            if (e.key === "ArrowDown") {
                                e.preventDefault();
                                setActive((a) => Math.min(a + 1, suggestions.length - 1));
                            } else if (e.key === "ArrowUp") {
                                e.preventDefault();
                                setActive((a) => Math.max(a - 1, 0));
                            } else if (e.key === "Escape") setOpen(false);
                        }}
                        readOnly={!!rolling}
                        className={cn(
                            "h-11 w-full rounded-[2px] border border-border bg-card/60 px-3 text-base outline-none transition-colors focus:border-[var(--cm-cyan)]",
                            rolling &&
                                "border-[var(--cm-cyan)] text-transparent caret-transparent"
                        )}
                    />
                    {rolling && (
                        <span
                            key={`${rolling.c}-${step.current}`}
                            aria-hidden
                            className="cb-roll pointer-events-none absolute inset-0 flex items-center gap-2 px-3 text-base font-semibold"
                            style={{ color: "var(--cm-cyan)" }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={flagSrc(rolling.c)}
                                alt=""
                                width={24}
                                height={18}
                                className="h-[18px] w-6 rounded-[2px] object-cover"
                            />
                            <span className="truncate">{rolling.n}</span>
                        </span>
                    )}
                    {open && suggestions.length > 0 && (
                        <ul
                            role="listbox"
                            className="absolute inset-x-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-[2px] border border-border bg-popover p-1 "
                        >
                            {suggestions.map((c, i) => {
                                const used = guessed.has(c.c);
                                return (
                                    <li
                                        key={c.c}
                                        role="option"
                                        aria-selected={i === active}
                                        aria-disabled={used}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            if (!used) submit(c);
                                        }}
                                        onMouseEnter={() => setActive(i)}
                                        className={cn(
                                            "cursor-pointer rounded-[2px] px-3 py-2 text-sm",
                                            i === active && "bg-[var(--cm-cyan)]/15",
                                            used && "cursor-not-allowed opacity-40 line-through"
                                        )}
                                    >
                                        {c.n}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
                <button
                    type="button"
                    data-action="dice"
                    onClick={roll}
                    aria-label="Pick a random country"
                    title="Random country"
                    className="grid size-11 shrink-0 place-items-center rounded-[2px] border transition-transform hover:-translate-y-0.5 active:scale-90"
                    style={{
                        color: "var(--cm-cyan)",
                        borderColor:
                            "color-mix(in oklch, var(--cm-cyan) 60%, transparent)",
                        backgroundColor:
                            "color-mix(in oklch, var(--cm-cyan) 16%, transparent)",
                    }}
                >
                    <Dices className={cn("size-5", rolling && "cb-dice-spin")} />
                </button>
                <button
                    ref={guessRef}
                    type="submit"
                    data-primary
                    data-role="guess"
                    className="inline-flex h-11 items-center gap-2 rounded-[2px] border px-4 font-sans text-sm font-bold transition-transform hover:-translate-y-0.5"
                    style={{
                        color: COLOR,
                        borderColor: `color-mix(in oklch, ${COLOR} 55%, transparent)`,
                        backgroundColor: `color-mix(in oklch, ${COLOR} 12%, transparent)`,
                    }}
                >
                    <Globe2 className="size-4" /> Guess
                </button>
            </div>
            <p
                className="mt-1.5 min-h-5 text-center text-xs"
                style={{ color: "var(--cm-alert)" }}
                role="status"
            >
                {notice}
            </p>
        </form>
    );
}
