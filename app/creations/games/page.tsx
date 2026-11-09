import { CreationsShell, GameModeSection } from "@/components/creations-sections";
import { GAME_MODES } from "@/lib/creations-data";

export default function GamesPage() {
    return (
        <CreationsShell
            eyebrow="Creations / Games"
            title={["Web App Games"]}
            description="Games that run right here in your browser: daily puzzles, unlimited practice and, down the road, incremental and tycoon games. Most are still placeholders, and we're building them one at a time."
            back={{ href: "/creations", label: "Back to Creations" }}
        >
            {GAME_MODES.map((m, i) => (
                <GameModeSection key={m.id} mode={m} no={String(i + 1).padStart(2, "0")} />
            ))}
        </CreationsShell>
    );
}

export const metadata = { title: "Games" };
