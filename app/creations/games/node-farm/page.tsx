import "@/app/camino/games.css";
import "@/app/camino/nodefarm/base.css";
import "@/app/camino/nodefarm/deep.css";
import "@/app/camino/nodefarm/arcs.css";
import "@/app/camino/nodefarm/scenery.css";
import "@/app/camino/nodefarm/zone-art.css";
import "@/app/camino/nodefarm/tree.css";
import "@/app/camino/nodefarm/code.css";
import "@/app/camino/nodefarm/ascend.css";
import "@/app/camino/nodefarm/fs.css";
import "@/app/camino/nodefarm/fx.css";
import "@/app/camino/nodefarm/windows.css";
import "@/app/camino/nodefarm/switcher.css";
import "@/app/camino/nodefarm/next.css";
import "@/app/camino/nodefarm/admin.css";
import "@/app/camino/nodefarm/phone.css";
import "@/app/camino/nodefarm/layout.css";
import { CreationsShell, Section } from "@/components/creations-sections";
import { GameFrame } from "@/components/games/naos";
import { NodeFarm } from "@/components/nodefarm/node-farm";
import { NodeFarmBoundary } from "@/components/nodefarm/board/error-boundary";
import { NaosBackdrop } from "@/components/cm/naos-art";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
    title: "Node Farm",
    description: "An idle incremental game. Hack the core, buy Multipliers and Reboots, then farm Copper, Silicon, Quartz and Aether. Saves in your browser.",
    path: "/creations/games/node-farm",
    image: "/creations/opengraph-image",
});

export default function NodeFarmPage() {
    return (
        <div className="ctos ng-page">
            <NaosBackdrop src="/naos/bg-games.webp" />
            <CreationsShell
                eyebrow="Incremental"
                title={["Node Farm"]}
                description="An idle game about growing one hacked node into a farm. Buy buttons, Reboot for power, and chain materials that each boost the one below. It keeps running while you're away."
                back={{ href: "/creations/games", label: "Back to Games" }}
                variant="sub"
            >
                <Section id="play" no="01" label="Play" title="Hack the node." ctos>
                    <div className="nf-bleed">
                        <GameFrame code="node.farm" foot={["saves on this device", "offline up to 8 h"]}>
                        <NodeFarmBoundary>
                            <NodeFarm />
                        </NodeFarmBoundary>
                    </GameFrame>
                    </div>
                </Section>
            </CreationsShell>
        </div>
    );
}
