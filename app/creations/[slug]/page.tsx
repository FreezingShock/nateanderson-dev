import { notFound } from "next/navigation";
import { getProjectBySlug, getAllProjectSlugs, statusLabel } from "@/lib/content";
import { categoryById } from "@/lib/creations-data";
import { CreationsHead, IdCard } from "@/components/creations-sections";

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

// Individual project / renovation page: the naOS title block, a hatched plate with the status tag and icon, then a
// status card (the file) beside a detail sheet with the tags and the outbound link.
export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const project = await getProjectBySlug(slug);
    if (!project) notFound();

    const isProject = project.section === "projects";
    const Icon = categoryById(isProject ? "projects" : "renovations").icon;
    const kind = isProject ? "Project" : "Renovation";
    return (
        <div className="ctos">
            <CreationsHead
                label={project.category}
                title={[project.title]}
                lead={project.description}
                back={{ href: isProject ? "/creations/projects" : "/creations/renovations", label: isProject ? "Back to Projects" : "Back to Renovations" }}
                aside={
                    <IdCard
                        label={`${kind.toLowerCase()} // file`}
                        badge={isProject ? "pj" : "rn"}
                        year={project.status}
                        live={false}
                        rows={[
                            { k: "Status", v: statusLabel[project.status] },
                            { k: "Category", v: project.category },
                            { k: "Section", v: kind },
                            { k: "Slug", v: project.slug },
                        ]}
                        foot={["file / " + project.slug, `${project.tags.length} tags`]}
                    />
                }
            />
            <section className="cm-section cr-detail-sec" id="detail">
                <div className="cm-wrap cr-detail" data-rx-auto="">
                    <div className="cm-viz cr-plate">
                        <span className={`cm-tag flat ${tone[project.status]} cr-plate-tag`}>{statusLabel[project.status]}</span>
                        <Icon className="cr-plate-ic" aria-hidden="true" />
                    </div>

                    <div className="cm-panel cr-sheet">
                        <div className="cm-hbar">
                            <span>Details</span>
                            <span>{kind}</span>
                        </div>
                        <div className="cr-sheet-cols">
                            {project.tags.length > 0 && (
                                <div className="cr-sheet-block">
                                    <span className="cm-lbl">Tags</span>
                                    <div className="cr-tags">
                                        {project.tags.map((t) => (
                                            <span key={t} className="cm-pill">{t}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="cr-sheet-block">
                                <span className="cm-lbl">Link</span>
                                {project.href ? (
                                    <div className="cm-row cta">
                                        <a className="cta-b a" href={project.href} target="_blank" rel="noreferrer">
                                            <i>GO</i><span>Visit project</span><em aria-hidden="true">↗</em>
                                        </a>
                                    </div>
                                ) : (
                                    <p className="cm-body" style={{ margin: 0 }}>No outside link yet. This one lives on the site for now.</p>
                                )}
                            </div>
                        </div>
                        <div className="p-foot" aria-hidden="true">
                            <span className="id-bars"><i /><i /><i /><i /><i /></span>
                            <span>{kind.toLowerCase()} / {project.status}</span>
                            <span>{project.category}</span>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
