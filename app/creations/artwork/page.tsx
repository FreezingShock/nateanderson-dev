import { ArtCollectionSection, CreationsShell } from "@/components/creations-sections";
import { IdCard } from "@/components/creations-sections";
import { CountUp } from "@/components/cm/reveal";
import { ART_COLLECTIONS, categoryById } from "@/lib/creations-data";
import { pageMeta } from "@/lib/seo";

export default function ArtworkPage() {
    return (
        <CreationsShell
            eyebrow="Creations / Artwork"
            title={["Artwork"]}
            description="The AP Art portfolio, Blender renders and drawings."
            back={{ href: "/creations", label: "Back to Creations" }}
            variant="sub"
            aside={
                <IdCard
                    label="artwork // index"
                    badge="ar"
                    year={String(ART_COLLECTIONS.length).padStart(2, "0")}
                    rows={ART_COLLECTIONS.map((c) => ({ k: c.title, v: <CountUp value={c.slots.length} /> }))}
                    foot={["collections / all", `${ART_COLLECTIONS.reduce((n, c) => n + c.slots.length, 0)} slots`]}
                    live={false}
                />
            }
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
