import { Starwright } from "@/components/starwright/starwright";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
    title: "Starwright",
    description: "An idle game about a star. Fuse hydrogen up the periodic table, go supernova, and chart constellations. Saves in your browser.",
    path: "/creations/games/starwright",
    image: "/creations/opengraph-image",
});

export default function StarwrightPage() {
    return <Starwright />;
}
