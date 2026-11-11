import { getRecentRenovations } from "@/lib/content";
import { CreationsShell, FeedOffline, ListStatusCard, ProjectGrid, Section } from "@/components/creations-sections";
import { pageMeta } from "@/lib/seo";
import { NaosBackdrop } from "@/components/cm/naos-art";
import { categoryById } from "@/lib/creations-data";

export const revalidate = 60;

export default async function RenovationsPage() {
    const feed = await getRecentRenovations();
    return (
        <CreationsShell
            eyebrow="Creations / Renovations"
            title={["Renovations"]}
            description="Studying and reimagining real places: measured, modeled and redesigned to be greener and more inviting."
            back={{ href: "/creations", label: "Back to Creations" }}
            variant="sub"
            aside={<ListStatusCard label="renovations // index" badge="rn" projects={feed.items} offline={feed.offline} />}
        >
            <NaosBackdrop src="/naos/bg-default.webp" />
            <Section id="renovations" no="01" label="All renovations" title="Each study starts from a real site." blurb="Every study ends in a redesign.">
                {feed.offline ? <FeedOffline what="Renovations" /> : <ProjectGrid projects={feed.items} />}
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
