import Link from "next/link";
import type { ReactNode } from "react";
import { PageHead, Section as CmSection } from "@/components/cm/ui";
import { Reveal } from "@/components/cm/reveal";
import { statusLabel, type Project } from "@/lib/content";
import {
    CATEGORIES,
    GAME_STATUS,
    PRINCIPLES,
    type ArtCollection,
    type CreationCategory,
    type Game,
    type GameMode,
} from "@/lib/creations-data";

// Server components shared by /creations and its category pages. Everything is Camino: hairline
// cards, a hatch "viz" panel per item, mono status lines, and cyan only for what is live.

/** Page frame for every Creations page. */
export function CreationsShell({
    eyebrow,
    title,
    description,
    back,
    children,
}: {
    eyebrow: string;
    title: string[];
    description: string;
    back?: { href: string; label: string };
    children: ReactNode;
}) {
    return (
        <>
            <PageHead label={eyebrow} title={title} lead={description} back={back} />
            {children}
        </>
    );
}

export const Section = CmSection;

const statusLabelFor = (s: Game["status"]) => (s === "building" ? "In development" : "Planned");
const statusTone = { playable: "live", building: "warn", planned: "" } as const;
const projectTone = { active: "live", planning: "warn", idea: "" } as const;

/** The four category doors on the hub. */
export function CategoryGrid({ counts }: { counts: Record<CreationCategory["id"], number> }) {
    return (
        <div className="cm-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {CATEGORIES.map((c, i) => {
                const Icon = c.icon;
                return (
                    <Reveal key={c.id} delay={(i % 2) * 70}>
                        <Link href={c.href} className="cm-card link sign" style={{ height: "100%" }}>
                            <div className="cm-row" style={{ justifyContent: "space-between" }}>
                                <Icon className="cm-ico" style={{ width: 22, height: 22 }} aria-hidden="true" />
                                <span className="cm-state">{counts[c.id]} inside</span>
                            </div>
                            <b style={{ fontSize: 20, marginTop: 6 }}>{c.title}</b>
                            <p>{c.blurb}</p>
                            <div className="cm-row-gap" style={{ marginTop: 6 }}>
                                {c.tags.map((t) => (
                                    <span key={t} className="cm-pill">{t}</span>
                                ))}
                            </div>
                        </Link>
                    </Reveal>
                );
            })}
        </div>
    );
}

export function PhilosophyGrid() {
    return (
        <div className="cm-cols4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {PRINCIPLES.map((p, i) => (
                <Reveal key={p.title} delay={(i % 2) * 70}>
                    <div className="cm-card" style={{ height: "100%" }}>
                        <span className="cm-state">{String(i + 1).padStart(2, "0")}</span>
                        <b>{p.title}</b>
                        <p>{p.text}</p>
                    </div>
                </Reveal>
            ))}
        </div>
    );
}

function GameCard({ game }: { game: Game }) {
    const st = GAME_STATUS[game.status];
    const Icon = game.icon;
    const inner = (
        <>
            <div className="cm-viz">
                <span className={`cm-tag flat ${statusTone[game.status]}`}>{st.label}</span>
                <Icon aria-hidden="true" style={{ position: "absolute", right: 14, bottom: 12, width: 40, height: 40, color: "var(--cm-hair-hi)" }} />
            </div>
            <b>{game.title}</b>
            <p>{game.blurb}</p>
            <ul className="cm-row-gap" style={{ listStyle: "none", margin: "2px 0 0", padding: 0 }}>
                {game.features.map((f) => (
                    <li key={f} className="cm-pill">{f}</li>
                ))}
            </ul>
            <span className="st">{game.href ? "Play now →" : statusLabelFor(game.status)}</span>
        </>
    );
    return game.href ? (
        <Link href={game.href} className="cm-card link" style={{ height: "100%" }}>{inner}</Link>
    ) : (
        <div className="cm-card" style={{ height: "100%", opacity: 0.86 }}>{inner}</div>
    );
}

/** One game mode: a numbered section with its game cards. */
export function GameModeSection({ mode, no }: { mode: GameMode; no: string }) {
    return (
        <CmSection id={mode.id} no={no} label={mode.title} title={mode.tagline} blurb={mode.about}>
            <div className="cm-grid">
                {mode.games.map((g, i) => (
                    <Reveal key={g.slug} delay={(i % 3) * 70}>
                        <GameCard game={g} />
                    </Reveal>
                ))}
            </div>
        </CmSection>
    );
}

/** Project / renovation grid backed by Supabase rows. */
export function ProjectGrid({ projects }: { projects: Project[] }) {
    if (projects.length === 0) {
        return (
            <div className="cm-panel cm-hatch" style={{ padding: 28 }}>
                <span className="cm-read warm">Nothing here yet. Check back soon.</span>
            </div>
        );
    }
    return (
        <div className="cm-grid">
            {projects.map((p, i) => (
                <Reveal key={p.slug} delay={(i % 3) * 70}>
                    <Link href={`/creations/${p.slug}`} className="cm-card link" style={{ height: "100%" }}>
                        <div className="cm-viz">
                            <span className={`cm-tag flat ${projectTone[p.status]}`}>{statusLabel[p.status]}</span>
                            <span className="glyph" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                        </div>
                        <span className="cm-state">{p.category}</span>
                        <b>{p.title}</b>
                        <p>{p.description}</p>
                        <div className="cm-row-gap" style={{ marginTop: 2 }}>
                            {p.tags.map((t) => (
                                <span key={t} className="cm-pill">{t}</span>
                            ))}
                        </div>
                        <span className="st">Open →</span>
                    </Link>
                </Reveal>
            ))}
        </div>
    );
}

/** One collection: a grid of image plates. Each plate is a hatched viz frame until its piece is added. */
export function ArtCollectionSection({ collection, no }: { collection: ArtCollection; no: string }) {
    const Icon = collection.icon;
    return (
        <CmSection id={collection.id} no={no} label="Collection" title={collection.title} blurb={collection.blurb}>
            <div className="cm-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
                {collection.slots.map((slot, i) => (
                    <div key={slot} className="cm-card" style={{ height: "100%" }}>
                        <div className="cm-viz" style={{ aspectRatio: "4 / 3" }}>
                            <span className="cm-state" style={{ position: "absolute", left: 10, top: 10 }}>
                                {String(i + 1).padStart(2, "0")}
                            </span>
                            <Icon aria-hidden="true" style={{ position: "absolute", right: 14, bottom: 12, width: 40, height: 40, color: "var(--cm-hair-hi)" }} />
                        </div>
                        <b style={{ fontSize: 13.5 }}>{slot}</b>
                    </div>
                ))}
            </div>
        </CmSection>
    );
}
