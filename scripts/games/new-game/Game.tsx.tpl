"use client";

// __NAME__ panel. The shared shell (GameRouteShell, windowed) draws the frame, the pause button and the save tools.
// The shared game kit (components/game-kit hooks) runs the clock, the autosave and the toast queue. This file draws the
// game. The rules live in lib/__SLUG__/engine.ts, which runs on lib/game-kit; nothing here changes them.
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useGameShell } from "@/components/games/shell/game-route-shell";
import { useAutosave, useGameClock } from "@/components/game-kit/hooks";
import { useToasts } from "@/components/game-kit/use-toasts";
import { readStored, writeStored } from "@/lib/games/save";
import * as E from "@/lib/__SLUG__/engine";

const POP_MS = 650;

function storage(): Storage | null {
    try {
        return typeof window === "undefined" ? null : window.localStorage;
    } catch {
        return null;
    }
}

/** Reads the save and moves its clock to now. Also reports what the generators gathered while the page was closed. */
function load(now: number): { state: E.State; away: number } {
    const store = storage();
    const raw = readStored(store, E.SAVE_KEY);
    if (raw) {
        try {
            const saved = E.parse(JSON.parse(raw));
            if (saved) {
                const state = E.advance(saved, now);
                return { state, away: state.amount - saved.amount };
            }
        } catch {
            /* fall through: a damaged save is kept below, never silently dropped */
        }
        writeStored(store, `${E.SAVE_KEY}:damaged`, raw);
    }
    return { state: E.fresh(now), away: 0 };
}

