import "@/app/camino/games.css";
import "@/app/camino/strata.css";
import { CreationsShell, Section } from "@/components/creations-sections";
import { GameFrame, GameReadout } from "@/components/games/naos";
import { Strata, STRATA_NAME } from "@/components/games/strata";
import { ANSWER_COUNT, GUESS_COUNT } from "@/lib/strata/engine";
import { pageMeta } from "@/lib/seo";

import { NaosBackdrop } from "@/components/cm/naos-art";
export const metadata = pageMeta({
    title: STRATA_NAME,
    description: "Find the hidden five-letter word in six tries. A daily word, the same for everyone, and unlimited practice words, played in your browser.",
    path: "/creations/games/strata",
    image: "/creations/opengraph-image",
});

export default function StrataPage() {
    return (
        <div className="ctos ng-page">
            <NaosBackdrop src="/naos/bg-games.webp" />
            <CreationsShell
                eyebrow="Daily, then unlimited"
                title={[STRATA_NAME]}
                description="Find the hidden five-letter word in six tries. Each guess marks every letter: right letter in the right place, right letter in the wrong place, or not in the word. Finish the daily once and unlimited words open."
                back={{ href: "/creations/games", label: "Back to Games" }}
                variant="sub"
            >
                <Section id="play" no="01" label="Play" title="Find the word." ctos>
                    <div className="g-layout">
                        <GameFrame code="strata.guess" foot={[`${ANSWER_COUNT} answers`, "stats on this device"]}>
                            <Strata />
                        </GameFrame>
                        <GameReadout
                            rows={[
                                ["Modes", "Daily, then unlimited"],
                                ["Tries", "6 per word"],
                                ["Words", `${ANSWER_COUNT} answers, ${GUESS_COUNT} valid guesses`],
                                ["Input", "On-screen keys or the keyboard"],
                            ]}
                            notes={[
                                "Finish today's daily once to open Unlimited. It stays open on this device.",
                                "A tile is solid when the letter is right and in place, outlined and hatched when it is in the word elsewhere, and lowercase with a slash when it is not in the word.",
                                "Repeated letters are scored the usual way: each copy in the word is matched once.",
                                "A reload in the middle of a round brings the board back as it was.",
                            ]}
                        />
                    </div>
                </Section>
            </CreationsShell>
        </div>
    );
}
