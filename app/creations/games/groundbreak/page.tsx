import { Groundbreak } from "@/components/groundbreak/groundbreak";
import { gbFontClass } from "@/lib/groundbreak-fonts/fonts";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
    title: "Groundbreak",
    description: "An idle game about a construction company. Chain twelve materials from gravel to floors, build a Bay Area skyline job by job, and incorporate to start again with it intact. Saves in your browser.",
    path: "/creations/games/groundbreak",
    image: "/creations/opengraph-image",
});

export default function GroundbreakPage() {
    return (
        <div className={gbFontClass}>
            <Groundbreak />
        </div>
    );
}
