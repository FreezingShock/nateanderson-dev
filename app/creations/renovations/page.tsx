import { getRecentRenovations } from "@/lib/content";
import { CreationsShell, ListStatusCard, ProjectGrid, Section } from "@/components/creations-sections";
import { pageMeta } from "@/lib/seo";
import { categoryById } from "@/lib/creations-data";

export const revalidate = 60;

export default async function RenovationsPage() {
    const renovations = await getRecentRenovations();
    return (
        <CreationsShell
            eyebrow="Creations / Renovations"
            title={["Renovations"]}
            description="Studying and reimagining real places: measured, modeled and redesigned to be greener and more inviting."
            back={{ href: "/creations", label: "Back to Creations" }}
            variant="sub"
            aside={<ListStatusCard label="renovations // index" badge="rn" projects={renovations} />}
        >
            <Section id="renovations" no="01" label="All renovations" title="Each study starts from a real site." blurb="Each study starts from a real site and ends in a redesign.">
                <ProjectGrid projects={renovations} />
            </Section>
        </CreationsShell>
    );
}

export const metadata = pageMeta({
    title: "Renovations",
    description: categoryById("renovations").blurb,
    path: "/creations/renovations",
    image: "/creations/opengraph-image",
});
