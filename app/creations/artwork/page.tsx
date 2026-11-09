import { ArtCollectionSection, CreationsShell } from "@/components/creations-sections";
import { ART_COLLECTIONS } from "@/lib/creations-data";

export default function ArtworkPage() {
    return (
        <CreationsShell
            eyebrow="Creations / Artwork"
            title={["Artwork"]}
            description="The AP Art portfolio, Blender renders and drawings. The slots below are placeholders waiting for real pieces."
            back={{ href: "/creations", label: "Back to Creations" }}
        >
            {ART_COLLECTIONS.map((c, i) => (
                <ArtCollectionSection key={c.id} collection={c} no={String(i + 1).padStart(2, "0")} />
            ))}
        </CreationsShell>
    );
}

export const metadata = { title: "Artwork" };
