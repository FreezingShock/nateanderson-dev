import Link from "next/link";
import { getProjects, getRecentRenovations } from "@/lib/content";
import { CategoryGrid, CreationsShell, PhilosophyGrid, Section } from "@/components/creations-sections";
import { CountUp, Reveal } from "@/components/cm/reveal";
import { ART_COLLECTIONS, GAME_MODES, GAME_STATUS, allGames } from "@/lib/creations-data";

export const revalidate = 60;

// The hub: overview numbers, the four doors (each its own page), and the philosophy behind all of it.
// Projects and renovations come from Supabase; games and artwork live in lib/creations-data.ts.
export default async function CreationsPage() {
    const [projects, renovations] = await Promise.all([getProjects(), getRecentRenovations()]);
    const games = allGames();
    const playable = games.filter((g) => g.status === "playable").length;

    const stats = [
        { label: "Web app games", value: games.length },
        { label: "Playable now", value: playable },
        { label: "Projects", value: projects.length },
        { label: "Renovations", value: renovations.length },
        { label: "Art collections", value: ART_COLLECTIONS.length },
    ];

    return (
        <CreationsShell
            eyebrow="Made / Creations"
            title={["Creations"]}
            description="Everything I build: games you can play here, coding and Roblox projects, renovation studies of real places, and the artwork around it all."
        >
            <Section id="overview" no="01" label="At a glance" title="What's on the workbench right now.">
                <dl className="cm-panel tick cm-kv" style={{ ["--cols" as string]: 5 }}>
                    {stats.map((s) => (
                        <div key={s.label}>
                            <dt>{s.label}</dt>
                            <dd style={{ fontSize: 28 }}><CountUp value={s.value} /></dd>
                        </div>
                    ))}
                </dl>
            </Section>

            <Section id="explore" no="02" label="Explore" title="Four rooms, one workshop." blurb="Pick a door.">
                <CategoryGrid
                    counts={{
                        games: games.length,
                        projects: projects.length,
                        renovations: renovations.length,
                        artwork: ART_COLLECTIONS.length,
                    }}
                />
            </Section>

            <Section
                id="philosophy"
                no="03"
                label="Creation philosophy"
                title="Why I make things the way I do."
                blurb="Draft wording: I'll rewrite it in my own voice."
            >
                <PhilosophyGrid />
            </Section>

            <Section
                id="roadmap"
                no="04"
                label="Game roadmap"
                title="The plan for games on this site."
                blurb="Mode by mode. Each links to its full list."
            >
                <div className="cm-grid">
                    {GAME_MODES.map((m, i) => {
                        const Icon = m.icon;
                        const live = m.games.filter((g) => g.status === "playable").length;
                        return (
                            <Reveal key={m.id} delay={(i % 4) * 60}>
                                <Link href={`/creations/games#${m.id}`} className="cm-card link" style={{ height: "100%" }}>
                                    <div className="cm-row" style={{ justifyContent: "space-between" }}>
                                        <Icon className="cm-ico" aria-hidden="true" />
                                        <span className={`cm-state ${live ? "live" : ""}`}>{live ? `${live} ${GAME_STATUS.playable.label.toLowerCase()}` : "Planned"}</span>
                                    </div>
                                    <b>{m.title}</b>
                                    <p>{m.tagline}</p>
                                    <span className="st">{m.games.length} planned or playable</span>
                                </Link>
                            </Reveal>
                        );
                    })}
                </div>
            </Section>
        </CreationsShell>
    );
}

export const metadata = { title: "Creations" };
