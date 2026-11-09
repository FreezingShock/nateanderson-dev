import { CreationsShell, Section } from "@/components/creations-sections";
import { GameFrame, GameReadout } from "@/components/games/naos";
import { OutlineGuesser } from "@/components/games/outline-guesser";
import { pageMeta } from "@/lib/seo";

import { NaosBackdrop } from "@/components/cm/naos-art";
export const metadata = pageMeta({
    title: "Outline Guesser",
    description: "Name the country from its outline. A daily puzzle and unlimited practice rounds, played in your browser.",
    path: "/creations/games/outline-guesser",
    image: "/creations/opengraph-image",
});

export default function OutlineGuesserPage() {
    return (
        <div className="ctos ng-page">
            <NaosBackdrop src="/naos/bg-games.png" />
            <CreationsShell
                eyebrow="Daily and unlimited"
                title={["Outline Guesser"]}
                description="Name the country or territory from its outline. Six guesses; every miss shows the distance, the direction to the target and how close you are."
                back={{ href: "/creations/games", label: "Back to Games" }}
            >
                <Section id="play" no="01" label="Play" title="Name that outline." ctos>
                    <div className="g-layout">
                        <GameFrame code="outline.guess" foot={["238 outlines", "stats on this device"]}>
                            <OutlineGuesser />
                        </GameFrame>
                        <GameReadout
                            rows={[
                                ["Modes", "Daily and unlimited"],
                                ["Guesses", "6 per country"],
                                ["Hints", "3 per round"],
                                ["Rounds", "Country, neighbours, flag, summary"],
                                ["Units", "km or miles"],
                            ]}
                            notes={[
                                "Every miss shows the distance and the direction to the target.",
                                "Neighbours round: drag and zoom the map, then name the countries that border the mystery one.",
                                "Flag round: press 1 to 6 to pick a flag, and the arrow keys move between them.",
                                "Restart asks once before it throws away a round in progress.",
                            ]}
                        />
                    </div>
                </Section>
            </CreationsShell>
        </div>
    );
}
