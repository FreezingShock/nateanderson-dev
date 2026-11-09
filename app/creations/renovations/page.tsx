import { getRecentRenovations } from "@/lib/content";
import { CreationsShell, ProjectGrid, Section } from "@/components/creations-sections";

export const revalidate = 60;

export default async function RenovationsPage() {
    const renovations = await getRecentRenovations();
    return (
        <CreationsShell
            eyebrow="Creations / Renovations"
            title={["Renovations"]}
            description="Studying and reimagining real places: measured, modeled and redesigned to be greener and more inviting."
            back={{ href: "/creations", label: "Back to Creations" }}
        >
            <Section id="renovations" no="01" label="All renovations" title="Each study starts from a real site." blurb="Each study starts from a real site and ends in a redesign.">
                <ProjectGrid projects={renovations} />
            </Section>
        </CreationsShell>
    );
}

export const metadata = { title: "Renovations" };
