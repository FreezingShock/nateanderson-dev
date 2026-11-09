import { CreationsShell, GameModeSection } from "@/components/creations-sections";
import { GAME_MODES } from "@/lib/creations-data";

export default function GamesPage() {
    return (
        <CreationsShell
            eyebrow="Creations / Games"
            title={["Games"]}
            description="Geography games that run right here in your browser. Take the daily puzzle, then practice as long as you like. Streaks and stats stay on your device."
            back={{ href: "/creations", label: "Back to Creations" }}
        >
            {GAME_MODES.map((m, i) => (
                <GameModeSection key={m.id} mode={m} no={String(i + 1).padStart(2, "0")} />
            ))}
        </CreationsShell>
    );
}

export const metadata = { title: "Games" };
