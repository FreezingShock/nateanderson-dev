import "@/app/camino/games.css";
import { CreationsShell } from "@/components/creations-sections";
import { NaosBackdrop } from "@/components/cm/naos-art";
import { NaosGameMode } from "@/components/games/naos";
import { GAME_MODES, categoryById } from "@/lib/creations-data";
import { pageMeta } from "@/lib/seo";

export default function GamesPage() {
    return (
        <div className="ctos ng-page" data-entrance="tile">
            <NaosBackdrop src="/naos/bg-games.webp" />
            <CreationsShell
                eyebrow="Creations / Games"
                title={["Games"]}
                description="Geography games that run right here in your browser. Take the daily puzzle, then practice as long as you like. Streaks and stats stay on your device."
                back={{ href: "/creations", label: "Back to Creations" }}
            >
                <nav className="g-hub-nav" aria-label="Game modes">
                    {GAME_MODES.map((m) => (
                        <a key={m.id} href={`#${m.id}`}>
                            {m.title}
                            <span>{m.games.filter((g) => g.href).length || "soon"}</span>
                        </a>
                    ))}
                </nav>
                {GAME_MODES.map((m, i) => (
                    <NaosGameMode key={m.id} mode={m} no={String(i + 1).padStart(2, "0")} />
                ))}
            </CreationsShell>
        </div>
    );
}

export const metadata = pageMeta({
    title: "Games",
    description: categoryById("games").blurb,
    path: "/creations/games",
    image: "/creations/opengraph-image",
});
