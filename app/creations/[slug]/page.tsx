import { notFound } from "next/navigation";
import { getProjectBySlug, getAllProjectSlugs, statusLabel } from "@/lib/content";
import { categoryById } from "@/lib/creations-data";
import { PageHead } from "@/components/cm/ui";

export const revalidate = 60;

export async function generateStaticParams() {
    const slugs = await getAllProjectSlugs();
    return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const project = await getProjectBySlug(slug);
    return { title: project?.title ?? "Creation" };
}

const tone = { active: "live", planning: "warn", idea: "" } as const;

// Individual project / renovation page: the same hatched plate the grid cards use, then a detail sheet
// with the status, tags and an outbound link.
export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const project = await getProjectBySlug(slug);
    if (!project) notFound();

    const isProject = project.section === "projects";
    const Icon = categoryById(isProject ? "projects" : "renovations").icon;
    return (
        <>
            <PageHead
                label={project.category}
                title={[project.title]}
                lead={project.description}
                back={{ href: isProject ? "/creations/projects" : "/creations/renovations", label: isProject ? "Back to Projects" : "Back to Renovations" }}
            />
            <section className="cm-section" id="detail">
                <div className="cm-wrap" data-mx-stagger="" style={{ display: "grid", gap: 20 }}>
                    <div className="cm-viz" style={{ aspectRatio: "16 / 7", minHeight: 150 }}>
                        <span className={`cm-tag flat ${tone[project.status]}`} style={{ position: "absolute", left: 12, top: 12 }}>
                            {statusLabel[project.status]}
                        </span>
                        <Icon aria-hidden="true" style={{ position: "absolute", right: 16, bottom: 14, width: 52, height: 52, color: "var(--cm-hair-hi)" }} />
                    </div>

                    <div className="cm-panel tick" style={{ maxWidth: 720, width: "100%" }}>
                        <div className="cm-hbar">
                            <span>{isProject ? "Project" : "Renovation"}</span>
                            <span>{project.slug}</span>
                        </div>
                        <dl className="cm-kv two" style={{ ["--cols" as string]: 2 }}>
                            <div><dt>Status</dt><dd><span className={`cm-tag flat ${tone[project.status]}`}>{statusLabel[project.status]}</span></dd></div>
                            <div><dt>Category</dt><dd>{project.category}</dd></div>
                        </dl>
                        {project.tags.length > 0 && (
                            <div className="cm-prow">
                                <span className="cm-lbl">Tags</span>
                                <div className="cm-row-gap">
                                    {project.tags.map((t) => (
                                        <span key={t} className="cm-pill">{t}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {project.href && (
                            <div className="cm-prow">
                                <a className="cm-btn solid" href={project.href} target="_blank" rel="noreferrer" style={{ justifySelf: "start" }}>
                                    Visit project ↗
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </>
    );
}
