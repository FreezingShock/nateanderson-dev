import "@/app/camino/games.css";
import "@/app/camino/ledger.css";
import { CreationsShell, Section } from "@/components/creations-sections";
import { GameFrame, GameReadout } from "@/components/games/naos";
import { Ledger } from "@/components/games/ledger";
import { LEDGER_NAME } from "@/lib/ledger/name";
import { pageMeta } from "@/lib/seo";

import { NaosBackdrop } from "@/components/cm/naos-art";
export const metadata = pageMeta({
    title: LEDGER_NAME,
    description: "Six numbers, one target. Combine them with + - x / on an adding-machine tape. A daily puzzle and unlimited practice rounds, played in your browser.",
    path: "/creations/games/ledger",
    image: "/creations/opengraph-image",
});

export default function LedgerPage() {
    return (
        <div className="ctos ng-page">
            <NaosBackdrop src="/naos/bg-games.webp" />
            <CreationsShell
                eyebrow="Daily, then unlimited"
                title={[LEDGER_NAME]}
                description="Six numbers and a target. Build the target from the numbers with + - x and /, one step at a time on the tape. Six entries; each one says how far off it is. Finish the daily once and unlimited puzzles open."
                back={{ href: "/creations/games", label: "Back to Games" }}
                variant="sub"
            >
                <Section id="play" no="01" label="Play" title="Balance the ledger." ctos>
                    <div className="g-layout">
                        <GameFrame code="ledger.sum" foot={["daily + unlimited", "stats on this device"]}>
                            <Ledger />
                        </GameFrame>
                        <GameReadout
                            rows={[
                                ["Numbers", "4 small, 2 large"],
                                ["Target", "101 to 999"],
                                ["Operators", "+ − × ÷"],
                                ["Entries", "6 per round"],
                                ["Modes", "Daily, then unlimited"],
                            ]}
                            notes={[
                                "Tap a number, an operator, then a second number. The result prints on the tape as a new number.",
                                "Division only when it divides exactly. Every result stays a positive whole number. Each given number is used once.",
                                "Each entry shows how far off it is. Hit the target exactly to win.",
                                "Finish today's daily once to open Unlimited. It stays open on this device.",
                                "Keys: 1 to 6 pick a number, + - x / pick an operator, Enter submits, Backspace undoes.",
                            ]}
                        />
                    </div>
                </Section>
            </CreationsShell>
        </div>
    );
}
