import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Section as CmSection } from "@/components/cm/ui";
import { ScrollType, Scramble } from "@/components/cm/motion";
import { CountUp } from "@/components/cm/reveal";
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
import "@/components/creations/creations.css";

// Server components shared by /creations and its category pages. Everything is naOS: the page wrapper turns on the
// ctos layer, every section is a ctos section (scrambled label, slab heading, scrubbed reveals), panels are
// status-card style, and cyan only marks what is live. Motion comes from the shared engine; nothing here animates.

/** Page frame for every Creations page: naOS head, optional status card, then the sections. */
export function CreationsShell({
    eyebrow,
    title,
    description,
    back,
    aside,
    backdrop,
    variant,
    children,
}: {
    eyebrow: string;
    title: string[];
    description: string;
    back?: { href: string; label: string };
    aside?: ReactNode;
    /** Page-specific art behind the title block (the hub uses the assembly field). */
    backdrop?: ReactNode;
    /** Adds `cr-<variant>` to the wrapper so one page can carry its own background and load-in without touching others. */
    variant?: string;
    children: ReactNode;
}) {
    return (
        <div className={variant ? `ctos cr-${variant}` : "ctos"} data-entrance="assemble">
            <CreationsHead label={eyebrow} title={title} lead={description} back={back} aside={aside} backdrop={backdrop} />
            {children}
        </div>
    );
}

/**
 * Title block for a Creations page: a mono label, the lowercase slab title (the same stacked white bars as the
 * homepage), a typed lead, and an optional status card beside it. Used by the hub, the category pages and detail.
 */
export function CreationsHead({
    label,
    title,
    lead,
    back,
    aside,
    backdrop,
}: {
    label: string;
    title: string[];
    lead?: string;
    back?: { href: string; label: string };
    aside?: ReactNode;
    backdrop?: ReactNode;
}) {
    return (
        <header className="cm-head cr-head">
            <div className="cm-grid-bg" aria-hidden="true" />
            {backdrop}
            <div className={`cm-wrap cr-head-grid${aside ? " has-aside" : ""}`}>
                <div className="cr-head-copy cm-stage">
                    {back && (
                        <Link href={back.href} className="cm-lbl cm-crumb">
                            <span aria-hidden="true">←</span> {back.label}
                        </Link>
                    )}
                    <span className="cm-lbl">{label}</span>
                    <h1 style={{ margin: 0 }}>
                        <span className={`cm-highlight wipe${title.length === 1 ? " solo" : ""}`} style={{ display: "inline-flex", flexDirection: "column" }}>
                            {title.map((t) => (
                                <span key={t}>{t}</span>
                            ))}
                        </span>
                    </h1>
                    {lead && <ScrollType text={lead} auto className="cm-lead" style={{ margin: 0 }} />}
                </div>
                {aside}
            </div>
        </header>
    );
}

/** Status card (the naOS ID card): badge, label/value rows and a signal strip. Same family as the homepage status. */
export function IdCard({
    label,
    badge,
    year,
    rows,
    foot,
    live = true,
}: {
    label: string;
    badge: string;
    year: string;
    rows: { k: string; v: ReactNode }[];
    foot: string[];
    /** Show the blinking Live tag. Off for work that is not running yet. */
    live?: boolean;
}) {
    return (
        <aside className="hero-status id cr-id" aria-label={label}>
            <div className="id-top">
                <Scramble className="id-sys" replay text={label} />
                {live && <span className="id-live"><i aria-hidden="true" />Live</span>}
            </div>
            <div className="id-main">
                <div className="id-badge" aria-hidden="true"><b>{badge}</b><span>{year}</span></div>
                <dl className="id-rows">
                    {rows.map((r) => (
                        <div key={r.k}>
                            <dt>{r.k}</dt>
                            <dd>{r.v}</dd>
                        </div>
                    ))}
                </dl>
            </div>
            <div className="id-foot" aria-hidden="true">
                <span className="id-bars"><i /><i /><i /><i /><i /></span>
                {foot.map((f) => (
                    <span key={f}>{f}</span>
                ))}
            </div>
        </aside>
    );
}

