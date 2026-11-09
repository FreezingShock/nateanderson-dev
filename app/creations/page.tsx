import Link from "next/link";
import { getProjects, getRecentRenovations } from "@/lib/content";
import { CategoryGrid, CreationsShell, IdCard, PhilosophyGrid, Section } from "@/components/creations-sections";
import { CountUp } from "@/components/cm/reveal";
import { ART_COLLECTIONS, GAME_MODES, GAME_STATUS, allGames } from "@/lib/creations-data";

export const revalidate = 60;

// The hub: the status card in the head, the four doors (each its own page), the philosophy behind all of it, and the
// two game modes. Projects and renovations come from Supabase; games and artwork live in lib/creations-data.ts.
export default async function CreationsPage() {
    const [projects, renovations] = await Promise.all([getProjects(), getRecentRenovations()]);
    const games = allGames();

    const counts = {
        games: games.length,
        projects: projects.length,
        renovations: renovations.length,
        artwork: ART_COLLECTIONS.length,
    };
    const total = counts.games + counts.projects + counts.renovations + counts.artwork;

    return (
        <CreationsShell
            eyebrow="Made / Creations"
            title={["Creations"]}
            description="Everything I build: games you can play here, coding and Roblox projects, renovation studies of real places, and the artwork around it all."
            aside={
                <IdCard
                    label="creations // index"
                    badge="cr"
                    year="2027"
                    rows={[
                        { k: "Web app games", v: <CountUp value={counts.games} /> },
                        { k: "Projects", v: <CountUp value={counts.projects} /> },
                        { k: "Renovations", v: <CountUp value={counts.renovations} /> },
                        { k: "Art collections", v: <CountUp value={counts.artwork} /> },
                    ]}
                    foot={["workbench", `${total} items total`]}
                />
            }
        >
            <Section id="explore" no="01" label="Explore" title="Four rooms, one workshop." blurb="Pick a door.">
                <CategoryGrid counts={counts} />
            </Section>

            <Section
                id="philosophy"
                no="02"
                label="Creation philosophy"
                title="Why I make things the way I do."
            >
                <PhilosophyGrid />
            </Section>

            <Section
                id="roadmap"
                no="03"
                label="Game modes"
                title="Two ways to play."
                blurb="A daily puzzle and an unlimited practice mode. Each links to its games."
            >
                <div className="cm-grid">
                    {GAME_MODES.map((m) => {
                        const Icon = m.icon;
                        const live = m.games.filter((g) => g.status === "playable").length;
                        return (
                            <Link key={m.id} href={`/creations/games#${m.id}`} className="cm-card link" style={{ height: "100%" }}>
                                <div className="cm-row" style={{ justifyContent: "space-between" }}>
                                    <Icon className="cm-ico" aria-hidden="true" />
                                    <span className={`cm-state ${live ? "live" : ""}`}>{live ? `${live} ${GAME_STATUS.playable.label.toLowerCase()}` : "Planned"}</span>
                                </div>
                                <b>{m.title}</b>
                                <p>{m.tagline}</p>
                                <span className="st">{m.games.length} {m.games.length === 1 ? "game" : "games"}</span>
                            </Link>
                        );
                    })}
                </div>
            </Section>
        </CreationsShell>
    );
}

export const metadata = { title: "Creations" };
