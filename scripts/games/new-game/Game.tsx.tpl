"use client";

// __NAME__ panel. The shared shell (GameRouteShell, windowed) draws the frame, the pause button and the save tools.
// This file draws the game and runs its clock. The rules live in lib/__SLUG__/engine.ts; nothing here changes them.
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useGameShell } from "@/components/games/shell/game-route-shell";
import { readStored, writeStored } from "@/lib/games/save";
import * as E from "@/lib/__SLUG__/engine";

const TICK_MS = 250;
const SAVE_MS = 3000;
const POP_MS = 650;
const ARM_MS = 4000;

function storage(): Storage | null {
    try {
        return typeof window === "undefined" ? null : window.localStorage;
    } catch {
        return null;
    }
}

/** Reads the save and moves its clock to now. Also reports what the workers gathered while the page was closed. */
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
    const [armed, setArmed] = useState(false);
    const latest = useRef<E.State | null>(null);
    const popId = useRef(0);
    const armTimer = useRef<number | undefined>(undefined);

    // Load once, on the client. The server renders the placeholder, so no render ever reads storage.
    useEffect(() => {
        const loaded = load(Date.now());
        latest.current = loaded.state;
        setState(loaded.state);
        setAway(loaded.away >= 1 ? loaded.away : 0);
    }, []);

    const ready = state !== null;

    // The clock. While the game is paused the save clock moves with it, so paused time never pays out on resume.
    useEffect(() => {
        if (!ready) return;
        const id = window.setInterval(() => {
            const cur = latest.current;
            if (!cur) return;
            const now = Date.now();
            const next = paused ? { ...cur, savedAt: now } : E.advance(cur, now);
            latest.current = next;
            setState(next);
        }, TICK_MS);
        return () => window.clearInterval(id);
    }, [ready, paused]);

    // Saves on a timer, when the tab is hidden, and when the page closes.
    useEffect(() => {
        if (!ready) return;
        const persist = () => {
            const cur = latest.current;
            if (cur) writeStored(storage(), E.SAVE_KEY, E.serialize(cur));
        };
        const onHide = () => {
            if (document.visibilityState === "hidden") persist();
        };
        const id = window.setInterval(persist, SAVE_MS);
        window.addEventListener("pagehide", persist);
        document.addEventListener("visibilitychange", onHide);
        return () => {
            window.clearInterval(id);
            window.removeEventListener("pagehide", persist);
            document.removeEventListener("visibilitychange", onHide);
            persist();
        };
    }, [ready]);

    // A reset asks twice: the first press arms the button, and the arm wears off after a few seconds.
    useEffect(() => () => window.clearTimeout(armTimer.current), []);

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
        if (!cur || paused || E.prestigeGain(cur) < 1) return;
        if (!armed) {
            setArmed(true);
            window.clearTimeout(armTimer.current);
            armTimer.current = window.setTimeout(() => setArmed(false), ARM_MS);
            return;
        }
        window.clearTimeout(armTimer.current);
        setArmed(false);
        commit(E.prestige(E.advance(cur, Date.now()), Date.now()));
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

    const mult = E.multiplier(state);
    const gain = E.prestigeGain(state);
    const progress = Math.min(1, state.earned / E.PRESTIGE_UNIT);

    return (
        <div className="__SLUG__-root" onKeyDown={onKey}>
            <section className="__SLUG__-stage" aria-label="Gather">
                <header className="__SLUG__-head">
                    <span className="__SLUG__-kick">__RESOURCE__</span>
                    <strong className="__SLUG__-amount" aria-live="polite">{E.formatAmount(state.amount)}</strong>
                    <span className="__SLUG__-rate">{E.formatAmount(E.rate(state))} per second</span>
                </header>
                {away > 0 && (
                    <p className="__SLUG__-away" role="status">
                        While you were away, your generators gathered {E.formatAmount(away)}.
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
            </section>

            <aside className="__SLUG__-side" aria-label="Generators, upgrades and reset">
                <div className="__SLUG__-card">
                    <h4>Generators</h4>
                    <ul className="__SLUG__-list">
                        {E.GENERATORS.map((g, i) => {
                            const cost = E.generatorCost(state, i);
                            const can = !paused && state.amount >= cost;
                            return (
                                <li key={g.name}>
                                    <button type="button" className="__SLUG__-row" onClick={() => onBuy(i)} disabled={!can}>
                                        <span className="__SLUG__-pip" aria-hidden="true" data-i={i} />
                                        <span className="__SLUG__-row-name">
                                            {g.name}
                                            <em>{state.owned[i]} owned</em>
                                        </span>
                                        <kbd>{i + 1}</kbd>
                                        <span className="__SLUG__-cost">{E.formatAmount(cost)}</span>
                                        <span className="__SLUG__-row-sub">+{E.formatAmount(g.baseRate * mult)} per second each</span>
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
                            const owned = state.bought[j];
                            const can = !paused && E.canBuyUpgrade(state, j);
                            return (
                                <li key={u.name}>
                                    <button type="button" className="__SLUG__-row" onClick={() => onUpgrade(j)} disabled={owned || !can}>
                                        <span className="__SLUG__-row-name">
                                            {u.name}
                                            <em>{owned ? "Bought" : `Doubles everything`}</em>
                                        </span>
                                        <span className="__SLUG__-cost">{owned ? "Owned" : E.formatAmount(u.cost)}</span>
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
                        <span style={{ width: `${Math.round(progress * 100)}%` }} />
                    </div>
                    <p className="__SLUG__-row-sub">
                        {gain > 0 ? `Reset now for ${gain} point${gain === 1 ? "" : "s"}.` : `Gather ${E.formatAmount(E.PRESTIGE_UNIT)} this run to reset for points.`}
                    </p>
                    <button type="button" className="__SLUG__-hire" onClick={onReset} disabled={paused || gain < 1}>
                        <span>{armed ? "Press again to reset" : "Reset for points"}</span>
                    </button>
                </div>

                <dl className="__SLUG__-card __SLUG__-totals">
                    <div>
                        <dt>Taps</dt>
                        <dd>{E.formatAmount(state.tapped)}</dd>
                    </div>
                    <div>
                        <dt>Gathered this run</dt>
                        <dd>{E.formatAmount(state.earned)}</dd>
                    </div>
                    <div>
                        <dt>Resets</dt>
                        <dd>{state.runs}</dd>
                    </div>
                </dl>
            </aside>
        </div>
    );
}
