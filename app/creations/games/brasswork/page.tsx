import "@/app/camino/games.css";
import { CreationsShell, Section } from "@/components/creations-sections";
import { GameFrame } from "@/components/games/naos";
import { NaosBackdrop } from "@/components/cm/naos-art";
import { BrassworkHost } from "@/components/brasswork/brasswork-host";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
    title: "Brasswork",
    description: "A 3D automation game in development: a clockwork workshop on a voxel island.",
    path: "/creations/games/brasswork",
    image: "/creations/opengraph-image",
});

export default function BrassworkPage() {
    return (
        <div className="ctos ng-page">
            <NaosBackdrop src="/naos/bg-games.webp" />
            <CreationsShell
                eyebrow="Automation"
                title={["Brasswork"]}
                description="A clockwork-workshop factory on a 3D voxel island. In development."
                back={{ href: "/creations/games", label: "Back to Games" }}
                variant="sub"
            >
                <Section id="play" no="01" label="Play" title="The workshop." ctos>
                    <GameFrame code="brasswork" foot={["in development", "saves on this device"]}>
                        <BrassworkHost />
                    </GameFrame>
                </Section>
            </CreationsShell>
        </div>
    );
}