/** A numbered naOS section. Every Creations section is a ctos section. */
export function Section(props: ComponentProps<typeof CmSection>) {
    return <CmSection {...props} ctos />;
}

const statusLabelFor = (s: Game["status"]) => (s === "building" ? "In development" : "Planned");
const statusTone = { playable: "live", building: "warn", planned: "" } as const;
const projectTone = { active: "live", planning: "warn", idea: "" } as const;

/** The four category doors on the hub. */
export function CategoryGrid({ counts }: { counts: Record<CreationCategory["id"], number> }) {
    return (
        <div className="cm-grid cr-doors">
            {CATEGORIES.map((c) => {
                const Icon = c.icon;
                return (
                    <Link key={c.id} href={c.href} className="cm-card link" style={{ height: "100%" }}>
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
                        <span className="st">Open →</span>
                    </Link>
                );
            })}
        </div>
    );
}

export function PhilosophyGrid() {
    return (
        <div className="cm-grid cr-principles">
            {PRINCIPLES.map((p, i) => (
                <div key={p.title} className="cm-card" style={{ height: "100%" }}>
                    <span className="cm-state">{String(i + 1).padStart(2, "0")}</span>
                    <b>{p.title}</b>
                    <p>{p.text}</p>
                </div>
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
        <Section id={mode.id} no={no} label={mode.title} title={mode.tagline} blurb={mode.about}>
            <div className="cm-grid">
                {mode.games.map((g) => (
                    <GameCard key={g.slug} game={g} />
                ))}
            </div>
        </Section>
    );
}

/**
 * Status card for a list page (projects, renovations). Every number is counted from the rows, so it stays true as the
 * Supabase table changes.
 */
export function ListStatusCard({ label, badge, projects }: { label: string; badge: string; projects: Project[] }) {
    const count = (s: Project["status"]) => projects.filter((p) => p.status === s).length;
    return (
        <IdCard
            label={label}
            badge={badge}
            year={String(projects.length).padStart(2, "0")}
            rows={[
                { k: "Listed", v: <CountUp value={projects.length} /> },
                { k: statusLabel.active, v: <CountUp value={count("active")} /> },
                { k: statusLabel.planning, v: <CountUp value={count("planning")} /> },
                { k: statusLabel.idea, v: <CountUp value={count("idea")} /> },
            ]}
            foot={["list / all", `${projects.length} ${projects.length === 1 ? "entry" : "entries"}`]}
        />
    );
}

/** Project / renovation grid backed by Supabase rows. */
export function ProjectGrid({ projects }: { projects: Project[] }) {
    if (projects.length === 0) {
        // Standby card: the same panel family as the status cards, so an empty list still reads as part of the system.
        return (
            <div className="cm-panel cr-empty">
                <div className="id-top">
                    <span className="id-sys">naOS // standby</span>
                </div>
                <div className="cr-empty-body">
                    <span>Nothing here yet.</span>
                    <small>Check back soon.</small>
                </div>
                <div className="p-foot" aria-hidden="true">
                    <span className="id-bars"><i /><i /><i /><i /><i /></span>
                    <span>0 entries</span>
                    <span>queue empty</span>
                </div>
            </div>
        );
    }
    return (
        <div className="cm-grid">
            {projects.map((p, i) => (
                <Link key={p.slug} href={`/creations/${p.slug}`} className="cm-card link" style={{ height: "100%" }}>
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
            ))}
        </div>
    );
}

/** One collection: a grid of image plates. Each plate is a hatched viz frame until its piece is added. */
export function ArtCollectionSection({ collection, no }: { collection: ArtCollection; no: string }) {
    const Icon = collection.icon;
    return (
        <Section id={collection.id} no={no} label="Collection" title={collection.title} blurb={collection.blurb}>
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
        </Section>
    );
}