export function __CAMEL__() {
    const { paused } = useGameShell();
    const [state, setState] = useState<E.State | null>(null);
    const [away, setAway] = useState(0);
    const [pops, setPops] = useState<number[]>([]);
    const latest = useRef<E.State | null>(null);
    const popId = useRef(0);
    const { toasts, push, dismiss } = useToasts({ keep: 3, dedupe: true, ttlMs: 3200 });

    // Load once, on the client. The server renders the placeholder, so no render ever reads storage.
    useEffect(() => {
        const loaded = load(Date.now());
        latest.current = loaded.state;
        setState(loaded.state);
        setAway(loaded.away >= 1 ? loaded.away : 0);
    }, []);

    const ready = state !== null;

    // Pausing settles the clock up to now. Resuming moves the clock to now without paying for the paused time.
    useEffect(() => {
        const cur = latest.current;
        if (!cur || !ready) return;
        const now = Date.now();
        latest.current = paused ? E.advance(cur, now) : { ...cur, savedAt: now };
        setState(latest.current);
    }, [paused, ready]);

    // The kit clock: real gaps between ticks, so a throttled tab loses nothing. Paused ticks are skipped.
    const pausedRef = useRef(paused);
    useEffect(() => {
        pausedRef.current = paused;
    }, [paused]);
    useGameClock(
        (_gap, now) => {
            const cur = latest.current;
            if (!cur) return;
            const next = E.advance(cur, now);
            latest.current = next;
            setState(next);
        },
        { ms: 100, enabled: ready, paused: () => pausedRef.current },
    );

    // The kit autosave: on an interval, when the tab hides, and when the page leaves.
    useAutosave(
        () => {
            const cur = latest.current;
            if (cur) writeStored(storage(), E.SAVE_KEY, E.serialize(cur));
        },
        { everyMs: 3000, enabled: ready },
    );

    const commit = (next: E.State) => {
        latest.current = next;
        setState(next);
    };

    const onTap = () => {
        const cur = latest.current;
        if (!cur || paused) return;
        commit(E.tap(E.advance(cur, Date.now())));
        setAway(0);
        const id = ++popId.current;
        setPops((p) => [...p, id]);
        window.setTimeout(() => setPops((p) => p.filter((x) => x !== id)), POP_MS);
    };

    const onBuy = (i: number) => {
        const cur = latest.current;
        if (!cur || paused) return;
        commit(E.buyGenerator(E.advance(cur, Date.now()), i));
    };

    const onUpgrade = (j: number) => {
        const cur = latest.current;
        if (!cur || paused) return;
        commit(E.buyUpgrade(E.advance(cur, Date.now()), j));
    };

    const onReset = () => {
        const cur = latest.current;
        if (!cur || paused) return;
        const now = Date.now();
        const settled = E.advance(cur, now);
        const gain = E.prestigeGainNow(settled);
        if (gain < 1) return;
        commit(E.prestige(settled, now));
        push(`Reset for ${gain} point${gain === 1 ? "" : "s"}.`, "good");
    };

    // Number keys sit on the rows: 1 to 3 buy the matching generator. Space and Enter press the focused tap button.
    const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= E.GENERATORS.length) {
            e.preventDefault();
            onBuy(n - 1);
        }
    };

    if (!state) return <div className="__SLUG__-root __SLUG__-loading" aria-busy="true" />;

    const mult = E.multipliers(state)[0];
    const gain = E.prestigeGainNow(state);
    const meter = Math.round(E.prestigeMeter(state) * 100);

    return (
        <div className="__SLUG__-root" onKeyDown={onKey}>
            <section className="__SLUG__-stage" aria-label="Gather">
                <header className="__SLUG__-head">
                    <span className="__SLUG__-kick">__RESOURCE__</span>
                    <strong className="__SLUG__-amount" aria-live="polite">{E.fmt(state.amount)}</strong>
                    <span className="__SLUG__-rate">{E.fmt(E.rate(state))} per second</span>
                </header>
                {away > 0 && (
                    <p className="__SLUG__-away" role="status">
                        While you were away, your generators gathered {E.fmt(away)}.
                    </p>
                )}
                <div className="__SLUG__-dais">
                    <button type="button" className="__SLUG__-tap" onClick={onTap} disabled={paused} aria-label="Gather __RESOURCE__">
                        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
                            <rect x="10" y="10" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="3" />
                            <rect x="22" y="22" width="20" height="20" fill="currentColor" />
                        </svg>
                    </button>
                    {pops.map((id) => (
                        <span key={id} className="__SLUG__-pop" aria-hidden="true">+{E.TAP_GAIN}</span>
                    ))}
                </div>
                <p className="__SLUG__-hint">Tap the square or press Space. Keys 1 to {E.GENERATORS.length} buy generators.</p>
                {toasts.length > 0 && (
                    <ul className="__SLUG__-toasts" aria-live="polite">
                        {toasts.map((t) => (
                            <li key={t.id} data-tone={t.tone} onClick={() => dismiss(t.id)}>{t.text}</li>
                        ))}
                    </ul>
                )}
            </section>

            <aside className="__SLUG__-side" aria-label="Generators, upgrades and reset">
                <div className="__SLUG__-card">
                    <h4>Generators</h4>
                    <ul className="__SLUG__-list">
                        {E.GENERATORS.map((g, i) => {
                            const cost = E.generatorCost(state, i);
                            const can = !paused && state.amount >= cost;
                            return (
                                <li key={g.id}>
                                    <button type="button" className="__SLUG__-row" onClick={() => onBuy(i)} disabled={!can}>
                                        <span className="__SLUG__-pip" aria-hidden="true" data-i={i} />
                                        <span className="__SLUG__-row-name">
                                            {g.name}
                                            <em>{E.whole(state.owned[i])} owned</em>
                                        </span>
                                        <kbd>{i + 1}</kbd>
                                        <span className="__SLUG__-cost">{E.fmt(cost)}</span>
                                        <span className="__SLUG__-row-sub">makes {g.rate} {i === 0 ? "per second" : `${E.GENERATORS[i - 1].name}s per second`} each</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <div className="__SLUG__-card">
                    <h4>Upgrades</h4>
                    <ul className="__SLUG__-list">
                        {E.UPGRADES.map((u, j) => {
                            const owned = state.bought.includes(u.id);
                            const can = !paused && E.canBuyUpgrade(state, j);
                            return (
                                <li key={u.id}>
                                    <button type="button" className="__SLUG__-row" onClick={() => onUpgrade(j)} disabled={owned || !can}>
                                        <span className="__SLUG__-row-name">
                                            {u.name}
                                            <em>{owned ? "Bought" : `Multiplies everything by ${u.mult}`}</em>
                                        </span>
                                        <span className="__SLUG__-cost">{owned ? "Owned" : E.fmt(u.cost)}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <div className="__SLUG__-card">
                    <h4>Reset</h4>
                    <p className="__SLUG__-count">
                        {state.points} points, +{Math.round(state.points * E.PRESTIGE_BONUS * 100)}% production
                    </p>
                    <div className="__SLUG__-meter" aria-hidden="true">
                        <span style={{ width: `${meter}%` }} />
                    </div>
                    <p className="__SLUG__-row-sub">
                        {gain > 0
                            ? `Reset now for ${gain} point${gain === 1 ? "" : "s"}.`
                            : `Gather ${E.fmt(E.PRESTIGE_UNIT)} this run to reset for points.`}
                    </p>
                    <button type="button" className="__SLUG__-hire" onClick={onReset} disabled={paused || gain < 1}>
                        <span>Reset for points</span>
                    </button>
                </div>

                <dl className="__SLUG__-card __SLUG__-totals">
                    <div>
                        <dt>Taps</dt>
                        <dd>{E.fmt(state.tapped)}</dd>
                    </div>
                    <div>
                        <dt>Gathered this run</dt>
                        <dd>{E.fmt(state.earned)}</dd>
                    </div>
                    <div>
                        <dt>Resets</dt>
                        <dd>{state.runs}</dd>
                    </div>
                    <div>
                        <dt>Multiplier</dt>
                        <dd>x{mult.toFixed(2)}</dd>
                    </div>
                </dl>
            </aside>
        </div>
    );
}
