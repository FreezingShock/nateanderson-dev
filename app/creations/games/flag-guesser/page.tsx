import { CreationsShell, Section } from "@/components/creations-sections";
import { FlagGuesser } from "@/components/games/flag-guesser";

export const metadata = { title: "Flag Guesser" };

export default function FlagGuesserPage() {
    return (
        <CreationsShell
            eyebrow="Daily and unlimited"
            title={["Flag Guesser"]}
            description="Name the country from its flag. It starts hidden behind six tiles and every wrong guess flips another, with distance and direction clues to the right country."
            back={{ href: "/creations/games", label: "Back to Games" }}
        >
            <Section id="play" no="01" label="Play" title="Name that flag.">
                <FlagGuesser />
            </Section>
        </CreationsShell>
    );
}
