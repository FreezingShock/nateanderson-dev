import Link from "next/link";
import type { ReactNode } from "react";
import { Section } from "@/components/cm/ui";
import { Scramble } from "@/components/cm/motion";
import { GAME_STATUS, type Game, type GameMode } from "@/lib/creations-data";

// naOS pieces for the games pages. Server-safe: the interactive game components stay client components and sit
// inside these frames unchanged. Styling lives in app/camino/games.css under `.ctos`.

/**
 * Status-card frame around one playable game: a white header bar with the game's naOS code, the game itself, and a
 * signal strip at the bottom. The game's own `.cm-panel` is flattened inside so the frame is the only card.
 */
export function GameFrame({
    code,
    foot,
    children,
}: {
    /** Short dotted code shown in the header, e.g. "outline.guess" */
    code: string;
    /** Two short facts for the footer strip */
    foot: [string, string];
    children: ReactNode;
}) {
    return (
        <div className="g-frame" data-rx="slide">
            <div className="g-top">
                <Scramble className="g-sys" replay text={`naOS // ${code}`} />
                <span className="id-live">
                    <i aria-hidden="true" />
                    Ready
                </span>
            </div>
            <div className="g-body">{children}</div>
            <div className="p-foot" aria-hidden="true">
                <span className="id-bars">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                </span>
                <span>{foot[0]}</span>
                <span>{foot[1]}</span>
            </div>
        </div>
    );
}

/** The side readout beside a game: a status-card panel with key facts and short rules. */
export function GameReadout({
    rows,
    notes,
}: {
    rows: [label: string, value: string][];
    notes: string[];
}) {
    return (
        <aside className="g-read cm-panel" data-rx="slide-r" aria-label="How this game works">
            <div className="id-top">
                <Scramble className="id-sys" replay text="naOS // readout" />
            </div>
            <dl className="id-rows g-rows">
                {rows.map(([k, v]) => (
                    <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                    </div>
                ))}
            </dl>
            <ol className="g-notes">
                {notes.map((n) => (
                    <li key={n}>{n}</li>
                ))}
            </ol>
            <div className="p-foot" aria-hidden="true">
                <span>{rows.length} facts</span>
                <span>{notes.length} rules</span>
            </div>
        </aside>
    );
}

function GameCard({ game, index }: { game: Game; index: number }) {
    const st = GAME_STATUS[game.status];
    const Icon = game.icon;
    const tone = game.status === "playable" ? "live" : game.status === "building" ? "warn" : "";
    const inner = (
        <>
            <div className="cm-row" style={{ justifyContent: "space-between" }}>
                <span className="cm-state">{String(index + 1).padStart(2, "0")} / {game.slug}</span>
                <span className={`cm-tag flat ${tone}`}>{st.label}</span>
            </div>
            <div className="g-cardart" aria-hidden="true">
                <Icon />
            </div>
            <b>{game.title}</b>
            <p>{game.blurb}</p>
            <ul className="cm-row-gap g-pills">
                {game.features.map((f) => (
                    <li key={f} className="cm-pill">
                        {f}
                    </li>
                ))}
            </ul>
            <span className="st">{game.href ? "Play now →" : "Not built yet"}</span>
        </>
    );
    return game.href ? (
        <Link href={game.href} className="cm-card link g-card">
            {inner}
        </Link>
    ) : (
        <div className="cm-card g-card" style={{ opacity: 0.86 }}>
            {inner}
        </div>
    );
}

/** One game mode on the Games hub: a naOS section whose cards take the ctOS card rotation. */
export function NaosGameMode({ mode, no }: { mode: GameMode; no: string }) {
    return (
        <Section id={mode.id} no={no} label={mode.title} title={mode.tagline} blurb={mode.about} ctos>
            <div className="cm-grid g-grid">
                {mode.games.map((g, i) => (
                    <GameCard key={g.slug} game={g} index={i} />
                ))}
            </div>
        </Section>
    );
}
