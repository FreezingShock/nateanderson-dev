import { getProjects } from "@/lib/content";
import { CreationsShell, ListStatusCard, ProjectGrid, Section } from "@/components/creations-sections";
import { pageMeta } from "@/lib/seo";
import { categoryById } from "@/lib/creations-data";

export const revalidate = 60;

export default async function ProjectsPage() {
    const projects = await getProjects();
    return (
        <CreationsShell
            eyebrow="Creations / Projects"
            title={["Projects"]}
            description="Coding and Roblox projects: solo-built, systems-driven, shipped and in progress."
            back={{ href: "/creations", label: "Back to Creations" }}
            variant="sub"
            aside={<ListStatusCard label="projects // index" badge="pj" projects={projects} />}
        >
            <Section id="projects" no="01" label="All projects" title="Open any project." blurb="Open any project for its status, tags and links.">
                <ProjectGrid projects={projects} />
            </Section>
        </CreationsShell>
    );
}

export const metadata = pageMeta({
    title: "Projects",
    description: categoryById("projects").blurb,
    path: "/creations/projects",
    image: "/creations/opengraph-image",
});
