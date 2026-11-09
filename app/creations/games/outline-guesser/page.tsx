import { CreationsShell, Section } from "@/components/creations-sections";
import { OutlineGuesser } from "@/components/games/outline-guesser";

export const metadata = { title: "Outline Guesser" };

export default function OutlineGuesserPage() {
    return (
        <CreationsShell
            eyebrow="Daily and unlimited"
            title={["Outline Guesser"]}
            description="Name the country or territory from its outline. Six guesses; every miss shows the distance, the direction to the target and how close you are."
            back={{ href: "/creations/games", label: "Back to Games" }}
        >
            <Section id="play" no="01" label="Play" title="Name that outline.">
                <OutlineGuesser />
            </Section>
        </CreationsShell>
    );
}
