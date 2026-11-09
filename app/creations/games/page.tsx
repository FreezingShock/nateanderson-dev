import { CreationsShell } from "@/components/creations-sections";
import { NaosGameMode } from "@/components/games/naos";
import { GAME_MODES } from "@/lib/creations-data";

export default function GamesPage() {
    return (
        <div className="ctos">
            <CreationsShell
                eyebrow="Creations / Games"
                title={["Games"]}
                description="Geography games that run right here in your browser. Take the daily puzzle, then practice as long as you like. Streaks and stats stay on your device."
                back={{ href: "/creations", label: "Back to Creations" }}
            >
                {GAME_MODES.map((m, i) => (
                    <NaosGameMode key={m.id} mode={m} no={String(i + 1).padStart(2, "0")} />
                ))}
            </CreationsShell>
        </div>
    );
}

export const metadata = { title: "Games" };
