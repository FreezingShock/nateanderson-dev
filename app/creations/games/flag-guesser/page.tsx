import { CreationsShell, Section } from "@/components/creations-sections";
import { GameFrame, GameReadout } from "@/components/games/naos";
import { FlagGuesser } from "@/components/games/flag-guesser";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
    title: "Flag Guesser",
    description: "Name the country from its flag. A daily puzzle and unlimited practice rounds, played in your browser.",
    path: "/creations/games/flag-guesser",
    image: "/creations/opengraph-image",
});

export default function FlagGuesserPage() {
    return (
        <div className="ctos ng-page">
            <CreationsShell
                eyebrow="Daily and unlimited"
                title={["Flag Guesser"]}
                description="Name the country from its flag. It starts hidden behind six tiles and every wrong guess flips another, with distance and direction clues to the right country."
                back={{ href: "/creations/games", label: "Back to Games" }}
            >
                <Section id="play" no="01" label="Play" title="Name that flag." ctos>
                    <div className="g-layout">
                        <GameFrame code="flag.guess" foot={["239 flags", "stats on this device"]}>
                            <FlagGuesser />
                        </GameFrame>
                        <GameReadout
                            rows={[
                                ["Modes", "Daily and unlimited"],
                                ["Tiles", "6 flip as you miss"],
                                ["Hints", "3, one at a time"],
                                ["Filters", "Difficulty and region"],
                            ]}
                            notes={[
                                "Each wrong guess flips another tile and adds a clue.",
                                "Hints reveal the continent, then the first letter and letter count, then the outline.",
                                "Unlimited mode lets you narrow the pool by difficulty and region.",
                                "The full flag shows once the round is over.",
                            ]}
                        />
                    </div>
                </Section>
            </CreationsShell>
        </div>
    );
}
