import { getProjects } from "@/lib/content";
import { CreationsShell, ProjectGrid, Section } from "@/components/creations-sections";

export const revalidate = 60;

export default async function ProjectsPage() {
    const projects = await getProjects();
    return (
        <CreationsShell
            eyebrow="Creations / Projects"
            title={["Projects"]}
            description="Coding and Roblox projects: solo-built, systems-driven, shipped and in progress."
            back={{ href: "/creations", label: "Back to Creations" }}
        >
            <Section id="projects" no="01" label="All projects" title="Open any project." blurb="Open any project for its status, tags and links.">
                <ProjectGrid projects={projects} />
            </Section>
        </CreationsShell>
    );
}

export const metadata = { title: "Projects" };
