import { ArtCollectionSection, CreationsShell } from "@/components/creations-sections";
import { ART_COLLECTIONS, categoryById } from "@/lib/creations-data";
import { pageMeta } from "@/lib/seo";

export default function ArtworkPage() {
    return (
        <CreationsShell
            eyebrow="Creations / Artwork"
            title={["Artwork"]}
            description="The AP Art portfolio, Blender renders and drawings."
            back={{ href: "/creations", label: "Back to Creations" }}
        >
            {ART_COLLECTIONS.map((c, i) => (
                <ArtCollectionSection key={c.id} collection={c} no={String(i + 1).padStart(2, "0")} />
            ))}
        </CreationsShell>
    );
}

export const metadata = pageMeta({
    title: "Artwork",
    description: categoryById("artwork").blurb,
    path: "/creations/artwork",
    image: "/creations/opengraph-image",
});
